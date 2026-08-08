/* =============================================================================
   build-site.js — 攝影作品集靜態站產生器（Node 零依賴）
   讀 data.js（唯一內容來源）＋本檔內部 HTML 模板 → 生成 dist\
   用法： node build-site.js
   ============================================================================= */
'use strict';

const fs = require('fs');
const path = require('path');

// TODO 網域確定後改這一行（canonical / sitemap / robots 都吃它）
const SITE_ORIGIN = 'https://PLACEHOLDER.example';

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const SRC = path.join(ROOT, 'src-site');

// ---------- data.js（用假 window 取出三個常數） ----------
const win = {};
new Function('window', fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8'))(win);
const PHOTOS = win.PHOTOS;
const HERO_SLIDES = win.HERO_SLIDES;
const SECTIONS = win.SECTIONS;

// ---------- helpers ----------
const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const pad = (n, w) => String(n).padStart(w, '0');
const photosFor = (id) => PHOTOS[id === '3d' ? 'three_d' : id];
const slugOf = (id) => id;                       // data.js 的 id 直接當網址片段
const oneLine = (s) => String(s).replace(/\s+/g, ' ').trim();
const clip = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…');

// 導覽列（frosted 與 footer 共用）
const NAV = [
  { key: 'hasselblad', label: 'Hasselblad' },
  { key: 'portraits', label: 'Portraits' },
  { key: 'street', label: 'Street' },
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
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.desc)}">
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
  const items = NAV.map((i) => {
    const cls = i.key === current ? ' class="is-active"' : '';
    return `    <a href="${rel}${slugOf(i.key)}/"${cls}>${esc(i.label)}</a>`;
  }).join('\n');
  return `<div class="frosted" aria-hidden="true">
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
        <span class="zh">洪立楷 · Photography</span>
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
  <small>© 2026 Jerrythepopper · Photography Portfolio</small>
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
  const slides = HERO_SLIDES.map((s, i) =>
    `    <div class="hero-slide${i === 0 ? ' is-active' : ''}" style="background-image:url('${esc(s)}')"></div>`
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
      <span class="en">Jerrythepopper · Photography</span>
    </a>
    <div class="hero-topnav">
      <a href="work/">Work</a>
      <span class="sep">|</span>
      <a href="about/">Contact</a>
    </div>
  </div>

  <div class="hero-title-wrap">
    <div class="hero-eyebrow">
      <span class="h-line"></span><span>Photography portfolio</span><span class="h-line"></span>
    </div>
    <h1 class="hero-title">${chars}</h1>
    <div class="hero-sub">洪 立 楷 ／ 攝 影 作 品</div>
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
  const metas = s.meta.map((m) => `<span>${esc(m)}</span>`).join('');
  return `<section class="section${alt ? ' _alt' : ''}" data-screen-label="${esc(s.number + ' ' + s.en)}">
  <div class="fade-up section-inner${alt ? ' _reverse' : ''}" style="transition-delay:0ms">
    <a href="${slugOf(s.id)}/" class="sec-media" aria-label="${esc(s.en)}">
      <span class="sec-num">No. ${esc(s.number)}</span>
      <img src="${esc(cover)}" alt="${esc(s.en)}" loading="lazy">
    </a>
    <div class="sec-body">
      <div class="eyebrow">
        <span class="n">${esc(s.number)}</span>
        <span class="flow-line in" style="width:40px"></span>
        <span>${esc(s.eyebrow)}</span>
      </div>
      <h2>${esc(s.en)}<span class="jp">${esc(s.zh)}</span></h2>
      <p class="lede">${esc(s.lede)}</p>
      <div class="meta">${metas}</div>
      <a href="${slugOf(s.id)}/" class="cta">View series <span class="arr">→</span></a>
    </div>
  </div>
</section>`;
}

function teaser(o) {
  // o: {label, cls, reverse, href, num, cover, alt, eyebrow, h2en, h2zh, lede, metas, cta}
  return `<section class="section${o.cls}" data-screen-label="${esc(o.label)}">
  <div class="fade-up section-inner${o.reverse ? ' _reverse' : ''}" style="transition-delay:0ms">
    <a href="${o.href}" class="sec-media">
      <span class="sec-num">No. ${o.num}</span>
      <img src="${esc(o.cover)}" alt="${esc(o.alt)}" loading="lazy">
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
    <h1>以影像捕捉人文、街頭與空間的情緒。<br>在孤寂感與時間流動中，找到畫面的重量。</h1>
    <p>Photographer · 3D Creator · Based in Taipei. Brand collaborations with Hasselblad, Leica, Sony, Oppo, Giant, and more.</p>
  </div>
</section>`;

  const main = `<main data-screen-label="01 Home">
${heroBlock()}
${intro}
${SECTIONS.map(categorySection).join('\n')}
${teaser({
    label: '07 Work', cls: ' _alt', reverse: false, href: 'work/', num: '07',
    cover: PHOTOS.hasselblad[7], alt: 'Work', eyebrow: 'Selected · 2023 — 2026',
    h2en: 'Work', h2zh: '工作',
    lede: 'Brand collaborations and editorial projects. Click any tile to view the project on Instagram.',
    metas: ['Hasselblad', 'Leica', 'Sony', 'Oppo', 'Goopi', 'Reto'], cta: 'View work',
  })}
${teaser({
    label: '08 About', cls: '', reverse: true, href: 'about/', num: '08',
    cover: PHOTOS.portraits[5], alt: 'About', eyebrow: 'Photographer · 3D Creator',
    h2en: 'About', h2zh: '關於我',
    lede: 'Jerrythepopper 洪立楷，1996年生於台北。攝影師、3D創作者，Stairs Space 共同經營者。',
    metas: ['Based in Taipei', 'SEVEN / Asia-Pacific'], cta: 'Read more',
  })}
</main>`;

  return shell({
    rel: '', current: 'home', main,
    title: 'Jerrythepopper 洪立楷｜攝影作品集 Photography Portfolio',
    desc: clip(oneLine('以影像捕捉人文、街頭與空間的情緒。攝影師、3D 創作者，Based in Taipei。曾與 Hasselblad、Leica、Sony、Oppo、Giant 等品牌合作。'), 155),
    canonicalPath: '/',
    ogImage: HERO_SLIDES[0],
    jsonld: PERSON_LD,
  });
}

// ---------- 系列頁 ----------
function categoryPage(s, screenLabel) {
  const photos = photosFor(s.id);
  const metas = s.meta.map((m) => `<span>${esc(m)}</span>`).join('');
  const subtitle = s.subtitle
    ? `    <p class="subtitle">${esc(s.subtitle)}</p>\n`
    : '';
  const frames = photos.map((src, i) =>
    `  <button type="button" class="gframe">
    <img src="../${esc(src)}" alt="${esc(s.en + ' ' + (i + 1))}" loading="lazy">
    <div class="caption">
      <span>No. ${pad(i + 1, 3)}</span>
      <span>${esc(s.en)}</span>
    </div>
  </button>`
  ).join('\n');

  const main = `<main class="page" data-screen-label="${esc(screenLabel)}">
  <div class="fade-up page-head" style="transition-delay:0ms">
    <div class="eyebrow">
      <span class="n">${esc(s.number)}</span>
      <span class="flow-line in" style="width:56px"></span>
      <span>${esc(s.eyebrow)}</span>
    </div>
    <h1>${esc(s.en)}<span class="jp">${esc(s.zh)}</span></h1>
${subtitle}    <div class="meta">${metas}</div>
  </div>

<section class="gallery ${s.layout === 'single' ? 'single _wide' : 'masonry-2'}">
${frames}
</section>
</main>`;

  const desc = clip(oneLine(s.subtitle || s.lede), 155);
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
  { url: 'https://www.instagram.com/s/aGlnaGxpZ2h0OjE4MDY2OTM1Njg3MTE5MjI3?story_media_id=3854643749046163614&igsh=MTVqaG9kcG8waDNzMQ==', t: 'Giant Liv', c: '品牌形象動畫', src: 'st_1' },
  { url: 'https://www.instagram.com/s/aGlnaGxpZ2h0OjE4MDY2OTM1Njg3MTE5MjI3?story_media_id=3828514764847548116&igsh=MTVqaG9kcG8waDNzMQ==', t: '新光攝影展講座', c: '攝影展覽講座', src: 'st_4' },
  { url: 'https://www.instagram.com/reel/DJ6w-6ah0QN/?igsh=ZGs3MjFnM3o5NTdz', t: 'Reto 相機', c: '產品動畫製作', src: 'td_0' },
  { url: 'https://www.instagram.com/p/Cl3lNf9h8cm/?igsh=MTlqcXhudWUyZHBvag==', t: 'TEDxChungChengU', c: '品牌演講活動', src: 'pt_2' },
  { url: 'https://www.instagram.com/s/aGlnaGxpZ2h0OjE4MDAwMDA1OTA5NTk3Mjcz?story_media_id=3542991936099659472&igsh=MXhhZnRoamoxc2QxZw==', t: 'Sony YouTube', c: '品牌影片內容', src: 'st_7' },
  { url: 'https://www.instagram.com/reel/ChZUvNkpnS8/?igsh=c2l3cWZnc2VraXBq', t: 'Yotta 底片課程', c: '線上攝影課程', src: 'fm_2' },
  { url: 'https://www.instagram.com/p/C1GslZYBrSX/?img_index=1&igsh=MXdoNmE0eGNmNWo1cA==', t: '晶悅建設', c: '品牌形象拍攝', src: 'hb_7' },
  { url: 'https://www.instagram.com/s/aGlnaGxpZ2h0OjE4MDAwMDA1OTA5NTk3Mjcz?story_media_id=3239957459305757128&igsh=MXhhZnRoamoxc2QxZw==', t: '仁發建設', c: '品牌形象拍攝', src: 'hb_10' },
];

const PREFIX2CAT = { pt: 'portraits', hb: 'hasselblad', st: 'street', td: 'three_d', fm: 'film', mk: 'market' };

function workPage() {
  const tiles = WORK_TILES.map((w) => {
    const [p, n] = w.src.split('_');
    const photoSrc = PHOTOS[PREFIX2CAT[p] || 'market'][parseInt(n, 10)];
    return `  <a href="${esc(w.url)}" target="_blank" rel="noopener noreferrer" class="work-tile">
    <div class="ph" style="background-image:url('../${esc(photoSrc)}')"></div>
    <div class="ig">Instagram ↗</div>
    <div class="meta">
      <div class="t">${esc(w.t)}</div>
      <div class="c">${esc(w.c)}</div>
    </div>
  </a>`;
  }).join('\n');

  const desc = clip(oneLine('Brand collaborations and editorial projects — 品牌合作與商業工作。Hasselblad、Leica、Sony、Oppo、Goopi、Reto，2020 — 2026。'), 155);

  const main = `<main class="page" data-screen-label="07 Work">
  <div class="fade-up page-head" style="transition-delay:0ms">
    <div class="eyebrow">
      <span class="n">07</span>
      <span class="flow-line in" style="width:56px"></span>
      <span>Selected · 2023 — 2026</span>
    </div>
    <h1>Work<span class="jp">工作</span></h1>
    <p class="subtitle">Brand collaborations and editorial projects. Click any tile to view the project on Instagram.
品牌合作與商業工作。點擊任一方塊在 Instagram 上查看專案。</p>
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
  const main = `<main class="page" data-screen-label="08 About">
  <div class="fade-up page-head" style="transition-delay:0ms">
    <div class="eyebrow">
      <span class="n">08</span>
      <span class="flow-line in" style="width:56px"></span>
      <span>Photographer · 3D Creator</span>
    </div>
    <h1>About<span class="jp">關於我</span></h1>
  </div>

<section class="fade-up about-wrap" style="transition-delay:0ms">
  <div class="about-portrait" style="background-image:url('../${esc(PHOTOS.portraits[3])}')"></div>
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
      <div class="stat"><div class="num">50+</div><div class="lab">Brands</div></div>
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
  return `# Jerrythepopper 洪立楷 — Photography Portfolio

> 攝影師、3D 創作者，1996 年生於台北。以影像捕捉人文、街頭與空間的情緒；曾與 Hasselblad、Leica、Sony、Oppo、Giant 等品牌合作。紀實計畫《輪轉》記錄台北第一果菜批發市場。

## Pages

- [首頁 Home](${SITE_ORIGIN}/)：作品集總覽，六個系列與工作、關於。
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
    '3d': '05 3D', film: '06 Film', market: '07 Market',
  };
  for (const s of SECTIONS) {
    written.push(write(`${slugOf(s.id)}/index.html`, categoryPage(s, labels[s.id])));
  }
  written.push(write('work/index.html', workPage()));
  written.push(write('about/index.html', aboutPage()));

  // styles.css = 既有檔原樣 + build 補丁段（不改既有規則）
  const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8') +
    '\n' + fs.readFileSync(path.join(SRC, 'patch.css'), 'utf8');
  written.push(write('styles.css', css));

  // site.js
  written.push(write('site.js', fs.readFileSync(path.join(SRC, 'site.js'), 'utf8')));

  // 附屬檔
  written.push(write('robots.txt', robotsTxt()));
  written.push(write('sitemap.xml', sitemapXml()));
  written.push(write('llms.txt', llmsTxt()));

  // photos 整資料夾複製
  fs.cpSync(path.join(ROOT, 'photos'), path.join(DIST, 'photos'), { recursive: true });
  const nPhotos = fs.readdirSync(path.join(DIST, 'photos')).length;

  // 報告
  console.log('dist 產出：');
  let total = 0;
  for (const f of written) {
    const kb = fs.statSync(f).size / 1024;
    total += kb;
    console.log(`  ${String(kb.toFixed(1)).padStart(8)} KB  ${path.relative(DIST, f).replace(/\\/g, '/')}`);
  }
  let photoBytes = 0;
  for (const f of fs.readdirSync(path.join(DIST, 'photos'))) {
    photoBytes += fs.statSync(path.join(DIST, 'photos', f)).size;
  }
  console.log(`  ${String((photoBytes / 1024).toFixed(1)).padStart(8)} KB  photos/ (${nPhotos} 檔)`);
  console.log(`合計（不含照片）${total.toFixed(1)} KB；含照片 ${((total * 1024 + photoBytes) / 1048576).toFixed(1)} MB`);
  console.log(`SITE_ORIGIN = ${SITE_ORIGIN}  ← TODO 網域確定後改 build-site.js 頂部`);
}

build();
