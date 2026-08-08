/* global React, ReactDOM */
const { useState, useEffect, useRef, useCallback, useMemo } = React;

// ---------- Hooks ----------
function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash || '#/');
  useEffect(() => {
    const onChange = () => {
      setHash(window.location.hash || '#/');
      window.scrollTo({ top: 0, behavior: 'instant' });
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

function useInview(ref, opts = {}) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    if (seen) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setSeen(true);
      },
      { threshold: 0.18, ...opts }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [ref, seen, opts]);
  return seen;
}

function FadeIn({ as: Tag = 'div', delay = 0, className = '', children, ...props }) {
  const ref = useRef(null);
  const inview = useInview(ref);
  return (
    <Tag
      ref={ref}
      className={`fade-up ${inview ? 'in' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms`, ...(props.style || {}) }}
      {...props}
    >
      {children}
    </Tag>
  );
}

// ---------- Lightbox ----------
const LightboxCtx = React.createContext(() => {});

function Lightbox({ open, photos, index, onClose, onPrev, onNext }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose, onPrev, onNext]);
  if (!open) return null;
  const src = photos[index];
  return (
    <div className="lb" onClick={onClose}>
      <button className="lb-btn lb-close" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Close">✕</button>
      <button className="lb-btn lb-prev" onClick={(e) => { e.stopPropagation(); onPrev(); }} aria-label="Previous">‹</button>
      <button className="lb-btn lb-next" onClick={(e) => { e.stopPropagation(); onNext(); }} aria-label="Next">›</button>
      <div className="lb-stage" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt="" />
        <div className="lb-counter">{String(index + 1).padStart(2, '0')} ／ {String(photos.length).padStart(2, '0')}</div>
      </div>
    </div>
  );
}

// ---------- Hero ----------
function Hero() {
  const slides = window.HERO_SLIDES;
  const [active, setActive] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [slides.length]);

  const splitChars = (text) =>
    [...text].map((ch, i) => (
      <span key={i} className="ch" style={{ animationDelay: `${600 + i * 50}ms` }}>
        {ch === ' ' ? '\u00A0' : ch}
      </span>
    ));

  return (
    <section className="hero" data-screen-label="00 Hero">
      <div className="hero-mv" aria-hidden="true">
        {slides.map((s, i) => (
          <div key={i} className={`hero-slide ${i === active ? 'is-active' : ''}`}
               style={{ backgroundImage: `url("${s}")` }} />
        ))}
      </div>

      <div className="hero-chrome">
        <a href="#/" className="hero-wordmark">
          <span className="en">Jerrythepopper · Photography</span>
        </a>
        <div className="hero-topnav">
          <a href="#/work">Work</a>
          <span className="sep">|</span>
          <a href="#/about">Contact</a>
        </div>
      </div>

      <div className="hero-title-wrap">
        <div className="hero-eyebrow">
          <span className="h-line" /><span>Photography portfolio</span><span className="h-line" />
        </div>
        <h1 className="hero-title">{splitChars('Jerrythepopper')}</h1>
        <div className="hero-sub">洪 立 楷 ／ 攝 影 作 品</div>
      </div>

      <div className="hero-dots">
        {slides.map((_, i) => (
          <button key={i} className={i === active ? 'is-active' : ''}
                  onClick={() => setActive(i)} aria-label={`Slide ${i + 1}`} />
        ))}
      </div>

      <div className="hero-hint" aria-hidden="true">
        <span>Scroll</span>
        <div className="line" />
      </div>
    </section>
  );
}

// ---------- Frosted nav ----------
function FrostedNav({ current }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > Math.min(window.innerHeight * 0.55, 480));
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const items = [
    { id: 'hb',    label: 'Hasselblad', hash: '#/hasselblad' },
    { id: 'pt',    label: 'Portraits',  hash: '#/portraits' },
    { id: 'st',    label: 'Street',     hash: '#/street' },
    { id: '3d',    label: '3D',         hash: '#/3d' },
    { id: 'film',  label: 'Film',       hash: '#/film' },
    { id: 'mk',    label: '果菜市場',    hash: '#/market' },
    { id: 'work',  label: 'Work',       hash: '#/work' },
    { id: 'about', label: 'About',      hash: '#/about' },
  ];

  return (
    <div className={`frosted ${visible ? 'visible' : ''}`} aria-hidden={!visible}>
      <a href="#/" className="brand">Jerrythepopper</a>
      <nav aria-label="Sticky">
        {items.map((i) => (
          <a key={i.id} href={i.hash} className={current === i.id ? 'is-active' : ''}>{i.label}</a>
        ))}
      </nav>
    </div>
  );
}

// ---------- Home intro ----------
function HomeIntro() {
  return (
    <section className="intro">
      <FadeIn className="intro-inner">
        <div className="eyebrow">Selected · 2018 — 2026</div>
        <h1>以影像捕捉人文、街頭與空間的情緒。<br/>在孤寂感與時間流動中，找到畫面的重量。</h1>
        <p>Photographer · 3D Creator · Based in Taipei. Brand collaborations with Hasselblad, Leica, Sony, Oppo, Giant, and more.</p>
      </FadeIn>
    </section>
  );
}

// ---------- Home category section ----------
function CategorySection({ s, index }) {
  const reverse = index % 2 === 1;
  const alt = index % 2 === 1;
  const cover = window.PHOTOS[s.id === '3d' ? 'three_d' : s.id][s.coverIdx];

  return (
    <section className={`section ${alt ? '_alt' : ''}`} data-screen-label={`${s.number} ${s.en}`}>
      <FadeIn className={`section-inner ${reverse ? '_reverse' : ''}`}>
        <a href={s.hash} className="sec-media" aria-label={s.en}>
          <span className="sec-num">No. {s.number}</span>
          <img src={cover} alt={s.en} loading="lazy" />
        </a>
        <div className="sec-body">
          <div className="eyebrow">
            <span className="n">{s.number}</span>
            <span className="flow-line in" style={{ width: 40 }} />
            <span>{s.eyebrow}</span>
          </div>
          <h2>{s.en}<span className="jp">{s.zh}</span></h2>
          <p className="lede">{s.lede}</p>
          <div className="meta">
            {s.meta.map((m, i) => <span key={i}>{m}</span>)}
          </div>
          <a href={s.hash} className="cta">View series <span className="arr">→</span></a>
        </div>
      </FadeIn>
    </section>
  );
}

// ---------- Home work teaser ----------
function HomeWorkTeaser() {
  return (
    <section className="section _alt" data-screen-label="07 Work">
      <FadeIn className="section-inner">
        <a href="#/work" className="sec-media">
          <span className="sec-num">No. 07</span>
          <img src={window.PHOTOS.hasselblad[7]} alt="Work" loading="lazy" />
        </a>
        <div className="sec-body">
          <div className="eyebrow">
            <span className="n">07</span>
            <span className="flow-line in" style={{ width: 40 }} />
            <span>Selected · 2023 — 2026</span>
          </div>
          <h2>Work<span className="jp">工作</span></h2>
          <p className="lede">Brand collaborations and editorial projects. Click any tile to view the project on Instagram.</p>
          <div className="meta">
            <span>Hasselblad</span><span>Leica</span><span>Sony</span><span>Oppo</span><span>Goopi</span><span>Reto</span>
          </div>
          <a href="#/work" className="cta">View work <span className="arr">→</span></a>
        </div>
      </FadeIn>
    </section>
  );
}

// ---------- Home about teaser ----------
function HomeAboutTeaser() {
  return (
    <section className="section" data-screen-label="08 About">
      <FadeIn className="section-inner _reverse">
        <a href="#/about" className="sec-media">
          <span className="sec-num">No. 08</span>
          <img src={window.PHOTOS.portraits[5]} alt="About" loading="lazy" />
        </a>
        <div className="sec-body">
          <div className="eyebrow">
            <span className="n">08</span>
            <span className="flow-line in" style={{ width: 40 }} />
            <span>Photographer · 3D Creator</span>
          </div>
          <h2>About<span className="jp">關於我</span></h2>
          <p className="lede">Jerrythepopper 洪立楷，1996年生於台北。攝影師、3D創作者，Stairs Space 共同經營者。</p>
          <div className="meta">
            <span>Based in Taipei</span><span>SEVEN / Asia-Pacific</span>
          </div>
          <a href="#/about" className="cta">Read more <span className="arr">→</span></a>
        </div>
      </FadeIn>
    </section>
  );
}

// ---------- Home ----------
function Home() {
  return (
    <main data-screen-label="01 Home">
      <Hero />
      <HomeIntro />
      {window.SECTIONS.map((s, i) => <CategorySection key={s.id} s={s} index={i} />)}
      <HomeWorkTeaser />
      <HomeAboutTeaser />
    </main>
  );
}

// ---------- Category page ----------
function CategoryPage({ section, photos, screenLabel }) {
  const openLb = React.useContext(LightboxCtx);
  return (
    <main className="page" data-screen-label={screenLabel}>
      <FadeIn className="page-head">
        <div className="eyebrow">
          <span className="n">{section.number}</span>
          <span className="flow-line in" style={{ width: 56 }} />
          <span>{section.eyebrow}</span>
        </div>
        <h1>{section.en}{section.zh && <span className="jp">{section.zh}</span>}</h1>
        {section.subtitle && <p className="subtitle">{section.subtitle}</p>}
        <div className="meta">{section.meta.map((m, i) => <span key={i}>{m}</span>)}</div>
      </FadeIn>

      <section className={`gallery ${section.layout === 'single' ? 'single _wide' : 'masonry-2'}`}>
        {photos.map((src, i) => (
          <button key={i} type="button" className="gframe"
                  onClick={() => openLb(photos, i)}>
            <img src={src} alt={`${section.en} ${i + 1}`} loading="lazy" />
            <div className="caption">
              <span>No. {String(i + 1).padStart(3, '0')}</span>
              <span>{section.en}</span>
            </div>
          </button>
        ))}
      </section>
    </main>
  );
}

// ---------- Work page ----------
const WORK_TILES = [
  { url: 'https://www.instagram.com/p/DYRy7e2meZS/?igsh=MWIzdTU0NjZuN2FzdA==', t: 'OPPO Find X9 Ultra', c: '品牌形象拍攝', src: 'pt_1' },
  { url: 'https://www.instagram.com/p/DUDZPGbE53K/?igsh=MTAxYnQ3Mzd2Z2czag==', t: 'Hasselblad × Jerry',  c: '品牌合作計畫', src: 'hb_0' },
  { url: 'https://www.instagram.com/reel/DCB6M24IH6T/?igsh=MW11YTU4eGk5b2p2dA==', t: 'Goopi 2024',         c: '品牌形象動畫', src: 'pt_6' },
  { url: 'https://www.instagram.com/p/DTurh4DkX3V/?igsh=MXY2MDFqNGY3YW1nbQ==', t: 'GIANT',               c: '品牌形象動畫', src: 'hb_3' },
  { url: 'https://www.instagram.com/p/CygDcVGSBuS/?igsh=bThtcnozbnFmeTMw', t: 'Goopi 2023',          c: '品牌形象合作', src: 'pt_8' },
  { url: 'https://www.instagram.com/s/aGlnaGxpZ2h0OjE4MDY2OTM1Njg3MTE5MjI3?story_media_id=3854643749046163614&igsh=MTVqaG9kcG8waDNzMQ==', t: 'Giant Liv', c: '品牌形象動畫', src: 'st_1' },
  { url: 'https://www.instagram.com/s/aGlnaGxpZ2h0OjE4MDY2OTM1Njg3MTE5MjI3?story_media_id=3828514764847548116&igsh=MTVqaG9kcG8waDNzMQ==', t: '新光攝影展講座', c: '攝影展覽講座', src: 'st_4' },
  { url: 'https://www.instagram.com/reel/DJ6w-6ah0QN/?igsh=ZGs3MjFnM3o5NTdz', t: 'Reto 相機', c: '產品動畫製作', src: 'td_0' },
  { url: 'https://www.instagram.com/p/Cl3lNf9h8cm/?igsh=MTlqcXhudWUyZHBvag==', t: 'TEDxChungChengU', c: '品牌演講活動', src: 'pt_2' },
  { url: 'https://www.instagram.com/s/aGlnaGxpZ2h0OjE4MDAwMDA1OTA5NTk3Mjcz?story_media_id=3542991936099659472&igsh=MXhhZnRoamoxc2QxZw==', t: 'Sony YouTube', c: '品牌影片內容', src: 'st_7' },
  { url: 'https://www.instagram.com/reel/ChZUvNkpnS8/?igsh=c2l3cWZnc2VraXBq', t: 'Yotta 底片課程', c: '線上攝影課程', src: 'fm_2' },
  { url: 'https://www.instagram.com/p/C1GslZYBrSX/?img_index=1&igsh=MXdoNmE0eGNmNWo1cA==', t: '晶悅建設', c: '品牌形象拍攝', src: 'hb_7' },
  { url: 'https://www.instagram.com/s/aGlnaGxpZ2h0OjE4MDAwMDA1OTA5NTk3Mjcz?story_media_id=3239957459305757128&igsh=MXhhZnRoamoxc2QxZw==', t: '仁發建設', c: '品牌形象拍攝', src: 'hb_10' },
];

function Work() {
  return (
    <main className="page" data-screen-label="07 Work">
      <FadeIn className="page-head">
        <div className="eyebrow">
          <span className="n">07</span>
          <span className="flow-line in" style={{ width: 56 }} />
          <span>Selected · 2023 — 2026</span>
        </div>
        <h1>Work<span className="jp">工作</span></h1>
        <p className="subtitle">
          Brand collaborations and editorial projects. Click any tile to view the project on Instagram.{'\n'}
          品牌合作與商業工作。點擊任一方塊在 Instagram 上查看專案。
        </p>
        <div className="meta">
          <span>HASSELBLAD</span><span>LEICA</span><span>SONY</span><span>OPPO</span><span>GOOPI</span><span>RETO</span><span>2020 — 2026</span>
        </div>
      </FadeIn>

      <FadeIn as="section" className="work-featured" style={{
        '--bg-1': `url("${window.PHOTOS.hasselblad[0]}")`,
        '--bg-2': `url("${window.PHOTOS.portraits[0]}")`,
      }}>
        <a href="https://www.instagram.com/s/aGlnaGxpZ2h0OjE4MDY2OTM1Njg3MTE5MjI3?igsh=MTVqaG9kcG8waDNzMQ==" target="_blank" rel="noopener noreferrer">
          <div className="ft-title">Selected Works Vol.1</div>
          <div className="ft-sub">品牌合作與創作精選</div>
        </a>
        <a href="https://www.instagram.com/s/aGlnaGxpZ2h0OjE4MDAwMDA1OTA5NTk3Mjcz?igsh=MXhhZnRoamoxc2QxZw==" target="_blank" rel="noopener noreferrer">
          <div className="ft-title">Selected Works Vol.2</div>
          <div className="ft-sub">品牌合作與創作精選</div>
        </a>
      </FadeIn>

      <FadeIn as="section" className="work-grid">
        {WORK_TILES.map((w, i) => {
          const [p, n] = w.src.split('_');
          const cat = p === 'pt' ? 'portraits' : p === 'hb' ? 'hasselblad' : p === 'st' ? 'street' : p === 'td' ? 'three_d' : p === 'fm' ? 'film' : 'market';
          const photoSrc = window.PHOTOS[cat][parseInt(n)];
          return (
            <a key={i} href={w.url} target="_blank" rel="noopener noreferrer" className="work-tile">
              <div className="ph" style={{ backgroundImage: `url("${photoSrc}")` }} />
              <div className="ig">Instagram ↗</div>
              <div className="meta">
                <div className="t">{w.t}</div>
                <div className="c">{w.c}</div>
              </div>
            </a>
          );
        })}
        <div className="work-tile nophoto">
          <div>
            <div className="t">Leica</div>
            <div className="c">攝影教學講師</div>
          </div>
        </div>
      </FadeIn>
    </main>
  );
}

// ---------- About ----------
function About() {
  return (
    <main className="page" data-screen-label="08 About">
      <FadeIn className="page-head">
        <div className="eyebrow">
          <span className="n">08</span>
          <span className="flow-line in" style={{ width: 56 }} />
          <span>Photographer · 3D Creator</span>
        </div>
        <h1>About<span className="jp">關於我</span></h1>
      </FadeIn>

      <FadeIn as="section" className="about-wrap">
        <div className="about-portrait" style={{ backgroundImage: `url("${window.PHOTOS.portraits[3]}")` }} />
        <div className="about-body">
          <h2>Jerrythepopper 洪立楷</h2>
          <div className="role">Photographer · 3D Creator · Based in Taipei</div>

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
          <div className="brands">
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

          <div className="stats">
            <div className="stat"><div className="num">12</div><div className="lab">Years shooting</div></div>
            <div className="stat"><div className="num">50+</div><div className="lab">Brands</div></div>
            <div className="stat"><div className="num">3</div><div className="lab">Solo shows</div></div>
          </div>

          <div className="contact">
            <div><b>Email</b><span>jerrythepopper@gmail.com</span></div>
            <div><b>Studio</b><span>No. 96, Ln. 74, Sec.3. Taipei</span></div>
            <div><b>Instagram</b><span>@jerrythepopper</span></div>
            <div><b>Representation</b><span>SEVEN / Asia-Pacific</span></div>
          </div>
        </div>
      </FadeIn>
    </main>
  );
}

// ---------- Footer ----------
function Footer() {
  return (
    <footer className="foot">
      <div className="foot-inner">
        <div>
          <div className="foot-brand">
            <span className="en">Jerrythepopper</span>
            <span className="zh">洪立楷 · Photography</span>
          </div>
        </div>
        <div>
          <h4>Series</h4>
          <ul>
            <li><a href="#/hasselblad">Hasselblad 哈蘇</a></li>
            <li><a href="#/portraits">Portraits 人像</a></li>
            <li><a href="#/street">Street 街拍</a></li>
            <li><a href="#/3d">3D 立體</a></li>
            <li><a href="#/film">Film 底片</a></li>
            <li><a href="#/market">果菜市場 輪轉</a></li>
          </ul>
        </div>
        <div>
          <h4>Office</h4>
          <ul>
            <li><a href="#/work">Work 工作</a></li>
            <li><a href="#/about">About 關於我</a></li>
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
    </footer>
  );
}

// ---------- App ----------
function App() {
  const hash = useHashRoute();
  const route = hash.replace(/^#\//, '') || '';
  const [lb, setLb] = useState({ open: false, photos: [], index: 0 });
  const openLb = useCallback((photos, index) => setLb({ open: true, photos, index }), []);
  const close = () => setLb((s) => ({ ...s, open: false }));
  const prev  = () => setLb((s) => ({ ...s, index: (s.index - 1 + s.photos.length) % s.photos.length }));
  const next  = () => setLb((s) => ({ ...s, index: (s.index + 1) % s.photos.length }));

  let current = 'home';
  let body;
  const findSec = (id) => window.SECTIONS.find((s) => s.id === id);
  const photosForId = (id) => window.PHOTOS[id === '3d' ? 'three_d' : id];

  switch (route) {
    case '':
      body = <Home />; current = 'home'; break;
    case 'hasselblad':
      current = 'hb';
      body = <CategoryPage section={findSec('hasselblad')} photos={photosForId('hasselblad')} screenLabel="02 Hasselblad" />;
      break;
    case 'portraits':
      current = 'pt';
      body = <CategoryPage section={findSec('portraits')} photos={photosForId('portraits')} screenLabel="03 Portraits" />;
      break;
    case 'street':
      current = 'st';
      body = <CategoryPage section={findSec('street')} photos={photosForId('street')} screenLabel="04 Street" />;
      break;
    case '3d':
      current = '3d';
      body = <CategoryPage section={findSec('3d')} photos={photosForId('3d')} screenLabel="05 3D" />;
      break;
    case 'film':
      current = 'film';
      body = <CategoryPage section={findSec('film')} photos={photosForId('film')} screenLabel="06 Film" />;
      break;
    case 'market':
      current = 'mk';
      body = <CategoryPage section={findSec('market')} photos={photosForId('market')} screenLabel="07 Market" />;
      break;
    case 'work':
      current = 'work';
      body = <Work />;
      break;
    case 'about':
      current = 'about';
      body = <About />;
      break;
    default:
      body = <Home />; current = 'home';
  }

  return (
    <LightboxCtx.Provider value={openLb}>
      <FrostedNav current={current} />
      {body}
      <Footer />
      <Lightbox open={lb.open} photos={lb.photos} index={lb.index}
                onClose={close} onPrev={prev} onNext={next} />
    </LightboxCtx.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
