// verify-fonts.js —— 字型自託管（2026-11-04 起；S45 子集化規則沿用）可重複驗證器。每次 build 後跑：node verify-fonts.js
// 驗什麼（全部讀本機 dist，不連網）：
//   ① 每頁 <head> 內嵌 <style id="fonts">，全站逐字元相同；頁面零 fonts.googleapis/gstatic 殘留、佔位符零殘留。
//   ② 每個 @font-face 的 src 指向 /fonts/*.woff2 且檔案存在、檔頭是 wOF2；OFL 授權檔 3 份隨附。
//   ③ Noto Serif JP 每個子集檔恰有 400/500 兩個 face（text= 生效的特徵；若 Google 靜默忽略
//      text= 會回整套切片＝face 數暴增）；拉丁（Jost 400/500＋Lustria）face 數落在 2–12。
//   ④ Noto 的 unicode-range 聯集涵蓋 dist HTML＋site.js 出現的每個字元——漏字＝退到系統襯線。
//   ⑤ 印出 dist/fonts 總量。
// 原樣複製的外掛手冊／商品頁（static/3daddon）有自己的字型設定，不屬本產線，不驗。
// 任一項不過 → exit 1。
const fs = require('fs'), path = require('path');
const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (['photos', 'video', 'vendor', 'fonts'].includes(e.name)) continue; walk(p, out); }
    else if (/\.(html|js)$/.test(e.name)) out.push(p);
  }
  return out;
}
function parseRanges(css) {
  // 回傳 Set of code points（只展開 ≤ 4096 的區間，Google 的 text= 回應都是離散點或短區間）
  const set = new Set();
  for (const m of css.matchAll(/unicode-range:\s*([^;}]+)/g)) {
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
const STYLE_RE = /<style id="fonts">([\s\S]*?)<\/style>/;
const styleOf = (h) => { const m = h.match(STYLE_RE); return m ? m[1] : null; };

let fail = 0;
const pass = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fail++; };

const files = walk(DIST);
const htmls = files.filter((f) => f.endsWith('.html'));
const ours = htmls.filter((f) => styleOf(fs.readFileSync(f, 'utf8')) !== null);
const css = styleOf(fs.readFileSync(path.join(DIST, 'index.html'), 'utf8'));
pass(!!css, 'index.html 有內嵌 <style id="fonts">');

// ① 全站一致＋零外部字型
let same = true, ext = 0;
for (const f of ours) {
  const h = fs.readFileSync(f, 'utf8');
  if (styleOf(h) !== css) { same = false; console.log('  差異頁：' + path.relative(DIST, f)); }
  if (/fonts\.(googleapis|gstatic)\.com/.test(h)) { ext++; console.log('  外部字型殘留：' + path.relative(DIST, f)); }
}
pass(ours.length >= 24 && same, `本產線 ${ours.length} 頁的 @font-face 逐字元相同`);
pass(ext === 0, '本產線頁面零 Google Fonts 外部請求');
pass(!htmls.some((f) => fs.readFileSync(f, 'utf8').includes('@@FONT_LINKS@@')), '佔位符零殘留');

// ② src 檔案存在＋授權
const faces = css.split('@font-face').slice(1).map((b) => ({
  fam: (b.match(/font-family:\s*'([^']+)'/) || [])[1],
  w: (b.match(/font-weight:\s*(\d+)/) || [])[1],
  src: (b.match(/url\(([^)]+)\)/) || [])[1],
  body: b,
}));
let badSrc = 0;
for (const fc of faces) {
  const p = fc.src && fc.src.startsWith('/fonts/') ? path.join(DIST, fc.src) : null;
  if (!p || !fs.existsSync(p) || fs.readFileSync(p).subarray(0, 4).toString('latin1') !== 'wOF2') { badSrc++; console.log('  壞 src：' + fc.src); }
}
pass(faces.length > 0 && badSrc === 0, `${faces.length} 個 @font-face 的 src 全指向存在的 /fonts/*.woff2（wOF2 檔頭）`);
const lic = fs.readdirSync(path.join(DIST, 'fonts')).filter((f) => /-OFL\.txt$/.test(f));
pass(lic.length === 3, `OFL 授權檔隨附 ${lic.length} 份`);

// ③ face 結構
const noto = faces.filter((f) => f.fam === 'Noto Serif JP');
const bySrc = {};
for (const f of noto) (bySrc[f.src] = bySrc[f.src] || []).push(f.w);
const okNoto = Object.values(bySrc).every((ws) => ws.slice().sort().join() === '400,500');
pass(Object.keys(bySrc).length >= 1 && okNoto, `Noto 子集 ${Object.keys(bySrc).length} 檔，每檔恰 400/500 兩個 face（text= 生效）`);
const latin = faces.length - noto.length;
pass(latin >= 2 && latin <= 12, `拉丁 @font-face ${latin} 個（Jost 400/500＋Lustria 的切片）`);

// ④ 涵蓋率（字元來源＝本產線 HTML 去掉字型樣式本身＋其餘 js）
const covered = new Set();
for (const f of noto) for (const k of parseRanges(f.body)) covered.add(k);
let all = '';
for (const f of files) {
  if (f.endsWith('.html') && !ours.includes(f)) continue;
  if (f.includes(path.sep + '3daddon' + path.sep) && !ours.includes(f)) continue;
  all += fs.readFileSync(f, 'utf8').replace(STYLE_RE, '');
}
const need = [...new Set(all)].map((c) => c.codePointAt(0)).filter((k) => k >= 32 && k !== 0x7F && k !== 0xFEFF);
const missing = need.filter((k) => !covered.has(k));
pass(missing.length === 0, `Noto unicode-range 聯集涵蓋 ${need.length} 個字元（漏 ${missing.length}${missing.length ? '：' + missing.slice(0, 20).map((k) => String.fromCodePoint(k)).join('') : ''}）`);

// ⑤ 總量
const kb = fs.readdirSync(path.join(DIST, 'fonts')).filter((f) => f.endsWith('.woff2'))
  .reduce((s, f) => s + fs.statSync(path.join(DIST, 'fonts', f)).size, 0) / 1024;
console.log(`字型總量：dist/fonts ${Math.round(kb)}KB；內嵌 @font-face ${(css.length / 1024).toFixed(1)}KB/頁`);
console.log(fail ? `\n${fail} 項 FAIL` : '\n全部 PASS');
process.exit(fail ? 1 : 0);
