/* =============================================================================
   ingest-photos.js — 圖片產線：原檔資料夾 → WebP 雙尺寸 → 更新 data.js
   用法： node ingest-photos.js  （或 npm run ingest）

   輸入： originals\<系列key>\  任意檔名的 jpg / jpeg / png
          系列key = hasselblad | portraits | street | 3d | film | market
   輸出： photos\{前綴}_{序號}.webp        長邊 1600、quality 82（展示主圖）
          photos\{前綴}_{序號}@800.webp    長邊 800、quality 80（低頻寬/小螢幕）
          前綴 hb / pt / st / td / fm / mk；序號自 0 起，按檔名字母序（ASCII）

   隱私：一律剝除 EXIF/XMP/ICC 等 metadata（GPS 不得上網）。sharp 預設不搬運
        metadata（沒呼叫 .withMetadata()），另先 .rotate() 套用 EXIF 方向再剝，
        避免直幅照片被轉正資訊一起丟掉而躺平。

   後續：本腳本會改寫 data.js 的 PHOTOS 對應條目（數量＋副檔名）與 HERO_SLIDES
        的副檔名，跑完請重跑 `node build-site.js` 重建 dist\。
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

// 系列key → { 檔名前綴, data.js 裡的 PHOTOS 鍵名 }
const CATS = [
  { key: 'hasselblad', prefix: 'hb', dataKey: 'hasselblad' },
  { key: 'portraits', prefix: 'pt', dataKey: 'portraits' },
  { key: 'street', prefix: 'st', dataKey: 'street' },
  { key: '3d', prefix: 'td', dataKey: 'three_d' },
  { key: 'film', prefix: 'fm', dataKey: 'film' },
  { key: 'market', prefix: 'mk', dataKey: 'market' },
];

const LONG_EDGE = 1600;
const LONG_EDGE_SMALL = 800;
const Q_MAIN = 82;
const Q_SMALL = 80;

const IN_EXT = /\.(jpe?g|png)$/i;
const kb = (b) => (b / 1024).toFixed(1) + ' KB';

// ---------- 轉檔 ----------
async function convert(inFile, outFile, longEdge, quality) {
  await sharp(inFile)
    .rotate()                                   // 先套用 EXIF 方向，之後 metadata 全丟
    .resize(longEdge, longEdge, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality, effort: 5 })
    .toFile(outFile);                           // 未呼叫 withMetadata() ＝ 不寫入任何 metadata
  return fs.statSync(outFile).size;
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
  src = src.replace(/'photos\/([a-z]{2})_(\d+)\.(?:jpe?g|png|webp)'/g, (m, p, i) => {
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
    // HERO_SLIDES / 各處 photos/xx_N
    for (const m of data.matchAll(new RegExp(`photos\\/${r.prefix}_(\\d+)\\.`, 'g'))) {
      if (+m[1] >= r.count) warns.push(`data.js 引用 ${r.prefix}_${m[1]} 但本系列只剩 ${r.count} 張`);
    }
    // build-site.js 的 WORK_TILES src: 'hb_10'
    for (const m of build.matchAll(new RegExp(`src: '${r.prefix}_(\\d+)'`, 'g'))) {
      if (+m[1] >= r.count) warns.push(`build-site.js WORK_TILES 引用 ${r.prefix}_${m[1]} 但本系列只剩 ${r.count} 張`);
    }
    // coverIdx
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

  const results = [];
  let totalIn = 0, totalOut = 0, nFiles = 0;

  for (const cat of CATS) {
    const dir = path.join(ORIGINALS, cat.key);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((f) => IN_EXT.test(f)).sort();
    if (!files.length) continue;

    // 先清掉本系列舊的 webp（重跑冪等；絕不碰其他系列，也不碰既有 jpg）
    for (const f of fs.readdirSync(PHOTOS)) {
      if (new RegExp(`^${cat.prefix}_\\d+(@800)?\\.webp$`).test(f)) fs.unlinkSync(path.join(PHOTOS, f));
    }

    console.log(`\n【${cat.key}】(${cat.prefix}) ${files.length} 張`);
    for (let i = 0; i < files.length; i++) {
      const inFile = path.join(dir, files[i]);
      const inSize = fs.statSync(inFile).size;
      const mainName = `${cat.prefix}_${i}.webp`;
      const smallName = `${cat.prefix}_${i}@800.webp`;
      const outMain = await convert(inFile, path.join(PHOTOS, mainName), LONG_EDGE, Q_MAIN);
      const outSmall = await convert(inFile, path.join(PHOTOS, smallName), LONG_EDGE_SMALL, Q_SMALL);
      const meta = await sharp(path.join(PHOTOS, mainName)).metadata();
      console.log(`  ${files[i]}  ${kb(inSize)}  →  ${mainName} ${meta.width}×${meta.height} ${kb(outMain)}  +  ${smallName} ${kb(outSmall)}`);
      totalIn += inSize; totalOut += outMain + outSmall; nFiles++;
    }

    // 同前綴的舊 jpg 提醒（data.js 已改指 webp，舊檔留著只會讓 dist 變胖）
    const legacy = fs.readdirSync(PHOTOS).filter((f) => new RegExp(`^${cat.prefix}_\\d+\\.jpe?g$`, 'i').test(f));
    if (legacy.length) console.log(`  ! photos\\ 仍有 ${legacy.length} 個舊的 ${cat.prefix}_*.jpg，確認無誤後可自行刪除`);

    results.push({ ...cat, count: files.length });
  }

  if (!results.length) {
    console.log('originals\\ 下沒有可處理的檔案（支援 jpg / jpeg / png）。');
    return;
  }

  const patched = patchDataJs(results);
  console.log(`\n轉檔 ${nFiles} 張／輸出 ${nFiles * 2} 檔：${kb(totalIn)} → ${kb(totalOut)}（${(totalOut / totalIn * 100).toFixed(1)}%）`);
  console.log(patched ? 'data.js 已更新：' : 'data.js 未變動：');
  for (const r of results) console.log(`  ${r.dataKey} = range('${r.prefix}', ${r.count}, 'webp')`);

  for (const w of checkIndexRefs(results)) console.log(`  ! ${w}`);
  console.log('\n下一步：執行 `node build-site.js` 重建 dist\\。');
}

main().catch((e) => { console.error(e); process.exit(1); });
