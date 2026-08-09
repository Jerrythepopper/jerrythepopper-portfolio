/* =============================================================================
   build-site.js — 攝影作品集靜態站產生器（Node 零依賴）
   讀 data.js（唯一內容來源）＋本檔內部 HTML 模板 → 生成 dist\
   用法： node build-site.js
   ============================================================================= */
'use strict';

const fs = require('fs');
const path = require('path');

// sharp 為選用依賴（og:image 方形封面產線用）——找不到就整段優雅降級，build 不失敗
// （S28 2026-08-09：OG 分享圖方形化）
let sharp = null;
try { sharp = require('sharp'); }
catch (e) { console.warn('! 找不到 sharp 套件 —— og:image 方形圖不會產生，各頁退回現行封面圖（非方形）'); }

// 正式網域（canonical / sitemap / robots / llms.txt 都吃它）；apex 由 DNS 301 導 www
const SITE_ORIGIN = 'https://www.jerrythepopper.com';

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const SRC = path.join(ROOT, 'src-site');

// ---------- data.js（用假 window 取出三個常數） ----------
const win = {};
new Function('window', fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8'))(win);
const PHOTOS = win.PHOTOS;
const HERO_SLIDES = win.HERO_SLIDES;
const HERO_VIDEOS = win.HERO_VIDEOS || [];
const SECTIONS = win.SECTIONS;
const DEEPZOOM = win.DEEPZOOM || {};

/* ---------- data-en.js（英文版文案，S29 2026-08-09） -------------------------
   雙語架構的三條紀律：
     ① 中文版輸出逐位元組零回歸 —— 所有 lang 分支都寫成「LANG==='zh' 時走原路」，
        唯二允許動到中文頁的是 hreflang 三行與語言切換鈕（本次刻意的增量）。
     ② 內容集中：英文的每一句都住 data-en.js（源自 _content-en-draft.md），
        本檔只負責排版，不內嵌英文散句。
     ③ 路徑分兩種：linkRel＝同語言頁面互連（/en/ 樹內就在 /en/ 裡繞），
        assetRel＝到站根資產（styles.css / photos / video / vendor / favicon）。
        英文頁多一層 /en/，所以 assetRel = linkRel + '../'。
--------------------------------------------------------------------------- */
const winEn = {};
new Function('window', fs.readFileSync(path.join(ROOT, 'data-en.js'), 'utf8'))(winEn);
const EN = winEn.EN;
const EN_SWITCH_ZH = winEn.EN_SWITCH_ZH;

// 目前正在生成哪一語版本。build() 先跑完整套中文、再翻牌成 'en' 跑第二套。
let LANG = 'zh';
const isEn = () => LANG === 'en';
const assetRel = (linkRel) => (isEn() ? linkRel + '../' : linkRel);
// 語言切換鈕的目的地＝「同一頁的另一語版本」。slugPath 是站根之後那一段（首頁給 ''）
const langHref = (aRel, slugPath) => (isEn() ? aRel + slugPath : aRel + 'en/' + slugPath);

// ---------- photos-manifest.json（ingest-photos.js 產出的高畫質總表） ----------
// 有條目 → 走 <picture>（AVIF/WebP × 多尺寸 ＋ LQIP blur-up）
// 無條目 → 退回單 src 舊路徑（結構上保留零回歸分支，手放進 photos\ 的圖照樣能用）
const MANIFEST = (() => {
  const p = path.join(ROOT, 'photos-manifest.json');
  if (!fs.existsSync(p)) { console.warn('! 找不到 photos-manifest.json，全站退回單 src 舊路徑'); return {}; }
  try { return (JSON.parse(fs.readFileSync(p, 'utf8')).photos) || {}; }
  catch (e) { console.warn('! photos-manifest.json 解析失敗：' + e.message); return {}; }
})();

// ---------- photo-alts.json（逐張中文替代文字，S23 看圖隊產出） ----------
// 鍵＝photos\ 底下去掉副檔名的檔名（hb_0 / td_61…），值＝一句 6–40 字的畫面描述。
// 查無條目就退回舊的「系列名 + 編號」（Street 3），所以新照片沒補句子也不會空 alt。
const ALTS = (() => {
  const p = path.join(ROOT, 'photo-alts.json');
  if (!fs.existsSync(p)) { console.warn('! 找不到 photo-alts.json，alt 全數退回「系列名+編號」'); return {}; }
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { console.warn('! photo-alts.json 解析失敗：' + e.message); return {}; }
})();

// ---------- helpers ----------
const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* 系列的中文副標可以是空字串（S24 2026-08-09：3D 拿掉「立體」）。
   空值時要「優雅省略」——不留空的 <span class="jp">（它有 margin-left/字距，
   會在標題右邊多出一段空白），純文字場合也不能留下 "3D " 的尾空格（title、
   JSON-LD name、footer 清單、llms.txt 都吃這一份）。 */
const zhSpan = (s) => (s.zh ? `<span class="jp">${esc(s.zh)}</span>` : '');
const enZh = (s) => (s.zh ? `${s.en} ${s.zh}` : s.en);

/* 英文頁的三個「拿掉中文」開關（S29）。標題旁的中文副標（哈蘇／人像…）在英文頁隱藏，
   純文字場合（title / JSON-LD / footer / llms.txt）同步只留英文。 */
const zhTag = (s) => (isEn() ? '' : zhSpan(s));
const secName = (s) => (isEn() ? s.en : enZh(s));

/* ---------- 中文分詞斷行 segmentZh（S25 2026-08-09） -------------------------
   問題：中文沒有詞間空白，瀏覽器預設「每個漢字都是可斷點」，於是「朱銘美術/館」
   「捷安/特」「紀實計/畫」這種腰斬到處都是；配上兩端對齊之後更明顯。

   作法：建置期就把詞切好，每個詞包一層 <span class="nb">（patch.css 給 nowrap），
   斷行只能發生在詞與詞之間。全部在 build 期算完 ＝ 執行期零成本、零依賴。

   分詞來源三層，由強到弱：
     ① NB_LOCK 專有名詞表 —— ICU 的通用詞庫不認得品牌／專案名（實測「朱銘美術館」
        被切成 朱/銘/美術館、「捷安特」切成 捷/安/特），這些只能明列。長詞優先比對。
     ② Intl.Segmenter('zh-Hant', {granularity:'word'}) —— Node 內建（完整 ICU），
        一般詞彙交給它。
     ③ 單字黏合啟發式 —— ICU 常把雙字詞拆成兩個單字（募/資、攝影/集）。落單的漢字
        （排除「的了與和在是」這類本來就該獨立的虛字）往後黏一個單元，黏不到就往前，
        最長 6 字封頂免得整句變成一條不可斷的長龍。

   標點：收尾類（，。、）」等）黏前一個詞 —— 標點不可出現在行首（禁則）；
         起首類（（《「等）黏後一個詞 —— 也不可出現在行尾。
   拉丁：連續的英數（含詞間單一空白）當一個單元；超過 24 字的長串不包 nb，
         留給 overflow-wrap 兜底，避免窄螢幕橫向溢出。
   換行：\n 原樣保留（subtitle 吃 white-space:pre-line，段落結構靠它）。
--------------------------------------------------------------------------- */
const SEGMENTER = (typeof Intl !== 'undefined' && Intl.Segmenter)
  ? new Intl.Segmenter('zh-Hant', { granularity: 'word' })
  : null;

// 專有名詞／固定搭配（長的排前面，比對時長詞優先）。新增品牌或專案名記得補這裡。
const NB_LOCK = [
  '台北第一果菜批發市場', '第一果菜批發市場', '臺北農產運銷公司', '果菜批發市場',
  '朱銘美術館', '新光攝影展', '孤僻Goopi', '名發建設', '三發建設', '晶悅建設',
  '果菜市場', '紀實計畫', '創意企劃', '形象拍攝', '教學內容', '影像敘事', '品牌合作',
  '空間裝置', '課程製作', '攝影教學', '虛實結合', '視覺概念', '場景設計',
  '募資出版', '攝影集', '捷安特', '蝦皮', '洪立楷', '輪轉',
  '靜態影像', '動態範圍', '拍攝主題', '觀看方式', '人文風景', '底片攝影',
  '自身的模樣', '我的樣貌', '時間流動', '孤寂感', '虛擬世界', '各座城市', '拖車',
  '3D創作者', '3D視覺', '3D創作', '3D領域',
].sort((a, b) => b.length - a.length);

const RE_LATIN = /[A-Za-z0-9]/;
const RE_CJK = /[㐀-鿿豈-﫿]/;
// 本來就該獨立成單元的虛字：黏合啟發式跳過它們，否則「的」會被拖進前一個詞裡
const NB_SOLO = new Set('的了與和在是也我你他她它們都就而或及以被把從到對為不沒很更再又最等之於並則但很個中上下前後'.split(''));
const PUNCT_CLOSE = '，。、；：！？）〕】》」』〉·…—～%,.;:!?)]}’”';
const PUNCT_OPEN = '（〔【《「『〈([{‘“';

function segmentZh(text) {
  if (text == null) return '';
  return String(text).split('\n').map(segLine).join('\n');
}

/* 分詞只對中文有意義：英文本來就有詞間空白，包 nb 反而讓 justify 拉出大洞
   （英文頁另有 :root[lang] 規則把 justify 關掉，改吃自然的 ragged-right）。
   所以英文版走純 esc()，一個 <span class="nb"> 都不出。 */
const seg = (text) => (isEn() ? esc(text == null ? '' : text) : segmentZh(text));

function segLine(line) {
  if (!line) return '';
  // ① 專有名詞先鎖起來，剩下的碎片才交給 Segmenter
  let units = [];
  let rest = line;
  (function lock(s) {
    if (!s) return;
    for (const term of NB_LOCK) {
      const at = s.indexOf(term);
      if (at >= 0) {
        lock(s.slice(0, at));
        units.push(term);
        lock(s.slice(at + term.length));
        return;
      }
    }
    units = units.concat(segWords(s));
  })(rest);

  units = mergeLatin(units);
  units = glueSingles(units);
  units = attachPunct(units);
  return units.map(emit).join('');
}

// ② Intl.Segmenter（沒有就整串當一個單元，退化成舊行為，build 不會炸）
function segWords(s) {
  if (!s) return [];
  if (!SEGMENTER) return [s];
  return [...SEGMENTER.segment(s)].map((x) => x.segment);
}

// ③-a 拉丁／數字連成一個單元（詞間單一空白也吃進來：Leica Camera Taiwan ＝ 一體）
function mergeLatin(u) {
  const out = [];
  for (const t of u) {
    const prev = out[out.length - 1];
    const isLat = (x) => x && RE_LATIN.test(x[x.length - 1]) && !RE_CJK.test(x);
    const startsLat = t && RE_LATIN.test(t[0]) && !RE_CJK.test(t);
    if (prev !== undefined && startsLat && isLat(prev)) { out[out.length - 1] = prev + t; continue; }
    if (prev !== undefined && t === ' ' ) { out.push(t); continue; }
    // "Leica" + " " + "Camera" → 三段合一（中間那段空白已在 out 尾端）
    if (out.length >= 2 && out[out.length - 1] === ' ' && startsLat && isLat(out[out.length - 2])
        && (out[out.length - 2] + ' ' + t).length <= 24) {
      out.splice(out.length - 2, 2, out[out.length - 2] + ' ' + t);
      continue;
    }
    out.push(t);
  }
  return out;
}

/* ③-b 落單漢字黏回鄰居，修 ICU 把雙字詞拆散的老問題（募/資、捷/安/特）。
   方向不能一律往後：後綴型的字（感 性 化 者 集 館…）要往前黏，否則「孤寂感與」會把
   「感」拖去跟「與」湊成一組。列在 NB_SUFFIX 的往前，其餘往後，黏不到就換另一邊。 */
const NB_SUFFIX = new Set('感性化者集館式度力學家業品物心面部分種類樣法子頭兒員師'.split(''));
function glueSingles(u) {
  const out = [];
  const cjkWord = (x) => x && RE_CJK.test(x[0]);
  const back = (t) => {
    const prev = out[out.length - 1];
    if (cjkWord(prev) && (prev + t).length <= 6) { out[out.length - 1] = prev + t; return true; }
    return false;
  };
  for (let i = 0; i < u.length; i++) {
    const t = u[i];
    const solo = t.length === 1 && RE_CJK.test(t) && !NB_SOLO.has(t);
    if (solo) {
      const nxt = u[i + 1];
      const fwdOk = cjkWord(nxt) && (t + nxt).length <= 6;
      if (NB_SUFFIX.has(t)) {
        if (back(t)) continue;
        if (fwdOk) { out.push(t + nxt); i++; continue; }
      } else {
        if (fwdOk) { out.push(t + nxt); i++; continue; }
        if (back(t)) continue;
      }
    }
    out.push(t);
  }
  return out;
}

// ③-c 標點黏詞：收尾類不落行首、起首類不落行尾
function attachPunct(u) {
  const out = [];
  for (let i = 0; i < u.length; i++) {
    const t = u[i];
    if (t.length && PUNCT_CLOSE.indexOf(t[0]) >= 0 && out.length && out[out.length - 1] !== ' ') {
      out[out.length - 1] += t; continue;
    }
    if (t.length === 1 && PUNCT_OPEN.indexOf(t) >= 0 && i + 1 < u.length) {
      u[i + 1] = t + u[i + 1]; continue;
    }
    out.push(t);
  }
  return out;
}

// 空白原樣輸出（保留斷點）；純拉丁長串不包 nb，交給 overflow-wrap 免得橫向溢出
function emit(t) {
  if (!t) return '';
  if (!t.trim()) return esc(t);
  if (!RE_CJK.test(t) && t.length > 24) return esc(t);
  return `<span class="nb">${esc(t)}</span>`;
}

const pad = (n, w) => String(n).padStart(w, '0');
const photosFor = (id) => PHOTOS[id === '3d' ? 'three_d' : id];
const slugOf = (id) => id;                       // data.js 的 id 直接當網址片段
const oneLine = (s) => String(s).replace(/\s+/g, ' ').trim();
const clip = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…');

// ---------- JPEG 尺寸（純 JS 解析 SOF 標記，零相依；供 <img width height> 防 CLS） ----------
const dimCache = new Map();
function jpegSize(absPath) {
  if (dimCache.has(absPath)) return dimCache.get(absPath);
  let out = null;
  try {
    const b = fs.readFileSync(absPath);
    if (b.length > 4 && b[0] === 0xFF && b[1] === 0xD8) {
      let i = 2;
      while (i < b.length - 9) {
        if (b[i] !== 0xFF) { i++; continue; }            // 對齊到下一個標記
        const m = b[i + 1];
        if (m === 0xFF) { i++; continue; }               // 填充位元組
        if (m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7)) { i += 2; continue; } // 無酬載
        if (m === 0xD9 || m === 0xDA) break;             // EOI / SOS 之後是熵編碼資料
        const len = b.readUInt16BE(i + 2);
        // SOFn = C0..CF，扣掉 C4(DHT) / C8(JPG) / CC(DAC)
        if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
          out = { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
          break;
        }
        if (len < 2) break;
        i += 2 + len;
      }
    }
  } catch (e) { out = null; }
  dimCache.set(absPath, out);
  return out;
}

// ---------- 響應式圖片 <picture>（AVIF → WebP → img fallback） ----------
// sizes：各版位的實際佈局寬度（欄數／容器上限見 styles.css），瀏覽器據此挑 tier
const SIZES = {
  hero: '100vw',
  section: '(max-width: 800px) 92vw, (max-width: 1408px) 44vw, 570px',   // 首頁 2 欄 → 800px 以下單欄
  masonry: '(max-width: 720px) 92vw, (max-width: 1408px) 45vw, 600px',   // gallery.masonry-2 → 720px 以下單欄
  single: '(max-width: 1608px) 92vw, 1480px',                            // gallery.single._wide 上限 1480
};

// manifest 鍵＝photos\ 底下去掉副檔名的相對路徑，允許子目錄（work/giant ← photos\work\giant.webp）
const mKey = (src) => {
  const m = /^photos\/(.+?)\.(avif|webp|jpe?g|png)$/i.exec(String(src));
  return m ? m[1] : null;
};
const mEntry = (src) => { const k = mKey(src); return (k && MANIFEST[k]) || null; };
// 逐張 alt：photo-alts.json 查得到就用那句，查不到退回呼叫端給的 fallback（系列名+編號）
const altOf = (src, fallback) => { const k = mKey(src); return (k && ALTS[k]) || fallback; };
const srcsetOf = (e, fmt, rel) =>
  e.formats[fmt].map((x) => `${rel}photos/${x.f} ${x.w}w`).join(', ');

/* pictureTag(src, rel, o)
   o: { alt, sizes, loading, cls, priority, deferred, extra }
   deferred=true → source/img 改掛 data-srcset / data-src，交由 site.js 於首屏之後補載
                   （hero 第 2 張起：它們全在視窗內，loading=lazy 擋不住） */
function pictureTag(src, rel, o) {
  o = o || {};
  if (!src) throw new Error(
    '圖片來源是 undefined —— 多半是 data.js 的某系列張數少於 WORK_TILES / HERO_SLIDES / coverIdx 寫死的索引。' +
    '（ingest-photos.js 跑完會列出「引用 xx_N 但本系列只剩 M 張」的警告，照著修 data.js 或 build-site.js 的 WORK_TILES。）');
  const e = mEntry(src);
  const alt = ` alt="${esc(o.alt || '')}"`;
  const load = o.priority ? ' fetchpriority="high"' : (o.loading === false ? '' : ` loading="${o.loading || 'lazy'}"`);
  const cls = o.cls ? ` class="${o.cls}"` : '';

  // ---- 零回歸分支：manifest 查無條目 → 單 src ----
  if (!e) {
    const d = jpegSize(path.join(ROOT, src));
    const dim = d ? ` width="${d.w}" height="${d.h}"` : '';
    return `<img src="${esc(rel + src)}"${dim}${alt}${load} decoding="async"${cls}${o.extra || ''}>`;
  }

  const sizes = o.sizes && e.formats.webp.length > 1 ? ` sizes="${esc(o.sizes)}"` : '';
  const A = o.deferred ? 'data-srcset' : 'srcset';
  const S = o.deferred ? 'data-src' : 'src';
  const sources = ['avif', 'webp']
    .filter((f) => e.formats[f] && e.formats[f].length)
    .map((f) => `<source type="image/${f}" ${A}="${esc(srcsetOf(e, f, rel))}"${sizes}>`)
    .join('');
  // <picture> 吃 display:contents（patch.css），版面等同直接放 <img> ＝ 零版面變動
  return `<picture class="bu">${sources}` +
    `<img ${S}="${esc(rel + 'photos/' + e.main)}" width="${e.w}" height="${e.h}"${alt}${load}` +
    ` decoding="async" class="bu-img${o.cls ? ' ' + o.cls : ''}"` +
    ` onload="this.classList.add('is-loaded')"${o.extra || ''}></picture>`;
}

// LQIP blur-up：微型圖當底色鋪在「既有的」容器盒上（.gframe / .sec-media / .hero-slide），
// 不新增節點也不改盒模型；主圖 onload 後淡入蓋掉它
function lqipBg(src) {
  const e = mEntry(src);
  return e && e.lqip ? `background-image:url('${e.lqip}')` : '';
}

// 最大可用 tier（燈箱吃它）；沒有 manifest 條目就回原 src
function fullAttrs(src, rel) {
  const e = mEntry(src);
  if (!e || !e.max) return ` data-full="${esc(rel + src)}"`;
  return ` data-full="${esc(rel + 'photos/' + e.max.webp)}"` +
    ` data-full-avif="${esc(rel + 'photos/' + e.max.avif)}"` +
    ` data-full-w="${e.max.w}" data-full-h="${e.max.h}" data-full-tier="${e.max.tier}"`;
}

// CSS 背景版位（work 磚／about 直幅／featured）：不動 DOM，用 image-set 補 AVIF
// 前一行純 url() 是不支援 image-set 的瀏覽器的退路（後宣告覆蓋先宣告）
function bgImage(src, rel) {
  const e = mEntry(src);
  const webp = `url('${rel}${src}')`;
  if (!e || !e.formats.avif || !e.formats.avif.length) return `background-image:${webp}`;
  const avif = e.formats.avif[e.formats.avif.length - 1].f;
  const wf = e.formats.webp[e.formats.webp.length - 1].f;
  return `background-image:${webp};background-image:image-set(` +
    `url('${rel}photos/${avif}') type('image/avif'),` +
    `url('${rel}photos/${wf}') type('image/webp'))`;
}

/* work-featured 的兩塊精選磚：背景掛在 ::before 偽元素上（styles.css:626），偽元素拿不到
   inline style，只能靠繼承下去的自訂屬性。而自訂屬性不做語法驗證 ——「先 url() 再 image-set()
   後者覆蓋前者」那套退路在這裡失效（不支援 image-set 的瀏覽器會照收字串，等到 var() 代入
   background-image 才判定無效 → 整條宣告作廢 → 什麼都不顯示）。
   所以拆成兩個變數：--bg-N 恆為純 url()（普世退路），--bg-Ns 為 image-set；由 patch.css 的
   @supports 決定要不要換上後者。styles.css 原檔零觸及。 */
function bgVars(n, src, rel) {
  const e = mEntry(src);
  const webp = `url('${rel}${src}')`;
  if (!e || !e.formats.avif || !e.formats.avif.length) return `--bg-${n}:${webp}`;
  const avif = e.formats.avif[e.formats.avif.length - 1].f;
  const wf = e.formats.webp[e.formats.webp.length - 1].f;
  return `--bg-${n}:${webp};--bg-${n}s:image-set(` +
    `url('${rel}photos/${avif}') type('image/avif'),` +
    `url('${rel}photos/${wf}') type('image/webp'))`;
}

// 導覽列（frosted 與 footer 共用）
const NAV = [
  { key: 'hasselblad', label: 'Hasselblad' },
  { key: 'portraits', label: 'Portraits' },
  { key: 'street', label: 'Street' },
  { key: 'nature', label: 'Nature' },
  { key: '3d', label: '3D' },
  { key: 'film', label: 'Film' },
  { key: 'market', label: '果菜市場', labelEn: 'Market' },   // 唯一需要換字的項目（其餘本來就是英文）
  { key: 'work', label: 'Work' },
  { key: 'about', label: 'About' },
];

const PERSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Jerrythepopper 洪立楷',
  alternateName: 'Jerrythepopper',
  jobTitle: 'Photographer / 3D Creator',
  email: 'mailto:jerrythepopper@gmail.com',
  address: { '@type': 'PostalAddress', addressLocality: 'Taipei', addressCountry: 'TW' },
  areaServed: [
    { '@type': 'Country', name: 'Taiwan' },
    { '@type': 'Place', name: 'International' },
  ],
  knowsAbout: ['攝影', '人像攝影', '街頭攝影', '底片攝影', '自然攝影', '3D 視覺設計', 'CGI', '場景設計'],
  sameAs: ['https://www.instagram.com/jerrythepopper'],
};

// ---------- 共用片段 ----------
function head(o) {
  // o: {title, desc, canonicalPath, ogImage, ogPage, jsonld, rel}
  const canonical = SITE_ORIGIN + o.canonicalPath;
  const ld = JSON.stringify(o.jsonld, null, 2).replace(/</g, '\\u003c');
  // og:image 一律絕對網址（社群爬蟲不解相對路徑）：OG_META 有該頁的方形封面（sharp 產）
  // 就用它＋標尺寸；沒有（缺 sharp 或來源缺檔）就優雅退回現行 cover 圖，不標尺寸
  // （S28 2026-08-09：OG 分享圖方形化，o.ogImage 本身已是站根相對路徑，不吃 o.rel）
  const ogEntry = o.ogPage && OG_META[o.ogPage];
  const ogPath = ogEntry ? ogEntry.rel : o.ogImage;
  const ogAbs = `${SITE_ORIGIN}/${ogPath}`;
  const ogDims = ogEntry
    ? `<meta property="og:image:width" content="${ogEntry.w}">\n<meta property="og:image:height" content="${ogEntry.h}">\n`
    : '';
  /* hreflang 三件套（S29）：中英互指成對 ＋ x-default 指中文版（原生語版）。
     只有「有對應語版」的頁面才掛（o.alt）——404 是 noindex，不進這個網。 */
  const altLinks = o.alt
    ? `<link rel="alternate" hreflang="zh-Hant" href="${esc(SITE_ORIGIN + o.alt.zh)}">\n` +
      `<link rel="alternate" hreflang="en" href="${esc(SITE_ORIGIN + o.alt.en)}">\n` +
      `<link rel="alternate" hreflang="x-default" href="${esc(SITE_ORIGIN + o.alt.zh)}">\n`
    : '';
  return `<!DOCTYPE html>
<html lang="${isEn() ? 'en' : 'zh-Hant'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="google-site-verification" content="pEeokeSZ4f60CDCBeXLxxu_EAp34X4FzoMZ8OWKfGww">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#1f1d1a" media="(prefers-color-scheme: dark)">
<script>document.documentElement.className+=' js';try{var t=localStorage.getItem('jtpTheme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
${o.headExtra || ''}<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.desc)}">
${o.robots ? `<meta name="robots" content="noindex">\n` : ''}
<link rel="canonical" href="${esc(canonical)}">
${altLinks}<meta property="og:type" content="website">
<meta property="og:site_name" content="Jerrythepopper Photography">
<meta property="og:locale" content="${isEn() ? 'en_US' : 'zh_TW'}">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.desc)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(ogAbs)}">
${ogDims}<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(o.title)}">
<meta name="twitter:description" content="${esc(o.desc)}">
<meta name="twitter:image" content="${esc(ogAbs)}">
<link rel="icon" type="image/svg+xml" href="${o.rel}favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${o.rel}styles.css">
<noscript><style>.fade-up{opacity:1;transform:none}.hero-title .ch{opacity:1;transform:none;animation:none}</style></noscript>
<script type="application/ld+json">
${ld}
</script>
</head>
<body>
<div id="root">`;
}

/* 深淺切換鈕（S24）——同一顆 markup 出現兩處：frosted nav 最右端、hero 右上角。
   狀態不寫在鈕上（沒有 aria-pressed 也沒有 class 切換）：外觀由 :root 的
   --tt-sun / --tt-moon 決定，JS 只改 <html data-theme>，兩顆自動同步。
   兩個 icon 都留在 DOM 裡交叉淡出（見 patch.css），所以沒有「換圖」那一格空白。
   顯示的是「點下去會變成哪一邊」：亮場出月亮、暗場出太陽。 */
function themeToggle() {
  return `<button class="theme-toggle" type="button" aria-label="切換深淺色" title="切換深淺色">
    <svg class="ic-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.3M12 19.1v2.3M4.5 4.5l1.6 1.6M17.9 17.9l1.6 1.6M2.6 12h2.3M19.1 12h2.3M4.5 19.5l1.6-1.6M17.9 6.1l1.6-1.6"/></svg>
    <svg class="ic-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.3 14.7A8.5 8.5 0 0 1 9.3 3.7a8.5 8.5 0 1 0 11 11Z"/></svg>
  </button>`;
}

/* 語言切換鈕（S29）——兩處：frosted nav 最右（主題鈕左邊）、hero 右上（主題鈕左邊）。
   刻意做成 <a> 而不是 <button>：它就是一條連結（可 Cmd+點開新分頁、可被爬蟲跟隨），
   鍵盤可達靠原生 Tab 序，不必補 tabindex。hreflang 讓瀏覽器/爬蟲知道對面是哪一語。
   href 指的是「當前頁的另一語版本」，不是首頁——往返回得到同一頁。 */
function langToggle(href) {
  const t = isEn() ? EN.langToggle : EN_SWITCH_ZH;
  const other = isEn() ? 'zh-Hant' : 'en';
  return `<a class="lang-toggle" href="${esc(href)}" hreflang="${other}" lang="${other}"` +
    ` aria-label="${esc(t.label)}" title="${esc(t.label)}">${esc(t.text)}</a>`;
}

function frosted(rel, current, lhref) {
  // 子頁（非首頁）常駐顯示：分享連結直達時第一屏就有站名與返回路徑（P1-1）
  // is-static 寫在 class 裡而非靠 JS，無 JS 環境一樣看得到
  const always = current !== 'home';
  const items = NAV.map((i) => {
    const cls = i.key === current ? ' class="is-active"' : '';
    const cur = i.key === current ? ' aria-current="page"' : '';
    return `    <a href="${rel}${slugOf(i.key)}/"${cls}${cur}>${esc(isEn() && i.labelEn ? i.labelEn : i.label)}</a>`;
  }).join('\n');
  return `<div class="frosted${always ? ' is-static' : ''}" aria-hidden="${always ? 'false' : 'true'}"${always ? ' data-always="1"' : ''}>
  <a href="${rel || './'}" class="brand">Jerrythepopper</a>
  <nav aria-label="Sticky">
${items}
  </nav>
  ${langToggle(lhref)}
  ${themeToggle()}
</div>`;
}

function footer(rel) {
  // 英文頁的系列清單去中文副標（含果菜市場那條特例，英文只留 Taipei Wholesale Market）
  const series = SECTIONS.map((s) =>
    `      <li><a href="${rel}${slugOf(s.id)}/">${esc(isEn() ? s.en : (s.en === 'Taipei Wholesale Market' ? '果菜市場 輪轉' : enZh(s)))}</a></li>`
  ).join('\n');
  return `<footer class="foot">
  <div class="foot-inner">
    <div>
      <div class="foot-brand">
        <span class="en">Jerrythepopper</span>
        <span class="zh">洪立楷 · Photography / 3D</span>
      </div>
    </div>
    <div>
      <h4>Series</h4>
      <ul>
${series}
      </ul>
    </div>
    <div>
      <h4>Office</h4>
      <ul>
        <li><a href="${rel}work/">${isEn() ? 'Work' : 'Work 工作'}</a></li>
        <li><a href="${rel}about/">${isEn() ? 'About' : 'About 關於我'}</a></li>
      </ul>
    </div>
    <div>
      <h4>Connect</h4>
      <ul>
        <li><a href="https://www.instagram.com/jerrythepopper" target="_blank" rel="noopener noreferrer">Instagram ↗</a></li>
        <li><a href="mailto:jerrythepopper@gmail.com">Email ↗</a></li>
      </ul>
    </div>
  </div>
  <div class="foot-hire">Available for commissions · <a href="mailto:jerrythepopper@gmail.com">jerrythepopper@gmail.com</a></div>
  <small>© 2026 Jerrythepopper · Photography & 3D Portfolio</small>
</footer>`;
}

function tail(rel) {
  return `</div>
<script src="${rel}site.js" defer></script>
</body>
</html>
`;
}

/* o.rel＝assetRel（styles.css / site.js / favicon 等站根資產）
   o.linkRel＝同語言的頁面互連（沒給就等於 o.rel，中文版正是這個情形＝零回歸）
   o.langHref＝語言切換鈕的目的地 */
function shell(o) {
  const lr = o.linkRel != null ? o.linkRel : o.rel;
  return head(o) + '\n' + frosted(lr, o.current, o.langHref) + '\n' + o.main + '\n' + footer(lr) + '\n' + tail(o.rel);
}

// ---------- 首頁 ----------
/* hero 海報的六個自訂屬性，三個尺寸階：
     --hp /--hps   寬螢幕 1920
     --hpm/--hpms  窄螢幕 ＠1x   960
     --hpl/--hpls  窄螢幕 ＠2x↑ 1440   ← 2026-08-09 S25 新增
   帶 s 的是 image-set（AVIF 優先），不帶的是純 url() ——「同名宣告兩次後者覆蓋前者」那套
   退路對 var() 無效（理由同 bgVars 的註解），所以拆成兩個變數由 patch.css 的 @supports 決定。
   base 是不含副檔名的基底（photos/hero-poster-1），實體檔為 <base>.avif|.webp
   與 <base>@960.* / <base>@1440.*。
   為什麼要 1440：手機 hero 是滿版，iPhone 390 CSS px × 3 DPR ＝ 1170 實體像素，原本
   一律吃 960 版的窄螢幕分支等於把 960 拉去填 1170，站主真機看得出糊。1440 有餘裕，
   又不必把桌機那張 1920 整個丟給手機。 */
function heroPosterVars(base) {
  const iset = (b) =>
    `image-set(url('${b}.avif') type('image/avif'),url('${b}.webp') type('image/webp'))`;
  return `--hp:url('${base}.webp');--hps:${iset(base)};` +
    `--hpm:url('${base}@960.webp');--hpms:${iset(base + '@960')};` +
    `--hpl:url('${base}@1440.webp');--hpls:${iset(base + '@1440')}`;
}

/* hero 的 <head> 段：海報變數 ＋ 輪值腳本 ＋ 海報 preload。
   全部擺 <head> 是為了 LCP —— 海報是 CSS 背景圖，若等到 body 裡的 .hero-poster 佈局完才
   被發現，會比舊版那張 fetchpriority=high 的 <img> 晚一大截。這裡的作法：
     ① <style> 先把第 1 支的四個變數寫在 :root —— 無 JS 環境的完整退路。
     ② 腳本輪值出本次支數，改寫 :root 的行內樣式（行內勝過 <style> 規則）。變數掛在 :root
        而不是元素上，所以趕在 .hero-poster 存在之前就能定案，繼承下去即可。
     ③ 順手插一條 preload：解析到 <head> 就開抓，不必等 CSS 套用。只 preload AVIF 並標
        type —— 不支援 AVIF 的瀏覽器會直接略過這條，退回 image-set 選 WebP，不會雙抓。
   窄螢幕判斷用 innerWidth<=820，斷點與 patch.css 的海報 960 版、site.js 的 720p 挑檔一致。
   窄螢幕再依 devicePixelRatio 分兩階（S25）：≥2 給 @1440、否則 @960 —— 這裡挑的檔必須
   跟 patch.css 那組 (max-width:820px) and (min-resolution:2dppx) 選的是同一張，
   不然 preload 抓一張、CSS 用另一張，等於白抓一份。 */
function heroHead(rel) {
  // data.js 沒有 HERO_VIDEOS 就整段不出：hero 退成純黑底＋壓暗漸層，build 不會炸
  if (!HERO_VIDEOS.length) { console.warn('! data.js 沒有 HERO_VIDEOS —— hero 不會有海報也不會有影片'); return ''; }
  /* 影片路徑要吃 rel：site.js 是直接 v.src = item.mp4（相對於「當前頁網址」解析），
     英文首頁在 /en/ 底下，不補 ../ 的話會去抓 /en/video/cloud-1.mp4 → 404、hero 停在海報。
     海報那組走下面腳本裡的 R+poster，已經是 rel 前綴，這裡補的是影片這一半。
     中文版 rel='' ＝ 字串完全不變（Object.assign 保留原鍵序）→ 逐位元組零回歸。 */
  const vids = JSON.stringify(HERO_VIDEOS.map((v) => Object.assign({}, v, {
    mp4: rel + v.mp4,
    mp4_720: v.mp4_720 ? rel + v.mp4_720 : v.mp4_720,
  }))).replace(/</g, '\\u003c');
  return `<style>:root{${heroPosterVars(rel + HERO_VIDEOS[0].poster)}}</style>
<script>
window.__HERO_VIDEOS=${vids};
(function(){var L=window.__HERO_VIDEOS,i=0,R='${rel}';
try{var k='heroVidIdx',p=parseInt(localStorage.getItem(k),10);
i=((isFinite(p)?p:-1)+1)%L.length;localStorage.setItem(k,String(i));}catch(e){i=0;}
window.__HERO_IDX=i;
var b=R+L[i].poster,sm=window.innerWidth<=820,hi=(window.devicePixelRatio||1)>=2,
s=function(x){return "image-set(url('"+x+".avif') type('image/avif'),url('"+x+".webp') type('image/webp'))";},
d=document.documentElement.style;
if(i>0){d.setProperty('--hp',"url('"+b+".webp')");d.setProperty('--hps',s(b));
d.setProperty('--hpm',"url('"+b+"@960.webp')");d.setProperty('--hpms',s(b+'@960'));
d.setProperty('--hpl',"url('"+b+"@1440.webp')");d.setProperty('--hpls',s(b+'@1440'));}
var l=document.createElement('link');l.rel='preload';l.as='image';l.type='image/avif';
l.setAttribute('fetchpriority','high');l.href=b+(sm?(hi?'@1440':'@960'):'')+'.avif';
document.head.appendChild(l);})();
</script>
`;
}

function heroBlock(lhref) {
  const chars = [...'Jerrythepopper'].map((ch, i) =>
    `<span class="ch" style="animation-delay:${600 + i * 50}ms">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`
  ).join('');

  return `<section class="hero" data-screen-label="00 Hero">
  <div class="hero-mv" aria-hidden="true">
    <div class="hero-poster"></div>
    <div class="hero-scrim"></div>
  </div>

  <div class="hero-chrome">
    <a href="./" class="hero-wordmark">
      <span class="en">Jerrythepopper · Photography / 3D</span>
    </a>
    <div class="hero-topnav">
      <a href="work/">Work</a>
      <span class="sep">|</span>
      <a href="about/">Contact</a>
    </div>
    ${langToggle(lhref)}
    ${themeToggle()}
  </div>

  <div class="hero-title-wrap">
    <div class="hero-eyebrow">
      <span class="h-line"></span><span>Photography · 3D</span><span class="h-line"></span>
    </div>
    <h1 class="hero-title">${chars}</h1>
    <div class="hero-sub">洪 立 楷 ／ 影 像 作 品</div>
  </div>

  <div class="hero-hint" aria-hidden="true">
    <span>Scroll</span>
    <div class="line"></div>
  </div>
</section>`;
}

/* rel＝assetRel（照片在站根 photos\）。中文首頁是 ''、英文首頁在 /en/ 底下要 '../'
   ——漏了這一手，英文首頁九張封面全部去抓 /en/photos/… 而 404（2026-08-09 實測抓到）。
   連結（href="hasselblad/"）走的是 linkRel，兩語版都是 ''，所以那半邊不必動。 */
function categorySection(s, index, rel) {
  const alt = index % 2 === 1;
  const cover = photosFor(s.id)[s.coverIdx];
  // meta 可為空陣列（文案未定的系列）：空的就整塊不渲染，不留 <div class="meta"></div> 空殼
  const metaBlock = s.meta.length
    ? `      <div class="meta">${s.meta.map((m) => `<span>${esc(m)}</span>`).join('')}</div>\n`
    : '';
  return `<section class="section${alt ? ' _alt' : ''}" data-screen-label="${esc(s.number + ' ' + s.en)}">
  <div class="fade-up section-inner${alt ? ' _reverse' : ''}" style="transition-delay:0ms">
    <a href="${slugOf(s.id)}/" class="sec-media" aria-label="${esc(s.en)}" style="${lqipBg(cover)}">
      <span class="sec-num">No. ${esc(s.number)}</span>
      ${pictureTag(cover, rel, { alt: altOf(cover, s.en), sizes: SIZES.section })}
    </a>
    <div class="sec-body">
      <div class="eyebrow">
        <span class="n">${esc(s.number)}</span>
        <span class="flow-line in" style="width:40px"></span>
        <span>${esc(s.eyebrow)}</span>
      </div>
      <h2>${esc(s.en)}${zhTag(s)}</h2>
      <p class="lede">${seg(isEn() ? EN.sections[s.id].lede : s.lede)}</p>
${metaBlock}      <a href="${slugOf(s.id)}/" class="cta">View series <span class="arr">→</span></a>
    </div>
  </div>
</section>`;
}

function teaser(o) {
  // o: {label, cls, reverse, href, num, cover, alt, eyebrow, h2en, h2zh, lede, metas, cta, rel}
  // o.rel＝assetRel（照片路徑用），理由同 categorySection
  return `<section class="section${o.cls}" data-screen-label="${esc(o.label)}">
  <div class="fade-up section-inner${o.reverse ? ' _reverse' : ''}" style="transition-delay:0ms">
    <a href="${o.href}" class="sec-media" style="${lqipBg(o.cover)}">
      <span class="sec-num">No. ${o.num}</span>
      ${pictureTag(o.cover, o.rel, { alt: altOf(o.cover, o.alt), sizes: SIZES.section })}
    </a>
    <div class="sec-body">
      <div class="eyebrow">
        <span class="n">${o.num}</span>
        <span class="flow-line in" style="width:40px"></span>
        <span>${esc(o.eyebrow)}</span>
      </div>
      <h2>${esc(o.h2en)}${isEn() ? '' : `<span class="jp">${esc(o.h2zh)}</span>`}</h2>
      <p class="lede">${seg(o.lede)}</p>
      <div class="meta">${o.metas.map((m) => `<span>${esc(m)}</span>`).join('')}</div>
      <a href="${o.href}" class="cta">${esc(o.cta)} <span class="arr">→</span></a>
    </div>
  </div>
</section>`;
}

function homePage() {
  const rel = assetRel('');                 // 中文首頁 ''、英文首頁 '../'（資產都在站根）
  const lhref = langHref(rel, '');
  const lede1 = isEn() ? EN.home.introLede[0] : '以影像捕捉人文、街頭與空間的情緒。';
  const lede2 = isEn() ? EN.home.introLede[1] : '在孤寂感與時間流動中，找到我的樣貌。';
  const intro = `<section class="intro">
  <div class="fade-up intro-inner" style="transition-delay:0ms">
    <div class="eyebrow">Selected · 2018 — 2026</div>
    <p class="intro-lede">${seg(lede1)}<br>${seg(lede2)}</p>
    <p>Photographer · 3D Creator · Based in Taipei. Brand collaborations with Hasselblad, Leica, Sony, Oppo, Giant, and more.</p>
  </div>
</section>`;

  const main = `<main data-screen-label="01 Home">
${heroBlock(lhref)}
${intro}
${SECTIONS.map((s, i) => categorySection(s, i, rel)).join('\n')}
${teaser({
    label: '08 Work', cls: ' _alt', reverse: false, href: 'work/', num: '08', rel,
    cover: PHOTOS.hasselblad[7], alt: 'Work', eyebrow: 'Selected · 2023 — 2026',
    h2en: 'Work', h2zh: '工作',
    lede: isEn() ? EN.home.workLede : '品牌合作與商業工作精選。',
    metas: ['Hasselblad', 'Leica', 'Sony', 'Oppo', 'Goopi', 'Reto'], cta: 'View work',
  })}
${teaser({
    label: '09 About', cls: '', reverse: true, href: 'about/', num: '09', rel,
    cover: ABOUT_PORTRAIT, alt: 'About', eyebrow: 'Photographer · 3D Creator',
    h2en: 'About', h2zh: '關於我',
    lede: isEn() ? EN.home.aboutLede : 'Jerrythepopper 洪立楷，1996年生於台北。攝影師、3D創作者。',
    metas: ['Based in Taipei', 'SEVEN / Asia-Pacific'], cta: 'Read more',
  })}
</main>`;

  return shell({
    rel, linkRel: '', langHref: lhref, current: 'home', main,
    headExtra: heroHead(rel),
    title: isEn() ? EN.meta.homeTitle
      : 'Jerrythepopper 洪立楷｜台北攝影師・3D 創作者｜人像・底片攝影・3D創作作品集',
    desc: isEn() ? EN.meta.homeDesc
      : '台北攝影師、3D 創作者洪立楷（Jerrythepopper）的個人作品集——人像、街拍、底片、自然攝影與 3D 視覺創作，曾與 Hasselblad、Leica、Sony 等品牌合作。以台北為基地，接受台灣與世界各地的攝影與 3D 視覺委託。',
    canonicalPath: isEn() ? '/en/' : '/',
    alt: { zh: '/', en: '/en/' },
    ogImage: HERO_SLIDES[0],
    ogPage: 'home',
    jsonld: PERSON_LD,
  });
}

// ---------- 系列頁 ----------
// 頁尾「下一個系列」導流：循環照 SECTIONS 排序（最後一個回第一個）
function nextSeriesBlock(s) {
  const i = SECTIONS.findIndex((x) => x.id === s.id);
  const nx = SECTIONS[(i + 1) % SECTIONS.length];
  return `<section class="fade-up next-series" style="transition-delay:0ms">
  <a href="../${slugOf(nx.id)}/" class="next-link">
    <span class="next-eyebrow">
      <span class="flow-line in" style="width:40px"></span>
      <span>Next Series</span>
      <span class="n">${esc(nx.number)}</span>
    </span>
    <span class="next-title">${esc(nx.en)}${zhTag(nx)}<span class="arr" aria-hidden="true">→</span></span>
  </a>
</section>`;
}

function categoryPage(s, screenLabel) {
  const photos = photosFor(s.id);
  const rel = assetRel('../');              // 中文 '../'、英文 '../../'
  const lhref = langHref(rel, slugOf(s.id) + '/');
  const subText = isEn() ? EN.sections[s.id].subtitle : s.subtitle;
  // subtitle / meta 皆可留空（文案未定的系列）：空的就不渲染該塊，不留空殼 DOM
  const subtitle = subText
    ? `    <p class="subtitle">${seg(subText)}</p>\n`
    : '';
  const metaBlock = s.meta.length
    ? `    <div class="meta">${s.meta.map((m) => `<span>${esc(m)}</span>`).join('')}</div>\n`
    : '';
  // Deep Zoom：本系列有登記切片的張數，磚上掛角標＋data-dzi（site.js 開專用 viewer）
  const dzList = DEEPZOOM[s.id] || [];
  const dzFor = (i) => dzList.find((d) => d.idx === i);
  /* 角標本身只寫「Deep Zoom」，沒說可以點；站主真機回報看不懂那是入口。這行話擺在
     版頭尾巴（subtitle/meta 之後、gallery 之前），有掛切片的系列才出現。 */
  const dzNote = dzList.length
    ? `    <p class="dz-note">${isEn() ? esc(EN.dzNote) : '帶有 DEEP ZOOM 標記的作品，可點入以原始尺寸細看。'}</p>\n`
    : '';

  const wide = s.layout === 'single';
  const frames = photos.map((src, i) => {
    const dz = dzFor(i);
    const a = altOf(src, s.en + ' ' + (i + 1));
    const dzAttr = dz
      ? ` data-dzi="${esc(rel + dz.dzi)}" data-dz-label="${esc(dz.label || '')}"` +
        ` data-osd="${esc(rel + 'vendor/openseadragon.min.js')}"` +
        ` aria-label="${esc(isEn() ? a + ' — open Deep Zoom viewer' : a + '，開啟 Deep Zoom 檢視器')}"`
      : '';
    const badge = dz ? `\n    <span class="dz-badge"><span class="dot" aria-hidden="true"></span>Deep Zoom</span>` : '';
    // --ar＝高/寬（manifest 查得到就用真尺寸）：masonry 版位的 grid row span 靠它算，
    // 讓 site.js 不必等圖載完就能定版（見 patch.css「masonry 閱讀順序」段）
    const e = mEntry(src);
    const ar = e && e.w && e.h ? `;--ar:${(e.h / e.w).toFixed(4)}` : '';
    return `  <button type="button" class="gframe${dz ? ' has-dz' : ''}" style="${lqipBg(src)}${ar}"${fullAttrs(src, rel)}${dzAttr}>
    ${pictureTag(src, rel, { alt: a, sizes: wide ? SIZES.single : SIZES.masonry })}${badge}
  </button>`;
  }).join('\n');

  const main = `<main class="page" data-screen-label="${esc(screenLabel)}">
  <div class="fade-up page-head" style="transition-delay:0ms">
    <div class="eyebrow">
      <span class="n">${esc(s.number)}</span>
      <span class="flow-line in" style="width:56px"></span>
      <span>${esc(s.eyebrow)}</span>
    </div>
    <h1>${esc(s.en)}${zhTag(s)}</h1>
${subtitle}${metaBlock}${dzNote}  </div>

<section class="gallery ${s.layout === 'single' ? 'single _wide' : 'masonry-2'}">
${frames}
</section>

${nextSeriesBlock(s)}
</main>`;

  // nature 頁改用專屬 SEO description（英文開場句 + 定稿中文前 60 字），非套用預設 subtitle/lede 生成規則
  // 英文版：3D 頁有站主指定的專屬 title/desc（文案檔 Meta 節），其餘照同一套 clip 規則走英文 subtitle
  const desc = isEn()
    ? (s.id === '3d' ? EN.meta.threeDDesc
      : clip(oneLine(EN.sections[s.id].subtitle || EN.sections[s.id].lede), 155))
    : s.id === 'nature'
    ? 'Tall clouds, open sea, old trees, mountains. I try to keep a record of how they look. ' + s.subtitle.slice(0, 60)
    : s.id === '3d'
    ? '攝影與 3D 的邊界實驗——台灣 3D 視覺創作、CGI 場景設計與虛實整合作品。'
    : clip(oneLine(s.subtitle || s.lede), 155);
  const pageTitle = isEn()
    ? (s.id === '3d' ? EN.meta.threeDTitle : `${s.en} | ${EN.meta.siteSuffix}`)
    : s.id === '3d' ? '3D 視覺創作 CGI｜Jerrythepopper' : `${enZh(s)}｜Jerrythepopper Photography`;
  const zhPath = `/${slugOf(s.id)}/`;
  return shell({
    rel, linkRel: '../', langHref: lhref, current: s.id, main,
    title: pageTitle,
    desc,
    canonicalPath: isEn() ? '/en' + zhPath : zhPath,
    alt: { zh: zhPath, en: '/en' + zhPath },
    ogImage: photos[s.coverIdx],
    ogPage: slugOf(s.id),
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'ImageGallery',
      name: `${secName(s)}`,
      description: desc,
      url: `${SITE_ORIGIN}${isEn() ? '/en' + zhPath : zhPath}`,
      author: PERSON_LD,
      numberOfItems: photos.length,
    },
  });
}

// ---------- Work ----------
/* src 的兩種寫法：
     'work/<slug>'  ← 該案子的專屬磚圖（originals\work\ 進產線，photos\work\<slug>.avif|webp）
     '<prefix>_<n>' ← 向某系列借第 N 張（目前只剩 Yotta 底片課程沒有專屬圖，借底片第一張）
   借圖那條保留是有原因的：ingest-photos.js 的 checkIndexRefs 會掃這個字面樣式，
   確保借的索引沒有超出該系列現有張數。 */
const WORK_TILES = [
  { url: 'https://www.instagram.com/p/DYRy7e2meZS/?igsh=MWIzdTU0NjZuN2FzdA==', t: 'OPPO Find X9 Ultra', c: '品牌形象拍攝', src: 'work/oppo' },
  { url: 'https://www.instagram.com/p/DUDZPGbE53K/?igsh=MTAxYnQ3Mzd2Z2czag==', t: 'Hasselblad × Jerry', c: '品牌合作計畫', src: 'work/hasselblad-jerry' },
  { url: 'https://www.instagram.com/reel/DCB6M24IH6T/?igsh=MW11YTU4eGk5b2p2dA==', t: 'Goopi 2024', c: '品牌形象動畫', src: 'work/goopi-2024' },
  { url: 'https://www.instagram.com/p/DTurh4DkX3V/?igsh=MXY2MDFqNGY3YW1nbQ==', t: 'GIANT', c: '品牌形象動畫', src: 'work/giant' },
  { url: 'https://www.instagram.com/p/CygDcVGSBuS/?igsh=bThtcnozbnFmeTMw', t: 'Goopi 2023', c: '品牌形象合作', src: 'work/goopi-2023' },
  { url: 'https://www.instagram.com/p/DVhoPFdmned/', t: 'Giant Liv', c: '品牌形象動畫', src: 'work/giant-liv' },
  { url: 'https://www.instagram.com/p/DWoPExxmdXd/?img_index=2', t: '新光攝影展講座', c: '攝影展覽講座', src: 'work/shinkong' },
  { url: 'https://www.instagram.com/p/CjK7UdTJl36/?img_index=1', t: 'Rolls-Royce', c: '品牌形象拍攝', src: 'work/rolls-royce' },
  { url: 'https://www.instagram.com/reel/DJ6w-6ah0QN/?igsh=ZGs3MjFnM3o5NTdz', t: 'Reto 相機', c: '產品動畫製作', src: 'work/reto' },
  { url: 'https://www.instagram.com/p/Cl3lNf9h8cm/?igsh=MTlqcXhudWUyZHBvag==', t: 'TEDxChungChengU', c: '品牌演講活動', src: 'work/tedx' },
  { url: 'https://www.youtube.com/watch?v=S7ng0s7i1FE', t: 'Sony YouTube', c: '品牌影片內容', src: 'work/sony-yt' },
  { url: 'https://www.yottau.com.tw/course/intro/1421#intro', t: 'Yotta 底片課程', c: '線上攝影課程', src: 'fm_0' },
  { url: 'https://www.instagram.com/p/C1GslZYBrSX/?img_index=1&igsh=MXdoNmE0eGNmNWo1cA==', t: '晶悅建設', c: '品牌形象拍攝', src: 'work/jingyue' },
  { url: 'https://www.instagram.com/s/aGlnaGxpZ2h0OjE4MDAwMDA1OTA5NTk3Mjcz?story_media_id=3239957459305757128&igsh=MXhhZnRoamoxc2QxZw==', t: '仁發建設', c: '品牌形象拍攝', src: 'work/renfa' },
];

const PREFIX2CAT = { pt: 'portraits', hb: 'hasselblad', st: 'street', na: 'nature', td: 'three_d', fm: 'film', mk: 'market' };

// WORK_TILES.src → 站根相對圖片路徑
function tileSrc(src) {
  if (src.includes('/')) return `photos/${src}.webp`;          // 專屬磚圖
  const [p, n] = src.split('_');                                // 向系列借圖
  return PHOTOS[PREFIX2CAT[p] || 'market'][parseInt(n, 10)];
}

function workPage() {
  const rel = assetRel('../');
  const lhref = langHref(rel, 'work/');
  // 磚的分類標籤走對照表（data-en.js）；查無對照就原樣輸出。磚的專案標題（w.t）不譯
  // ——與「合作品牌名本身不譯」同一條裁示（_content-en-draft.md）。
  const catOf = (c) => (isEn() ? (EN.work.cats[c] || c) : c);
  const tiles = WORK_TILES.map((w) => {
    const photoSrc = tileSrc(w.src);
    const linkLabel = w.url.includes('youtube.com') ? 'YouTube' : w.url.includes('yottau.com') ? 'YottaU' : 'Instagram';
    return `  <a href="${esc(w.url)}" target="_blank" rel="noopener noreferrer" class="work-tile">
    <div class="ph" style="${bgImage(photoSrc, rel)}"></div>
    <div class="ig">${linkLabel} ↗</div>
    <div class="meta">
      <div class="t">${esc(w.t)}</div>
      <div class="c">${esc(catOf(w.c))}</div>
    </div>
  </a>`;
  }).join('\n');

  const desc = isEn() ? clip(oneLine(EN.meta.workDesc), 155)
    : clip(oneLine('Brand collaborations and editorial projects — 品牌合作與商業工作。Hasselblad、Leica、Sony、Oppo、Goopi、Reto，2020 — 2026。'), 155);

  const main = `<main class="page" data-screen-label="09 Work">
  <div class="fade-up page-head" style="transition-delay:0ms">
    <div class="eyebrow">
      <span class="n">08</span>
      <span class="flow-line in" style="width:56px"></span>
      <span>Selected · 2023 — 2026</span>
    </div>
    <h1>Work${isEn() ? '' : '<span class="jp">工作</span>'}</h1>
    <p class="subtitle">${isEn() ? esc(EN.work.subtitle) : `Brand collaborations and editorial projects. Click any tile to view the project.
品牌合作與商業工作。點擊任一方塊查看專案。`}</p>
    <div class="meta"><span>HASSELBLAD</span><span>LEICA</span><span>SONY</span><span>OPPO</span><span>GOOPI</span><span>RETO</span><span>2020 — 2026</span></div>
  </div>

<section class="fade-up work-featured" style="transition-delay:0ms;${bgVars(1, 'photos/work/featured-1.webp', rel)};${bgVars(2, 'photos/work/featured-2.webp', rel)}">
  <a href="https://www.instagram.com/s/aGlnaGxpZ2h0OjE4MDY2OTM1Njg3MTE5MjI3?igsh=MTVqaG9kcG8waDNzMQ==" target="_blank" rel="noopener noreferrer">
    <div class="ft-title">Selected Works Vol.1</div>
    <div class="ft-sub">${isEn() ? esc(EN.work.featuredSub) : '品牌合作與創作精選'}</div>
  </a>
  <a href="https://www.instagram.com/s/aGlnaGxpZ2h0OjE4MDAwMDA1OTA5NTk3Mjcz?igsh=MXhhZnRoamoxc2QxZw==" target="_blank" rel="noopener noreferrer">
    <div class="ft-title">Selected Works Vol.2</div>
    <div class="ft-sub">${isEn() ? esc(EN.work.featuredSub) : '品牌合作與創作精選'}</div>
  </a>
</section>

<section class="fade-up work-grid" style="transition-delay:0ms">
${tiles}
  <div class="work-tile nophoto">
    <div>
      <div class="t">Leica</div>
      <div class="c">${esc(catOf('攝影教學講師'))}</div>
    </div>
  </div>
</section>
</main>`;

  return shell({
    rel, linkRel: '../', langHref: lhref, current: 'work', main,
    title: isEn() ? `Work | ${EN.meta.siteSuffix}` : 'Work 工作｜Jerrythepopper Photography',
    desc,
    canonicalPath: isEn() ? '/en/work/' : '/work/',
    alt: { zh: '/work/', en: '/en/work/' },
    ogImage: PHOTOS.hasselblad[0],
    ogPage: 'work',
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: isEn() ? 'Work' : 'Work 工作',
      description: desc,
      url: `${SITE_ORIGIN}${isEn() ? '/en/work/' : '/work/'}`,
      author: PERSON_LD,
    },
  });
}

// ---------- About ----------
// 站主本人肖像（originals\about\ 進產線）；About 頁與首頁 about teaser 共用同一張
const ABOUT_PORTRAIT = 'photos/about-portrait.webp';

function aboutPage() {
  const rel = assetRel('../');
  const lhref = langHref(rel, 'about/');
  const desc = isEn()
    ? clip(oneLine(EN.about.paras[0] + ' ' + EN.about.paras[1]), 155)
    : clip(oneLine('Jerrythepopper 洪立楷，台北攝影師、3D創作者，1996年生於台北。以影像捕捉人文、街頭與空間的情緒，以台北為基地，接受台灣與世界各地的攝影與 3D 視覺委託。'), 155);
  // 內文四段：中文版順序寫在下面的 zhParas；英文版照 _content-en-draft.md 的作者順序
  const zhParas = [
    '1996年生於台北。攝影師、3D創作者。',
    '以台北為基地，接受台灣與世界各地的攝影與 3D 視覺委託。',
    '以影像捕捉人文、街頭與空間的情緒，擅長在孤寂感與時間流動中找到自身的模樣。除了攝影，也持續探索3D視覺與虛實場景的交錯，嘗試讓靜態影像走向更立體的敘事。',
    '曾與 Hasselblad、Leica、Sony、Oppo、Giant、新光攝影展、朱銘美術館、蝦皮等品牌合作，執行形象拍攝、教學內容與創意企劃。紀實計畫《輪轉》記錄台北第一果菜批發市場的人與故事，歷時一年多，最終透過募資出版攝影集。',
  ];
  const paras = (isEn() ? EN.about.paras : zhParas)
    .map((p) => `    <p>${seg(p)}</p>`).join('\n');
  // 「可以一起做的事」與「展覽・出版・課程」兩份清單
  const zhTogether = [
    '攝影｜品牌形象・人像・街拍・空間・活動紀錄・人文紀實',
    '3D創作｜場景設計・視覺概念・虛實結合',
    '創意企劃｜影像敘事・品牌合作・空間裝置',
    '影像教育｜攝影教學・課程製作',
  ];
  const zhExhibits = [
    '《輪轉》攝影集出版與攝影展（台北第一果菜市場紀實計畫）',
    '底片攝影線上課程（與線上課程平台合作）',
    'Sony × Jerrythepopper 教學影片（YouTube 街拍教學）',
  ];
  const li = (arr) => arr.map((x) => `      <li>${esc(x)}</li>`).join('\n');
  /* 合作品牌：群組標籤照譯，品牌名本身不譯（_content-en-draft.md 第 68 行明寫）
     ——所以英文頁的「名發建設／朱銘美術館」這類中文品牌名是刻意保留，不是漏譯。 */
  const brandRows = [
    { k: '相機品牌', v: 'Hasselblad、Leica Camera Taiwan、Sony、Oppo、Reto' },
    { k: '建築 / 商業', v: '名發建設、三發建設、晶悅建設、臺北農產運銷公司、捷安特' },
    { k: '文化 / 藝術', v: '朱銘美術館、孤僻Goopi' },
    { k: '商業平台', v: '蝦皮' },
  ].map((r) =>
    `      <p><b>${esc(isEn() ? (EN.about.brandLabels[r.k] || r.k) : r.k)}</b><span class="bd">${seg(r.v)}</span></p>`
  ).join('\n');
  const main = `<main class="page" data-screen-label="10 About">
  <div class="fade-up page-head" style="transition-delay:0ms">
    <div class="eyebrow">
      <span class="n">09</span>
      <span class="flow-line in" style="width:56px"></span>
      <span>Photographer · 3D Creator</span>
    </div>
    <h1>About${isEn() ? '' : '<span class="jp">關於我</span>'}</h1>
  </div>

<section class="fade-up about-wrap" style="transition-delay:0ms">
  <div class="about-portrait" style="${bgImage(ABOUT_PORTRAIT, rel)}"></div>
  <div class="about-body">
    <h2>Jerrythepopper 洪立楷</h2>
    <div class="role">Photographer · 3D Creator · Based in Taipei</div>

${paras}

    <h3>${esc(isEn() ? EN.about.togetherHead : '可以一起做的事')}</h3>
    <ul>
${li(isEn() ? EN.about.together : zhTogether)}
    </ul>

    <h3>${esc(isEn() ? EN.about.brandsHead : '合作品牌')}</h3>
    <div class="brands">
${brandRows}
    </div>

    <h3>${esc(isEn() ? EN.about.exhibitsHead : '展覽・出版・課程')}</h3>
    <ul>
${li(isEn() ? EN.about.exhibits : zhExhibits)}
    </ul>

    <div class="stats">
      <div class="stat"><div class="num">12</div><div class="lab">Years shooting</div></div>
      <div class="stat"><div class="num">30+</div><div class="lab">Brands</div></div>
      <div class="stat"><div class="num">3</div><div class="lab">Solo shows</div></div>
    </div>

    <div class="contact">
      <div><b>Email</b><span><a href="mailto:jerrythepopper@gmail.com">jerrythepopper@gmail.com</a></span></div>
      <div><b>Instagram</b><span><a href="https://www.instagram.com/jerrythepopper" target="_blank" rel="noopener noreferrer">@jerrythepopper</a></span></div>
      <div><b>Representation</b><span>SEVEN / Asia-Pacific</span></div>
    </div>
  </div>
</section>
</main>`;

  return shell({
    rel, linkRel: '../', langHref: lhref, current: 'about', main,
    title: isEn() ? `About | ${EN.meta.siteSuffix}` : 'About 關於我｜Jerrythepopper Photography',
    desc,
    canonicalPath: isEn() ? '/en/about/' : '/about/',
    alt: { zh: '/about/', en: '/en/about/' },
    ogImage: ABOUT_PORTRAIT,
    ogPage: 'about',
    jsonld: PERSON_LD,
  });
}

// ---------- 404 ----------
// 迷路小雲：站內線描風（stroke 1.5px、深墨線條），呼應 hero 雲影片；兩個小點眼睛，勿花俏
function cloudIcon() {
  return `<svg viewBox="0 0 120 78" width="120" height="78" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M31 55c-9.4 0-17-7-17-15.6 0-7.8 6-14.2 13.7-15.3C29.6 14.6 38 8 48 8c11.6 0 21.3 7.9 23.4 18.3C82.6 27.5 91 36.3 91 47c0 8.3-6.9 14.6-15.4 14.6H31z"/>
  <circle cx="46" cy="40" r="2.3" fill="currentColor" stroke="none"/>
  <circle cx="61" cy="40" r="2.3" fill="currentColor" stroke="none"/>
</svg>`;
}

function notFoundPage() {
  /* 語言切換鈕在 404 上的兩端：中文版 /404.html ↔ 英文版 /en/404.html。
     GitHub Pages 只會送站根那一份 404.html，/en/404.html 是為了「切換鈕不會斷」
     與直接開網址時仍有英文版而產出，成本一頁。hreflang 不掛（noindex 頁不進索引網）。 */
  const desc = isEn() ? EN.meta.notFoundDesc : '沒有這個頁面。回首頁看看更多攝影作品。';
  const nf = EN.notFound;
  const main = `<main class="page notfound-page" data-screen-label="404 Not Found">
  <div class="fade-up notfound-wrap" style="transition-delay:0ms">
    <div class="notfound-eyebrow">
      <span class="flow-line in" style="width:40px"></span>
      <span>404</span>
    </div>
    <div class="notfound-icon">${cloudIcon()}</div>
    <h1>${isEn() ? esc(nf.h1) : '哇你怎麼跑到這裡？！'}</h1>
    <p>${isEn() ? esc(nf.p) : '沒有這頁面餒。'}</p>
    <a href="${isEn() ? '/en/' : '/'}" class="cta">${isEn() ? esc(nf.cta) : '回首頁'} <span class="arr">→</span></a>
  </div>
</main>`;

  /* rel 用根絕對路徑 '/' 而不是 ''（S24 實測抓到）：GitHub Pages 對任何不存在的網址
     都回這一份 404.html，但網址列留在原本那個深層路徑上，相對的 "styles.css" 因此
     解析成 /不存在的/路徑/styles.css → 整頁裸奔沒有樣式（深色模式當然也不會生效）。
     只有站台掛在網域根目錄時這樣寫才對——本站正是（見 SITE_ORIGIN）。 */
  return shell({
    rel: '/', linkRel: isEn() ? '/en/' : '/', langHref: isEn() ? '/404.html' : '/en/404.html',
    current: '404', main,
    title: isEn() ? `404 Not Found | ${EN.meta.siteSuffix}` : '404 找不到頁面｜Jerrythepopper Photography',
    desc,
    canonicalPath: isEn() ? '/en/404.html' : '/404.html',
    ogImage: HERO_SLIDES[0],
    ogPage: 'home',   // 沿用首頁方形封面（404 不在十頁清單內，沒有專屬 og-404.jpg）
    robots: true,
    jsonld: PERSON_LD,
  });
}

// ---------- 附屬檔 ----------
const PAGE_URLS = ['/', ...SECTIONS.map((s) => `/${slugOf(s.id)}/`), '/work/', '/about/'];
// 英文版十頁全數進 sitemap（S29）：優先權比照中文對應頁再降一階（/en/ 給 0.9、其餘 0.7），
// 表達「中文是原生語版」——與 hreflang 的 x-default 指中文版同一個訊號。
const PAGE_URLS_EN = PAGE_URLS.map((u) => '/en' + u);

function sitemapXml() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [...PAGE_URLS, ...PAGE_URLS_EN].map((u) =>
    `  <url>\n    <loc>${SITE_ORIGIN}${u}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>${u === '/' ? '1.0' : u === '/en/' ? '0.9' : u.startsWith('/en/') ? '0.7' : '0.8'}</priority>\n  </url>`
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function robotsTxt() {
  const blocked = ['GPTBot', 'ClaudeBot', 'CCBot', 'Google-Extended'];
  return blocked.map((b) => `User-agent: ${b}\nDisallow: /\n`).join('\n') +
    `\nUser-agent: *\nAllow: /\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`;
}

function llmsTxt() {
  const lines = SECTIONS.map((s) =>
    `- [${enZh(s)}](${SITE_ORIGIN}/${slugOf(s.id)}/)：${oneLine(s.lede)}`
  );
  return `# Jerrythepopper 洪立楷 — Photography & 3D Portfolio

> 台北攝影師・3D 創作者，1996 年生於台北。以影像捕捉人文、街頭與空間的情緒；曾與 Hasselblad、Leica、Sony、Oppo、Giant 等品牌合作。紀實計畫《輪轉》記錄台北第一果菜批發市場。

## Pages

- [首頁 Home](${SITE_ORIGIN}/)：作品集總覽，七個系列與工作、關於。
${lines.join('\n')}
- [Work 工作](${SITE_ORIGIN}/work/)：品牌合作與商業專案。
- [About 關於我](${SITE_ORIGIN}/about/)：簡介、合作品牌、展覽出版與聯絡方式。

## English (/en/)

> Taipei photographer and 3D artist, born 1996 in Taipei. Every page has an English counterpart under /en/; the Chinese version is the original (hreflang x-default).

${SECTIONS.map((s) => `- [${s.en}](${SITE_ORIGIN}/en/${slugOf(s.id)}/): ${oneLine(EN.sections[s.id].lede)}`).join('\n')}
- [Home](${SITE_ORIGIN}/en/): portfolio overview — seven series plus Work and About.
- [Work](${SITE_ORIGIN}/en/work/): ${oneLine(EN.home.workLede)}
- [About](${SITE_ORIGIN}/en/about/): biography, collaborations, exhibitions and contact.

## Contact

- Email: jerrythepopper@gmail.com
- Instagram: https://www.instagram.com/jerrythepopper
`;
}

// ---------- OG 分享圖（方形封面，S28 2026-08-09） ----------
// 每頁一張 1200×1200 方形 JPEG，重心智慧裁切（sharp.strategy.attention）——首頁/
// 各系列頁/work/about 共十頁，來源分別是 HERO_SLIDES[0]／該系列 coverIdx 那張／
// 現行 work、about 封面。缺 sharp 時整段優雅降級：OG_META 留空物件，head() 退回
// 用該頁原本的 ogImage（非方形，無 width/height meta），build 不中斷。
const OG_DIR = path.join(ROOT, 'photos', 'og');
const OG_SIZE = 1200;
const OG_META = {};   // page key → { rel, w, h }，generateOgImages() 於 build() 開頭填妥

function ogSpecs() {
  return [
    { page: 'home', src: HERO_SLIDES[0] },
    ...SECTIONS.map((s) => ({ page: slugOf(s.id), src: photosFor(s.id)[s.coverIdx] })),
    { page: 'work', src: PHOTOS.hasselblad[0] },
    { page: 'about', src: ABOUT_PORTRAIT },
  ];
}

async function generateOgImages() {
  if (!sharp) return;   // 警告已在 require 失敗當下印過
  fs.mkdirSync(OG_DIR, { recursive: true });
  let made = 0, skipped = 0, missing = 0;
  for (const { page, src } of ogSpecs()) {
    const srcAbs = path.join(ROOT, src);
    const outRel = `photos/og/og-${page}.jpg`;
    const outAbs = path.join(ROOT, outRel);
    if (!fs.existsSync(srcAbs)) {
      console.warn(`! og 來源缺檔：${src}（${page} 頁退回現行 cover，不產方形圖）`);
      missing++;
      continue;
    }
    // 冪等：來源 mtime 沒有比既有輸出新就跳過，避免每次 build 重壓（S28 驗收要求）
    const regen = !fs.existsSync(outAbs) || fs.statSync(srcAbs).mtimeMs > fs.statSync(outAbs).mtimeMs;
    if (regen) {
      await sharp(srcAbs)
        .resize(OG_SIZE, OG_SIZE, { fit: 'cover', position: sharp.strategy.attention })
        .jpeg({ quality: 85 })
        .toFile(outAbs);           // 未呼叫 withMetadata() ＝ 不寫入 EXIF/ICC，比照 ingest-photos.js 慣例
      made++;
    } else {
      skipped++;
    }
    OG_META[page] = { rel: outRel, w: OG_SIZE, h: OG_SIZE };
  }
  console.log(`og:image 方形封面：新產 ${made} 張／未變略過 ${skipped} 張${missing ? `／缺來源 ${missing} 張` : ''} → photos/og/`);
}

// ---------- build ----------
function write(rel, content) {
  const file = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
  return file;
}

async function build() {
  await generateOgImages();   // 先產好方形封面＋填 OG_META，頁面 head() 才查得到絕對網址＋尺寸

  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  const written = [];
  written.push(write('index.html', homePage()));

  const labels = {
    hasselblad: '02 Hasselblad', portraits: '03 Portraits', street: '04 Street',
    nature: '05 Nature', '3d': '06 3D', film: '07 Film', market: '08 Market',
  };
  for (const s of SECTIONS) {
    written.push(write(`${slugOf(s.id)}/index.html`, categoryPage(s, labels[s.id])));
  }
  written.push(write('work/index.html', workPage()));
  written.push(write('about/index.html', aboutPage()));
  written.push(write('404.html', notFoundPage()));

  /* ---- 英文版（S29 2026-08-09）：同一組模板翻牌成 LANG='en' 再跑一遍 ----------
     產出全數落在 dist\en\，中文版那十一份檔案在這行之前就已寫完 ＝ 英文純增量。
     翻牌完記得翻回來（下面 finally 那行），免得之後有人在 build() 尾巴加中文產物。 */
  LANG = 'en';
  try {
    written.push(write('en/index.html', homePage()));
    for (const s of SECTIONS) {
      written.push(write(`en/${slugOf(s.id)}/index.html`, categoryPage(s, labels[s.id])));
    }
    written.push(write('en/work/index.html', workPage()));
    written.push(write('en/about/index.html', aboutPage()));
    written.push(write('en/404.html', notFoundPage()));
  } finally {
    LANG = 'zh';
  }

  // styles.css = 既有檔原樣 + build 補丁段（不改既有規則）
  const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8') +
    '\n' + fs.readFileSync(path.join(SRC, 'patch.css'), 'utf8');
  written.push(write('styles.css', css));

  // site.js
  written.push(write('site.js', fs.readFileSync(path.join(SRC, 'site.js'), 'utf8')));

  // favicon（各頁以相對路徑引用：首頁 favicon.svg、子頁 ../favicon.svg）
  written.push(write('favicon.svg', fs.readFileSync(path.join(SRC, 'favicon.svg'), 'utf8')));

  // 附屬檔
  written.push(write('robots.txt', robotsTxt()));
  written.push(write('sitemap.xml', sitemapXml()));
  written.push(write('llms.txt', llmsTxt()));

  // vendor（OpenSeadragon，Deep Zoom 檢視器；只在點開角標時才動態載入）
  const vendorDir = path.join(SRC, 'vendor');
  let vendorBytes = 0, vendorFiles = 0;
  if (fs.existsSync(vendorDir)) {
    fs.cpSync(vendorDir, path.join(DIST, 'vendor'), { recursive: true });
    for (const f of fs.readdirSync(path.join(DIST, 'vendor'))) {
      vendorBytes += fs.statSync(path.join(DIST, 'vendor', f)).size; vendorFiles++;
    }
  }

  // photos 整資料夾複製（含 dz\ 切片子目錄）
  fs.cpSync(path.join(ROOT, 'photos'), path.join(DIST, 'photos'), { recursive: true });
  const walk = (dir) => {
    let n = 0, b = 0;
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) { const r = walk(p); n += r.n; b += r.b; }
      else { n++; b += fs.statSync(p).size; }
    }
    return { n, b };
  };
  const ph = walk(path.join(DIST, 'photos'));
  const nPhotos = ph.n;

  // video 整資料夾複製（hero 雲影片，比照 photos）；不存在就整段跳過，build 不失敗
  let videoBytes = 0, videoFiles = 0;
  const videoDir = path.join(ROOT, 'video');
  if (fs.existsSync(videoDir)) {
    fs.cpSync(videoDir, path.join(DIST, 'video'), { recursive: true });
    const r = walk(path.join(DIST, 'video'));
    videoBytes = r.b; videoFiles = r.n;
  } else {
    console.warn('! 找不到 video\\ —— hero 影片不會進 dist，首頁會停在海報靜圖');
  }

  // 報告
  console.log('dist 產出：');
  let total = 0;
  for (const f of written) {
    const kb = fs.statSync(f).size / 1024;
    total += kb;
    console.log(`  ${String(kb.toFixed(1)).padStart(8)} KB  ${path.relative(DIST, f).replace(/\\/g, '/')}`);
  }
  const photoBytes = ph.b;
  console.log(`  ${String((photoBytes / 1024).toFixed(1)).padStart(8)} KB  photos/ (${nPhotos} 檔，含 dz 切片)`);
  if (vendorFiles) console.log(`  ${String((vendorBytes / 1024).toFixed(1)).padStart(8)} KB  vendor/ (${vendorFiles} 檔，按需載入不計首屏)`);
  if (videoFiles) console.log(`  ${String((videoBytes / 1024).toFixed(1)).padStart(8)} KB  video/ (${videoFiles} 檔，hero 影片，load 之後才拉不計首屏)`);
  console.log(`合計（不含照片）${total.toFixed(1)} KB；含照片 ${((total * 1024 + photoBytes) / 1048576).toFixed(1)} MB`);
  console.log(`SITE_ORIGIN = ${SITE_ORIGIN}`);
}

build().catch((e) => { console.error(e); process.exit(1); });
