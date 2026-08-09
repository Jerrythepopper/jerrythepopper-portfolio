/* =============================================================================
   build-site.js — 攝影作品集靜態站產生器（Node 零依賴）
   讀 data.js（唯一內容來源）＋本檔內部 HTML 模板 → 生成 dist\
   用法： node build-site.js
   ============================================================================= */
'use strict';

const fs = require('fs');
const path = require('path');

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
const SECTIONS = win.SECTIONS;
const DEEPZOOM = win.DEEPZOOM || {};

// ---------- photos-manifest.json（ingest-photos.js 產出的高畫質總表） ----------
// 有條目 → 走 <picture>（AVIF/WebP × 多尺寸 ＋ LQIP blur-up）
// 無條目 → 退回單 src 舊路徑（結構上保留零回歸分支，手放進 photos\ 的圖照樣能用）
const MANIFEST = (() => {
  const p = path.join(ROOT, 'photos-manifest.json');
  if (!fs.existsSync(p)) { console.warn('! 找不到 photos-manifest.json，全站退回單 src 舊路徑'); return {}; }
  try { return (JSON.parse(fs.readFileSync(p, 'utf8')).photos) || {}; }
  catch (e) { console.warn('! photos-manifest.json 解析失敗：' + e.message); return {}; }
})();

// ---------- helpers ----------
const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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

const mKey = (src) => {
  const m = /^photos\/([^/]+?)\.(avif|webp|jpe?g|png)$/i.exec(String(src));
  return m ? m[1] : null;
};
const mEntry = (src) => { const k = mKey(src); return (k && MANIFEST[k]) || null; };
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

// 導覽列（frosted 與 footer 共用）
const NAV = [
  { key: 'hasselblad', label: 'Hasselblad' },
  { key: 'portraits', label: 'Portraits' },
  { key: 'street', label: 'Street' },
  { key: 'nature', label: 'Nature' },
  { key: '3d', label: '3D' },
  { key: 'film', label: 'Film' },
  { key: 'market', label: '果菜市場' },
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
  sameAs: ['https://www.instagram.com/jerrythepopper'],
};

// ---------- 共用片段 ----------
function head(o) {
  // o: {title, desc, canonicalPath, ogImage, jsonld, rel}
  const canonical = SITE_ORIGIN + o.canonicalPath;
  const ld = JSON.stringify(o.jsonld, null, 2).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>document.documentElement.className+=' js'</script>
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.desc)}">
${o.robots ? `<meta name="robots" content="noindex">\n` : ''}
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Jerrythepopper Photography">
<meta property="og:locale" content="zh_TW">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.desc)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(o.rel + o.ogImage)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(o.title)}">
<meta name="twitter:description" content="${esc(o.desc)}">
<meta name="twitter:image" content="${esc(o.rel + o.ogImage)}">
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

function frosted(rel, current) {
  // 子頁（非首頁）常駐顯示：分享連結直達時第一屏就有站名與返回路徑（P1-1）
  // is-static 寫在 class 裡而非靠 JS，無 JS 環境一樣看得到
  const always = current !== 'home';
  const items = NAV.map((i) => {
    const cls = i.key === current ? ' class="is-active"' : '';
    const cur = i.key === current ? ' aria-current="page"' : '';
    return `    <a href="${rel}${slugOf(i.key)}/"${cls}${cur}>${esc(i.label)}</a>`;
  }).join('\n');
  return `<div class="frosted${always ? ' is-static' : ''}" aria-hidden="${always ? 'false' : 'true'}"${always ? ' data-always="1"' : ''}>
  <a href="${rel || './'}" class="brand">Jerrythepopper</a>
  <nav aria-label="Sticky">
${items}
  </nav>
</div>`;
}

function footer(rel) {
  const series = SECTIONS.map((s) =>
    `      <li><a href="${rel}${slugOf(s.id)}/">${esc(s.en === 'Taipei Wholesale Market' ? '果菜市場 輪轉' : s.en + ' ' + s.zh)}</a></li>`
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
        <li><a href="${rel}work/">Work 工作</a></li>
        <li><a href="${rel}about/">About 關於我</a></li>
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

function shell(o) {
  return head(o) + '\n' + frosted(o.rel, o.current) + '\n' + o.main + '\n' + footer(o.rel) + '\n' + tail(o.rel);
}

// ---------- 首頁 ----------
function heroBlock() {
  // 第 1 張＝首屏 LCP，eager＋high priority；第 2 張起延後到首屏之後才載
  // （8 張全在視窗內，loading="lazy" 對它們無效，只能由 site.js 主動補載）
  const slides = HERO_SLIDES.map((s, i) =>
    `    <div class="hero-slide${i === 0 ? ' is-active' : ''}" style="${lqipBg(s)}">` +
    pictureTag(s, '', {
      alt: '', sizes: SIZES.hero, cls: 'hero-img',
      priority: i === 0, loading: i === 0 ? false : 'eager', deferred: i > 0,
    }) + '</div>'
  ).join('\n');
  const chars = [...'Jerrythepopper'].map((ch, i) =>
    `<span class="ch" style="animation-delay:${600 + i * 50}ms">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`
  ).join('');
  const dots = HERO_SLIDES.map((_, i) =>
    `    <button type="button"${i === 0 ? ' class="is-active"' : ''} aria-label="Slide ${i + 1}"></button>`
  ).join('\n');
  return `<section class="hero" data-screen-label="00 Hero">
  <div class="hero-mv" aria-hidden="true">
${slides}
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
  </div>

  <div class="hero-title-wrap">
    <div class="hero-eyebrow">
      <span class="h-line"></span><span>Photography · 3D</span><span class="h-line"></span>
    </div>
    <h1 class="hero-title">${chars}</h1>
    <div class="hero-sub">洪 立 楷 ／ 影 像 作 品</div>
  </div>

  <div class="hero-dots">
${dots}
  </div>

  <div class="hero-hint" aria-hidden="true">
    <span>Scroll</span>
    <div class="line"></div>
  </div>
</section>`;
}

function categorySection(s, index) {
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
      ${pictureTag(cover, '', { alt: s.en, sizes: SIZES.section })}
    </a>
    <div class="sec-body">
      <div class="eyebrow">
        <span class="n">${esc(s.number)}</span>
        <span class="flow-line in" style="width:40px"></span>
        <span>${esc(s.eyebrow)}</span>
      </div>
      <h2>${esc(s.en)}<span class="jp">${esc(s.zh)}</span></h2>
      <p class="lede">${esc(s.lede)}</p>
${metaBlock}      <a href="${slugOf(s.id)}/" class="cta">View series <span class="arr">→</span></a>
    </div>
  </div>
</section>`;
}

function teaser(o) {
  // o: {label, cls, reverse, href, num, cover, alt, eyebrow, h2en, h2zh, lede, metas, cta}
  return `<section class="section${o.cls}" data-screen-label="${esc(o.label)}">
  <div class="fade-up section-inner${o.reverse ? ' _reverse' : ''}" style="transition-delay:0ms">
    <a href="${o.href}" class="sec-media" style="${lqipBg(o.cover)}">
      <span class="sec-num">No. ${o.num}</span>
      ${pictureTag(o.cover, '', { alt: o.alt, sizes: SIZES.section })}
    </a>
    <div class="sec-body">
      <div class="eyebrow">
        <span class="n">${o.num}</span>
        <span class="flow-line in" style="width:40px"></span>
        <span>${esc(o.eyebrow)}</span>
      </div>
      <h2>${esc(o.h2en)}<span class="jp">${esc(o.h2zh)}</span></h2>
      <p class="lede">${esc(o.lede)}</p>
      <div class="meta">${o.metas.map((m) => `<span>${esc(m)}</span>`).join('')}</div>
      <a href="${o.href}" class="cta">${esc(o.cta)} <span class="arr">→</span></a>
    </div>
  </div>
</section>`;
}

function homePage() {
  const intro = `<section class="intro">
  <div class="fade-up intro-inner" style="transition-delay:0ms">
    <div class="eyebrow">Selected · 2018 — 2026</div>
    <p class="intro-lede">以影像捕捉人文、街頭與空間的情緒。<br>在孤寂感與時間流動中，找到畫面的重量。</p>
    <p>Photographer · 3D Creator · Based in Taipei. Brand collaborations with Hasselblad, Leica, Sony, Oppo, Giant, and more.</p>
  </div>
</section>`;

  const main = `<main data-screen-label="01 Home">
${heroBlock()}
${intro}
${SECTIONS.map(categorySection).join('\n')}
${teaser({
    label: '08 Work', cls: ' _alt', reverse: false, href: 'work/', num: '08',
    cover: PHOTOS.hasselblad[7], alt: 'Work', eyebrow: 'Selected · 2023 — 2026',
    h2en: 'Work', h2zh: '工作',
    lede: 'Brand collaborations and editorial projects. Click any tile to view the project.',
    metas: ['Hasselblad', 'Leica', 'Sony', 'Oppo', 'Goopi', 'Reto'], cta: 'View work',
  })}
${teaser({
    label: '09 About', cls: '', reverse: true, href: 'about/', num: '09',
    cover: PHOTOS.portraits[5], alt: 'About', eyebrow: 'Photographer · 3D Creator',
    h2en: 'About', h2zh: '關於我',
    lede: 'Jerrythepopper 洪立楷，1996年生於台北。攝影師、3D創作者，Stairs Space 共同經營者。',
    metas: ['Based in Taipei', 'SEVEN / Asia-Pacific'], cta: 'Read more',
  })}
</main>`;

  return shell({
    rel: '', current: 'home', main,
    title: 'Jerrythepopper 洪立楷｜攝影 × 3D 作品集 Photography & 3D Portfolio',
    desc: clip(oneLine('以影像捕捉人文、街頭與空間的情緒。攝影師、3D 創作者，Based in Taipei。曾與 Hasselblad、Leica、Sony、Oppo、Giant 等品牌合作。'), 155),
    canonicalPath: '/',
    ogImage: HERO_SLIDES[0],
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
    <span class="next-title">${esc(nx.en)}<span class="jp">${esc(nx.zh)}</span><span class="arr" aria-hidden="true">→</span></span>
  </a>
</section>`;
}

function categoryPage(s, screenLabel) {
  const photos = photosFor(s.id);
  // subtitle / meta 皆可留空（文案未定的系列）：空的就不渲染該塊，不留空殼 DOM
  const subtitle = s.subtitle
    ? `    <p class="subtitle">${esc(s.subtitle)}</p>\n`
    : '';
  const metaBlock = s.meta.length
    ? `    <div class="meta">${s.meta.map((m) => `<span>${esc(m)}</span>`).join('')}</div>\n`
    : '';
  // Deep Zoom：本系列有登記切片的張數，磚上掛角標＋data-dzi（site.js 開專用 viewer）
  const dzList = DEEPZOOM[s.id] || [];
  const dzFor = (i) => dzList.find((d) => d.idx === i);

  const wide = s.layout === 'single';
  const frames = photos.map((src, i) => {
    const dz = dzFor(i);
    const dzAttr = dz
      ? ` data-dzi="../${esc(dz.dzi)}" data-dz-label="${esc(dz.label || '')}"` +
        ` data-osd="../vendor/openseadragon.min.js"` +
        ` aria-label="${esc(s.en + ' ' + (i + 1) + '，開啟 Deep Zoom 檢視器')}"`
      : '';
    const badge = dz ? `\n    <span class="dz-badge"><span class="dot" aria-hidden="true"></span>Deep Zoom</span>` : '';
    return `  <button type="button" class="gframe${dz ? ' has-dz' : ''}" style="${lqipBg(src)}"${fullAttrs(src, '../')}${dzAttr}>
    ${pictureTag(src, '../', { alt: s.en + ' ' + (i + 1), sizes: wide ? SIZES.single : SIZES.masonry })}${badge}
  </button>`;
  }).join('\n');

  const main = `<main class="page" data-screen-label="${esc(screenLabel)}">
  <div class="fade-up page-head" style="transition-delay:0ms">
    <div class="eyebrow">
      <span class="n">${esc(s.number)}</span>
      <span class="flow-line in" style="width:56px"></span>
      <span>${esc(s.eyebrow)}</span>
    </div>
    <h1>${esc(s.en)}<span class="jp">${esc(s.zh)}</span></h1>
${subtitle}${metaBlock}  </div>

<section class="gallery ${s.layout === 'single' ? 'single _wide' : 'masonry-2'}">
${frames}
</section>

${nextSeriesBlock(s)}
</main>`;

  // nature 頁改用專屬 SEO description（英文開場句 + 定稿中文前 60 字），非套用預設 subtitle/lede 生成規則
  const desc = s.id === 'nature'
    ? 'Tall clouds, open sea, old trees, mountains. I try to keep a record of how they look. ' + s.subtitle.slice(0, 60)
    : clip(oneLine(s.subtitle || s.lede), 155);
  return shell({
    rel: '../', current: s.id, main,
    title: `${s.en} ${s.zh}｜Jerrythepopper Photography`,
    desc,
    canonicalPath: `/${slugOf(s.id)}/`,
    ogImage: photos[s.coverIdx],
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'ImageGallery',
      name: `${s.en} ${s.zh}`,
      description: desc,
      url: `${SITE_ORIGIN}/${slugOf(s.id)}/`,
      author: PERSON_LD,
      numberOfItems: photos.length,
    },
  });
}

// ---------- Work ----------
const WORK_TILES = [
  { url: 'https://www.instagram.com/p/DYRy7e2meZS/?igsh=MWIzdTU0NjZuN2FzdA==', t: 'OPPO Find X9 Ultra', c: '品牌形象拍攝', src: 'pt_1' },
  { url: 'https://www.instagram.com/p/DUDZPGbE53K/?igsh=MTAxYnQ3Mzd2Z2czag==', t: 'Hasselblad × Jerry', c: '品牌合作計畫', src: 'hb_0' },
  { url: 'https://www.instagram.com/reel/DCB6M24IH6T/?igsh=MW11YTU4eGk5b2p2dA==', t: 'Goopi 2024', c: '品牌形象動畫', src: 'pt_6' },
  { url: 'https://www.instagram.com/p/DTurh4DkX3V/?igsh=MXY2MDFqNGY3YW1nbQ==', t: 'GIANT', c: '品牌形象動畫', src: 'hb_3' },
  { url: 'https://www.instagram.com/p/CygDcVGSBuS/?igsh=bThtcnozbnFmeTMw', t: 'Goopi 2023', c: '品牌形象合作', src: 'pt_8' },
  { url: 'https://www.instagram.com/p/DVhoPFdmned/', t: 'Giant Liv', c: '品牌形象動畫', src: 'st_1' },
  { url: 'https://www.instagram.com/p/DWoPExxmdXd/?img_index=2', t: '新光攝影展講座', c: '攝影展覽講座', src: 'st_4' },
  { url: 'https://www.instagram.com/p/CjK7UdTJl36/?img_index=1', t: 'Rolls-Royce', c: '品牌形象拍攝', src: 'st_10' },
  { url: 'https://www.instagram.com/reel/DJ6w-6ah0QN/?igsh=ZGs3MjFnM3o5NTdz', t: 'Reto 相機', c: '產品動畫製作', src: 'td_0' },
  { url: 'https://www.instagram.com/p/Cl3lNf9h8cm/?igsh=MTlqcXhudWUyZHBvag==', t: 'TEDxChungChengU', c: '品牌演講活動', src: 'pt_2' },
  { url: 'https://www.youtube.com/watch?v=S7ng0s7i1FE', t: 'Sony YouTube', c: '品牌影片內容', src: 'st_7' },
  { url: 'https://www.yottau.com.tw/course/intro/1421#intro', t: 'Yotta 底片課程', c: '線上攝影課程', src: 'fm_2' },
  { url: 'https://www.instagram.com/p/C1GslZYBrSX/?img_index=1&igsh=MXdoNmE0eGNmNWo1cA==', t: '晶悅建設', c: '品牌形象拍攝', src: 'hb_7' },
  { url: 'https://www.instagram.com/s/aGlnaGxpZ2h0OjE4MDAwMDA1OTA5NTk3Mjcz?story_media_id=3239957459305757128&igsh=MXhhZnRoamoxc2QxZw==', t: '仁發建設', c: '品牌形象拍攝', src: 'hb_10' },
];

const PREFIX2CAT = { pt: 'portraits', hb: 'hasselblad', st: 'street', na: 'nature', td: 'three_d', fm: 'film', mk: 'market' };

function workPage() {
  const tiles = WORK_TILES.map((w) => {
    const [p, n] = w.src.split('_');
    const photoSrc = PHOTOS[PREFIX2CAT[p] || 'market'][parseInt(n, 10)];
    const linkLabel = w.url.includes('youtube.com') ? 'YouTube' : w.url.includes('yottau.com') ? 'YottaU' : 'Instagram';
    return `  <a href="${esc(w.url)}" target="_blank" rel="noopener noreferrer" class="work-tile">
    <div class="ph" style="${bgImage(photoSrc, '../')}"></div>
    <div class="ig">${linkLabel} ↗</div>
    <div class="meta">
      <div class="t">${esc(w.t)}</div>
      <div class="c">${esc(w.c)}</div>
    </div>
  </a>`;
  }).join('\n');

  const desc = clip(oneLine('Brand collaborations and editorial projects — 品牌合作與商業工作。Hasselblad、Leica、Sony、Oppo、Goopi、Reto，2020 — 2026。'), 155);

  const main = `<main class="page" data-screen-label="09 Work">
  <div class="fade-up page-head" style="transition-delay:0ms">
    <div class="eyebrow">
      <span class="n">08</span>
      <span class="flow-line in" style="width:56px"></span>
      <span>Selected · 2023 — 2026</span>
    </div>
    <h1>Work<span class="jp">工作</span></h1>
    <p class="subtitle">Brand collaborations and editorial projects. Click any tile to view the project.
品牌合作與商業工作。點擊任一方塊查看專案。</p>
    <div class="meta"><span>HASSELBLAD</span><span>LEICA</span><span>SONY</span><span>OPPO</span><span>GOOPI</span><span>RETO</span><span>2020 — 2026</span></div>
  </div>

<section class="fade-up work-featured" style="transition-delay:0ms;--bg-1:url('../${esc(PHOTOS.hasselblad[0])}');--bg-2:url('../${esc(PHOTOS.portraits[0])}')">
  <a href="https://www.instagram.com/s/aGlnaGxpZ2h0OjE4MDY2OTM1Njg3MTE5MjI3?igsh=MTVqaG9kcG8waDNzMQ==" target="_blank" rel="noopener noreferrer">
    <div class="ft-title">Selected Works Vol.1</div>
    <div class="ft-sub">品牌合作與創作精選</div>
  </a>
  <a href="https://www.instagram.com/s/aGlnaGxpZ2h0OjE4MDAwMDA1OTA5NTk3Mjcz?igsh=MXhhZnRoamoxc2QxZw==" target="_blank" rel="noopener noreferrer">
    <div class="ft-title">Selected Works Vol.2</div>
    <div class="ft-sub">品牌合作與創作精選</div>
  </a>
</section>

<section class="fade-up work-grid" style="transition-delay:0ms">
${tiles}
  <div class="work-tile nophoto">
    <div>
      <div class="t">Leica</div>
      <div class="c">攝影教學講師</div>
    </div>
  </div>
</section>
</main>`;

  return shell({
    rel: '../', current: 'work', main,
    title: 'Work 工作｜Jerrythepopper Photography',
    desc,
    canonicalPath: '/work/',
    ogImage: PHOTOS.hasselblad[0],
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Work 工作',
      description: desc,
      url: `${SITE_ORIGIN}/work/`,
      author: PERSON_LD,
    },
  });
}

// ---------- About ----------
function aboutPage() {
  const desc = clip(oneLine('Jerrythepopper 洪立楷，1996年生於台北。攝影師、3D創作者，Stairs Space 共同經營者。以影像捕捉人文、街頭與空間的情緒。'), 155);
  const main = `<main class="page" data-screen-label="10 About">
  <div class="fade-up page-head" style="transition-delay:0ms">
    <div class="eyebrow">
      <span class="n">09</span>
      <span class="flow-line in" style="width:56px"></span>
      <span>Photographer · 3D Creator</span>
    </div>
    <h1>About<span class="jp">關於我</span></h1>
  </div>

<section class="fade-up about-wrap" style="transition-delay:0ms">
  <div class="about-portrait" style="${bgImage(PHOTOS.portraits[3], '../')}"></div>
  <div class="about-body">
    <h2>Jerrythepopper 洪立楷</h2>
    <div class="role">Photographer · 3D Creator · Based in Taipei</div>

    <p>1996年生於台北。攝影師、3D創作者，Stairs Space 共同經營者。</p>
    <p>以影像捕捉人文、街頭與空間的情緒，擅長在孤寂感與時間流動中找到畫面的重量。除了攝影，也持續探索3D視覺與虛實場景的交錯，嘗試讓靜態影像走向更立體的敘事。</p>
    <p>曾與 Hasselblad、Leica、Sony、Oppo、Giant、新光攝影展、朱銘美術館、蝦皮等品牌合作，執行形象拍攝、教學內容與創意企劃。紀實計畫《輪轉》記錄台北第一果菜批發市場的人與故事，歷時一年多，最終透過募資出版攝影集。</p>

    <h3>可以一起做的事</h3>
    <ul>
      <li>攝影｜品牌形象・人像・街拍・空間・活動紀錄・人文紀實</li>
      <li>3D創作｜場景設計・視覺概念・虛實結合</li>
      <li>創意企劃｜影像敘事・品牌合作・空間裝置</li>
      <li>影像教育｜攝影教學・課程製作</li>
    </ul>

    <h3>合作品牌</h3>
    <div class="brands">
      <p><b>相機品牌</b>Hasselblad、Leica Camera Taiwan、Sony、Oppo、Reto</p>
      <p><b>建築 / 商業</b>名發建設、三發建設、晶悅建設、臺北農產運銷公司、捷安特</p>
      <p><b>文化 / 藝術</b>朱銘美術館、孤僻Goopi</p>
      <p><b>商業平台</b>蝦皮</p>
    </div>

    <h3>展覽・出版・課程</h3>
    <ul>
      <li>《輪轉》攝影集出版與攝影展（台北第一果菜市場紀實計畫）</li>
      <li>底片攝影線上課程（與線上課程平台合作）</li>
      <li>Sony × Jerrythepopper 教學影片（YouTube 街拍教學）</li>
    </ul>

    <div class="stats">
      <div class="stat"><div class="num">12</div><div class="lab">Years shooting</div></div>
      <div class="stat"><div class="num">30+</div><div class="lab">Brands</div></div>
      <div class="stat"><div class="num">3</div><div class="lab">Solo shows</div></div>
    </div>

    <div class="contact">
      <div><b>Email</b><span>jerrythepopper@gmail.com</span></div>
      <div><b>Instagram</b><span>@jerrythepopper</span></div>
      <div><b>Representation</b><span>SEVEN / Asia-Pacific</span></div>
    </div>
  </div>
</section>
</main>`;

  return shell({
    rel: '../', current: 'about', main,
    title: 'About 關於我｜Jerrythepopper Photography',
    desc,
    canonicalPath: '/about/',
    ogImage: PHOTOS.portraits[3],
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
  const desc = '沒有這個頁面。回首頁看看更多攝影作品。';
  const main = `<main class="page notfound-page" data-screen-label="404 Not Found">
  <div class="fade-up notfound-wrap" style="transition-delay:0ms">
    <div class="notfound-eyebrow">
      <span class="flow-line in" style="width:40px"></span>
      <span>404</span>
    </div>
    <div class="notfound-icon">${cloudIcon()}</div>
    <h1>哇你怎麼跑到這裡？！</h1>
    <p>沒有這頁面餒。</p>
    <a href="./" class="cta">回首頁 <span class="arr">→</span></a>
  </div>
</main>`;

  return shell({
    rel: '', current: '404', main,
    title: '404 找不到頁面｜Jerrythepopper Photography',
    desc,
    canonicalPath: '/404.html',
    ogImage: HERO_SLIDES[0],
    robots: true,
    jsonld: PERSON_LD,
  });
}

// ---------- 附屬檔 ----------
const PAGE_URLS = ['/', ...SECTIONS.map((s) => `/${slugOf(s.id)}/`), '/work/', '/about/'];

function sitemapXml() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = PAGE_URLS.map((u) =>
    `  <url>\n    <loc>${SITE_ORIGIN}${u}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>${u === '/' ? '1.0' : '0.8'}</priority>\n  </url>`
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
    `- [${s.en} ${s.zh}](${SITE_ORIGIN}/${slugOf(s.id)}/)：${oneLine(s.lede)}`
  );
  return `# Jerrythepopper 洪立楷 — Photography & 3D Portfolio

> 攝影師、3D 創作者，1996 年生於台北。以影像捕捉人文、街頭與空間的情緒；曾與 Hasselblad、Leica、Sony、Oppo、Giant 等品牌合作。紀實計畫《輪轉》記錄台北第一果菜批發市場。

## Pages

- [首頁 Home](${SITE_ORIGIN}/)：作品集總覽，七個系列與工作、關於。
${lines.join('\n')}
- [Work 工作](${SITE_ORIGIN}/work/)：品牌合作與商業專案。
- [About 關於我](${SITE_ORIGIN}/about/)：簡介、合作品牌、展覽出版與聯絡方式。

## Contact

- Email: jerrythepopper@gmail.com
- Instagram: https://www.instagram.com/jerrythepopper
`;
}

// ---------- build ----------
function write(rel, content) {
  const file = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
  return file;
}

function build() {
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
  console.log(`合計（不含照片）${total.toFixed(1)} KB；含照片 ${((total * 1024 + photoBytes) / 1048576).toFixed(1)} MB`);
  console.log(`SITE_ORIGIN = ${SITE_ORIGIN}`);
}

build();
