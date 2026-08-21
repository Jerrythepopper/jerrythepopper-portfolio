// verify-fonts.js —— 字型子集化（S45）可重複驗證器。每次 build 後可跑：node verify-fonts.js
// 驗什麼：
//   ① dist/index.html 的 Google Fonts <link> 逐條實抓（Chrome UA 才拿得到 woff2 版 CSS）：
//      Noto 連結必須回「2 個 @font-face」（400/500 各一，帶 unicode-range）——若回 248 個
//      ＝Google 靜默忽略了 text=（URL 太長或多家族同請求），等於退回全量切片，FAIL。
//   ② 全部 Noto 連結的 unicode-range 聯集必須涵蓋 dist HTML＋site.js 出現的每一個
//      非 ASCII 字元（ASCII 也查，但拉丁字同時有 Jost/Lustria 保底）——漏字＝退到系統襯線。
//   ③ 每條 Noto 連結 text= 解碼後 ≤ 750 字（build 的 FONT_TEXT_MAX；Google 實測門檻 800 字）、
//      URL ≤ 7300 bytes（FONT_URL_MAX）；全站 22 頁的字型連結逐字元相同（共用快取）。
//   ④ 下載全部字型檔加總，印出 KB（對照改前 /street/ 單頁 3,048KB）。
// 任一項不過 → exit 1。
const fs = require('fs'), path = require('path'), https = require('https');
const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const get = (url) => new Promise((res, rej) => {
  https.get(url, { headers: { 'User-Agent': UA } }, (r) => {
    const ch = []; r.on('data', (d) => ch.push(d)); r.on('end', () => res({ status: r.statusCode, body: Buffer.concat(ch) }));
  }).on('error', rej);
});
function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (['photos', 'video', 'vendor'].includes(e.name)) continue; walk(p, out); }
    else if (/\.(html|js)$/.test(e.name)) out.push(p);
  }
  return out;
}
function fontLinksOf(html) {
  return [...html.matchAll(/<link rel="stylesheet" href="(https:\/\/fonts\.googleapis\.com\/css2\?[^"]+)">/g)].map((m) => m[1]);
}
function parseRanges(css) {
  // 回傳 Set of code points（只展開 ≤ 4096 的區間，Google 的 text= 回應都是離散點或短區間）
  const set = new Set();
  for (const m of css.matchAll(/unicode-range:\s*([^;]+);/g)) {
    for (const tok of m[1].split(',')) {
      const t = tok.trim().replace(/^U\+/i, '');
      if (!t) continue;
      if (t.includes('-')) {
        const [a, b] = t.split('-').map((x) => parseInt(x, 16));
        if (b - a <= 4096) for (let k = a; k <= b; k++) set.add(k);
      } else if (t.includes('?')) {
        const lo = parseInt(t.replace(/\?/g, '0'), 16), hi = parseInt(t.replace(/\?/g, 'F'), 16);
        if (hi - lo <= 4096) for (let k = lo; k <= hi; k++) set.add(k);
      } else set.add(parseInt(t, 16));
    }
  }
  return set;
}
(async () => {
  let fail = 0;
  const pass = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fail++; };

  const files = walk(DIST);
  const htmls = files.filter((f) => f.endsWith('.html'));
  const links = fontLinksOf(fs.readFileSync(path.join(DIST, 'index.html'), 'utf8'));
  console.log(`index.html 字型連結 ${links.length} 條`);
  pass(links.length >= 2, `至少 2 條（拉丁 1＋Noto ≥1）`);

  // ③ 全站連結一致＋長度
  let same = true;
  for (const f of htmls) { const l = fontLinksOf(fs.readFileSync(f, 'utf8')); if (l.join('\n') !== links.join('\n')) { same = false; console.log('  差異頁：' + path.relative(DIST, f)); } }
  pass(same, `全部 ${htmls.length} 頁字型連結逐字元相同`);
  for (const u of links) {
    const isNoto = /Noto\+Serif\+JP/.test(u);
    const txt = u.includes('&text=') ? decodeURIComponent(u.slice(u.indexOf('&text=') + 6)) : '';
    const nChars = [...txt].length;
    pass(u.length <= 7300 && (!isNoto || nChars <= 750), `${isNoto ? 'Noto ' : 'Latin'} URL ${u.length} bytes ≤ 7300${isNoto ? `、text= ${nChars} 字 ≤ 750` : ''}`);
  }
  pass(!htmls.some((f) => fs.readFileSync(f, 'utf8').includes('@@FONT_LINKS@@')), '佔位符零殘留');

  // ① 逐條實抓
  const covered = new Set();
  let totalKB = 0, totalFiles = 0;
  for (const u of links) {
    const isNoto = /Noto\+Serif\+JP/.test(u);
    const r = await get(u);
    const css = r.body.toString();
    const faces = (css.match(/@font-face/g) || []).length;
    const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1]);
    let kb = 0;
    for (const fu of urls) { const f = await get(fu); kb += f.body.length / 1024; }
    totalKB += kb; totalFiles += urls.length;
    console.log(`  ${isNoto ? 'Noto ' : 'Latin'} status=${r.status} faces=${faces} files=${urls.length} ${Math.round(kb)}KB`);
    if (isNoto) {
      pass(r.status === 200 && faces === 2, `Noto 連結回 2 個 @font-face（text= 生效；實得 ${faces}）`);
      for (const k of parseRanges(css)) covered.add(k);
    } else {
      pass(r.status === 200 && faces >= 2 && faces <= 12, `拉丁連結回 ${faces} 個 @font-face（Jost 400/500＋Lustria 的切片）`);
    }
  }

  // ② 涵蓋率
  let all = '';
  for (const f of files) all += fs.readFileSync(f, 'utf8');
  const need = [...new Set(all)].map((c) => c.codePointAt(0)).filter((k) => k >= 32 && k !== 0x7F && k !== 0xFEFF);
  const missing = need.filter((k) => !covered.has(k));
  pass(missing.length === 0, `unicode-range 聯集涵蓋全站 ${need.length} 個字元（漏 ${missing.length}${missing.length ? '：' + missing.slice(0, 20).map((k) => String.fromCodePoint(k)).join('') : ''}）`);

  console.log(`字型總量：${totalFiles} 檔 ${Math.round(totalKB)}KB（改前 /street/ 單頁實測 68 檔 3,048KB＋339KB CSS）`);
  console.log(fail ? `\n${fail} 項 FAIL` : '\n全部 PASS');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERR', e); process.exit(1); });
