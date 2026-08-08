/* =============================================================================
   ingest-photos.js — 高畫質圖片產線：原檔資料夾 → AVIF/WebP × 三尺寸 → manifest
   用法： node ingest-photos.js  （或 npm run ingest）

   輸入： originals\<系列key>\  任意檔名的 jpg / jpeg / png
          系列key = hasselblad | portraits | street | nature | 3d | film | market | rotation

   輸出（photos\）：
     {prefix}_{i}.avif / .webp          ← 主檔＝1600 tier（若原圖較小＝最大可用 tier）
     {prefix}_{i}@{size}.avif / .webp   ← 其餘 tier（800 / 2560）
     長邊 800 / 1600 / 2560 三檔；**絕不放大**（原圖長邊小於某 tier 就跳過該 tier，
     全部跳過時保底輸出一檔＝原生長邊）。
     品質：AVIF 60、WebP 82；2560 tier 各 +3 保細節。

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
const LQIP_W = 24;                     // blur-up 微型圖寬度

const IN_EXT = /\.(jpe?g|png)$/i;
const OUT_RE = /^(.+?)_(\d+)(@\d+)?\.(avif|webp)$/;
const kb = (b) => (b / 1024).toFixed(1) + ' KB';

// ---------- 單檔轉出 ----------
async function encode(inFile, outFile, longEdge, fmt, quality) {
  const p = sharp(inFile)
    .rotate()                                   // 先套用 EXIF 方向，之後 metadata 全丟
    .resize(longEdge, longEdge, { fit: 'inside', withoutEnlargement: true });
  if (fmt === 'avif') p.avif({ quality, effort: 4, chromaSubsampling: '4:2:0' });
  else p.webp({ quality, effort: 5 });
  const info = await p.toFile(outFile);         // 未呼叫 withMetadata() ＝ 不寫入任何 metadata
  return { bytes: info.size, w: info.width, h: info.height };
}

// 24px 寬微型 WebP → base64 data URI（HTML 屬性安全：base64 字元集不含引號）
async function makeLqip(inFile) {
  const buf = await sharp(inFile)
    .rotate()
    .resize(LQIP_W, LQIP_W, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 46, effort: 6, alphaQuality: 60 })
    .toBuffer();
  return 'data:image/webp;base64,' + buf.toString('base64');
}

// 原圖「轉正後」的尺寸（sharp metadata 回報的是轉正前，orientation 5-8 要對調）
async function orientedSize(inFile) {
  const m = await sharp(inFile).metadata();
  let w = m.width, h = m.height;
  if (m.orientation && m.orientation >= 5) { const t = w; w = h; h = t; }
  return { w, h };
}

// 依原圖長邊決定 tier 清單（不放大；全落空時保底原生一檔）
function tiersFor(srcLong) {
  const t = SIZES.filter((s) => s <= srcLong);
  return t.length ? t : [srcLong];
}

// ---------- 單張處理 ----------
async function processOne(inFile, prefix, i) {
  const { w: sw, h: sh } = await orientedSize(inFile);
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
      const r = await encode(inFile, path.join(PHOTOS, name), tier, fmt, Q[fmt] + boost);
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

  entry.lqip = await makeLqip(inFile);
  return { entry, bytes, nFiles, srcLong, tiers };
}

// ---------- data.js 改寫 ----------
function patchDataJs(results) {
  let src = fs.readFileSync(DATA_JS, 'utf8');
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

  // HERO_SLIDES：已轉檔系列的副檔名跟著換（檔案存在才換）
  src = src.replace(/'photos\/([a-z]{2,3})_(\d+)\.(?:jpe?g|png|webp)'/g, (m, p, i) => {
    const r = results.find((x) => x.prefix === p);
    if (!r) return m;
    return fs.existsSync(path.join(PHOTOS, `${p}_${i}.webp`))
      ? `'photos/${p}_${i}.webp'`
      : m;
  });

  if (src === before) return false;
  fs.writeFileSync(DATA_JS, src, 'utf8');
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
  let totalIn = 0, totalOut = 0, nPhotos = 0, nOutFiles = 0;
  const tierHist = {};

  for (const cat of CATS) {
    const dir = path.join(ORIGINALS, cat.key);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((f) => IN_EXT.test(f)).sort();
    if (!files.length) continue;

    // 先清掉本系列舊的輸出（重跑冪等；絕不碰其他系列）
    for (const f of fs.readdirSync(PHOTOS)) {
      const m = OUT_RE.exec(f);
      if (m && m[1] === cat.prefix) fs.unlinkSync(path.join(PHOTOS, f));
    }
    for (const k of Object.keys(manifest.photos)) {
      if (new RegExp(`^${cat.prefix}_\\d+$`).test(k)) delete manifest.photos[k];
    }

    console.log(`\n【${cat.key}】(${cat.prefix}) ${files.length} 張`);
    let catOut = 0, catFiles = 0;
    for (let i = 0; i < files.length; i++) {
      const inFile = path.join(dir, files[i]);
      const inSize = fs.statSync(inFile).size;
      const r = await processOne(inFile, cat.prefix, i);
      manifest.photos[`${cat.prefix}_${i}`] = r.entry;
      totalIn += inSize; totalOut += r.bytes; catOut += r.bytes;
      nPhotos++; nOutFiles += r.nFiles; catFiles += r.nFiles;
      const key = r.tiers.join('/');
      tierHist[key] = (tierHist[key] || 0) + 1;
      if (i === 0 || i === files.length - 1) {
        console.log(`  ${files[i]} ${kb(inSize)} → ${r.entry.main} ${r.entry.w}×${r.entry.h}｜tier ${key}｜${r.nFiles} 檔 ${kb(r.bytes)}｜LQIP ${r.entry.lqip.length}B`);
      }
    }
    console.log(`  小計：${files.length} 張 → ${catFiles} 檔 ${kb(catOut)}`);

    // 同前綴的舊 jpg/png 清除（產線輸出才是發布資產，留著只讓 dist 變胖）
    const legacy = fs.readdirSync(PHOTOS).filter((f) => new RegExp(`^${cat.prefix}_\\d+(@\\d+)?\\.(jpe?g|png)$`, 'i').test(f));
    for (const f of legacy) fs.unlinkSync(path.join(PHOTOS, f));
    if (legacy.length) console.log(`  已刪除 ${legacy.length} 個舊的 ${cat.prefix}_*.jpg/png`);

    results.push({ ...cat, count: files.length });
  }

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
  console.log('tier 分佈：' + Object.entries(tierHist).map(([k, v]) => `[${k}]×${v}`).join('  '));
  console.log(`photos-manifest.json：${Object.keys(manifest.photos).length} 條目 ${kb(fs.statSync(MANIFEST).size)}`);
  console.log(patched ? 'data.js 已更新：' : 'data.js 未變動：');
  for (const r of results) console.log(`  ${r.dataKey} = range('${r.prefix}', ${r.count}, 'webp')`);

  for (const w of checkIndexRefs(results)) console.log(`  ! ${w}`);
  console.log('\n下一步：執行 `node build-site.js` 重建 dist\\。');
}

main().catch((e) => { console.error(e); process.exit(1); });
