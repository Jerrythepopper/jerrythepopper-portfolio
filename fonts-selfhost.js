/* =============================================================================
   fonts-selfhost.js — 字型自託管（2026-11-04 站主翻案 D16「不自 host」）
   為什麼：Google Fonts 的 css2 連結是會擋算繪的外部 CSS（PSI 手機實測 4 支 × ~750ms），
     而且字型檔還要另外連 fonts.gstatic.com；全部搬回站內後，頁面零外部請求。
   做法（build-site.js 在 build 尾段呼叫，接在 fontLinks() 算完子集連結之後）：
     ① 逐條抓 fontLinks() 產生的 css2 連結（Chrome UA 才拿得到 woff2 版 CSS）；
     ② CSS 裡每個 url(https://fonts.gstatic.com/…) 下載下來，存成
        dist/fonts/<sha256 前 12 碼>.woff2（內容雜湊＝檔名，內容不變檔名就不變、可長快取）；
     ③ @font-face 的 src 改指站內絕對路徑 /fonts/…（404 頁會掛在任意深度的網址上，
        相對路徑會斷，所以刻意用絕對路徑；本站一律掛在網域根目錄）；
     ④ 回傳合併後的 @font-face CSS，由 build-site.js 內嵌進每頁 <head> 的 <style>。
   子集化規則（text= 分段、≤750 字、visible/rest 兩群）完全沿用 build-site.js 的 S45 邏輯，
   這裡只換「誰來供應檔案」——字形、字重、unicode-range、font-display:swap 全部照 Google 原樣。
   離線保險：抓到的 CSS 與 woff2 都另存 fonts-cache\（.gitignore），網路失敗就讀快取；
     兩者皆無才讓 build 失敗（不會靜默產出沒有字型的站）。
   授權：Noto Serif JP／Jost／Lustria 皆 SIL OFL 1.1，可自託管再散布；授權原文
     src-site\fonts-license\*.txt 隨 dist/fonts/ 一起發布。檔案是 Google 供應的原樣，
     本站不改字形（Lustria 有 Reserved Font Name，原樣散布不觸及改作條款）。
   ============================================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const CACHE = path.join(__dirname, 'fonts-cache');
const LICENSE_DIR = path.join(__dirname, 'src-site', 'fonts-license');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': UA } }, (r) => {
      if (r.statusCode !== 200) { r.resume(); return reject(new Error(`HTTP ${r.statusCode}：${url}`)); }
      const ch = []; r.on('data', (d) => ch.push(d)); r.on('end', () => resolve(Buffer.concat(ch)));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('逾時：' + url)));
  });
}

// 先抓網路、成功就更新快取；失敗退回快取；都沒有就丟錯
async function fetchCached(url, kind) {
  const f = path.join(CACHE, sha(url).slice(0, 24) + '.' + kind);
  try {
    const b = await get(url);
    fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(f, b);
    return { body: b, fromCache: false };
  } catch (e) {
    if (fs.existsSync(f)) return { body: fs.readFileSync(f), fromCache: true };
    throw new Error(`字型抓不到也沒有快取（${e.message}）——build 中止，免得產出沒有字型的站`);
  }
}

/* cssUrls：fontLinks() 產生的 css2 連結（拉丁 1 條在前、Noto 子集在後，順序即疊加順序）
   distDir：dist 根目錄。回傳 { css, files, bytes, cached }。 */
async function selfHostFonts(cssUrls, distDir) {
  const outDir = path.join(distDir, 'fonts');
  fs.mkdirSync(outDir, { recursive: true });
  const seen = new Map();   // gstatic url → 站內路徑（400/500 共用同一個 variable 檔時只下載一次）
  let bytes = 0, cached = 0;
  const parts = [];
  for (const u of cssUrls) {
    const r = await fetchCached(u, 'css');
    if (r.fromCache) cached++;
    let css = r.body.toString('utf8');
    if (!/@font-face/.test(css) || /format\('truetype'\)/.test(css)) {
      throw new Error('Google 回的不是 woff2 版 @font-face（UA 被判舊瀏覽器？）：' + u);
    }
    const urls = [...new Set([...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map((m) => m[1]))];
    for (const g of urls) {
      if (seen.has(g)) continue;
      const w = await fetchCached(g, 'woff2');
      if (w.fromCache) cached++;
      const name = sha(w.body).slice(0, 12) + '.woff2';
      const dest = path.join(outDir, name);
      if (!fs.existsSync(dest)) { fs.writeFileSync(dest, w.body); bytes += w.body.length; }
      seen.set(g, '/fonts/' + name);
    }
    css = css.replace(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g, (_, g) => `url(${seen.get(g)})`);
    // 去掉 /* latin */ 這類分區註解與縮排；規則本身一字不改
    css = css.replace(/\/\*[^*]*\*\/\s*/g, '').replace(/\n\s*/g, '').replace(/;\}/g, '}');
    parts.push(css);
  }
  for (const f of fs.readdirSync(LICENSE_DIR)) fs.copyFileSync(path.join(LICENSE_DIR, f), path.join(outDir, f));
  return { css: parts.join(''), files: seen.size, bytes, cached };
}

module.exports = { selfHostFonts };
