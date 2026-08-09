/* =============================================================================
   ingest-photos.js — 高畫質圖片產線：原檔資料夾 → AVIF/WebP × 三尺寸 → manifest
   用法： node ingest-photos.js  （或 npm run ingest）

   輸入： originals\<系列key>\  任意檔名的 jpg / jpeg / png
          系列key = hasselblad | portraits | street | nature | 3d | film | market | rotation

   排序決定鏈（每個系列各自判定，序號 _0 起就是照這個順序編）：
     ① originals\<系列>\order.json  ← 有就照它的 order 陣列（sort-studio.html 拖曳產生）
        · json 沒列到的檔案排在尾端（檔名序）＋ console 警告
        · 列了但資料夾裡沒有的檔案跳過 ＋ console 警告
        · 另可帶 cover 欄位＝封面檔名 → 換算成該檔在最終序的 index，寫進 data.js 的 coverIdx
     ② 無 order.json → 依 EXIF DateTimeOriginal 升冪（拍攝時間；讀不到的排尾端）
     ③ 兩者皆無 → 檔名字母序（歷來行為）
     order.json 本身不是圖片、不會被轉檔，也不會進 photos\。

   輸出（photos\）：
     {prefix}_{i}.avif / .webp          ← 主檔＝1600 tier（若原圖較小＝最大可用 tier）
     {prefix}_{i}@{size}.avif / .webp   ← 其餘 tier（800 / 2560）
     長邊 800 / 1600 / 2560 三檔；**絕不放大**（原圖長邊小於某 tier 就跳過該 tier，
     全部跳過時保底輸出一檔＝原生長邊）。
     品質：AVIF 60、WebP 82；2560 tier 各 +3 保細節，色度另加高（AVIF 4:4:4／
     WebP smartSubsample）——2560 是燈箱/大圖檔，色度不再抽樣。

   色彩管理：輸入若內嵌 ICC profile（Adobe RGB／Display P3／相機空間…），一律先依該
     profile 轉換到 sRGB 再輸出；輸出不附 profile（見下方隱私），瀏覽器以 sRGB 判讀＝
     色準一致。無 profile 的輸入視為 sRGB 原樣通過，不做二次轉換。
     驗證工具： node verify-color.js （CIEDE2000 ΔE 比色儀，門檻 mean<1.0 / max<2.0）

   另出： photos-manifest.json — 每張的可用尺寸/格式/寬高 ＋ 24px 微型 WebP 的
          base64 data URI（LQIP，供 build-site.js 做 blur-up 佔位）。
          build-site.js 讀它渲染 <picture>；查無條目的圖退回單 src 舊路徑。

   隱私：一律剝除 EXIF/XMP/ICC 等 metadata（GPS 不得上網）。sharp 預設不搬運
        metadata（沒呼叫 .withMetadata()），另先 .rotate() 套用 EXIF 方向再剝，
        避免直幅照片被轉正資訊一起丟掉而躺平。

   後續：本腳本會改寫 data.js 的 PHOTOS 對應條目（數量＋副檔名）與 HERO_SLIDES
        的副檔名，並刪除同前綴的舊 jpg/png（產線輸出才是發布資產）。
        跑完請重跑 `node build-site.js` 重建 dist\。
   ============================================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = __dirname;
const ORIGINALS = path.join(ROOT, 'originals');
const PHOTOS = path.join(ROOT, 'photos');
const DATA_JS = path.join(ROOT, 'data.js');
const BUILD_JS = path.join(ROOT, 'build-site.js');
const MANIFEST = path.join(ROOT, 'photos-manifest.json');

// 系列key → { 檔名前綴, data.js 裡的 PHOTOS 鍵名 }
const CATS = [
  { key: 'hasselblad', prefix: 'hb', dataKey: 'hasselblad' },
  { key: 'portraits', prefix: 'pt', dataKey: 'portraits' },
  { key: 'street', prefix: 'st', dataKey: 'street' },
  { key: 'nature', prefix: 'na', dataKey: 'nature' },
  { key: '3d', prefix: 'td', dataKey: 'three_d' },
  { key: 'film', prefix: 'fm', dataKey: 'film' },
  { key: 'market', prefix: 'mk', dataKey: 'market' },
  // rotation：備用素材，轉檔存放但版面目前不引用（data.js 有登記、模板沒用到）
  { key: 'rotation', prefix: 'rot', dataKey: 'rotation' },
];

const SIZES = [800, 1600, 2560];       // 長邊 tier
const MAIN_TIER = 1600;                // 主檔（無 @ 後綴）優先綁這一 tier
const Q = { avif: 60, webp: 82 };      // 基礎品質
const Q_BOOST_LARGE = 3;               // 2560 tier 加成（大檔要留細節）
const HI_CHROMA_TIER = 2560;           // 這一 tier 起改用最高色度規格（同上，見檔頭）
const LQIP_W = 24;                     // blur-up 微型圖寬度

const IN_EXT = /\.(jpe?g|png)$/i;       // 可轉檔的輸入（order.json 天然不在其中）
const OUT_RE = /^(.+?)_(\d+)(@\d+)?\.(avif|webp)$/;
const ORDER_FILE = 'order.json';        // 排序指示檔（sort-studio.html 產生）
const kb = (b) => (b / 1024).toFixed(1) + ' KB';

// ---------- 色彩管理 ----------
/* 依輸入的內嵌 ICC profile 轉換到 sRGB；`attach:false` ＝轉換但不寫回 profile（輸出仍
   是無 metadata 的裸檔，瀏覽器預設 sRGB 判讀）。

   為什麼要顯式做、而且必須以「有沒有內嵌 profile」為開關（皆為本機 sharp 0.35.3 實測，
   數字＝與正確 sRGB 值的 maxdiff/255，重現方式見 verify-color.js）：
     · 8-bit＋profile ：libvips 內部本來就會用內嵌 profile 轉 sRGB（實測 1＝量化誤差）；
                        這裡顯式再宣告一次不改變結果（實測仍是 1），但把色彩終點寫進我方
                        程式碼，不再依賴 libvips 的內部預設。
     · 16-bit＋profile：libvips 的自動轉換目標是 **P3** 而非 sRGB（原始碼 pipeline.cc：
                        interpretation 為 RGB16 時 processingProfile = "p3"），剝掉 profile
                        後被當 sRGB 判讀＝可見色偏（實測 117）。加上本行才回到 1。
     · 16-bit＋無profile：若無條件套用此轉換，會被當成 P3 來源硬轉一次＝憑空造出色偏
                        （實測 24）。所以無 profile 者一律原樣通過，不做二次轉換。 */
function toSrgb(pipe, hasIcc) {
  if (hasIcc) pipe.withIccProfile('srgb', { attach: false });
  return pipe;
}

// ---------- 單檔轉出 ----------
async function encode(inFile, outFile, longEdge, fmt, quality, src = {}) {
  const p = toSrgb(sharp(inFile).rotate(), src.hasIcc)   // 先套 EXIF 方向＋轉 sRGB，之後 metadata 全丟
    .resize(longEdge, longEdge, { fit: 'inside', withoutEnlargement: true });
  // 大圖 tier 用最高色度規格：AVIF 不抽樣；有損 WebP 恆為 YUV420，smartSubsample
  // ＝此格式下可取得的最高色度品質（色度細節實測見 verify-color.js 的「色度拷問圖」）
  const hiChroma = longEdge >= HI_CHROMA_TIER;
  if (fmt === 'avif') p.avif({ quality, effort: 4, chromaSubsampling: hiChroma ? '4:4:4' : '4:2:0' });
  else p.webp({ quality, effort: 5, smartSubsample: hiChroma });
  const info = await p.toFile(outFile);         // 未呼叫 withMetadata() ＝ 不寫入任何 metadata
  return { bytes: info.size, w: info.width, h: info.height };
}

// 24px 寬微型 WebP → base64 data URI（HTML 屬性安全：base64 字元集不含引號）
async function makeLqip(inFile, src = {}) {
  const buf = await toSrgb(sharp(inFile).rotate(), src.hasIcc)
    .resize(LQIP_W, LQIP_W, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 46, effort: 6, alphaQuality: 60 })
    .toBuffer();
  return 'data:image/webp;base64,' + buf.toString('base64');
}

// 原圖「轉正後」的尺寸（sharp metadata 回報的是轉正前，orientation 5-8 要對調）
// ＋是否內嵌 ICC profile（色彩管理開關，見 toSrgb）
async function probeSource(inFile) {
  const m = await sharp(inFile).metadata();
  let w = m.width, h = m.height;
  if (m.orientation && m.orientation >= 5) { const t = w; w = h; h = t; }
  return { w, h, hasIcc: !!m.icc, depth: m.depth, space: m.space };
}

// 依原圖長邊決定 tier 清單（不放大；全落空時保底原生一檔）
function tiersFor(srcLong) {
  const t = SIZES.filter((s) => s <= srcLong);
  return t.length ? t : [srcLong];
}

// ---------- EXIF 拍攝時間 ----------
/* sharp 的 metadata().exif 只給「未解析的原始 EXIF buffer」（libvips 不代解），所以這裡
   自己走一段最小 TIFF 解析：只為了取 DateTimeOriginal(0x9003)，取不到再退 DateTimeDigitized
   (0x9004) / DateTime(0x0132)。回傳可比大小的數字（毫秒），讀不到回 null。
   注意：這是「讀取端」的解析，輸出仍不帶任何 metadata（見檔頭隱私段）。 */
const EXIF_TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };

function parseExifDate(buf) {
  if (!buf || buf.length < 16) return null;
  let base = 0;
  if (buf.length >= 6 && buf.toString('latin1', 0, 6) === 'Exif\0\0') base = 6;   // JPEG APP1 前綴
  const bo = buf.toString('latin1', base, base + 2);
  if (bo !== 'II' && bo !== 'MM') return null;
  const le = bo === 'II';
  const u16 = (o) => (o + 2 <= buf.length ? (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o)) : 0);
  const u32 = (o) => (o + 4 <= buf.length ? (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o)) : 0);
  if (u16(base + 2) !== 42) return null;

  const tags = {};                       // tag → 值（ASCII 為字串、數值型為 number）
  const readIfd = (off, depth) => {
    if (depth > 2 || off + 2 > buf.length) return;
    const n = u16(off);
    if (n > 512) return;                 // 壞檔防呆
    for (let i = 0; i < n; i++) {
      const e = off + 2 + i * 12;
      if (e + 12 > buf.length) return;
      const tag = u16(e), type = u16(e + 2), count = u32(e + 4);
      const unit = EXIF_TYPE_SIZE[type];
      if (!unit) continue;
      const size = unit * count;
      const valOff = size <= 4 ? e + 8 : base + u32(e + 8);
      if (valOff < 0 || valOff + Math.min(size, 4) > buf.length) continue;
      if (tag === 0x8769) {                                        // Exif SubIFD（DateTimeOriginal 住這裡）
        const sub = u32(e + 8);
        if (sub) readIfd(base + sub, depth + 1);
        continue;
      }
      if (type === 2) {                                                                    // ASCII
        const end = Math.min(valOff + size, buf.length);
        tags[tag] = buf.toString('latin1', valOff, end).replace(/\0.*$/, '').trim();
      } else if (type === 3) tags[tag] = u16(valOff);
      else if (type === 4) tags[tag] = u32(valOff);
    }
  };
  readIfd(base + u32(base + 4), 0);

  const s = tags[0x9003] || tags[0x9004] || tags[0x0132];
  if (!s) return null;
  const m = /^(\d{4})[:\-](\d{2})[:\-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(s);
  if (!m) return null;
  let t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  const sub = tags[0x9291];                                   // SubSecTimeOriginal（同秒的排序穩定用）
  if (sub) t += Math.min(999, +('0.' + String(sub)) * 1000 || 0);
  return t;
}

async function exifDate(inFile) {
  try {
    const m = await sharp(inFile).metadata();
    return parseExifDate(m.exif);
  } catch (e) { return null; }
}

// ---------- 排序決定鏈（order.json → EXIF 時間 → 檔名） ----------
const ORDER_LABEL = { order: 'order.json（sort-studio 指定）', exif: 'EXIF 拍攝時間', name: '檔名字母序' };

async function resolveOrder(dir) {
  const imgs = fs.readdirSync(dir).filter((f) => IN_EXT.test(f));
  const warns = [];
  let files = imgs.slice().sort();        // ③ 保底＝歷來行為
  let source = 'name', cover = null;

  // ① order.json
  const jsonPath = path.join(dir, ORDER_FILE);
  if (fs.existsSync(jsonPath)) {
    let data = null;
    try { data = JSON.parse(fs.readFileSync(jsonPath, 'utf8')); }
    catch (e) { warns.push(`${ORDER_FILE} 解析失敗（${e.message}），改用其他排序依據`); }
    if (data && Array.isArray(data.order)) {
      const have = new Set(imgs), seen = new Set(), listed = [];
      for (const nm of data.order) {
        if (typeof nm !== 'string') continue;
        if (seen.has(nm)) { warns.push(`${ORDER_FILE} 重複列出「${nm}」，只採用第一次`); continue; }
        seen.add(nm);
        if (!have.has(nm)) { warns.push(`${ORDER_FILE} 列了「${nm}」但資料夾裡沒有這個檔，已跳過`); continue; }
        listed.push(nm);
      }
      const rest = imgs.filter((f) => !seen.has(f)).sort();
      if (rest.length) warns.push(`${rest.length} 個檔案沒被 ${ORDER_FILE} 列到，已排在尾端：${rest.join('、')}`);
      files = listed.concat(rest);
      source = 'order';
      if (typeof data.cover === 'string' && data.cover) {
        if (files.includes(data.cover)) cover = data.cover;
        else warns.push(`${ORDER_FILE} 的 cover「${data.cover}」不在檔案清單裡，已忽略`);
      }
    } else if (data) {
      warns.push(`${ORDER_FILE} 沒有 order 陣列，改用其他排序依據`);
    }
  }

  // ② EXIF 拍攝時間（只在沒有可用 order.json 時才問）
  if (source === 'name' && files.length) {
    const dated = [];
    for (const f of files) dated.push({ f, t: await exifDate(path.join(dir, f)) });
    const nDated = dated.filter((d) => d.t != null).length;
    if (nDated) {
      dated.sort((a, b) => {
        if (a.t == null && b.t == null) return a.f < b.f ? -1 : a.f > b.f ? 1 : 0;
        if (a.t == null) return 1;                       // 讀不到時間的排尾端
        if (b.t == null) return -1;
        return a.t - b.t || (a.f < b.f ? -1 : a.f > b.f ? 1 : 0);
      });
      files = dated.map((d) => d.f);
      source = 'exif';
      const noDate = dated.length - nDated;
      if (noDate) warns.push(`${noDate} 張讀不到 EXIF 拍攝時間，已排在尾端（檔名序）`);
    }
  }

  return { files, cover, source, warns };
}

// ---------- 單張處理 ----------
async function processOne(inFile, prefix, i) {
  const src = await probeSource(inFile);
  const { w: sw, h: sh } = src;
  const srcLong = Math.max(sw, sh);
  const tiers = tiersFor(srcLong);
  const mainTier = tiers.indexOf(MAIN_TIER) >= 0 ? MAIN_TIER : tiers[tiers.length - 1];

  const entry = { w: 0, h: 0, main: '', formats: { avif: [], webp: [] }, lqip: '', max: null };
  let bytes = 0, nFiles = 0;

  for (const tier of tiers) {
    const suffix = tier === mainTier ? '' : '@' + tier;
    const boost = tier >= 2560 ? Q_BOOST_LARGE : 0;
    for (const fmt of ['avif', 'webp']) {
      const name = `${prefix}_${i}${suffix}.${fmt}`;
      const r = await encode(inFile, path.join(PHOTOS, name), tier, fmt, Q[fmt] + boost, src);
      entry.formats[fmt].push({ f: name, w: r.w, h: r.h, tier });
      bytes += r.bytes; nFiles++;
      if (fmt === 'webp' && tier === mainTier) {
        entry.main = name; entry.w = r.w; entry.h = r.h;
      }
    }
  }

  // 最大可用 tier（燈箱吃這個）
  const maxTier = tiers[tiers.length - 1];
  const pick = (fmt) => entry.formats[fmt].find((x) => x.tier === maxTier);
  const mw = pick('webp');
  entry.max = { tier: maxTier, avif: pick('avif').f, webp: mw.f, w: mw.w, h: mw.h };

  entry.lqip = await makeLqip(inFile, src);
  return { entry, bytes, nFiles, srcLong, tiers, src };
}

// ---------- 專用資產（Work 磚圖／About 肖像） ----------
/* 這兩類不進系列的序號體系（沒有 _0.._n），因為版面是「指名道姓」引用某一張，不是跑陣列：
     originals\work\<原檔名>  → photos\work\<slug>.avif|webp    manifest key = work/<slug>
     originals\about\<任一張> → photos\about-portrait.avif|webp  manifest key = about-portrait
   build-site.js 的 WORK_TILES 直接寫 slug（src: 'work/giant'），不再借某系列的第 N 張。
   單一 1600 tier：磚圖版位最寬 ~570px、肖像 ~600px，2560 純屬浪費；其餘（色彩管理、
   剝 metadata、LQIP）與系列產線同一套函式，行為一致。 */
const ASSET_LONG_EDGE = 1600;

// 原檔名 → slug（Work 磚圖）。中文檔名沒有安全的自動轉法，一律明列；
// 未列到的檔案退回通用 slugify 並警告（站主日後自行加圖也不會整條爆掉）。
const WORK_SLUG = {
  'Giant.jpg': 'giant',
  'GiantLIV.jpg': 'giant-liv',
  'Goopi 2023.jpg': 'goopi-2023',
  'Goopi 2024.jpg': 'goopi-2024',
  'Hasselblad x Jerry.jpg': 'hasselblad-jerry',
  'Oppo.jpg': 'oppo',
  'RETO.png': 'reto',
  'Rolls Royce.JPG': 'rolls-royce',
  'Selected work vol.1.jpg': 'featured-1',
  'Selected work vol.2.jpg': 'featured-2',
  'Sony YT.png': 'sony-yt',
  'TEDx.jpg': 'tedx',
  '仁發建設.png': 'renfa',
  '新光.jpg': 'shinkong',
  '晶悅.jpg': 'jingyue',
};

const slugify = (name) =>
  name.replace(IN_EXT, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'asset';

/* 單張專用資產 → photos\<outRel>.avif|webp（outRel 可含子目錄，如 work/giant）
   回傳 manifest entry，形狀與系列照片完全相同，故 build-site.js 的
   pictureTag / bgImage / fullAttrs 不必分兩種路徑處理。 */
async function processAsset(inFile, outRel) {
  const src = await probeSource(inFile);
  const tier = Math.min(ASSET_LONG_EDGE, Math.max(src.w, src.h));   // 絕不放大
  const entry = { w: 0, h: 0, main: '', formats: { avif: [], webp: [] }, lqip: '', max: null };
  let bytes = 0, nFiles = 0;

  fs.mkdirSync(path.dirname(path.join(PHOTOS, outRel + '.webp')), { recursive: true });
  for (const fmt of ['avif', 'webp']) {
    const name = `${outRel}.${fmt}`;
    const r = await encode(inFile, path.join(PHOTOS, name), tier, fmt, Q[fmt], src);
    entry.formats[fmt].push({ f: name, w: r.w, h: r.h, tier });
    bytes += r.bytes; nFiles++;
    if (fmt === 'webp') { entry.main = name; entry.w = r.w; entry.h = r.h; }
  }
  const a = entry.formats.avif[0], w = entry.formats.webp[0];
  entry.max = { tier, avif: a.f, webp: w.f, w: w.w, h: w.h };
  entry.lqip = await makeLqip(inFile, src);
  return { entry, bytes, nFiles, src, tier };
}

// 全部專用資產跑一輪；回傳 [{ key, file }] 供主流程列印
async function processAssets(manifest) {
  const out = [];

  // Work 磚圖：photos\work\ 整個重建（冪等），manifest 的 work/ 鍵先全清
  const workDir = path.join(ORIGINALS, 'work');
  if (fs.existsSync(workDir)) {
    fs.rmSync(path.join(PHOTOS, 'work'), { recursive: true, force: true });
    for (const k of Object.keys(manifest.photos)) if (k.startsWith('work/')) delete manifest.photos[k];

    const files = fs.readdirSync(workDir).filter((f) => IN_EXT.test(f)).sort();
    console.log(`\n【work】(Work 磚圖) ${files.length} 張｜單一 ${ASSET_LONG_EDGE} tier`);
    let sum = 0, n = 0;
    for (const f of files) {
      let slug = WORK_SLUG[f];
      if (!slug) { slug = slugify(f); console.log(`  ! WORK_SLUG 沒列到「${f}」，暫用自動 slug「${slug}」`); }
      const key = 'work/' + slug;
      const r = await processAsset(path.join(workDir, f), key);
      manifest.photos[key] = r.entry;
      sum += r.bytes; n += r.nFiles;
      out.push({ key, file: f, w: r.entry.w, h: r.entry.h, icc: r.src.hasIcc });
    }
    console.log(`  小計：${files.length} 張 → ${n} 檔 ${kb(sum)}`);
  }

  // About 肖像：固定輸出名，版面直接指名 photos/about-portrait.webp
  const aboutDir = path.join(ORIGINALS, 'about');
  if (fs.existsSync(aboutDir)) {
    const files = fs.readdirSync(aboutDir).filter((f) => IN_EXT.test(f)).sort();
    if (files.length) {
      if (files.length > 1) console.log(`  ! originals\\about\\ 有 ${files.length} 張，只採用第一張「${files[0]}」`);
      const key = 'about-portrait';
      const r = await processAsset(path.join(aboutDir, files[0]), key);
      manifest.photos[key] = r.entry;
      console.log(`\n【about】(About 肖像) ${files[0]} → ${r.entry.main} ${r.entry.w}×${r.entry.h}｜${r.nFiles} 檔 ${kb(r.bytes)}`
        + `｜${r.src.hasIcc ? 'ICC→sRGB' : '無 ICC（視為 sRGB）'}`);
      out.push({ key, file: files[0], w: r.entry.w, h: r.entry.h, icc: r.src.hasIcc });
    }
  }
  return out;
}

// ---------- data.js 改寫 ----------
function patchDataJs(results, dataJsPath = DATA_JS) {   // 第二參數只給單元測試指到 stub 用
  let src = fs.readFileSync(dataJsPath, 'utf8');
  const before = src;

  // range() 支援第三參數 ext（預設 jpg ＝ 舊行為，既有條目零回歸）
  if (!/const range = \(prefix, n, ext/.test(src)) {
    src = src.replace(
      /const range = \(prefix, n\) =>[^\n]*\n/,
      "const range = (prefix, n, ext = 'jpg') => Array.from({ length: n }, (_, i) => `photos/${prefix}_${i}.${ext}`);\n"
    );
  }

  for (const r of results) {
    const re = new RegExp(`(${r.dataKey}:\\s*)range\\('${r.prefix}',\\s*\\d+(?:,\\s*'[a-z]+')?\\)`);
    if (!re.test(src)) {
      console.warn(`  ! data.js 找不到 ${r.dataKey} 的 range('${r.prefix}', …) 條目，請手動更新`);
      continue;
    }
    src = src.replace(re, `$1range('${r.prefix}', ${r.count}, 'webp')`);
  }

  // coverIdx：order.json 指定封面時，改寫 SECTIONS 裡對應系列的 coverIdx
  for (const r of results) {
    if (!(r.coverIdx >= 0)) continue;
    const re = new RegExp(`(id: '${r.key}'[\\s\\S]*?coverIdx: )\\d+`);
    if (!re.test(src)) {
      console.warn(`  ! data.js 找不到 id: '${r.key}' 的 coverIdx，封面未套用`);
      continue;
    }
    src = src.replace(re, `$1${r.coverIdx}`);
  }

  // HERO_SLIDES：已轉檔系列的副檔名跟著換（檔案存在才換）
  src = src.replace(/'photos\/([a-z]{2,3})_(\d+)\.(?:jpe?g|png|webp)'/g, (m, p, i) => {
    const r = results.find((x) => x.prefix === p);
    if (!r) return m;
    return fs.existsSync(path.join(PHOTOS, `${p}_${i}.webp`))
      ? `'photos/${p}_${i}.webp'`
      : m;
  });

  if (src === before) return false;
  fs.writeFileSync(dataJsPath, src, 'utf8');
  return true;
}

// ---------- 索引越界檢查（轉檔後張數變少時，寫死的 idx 會抓空） ----------
function checkIndexRefs(results) {
  const warns = [];
  const data = fs.readFileSync(DATA_JS, 'utf8');
  const build = fs.existsSync(BUILD_JS) ? fs.readFileSync(BUILD_JS, 'utf8') : '';

  for (const r of results) {
    for (const m of data.matchAll(new RegExp(`photos\\/${r.prefix}_(\\d+)\\.`, 'g'))) {
      if (+m[1] >= r.count) warns.push(`data.js 引用 ${r.prefix}_${m[1]} 但本系列只剩 ${r.count} 張`);
    }
    for (const m of build.matchAll(new RegExp(`src: '${r.prefix}_(\\d+)'`, 'g'))) {
      if (+m[1] >= r.count) warns.push(`build-site.js WORK_TILES 引用 ${r.prefix}_${m[1]} 但本系列只剩 ${r.count} 張`);
    }
    const sec = new RegExp(`id: '${r.key}'[\\s\\S]*?coverIdx: (\\d+)`).exec(data);
    if (sec && +sec[1] >= r.count) warns.push(`data.js ${r.key} 的 coverIdx=${sec[1]} 超出 ${r.count} 張`);
  }
  return warns;
}

// ---------- 主流程 ----------
async function main() {
  if (!fs.existsSync(ORIGINALS)) {
    console.error(`找不到 ${path.relative(ROOT, ORIGINALS)}\\，請先建立並依系列key 放入原檔。`);
    process.exit(1);
  }
  fs.mkdirSync(PHOTOS, { recursive: true });

  // 既有 manifest 先讀進來：只更新本次有原檔的系列，其他系列條目原樣保留
  let manifest = { generated: '', sizes: SIZES, quality: Q, photos: {} };
  if (fs.existsSync(MANIFEST)) {
    try { manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch (e) { /* 壞檔就重建 */ }
    if (!manifest.photos) manifest.photos = {};
  }

  const results = [];
  let totalIn = 0, totalOut = 0, nPhotos = 0, nOutFiles = 0, nIcc = 0;
  const tierHist = {};

  for (const cat of CATS) {
    const dir = path.join(ORIGINALS, cat.key);
    if (!fs.existsSync(dir)) continue;
    const ord = await resolveOrder(dir);              // ①order.json ②EXIF 時間 ③檔名
    const files = ord.files;
    if (!files.length) continue;

    // 先清掉本系列舊的輸出（重跑冪等；絕不碰其他系列）
    for (const f of fs.readdirSync(PHOTOS)) {
      const m = OUT_RE.exec(f);
      if (m && m[1] === cat.prefix) fs.unlinkSync(path.join(PHOTOS, f));
    }
    for (const k of Object.keys(manifest.photos)) {
      if (new RegExp(`^${cat.prefix}_\\d+$`).test(k)) delete manifest.photos[k];
    }

    console.log(`\n【${cat.key}】(${cat.prefix}) ${files.length} 張｜排序：${ORDER_LABEL[ord.source]}`);
    for (const w of ord.warns) console.log(`  ! ${w}`);
    let catOut = 0, catFiles = 0, catIcc = 0;
    for (let i = 0; i < files.length; i++) {
      const inFile = path.join(dir, files[i]);
      const inSize = fs.statSync(inFile).size;
      const r = await processOne(inFile, cat.prefix, i);
      manifest.photos[`${cat.prefix}_${i}`] = r.entry;
      totalIn += inSize; totalOut += r.bytes; catOut += r.bytes;
      nPhotos++; nOutFiles += r.nFiles; catFiles += r.nFiles;
      if (r.src.hasIcc) { catIcc++; nIcc++; }
      const key = r.tiers.join('/');
      tierHist[key] = (tierHist[key] || 0) + 1;
      if (i === 0 || i === files.length - 1) {
        console.log(`  ${files[i]} ${kb(inSize)} → ${r.entry.main} ${r.entry.w}×${r.entry.h}｜tier ${key}｜${r.nFiles} 檔 ${kb(r.bytes)}｜LQIP ${r.entry.lqip.length}B`
          + `｜${r.src.hasIcc ? 'ICC→sRGB' : '無 ICC（視為 sRGB）'} ${r.src.depth}`);
      }
    }
    console.log(`  小計：${files.length} 張 → ${catFiles} 檔 ${kb(catOut)}｜內嵌 ICC ${catIcc}/${files.length} 張已轉 sRGB`);

    // 同前綴的舊 jpg/png 清除（產線輸出才是發布資產，留著只讓 dist 變胖）
    const legacy = fs.readdirSync(PHOTOS).filter((f) => new RegExp(`^${cat.prefix}_\\d+(@\\d+)?\\.(jpe?g|png)$`, 'i').test(f));
    for (const f of legacy) fs.unlinkSync(path.join(PHOTOS, f));
    if (legacy.length) console.log(`  已刪除 ${legacy.length} 個舊的 ${cat.prefix}_*.jpg/png`);

    // 封面：order.json 的 cover 檔名 → 換算成它在最終序的 index（給 data.js 的 coverIdx）
    const coverIdx = ord.cover ? files.indexOf(ord.cover) : -1;
    if (coverIdx >= 0) console.log(`  封面：${ord.cover} → coverIdx ${coverIdx}`);

    results.push({ ...cat, count: files.length, coverIdx, orderSource: ord.source });
  }

  // 專用資產（Work 磚圖／About 肖像）：與系列並行存在，manifest 共用一張表
  const assets = await processAssets(manifest);

  if (!results.length) {
    console.log('originals\\ 下沒有可處理的檔案（支援 jpg / jpeg / png）。');
    return;
  }

  manifest.generated = new Date().toISOString();
  manifest.sizes = SIZES;
  manifest.quality = { ...Q, boost2560: Q_BOOST_LARGE, lqipWidth: LQIP_W };
  const ordered = {};
  for (const k of Object.keys(manifest.photos).sort()) ordered[k] = manifest.photos[k];
  manifest.photos = ordered;
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1), 'utf8');

  const patched = patchDataJs(results);
  console.log(`\n轉檔 ${nPhotos} 張／輸出 ${nOutFiles} 檔：${kb(totalIn)} → ${kb(totalOut)}（${(totalOut / totalIn * 100).toFixed(1)}%）`);
  console.log(`色彩：${nIcc} 張帶內嵌 ICC profile → 已轉 sRGB；${nPhotos - nIcc} 張無 profile → 視為 sRGB 原樣通過（驗證：node verify-color.js）`);
  console.log('tier 分佈：' + Object.entries(tierHist).map(([k, v]) => `[${k}]×${v}`).join('  '));
  console.log(`photos-manifest.json：${Object.keys(manifest.photos).length} 條目 ${kb(fs.statSync(MANIFEST).size)}`);
  console.log(patched ? 'data.js 已更新：' : 'data.js 未變動：');
  for (const r of results) {
    console.log(`  ${r.dataKey} = range('${r.prefix}', ${r.count}, 'webp')`
      + `｜排序 ${ORDER_LABEL[r.orderSource]}` + (r.coverIdx >= 0 ? `｜coverIdx ${r.coverIdx}` : ''));
  }

  if (assets.length) {
    console.log(`專用資產 ${assets.length} 件（版面直接指名，不進系列陣列）：`);
    for (const a of assets) console.log(`  ${a.key} ← ${a.file}  ${a.w}×${a.h}${a.icc ? '  ICC→sRGB' : ''}`);
  }

  for (const w of checkIndexRefs(results)) console.log(`  ! ${w}`);
  console.log('\n下一步：執行 `node build-site.js` 重建 dist\\。');
}

// 直接執行才跑產線；被 require（verify-color.js 比色儀）時只取用函式，不動任何檔案
if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = {
  encode, makeLqip, probeSource, toSrgb, SIZES, Q, Q_BOOST_LARGE, HI_CHROMA_TIER,
  resolveOrder, parseExifDate, exifDate, patchDataJs, ORDER_FILE, ORDER_LABEL,
};
