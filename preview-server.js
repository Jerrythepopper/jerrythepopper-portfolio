// 本機預覽伺服器：node preview-server.js → http://localhost:8139
// 服務 dist\（正式產物），支援 /hasselblad/ 資料夾路徑與 404 頁。
// S24 兩項：① HTTP Range（iOS 影片播放的先決條件）② POST /debug-log 真機信標收集。
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, 'dist');
// 埠可用環境變數覆蓋：站主的 8139 常駐時，測試要另起一台就 `PORT=8146 node preview-server.js`
const PORT = Number(process.env.PORT) || 8139;
// 真機除錯信標的落地位置（site.js 的 beacon() 只在非正式網域時才發）
const DEBUG_LOG = path.join(__dirname, '_review-uiux-2026-08-09', 'phone-debug.log');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.avif': 'image/avif', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.dzi': 'application/xml',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.ico': 'image/x-icon',
};

/* ---- POST /debug-log：真機（iPhone）把 hero 影片的失敗現場寄回來 -------------
   站主的手機沒有 console，這是唯一拿得到 play() rejection / MediaError 的路。
   一行一筆 JSON，方便 tail 著看。 */
function debugLog(req, res) {
  let buf = '';
  req.on('data', (c) => { buf += c; if (buf.length > 65536) req.destroy(); });
  req.on('end', () => {
    try {
      fs.mkdirSync(path.dirname(DEBUG_LOG), { recursive: true });
      fs.appendFileSync(DEBUG_LOG, new Date().toISOString() + ' ' + buf.replace(/\s+/g, ' ') + '\n', 'utf8');
      console.log('· debug-log ← ' + buf.slice(0, 200));
    } catch (e) { console.warn('! debug-log 寫入失敗：' + e.message); }
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*' });
    res.end();
  });
}

/* ---- Range 支援 -------------------------------------------------------------
   為什麼非做不可：iOS Safari／AVFoundation 拿到「不回 Accept-Ranges、不會回 206」
   的伺服器時，直接拒播影片（桌機瀏覽器寬容，所以在 Mac/PC 上測永遠測不出來）。
   正式站在 GitHub Pages，原生就支援 Range ＝ 產線沒有這個問題，這是本機預覽
   伺服器與正式環境的能力落差，補起來才能在區網用手機做有效測試。
   規格：所有回應都掛 Accept-Ranges: bytes；帶 Range 就回 206 + Content-Range，
   範圍不合法回 416，沒帶 Range 維持 200 全檔。 */
function serveFile(req, res, file, size) {
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const range = req.headers.range;
  const m = range && /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (m && (m[1] !== '' || m[2] !== '')) {
    let start, end;
    if (m[1] === '') {                       // "bytes=-500" ＝ 最後 500 bytes
      const n = parseInt(m[2], 10);
      start = Math.max(0, size - n); end = size - 1;
    } else {
      start = parseInt(m[1], 10);
      end = m[2] === '' ? size - 1 : parseInt(m[2], 10);
    }
    if (!isFinite(start) || !isFinite(end) || start > end || start >= size) {
      res.writeHead(416, { 'Content-Range': `bytes */${size}`, 'Accept-Ranges': 'bytes' });
      res.end(); return;
    }
    if (end >= size) end = size - 1;
    res.writeHead(206, {
      'Content-Type': type,
      'Content-Length': end - start + 1,
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Accept-Ranges': 'bytes',
    });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes' });
  if (req.method === 'HEAD') { res.end(); return; }
  fs.createReadStream(file).pipe(res);
}

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (req.method === 'POST' && p === '/debug-log') { debugLog(req, res); return; }
  let file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  let st = fs.existsSync(file) ? fs.statSync(file) : null;
  if (st && st.isDirectory()) { file = path.join(file, 'index.html'); st = fs.existsSync(file) ? fs.statSync(file) : null; }
  if (!st) {
    const nf = path.join(ROOT, '404.html');
    if (fs.existsSync(nf)) {
      res.writeHead(404, { 'Content-Type': MIME['.html'], 'Accept-Ranges': 'bytes' });
      res.end(fs.readFileSync(nf)); return;
    }
    res.writeHead(404); res.end('not found'); return;
  }
  serveFile(req, res, file, st.size);
}).listen(PORT, () => console.log(`portfolio preview → http://localhost:${PORT}`));
