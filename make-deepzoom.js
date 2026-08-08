/* =============================================================================
   make-deepzoom.js — Deep Zoom 切片產線（哈蘇系列限定的「鑽細節」體驗）
   用法： node make-deepzoom.js            只在缺檔時產生（冪等，已存在就跳過）
          node make-deepzoom.js --force    強制重切

   輸入： originals\deepzoom\*.jpg|png     真正的高解析原檔（正式照片來了丟這裡）
          — 若該資料夾不存在／是空的，改用「合成測試大圖」：拿 hb_0 放大到
            8000×6000 再疊多尺度細節紋理（大標 / 千格 / 百格 / 8px 微字），
            用來驗證縮放層級確實一層層換圖，不是單張放大。

   輸出： photos\dz\<name>.dzi  ＋  photos\dz\<name>_files\<level>\<col>_<row>.jpg
          tile 512px / overlap 1；層級數 = ceil(log2(長邊)) + 1。

   引用： data.js 的 window.DEEPZOOM 手動登記（系列 → [{ idx, dzi, label }]），
          build-site.js 據此在該張 gallery 磚掛「DEEP ZOOM」角標與 data-dzi。
   ============================================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = __dirname;
const DZ_IN = path.join(ROOT, 'originals', 'deepzoom');
const DZ_OUT = path.join(ROOT, 'photos', 'dz');
const SYNTH_SRC = path.join(ROOT, 'originals', 'hasselblad', 'hb_000.jpg');
const SYNTH_NAME = 'hb0-deep';
const W = 8000, H = 6000;
const TILE = 512, OVERLAP = 1;

const force = process.argv.includes('--force');
const IN_EXT = /\.(jpe?g|png|tiff?)$/i;

// ---------- 合成測試大圖：多尺度細節，肉眼可判斷目前在第幾層 ----------
function overlaySvg() {
  const tiny = [];
  for (let r = 0; r < 6; r++) {
    tiny.push(`<text x="420" y="${3200 + r * 34}" font-family="monospace" font-size="22" fill="#fff" fill-opacity="0.85">` +
      `row ${r} · 22px microtext — readable only near 1:1 · 0123456789 ABCDEFGHIJKLMNOP</text>`);
  }
  for (let r = 0; r < 6; r++) {
    tiny.push(`<text x="420" y="${3460 + r * 14}" font-family="monospace" font-size="9" fill="#fff" fill-opacity="0.9">` +
      `row ${r} · 9px microtext · the finest tier — proves the deepest zoom level is being served · 0123456789</text>`);
  }
  const wedges = [];
  for (let i = 0; i < 22; i++) {
    const x = 5200 + i * 44;
    wedges.push(`<rect x="${x}" y="1600" width="${Math.max(1, 22 - i)}" height="700" fill="#fff" fill-opacity="0.8"/>`);
  }
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <pattern id="fine" width="100" height="100" patternUnits="userSpaceOnUse">
      <path d="M100 0 L0 0 0 100" fill="none" stroke="#ffffff" stroke-opacity="0.16" stroke-width="1"/>
    </pattern>
    <pattern id="coarse" width="1000" height="1000" patternUnits="userSpaceOnUse">
      <path d="M1000 0 L0 0 0 1000" fill="none" stroke="#ffffff" stroke-opacity="0.34" stroke-width="4"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#fine)"/>
  <rect width="${W}" height="${H}" fill="url(#coarse)"/>
  <text x="400" y="1100" font-family="Georgia, serif" font-size="360" fill="#ffffff" fill-opacity="0.92">DEEP ZOOM</text>
  <text x="404" y="1420" font-family="Georgia, serif" font-size="150" fill="#ffffff" fill-opacity="0.7">${W} × ${H} test plate</text>
  <text x="400" y="5700" font-family="monospace" font-size="96" fill="#ffffff" fill-opacity="0.75">Jerrythepopper · Hasselblad</text>
  <circle cx="6400" cy="4200" r="900" fill="none" stroke="#fff" stroke-opacity="0.5" stroke-width="10"/>
  <circle cx="6400" cy="4200" r="450" fill="none" stroke="#fff" stroke-opacity="0.5" stroke-width="5"/>
  <circle cx="6400" cy="4200" r="120" fill="none" stroke="#fff" stroke-opacity="0.6" stroke-width="2"/>
  ${wedges.join('')}
  ${tiny.join('')}
</svg>`);
}

async function makeSynthSource(outFile) {
  if (!fs.existsSync(SYNTH_SRC)) throw new Error('找不到合成用底圖 ' + SYNTH_SRC);
  const base = await sharp(SYNTH_SRC)
    .rotate()
    .resize(W, H, { fit: 'cover', kernel: 'lanczos3' })
    .modulate({ saturation: 0.92 })
    .toBuffer();
  await sharp(base)
    .composite([{ input: overlaySvg(), top: 0, left: 0 }])
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
    .toFile(outFile);
  return fs.statSync(outFile).size;
}

// ---------- 切片 ----------
async function tileOne(srcFile, name) {
  const outBase = path.join(DZ_OUT, name);
  if (!force && fs.existsSync(outBase + '.dzi')) {
    console.log(`  ${name}.dzi 已存在 → 跳過（--force 可重切）`);
    return null;
  }
  fs.rmSync(outBase + '_files', { recursive: true, force: true });
  fs.rmSync(outBase + '.dzi', { force: true });
  fs.rmSync(outBase, { recursive: true, force: true });   // 舊版誤產的無副檔名殘檔
  const m = await sharp(srcFile).metadata();
  // sharp 的 tile 輸出：檔名副檔名必須是 .dz，才會產出 <name>.dzi ＋ <name>_files\
  await sharp(srcFile, { limitInputPixels: 512 * 1024 * 1024 })
    .jpeg({ quality: 82 })
    .tile({ size: TILE, overlap: OVERLAP, layout: 'dz' })
    .toFile(outBase + '.dz');
  return { w: m.width, h: m.height };
}

function walkStats(dir) {
  let files = 0, bytes = 0, levels = 0;
  if (!fs.existsSync(dir)) return { files, bytes, levels };
  const lv = fs.readdirSync(dir);
  levels = lv.length;
  for (const l of lv) {
    const p = path.join(dir, l);
    if (!fs.statSync(p).isDirectory()) continue;
    for (const f of fs.readdirSync(p)) { files++; bytes += fs.statSync(path.join(p, f)).size; }
  }
  return { files, bytes, levels };
}

async function main() {
  fs.mkdirSync(DZ_OUT, { recursive: true });
  const jobs = [];

  if (fs.existsSync(DZ_IN)) {
    for (const f of fs.readdirSync(DZ_IN).filter((x) => IN_EXT.test(x)).sort()) {
      jobs.push({ src: path.join(DZ_IN, f), name: path.basename(f).replace(IN_EXT, '').replace(/[^a-z0-9_-]/gi, '-') });
    }
  }

  if (!jobs.length) {
    // demo 期：合成測試大圖
    const synth = path.join(DZ_OUT, '_source-' + SYNTH_NAME + '.jpg');
    if (force || !fs.existsSync(path.join(DZ_OUT, SYNTH_NAME + '.dzi'))) {
      console.log(`originals\\deepzoom\\ 沒有原檔 → 合成 ${W}×${H} 測試大圖…`);
      const sz = await makeSynthSource(synth);
      console.log(`  ${path.basename(synth)}  ${(sz / 1048576).toFixed(1)} MB`);
    }
    jobs.push({ src: synth, name: SYNTH_NAME, synth: true });
  }

  for (const j of jobs) {
    console.log(`切片 ${j.name} …`);
    const r = await tileOne(j.src, j.name);
    const st = walkStats(path.join(DZ_OUT, j.name + '_files'));
    const dzi = fs.existsSync(path.join(DZ_OUT, j.name + '.dzi'))
      ? fs.readFileSync(path.join(DZ_OUT, j.name + '.dzi'), 'utf8').replace(/\s+/g, ' ').trim() : '(無)';
    console.log(`  ${r ? r.w + '×' + r.h + '  ' : ''}層級 ${st.levels}／tile ${st.files} 檔／${(st.bytes / 1048576).toFixed(1)} MB`);
    console.log(`  ${dzi}`);
    // 合成用的中間大圖不進發布資產
    if (j.synth && fs.existsSync(j.src)) { fs.unlinkSync(j.src); }
  }
  console.log('\n下一步：data.js 的 window.DEEPZOOM 登記後，執行 `node build-site.js`。');
}

main().catch((e) => { console.error(e); process.exit(1); });
