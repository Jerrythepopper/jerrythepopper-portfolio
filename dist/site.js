/* =============================================================================
   site.js — 靜態站互動層（vanilla，零依賴）
   復刻原 React 雛形四件互動：hero 輪播 / frosted nav / fade-up / lightbox
   由 build-site.js 原樣複製到 dist\site.js
   ============================================================================= */
(function () {
  'use strict';

  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

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

  /* ---------- ② frosted nav（scrollY > min(55vh, 480)） ---------- */
  (function () {
    var bar = document.querySelector('.frosted');
    if (!bar) return;
    var onScroll = function () {
      var v = window.scrollY > Math.min(window.innerHeight * 0.55, 480);
      bar.classList.toggle('visible', v);
      bar.setAttribute('aria-hidden', v ? 'false' : 'true');
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
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

  /* ---------- ④ lightbox（點圖開；Esc / ← / →；計數器；鎖捲動） ---------- */
  (function () {
    var gallery = document.querySelector('.gallery');
    if (!gallery) return;
    var frames = gallery.querySelectorAll('.gframe');
    if (!frames.length) return;

    var srcs = [];
    for (var i = 0; i < frames.length; i++) {
      var img = frames[i].querySelector('img');
      srcs.push(img ? img.getAttribute('src') : '');
    }

    var lb = null, stageImg = null, counter = null, index = 0, lastFocus = null;

    function pad2(n) { return String(n).length < 2 ? '0' + n : String(n); }

    function build() {
      lb = document.createElement('div');
      lb.className = 'lb';
      lb.innerHTML =
        '<button class="lb-btn lb-close" type="button" aria-label="Close">✕</button>' +
        '<button class="lb-btn lb-prev" type="button" aria-label="Previous">‹</button>' +
        '<button class="lb-btn lb-next" type="button" aria-label="Next">›</button>' +
        '<div class="lb-stage"><img alt=""><div class="lb-counter"></div></div>';
      stageImg = lb.querySelector('.lb-stage img');
      counter = lb.querySelector('.lb-counter');
      lb.addEventListener('click', close);
      lb.querySelector('.lb-stage').addEventListener('click', function (e) { e.stopPropagation(); });
      lb.querySelector('.lb-close').addEventListener('click', function (e) { e.stopPropagation(); close(); });
      lb.querySelector('.lb-prev').addEventListener('click', function (e) { e.stopPropagation(); step(-1); });
      lb.querySelector('.lb-next').addEventListener('click', function (e) { e.stopPropagation(); step(1); });
      document.getElementById('root').appendChild(lb);
    }

    function paint() {
      stageImg.src = srcs[index];
      counter.textContent = pad2(index + 1) + ' ／ ' + pad2(srcs.length);
    }
    function step(d) { index = (index + d + srcs.length) % srcs.length; paint(); }

    function onKey(e) {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    }

    function open(i) {
      if (!lb) build();
      index = i; paint();
      lb.style.display = '';
      lastFocus = document.activeElement;
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', onKey);
      lb.querySelector('.lb-close').focus();
    }
    function close() {
      if (!lb) return;
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
