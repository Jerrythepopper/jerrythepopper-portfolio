/* =============================================================================
   site.js — 靜態站互動層（vanilla，零依賴）
   復刻原 React 雛形四件互動：hero 輪播 / frosted nav / fade-up / lightbox
   2026-08-08 UI 修正包：手機導覽單行滑動、子頁導覽常駐、燈箱縮放平移
   2026-08-09 S21：hero 照片輪播（含 8 顆圓點）退場，改成每次來訪輪值一支雲影片
   由 build-site.js 原樣複製到 dist\site.js
   ============================================================================= */
(function () {
  'use strict';

  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

  /* ---------- ⓪ 深淺色切換（S24） ------------------------------------------
     三態語意只有兩顆按鈕：沒點過＝跟系統走（<html> 上沒有 data-theme），點一下＝
     釘死到另一邊並寫進 localStorage，再點一次＝釘到回來。要回到「跟系統」請清
     站台資料——刻意不做三態鈕，兩態的心智模型才不會每次都要猜現在是第幾態。

     防閃的那半段不在這裡：<head> 最前面有一段同步小腳本先把 data-theme 掛上去，
     所以 CSS 一到位就是最終色，不會先閃一格白再翻黑（本檔是 defer，來不及）。

     兩顆鈕（frosted nav 一顆、hero 右上角一顆）不各自持有狀態：外觀由 :root 的
     --tt-sun / --tt-moon 決定，這裡只改一個屬性，兩顆自動同步。用事件委派掛在
     document 上，之後任何版位再加第三顆也不必回來改這裡。
  ------------------------------------------------------------------------ */
  (function () {
    var KEY = 'jtpTheme';
    function systemDark() {
      return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    function current() {
      var t = document.documentElement.getAttribute('data-theme');
      return (t === 'dark' || t === 'light') ? t : (systemDark() ? 'dark' : 'light');
    }
    var ttTimer = null;
    document.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest && e.target.closest('.theme-toggle');
      if (!btn) return;
      var next = current() === 'dark' ? 'light' : 'dark';
      /* 過渡只在「使用者真的點了鈕」時存在（見 patch.css .theme-transitioning）：
         掛上去 → 換色 → 420ms 後拆掉。開頁的防閃腳本與系統偏好自動翻面都不經過
         這裡，所以那兩條路徑維持瞬切；減少動態時整段跳過。 */
      if (!reduce) {
        document.documentElement.classList.add('theme-transitioning');
        clearTimeout(ttTimer);
        ttTimer = setTimeout(function () {
          document.documentElement.classList.remove('theme-transitioning');
        }, 420);
      }
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem(KEY, next); } catch (err) {}
      // 手機瀏覽器的網址列底色跟著走（<head> 那條 theme-color 只認系統偏好）
      var m = document.querySelector('meta[name="theme-color"]');
      if (m) { m.removeAttribute('media'); m.setAttribute('content', next === 'dark' ? '#1f1d1a' : '#f7f7f7'); }
    });
  })();

  /* ---------- 共用：iOS 頁面級雙指縮放的攔截 --------------------------------
     iOS Safari 的雙指縮放是「頁面級」的，會蓋過 touch-action:none —— 在燈箱／
     Deep Zoom 檢視器裡捏一下，整個網頁（含 overlay）被放大推出視野，而且因為
     overlay 佔滿畫面、沒有可見的頁面邊界可抓，使用者很難縮回來（站主真機回報的
     「螢幕噴飛回不來」）。

     兩條路一起堵，缺一不可：
       ① gesturestart / gesturechange / gestureend —— Safari 專屬的縮放手勢事件，
          preventDefault 掉才不會啟動頁面縮放。
       ② touchmove 且觸點 ≥2 —— 沒發 gesture* 事件的路徑（跨元素起手等）由它兜底；
          單指不攔，燈箱的單指平移／swipe 照舊走 Pointer Events。
     兩者都必須 passive:false，否則 preventDefault 無效。
     回傳 unbind()：overlay 關閉時務必呼叫，別讓攔截漏到正常頁面上。
  ------------------------------------------------------------------------ */
  function lockPageZoom(el) {
    if (!el) return function () {};
    function stop(e) { e.preventDefault(); }
    function stopMulti(e) {
      if (e.touches && e.touches.length > 1) e.preventDefault();
    }
    var opt = { passive: false };
    el.addEventListener('gesturestart', stop, opt);
    el.addEventListener('gesturechange', stop, opt);
    el.addEventListener('gestureend', stop, opt);
    el.addEventListener('touchmove', stopMulti, opt);
    return function () {
      el.removeEventListener('gesturestart', stop, opt);
      el.removeEventListener('gesturechange', stop, opt);
      el.removeEventListener('gestureend', stop, opt);
      el.removeEventListener('touchmove', stopMulti, opt);
    };
  }

  /* ---------- ⓪ blur-up 收尾 ------------------------------------------------
     主圖的淡入靠 <img onload> 內聯掛 is-loaded（時序上最保險）。這裡只補兩件事：
     ① script 執行前就載完的圖（onload 已經過去了）補上 class；
     ② hero 第 2 張起的延後載入：它們全在視窗內，loading="lazy" 攔不住，
        改由 build 寫成 data-srcset / data-src，首屏之後才升格為真屬性。
  ------------------------------------------------------------------------ */
  (function () {
    var imgs = document.querySelectorAll('img.bu-img');
    for (var i = 0; i < imgs.length; i++) {
      if (imgs[i].complete && imgs[i].naturalWidth) imgs[i].classList.add('is-loaded');
    }

    function promote() {
      var pend = document.querySelectorAll('picture.bu source[data-srcset], picture.bu img[data-src]');
      for (var j = 0; j < pend.length; j++) {
        var el = pend[j];
        if (el.tagName === 'SOURCE') {
          el.srcset = el.getAttribute('data-srcset');
          el.removeAttribute('data-srcset');
        } else {
          el.src = el.getAttribute('data-src');
          el.removeAttribute('data-src');
        }
      }
    }
    // 等首屏資源跑完再補；載入事件已過就下一輪 macrotask 執行
    if (document.readyState === 'complete') setTimeout(promote, 120);
    else window.addEventListener('load', function () { setTimeout(promote, 120); });
  })();

  /* ---------- ⓪b masonry 閱讀順序（S23，2026-08-09） -------------------------
     舊版位是 CSS `column-count:2`：多欄排版會「先把左欄填滿、再開右欄」，於是策展
     順序的前幾張全擠在左側，讀者由上往下看到的完全不是站主排的順序。
     改成兩欄 grid ＋ 逐張 grid-row span：DOM 順序一個字不動（燈箱 index、SEO、
     無 JS 退路都跟著不動），靠 grid 的自動放置產生「1左 2右 3左…」的交錯閱讀序。
     span 用「已知長寬比 × 實測欄寬」算，不等圖載完 ＝ 零版面跳動、blur-up 照舊。
     沒 JS 就沒有 .is-grid，維持 styles.css 的 column-count 舊行為。
  ------------------------------------------------------------------------ */
  (function () {
    var g = document.querySelector('.gallery.masonry-2');
    if (!g) return;
    var frames = g.querySelectorAll('.gframe');
    if (!frames.length) return;
    var UNIT = 4;                                   // grid-auto-rows 步距（px），與 patch.css 同值
    var single = window.matchMedia('(max-width: 720px)');   // 斷點對齊 styles.css / patch.css

    function ratioOf(f) {
      var r = parseFloat(f.style.getPropertyValue('--ar'));   // build 期由 manifest 寫上
      if (isFinite(r) && r > 0) return r;
      var im = f.querySelector('img');
      var w = im && (+im.getAttribute('width') || im.naturalWidth);
      var h = im && (+im.getAttribute('height') || im.naturalHeight);
      return (w && h) ? (h / w) : 1;
    }

    var lastW = -1;
    function layout() {
      var i;
      if (single.matches) {                          // 單欄：回一般流，源順序天然正確
        lastW = -1;
        g.classList.remove('is-grid');
        for (i = 0; i < frames.length; i++) {
          frames[i].style.gridRow = '';
          frames[i].style.gridColumn = '';
        }
        return;
      }
      g.classList.add('is-grid');                    // 先上 grid，才量得到真正的欄寬
      var colW = frames[0].getBoundingClientRect().width;
      if (!colW) return;
      // 欄寬沒變就別重算：ResizeObserver 看得到自己改出來的高度變化，這道閘擋掉迴圈
      if (Math.abs(colW - lastW) < 0.5) return;
      lastW = colW;
      var mb = parseFloat(getComputedStyle(frames[0]).marginBottom) || 0;
      // 欄與列都自己指派，不交給 grid 自動放置。兩個實測到的理由：
      //   ① 純自動放置＝貪心找「先空出來的那欄」，左邊連兩張矮圖就排出「左左」，
      //      開頭幾張的左右交錯保不住（nature 實測 index 4/5 同欄）。
      //   ② 只釘欄、列留 auto 也不行：自動放置的游標是「兩欄共用且列號單調」的，
      //      換欄時會被上一張的起始列頂著走，短的那張下面就空出一大塊（film 實測
      //      同欄間距被撐到 124px，正常是 41）。釘死起始列才是真 masonry。
      // 前 FORCE 張硬性交錯（讀者第一眼就看得出策展順序是左右走的），其餘填目前
      // 較短的那欄。兩種指派都讓位置單調不倒退 → 第 i+1 張不會跑到第 i 張上方。
      var FORCE = 6, rows = [0, 0];
      for (i = 0; i < frames.length; i++) {
        // 外框高度＝欄寬 × 長寬比，再加自己的下外距；向上取整到步距，避免壓到下一張
        var span = Math.max(1, Math.ceil((colW * ratioOf(frames[i]) + mb) / UNIT));
        var c = i < FORCE ? (i % 2) : (rows[0] <= rows[1] ? 0 : 1);
        frames[i].style.gridColumn = String(c + 1);
        frames[i].style.gridRow = (rows[c] + 1) + ' / span ' + span;
        rows[c] += span;
      }
    }

    var pending = 0;
    function schedule() {
      if (pending) return;
      pending = 1;
      requestAnimationFrame(function () { pending = 0; layout(); });
    }
    layout();                                        // 同步跑一次：首屏不會先閃一下多欄版位
    window.addEventListener('resize', schedule);
    if (window.ResizeObserver) new window.ResizeObserver(schedule).observe(g);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
  })();

  /* ---------- ① fade-up（IntersectionObserver threshold 0.18） ---------- */
  (function () {
    var els = document.querySelectorAll('.fade-up');
    if (!els.length) return;
    if (reduce || !('IntersectionObserver' in window)) {
      for (var i = 0; i < els.length; i++) els[i].classList.add('in');
      return;
    }
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        // 超高元素（如手機單欄 .work-grid，高度遠超視窗）永遠達不到 18% 的
        // intersectionRatio——18% 的高度已經超過視窗本身，門檻恆不成立、
        // fade-up 永不觸發、整片隱形。超過視窗 60% 高的元素改「露面即現」。
        var tall = e.boundingClientRect.height > window.innerHeight * 0.6;
        if (e.isIntersecting && (e.intersectionRatio >= 0.18 || tall)) {
          e.target.classList.add('in'); obs.unobserve(e.target);
        }
      });
    }, { threshold: [0, 0.18] });
    for (var j = 0; j < els.length; j++) obs.observe(els[j]);
  })();

  /* ---------- ② frosted nav ----------------------------------------------
     首頁：捲過 hero（scrollY > min(55vh, 480)）才滑入 —— 既有行為原樣保留
     子頁：data-always → 初始即顯示（class is-static 已由 build 寫死，這裡只
           負責 aria 與捲動指示，不再受捲動位置擺布）
     手機：nav 自身水平捲動，兩側漸層 fade 暗示、選中項自動捲入視野
  ------------------------------------------------------------------------ */
  (function () {
    var bar = document.querySelector('.frosted');
    if (!bar) return;
    var always = bar.getAttribute('data-always') === '1';
    var nav = bar.querySelector('nav');

    if (!always) {
      var onScroll = function () {
        var v = window.scrollY > Math.min(window.innerHeight * 0.55, 480);
        bar.classList.toggle('visible', v);
        bar.setAttribute('aria-hidden', v ? 'false' : 'true');
      };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);
    }

    if (!nav) return;

    // 兩側漸層 fade：只在真的還有內容可滑的那一側出現
    function fades() {
      var over = nav.scrollWidth - nav.clientWidth;
      var x = nav.scrollLeft;
      nav.classList.toggle('can-l', over > 1 && x > 1);
      nav.classList.toggle('can-r', over > 1 && x < over - 1);
    }
    nav.addEventListener('scroll', fades, { passive: true });
    window.addEventListener('resize', fades);

    // 目前選中項自動捲入視野（置中）；用 scrollLeft 而非 scrollIntoView，
    // 免得連帶捲動整頁
    function centerActive() {
      var a = nav.querySelector('a.is-active');
      if (!a || nav.scrollWidth <= nav.clientWidth + 1) return;
      // 用 rect 差值算，不吃 offsetParent（nav 未定位時 offsetLeft 會相對 .frosted）
      var nr = nav.getBoundingClientRect(), ar = a.getBoundingClientRect();
      nav.scrollLeft += (ar.left - nr.left) - (nav.clientWidth - ar.width) / 2;
    }
    centerActive();
    fades();
    // 字型載入會改變寬度，字型就緒後再校一次
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { centerActive(); fades(); });
    }
  })();

  /* ---------- ③ hero 雲影片（每次來訪輪值一支） ------------------------------
     取代原本的 8 張照片輪播。分工：
       · 哪一支 —— <head> 之後的內聯腳本已經算好（localStorage heroVidIdx 遞增），
         連海報一起換掉了；這裡只讀 window.__HERO_IDX，不重算，免得海報與影片不同支。
       · 何時載 —— 等 window load 之後才建 <video>，首屏那一輪網路請求裡沒有 mp4。
       · 哪一版 —— 視窗寬 ≤820px 給 720p（斷點對齊 patch.css 的海報 960 版）。
       · 怎麼接 —— 影片預設 opacity:0，等 playing 才淡入蓋上海報。影片首幀就是海報
         那張圖，所以這道淡入看不出換手，只是把「解碼完成」那一刻磨掉。
       · 支與支之間沒有轉場，循環接點也不融接，吃 loop 屬性的原生硬回切。
     減少動態 / Save-Data：整段不建元素直接 return —— 沒有 <video> 就不會有 mp4 請求。
  ------------------------------------------------------------------------ */
  (function () {
    var mv = document.querySelector('.hero-mv');
    if (!mv) return;
    var list = window.__HERO_VIDEOS;
    if (!list || !list.length) return;

    /* ---- 真機除錯信標（S24）：iPhone 上影片不播，但手上沒有那台機器的 console。
       只在「不是正式網域」時開——本機 / 區網測試會回報，www.jerrythepopper.com
       永遠一則都不發（這道閘門在 dist 產物裡看得到，別拿掉）。
       送到 preview-server.js 的 POST /debug-log，失敗完全靜默：診斷工具不該
       在使用者面前製造第二個錯誤。 ---- */
    var DEBUG = location.hostname !== 'www.jerrythepopper.com';
    function beacon(stage, extra) {
      if (!DEBUG) return;
      try {
        var d = { stage: stage, ua: navigator.userAgent, href: location.href };
        for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) d[k] = extra[k];
        fetch('/debug-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(d),
          keepalive: true,
        }).catch(function () {});
      } catch (err) { /* 靜默 */ }
    }

    var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    var saveData = !!(conn && conn.saveData);
    if (reduce || saveData) {
      mv.setAttribute('data-hero-video', reduce ? 'skipped-reduced-motion' : 'skipped-save-data');
      beacon('skipped', { reduce: reduce, saveData: saveData });
      return;
    }
    beacon('branch-ok', { reduce: false, saveData: false, coarse: coarse, dpr: window.devicePixelRatio || 1 });

    var idx = typeof window.__HERO_IDX === 'number' ? window.__HERO_IDX : 0;
    var item = list[idx] || list[0];

    function mount() {
      var v = document.createElement('video');
      v.className = 'hero-video';
      // muted 一定要在設 src 之前就位，否則 iOS/Safari 判定為有聲自動播放直接擋掉
      v.muted = true;
      v.defaultMuted = true;
      v.setAttribute('muted', '');
      v.loop = true;
      v.playsInline = true;
      v.setAttribute('playsinline', '');
      v.setAttribute('webkit-playsinline', '');
      v.setAttribute('aria-hidden', 'true');
      v.setAttribute('disablepictureinpicture', '');
      v.setAttribute('disableremoteplayback', '');
      // autoplay 屬性：iOS 低電量模式外的自動播放靠它起頭，下面的 play() 只是補刀
      v.autoplay = true;
      v.setAttribute('autoplay', '');
      v.preload = 'auto';
      v.setAttribute('data-hero-idx', String(idx));
      v.setAttribute('data-hero-id', String(item.id || ''));
      // 不掛 poster 屬性：海報已經是底下那層的背景圖，掛了會為了同一張畫面多抓一次
      v.src = (window.innerWidth <= 820 && item.mp4_720) ? item.mp4_720 : item.mp4;

      var shown = false;
      function reveal() { if (!shown) { shown = true; v.classList.add('is-on'); } }
      v.addEventListener('playing', reveal);
      // 自動播放被擋（省電模式等）：至少有畫面可以顯示了就淡入，停在第一幀也比黑底好
      v.addEventListener('loadeddata', function () { if (v.readyState >= 2) reveal(); });

      var scrim = mv.querySelector('.hero-scrim');
      if (scrim) mv.insertBefore(v, scrim); else mv.appendChild(v);

      /* iOS 的自動播放是「有條件的」：muted + playsinline 齊備才准，而且 autoplay 屬性
         有時仍會被擋（低電量模式、剛開分頁還沒互動過）。三道保險由弱到強：
           ① autoplay 屬性 —— 一般情況就夠。
           ② 插入 DOM 後顯式 play() —— 屬性錯過時機（動態建的元素）時補上。
           ③ play() 被拒 → 掛一次性 touchstart/pointerdown，使用者第一次碰螢幕就重試。
         低電量模式連 ③ 都會拒，那就停在海報那一幀 —— 這是預期的降級，不再往下處理。 */
      var retryBound = false;
      function bindTouchRetry() {
        if (retryBound) return;
        retryBound = true;
        function once() {
          document.removeEventListener('touchstart', once, true);
          document.removeEventListener('pointerdown', once, true);
          retryBound = false;
          play();
        }
        document.addEventListener('touchstart', once, true);
        document.addEventListener('pointerdown', once, true);
      }
      function play() {
        var p = v.play();
        if (p && p.catch) p.catch(function (err) {
          beacon('play-rejected', {
            errName: err && err.name, errMessage: err && err.message,
            readyState: v.readyState, networkState: v.networkState,
            mediaErr: v.error ? (v.error.code + ':' + (v.error.message || '')) : null,
            src: v.currentSrc || v.src,
          });
          bindTouchRetry();
        });
      }
      // <video> 自己的錯誤（404 / 不支援的編碼 / 解碼失敗 / 傳輸中斷）走這條
      v.addEventListener('error', function () {
        beacon('video-error', {
          mediaErr: v.error ? (v.error.code + ':' + (v.error.message || '')) : 'unknown',
          readyState: v.readyState, networkState: v.networkState, src: v.currentSrc || v.src,
        });
      });
      // 播成功也回報一則，才分得出「沒收到＝腳本沒跑」還是「收到 ok＝問題在別處」
      v.addEventListener('playing', function () {
        beacon('playing', { readyState: v.readyState, src: v.currentSrc || v.src });
      }, { once: true });
      play();
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) v.pause(); else play();
      });
    }

    if (document.readyState === 'complete') setTimeout(mount, 200);
    else window.addEventListener('load', function () { setTimeout(mount, 200); });
  })();

  /* ---------- ④ Deep Zoom 檢視器（哈蘇限定，OpenSeadragon 按需載入） --------
     一般燈箱給的是「一張大圖」；Deep Zoom 給的是切片金字塔——放到 1:1 也不糊，
     而且只下載視野內那幾塊 tile。344 KB 的 OSD 只在使用者真的點角標時才進場。
     操作：滾輪／雙指／雙擊縮放、拖曳平移、Esc 關閉、+ − 0。
     2026-08-09 S23：←→ 改成「切換上/下一件 DZ 作品」（與燈箱同慣例），平移移到
     Shift+方向鍵；畫面左右另加 ‹ › 鈕，循環走同一頁 DEEPZOOM 表內的作品。
  ------------------------------------------------------------------------ */
  var deepZoom = (function () {
    var libState = 0;                 // 0 未載 / 1 載入中 / 2 就緒 / 3 失敗
    var waiting = [];
    var box = null, viewer = null, zoomEl = null, lastFocus = null, unlockZoom = null, unbindWheel = null, unbindPinch = null;
    // 同頁所有掛了切片的磚（＝DEEPZOOM 表在 DOM 裡的投影），供 ‹ › 循環切換
    var items = [], cur = 0, fallbackFn = null;

    function ensureLib(url, cb) {
      if (libState === 2) { cb(true); return; }
      if (libState === 3) { cb(false); return; }
      waiting.push(cb);
      if (libState === 1) return;
      libState = 1;
      var s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.onload = function () {
        libState = window.OpenSeadragon ? 2 : 3;
        var w = waiting; waiting = [];
        for (var i = 0; i < w.length; i++) w[i](libState === 2);
      };
      s.onerror = function () {
        libState = 3;
        var w = waiting; waiting = [];
        for (var i = 0; i < w.length; i++) w[i](false);
      };
      document.head.appendChild(s);
    }

    function fmtZoom() {
      if (!viewer || !viewer.viewport || !viewer.world.getItemCount()) return;
      var z = viewer.viewport.viewportToImageZoom(viewer.viewport.getZoom(true));
      var pct = z * 100;
      zoomEl.textContent = (pct < 10 ? pct.toFixed(1) : Math.round(pct)) + '%';
    }

    var isArrow = function (k) {
      return k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown';
    };

    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (!viewer || !viewer.viewport) return;
      var vp = viewer.viewport, d = 0.12;
      if (e.key === '+' || e.key === '=') { e.preventDefault(); vp.zoomBy(1.5); vp.applyConstraints(); return; }
      if (e.key === '-' || e.key === '_') { e.preventDefault(); vp.zoomBy(1 / 1.5); vp.applyConstraints(); return; }
      if (e.key === '0') { e.preventDefault(); viewer.viewport.goHome(); return; }
      if (!isArrow(e.key)) return;
      e.preventDefault();
      if (e.shiftKey) {                                    // Shift+方向鍵＝平移（與燈箱同慣例）
        var b = vp.getBounds();
        vp.panBy(new window.OpenSeadragon.Point(
          (e.key === 'ArrowRight' ? d : e.key === 'ArrowLeft' ? -d : 0) * b.width,
          (e.key === 'ArrowDown' ? d : e.key === 'ArrowUp' ? -d : 0) * b.height
        ));
        vp.applyConstraints();
        return;
      }
      if (e.key === 'ArrowLeft') go(-1);                   // 無 Shift 的 ←→＝換作品
      else if (e.key === 'ArrowRight') go(1);
    }

    /* 切換到同頁 DEEPZOOM 表的上/下一件（循環）。沿用同一個 viewer，只換 tileSource：
       OSD 的 open() 會自己 goHome()，縮放/位置因此一併復位。 */
    function go(d) {
      if (!box || !viewer || items.length < 2) return;
      cur = (cur + d + items.length) % items.length;
      var b = items[cur];
      var dzi = b.getAttribute('data-dzi');
      if (!dzi) return;
      fallbackFn = null;                                   // 換過作品後就沒有對應的燈箱退路了
      var l = box.querySelector('.dzv-loading');
      if (l) l.style.display = '';
      box.querySelector('.dzv-label').textContent = b.getAttribute('data-dz-label') || 'Deep Zoom';
      zoomEl.textContent = '—';
      try { viewer.open(dzi); } catch (err) {}
    }

    function close() {
      if (!box) return;
      window.removeEventListener('keydown', onKey);
      if (unlockZoom) { unlockZoom(); unlockZoom = null; }
      if (unbindWheel) { unbindWheel(); unbindWheel = null; }
      if (unbindPinch) { unbindPinch(); unbindPinch = null; }
      if (viewer) { try { viewer.destroy(); } catch (err) {} viewer = null; }
      if (box.parentNode) box.parentNode.removeChild(box);
      box = null; zoomEl = null;
      document.body.style.overflow = '';
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    /* 觸控板滾動縮放（2026-08-09 S32）：OSD 內建 scrollToZoom 對每個 wheel 事件只看
       正負號（見 vendor 原始碼 T()：n = deltaY?deltaY<0?1:-1:0），不管幅度大小都乘一次
       zoomPerScroll —— 滑鼠滾輪一次觸發一個大 delta 的離散事件，觀感正常；觸控板連續
       滾動在同一段動作裡連發幾十個小 delta 事件，同一顆固定倍率被連乘幾十次＝「動一下
       就放超大」。改成倍率正比於 deltaY（見下方 factor 公式）就能把兩種輸入裝置的物理
       手感拉平；deltaMode===1（行模式，少數傳統滑鼠／某些瀏覽器的離散滾輪）先 ×16 折算
       成像素幅度，否則同一份 factor 公式對它幾乎沒反應。
       ctrlKey：Mac 觸控板的雙指捏合在 Chrome/Edge 是包成 wheel+ctrlKey:true 的合成事件
       （非 Safari 專屬的 gesturestart 系列，見下方 bindPinch），deltaY 幅度較大、給較大
       的係數讓捏合手感跟得上手指移動速度。 */
    function dzWheelFactor(e) {
      var dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16;                         // 行模式先折算成像素模式
      else if (e.deltaMode === 2) dy *= (box.clientHeight || window.innerHeight); // 罕見的整頁模式，保底
      return Math.pow(e.ctrlKey ? 1.008 : 1.0022, -dy);
    }
    function dzViewportPoint(e) {
      var mouse = window.OpenSeadragon.getMousePosition(e);
      var off = window.OpenSeadragon.getElementOffset(viewer.canvas);
      return viewer.viewport.pointFromPixel(mouse.minus(off), true);
    }
    function bindWheel(el) {
      function onWheel(e) {
        if (!viewer || !viewer.viewport) return;
        e.preventDefault();
        e.stopPropagation();                // 攔在 OSD 自己掛在 canvas 上的 wheel 處理前面
        viewer.viewport.zoomBy(dzWheelFactor(e), dzViewportPoint(e));
        viewer.viewport.applyConstraints();
      }
      // capture：搶在 OSD 掛於 .dzv-canvas（box 的子節點）上的 bubble-phase 監聽器之前
      // 攔截；配合下方 OSD 初始化把 gestureSettingsMouse.scrollToZoom 關掉，雙保險。
      el.addEventListener('wheel', onWheel, { capture: true, passive: false });
      return function () { el.removeEventListener('wheel', onWheel, { capture: true }); };
    }

    /* Safari 觸控板雙指捏合（2026-08-09 S32）：Mac 觸控板的捏合在 Safari 走
       gesturestart/gesturechange/gestureend（Chrome/Edge 走上面的 wheel+ctrlKey），既有
       lockPageZoom() 只 preventDefault 擋掉頁面縮放，捏合本身沒有任何效果（站主回報
       「捏合手勢無效」）。這裡另掛一組轉譯成 OSD zoomBy 的處理；e.scale 是「相對手勢
       起點」的累計比值（規格：gesturestart 時恆為 1），要拿相鄰兩次 gesturechange 的比值
       才是「這一小段動作」的縮放量，所以每次都跟上一次的 e.scale 相除、再把 prevScale
       更新成當次值。非 Safari 瀏覽器不會發這三個事件，掛了也是靜態零成本。
       真機（iPad/iPhone Safari）雙指仍走 Pointer Events 的多指分支（bindPointer 的
       touch 路徑／OSD 自己的 gestureSettingsTouch.pinchToZoom），跟這裡互不相干。 */
    function bindPinch(el) {
      var active = false, prevScale = 1;
      function start(e) { e.preventDefault(); active = true; prevScale = 1; }
      function change(e) {
        e.preventDefault();
        if (!active || !viewer || !viewer.viewport) return;
        var cur = e.scale;
        var ratio = cur / (prevScale || 1);
        prevScale = cur;
        if (!isFinite(ratio) || ratio <= 0 || ratio === 1) return;
        viewer.viewport.zoomBy(ratio, dzViewportPoint(e));
        viewer.viewport.applyConstraints();
      }
      function end(e) { e.preventDefault(); active = false; }
      var opt = { passive: false };
      el.addEventListener('gesturestart', start, opt);
      el.addEventListener('gesturechange', change, opt);
      el.addEventListener('gestureend', end, opt);
      return function () {
        el.removeEventListener('gesturestart', start, opt);
        el.removeEventListener('gesturechange', change, opt);
        el.removeEventListener('gestureend', end, opt);
      };
    }

    function mount(dzi, label, fallback) {
      box = document.createElement('div');
      box.className = 'dzv';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-label', 'Deep Zoom 檢視器');
      var multi = items.length > 1;
      box.innerHTML =
        '<div class="dzv-loading">Loading tiles…</div>' +
        '<div class="dzv-canvas"></div>' +
        '<button class="lb-btn dzv-close" type="button" aria-label="關閉">✕</button>' +
        (multi
          ? '<button class="lb-btn dzv-prev" type="button" aria-label="上一件 Deep Zoom 作品">‹</button>' +
            '<button class="lb-btn dzv-next" type="button" aria-label="下一件 Deep Zoom 作品">›</button>'
          : '') +
        '<div class="dzv-bar"><span class="dzv-label"></span><span class="dzv-hint"></span></div>' +
        '<div class="dzv-zoom">—</div>';
      box.querySelector('.dzv-label').textContent = label || 'Deep Zoom';
      box.querySelector('.dzv-hint').textContent = coarse
        ? '雙指縮放 · 拖曳平移 · 雙擊放大' + (multi ? ' · ‹ › 切換作品' : '')
        : '滾輪／雙擊縮放 · 拖曳平移' + (multi ? ' · ←→ 切換作品' : '') + ' · ＋ − 0 · ESC 關閉';
      zoomEl = box.querySelector('.dzv-zoom');
      box.querySelector('.dzv-close').addEventListener('click', close);
      if (multi) {
        box.querySelector('.dzv-prev').addEventListener('click', function () { go(-1); });
        box.querySelector('.dzv-next').addEventListener('click', function () { go(1); });
      }
      document.getElementById('root').appendChild(box);
      document.body.style.overflow = 'hidden';
      unlockZoom = lockPageZoom(box);       // 雙指交給 OSD，不讓 Safari 縮放整頁

      viewer = window.OpenSeadragon({
        element: box.querySelector('.dzv-canvas'),
        tileSources: dzi,
        prefixUrl: '',                    // 不用內建按鈕圖 ＝ 零額外請求（零依賴精神）
        showNavigationControl: false,
        showNavigator: false,
        showSequenceControl: false,
        immediateRender: false,
        animationTime: reduce ? 0 : 0.9,
        springStiffness: 7,
        blendTime: reduce ? 0 : 0.25,
        maxZoomPixelRatio: 2,
        minZoomImageRatio: 0.85,
        /* 平移約束（S24 手機真機回報「照片可以拖到幾乎出畫」）：
           visibilityRatio 維持 1 —— 讀過 vendor 的 _applyBoundaryConstraints 才敢寫這行：
           它的算式是 e = (viewport 比 content 大 ? ratio*content : ratio*viewport)，
           所以 1 ＝ 最嚴（縮小時整張圖不准離開視窗、放大時視窗不准離開圖），
           0.85 反而是「准 15% 跑出去」＝比現況更鬆。要「≥85% 可見」，1 是嚴格滿足的那一邊。
           真正的漏洞在 flick 慣性：手指放開後那段動量會衝出邊界，得等彈簧
           （springStiffness 7）慢慢拉回來，中途截圖就是站主看到的那張。
           下面 canvas-drag-end / flick 結束再補一次 applyConstraints 把它釘回去。 */
        visibilityRatio: 1,
        constrainDuringPan: true,
        // scrollToZoom 關閉：wheel 縮放改由下面 bindWheel() 自己算比例式倍率
        // （OSD 內建版本按每個 wheel 事件的正負號固定乘一次係數，觸控板連發會暴衝，
        // 見 bindWheel 註解）；pinchToZoom 給真觸控螢幕用，跟這裡無關，維持開。
        gestureSettingsMouse: { clickToZoom: false, dblClickToZoom: true, scrollToZoom: false },
        gestureSettingsTouch: { pinchToZoom: true, dblClickToZoom: true, flickEnabled: true },
      });
      unbindWheel = bindWheel(box);
      unbindPinch = bindPinch(box);
      // 鍵盤統一由我們處理，避免與 OSD 內建快捷鍵重複作用
      viewer.addHandler('canvas-key', function (e) { e.preventDefaultAction = true; });
      // 拖曳／flick 收手後把畫面釘回邊界內（見上面 visibilityRatio 那段註解）
      // 護欄：applyConstraints 自己也會起一段動畫，不擋的話 animation-finish 會自我回呼
      var snapping = false;
      function snapBack() {
        if (snapping || !viewer || !viewer.viewport) return;
        snapping = true;
        try { viewer.viewport.applyConstraints(); } catch (err) {}
        setTimeout(function () { snapping = false; }, 350);
      }
      viewer.addHandler('canvas-drag-end', snapBack);
      viewer.addHandler('canvas-pinch', snapBack);
      viewer.addHandler('animation-finish', snapBack);
      // 換作品時要再亮一次 Loading，所以只藏不拆（原本是 removeChild）
      viewer.addHandler('open', function () {
        var l = box && box.querySelector('.dzv-loading');
        if (l) l.style.display = 'none';
        fmtZoom();
      });
      viewer.addHandler('zoom', fmtZoom);
      viewer.addHandler('animation', fmtZoom);
      // 切片抓不到就別把使用者卡在空畫布：收掉檢視器，退回一般燈箱
      viewer.addHandler('open-failed', function () {
        var f = fallbackFn;
        close();
        if (f) f();
      });
      window.addEventListener('keydown', onKey);
      box.querySelector('.dzv-close').focus();
    }

    function open(btn, fallback) {
      var dzi = btn.getAttribute('data-dzi');
      var lib = btn.getAttribute('data-osd');
      if (!dzi || !lib) { if (fallback) fallback(); return; }
      // 每次開啟時重建清單（DOM 順序＝data.js 的 DEEPZOOM 順序），‹ › 照它循環
      items = [];
      var all = document.querySelectorAll('.gframe[data-dzi]');
      for (var i = 0; i < all.length; i++) items.push(all[i]);
      cur = Math.max(0, items.indexOf(btn));
      fallbackFn = fallback || null;
      lastFocus = document.activeElement;
      ensureLib(lib, function (ok) {
        if (!ok) { if (fallback) fallback(); return; }   // 載不到就退回一般燈箱
        mount(dzi, btn.getAttribute('data-dz-label'), fallback);
      });
    }

    return { open: open };
  })();

  /* ---------- ⑤ lightbox --------------------------------------------------
     既有：點圖開；Esc 關 / ← → 換圖；計數器；鎖捲動 —— 全數保留
     新增：縮放到圖片原生解析度、拖曳平移、雙指縮放、雙擊縮放、滾輪縮放
     鍵盤：Enter/Space 切換縮放（stage 可 Tab 聚焦）、+ / - 級進、0 復位、
           Shift+方向鍵平移；← → 維持換圖（換圖時自動復位縮放）
  ------------------------------------------------------------------------ */
  (function () {
    var gallery = document.querySelector('.gallery');
    if (!gallery) return;
    var frames = gallery.querySelectorAll('.gframe');
    if (!frames.length) return;

    // 燈箱一律吃「最大可用 tier」（build 把它寫在磚上的 data-full*；產線沒收錄的
    // 圖沒有這些屬性，退回磚上縮圖的 src ＝ 舊行為）
    var srcs = [], avifs = [], alts = [];
    for (var i = 0; i < frames.length; i++) {
      var im = frames[i].querySelector('img');
      var full = frames[i].getAttribute('data-full');
      srcs.push(full || (im ? (im.getAttribute('src') || im.currentSrc || '') : ''));
      avifs.push(frames[i].getAttribute('data-full-avif') || '');
      alts.push(im ? (im.getAttribute('alt') || '') : '');
    }

    var lb = null, stage = null, pic = null, stageImg = null, counter = null, hint = null, dzBtn = null;
    var index = 0, lastFocus = null, unlockZoom = null;

    // 縮放狀態
    var scale = 1, tx = 0, ty = 0, fitW = 0, fitH = 0, maxScale = 1;

    function pad2(n) { return String(n).length < 2 ? '0' + n : String(n); }
    function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

    /* ----- 幾何 ----- */
    function applyTransform() {
      stageImg.style.transform = 'translate3d(' + tx + 'px,' + ty + 'px,0) scale(' + scale + ')';
    }
    function clampPan() {
      var mx = Math.max(0, (fitW * scale - window.innerWidth) / 2);
      var my = Math.max(0, (fitH * scale - window.innerHeight) / 2);
      tx = clamp(tx, -mx, mx);
      ty = clamp(ty, -my, my);
    }
    function measure() {
      fitW = stageImg.offsetWidth || 1;
      fitH = stageImg.offsetHeight || 1;
      var nat = stageImg.naturalWidth || fitW;
      var t = nat / fitW;                 // 目標＝圖片原生解析度
      if (!isFinite(t) || t < 1.2) t = 2; // 原生比顯示還小時仍給一段可用的放大
      maxScale = clamp(t, 1, 8);
    }
    function syncZoomState() {
      var z = scale > 1.01;
      lb.classList.toggle('is-zoomed', z);
      stage.setAttribute('aria-pressed', z ? 'true' : 'false');
      if (coarse) {
        hint.textContent = z ? '單指拖曳平移 · 雙擊縮回 · 雙指縮放' : '雙擊放大 · 雙指縮放 · 點背景關閉';
      } else {
        hint.textContent = z ? '拖曳平移 · 點擊縮回 · ESC 關閉' : '點擊放大 · ESC 關閉';
      }
      stage.setAttribute('aria-label', z ? '縮回原尺寸' : '放大圖片至原生解析度');
    }
    function resetZoom() {
      scale = 1; tx = 0; ty = 0;
      if (stageImg) { applyTransform(); syncZoomState(); }
    }
    // 以 (cx,cy) 視窗座標為錨點縮放，讓該點在畫面上不動
    function zoomTo(ns, cx, cy) {
      ns = clamp(ns, 1, maxScale);
      var W = window.innerWidth / 2, H = window.innerHeight / 2;
      var px = cx - (W + tx), py = cy - (H + ty);
      var k = ns / scale;
      tx = cx - px * k - W;
      ty = cy - py * k - H;
      scale = ns;
      if (scale <= 1.001) { scale = 1; tx = 0; ty = 0; }
      clampPan(); applyTransform(); syncZoomState();
    }
    function toggleZoom(cx, cy) {
      if (scale > 1.01) { resetZoom(); }
      else { zoomTo(maxScale, cx, cy); }
    }

    /* ----- 建構 ----- */
    function build() {
      lb = document.createElement('div');
      lb.className = 'lb';
      lb.setAttribute('role', 'dialog');
      lb.setAttribute('aria-modal', 'true');
      lb.setAttribute('aria-label', '圖片檢視');
      lb.innerHTML =
        '<button class="lb-btn lb-close" type="button" aria-label="關閉">✕</button>' +
        '<button class="lb-btn lb-prev" type="button" aria-label="上一張">‹</button>' +
        '<button class="lb-btn lb-next" type="button" aria-label="下一張">›</button>' +
        '<div class="lb-stage" tabindex="0" role="button" aria-pressed="false" aria-label="放大圖片至原生解析度"><picture class="lb-pic"><img alt=""></picture></div>' +
        '<div class="lb-bar"><div class="lb-count-row"><div class="lb-counter"></div>' +
        '<button class="lb-dz" type="button" hidden>Deep Zoom <span aria-hidden="true">↗</span></button></div>' +
        '<div class="lb-hint"></div></div>';
      stage = lb.querySelector('.lb-stage');
      pic = lb.querySelector('.lb-pic');
      stageImg = pic.querySelector('img');
      counter = lb.querySelector('.lb-counter');
      hint = lb.querySelector('.lb-hint');
      dzBtn = lb.querySelector('.lb-dz');

      lb.addEventListener('click', close);                                   // 點背景關閉（既有）
      stage.addEventListener('click', function (e) { e.stopPropagation(); });
      lb.querySelector('.lb-close').addEventListener('click', function (e) { e.stopPropagation(); close(); });
      lb.querySelector('.lb-prev').addEventListener('click', function (e) { e.stopPropagation(); step(-1); });
      lb.querySelector('.lb-next').addEventListener('click', function (e) { e.stopPropagation(); step(1); });
      // 轉乘：翻到有切片的那幾張時，計數器旁浮出入口 —— 關燈箱、換 Deep Zoom 檢視器接手
      dzBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var f = frames[index];
        if (!f || !f.getAttribute('data-dzi')) return;
        var i = index;
        close();
        deepZoom.open(f, function () { open(i); });      // OSD 載不到就把燈箱開回來
      });

      window.addEventListener('resize', function () {
        if (!lb || lb.style.display === 'none') return;
        measure(); clampPan(); applyTransform(); syncZoomState();
      });

      bindPointer();
      bindStageKeys();
      document.getElementById('root').appendChild(lb);
    }

    /* ----- 指標：滑鼠拖曳平移／單擊切換；觸控單指平移／雙擊切換／雙指縮放 ----- */
    function bindPointer() {
      var pts = {}, n = 0, drag = null, pinch = null, downT = 0, moved = 0, lastTap = 0;
      // swipe 換張用：整段手勢的淨位移，以及「這段手勢曾經多指」的旗標
      var sdx = 0, sdy = 0, multi = false;
      var SWIPE = 40;                        // 水平位移門檻（px）

      function arr() { var a = []; for (var k in pts) a.push(pts[k]); return a; }
      function count() { var c = 0; for (var k in pts) c++; return c; }

      stage.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        try { stage.setPointerCapture(e.pointerId); } catch (err) {}
        pts[e.pointerId] = { x: e.clientX, y: e.clientY };
        n = count();
        if (n === 1) {
          downT = Date.now(); moved = 0; pinch = null;
          sdx = 0; sdy = 0; multi = false;
          drag = { x: e.clientX, y: e.clientY, tx: tx, ty: ty };
        } else if (n === 2) {
          multi = true;                      // 進過雙指就不再算 swipe（與縮放手勢互斥）
          drag = null;
          var a = arr();
          var d = Math.sqrt(Math.pow(a[0].x - a[1].x, 2) + Math.pow(a[0].y - a[1].y, 2)) || 1;
          pinch = { d0: d, s0: scale, cx: (a[0].x + a[1].x) / 2, cy: (a[0].y + a[1].y) / 2, tx0: tx, ty0: ty };
          stage.classList.add('is-dragging');
        }
      });

      stage.addEventListener('pointermove', function (e) {
        if (!(e.pointerId in pts)) return;
        pts[e.pointerId].x = e.clientX; pts[e.pointerId].y = e.clientY;
        if (pinch && count() >= 2) {
          var a = arr();
          var d = Math.sqrt(Math.pow(a[0].x - a[1].x, 2) + Math.pow(a[0].y - a[1].y, 2)) || 1;
          var mx = (a[0].x + a[1].x) / 2, my = (a[0].y + a[1].y) / 2;
          var ns = clamp(pinch.s0 * (d / pinch.d0), 1, maxScale);
          var k = ns / pinch.s0;
          var W = window.innerWidth / 2, H = window.innerHeight / 2;
          var px = pinch.cx - (W + pinch.tx0), py = pinch.cy - (H + pinch.ty0);
          scale = ns; tx = mx - px * k - W; ty = my - py * k - H;
          clampPan(); applyTransform(); syncZoomState();
        } else if (drag) {
          var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
          sdx = dx; sdy = dy;
          moved = Math.max(moved, Math.abs(dx) + Math.abs(dy));
          if (scale > 1.01) {
            stage.classList.add('is-dragging');
            tx = drag.tx + dx; ty = drag.ty + dy;
            clampPan(); applyTransform();
          }
        }
      });

      function up(e) {
        if (!(e.pointerId in pts)) return;
        delete pts[e.pointerId];
        n = count();
        stage.classList.remove('is-dragging');
        if (pinch && n < 2) { pinch = null; drag = null; }
        if (drag && n === 0) {
          /* 未放大時的單指水平滑動＝換張（iOS 慣例：左滑看下一張）。
             三道排除，免得跟既有手勢打架：① 放大中留給平移；② 這段手勢進過雙指
             （縮放）就不算；③ 水平位移要明顯壓過垂直，避免捲頁誤觸。 */
          if (scale <= 1.01 && !multi && Math.abs(sdx) >= SWIPE && Math.abs(sdx) > Math.abs(sdy) * 1.2) {
            step(sdx < 0 ? 1 : -1);
            drag = null; sdx = 0; sdy = 0;
            return;
          }
          var tap = moved < 6 && (Date.now() - downT) < 400;
          if (tap) {
            if (e.pointerType === 'mouse') {
              toggleZoom(e.clientX, e.clientY);
            } else {
              var now = Date.now();
              if (now - lastTap < 320) { toggleZoom(e.clientX, e.clientY); lastTap = 0; }
              else { lastTap = now; }
            }
          }
          drag = null;
        }
      }
      stage.addEventListener('pointerup', up);
      stage.addEventListener('pointercancel', up);

      // 2026-08-09 S32：與 Deep Zoom 檢視器（deepZoom.bindWheel 那段）同一條公式——
      // 倍率正比於 deltaY，觸控板連發的小 delta 才不會被當成滑鼠整顆滾輪算，一路乘到暴衝；
      // ctrlKey：Mac 觸控板雙指捏合在 Chrome/Edge 會包成 wheel+ctrlKey:true，給較大係數；
      // deltaMode===1（行模式）先 ×16 折算成像素，這裡原本就是比例式，只是先前沒吃這兩項。
      stage.addEventListener('wheel', function (e) {
        e.preventDefault();
        var dy = e.deltaY;
        if (e.deltaMode === 1) dy *= 16;
        else if (e.deltaMode === 2) dy *= window.innerHeight;
        var factor = Math.pow(e.ctrlKey ? 1.008 : 1.0022, -dy);
        zoomTo(scale * factor, e.clientX, e.clientY);
      }, { passive: false });
    }

    /* ----- stage 鍵盤：Enter / Space 切換縮放 ----- */
    function bindStageKeys() {
      stage.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault(); e.stopPropagation();
          toggleZoom(window.innerWidth / 2, window.innerHeight / 2);
        }
      });
    }

    /* ----- 換圖 / 開關 ----- */
    // 每次換圖重建 <picture>：改既有 <source> 的 srcset 在各家瀏覽器的重選時機
    // 不一致，整段重建才保證 AVIF/WebP 協商每張都重新跑一次
    function attr(s) {
      return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    }
    function paint() {
      resetZoom();
      // 整顆 <picture> 換新（含 img 的 src 一起寫成字串）：格式協商只跑一次、只抓一個檔。
      // 兩個實測到的多抓陷阱都靠這招避開：① 先塞 <source> 再用 JS 指派 img.src 會多抓一份
      // WebP；② 用 innerHTML 就地覆蓋時，舊 <img> 會先失去 <source> 兄弟而回頭去抓自己的
      // src（＝上一張的 WebP）。整顆替換就沒有「舊 img 短暫沒有 source」的空窗。
      var np = document.createElement('picture');
      np.className = 'lb-pic';
      np.innerHTML =
        (avifs[index] ? '<source type="image/avif" srcset="' + attr(avifs[index]) + '">' : '') +
        '<img alt="' + attr(alts[index]) + '" src="' + attr(srcs[index]) + '">';
      stage.replaceChild(np, pic);
      pic = np;
      stageImg = pic.querySelector('img');
      stageImg.addEventListener('load', function () { measure(); clampPan(); applyTransform(); });
      counter.textContent = pad2(index + 1) + ' ／ ' + pad2(srcs.length);
      // 這張掛得起切片才亮轉乘鈕；翻到沒切片的就收起來（hidden 也一併退出 Tab 序）
      var hasDz = !!(frames[index] && frames[index].getAttribute('data-dzi'));
      dzBtn.hidden = !hasDz;
      measure(); syncZoomState();
    }
    function step(d) { index = (index + d + srcs.length) % srcs.length; paint(); }

    function focusables() {
      // 焦點環按 DOM 序；轉乘鈕只有在這張有切片時才在序列裡（hidden 就跳過）
      var all = lb.querySelectorAll('.lb-close, .lb-prev, .lb-next, .lb-stage, .lb-dz');
      var out = [];
      for (var i = 0; i < all.length; i++) if (!all[i].hidden) out.push(all[i]);
      return out;
    }

    function onKey(e) {
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'Tab') {                                   // 對話框焦點環（不外漏到背景頁）
        var f = focusables(); if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        return;
      }
      if (e.shiftKey && scale > 1.01 &&
          (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();                                    // 放大時 Shift+方向鍵＝平移
        var s = 60;
        if (e.key === 'ArrowLeft') tx += s;
        if (e.key === 'ArrowRight') tx -= s;
        if (e.key === 'ArrowUp') ty += s;
        if (e.key === 'ArrowDown') ty -= s;
        clampPan(); applyTransform();
        return;
      }
      if (e.key === 'ArrowLeft') { step(-1); return; }          // 既有行為
      if (e.key === 'ArrowRight') { step(1); return; }
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomTo(scale * 1.5, window.innerWidth / 2, window.innerHeight / 2); return; }
      if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomTo(scale / 1.5, window.innerWidth / 2, window.innerHeight / 2); return; }
      if (e.key === '0') { e.preventDefault(); resetZoom(); return; }
    }

    function open(i) {
      if (!lb) build();
      index = i;
      lb.style.display = '';
      paint();
      lastFocus = document.activeElement;
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', onKey);
      unlockZoom = lockPageZoom(lb);        // 開啟期間雙指只作用在照片上
      lb.querySelector('.lb-close').focus();
    }
    function close() {
      if (!lb) return;
      resetZoom();
      lb.style.display = 'none';
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
      if (unlockZoom) { unlockZoom(); unlockZoom = null; }
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    for (var k = 0; k < frames.length; k++) {
      (function (idx) {
        frames[idx].addEventListener('click', function () {
          // 掛了切片的磚走 Deep Zoom 檢視器；OSD 載不到才退回一般燈箱
          if (frames[idx].getAttribute('data-dzi')) {
            deepZoom.open(frames[idx], function () { open(idx); });
            return;
          }
          open(idx);
        });
      })(k);
    }
  })();
})();
