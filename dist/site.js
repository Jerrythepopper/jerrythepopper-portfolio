/* =============================================================================
   site.js — 靜態站互動層（vanilla，零依賴）
   復刻原 React 雛形四件互動：hero 輪播 / frosted nav / fade-up / lightbox
   2026-08-08 UI 修正包：手機導覽單行滑動、子頁導覽常駐、燈箱縮放平移
   由 build-site.js 原樣複製到 dist\site.js
   ============================================================================= */
(function () {
  'use strict';

  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

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
        if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); }
      });
    }, { threshold: 0.18 });
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

  /* ---------- ③ hero 輪播（5s，圓點可點） ---------- */
  (function () {
    var mv = document.querySelector('.hero-mv');
    if (!mv) return;
    var slides = mv.querySelectorAll('.hero-slide');
    var dots = document.querySelectorAll('.hero-dots button');
    if (slides.length < 2) return;
    var active = 0, timer = null;

    function show(n) {
      active = (n + slides.length) % slides.length;
      for (var i = 0; i < slides.length; i++) slides[i].classList.toggle('is-active', i === active);
      for (var j = 0; j < dots.length; j++) dots[j].classList.toggle('is-active', j === active);
    }
    function start() { if (!reduce) { stop(); timer = setInterval(function () { show(active + 1); }, 5000); } }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    for (var k = 0; k < dots.length; k++) {
      (function (idx) {
        dots[idx].addEventListener('click', function () { show(idx); start(); });
      })(k);
    }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else start();
    });
    start();
  })();

  /* ---------- ④ lightbox --------------------------------------------------
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

    var srcs = [], alts = [];
    for (var i = 0; i < frames.length; i++) {
      var im = frames[i].querySelector('img');
      srcs.push(im ? im.getAttribute('src') : '');
      alts.push(im ? (im.getAttribute('alt') || '') : '');
    }

    var lb = null, stage = null, stageImg = null, counter = null, hint = null;
    var index = 0, lastFocus = null;

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
        '<div class="lb-stage" tabindex="0" role="button" aria-pressed="false" aria-label="放大圖片至原生解析度"><img alt=""></div>' +
        '<div class="lb-bar"><div class="lb-counter"></div><div class="lb-hint"></div></div>';
      stage = lb.querySelector('.lb-stage');
      stageImg = lb.querySelector('.lb-stage img');
      counter = lb.querySelector('.lb-counter');
      hint = lb.querySelector('.lb-hint');

      lb.addEventListener('click', close);                                   // 點背景關閉（既有）
      stage.addEventListener('click', function (e) { e.stopPropagation(); });
      lb.querySelector('.lb-close').addEventListener('click', function (e) { e.stopPropagation(); close(); });
      lb.querySelector('.lb-prev').addEventListener('click', function (e) { e.stopPropagation(); step(-1); });
      lb.querySelector('.lb-next').addEventListener('click', function (e) { e.stopPropagation(); step(1); });

      stageImg.addEventListener('load', function () { measure(); clampPan(); applyTransform(); });
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

      function arr() { var a = []; for (var k in pts) a.push(pts[k]); return a; }
      function count() { var c = 0; for (var k in pts) c++; return c; }

      stage.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        try { stage.setPointerCapture(e.pointerId); } catch (err) {}
        pts[e.pointerId] = { x: e.clientX, y: e.clientY };
        n = count();
        if (n === 1) {
          downT = Date.now(); moved = 0; pinch = null;
          drag = { x: e.clientX, y: e.clientY, tx: tx, ty: ty };
        } else if (n === 2) {
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

      stage.addEventListener('wheel', function (e) {
        e.preventDefault();
        zoomTo(scale * Math.exp(-e.deltaY * 0.0018), e.clientX, e.clientY);
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
    function paint() {
      resetZoom();
      stageImg.src = srcs[index];
      stageImg.alt = alts[index];
      counter.textContent = pad2(index + 1) + ' ／ ' + pad2(srcs.length);
      measure(); syncZoomState();
    }
    function step(d) { index = (index + d + srcs.length) % srcs.length; paint(); }

    function focusables() {
      return lb.querySelectorAll('.lb-close, .lb-prev, .lb-next, .lb-stage');
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
      lb.querySelector('.lb-close').focus();
    }
    function close() {
      if (!lb) return;
      resetZoom();
      lb.style.display = 'none';
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    for (var k = 0; k < frames.length; k++) {
      (function (idx) {
        frames[idx].addEventListener('click', function () { open(idx); });
      })(k);
    }
  })();
})();
