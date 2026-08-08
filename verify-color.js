/* =============================================================================
   verify-color.js — 圖片產線色彩驗證儀（CIEDE2000 ΔE）
   用法： node verify-color.js
          node verify-color.js --pipeline=<path>   指定產線模組（對照組跑舊版）
          node verify-color.js --dir=<path>        工作目錄（預設系統暫存，跑完自刪）
          node verify-color.js --keep              保留 fixtures 與輸出供人眼複看
          node verify-color.js --tiers=1600,2560   只測指定 tier（預設 800,1600,2560）

   做什麼：程式生成一張攝影關鍵色的色塊網格（膚色／天空藍／草綠／中性灰階／飽和色／
   記憶色 32 塊 ＋ 漸層帶 8 條 = 40 個取樣區），輸出成多個**視覺同色但色彩空間不同**的
   fixture（sRGB／Adobe RGB／Display P3 × 8-bit／16-bit ＋ 無 profile 對照），丟進
   ingest-photos.js 的真實 encode()，再把 AVIF/WebP 解碼回像素，與 sRGB 基準逐區算
   CIEDE2000 ΔE。

   門檻：色塊類 mean ΔE < 1.0、max ΔE < 2.0（AVIF/WebP 有損編碼的合理範圍）。
   超標＝產線有 bug 要修，不是放寬門檻。漸層帶另計（重採樣＋色度抽樣本就較吃虧），
   列出供參考不納入 PASS/FAIL。

   Adobe RGB profile 哪來的：本檔用原色座標＋Bradford 色適應**現算**一份 ICC v2
   matrix/TRC profile（buildIccProfile），不依賴機器上有沒有裝 Adobe。正確性三重自證，
   跑起來會印出來：
     (1) 算出的 D50 colorant 與官方 AdobeRGB1998.icc 的 rXYZ/gXYZ/bXYZ 逐值相符；
     (2) sRGB → 本 profile → 回 sRGB 的往返 ΔE ≈ 0（＝「視覺同色」前提成立）；
     (3) 若機器上找得到官方 AdobeRGB1998.icc，比對兩者轉出的 Adobe RGB 編碼值差異。
   ============================================================================= */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');

// ---------- 參數 ----------
const argv = process.argv.slice(2);
const arg = (k, d) => {
  const hit = argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};
const FLAG = (k) => argv.includes(`--${k}`);
const PIPELINE = path.resolve(arg('pipeline', path.join(__dirname, 'ingest-photos.js')));
const WORKDIR = path.resolve(arg('dir', path.join(os.tmpdir(), 'hud-verify-color')));
const TIERS = arg('tiers', '800,1600,2560').split(',').map(Number);
const KEEP = FLAG('keep');

const MEAN_LIMIT = 1.0;
const MAX_LIMIT = 2.0;

// Windows：libvips 的 operation cache 會續抱輸入檔 handle，收工刪暫存目錄會 EPERM
sharp.cache(false);

// 刪暫存目錄（handle 未即時釋放時重試幾次，仍失敗只警告不影響判定）
function rmDir(dir) {
  for (let i = 0; i < 5; i++) {
    try { fs.rmSync(dir, { recursive: true, force: true }); return true; } catch (e) { /* 重試 */ }
    const t = Date.now() + 120; while (Date.now() < t) { /* 短暫等 handle 釋放 */ }
  }
  console.log(`  （提醒：暫存目錄刪不掉，請手動清 ${dir}）`);
  return false;
}

// =============================================================================
// §1  ICC profile 生成（ICC v2 matrix/TRC，純計算）
// =============================================================================
const mul = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((s, v, k) => s + v * B[k][j], 0)));
const mv = (A, v) => A.map((r) => r.reduce((s, x, k) => s + x * v[k], 0));
const inv = (m) => {
  const [a, b, c] = m[0], [d, e, f] = m[1], [g, h, i] = m[2];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
  return [
    [A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
    [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
    [C / det, -(a * h - b * g) / det, (a * e - b * d) / det],
  ];
};
const BRADFORD = [[0.8951, 0.2664, -0.1614], [-0.7502, 1.7135, 0.0367], [0.0389, -0.0685, 1.0296]];
const PCS_D50 = [0.9642, 1.0, 0.8249];               // ICC 規定的 PCS 白點

const xyToXYZ = (x, y) => [x / y, 1, (1 - x - y) / y];

// 原色 xy ＋白點 xy → 線性 RGB→XYZ 矩陣（該白點下）
function rgbToXYZMatrix(primaries, whiteXY) {
  const cols = primaries.map(([x, y]) => xyToXYZ(x, y));
  const M0 = [0, 1, 2].map((r) => cols.map((c) => c[r]));
  const W = xyToXYZ(whiteXY[0], whiteXY[1]);
  const S = mv(inv(M0), W);
  return { M: [0, 1, 2].map((r) => [0, 1, 2].map((c) => M0[r][c] * S[c])), W };
}
// Bradford 色適應到 PCS 的 D50（colorant 先適應好，wtpt 就寫 D50）
function adaptToD50(M, W) {
  const cs = mv(BRADFORD, W), cd = mv(BRADFORD, PCS_D50);
  const D = [[cd[0] / cs[0], 0, 0], [0, cd[1] / cs[1], 0], [0, 0, cd[2] / cs[2]]];
  return mul(mul(inv(BRADFORD), D), mul(BRADFORD, M));
}

const s15 = (v) => Math.round(v * 65536);            // s15Fixed16
const pad4 = (n) => (4 - (n % 4)) % 4;
const tagXYZ = (v) => {
  const b = Buffer.alloc(20); b.write('XYZ ', 0, 'ascii');
  b.writeInt32BE(s15(v[0]), 8); b.writeInt32BE(s15(v[1]), 12); b.writeInt32BE(s15(v[2]), 16);
  return b;
};
const tagCurve = (gamma) => {                        // curveType，count=1 ＝ u8Fixed8 gamma
  const b = Buffer.alloc(14); b.write('curv', 0, 'ascii');
  b.writeUInt32BE(1, 8); b.writeUInt16BE(Math.round(gamma * 256), 12);
  return b;
};
const tagDesc = (s) => {                             // v2 textDescriptionType
  const n = s.length + 1, b = Buffer.alloc(90 + n);
  b.write('desc', 0, 'ascii'); b.writeUInt32BE(n, 8); b.write(s, 12, 'ascii');
  return b;                                          // 後面 unicode/scriptcode 區留 0 即合法
};
const tagText = (s) => {
  const b = Buffer.alloc(8 + s.length + 1); b.write('text', 0, 'ascii'); b.write(s, 8, 'ascii');
  return b;
};

function buildIccProfile({ primaries, white, gamma, desc }) {
  const { M, W } = rgbToXYZMatrix(primaries, white);
  const A = adaptToD50(M, W);
  const colorant = (i) => [A[0][i], A[1][i], A[2][i]];
  const tags = [
    ['desc', tagDesc(desc)],
    ['wtpt', tagXYZ(PCS_D50)],
    ['rXYZ', tagXYZ(colorant(0))],
    ['gXYZ', tagXYZ(colorant(1))],
    ['bXYZ', tagXYZ(colorant(2))],
    ['rTRC', tagCurve(gamma)], ['gTRC', tagCurve(gamma)], ['bTRC', tagCurve(gamma)],
    ['cprt', tagText('Generated by verify-color.js for colour verification.')],
  ];
  const tableSize = 4 + tags.length * 12;
  const table = Buffer.alloc(tableSize); table.writeUInt32BE(tags.length, 0);
  let off = 128 + tableSize; off += pad4(off);
  const body = [];
  tags.forEach(([sig, buf], i) => {
    table.write(sig, 4 + i * 12, 'ascii');
    table.writeUInt32BE(off, 8 + i * 12);
    table.writeUInt32BE(buf.length, 12 + i * 12);
    body.push(buf);
    const p = pad4(buf.length); if (p) body.push(Buffer.alloc(p));
    off += buf.length + p;
  });
  const head = Buffer.alloc(128);
  head.writeUInt32BE(0x02100000, 8);                 // v2.1
  head.write('mntr', 12, 'ascii'); head.write('RGB ', 16, 'ascii'); head.write('XYZ ', 20, 'ascii');
  head.writeUInt16BE(2026, 24); head.writeUInt16BE(1, 26); head.writeUInt16BE(1, 28);
  head.write('acsp', 36, 'ascii'); head.write('MSFT', 40, 'ascii');
  head.writeUInt32BE(0, 64);                         // rendering intent = perceptual
  head.writeInt32BE(s15(PCS_D50[0]), 68); head.writeInt32BE(s15(PCS_D50[1]), 72);
  head.writeInt32BE(s15(PCS_D50[2]), 76);
  const out = Buffer.concat([head, table, Buffer.alloc(pad4(128 + tableSize)), ...body]);
  out.writeUInt32BE(out.length, 0);
  return { icc: out, colorants: [colorant(0), colorant(1), colorant(2)] };
}

const ADOBE_RGB = {
  primaries: [[0.6400, 0.3300], [0.2100, 0.7100], [0.1500, 0.0600]],
  white: [0.3127, 0.3290],                            // D65
  gamma: 563 / 256,                                   // Adobe RGB (1998) ＝ 2.19921875
  desc: 'Adobe RGB (1998) compatible',
};
// 官方 AdobeRGB1998.icc 的 colorant（用來核對算出來的值；不需要這個檔案也能跑）
const ADOBE_REF_COLORANTS = [
  [0.60974, 0.31111, 0.01947], [0.20528, 0.62567, 0.06087], [0.14919, 0.06322, 0.74457],
];
const SYS_ADOBE = 'C:/Windows/System32/spool/drivers/color/AdobeRGB1998.icc';

// =============================================================================
// §2  色度學：sRGB → Lab(D65) → CIEDE2000
// =============================================================================
const D65 = [0.95047, 1.0, 1.08883];
const M_SRGB = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.0721750],
  [0.0193339, 0.1191920, 0.9503041],
];
const srgbToLinear = (v) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };

function srgbToLab(r, g, b) {
  const lin = [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
  const XYZ = mv(M_SRGB, lin);
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);
  const fx = f(XYZ[0] / D65[0]), fy = f(XYZ[1] / D65[1]), fz = f(XYZ[2] / D65[2]);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const rad = (d) => d * Math.PI / 180;
function ciede2000([L1, a1, b1], [L2, a2, b2]) {
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2);
  const Cb = (C1 + C2) / 2;
  const Cb7 = Math.pow(Cb, 7);
  const G = 0.5 * (1 - Math.sqrt(Cb7 / (Cb7 + Math.pow(25, 7))));
  const ap1 = (1 + G) * a1, ap2 = (1 + G) * a2;
  const Cp1 = Math.hypot(ap1, b1), Cp2 = Math.hypot(ap2, b2);
  const hAng = (a, b) => { if (a === 0 && b === 0) return 0; const h = Math.atan2(b, a) * 180 / Math.PI; return h < 0 ? h + 360 : h; };
  const hp1 = hAng(ap1, b1), hp2 = hAng(ap2, b2);
  const dLp = L2 - L1, dCp = Cp2 - Cp1;
  let dhp = 0;
  if (Cp1 * Cp2 !== 0) { dhp = hp2 - hp1; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
  const dHp = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin(rad(dhp) / 2);
  const Lbp = (L1 + L2) / 2, Cbp = (Cp1 + Cp2) / 2;
  let hbp;
  if (Cp1 * Cp2 === 0) hbp = hp1 + hp2;
  else if (Math.abs(hp1 - hp2) <= 180) hbp = (hp1 + hp2) / 2;
  else hbp = hp1 + hp2 < 360 ? (hp1 + hp2 + 360) / 2 : (hp1 + hp2 - 360) / 2;
  const T = 1 - 0.17 * Math.cos(rad(hbp - 30)) + 0.24 * Math.cos(rad(2 * hbp))
    + 0.32 * Math.cos(rad(3 * hbp + 6)) - 0.20 * Math.cos(rad(4 * hbp - 63));
  const dTheta = 30 * Math.exp(-Math.pow((hbp - 275) / 25, 2));
  const Cbp7 = Math.pow(Cbp, 7);
  const Rc = 2 * Math.sqrt(Cbp7 / (Cbp7 + Math.pow(25, 7)));
  const Sl = 1 + (0.015 * Math.pow(Lbp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbp - 50, 2));
  const Sc = 1 + 0.045 * Cbp;
  const Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(rad(2 * dTheta)) * Rc;
  return Math.sqrt(
    Math.pow(dLp / Sl, 2) + Math.pow(dCp / Sc, 2) + Math.pow(dHp / Sh, 2)
    + Rt * (dCp / Sc) * (dHp / Sh)
  );
}

// Sharma 等人的 CIEDE2000 標準測試對（自證公式沒寫錯）
const CIEDE_CASES = [
  [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
  [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
  [[50, 2.8361, -74.0200], [50, 0, -82.7485], 3.4412],
  [[50, 2.4900, -0.0010], [50, -2.4900, 0.0009], 7.1792],
  [[50, 2.5000, 0], [50, 0, -2.5000], 4.3065],
  [[50, 2.5000, 0], [73, 25, -18], 27.1492],
  [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
  [[22.7233, 20.0904, -46.6940], [23.0331, 14.9730, -42.5619], 2.0373],
  [[90.9257, -0.5406, -0.9208], [88.6381, -0.8985, -0.7239], 1.5381],
];

// =============================================================================
// §3  測試圖：攝影關鍵色網格
// =============================================================================
const COLS = 8, ROWS = 5, CELL = 320;                  // 2560 × 1600
const GRID_W = COLS * CELL, GRID_H = ROWS * CELL;
const SOLIDS = [
  // 膚色（淺→深，含中性與偏紅兩路）
  ['膚 極淺', 241, 205, 184], ['膚 淺', 222, 171, 143], ['膚 中', 198, 134, 102],
  ['膚 深', 150, 90, 64], ['膚 極深', 99, 60, 44],
  // 天空
  ['天 淡藍', 135, 178, 222], ['天 中藍', 99, 150, 205], ['天 深藍', 60, 116, 180],
  ['天 頂藍', 28, 72, 140],
  // 植被
  ['葉 嫩綠', 139, 168, 89], ['葉 草綠', 98, 140, 63], ['葉 深綠', 63, 110, 54],
  ['葉 陰影', 40, 74, 44],
  // 中性階
  ['灰 白', 255, 255, 255], ['灰 90', 224, 224, 224], ['灰 70', 178, 178, 178],
  ['灰 50', 128, 128, 128], ['灰 30', 78, 78, 78], ['灰 黑', 24, 24, 24],
  // 飽和色（色度抽樣最容易出事的一群）
  ['飽 紅', 200, 30, 40], ['飽 橙', 230, 120, 20], ['飽 黃', 240, 200, 40],
  ['飽 綠', 30, 150, 90], ['飽 藍', 30, 90, 180], ['飽 紫', 130, 50, 150],
  // 記憶色／常見場景色
  ['記 消防紅', 206, 58, 52], ['記 米黃', 176, 143, 96], ['記 青灰', 74, 110, 120],
  ['記 珊瑚', 233, 150, 122], ['記 夜藍', 60, 60, 90],
  ['白 暖', 250, 240, 220], ['白 冷', 210, 220, 235],
];
const RAMPS = [                                        // 第 5 列：漸層帶（暗→亮）
  ['漸 中性', [10, 10, 10], [245, 245, 245]],
  ['漸 膚色', [92, 55, 40], [246, 214, 196]],
  ['漸 天空', [20, 52, 110], [178, 208, 238]],
  ['漸 草綠', [26, 52, 30], [172, 200, 120]],
  ['漸 紅', [60, 8, 10], [242, 120, 110]],
  ['漸 藍', [12, 24, 70], [130, 170, 240]],
  ['漸 黃', [70, 56, 8], [250, 226, 120]],
  ['漸 紫', [48, 16, 60], [200, 150, 235]],
];

// 生成 sRGB 8-bit raw buffer
function makeGrid() {
  const buf = Buffer.alloc(GRID_W * GRID_H * 3);
  const regions = [];
  for (let ry = 0; ry < ROWS; ry++) {
    for (let cx = 0; cx < COLS; cx++) {
      const idx = ry * COLS + cx;
      const x0 = cx * CELL, y0 = ry * CELL;
      let name, kind;
      if (ry < ROWS - 1) {
        const s = SOLIDS[idx];
        name = s[0]; kind = 'solid';
        for (let y = 0; y < CELL; y++) {
          for (let x = 0; x < CELL; x++) {
            const o = ((y0 + y) * GRID_W + x0 + x) * 3;
            buf[o] = s[1]; buf[o + 1] = s[2]; buf[o + 2] = s[3];
          }
        }
      } else {
        const [nm, a, b] = RAMPS[cx];
        name = nm; kind = 'ramp';
        for (let y = 0; y < CELL; y++) {
          for (let x = 0; x < CELL; x++) {
            const t = x / (CELL - 1);
            const o = ((y0 + y) * GRID_W + x0 + x) * 3;
            for (let c = 0; c < 3; c++) buf[o + c] = Math.round(a[c] + (b[c] - a[c]) * t);
          }
        }
      }
      // 取樣區＝色塊中央 50%（避開重採樣時的邊緣渗色）
      regions.push({ name, kind, rx: (x0 + CELL * 0.25) / GRID_W, ry: (y0 + CELL * 0.25) / GRID_H, rw: 0.5 * CELL / GRID_W, rh: 0.5 * CELL / GRID_H });
    }
  }
  return { buf, regions };
}

// 從解碼後的 raw buffer 取某相對區塊的平均色
function sampleRegion(buf, w, h, r) {
  const x0 = Math.round(r.rx * w), y0 = Math.round(r.ry * h);
  const x1 = Math.max(x0 + 1, Math.round((r.rx + r.rw) * w));
  const y1 = Math.max(y0 + 1, Math.round((r.ry + r.rh) * h));
  let sr = 0, sg = 0, sb = 0, n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const o = (y * w + x) * 3;
      sr += buf[o]; sg += buf[o + 1]; sb += buf[o + 2]; n++;
    }
  }
  return [sr / n, sg / n, sb / n];
}

// =============================================================================
// §4  fixtures：同一視覺顏色的多種色彩空間版本
// =============================================================================
async function writeFixtures(dir, grid, adobeIccPath) {
  const raw = { raw: { width: GRID_W, height: GRID_H, channels: 3 } };
  const base = () => sharp(grid.buf, raw);
  const cases = [];
  const put = async (name, note, pipe, ext) => {
    const file = path.join(dir, `${name}.${ext}`);
    await pipe.toFile(file);
    const m = await sharp(file).metadata();
    cases.push({ name, note, file, icc: m.icc ? m.icc.length : 0, depth: m.depth, space: m.space });
  };
  // 基準：sRGB 8-bit 無 profile（demo 照片就是這一類）
  await put('srgb-8-noicc', 'sRGB 8-bit 無 profile（＝現行 demo 照片）', base().png({ compressionLevel: 6 }), 'png');
  // sRGB 8-bit 內嵌 sRGB profile
  await put('srgb-8-icc', 'sRGB 8-bit 內嵌 sRGB profile', base().withIccProfile('srgb'), 'png');
  // Adobe RGB 8-bit（PNG／JPEG 兩種容器）
  await put('adobergb-8', 'Adobe RGB 8-bit（內嵌自算 profile）', base().withIccProfile(adobeIccPath), 'png');
  await put('adobergb-8-jpg', 'Adobe RGB 8-bit JPEG q100 4:4:4（最常見的攝影匯出）',
    base().withIccProfile(adobeIccPath).jpeg({ quality: 100, chromaSubsampling: '4:4:4' }), 'jpg');
  // Display P3 8-bit（sharp 內建 profile）
  await put('p3-8', 'Display P3 8-bit（sharp 內建 p3 profile）', base().withIccProfile('p3'), 'png');
  // 16-bit：本次修的重點（libvips 自動轉換會落到 P3）
  await put('adobergb-16', 'Adobe RGB 16-bit PNG', base().toColourspace('rgb16').withIccProfile(adobeIccPath), 'png');
  await put('p3-16', 'Display P3 16-bit PNG', base().toColourspace('rgb16').withIccProfile('p3'), 'png');
  // 護欄：16-bit 但沒有 profile → 產線不得畫蛇添足轉換它
  await put('srgb-16-noicc', 'sRGB 16-bit 無 profile（護欄：不得二次轉換）', base().toColourspace('rgb16').png(), 'png');
  return cases;
}

// =============================================================================
// §5  跑產線 → 解碼 → ΔE
// =============================================================================
async function measure(pipeline, grid, fx, outDir) {
  const src = await pipeline.probeSource(fx.file);
  const rows = [];
  for (const tier of TIERS) {
    for (const fmt of ['avif', 'webp']) {
      const boost = tier >= 2560 ? pipeline.Q_BOOST_LARGE : 0;
      const out = path.join(outDir, `${fx.name}@${tier}.${fmt}`);
      await pipeline.encode(fx.file, out, tier, fmt, pipeline.Q[fmt] + boost, src);
      // 解碼＝模擬色彩管理瀏覽器：有 profile 就依 profile 轉 sRGB，沒有就當 sRGB
      const dec = await sharp(out).raw().toBuffer({ resolveWithObject: true });
      const om = await sharp(out).metadata();
      const w = dec.info.width, h = dec.info.height, ch = dec.info.channels;
      const px = ch === 3 ? dec.data : Buffer.from(dec.data.filter((_, i) => i % ch < 3));
      const per = grid.regions.map((r, i) => {
        const got = sampleRegion(px, w, h, r);
        const ref = sampleRegion(grid.buf, GRID_W, GRID_H, r);
        return { name: r.name, kind: r.kind, ref, got, dE: ciede2000(srgbToLab(...ref), srgbToLab(...got)), i };
      });
      const solid = per.filter((p) => p.kind === 'solid');
      const ramp = per.filter((p) => p.kind === 'ramp');
      const agg = (a) => ({ mean: a.reduce((s, p) => s + p.dE, 0) / a.length, max: Math.max(...a.map((p) => p.dE)) });
      rows.push({
        tier, fmt, w, h, per,
        solid: agg(solid), ramp: agg(ramp),
        worst: solid.slice().sort((a, b) => b.dE - a.dE)[0],
        bytes: fs.statSync(out).size,
        outIcc: om.icc ? om.icc.length : 0,
        outExif: om.exif ? om.exif.length : 0,
      });
    }
  }
  return { src, rows };
}

const f2 = (v) => v.toFixed(3).padStart(7);
const pass = (s) => s.mean < MEAN_LIMIT && s.max < MAX_LIMIT;

// ---------- 2560 tier 色度規格效益 ----------
/* 色度抽樣傷的是**細色度細節**（等亮度的色相交界），大面積平塗完全看不出來——所以這裡不
   用上面的色塊網格，另生一張「色度拷問圖」：兩個亮度幾乎相同、色相相反的顏色排成 1/2/3/
   4/6/8 px 細條紋（亮度通道近乎無資訊，全部訊息都在色度通道）。實務對應物＝逆光髮絲、
   霓虹燈管、紅字招牌、細花紋布料這類「色度高頻」題材。 */
function makeChromaTarget(w, h) {
  const buf = Buffer.alloc(w * h * 3);
  const A = [196, 120, 120], B = [120, 150, 196];   // 兩色 L* 接近，a*/b* 相反
  const pitches = [1, 2, 3, 4, 6, 8];
  for (let y = 0; y < h; y++) {
    const pitch = pitches[Math.min(pitches.length - 1, Math.floor(y / (h / pitches.length)))];
    for (let x = 0; x < w; x++) {
      const c = (Math.floor(x / pitch) % 2) ? A : B;
      const o = (y * w + x) * 3;
      buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2];
    }
  }
  return buf;
}

async function chromaBench(outDir, Q, boost) {
  const W = 2560, H = 1600;
  const srcFile = path.join(outDir, 'chroma-target.png');
  await sharp(makeChromaTarget(W, H), { raw: { width: W, height: H, channels: 3 } }).png().toFile(srcFile);
  const ref = await sharp(srcFile).raw().toBuffer();
  const variants = [
    ['AVIF 4:2:0（改動前）', 'avif', { quality: Q.avif + boost, effort: 4, chromaSubsampling: '4:2:0' }],
    ['AVIF 4:4:4（現行）', 'avif', { quality: Q.avif + boost, effort: 4, chromaSubsampling: '4:4:4' }],
    ['WebP smartSubsample off（改動前）', 'webp', { quality: Q.webp + boost, effort: 5, smartSubsample: false }],
    ['WebP smartSubsample on（現行）', 'webp', { quality: Q.webp + boost, effort: 5, smartSubsample: true }],
  ];
  const out = [];
  for (const [label, fmt, opt] of variants) {
    // 檔名不能有冒號（Windows）
    const tag = fmt === 'avif' ? opt.chromaSubsampling.replace(/:/g, '') : `smart-${opt.smartSubsample}`;
    const file = path.join(outDir, `chroma-${fmt}-${tag}.${fmt}`);
    const p = sharp(srcFile);
    await (fmt === 'avif' ? p.avif(opt) : p.webp(opt)).toFile(file);
    const dec = await sharp(file).raw().toBuffer({ resolveWithObject: true });
    const ch = dec.info.channels;
    const ds = [];
    for (let i = 0, j = 0; j + 2 < dec.data.length; i += 12, j += ch * 4) {   // 每 4 畫素取 1
      ds.push(ciede2000(srgbToLab(ref[i], ref[i + 1], ref[i + 2]), srgbToLab(dec.data[j], dec.data[j + 1], dec.data[j + 2])));
    }
    ds.sort((a, b) => a - b);
    out.push({
      label, bytes: fs.statSync(file).size,
      mean: ds.reduce((a, b) => a + b, 0) / ds.length,
      p99: ds[Math.floor(ds.length * 0.99)], max: ds[ds.length - 1],
    });
  }
  return out;
}

// =============================================================================
// §6  主流程
// =============================================================================
async function main() {
  console.log('=== 圖片產線色彩驗證儀（CIEDE2000 ΔE）===');
  console.log(`產線模組：${PIPELINE}`);
  console.log(`工作目錄：${WORKDIR}${KEEP ? '（--keep：跑完保留）' : ''}`);
  console.log(`門檻：色塊 mean ΔE < ${MEAN_LIMIT.toFixed(1)}、max ΔE < ${MAX_LIMIT.toFixed(1)}\n`);

  // --- 自證 1：CIEDE2000 公式對得上標準測試對 ---
  let ceMax = 0;
  for (const [a, b, want] of CIEDE_CASES) ceMax = Math.max(ceMax, Math.abs(ciede2000(a, b) - want));
  console.log(`【自證1】CIEDE2000 對 Sharma 標準測試對 ${CIEDE_CASES.length} 組，最大偏差 ${ceMax.toFixed(5)} → ${ceMax < 0.0001 ? 'OK' : '公式有誤！'}`);
  if (ceMax >= 0.0001) process.exit(1);

  const pipeline = require(PIPELINE);
  for (const fn of ['encode', 'probeSource', 'Q', 'Q_BOOST_LARGE']) {
    if (!pipeline[fn]) { console.error(`產線模組缺少 ${fn}（需要 module.exports）`); process.exit(1); }
  }

  rmDir(WORKDIR);
  const fxDir = path.join(WORKDIR, 'fixtures'), outDir = path.join(WORKDIR, 'out');
  fs.mkdirSync(fxDir, { recursive: true }); fs.mkdirSync(outDir, { recursive: true });

  // --- 自證 2：Adobe RGB profile 現算，colorant 對照官方值 ---
  const { icc, colorants } = buildIccProfile(ADOBE_RGB);
  const adobePath = path.join(fxDir, 'AdobeRGB-generated.icc');
  fs.writeFileSync(adobePath, icc);
  const cErr = Math.max(...colorants.flatMap((c, i) => c.map((v, j) => Math.abs(v - ADOBE_REF_COLORANTS[i][j]))));
  console.log(`【自證2】自算 Adobe RGB profile ${icc.length}B；D50 colorant 與官方 AdobeRGB1998.icc 最大差 ${cErr.toExponential(1)}`);
  ['r', 'g', 'b'].forEach((k, i) => console.log(`         ${k}XYZ = ${colorants[i].map((v) => v.toFixed(5)).join('  ')}   (官方 ${ADOBE_REF_COLORANTS[i].join(' ')})`));

  // --- 自證 3：sRGB → Adobe RGB → sRGB 往返 ΔE ---
  const grid = makeGrid();
  const rawOpt = { raw: { width: GRID_W, height: GRID_H, channels: 3 } };
  const trip = await sharp(await sharp(grid.buf, rawOpt).withIccProfile(adobePath).png().toBuffer()).raw().toBuffer();
  const tripD = grid.regions.map((r) => ciede2000(
    srgbToLab(...sampleRegion(grid.buf, GRID_W, GRID_H, r)),
    srgbToLab(...sampleRegion(trip, GRID_W, GRID_H, r))));
  console.log(`【自證3】sRGB → 自算 Adobe RGB → sRGB 往返：mean ΔE ${(tripD.reduce((a, b) => a + b, 0) / tripD.length).toFixed(4)}、max ΔE ${Math.max(...tripD).toFixed(4)}（＝「視覺同色」前提成立）`);

  if (fs.existsSync(SYS_ADOBE)) {
    const a = await sharp(grid.buf, rawOpt).withIccProfile(adobePath).png().toBuffer();
    const b = await sharp(grid.buf, rawOpt).withIccProfile(SYS_ADOBE).png().toBuffer();
    const ra = await sharp(a, { ignoreIcc: true }).raw().toBuffer();
    const rb = await sharp(b, { ignoreIcc: true }).raw().toBuffer();
    let md = 0; for (let i = 0; i < ra.length; i++) md = Math.max(md, Math.abs(ra[i] - rb[i]));
    console.log(`【自證3b】與本機官方 AdobeRGB1998.icc 交叉比對：Adobe RGB 編碼值最大差 ${md}/255（差異來自官方 profile 用 1024 點 TRC 表、本檔用純 gamma ${(563 / 256).toFixed(5)}）`);
  } else {
    console.log('【自證3b】本機找不到官方 AdobeRGB1998.icc，略過交叉比對（不影響結果）');
  }

  // --- 產 fixtures ---
  const fixtures = await writeFixtures(fxDir, grid, adobePath);
  console.log(`\n【fixtures】${GRID_W}×${GRID_H}，取樣區 ${grid.regions.length} 個（色塊 ${SOLIDS.length} ＋漸層帶 ${RAMPS.length}）`);
  for (const f of fixtures) console.log(`  ${f.name.padEnd(16)} ${String(f.depth).padEnd(7)} ${String(f.space).padEnd(6)} ICC ${String(f.icc).padStart(4)}B  ${f.note}`);

  // --- 逐 fixture 跑產線 ---
  const summary = [];
  for (const fx of fixtures) {
    const { src, rows } = await measure(pipeline, grid, fx, outDir);
    console.log(`\n──── ${fx.name} ──── ${fx.note}`);
    console.log(`  產線判讀：hasIcc=${src.hasIcc} depth=${src.depth} space=${src.space} → ${src.hasIcc ? '依內嵌 profile 轉 sRGB' : '視為 sRGB 原樣通過'}`);
    console.log('  tier  fmt   輸出尺寸      色塊 mean/max ΔE      漸層 mean/max ΔE    最差色塊              判定   輸出殘留');
    for (const r of rows) {
      const ok = pass(r.solid);
      summary.push({ fixture: fx.name, ...r, ok });
      console.log(`  ${String(r.tier).padStart(4)}  ${r.fmt.padEnd(4)}  ${String(r.w + '×' + r.h).padEnd(11)} ${f2(r.solid.mean)} /${f2(r.solid.max)}    ${f2(r.ramp.mean)} /${f2(r.ramp.max)}   ${r.worst.name.padEnd(9)} ΔE${r.worst.dE.toFixed(2).padStart(6)}  ${ok ? 'PASS' : '**FAIL**'}   ICC ${r.outIcc}B/EXIF ${r.outExif}B`);
    }
  }

  // --- 最差案例逐色塊表 ---
  const worstRow = summary.slice().sort((a, b) => b.solid.max - a.solid.max)[0];
  console.log(`\n【逐色塊明細】最差組合：${worstRow.fixture} @${worstRow.tier} ${worstRow.fmt}`);
  console.log('   #  色塊        基準 sRGB          實測 sRGB           ΔE');
  for (const p of worstRow.per) {
    const fmtRGB = (c) => c.map((v) => String(Math.round(v)).padStart(3)).join(',');
    console.log(`  ${String(p.i).padStart(2)}  ${p.name.padEnd(10)} ${fmtRGB(p.ref)}    ${fmtRGB(p.got)}    ${p.dE.toFixed(3).padStart(7)}${p.kind === 'ramp' ? '  (漸層)' : ''}`);
  }

  // --- 2560 tier 色度規格 ---
  if (TIERS.includes(2560)) {
    const bench = await chromaBench(outDir, pipeline.Q, pipeline.Q_BOOST_LARGE);
    console.log('\n【2560 tier 色度規格】色度拷問圖 2560×1600（1-8px 等亮度色相細條紋）逐像素 CIEDE2000');
    console.log('  規格                                 mean ΔE    p99 ΔE    max ΔE      檔案大小');
    for (const b of bench) {
      console.log(`  ${b.label.padEnd(33)}${b.mean.toFixed(3).padStart(8)}  ${b.p99.toFixed(3).padStart(8)}  ${b.max.toFixed(3).padStart(8)}   ${(b.bytes / 1024).toFixed(1).padStart(8)} KB`);
    }
  }

  // --- 總結 ---
  const fails = summary.filter((s) => !s.ok);
  console.log(`\n【總結】${summary.length} 組（${fixtures.length} fixtures × ${TIERS.length} tier × 2 格式）`);
  const byFx = {};
  for (const s of summary) {
    const b = byFx[s.fixture] || (byFx[s.fixture] = { mean: 0, max: 0, n: 0, fail: 0 });
    b.mean += s.solid.mean; b.max = Math.max(b.max, s.solid.max); b.n++; if (!s.ok) b.fail++;
  }
  for (const [k, v] of Object.entries(byFx)) {
    console.log(`  ${k.padEnd(16)} 色塊 mean ΔE ${(v.mean / v.n).toFixed(3).padStart(7)}  max ΔE ${v.max.toFixed(3).padStart(7)}  ${v.fail ? `**${v.fail}/${v.n} 組超標**` : `${v.n}/${v.n} 全過`}`);
  }
  const leak = summary.filter((s) => s.outIcc || s.outExif);
  console.log(`  metadata 剝除：${leak.length ? `**${leak.length} 個輸出仍帶 ICC/EXIF**` : '全部輸出零 ICC／零 EXIF'}`);
  console.log(fails.length ? `\n結果：FAIL — ${fails.length} 組超標，產線色彩有問題（不要放寬門檻，去修產線）` : '\n結果：PASS — 全部達標');

  if (!KEEP) rmDir(WORKDIR);
  else console.log(`\nfixtures 與輸出保留於 ${WORKDIR}`);
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
