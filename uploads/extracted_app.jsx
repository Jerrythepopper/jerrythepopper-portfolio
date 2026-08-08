/* global React, ReactDOM */
const { useState, useEffect, useMemo } = React;

// ---------- Lightbox context ----------
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
    return () => {window.removeEventListener('keydown', onKey);document.body.style.overflow = '';};
  }, [open, onClose, onPrev, onNext]);
  if (!open) return null;
  const p = photos[index];
  return (
    <div className="lb" onClick={onClose}>
      <button className="lb-close" onClick={(e) => {e.stopPropagation();onClose();}} aria-label="Close">✕</button>
      <button className="lb-prev" onClick={(e) => {e.stopPropagation();onPrev();}} aria-label="Previous">‹</button>
      <button className="lb-next" onClick={(e) => {e.stopPropagation();onNext();}} aria-label="Next">›</button>
      <div className="lb-stage" onClick={(e) => e.stopPropagation()}>
        <img src={p.src} alt="" />
        <div className="lb-counter">{String(index + 1).padStart(2, '0')} / {String(photos.length).padStart(2, '0')}</div>
      </div>
    </div>);

}

// ---------- Router ----------
function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash || '#/');
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

// ---------- Hero (home only) ----------
function Hero() {
  const slides = React.useMemo(() => [
  window.PHOTOS.hasselblad[0].src,
  window.PHOTOS.portraits[0].src,
  window.PHOTOS.market[0].src,
  window.PHOTOS.street[0].src,
  window.PHOTOS.film[2].src,
  window.PHOTOS.hasselblad[7].src],
  []);
  const [active, setActive] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % slides.length), 3000);
    return () => clearInterval(t);
  }, [slides.length]);
  return (
    <section className="hero" data-screen-label="00 Hero">
      <div className="hero-slides" aria-hidden="true">
        {slides.map((s, i) =>
        <div key={i} className={`hero-slide ${i === active ? 'active' : ''}`} style={{ backgroundImage: `url("${s}")` }}></div>
        )}
      </div>
      <div className="hero-grain" aria-hidden="true"></div>
      <div className="hero-fade" aria-hidden="true"></div>
      <h1 className="hero-title">Jerrythepopper</h1>
      <div className="hero-scroll-hint" aria-hidden="true">
        <span>Scroll</span>
        <div className="hero-scroll-line"><div className="hero-scroll-line-inner"></div></div>
      </div>
    </section>);

}

// ---------- Frosted glass nav (slides in on scroll) ----------
function FrostedNav({ current }) {
  const items = window.NAV_ITEMS.filter((i) => i.id !== 'home');
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > Math.min(window.innerHeight * 0.55, 480));
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <div className={`frosted-nav ${visible ? 'visible' : ''}`} aria-hidden={!visible}>
      <a href="#/" className="frosted-nav-brand">Jerrythepopper</a>
      <nav className="nav frosted-nav-links" aria-label="Sticky">
        {items.map((i) => {
          const active = current === i.id;
          const label = i.en && i.zh ? `${i.en} ${i.zh}` : i.en || i.zh;
          return (
            <a key={i.id} href={i.hash} className={active ? 'active' : ''}>{label}</a>);

        })}
      </nav>
    </div>);

}

// ---------- Top masthead + nav ----------
function splitChars(text) {
  return [...text].map((ch, i) =>
  <span key={i} className="ch" style={{ animationDelay: `${i * 40}ms` }}>
      {ch === ' ' ? '\u00A0' : ch}
    </span>
  );
}

function Masthead({ current }) {
  const items = window.NAV_ITEMS.filter((i) => i.id !== 'home');
  return (
    <header className="masthead" style={{ backgroundColor: "rgb(10, 17, 24)" }}>
      <h1 className="brand"><a href="#/">{splitChars('Jerrythepopper')}</a></h1>
      <nav className="nav" aria-label="Primary">
        {items.map((i) => {
          const active = current === i.id;
          const label = i.en && i.zh ? `${i.en} ${i.zh}` : i.en || i.zh;
          return (
            <a key={i.id} href={i.hash} className={active ? 'active' : ''} style={{ fontSize: "14px" }}>{label}</a>);

        })}
      </nav>
    </header>);

}

// ---------- Footer ----------
function Footer() {
  return (
    <footer className="foot" style={{ color: "rgb(154, 154, 155)" }}>
      <div style={{ fontSize: "8px" }}>© 2026 Jerrythepopper · Photography Portfolio</div>
      <div className="links">
        <a href="#/work" style={{ fontSize: "8px" }}>Work</a>
        <a href="#/about" style={{ fontSize: "8px" }}>Contact</a>
        <a href="https://www.instagram.com/jerrythepopper" target="_blank" rel="noopener noreferrer" style={{ fontSize: "8px" }}>Instagram</a>
      </div>
    </footer>);

}

// ---------- HOME (Bento Grid) ----------
function Home() {
  const tiles = [
  { id: 'hb', en: 'Hasselblad', zh: '哈蘇', hash: '#/hasselblad', cls: 'tile-a', img: window.PHOTOS.hasselblad[0].src },
  { id: 'pt', en: 'Portraits', zh: '人像', hash: '#/portraits', cls: 'tile-b', img: window.PHOTOS.portraits[0].src },
  { id: 'mk', en: 'Market', zh: '果菜市場', hash: '#/market', cls: 'tile-c', img: window.PHOTOS.market[0].src },
  { id: '3d', en: '3D', zh: '', hash: '#/3d', cls: 'tile-d', img: window.PHOTOS.three_d[0].src },
  { id: 'st', en: 'Street', zh: '街拍', hash: '#/street', cls: 'tile-e', img: window.PHOTOS.street[0].src },
  { id: 'film', en: 'Film', zh: '底片', hash: '#/film', cls: 'tile-f', img: window.PHOTOS.film[0].src },
  { id: 'work', en: 'Work', zh: '工作', hash: '#/work', cls: 'tile-h', img: window.PHOTOS.hasselblad[7].src },
  { id: 'about', en: 'About', zh: '關於我', hash: '#/about', cls: 'tile-i', img: window.PHOTOS.portraits[5].src }];

  return (
    <main className="page" data-screen-label="01 Home">
      <div className="bento">
        {tiles.map((t) =>
        <a key={t.id} href={t.hash} className={`bento-card ${t.cls}`}>
            <div className="photo" style={{ backgroundImage: `url("${t.img}")` }}></div>
            <div className="label">
              {t.en && <div className="en">{t.en}</div>}
              {t.zh && <div className="zh">{t.zh}</div>}
            </div>
            <div className="marquee-strip">
              <div className="marquee-track">
                {Array.from({ length: 6 }).map((_, i) =>
              <span key={i}>{t.en || t.zh} · view series · {String(i + 1).padStart(2, '0')}</span>
              )}
              </div>
            </div>
          </a>
        )}
      </div>
    </main>);

}

// ---------- Generic Category Page ----------
function CategoryPage({ label, eyebrow, en, zh, subtitle, meta, photos, screenLabel, layout }) {
  const openLightbox = React.useContext(LightboxCtx);
  const galleryClass = layout === 'single' ? 'gallery single-col' : 'gallery masonry-2';
  return (
    <main className="page" data-screen-label={screenLabel}>
      <section className="cat-head">
        <h1>{splitChars(en)}{zh ? <span style={{ opacity: .5, marginLeft: '0.4em', fontSize: '0.6em', letterSpacing: '0.2em' }}>{zh}</span> : null}</h1>
        {subtitle ? <div className="subtitle" style={{ whiteSpace: 'pre-line', fontSize: "14px" }}>{subtitle}</div> : null}
      </section>
      <section className={galleryClass}>
        {photos.map((p, i) =>
        <button key={i} type="button" className="frame frame-natural" onClick={() => openLightbox(photos, i)}>
            <img src={p.src} width={p.w} height={p.h} alt={`${label} ${i + 1}`} loading="lazy" />
            <div className="caption">
              <span>No. {String(i + 1).padStart(3, '0')}</span>
              <span>{label}</span>
            </div>
          </button>
        )}
      </section>
    </main>);

}

// ---------- Rotation page (carousel) ----------
function Rotation() {
  const photos = window.PHOTOS.rotation;
  const [active, setActive] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % photos.length), 4500);
    return () => clearInterval(t);
  }, [photos.length]);
  return (
    <main className="page" data-screen-label="07 Rotation">
      <section className="cat-head">
        <div className="eyebrow">Series · 008</div>
        <h1>{splitChars('Rotation')}<span style={{ opacity: .5, marginLeft: '0.4em', fontSize: '0.6em', letterSpacing: '0.2em' }}>輪轉</span></h1>
        <div className="subtitle">A study of motion — long exposures, panning, and shutter-drag captured between dusk and midnight.</div>
        <div className="meta"><div>2025 — 2026</div><div>Taipei · Kyoto · Berlin</div><div>Long exposure</div></div>
      </section>
      <div className="rot-stage">
        {photos.map((p, i) =>
        <div key={i} className={`slide ${i === active ? 'active' : ''}`} style={{ backgroundImage: `url("${p}")` }}></div>
        )}
      </div>
      <div className="rot-controls">
        {photos.map((_, i) =>
        <button key={i} className={`rot-dot ${i === active ? 'active' : ''}`} onClick={() => setActive(i)} aria-label={`Slide ${i + 1}`}></button>
        )}
      </div>
      <div className="rot-thumbs">
        {photos.map((p, i) =>
        <div key={i} className={`t ${i === active ? 'active' : ''}`} style={{ backgroundImage: `url("${p}")` }} onClick={() => setActive(i)}></div>
        )}
      </div>
    </main>);

}

// ---------- Work page ----------
function Work() {
  const P = window.PHOTOS;
  const ig = (i) => P.hasselblad[i % P.hasselblad.length].src;
  const pt = (i) => P.portraits[i % P.portraits.length].src;
  const st = (i) => P.street[i % P.street.length].src;
  const mk = (i) => P.market[i % P.market.length].src;
  const fm = (i) => P.film[i % P.film.length].src;
  const td = (i) => P.three_d[i % P.three_d.length].src;
  return (
    <main className="page" data-screen-label="08 Work">
      <section className="cat-head">
        <div className="eyebrow">Selected · 2023 — 2026</div>
        <h1>{splitChars('Work')}<span style={{ opacity: .5, marginLeft: '0.4em', fontSize: '0.6em', letterSpacing: '0.2em' }}>工作</span></h1>
        <div className="subtitle">Brand collaborations and editorial projects. Click any tile to view the project on Instagram.
<span style={{ color: 'rgb(166, 166, 166)' }}>品牌合作與商業工作。點擊任一方塊在 Instagram 上查看專案。</span>
</div>
        <div className="meta"><div>HASSELBLAD · LEICA · SONY · OPPO · GOOPI · RETO</div><div></div><div>2020 — 2026</div></div>
      </section>

      <section className="work-featured-row">
        <a href="https://www.instagram.com/s/aGlnaGxpZ2h0OjE4MDY2OTM1Njg3MTE5MjI3?igsh=MTVqaG9kcG8waDNzMQ==" target="_blank" rel="noopener noreferrer" className="work-featured">
          <div className="feat-title">Selected Works Vol.1</div>
          <div className="feat-sub">品牌合作與創作精選</div>
        </a>
        <a href="https://www.instagram.com/s/aGlnaGxpZ2h0OjE4MDAwMDA1OTA5NTk3Mjcz?igsh=MXhhZnRoamoxc2QxZw==" target="_blank" rel="noopener noreferrer" className="work-featured">
          <div className="feat-title">Selected Works Vol.2</div>
          <div className="feat-sub">品牌合作與創作精選</div>
        </a>
      </section>

      <section className="gallery col-3">
        <a href="https://www.instagram.com/p/DYRy7e2meZS/?igsh=MWIzdTU0NjZuN2FzdA==" target="_blank" rel="noopener noreferrer" className="frame square work-tile">
          <div className="photo" style={{ backgroundImage: `url("${pt(1)}")` }}></div>
          <div className="work-overlay">
            <div className="work-meta-top"><span></span><span className="ig">Instagram ↗</span></div>
            <div className="work-meta-bot"><div className="t">OPPO Find X9 Ultra</div><div className="c">品牌形象拍攝</div></div>
          </div>
        </a>
        <a href="https://www.instagram.com/p/DUDZPGbE53K/?igsh=MTAxYnQ3Mzd2Z2czag==" target="_blank" rel="noopener noreferrer" className="frame square work-tile">
          <div className="photo" style={{ backgroundImage: `url("${ig(0)}")` }}></div>
          <div className="work-overlay">
            <div className="work-meta-top"><span></span><span className="ig">Instagram ↗</span></div>
            <div className="work-meta-bot"><div className="t">Hasselblad × Jerry</div><div className="c">品牌合作計畫</div></div>
          </div>
        </a>
        <a href="https://www.instagram.com/reel/DCB6M24IH6T/?igsh=MW11YTU4eGk5b2p2dA==" target="_blank" rel="noopener noreferrer" className="frame square work-tile">
          <div className="photo" style={{ backgroundImage: `url("${pt(6)}")` }}></div>
          <div className="work-overlay">
            <div className="work-meta-top"><span></span><span className="ig">Instagram ↗</span></div>
            <div className="work-meta-bot"><div className="t">Goopi 2024</div><div className="c">品牌形象動畫</div></div>
          </div>
        </a>
        <a href="https://www.instagram.com/p/DTurh4DkX3V/?igsh=MXY2MDFqNGY3YW1nbQ==" target="_blank" rel="noopener noreferrer" className="frame square work-tile">
          <div className="photo" style={{ backgroundImage: `url("${ig(3)}")` }}></div>
          <div className="work-overlay">
            <div className="work-meta-top"><span></span><span className="ig">Instagram ↗</span></div>
            <div className="work-meta-bot"><div className="t">GIANT</div><div className="c">品牌形象動畫</div></div>
          </div>
        </a>
        <a href="https://www.instagram.com/p/CygDcVGSBuS/?igsh=bThtcnozbnFmeTMw" target="_blank" rel="noopener noreferrer" className="frame square work-tile">
          <div className="photo" style={{ backgroundImage: `url("${pt(8)}")` }}></div>
          <div className="work-overlay">
            <div className="work-meta-top"><span></span><span className="ig">Instagram ↗</span></div>
            <div className="work-meta-bot"><div className="t">Goopi 2023</div><div className="c">品牌形象合作</div></div>
          </div>
        </a>
        <a href="https://www.instagram.com/s/aGlnaGxpZ2h0OjE4MDY2OTM1Njg3MTE5MjI3?story_media_id=3854643749046163614&igsh=MTVqaG9kcG8waDNzMQ==" target="_blank" rel="noopener noreferrer" className="frame square work-tile">
          <div className="photo" style={{ backgroundImage: `url("${st(1)}")` }}></div>
          <div className="work-overlay">
            <div className="work-meta-top"><span></span><span className="ig">Instagram ↗</span></div>
            <div className="work-meta-bot"><div className="t">Giant Liv</div><div className="c">品牌形象動畫</div></div>
          </div>
        </a>
        <a href="https://www.instagram.com/s/aGlnaGxpZ2h0OjE4MDY2OTM1Njg3MTE5MjI3?story_media_id=3828514764847548116&igsh=MTVqaG9kcG8waDNzMQ==" target="_blank" rel="noopener noreferrer" className="frame square work-tile">
          <div className="photo" style={{ backgroundImage: `url("${st(4)}")` }}></div>
          <div className="work-overlay">
            <div className="work-meta-top"><span></span><span className="ig">Instagram ↗</span></div>
            <div className="work-meta-bot"><div className="t">新光攝影展講座</div><div className="c">攝影展覽講座</div></div>
          </div>
        </a>
        <a href="https://www.instagram.com/reel/DJ6w-6ah0QN/?igsh=ZGs3MjFnM3o5NTdz" target="_blank" rel="noopener noreferrer" className="frame square work-tile">
          <div className="photo" style={{ backgroundImage: `url("${td(0)}")` }}></div>
          <div className="work-overlay">
            <div className="work-meta-top"><span></span><span className="ig">Instagram ↗</span></div>
            <div className="work-meta-bot"><div className="t">Reto 相機</div><div className="c">產品動畫製作</div></div>
          </div>
        </a>
        <a href="https://www.instagram.com/p/Cl3lNf9h8cm/?igsh=MTlqcXhudWUyZHBvag==" target="_blank" rel="noopener noreferrer" className="frame square work-tile">
          <div className="photo" style={{ backgroundImage: `url("${pt(2)}")` }}></div>
          <div className="work-overlay">
            <div className="work-meta-top"><span></span><span className="ig">Instagram ↗</span></div>
            <div className="work-meta-bot"><div className="t">TEDxChungChengU</div><div className="c">品牌演講活動</div></div>
          </div>
        </a>
        <a href="https://www.instagram.com/s/aGlnaGxpZ2h0OjE4MDAwMDA1OTA5NTk3Mjcz?story_media_id=3542991936099659472&igsh=MXhhZnRoamoxc2QxZw==" target="_blank" rel="noopener noreferrer" className="frame square work-tile">
          <div className="photo" style={{ backgroundImage: `url("${st(7)}")` }}></div>
          <div className="work-overlay">
            <div className="work-meta-top"><span></span><span className="ig">Instagram ↗</span></div>
            <div className="work-meta-bot"><div className="t">Sony YouTube</div><div className="c">品牌影片內容</div></div>
          </div>
        </a>
        <a href="https://www.instagram.com/reel/ChZUvNkpnS8/?igsh=c2l3cWZnc2VraXBq" target="_blank" rel="noopener noreferrer" className="frame square work-tile">
          <div className="photo" style={{ backgroundImage: `url("${fm(2)}")` }}></div>
          <div className="work-overlay">
            <div className="work-meta-top"><span></span><span className="ig">Instagram ↗</span></div>
            <div className="work-meta-bot"><div className="t">Yotta 底片課程</div><div className="c">線上攝影課程</div></div>
          </div>
        </a>
        <a href="https://www.instagram.com/p/C1GslZYBrSX/?img_index=1&igsh=MXdoNmE0eGNmNWo1cA==" target="_blank" rel="noopener noreferrer" className="frame square work-tile">
          <div className="photo" style={{ backgroundImage: `url("${ig(7)}")` }}></div>
          <div className="work-overlay">
            <div className="work-meta-top"><span></span><span className="ig">Instagram ↗</span></div>
            <div className="work-meta-bot"><div className="t">晶悅建設</div><div className="c">品牌形象拍攝</div></div>
          </div>
        </a>
        <a href="https://www.instagram.com/s/aGlnaGxpZ2h0OjE4MDAwMDA1OTA5NTk3Mjcz?story_media_id=3239957459305757128&igsh=MXhhZnRoamoxc2QxZw==" target="_blank" rel="noopener noreferrer" className="frame square work-tile">
          <div className="photo" style={{ backgroundImage: `url("${ig(10)}")` }}></div>
          <div className="work-overlay">
            <div className="work-meta-top"><span></span><span className="ig">Instagram ↗</span></div>
            <div className="work-meta-bot"><div className="t">仁發建設</div><div className="c">品牌形象拍攝</div></div>
          </div>
        </a>
        <div className="frame square work-tile no-photo">
          <div>
            <div className="nophoto-label">Leica</div>
            <div className="nophoto-sub">攝影教學講師</div>
          </div>
        </div>
      </section>
    </main>);}

// ---------- About page ----------
function About() {
  return (
    <main className="page" data-screen-label="09 About">
      <section className="cat-head" style={{ paddingBottom: 32 }}>
        <div className="eyebrow">PHOTOGRAPHER · 3D CREATOR</div>
        <h1>{splitChars('About')}<span style={{ opacity: .5, marginLeft: '0.4em', fontSize: '0.6em', letterSpacing: '0.2em' }}>關於我</span></h1>
      </section>
      <section className="about-wrap">
        <div className="about-portrait" style={{ backgroundImage: `url("${window.PHOTOS.portraits[3].src}")` }}></div>
        <div className="about-body">
          <h1 style={{ fontSize: "40px" }}>Jerrythepopper 洪立楷

</h1>
          <div className="role">Photographer · 3D Creator · Based in Taipei</div>
          <p>1996年生於台北。攝影師、3D創作者，Stairs Space 共同經營者。</p>
          <p>以影像捕捉人文、街頭與空間的情緒，擅長在孤寂感與時間流動中找到畫面的重量。除了攝影，也持續探索3D視覺與虛實場景的交錯，嘗試讓靜態影像走向更立體的敘事。</p>
          <p>曾與 Hasselblad、Leica、Sony、Oppo、Giant、新光攝影展、朱銘美術館、蝦皮等品牌合作，執行形象拍攝、教學內容與創意企劃。紀實計畫《輪轉》記錄台北第一果菜批發市場的人與故事，歷時一年多，最終透過募資出版攝影集。</p>

          <h3 style={{ marginTop: 32, marginBottom: 12, fontSize: 14, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--on-primary-dim)' }}>可以一起做的事</h3>
          <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--on-primary-mute)', lineHeight: 1.9 }}>
            <li>攝影｜品牌形象・人像・街拍・空間・活動紀錄・人文紀實</li>
            <li>3D創作｜場景設計・視覺概念・虛實結合</li>
            <li>創意企劃｜影像敘事・品牌合作・空間裝置</li>
            <li>影像教育｜攝影教學・課程製作</li>
          </ul>

          <h3 style={{ marginTop: 32, marginBottom: 12, fontSize: 14, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--on-primary-dim)' }}>合作品牌</h3>
          <p style={{ margin: '0 0 8px' }}><b style={{ color: 'var(--on-primary)', fontWeight: 500 }}>相機品牌：</b>Hasselblad、Leica Camera Taiwan、Sony、Oppo、Reto</p>
          <p style={{ margin: '0 0 8px' }}><b style={{ color: 'var(--on-primary)', fontWeight: 500 }}>建築 / 商業：</b>名發建設、三發建設、晶悅建設、臺北農產運銷公司、捷安特</p>
          <p style={{ margin: '0 0 8px' }}><b style={{ color: 'var(--on-primary)', fontWeight: 500 }}>文化 / 藝術：</b>朱銘美術館、孤僻Goopi</p>
          <p style={{ margin: '0 0 8px' }}><b style={{ color: 'var(--on-primary)', fontWeight: 500 }}>商業平台：</b>蝦皮</p>

          <h3 style={{ marginTop: 32, marginBottom: 12, fontSize: 14, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--on-primary-dim)' }}>展覽・出版・課程・</h3>
          <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--on-primary-mute)', lineHeight: 1.9 }}>
            <li>《輪轉》攝影集出版與攝影展（台北第一果菜市場紀實計畫）</li>
            <li>底片攝影線上課程（與線上課程平台合作）</li>
            <li>Sony × Jerrythepopper 教學影片（YouTube 街拍教學）</li>
          </ul>

          <div className="stats">
            <div className="stat"><div className="num">12
              </div><div className="lab">Years shooting</div></div>
            <div className="stat"><div className="num">50+</div><div className="lab">Brands</div></div>
            <div className="stat"><div className="num">3
</div><div className="lab">Solo shows</div></div>
          </div>

          <div className="contact">
            <div><b>Email</b>jerrythepopper@gmail.com</div>
            <div><b>Studio</b>No. 96, Ln. 74, Sec.3. Taipei</div>
            <div><b>Instagram</b>@jerrythepopper</div>
            <div><b>REPRSENTATION</b>SEVEN / Asia-Pacific</div>
          </div>
        </div>
      </section>
    </main>);} // ---------- App router ----------
function App() {
  const hash = useHashRoute();
  const route = hash.replace(/^#\//, '') || '';
  const [lb, setLb] = useState({ open: false, photos: [], index: 0 });
  const openLightbox = React.useCallback((photos, index) => setLb({ open: true, photos, index }), []);
  const closeLightbox = () => setLb((s) => ({ ...s, open: false }));
  const prev = () => setLb((s) => ({ ...s, index: (s.index - 1 + s.photos.length) % s.photos.length }));
  const next = () => setLb((s) => ({ ...s, index: (s.index + 1) % s.photos.length }));

  let current = 'home';
  let body;
  switch (route) {
    case '':
      body = <Home />;current = 'home';break;
    case 'hasselblad':
      current = 'hb';
      body = <CategoryPage screenLabel="02 Hasselblad" label="HB" eyebrow="Series · 001" en="Hasselblad" zh="哈蘇"
      subtitle={"這兩次與哈蘇合作，我想挑戰更多可能\n\n當我拿到哈蘇相機時，並不想只用它來做一件事，而是想看看它能如何回應不同的拍攝主題。這次的創作，涵蓋了人像、街景、風景，以及一些更個人、更私密的視角。\n\n每一種題材，都讓我重新理解這台相機的語言，它的細節，它的動態範圍，它如何詮釋光影，以及它如何影響我的觀看方式。\n\n"}
      meta={['503CW · 80mm', 'Kodak Ektar 100', 'Taipei · Kaohsiung']}
      photos={window.PHOTOS.hasselblad}
      layout="single" />;
      break;
    case 'portraits':
      current = 'pt';
      body = <CategoryPage screenLabel="03 Portraits" label="PT" eyebrow="Series · 002" en="Portraits" zh="人像"
      meta={['Natural light', '35mm · 85mm', '2024 — 2026']}
      photos={window.PHOTOS.portraits} />;
      break;
    case 'street':
      current = 'st';
      body = <CategoryPage screenLabel="04 Street" label="ST" eyebrow="Series · 003" en="Street" zh="街拍"
      meta={['Rangefinder', 'Available light', '2022 — present']}
      photos={window.PHOTOS.street} />;
      break;
    case '3d':
      current = '3d';
      body = <CategoryPage screenLabel="05 3D" label="3D" eyebrow="Series · 004" en="3D" zh=""
      subtitle={"CGI hybrid pieces — exploring the boundary between captured photograph and rendered scene.\n3D作品，探索攝影跟3D的邊界。\n"}
      meta={['CGI · Octane', 'Stereo pair', 'Mixed media']}
      photos={window.PHOTOS.three_d}
      layout="single" />;
      break;
    case 'film':
      current = 'film';
      body = <CategoryPage screenLabel="06 Film" label="FILM" eyebrow="Series · 005" en="Film" zh="底片"
      subtitle="35mm contact sheets — the slower medium, scanned and selected from negatives shot 2022 — 2026."
      meta={['Kodak Portra · Tri-X', 'Leica M6 · Contax T3', 'Hand-developed']}
      photos={window.PHOTOS.film} />;
      break;
    case 'market':
      body = <CategoryPage screenLabel="07 Market" label="MK" eyebrow="Series · 007" en="Taipei Wholesale Market" zh="果菜市場"
      subtitle={"輪轉一詞，取自於台語的「輪轉」（liàn-tńg）。一是認為，輪子在第一果菜批發市場擔任要角，舉凡當地會出現的大貨車、小貨車、人力拖車、電動拖車以及摩托車無不需要它的存在，彷彿它在某層面上也構成了此處。二是，輪子的轉圈就如同果菜市場般，日復一日地轉動著、運行著。最後，在果菜市場的人們不論聊天、買／賣菜、拍賣、廣播都是說著流利的台語，而「輪轉」（liàn-tńg）即為「流利」的意思。\n\n這計畫致力於將果菜市場內的點點滴滴記錄下來，並希希望觀看的人能初步了解這地方，理解這裡的人們、文化、建築，畢竟此處即將改建。再來，我也希望觀者能透過我的眼睛、作品，看到我在此處查覺的議題。並透過我微薄的能力、匪淺知識觀察到的議題，透過照片，表達給觀眾。或是拋磚引玉，引起更有能力的人再更深心地探討這些蘊藏在其中的議題。\n\n"}
      meta={['Documentary', 'Available light', '2025']}
      photos={window.PHOTOS.market} />;
      current = 'mk';
      break;
    case 'work':
      body = <Work />;current = 'work';break;
    case 'about':
      body = <About />;current = 'about';break;
    default:
      body = <Home />;current = 'home';
  }

  return (
    <LightboxCtx.Provider value={openLightbox}>
      {current === 'home' && <Hero />}
      <FrostedNav current={current} />
      <Masthead current={current} />
      {body}
      <Footer />
      <Lightbox open={lb.open} photos={lb.photos} index={lb.index} onClose={closeLightbox} onPrev={prev} onNext={next} />
    </LightboxCtx.Provider>);

}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);