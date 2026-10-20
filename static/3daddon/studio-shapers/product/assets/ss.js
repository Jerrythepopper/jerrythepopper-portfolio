(function () {
  'use strict';
  var root = document.documentElement;
  var embed = root.classList.contains('is-embed');
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  if (!embed) {
    document.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest && e.target.closest('.theme-toggle');
      if (!btn) return;
      var cur = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      var next = cur === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('jtpTheme', next); } catch (err) {}
      $$('meta[name="theme-color"]').forEach(function (m) {
        m.removeAttribute('media');
        m.setAttribute('content', next === 'dark' ? '#15161d' : '#f7f7f7');
      });
    });
  }
  var M = window.SS_MANIFEST || null;
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (reduce) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-motion-video]'), function (v) {
      v.removeAttribute('autoplay'); try { v.pause(); } catch (err) {} v.controls = true;
    });
  }
  (function () {
    var im = document.querySelector('[data-hero-img]');
    if (!im || reduce || (im.complete && im.naturalWidth)) return;
    im.style.animationPlayState = 'paused';
    function go() { im.style.animationPlayState = ''; }
    im.addEventListener('load', go); im.addEventListener('error', go);
  })();
  (function () {
    var box = document.querySelector('[data-gearloop]');
    if (!box) return;
    var imgs = Array.prototype.slice.call(box.querySelectorAll('.gl-img'));
    var plate = box.querySelector('[data-gl-plate]'), count = box.querySelector('[data-gl-count]');
    var play = box.querySelector('[data-gl-play]');
    var STEP_MS = 1100, cur = 0, userPaused = reduce, inView = false, timer = null, ready = {};
    function decoded(i) {
      if (ready[i]) return Promise.resolve();
      var im = imgs[i];
      var p = im.decode ? im.decode() : new Promise(function (res) { if (im.complete) res(); else im.onload = res; });
      return p.then(function () { ready[i] = true; });
    }
    function show(i) {
      i = (i + imgs.length) % imgs.length;
      imgs[i].loading = 'eager';
      return decoded(i).then(function () {
        imgs.forEach(function (im, k) { im.classList.toggle('on', k === i); });
        cur = i; plate.textContent = imgs[i].getAttribute('data-gl-name');
        count.textContent = (i + 1) + ' / ' + imgs.length;
      }, function () {});
    }
    function running() { return !userPaused && inView && !document.hidden; }
    function tick() {
      timer = null;
      if (!running()) return;
      var next = (cur + 1) % imgs.length;
      if (!ready[next]) { decoded(next).catch(function () {}); timer = setTimeout(tick, 250); return; }
      show(next); timer = setTimeout(tick, STEP_MS);
    }
    function sync() {
      if (running() && !timer) timer = setTimeout(tick, STEP_MS);
      if (!running() && timer) { clearTimeout(timer); timer = null; }
    }
    play.setAttribute('aria-pressed', userPaused ? 'true' : 'false');
    play.addEventListener('click', function () {
      userPaused = !userPaused; play.setAttribute('aria-pressed', userPaused ? 'true' : 'false'); sync();
    });
    box.querySelector('[data-gl-prev]').addEventListener('click', function () { show(cur - 1); if (timer) { clearTimeout(timer); timer = null; } sync(); });
    box.querySelector('[data-gl-next]').addEventListener('click', function () { show(cur + 1); if (timer) { clearTimeout(timer); timer = null; } sync(); });
    document.addEventListener('visibilitychange', sync);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        inView = es[es.length - 1].isIntersecting;
        if (inView) imgs.forEach(function (im, k) { if (k) { im.loading = 'eager'; decoded(k).catch(function () {}); } });
        sync();
      }, { threshold: 0.2 }).observe(box.querySelector('.gl-frame'));
    } else { inView = true; sync(); }
  })();
  function entry(id) { return (M && M.images && M.images[id]) || null; }
  function decodeImg(im) {
    if (im.decode) return im.decode();
    return new Promise(function (res, rej) { if (im.complete && im.naturalWidth) res(); else { im.onload = res; im.onerror = rej; } });
  }
  function whenNear(el, fn) {
    if (!('IntersectionObserver' in window)) { fn(); return; }
    var io = new IntersectionObserver(function (es) {
      if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); fn(); }
    }, { rootMargin: '600px 0px' });
    io.observe(el);
  }
  function idle(fn) { if (window.requestIdleCallback) window.requestIdleCallback(fn, { timeout: 2000 }); else setTimeout(fn, 200); }
  function minus(s) { return String(s).replace('-', '−'); }
  function fx(u) { return Math.max(0, Math.min(100, (u - 0.25) / 0.5 * 100)).toFixed(1) + '%'; }
  function Stack(frame) { this.frame = frame; this.layers = {}; this.want = null; this.tag = $('[data-ph-tag]', frame); }
  Stack.prototype.layer = function (id) {
    var e = entry(id), k = e && e.src ? e.src : id;
    if (this.layers[k]) return this.layers[k];
    var self = this, im = new Image();
    im.className = 'stk'; im.alt = ''; im.setAttribute('aria-hidden', 'true'); im.decoding = 'async';
    if (e) {
      im.width = e.w; im.height = e.h;
      if (e.focus_u != null) im.style.setProperty('--fx', fx(e.focus_u));
      if (e.src) im.src = e.src;
    }
    function put() { self.frame.insertBefore(im, self.frame.firstChild); return im; }
    var ready = decodeImg(im).then(put, put);
    return (this.layers[k] = { img: im, ready: ready, key: k });
  };
  Stack.prototype.preload = function (ids) { var s = this; ids.forEach(function (id) { s.layer(id); }); };
  Stack.prototype.show = function (id, alt) {
    var self = this, L = this.layer(id), e = entry(id);
    this.want = L.key;
    return L.ready.then(function (im) {
      if (self.want !== L.key) return;
      im.classList.add('on'); im.alt = alt || ''; im.removeAttribute('aria-hidden');
      Object.keys(self.layers).forEach(function (k) {
        if (k === L.key) return;
        var o = self.layers[k].img; o.classList.remove('on'); o.alt = ''; o.setAttribute('aria-hidden', 'true');
      });
      if (self.tag) { if (e && e.status === 'placeholder') self.tag.removeAttribute('hidden'); else self.tag.setAttribute('hidden', ''); }
    });
  };
  function radios(btns, onPick) {
    btns.forEach(function (b, i) {
      b.addEventListener('click', function () { onPick(i, false); });
      b.addEventListener('keydown', function (e) {
        var n = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % btns.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + btns.length) % btns.length;
        else if (e.key === 'Home') n = 0;
        else if (e.key === 'End') n = btns.length - 1;
        if (n === null) return;
        e.preventDefault(); onPick(n, true);
      });
    });
  }
  function check(btns, i, focus) {
    btns.forEach(function (b, j) { b.setAttribute('aria-checked', j === i ? 'true' : 'false'); b.tabIndex = j === i ? 0 : -1; });
    if (focus) btns[i].focus();
  }
  var GP = {};
  $$('[data-gp]').forEach(function (gp) {
    var key = gp.getAttribute('data-gp');
    var G = M && (M.gear || []).filter(function (g) { return g.key === key; })[0];
    if (!G) return;
    var panel = gp.closest('[data-gear-panel]');
    var hot = $('[data-hot]', gp), plate = $('[data-gp-plate]', gp);
    var abBtns = $$('[data-ab]', panel);
    var range = $('[data-step-input]', panel), out = $('[data-step-out]', panel);
    var sGear = new Stack($('[data-gp-gear]', gp)), sRes = new Stack($('[data-gp-result]', gp));
    var b = G.hotspot.bbox;
    hot.style.left = (b[0] * 100) + '%'; hot.style.top = (b[1] * 100) + '%';
    hot.style.width = ((b[2] - b[0]) * 100) + '%'; hot.style.height = ((b[3] - b[1]) * 100) + '%';
    var hotLabel = hot.getAttribute('data-hot-label'), hotTag = $('.hot-tag', hot);
    if (hotLabel && hotTag) hotTag.textContent = hotLabel;
    var P = G.param, steps = G.steps;
    range.min = 0; range.max = steps.length - 1;
    range.value = Math.floor((steps.length - 1) / 2);
    function fmt(v) {
      if (v == null) return '';
      return P.unit === 'deg' ? minus(Math.round(v)) + '°' : minus(v.toFixed(P.digits)) + ' ' + P.unit;
    }
    $('[data-step-min]', panel).textContent = fmt((entry(steps[0]) || {}).value);
    $('[data-step-max]', panel).textContent = fmt((entry(steps[steps.length - 1]) || {}).value);
    var labelA = abBtns[0].textContent, labelB = abBtns[1].textContent;
    var state = { ab: 'B', step: null }, started = false;
    function render() {
      sGear.show(state.ab === 'A' ? G.gearclose.A : G.gearclose.B,
        G.name + ' seen from another angle, ' + (state.ab === 'A' ? 'taken away' : 'in place'));
      var rid, label;
      if (state.step !== null) { rid = steps[state.step]; label = P.label + ' ' + fmt((entry(rid) || {}).value); }
      else { rid = state.ab === 'A' ? G.close.A : G.close.B; label = state.ab === 'A' ? labelA : labelB; }
      var zoomed = resFrame.classList.contains('zoomed');
      sRes.show(rid, 'Camera view: ' + label + (zoomed ? ', face enlarged ' + G.zoom + ' times' : ''));
      plate.textContent = label + (zoomed ? ' · ' + G.zoom + '×' : '');
      hot.setAttribute('aria-pressed', state.ab === 'B' ? 'true' : 'false');
      check(abBtns, state.ab === 'A' ? 0 : 1, false);
      out.textContent = fmt((entry(steps[+range.value]) || {}).value);
    }
    if (G.gearclose_lit) {
      var gl = document.createElement('span'); gl.className = 'plate plate-left'; gl.textContent = 'Set view (work lights on)';
      $('[data-gp-gear]', gp).appendChild(gl);
    }
    var resFrame = $('[data-gp-result]', gp), zoomBtn = null;
    function zoomOrigin() {
      var on = $('img.stk.on', resFrame), e = entry(state.step !== null ? steps[state.step] : (state.ab === 'A' ? G.close.A : G.close.B)) || {};
      var u = e.focus_u != null ? e.focus_u : 0.5, v = e.focus_v != null ? e.focus_v : 0.35;
      var fw = resFrame.clientWidth, fh = resFrame.clientHeight, nw = (on && on.naturalWidth) || e.w || 2, nh = (on && on.naturalHeight) || e.h || 1;
      var k = Math.max(fw / nw, fh / nh), dw = nw * k, dh = nh * k;
      var px = on ? parseFloat(getComputedStyle(on).objectPosition.split(' ')[0]) / 100 : 0.5;
      if (isNaN(px)) px = 0.5;
      var x = (fw - dw) * px + u * dw, y = (fh - dh) * 0.5 + v * dh;
      resFrame.style.setProperty('--zx', (x / fw * 100).toFixed(1) + '%');
      resFrame.style.setProperty('--zy', (y / fh * 100).toFixed(1) + '%');
    }
    if (G.zoom) {
      zoomBtn = document.createElement('button');
      zoomBtn.type = 'button'; zoomBtn.className = 'tool-btn zoom-btn'; zoomBtn.setAttribute('aria-pressed', 'false');
      zoomBtn.textContent = 'Zoom on the face (' + G.zoom + '×)';
      resFrame.style.setProperty('--zk', G.zoom);
      $('.gp-controls', panel).appendChild(zoomBtn);
      zoomBtn.addEventListener('click', function () {
        var z = zoomBtn.getAttribute('aria-pressed') !== 'true';
        zoomOrigin();
        zoomBtn.setAttribute('aria-pressed', z ? 'true' : 'false');
        resFrame.classList.toggle('zoomed', z);
        render();
      });
      window.addEventListener('resize', function () { if (resFrame.classList.contains('zoomed')) zoomOrigin(); });
    }
    function setAB(ab) { state.ab = ab; state.step = null; render(); }
    hot.addEventListener('click', function () { setAB(state.ab === 'B' ? 'A' : 'B'); });
    radios(abBtns, function (i, focus) { setAB(i === 0 ? 'A' : 'B'); if (focus) abBtns[i].focus(); });
    range.addEventListener('input', function () { state.step = +range.value; state.ab = 'B'; render(); });
    function activate(first) {
      if (started) return;
      started = true;
      sGear.preload([G.gearclose.A, G.gearclose.B]);
      sRes.preload([G.close.B, G.close.A]);
      render();
      idle(function () { sRes.preload(steps); });
      if (first && !reduce) {
        sGear.layer(G.gearclose.B).ready.then(function () {
          hot.classList.add('pulse');
          hot.addEventListener('animationend', function () { hot.classList.remove('pulse'); }, { once: true });
        });
      }
    }
    GP[key] = { activate: activate };
  });
  $$('[data-gear]').forEach(function (box) {
    var btns = $$('[data-gear-key]', box);
    var panels = $$('[data-gear-panel]', box);
    function select(i, focus) {
      btns.forEach(function (b, j) {
        b.setAttribute('aria-checked', j === i ? 'true' : 'false');
        b.tabIndex = j === i ? 0 : -1;
      });
      var key = btns[i].getAttribute('data-gear-key');
      panels.forEach(function (p) {
        if (p.getAttribute('data-gear-panel') === key) p.removeAttribute('hidden');
        else p.setAttribute('hidden', '');
      });
      current = key;
      if (near && GP[key]) GP[key].activate(true);
      if (focus) btns[i].focus();
    }
    var current = null, near = false;
    whenNear(box, function () { near = true; if (GP[current]) GP[current].activate(true); });
    btns.forEach(function (b, i) {
      b.addEventListener('click', function () { select(i, false); });
      b.addEventListener('keydown', function (e) {
        var n = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % btns.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + btns.length) % btns.length;
        else if (e.key === 'Home') n = 0;
        else if (e.key === 'End') n = btns.length - 1;
        if (n === null) return;
        e.preventDefault();
        select(n, true);
      });
    });
    select(0, false);
  });
  var CMP = {};
  function pairOf(path) {
    var o = M && M.toggles; path.split('.').forEach(function (k) { o = o ? o[k] : null; }); return o;
  }
  $$('[data-cmp]').forEach(function (cmp) {
    var grip = $('[data-grip]', cmp);
    var pos = 50;
    var bxKey = cmp.getAttribute('data-bx-for');
    var pair = cmp.hasAttribute('data-pair') ? pairOf(cmp.getAttribute('data-pair')) : null;
    if (pair) {
      var ph = false;
      ['A', 'B'].forEach(function (ab) {
        var e = entry(pair[ab]), lay = $('[data-layer="' + ab + '"]', cmp);
        if (!e || !lay) return;
        var im = new Image(); im.src = e.src; im.width = e.w; im.height = e.h; im.loading = 'lazy'; im.decoding = 'async';
        im.alt = (ab === 'A' ? $('.side-a', cmp) : $('.side-b', cmp)).textContent;
        lay.appendChild(im);
        if (e.status === 'placeholder') ph = true;
      });
      var tg = $('[data-ph-tag]', cmp); if (tg && ph) tg.removeAttribute('hidden');
    }
    function setPos(p, quiet) {
      pos = Math.max(0, Math.min(100, p));
      cmp.style.setProperty('--split', pos + '%');
      grip.setAttribute('aria-valuenow', String(Math.round(pos)));
      grip.setAttribute('aria-valuetext', Math.round(pos) + '%');
      if (bxKey && !quiet) syncBox(bxKey, pos);
    }
    if (bxKey) (CMP[bxKey] = CMP[bxKey] || []).push({ setPos: setPos });
    var dragging = false;
    function fromEvent(e) {
      var r = cmp.getBoundingClientRect();
      setPos((e.clientX - r.left) / r.width * 100);
    }
    cmp.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true;
      try { cmp.setPointerCapture(e.pointerId); } catch (err) {}
      fromEvent(e);
    });
    cmp.addEventListener('pointermove', function (e) { if (dragging) fromEvent(e); });
    function end(e) {
      if (!dragging) return;
      dragging = false;
      try { cmp.releasePointerCapture(e.pointerId); } catch (err) {}
    }
    cmp.addEventListener('pointerup', end);
    cmp.addEventListener('pointercancel', end);
    grip.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? 10 : 2, n = null;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') n = pos - step;
      else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') n = pos + step;
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = 100;
      if (n === null) return;
      e.preventDefault();
      setPos(n);
    });
    setPos(50);
  });
  function syncBox(key, pos) {
    var st = pos <= 0 ? 'true' : (pos >= 100 ? 'false' : 'mixed');
    $$('[data-bx="' + key + '"]').forEach(function (b) { b.setAttribute('aria-pressed', st); });
  }
  $$('[data-bx]').forEach(function (b) {
    var key = b.getAttribute('data-bx');
    b.addEventListener('click', function () {
      var on = b.getAttribute('aria-pressed') !== 'true';
      (CMP[key] || []).forEach(function (c) { c.setPos(on ? 0 : 100, true); });
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  });
  (function () {
    var box = $('[data-topmap]');
    if (!box || !M || !M.topmap) return;
    var T = M.topmap, NA = T.n_azimuth, NH = T.n_heights, STEP = 360 / NA;
    var map = $('[data-tm-map]', box), svg = $('[data-tm-svg]', box);
    var light = $('[data-tm-light]', box), ray = $('[data-tm-ray]', box), barDot = $('[data-tm-bardot]', box);
    var hud = $('[data-tm-hud]', box), readout = $('[data-tm-readout]', box), note = $('[data-tm-note]', box);
    var stack = new Stack($('[data-tm-frame]', box));
    var X0 = 20, SZ = 220, BAR_X = 256, BAR_Y0 = 240, BAR_H = 220, VB_W = 300, VB_H = 276;
    var hr = T.height_range_m, span = hr[1] - hr[0];
    var grid = {};
    T.cells.forEach(function (c) { grid[(Math.round(c.az_deg / STEP) % NA) + ':' + c.h_level] = c; });
    function cell(ai, hi) { return grid[(((ai % NA) + NA) % NA) + ':' + hi]; }
    var start = T.cells.filter(function (c) { return c.name === T.start; })[0] || T.cells[0];
    var cur = { ai: Math.round(start.az_deg / STEP) % NA, hi: start.h_level };
    var aimY = BAR_Y0 - (T.aim_z_m - hr[0]) / span * BAR_H;
    $('[data-tm-aimtick]', box).setAttribute('y1', aimY.toFixed(1));
    $('[data-tm-aimtick]', box).setAttribute('y2', aimY.toFixed(1));
    function signedAz(az) { return az > 180 ? az - 360 : az; }
    function draw() {
      var c = cell(cur.ai, cur.hi), x = X0 + c.map_xy[0] * SZ, y = X0 + c.map_xy[1] * SZ;
      light.setAttribute('cx', x.toFixed(1)); light.setAttribute('cy', y.toFixed(1));
      ray.setAttribute('x2', x.toFixed(1)); ray.setAttribute('y2', y.toFixed(1));
      barDot.setAttribute('cy', (BAR_Y0 - c.bar_t * BAR_H).toFixed(1));
      var elev = Math.round(c.elevation_deg);
      hud.textContent = 'H ' + c.h_m.toFixed(2) + ' m · Elev ' + minus(elev) + '°';
      readout.textContent = 'Azimuth ' + minus(Math.round(signedAz(c.az_deg) * 10) / 10) + '° · Height ' +
        c.h_m.toFixed(1) + ' m · Elevation ' + minus(elev) + '°';
      var e = entry(c.image);
      if (!live) return;
      stack.show(c.image, 'The head lit by one softbox, azimuth ' + minus(Math.round(signedAz(c.az_deg))) + ' degrees, height ' + c.h_m.toFixed(1) + ' m');
      if (e && e.missing) {
        var s = cell(0, 0); T.cells.forEach(function (k) { if (k.name === e.stand_in) s = k; });
        note.textContent = 'Not rendered yet · showing azimuth ' + minus(Math.round(signedAz(s.az_deg))) + '°, ' + s.h_m.toFixed(1) + ' m';
        note.removeAttribute('hidden');
      } else note.setAttribute('hidden', '');
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var n = cell(cur.ai + d[0], cur.hi + d[1]); if (n) stack.layer(n.image);
      });
    }
    function set(ai, hi) {
      ai = ((ai % NA) + NA) % NA; hi = Math.max(0, Math.min(NH - 1, hi));
      if (ai === cur.ai && hi === cur.hi) return;
      cur.ai = ai; cur.hi = hi; draw();
    }
    function pt(e) {
      var r = svg.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width * VB_W, y: (e.clientY - r.top) / r.height * VB_H };
    }
    var mode = null, pid = null;
    function apply(p) {
      if (mode === 'bar') {
        var t = (BAR_Y0 - p.y) / BAR_H, lv = T.levels_bar_t, best = 0;
        lv.forEach(function (v, i) { if (Math.abs(v - t) < Math.abs(lv[best] - t)) best = i; });
        set(cur.ai, best);
      } else if (mode === 'ring') {
        var dx = p.x - 130, dy = p.y - 130;
        if (dx * dx + dy * dy < 36) return;
        var az = Math.atan2(dx, dy) * 180 / Math.PI;
        set(Math.round(az / STEP), cur.hi);
      }
    }
    map.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      var p = pt(e);
      mode = p.x >= BAR_X ? 'bar' : 'ring'; pid = e.pointerId;
      try { map.setPointerCapture(e.pointerId); } catch (err) {}
      map.classList.add('dragging');
      apply(p);
    });
    map.addEventListener('pointermove', function (e) { if (mode && e.pointerId === pid) apply(pt(e)); });
    function end(e) {
      if (!mode || e.pointerId !== pid) return;
      mode = null; map.classList.remove('dragging');
      try { map.releasePointerCapture(e.pointerId); } catch (err) {}
    }
    map.addEventListener('pointerup', end);
    map.addEventListener('pointercancel', end);
    map.addEventListener('keydown', function (e) {
      var d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
      if (!d) return;
      e.preventDefault(); set(cur.ai + d[0], cur.hi + d[1]);
    });
    $$('[data-tm-step]', box).forEach(function (b) {
      var s = b.getAttribute('data-tm-step').split(':'), n = +s[1];
      b.addEventListener('click', function () { if (s[0] === 'az') set(cur.ai + n, cur.hi); else set(cur.ai, cur.hi + n); });
    });
    var live = false;
    draw();
    whenNear(box, function () {
      live = true; draw();
      var rest = T.cells.map(function (c) { return c.image; }), i = 0;
      setTimeout(function next() {
        idle(function () {
          rest.slice(i, i + 4).forEach(function (id) { stack.layer(id); });
          i += 4; if (i < rest.length) setTimeout(next, 250);
        });
      }, 1500);
    });
  })();
  (function () {
    var box = $('[data-pick]');
    if (!box || !M) return;
    var tabs = $$('[data-pick-tab]', box), groups = $$('[data-pick-group]', box);
    var stack = new Stack($('[data-pick-frame]', box));
    var nameEl = $('[data-pick-name]', box), lineEl = $('[data-pick-line]', box);
    var loaded = false;
    function pickBtn(btn) {
      var key = btn.getAttribute('data-setup'), nm = $('.pick-name', btn).textContent;
      nameEl.textContent = nm; lineEl.textContent = btn.getAttribute('data-line');
      if (loaded) stack.show('setup_' + key, nm + ' lighting setup');
    }
    groups.forEach(function (g) {
      var btns = $$('[data-setup]', g);
      radios(btns, function (i, focus) { check(btns, i, focus); pickBtn(btns[i]); });
    });
    function showGroup(i, focus) {
      check(tabs, i, focus);
      var key = tabs[i].getAttribute('data-pick-tab');
      groups.forEach(function (g) {
        if (g.getAttribute('data-pick-group') === key) g.removeAttribute('hidden'); else g.setAttribute('hidden', '');
      });
      var g = groups.filter(function (x) { return x.getAttribute('data-pick-group') === key; })[0];
      pickBtn($('[aria-checked="true"]', g) || $('[data-setup]', g));
    }
    radios(tabs, showGroup);
    whenNear(box, function () {
      loaded = true;
      $$('[data-setup]', box).forEach(function (btn) {
        var e = entry('thumb_' + btn.getAttribute('data-setup'));
        if (!e) return;
        var im = new Image(); im.src = e.src; im.width = e.w; im.height = e.h; im.alt = ''; im.decoding = 'async';
        $('.pick-img', btn).appendChild(im);
      });
      showGroup(tabs[1].getAttribute('aria-checked') === 'true' ? 1 : 0, false);
      idle(function () { $$('[data-setup]', box).forEach(function (btn) { stack.layer('setup_' + btn.getAttribute('data-setup')); }); });
    });
  })();
  $$('[data-stepper]').forEach(function (el) {
    var S = M && M.steppers && M.steppers[el.getAttribute('data-stepper')];
    if (!S) return;
    var range = $('[data-step-input]', el), out = $('[data-step-out]', el);
    var views = $$('[data-stp-view]', el).map(function (f) { return { name: f.getAttribute('data-stp-view'), stack: new Stack(f) }; });
    var first = S.views[views[0].name];
    range.min = 0; range.max = first.length - 1;
    range.value = Math.min(first.length - 1, +(el.getAttribute('data-start') || 0));
    function fmt(v) {
      if (v == null) return '';
      if (S.unit === 'stops') return minus((v > 0 ? '+' : '') + v.toFixed(S.digits)) + ' stops';
      return minus(v.toFixed(S.digits)) + ' ' + S.unit;
    }
    $('[data-step-min]', el).textContent = fmt((entry(first[0]) || {}).value);
    $('[data-step-max]', el).textContent = fmt((entry(first[first.length - 1]) || {}).value);
    var on = false;
    function render() {
      var i = +range.value, v = (entry(first[i]) || {}).value;
      out.textContent = fmt(v);
      if (!on) return;
      views.forEach(function (w) { w.stack.show(S.views[w.name][i], S.label + ' ' + fmt(v) + ', ' + (w.name === 'gear' ? 'the gear' : 'the face')); });
    }
    range.addEventListener('input', render);
    render();
    whenNear(el, function () {
      on = true; render();
      idle(function () { views.forEach(function (w) { w.stack.preload(S.views[w.name]); }); });
    });
  });
  (function () {
    var box = $('[data-types]');
    if (!box || !M || !M.types) return;
    var SB = M.sbsize, DR = M.doors;
    var btns = $$('[data-type]', box);
    var gearFrame = $('[data-ty-gear]', box), resFrame = $('[data-ty-result]', box);
    var sGear = new Stack(gearFrame), sRes = new Stack(resFrame);
    var hotBox = $('[data-hot-box]', box), hotName = $('[data-hot-name]', box);
    var gearPlate = $('[data-ty-gearplate]', box), resPlate = $('[data-ty-plate]', box);
    var nameEl = $('[data-ty-name]', box), lineEl = $('[data-ty-line]', box), link = $('[data-ty-link]', box);
    var zoomBtn = $('[data-ty-zoom]', box);
    var stSize = $('[data-ty-step="size"]', box), stDoors = $('[data-ty-step="doors"]', box);
    var rSize = $('input', stSize), rDoors = $('input', stDoors);
    var oSize = $('[data-step-out]', stSize), oDoors = $('[data-step-out]', stDoors);
    var doorsFrame = $('[data-ty-doors-frame]', box), doorsPlate = $('[data-ty-doors-plate]', box);
    var sDoors = new Stack(doorsFrame);
    var byKey = {};
    M.types.forEach(function (t) { byKey[t.key] = t; });
    var state = { key: btns[0].getAttribute('data-type'), size: null, doors: DR.start }, live = false;
    function wh(w, h) { return w.toFixed(2) + ' × ' + h.toFixed(2) + ' m'; }
    function deg(v) { return v == null ? '' : Math.round(v) + '°'; }
    rSize.min = 0; rSize.max = SB.steps.length - 1; rSize.value = SB.start;
    rDoors.min = 0; rDoors.max = DR.steps.length - 1; rDoors.value = DR.start;
    var sbMin = SB.steps[0], sbMax = SB.steps[SB.steps.length - 1];
    $('[data-step-min]', stSize).textContent = wh(sbMin.width_m, sbMin.height_m);
    $('[data-step-max]', stSize).textContent = wh(sbMax.width_m, sbMax.height_m);
    var doorsLo = deg((entry(DR.steps[0]) || {}).value), doorsHi = deg((entry(DR.steps[DR.steps.length - 1]) || {}).value);
    $('[data-step-min]', stDoors).textContent = doorsLo;
    $('[data-step-max]', stDoors).textContent = doorsHi;
    if (doorsLo) $('[data-doors-min]', box).textContent = doorsLo;
    if (doorsHi) $('[data-doors-max]', box).textContent = doorsHi;
    function place(b) {
      hotBox.style.left = (b[0] * 100) + '%'; hotBox.style.top = (b[1] * 100) + '%';
      hotBox.style.width = ((b[2] - b[0]) * 100) + '%'; hotBox.style.height = ((b[3] - b[1]) * 100) + '%';
    }
    function render() {
      var t = byKey[state.key];
      if (!t) return;
      var gid = t.gearview, gbox = t.hotspot.bbox, gnote = 'Set view (work lights on)';
      var rid = t.result, rnote = '', headCam = !!t.emits;
      if (t.key === 'SOFTBOX' && state.size !== null) {
        var s = SB.steps[state.size], big = state.size >= SB.gearview.max_from_step, ref = big ? sbMax : sbMin;
        rid = s.id;
        gid = big ? SB.gearview.max : SB.gearview.min;
        gbox = (big ? SB.hotspot.max : SB.hotspot.min).bbox;
        gnote += ' · gear at ' + wh(ref.width_m, ref.height_m);
        rnote = wh(s.width_m, s.height_m);
      } else if (!t.emits) {
        rnote = 'Close view from Gear';
      }
      place(gbox);
      hotName.textContent = t.hot || t.name;
      gearPlate.textContent = gnote;
      resPlate.textContent = rnote;
      zoomBtn.disabled = !headCam;
      if (!headCam && resFrame.classList.contains('zoomed')) { resFrame.classList.remove('zoomed'); zoomBtn.setAttribute('aria-pressed', 'false'); }
      var zoomed = resFrame.classList.contains('zoomed');
      oSize.textContent = state.size === null ? 'As applied, ' + wh(SB.as_applied.width_m, SB.as_applied.height_m) : wh(SB.steps[state.size].width_m, SB.steps[state.size].height_m);
      var dId = DR.steps[state.doors], dDeg = deg((entry(dId) || {}).value);
      oDoors.textContent = dDeg;
      doorsPlate.textContent = 'Doors at ' + dDeg;
      if (!live) return;
      sGear.show(gid, t.name + ' standing in the set, seen from another angle');
      sRes.show(rid, 'Camera view with the ' + t.name + (rnote ? ', ' + rnote : '') + (zoomed ? ', face enlarged 2 times' : ''));
      sDoors.show(dId, 'Wide view of the Barn Doors with the doors at ' + dDeg);
    }
    function pick(i) {
      var b = btns[i], t = byKey[b.getAttribute('data-type')];
      state.key = t.key; state.size = null;
      rSize.value = SB.start;
      t.hot = b.getAttribute('data-hot-label') || '';
      nameEl.textContent = t.name; lineEl.textContent = b.getAttribute('data-line');
      if (t.gear_tab) { link.removeAttribute('hidden'); link.setAttribute('data-tab', t.gear_tab); } else link.setAttribute('hidden', '');
      if (t.key === 'SOFTBOX') stSize.removeAttribute('hidden'); else stSize.setAttribute('hidden', '');
      render();
    }
    radios(btns, function (i, focus) { check(btns, i, focus); pick(i); });
    rSize.addEventListener('input', function () { state.size = +rSize.value; render(); });
    rDoors.addEventListener('input', function () { state.doors = +rDoors.value; render(); });
    zoomBtn.addEventListener('click', function () {
      if (zoomBtn.disabled) return;
      var z = zoomBtn.getAttribute('aria-pressed') !== 'true';
      zoomBtn.setAttribute('aria-pressed', z ? 'true' : 'false');
      resFrame.classList.toggle('zoomed', z);
      render();
    });
    link.addEventListener('click', function () {
      var tb = $('[data-gear-key="' + link.getAttribute('data-tab') + '"]');
      if (tb) tb.click();
    });
    pick(0);
    whenNear(box, function () {
      live = true;
      btns.forEach(function (b) {
        var e = entry(byKey[b.getAttribute('data-type')].thumb);
        if (!e) return;
        var im = new Image(); im.src = e.src; im.width = e.w; im.height = e.h; im.alt = ''; im.decoding = 'async';
        $('.pick-img', b).appendChild(im);
      });
      render();
      idle(function () {
        M.types.forEach(function (t) { sGear.layer(t.gearview); sRes.layer(t.result); });
        sRes.preload(SB.steps.map(function (s) { return s.id; })); sDoors.preload(DR.steps);
        sGear.preload([SB.gearview.min, SB.gearview.max]);
      });
    });
  })();
  (function () {
    var box = $('[data-gels]');
    if (!box || !M || !M.gels || !M.gels.families) return;
    var G = M.gels, btns = $$('[data-gel-fam]', box), stack = new Stack($('[data-gel-frame]', box));
    var plate = $('[data-gel-plate]', box), read = $('[data-gel-read]', box);
    var range = $('[data-gel-step]', box), out = $('[data-gel-out]', box);
    var lo = $('[data-gel-min]', box), hi = $('[data-gel-max]', box);
    var byKey = {}, live = false;
    G.families.forEach(function (f) { byKey[f.key] = f; });
    var state = { fam: btns[0].getAttribute('data-gel-fam'), step: 0 };
    function item() { return G.items[byKey[state.fam].steps[state.step]]; }
    function show() {
      var f = byKey[state.fam], g = item();
      range.max = f.steps.length - 1; range.value = state.step;
      range.setAttribute('aria-valuetext', g.label);
      lo.textContent = G.items[f.steps[0]].strength; hi.textContent = G.items[f.steps[f.steps.length - 1]].strength;
      out.textContent = g.strength;
      plate.textContent = g.label;
      read.textContent = g.gel === 'NONE' ? 'No gel: all three lights are white.' :
        g.label + ' on the main light: lets ' + Math.round(g.passes * 100) + '% through (' + minus(g.stops.toFixed(1)) + ' stops).';
      if (live) stack.show(g.id, 'Three-Point, ' + (g.gel === 'NONE' ? 'no gel' : g.label + ' on the main light'));
    }
    function pick(i) {
      var was = item().strength, f = byKey[btns[i].getAttribute('data-gel-fam')];
      state.fam = f.key;
      var keep = -1;
      f.steps.forEach(function (s, k) { if (G.items[s].strength === was) keep = k; });
      state.step = keep >= 0 ? keep : f.steps.length - 1;
      show();
    }
    radios(btns, function (i, focus) { check(btns, i, focus); pick(i); });
    range.addEventListener('input', function () { state.step = +range.value; show(); });
    state.step = byKey[state.fam].steps.length - 1;
    show();
    whenNear(box, function () {
      live = true; show();
      idle(function () { stack.preload(Object.keys(G.items).map(function (k) { return G.items[k].id; })); });
    });
  })();
  (function () {
    var box = $('[data-solo]');
    if (!box || !M || !M.solo) return;
    var S = M.solo, list = $('[data-solo-rows]', box), all = $('[data-solo-all]', box), bar = $('[data-solo-bar]', box);
    var plate = $('[data-solo-plate]', box), stack = new Stack($('[data-solo-frame]', box)), live = false, solo = -1;
    var SUN = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="2.8"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"/></svg>';
    var STAR = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.6l1.9 4.1 4.5.5-3.4 3 1 4.4L8 11.3l-4 2.3 1-4.4-3.4-3 4.5-.5z"/></svg>';
    $('[data-ll-count]', box).textContent = String(S.rows.length);
    var rows = S.rows.map(function (r, i) {
      var li = document.createElement('li'); li.className = 'll-row';
      var nm = document.createElement('span'); nm.className = 'll-name'; nm.textContent = r.name;
      var st = document.createElement('span'); st.className = 'll-st';
      if (r.is_main) { st.innerHTML = SUN; st.setAttribute('title', 'Main light'); st.setAttribute('aria-label', 'Main light'); st.setAttribute('role', 'img'); }
      else st.textContent = minus((r.stops_vs_main > 0 ? '+' : '') + r.stops_vs_main.toFixed(1)) + ' st';
      var b = document.createElement('button'); b.type = 'button'; b.className = 'll-star'; b.innerHTML = STAR;
      b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-label', 'Solo ' + r.name);
      b.addEventListener('click', function () { set(solo === i ? -1 : i); });
      li.appendChild(nm); li.appendChild(st); li.appendChild(b); list.appendChild(li);
      return { li: li, btn: b };
    });
    function set(i) {
      solo = i;
      rows.forEach(function (r, j) {
        r.btn.setAttribute('aria-pressed', j === i ? 'true' : 'false');
        r.li.classList.toggle('is-off', i >= 0 && j !== i);
      });
      bar.textContent = i >= 0 ? 'Solo: ' + S.rows[i].name : '';
      all.disabled = i < 0;
      plate.textContent = i >= 0 ? 'Solo: ' + S.rows[i].name : 'All lights on';
      if (live) stack.show(i >= 0 ? S.rows[i].image : S.all, i >= 0 ? 'Three-Point, only the ' + S.rows[i].name + ' light on' : 'Three-Point, all three lights on');
    }
    all.addEventListener('click', function () { var was = solo; set(-1); rows[was >= 0 ? was : 0].btn.focus(); });
    set(-1);
    whenNear(box, function () { live = true; set(solo); idle(function () { stack.preload([S.all].concat(S.rows.map(function (r) { return r.image; }))); }); });
  })();
  (function () {
    var nav = document.getElementById('chapters');
    if (!nav) return;
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target && e.target.closest && e.target.closest('a[data-jump], a[href^="#"]');
      if (!a) return;
      var t = document.getElementById((a.getAttribute('href') || '').slice(1));
      if (!t) return;
      e.preventDefault();
      t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
      try { t.focus({ preventScroll: true }); } catch (err) {}
    });
    if (embed) return;
    var links = $$('.chapters-list a[data-jump]', nav);
    var secs = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
    var rail = document.createElement('nav');
    rail.className = 'rail';
    rail.setAttribute('aria-label', 'Chapter progress');
    var ol = document.createElement('ol');
    var dots = links.map(function (a) {
      var n = $('.n', a).textContent, nm = $('.nm', a).textContent;
      var li = document.createElement('li');
      var d = document.createElement('a');
      d.href = a.getAttribute('href');
      d.setAttribute('data-jump', '');
      d.setAttribute('aria-label', n + ' ' + nm);
      d.innerHTML = '<span class="rail-dot" aria-hidden="true"></span><span class="rail-name" aria-hidden="true"><span class="n"></span></span>';
      $('.rail-name .n', d).textContent = n;
      $('.rail-name', d).appendChild(document.createTextNode(nm));
      li.appendChild(d); ol.appendChild(li);
      return d;
    });
    rail.appendChild(ol);
    var bar = document.createElement('div');
    bar.className = 'readbar';
    bar.setAttribute('aria-hidden', 'true');
    var fill = document.createElement('span');
    bar.appendChild(fill);
    document.body.appendChild(rail);
    document.body.appendChild(bar);
    var cur = -2, inBand = secs.map(function () { return false; });
    function setCur(k) {
      if (k === cur) return;
      cur = k;
      dots.forEach(function (d, i) { if (i === k) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
    }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { var i = secs.indexOf(e.target); if (i >= 0) inBand[i] = e.isIntersecting; });
        setCur(inBand.indexOf(true));
      }, { rootMargin: '-45% 0px -54% 0px' });
      secs.forEach(function (s) { if (s) io.observe(s); });
    }
    var raf = 0;
    function progress() {
      raf = 0;
      var max = root.scrollHeight - window.innerHeight;
      var p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      fill.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    }
    function queue() { if (!raf) raf = requestAnimationFrame(progress); }
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    progress();
  })();
})();
