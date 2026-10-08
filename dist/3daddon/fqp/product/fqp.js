/* =============================================================================
   fqp.js — FQP 商品頁原型互動層（vanilla，零依賴，無追蹤）
   語彙沿用網站 src-site/site.js：reduce 旗標（:11）、jtpTheme 切換（:92-122）、
   fade-up 觀察器（:262-282）。嵌入模式（html.is-embed）不讀不寫 localStorage。
   ============================================================================= */
(function () {
  'use strict';

  var root = document.documentElement;
  var embed = root.classList.contains('is-embed');
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  /* ---------- 深淺切換（同網站鍵名 jtpTheme；嵌入模式整段不掛） ---------- */
  (function () {
    if (embed) return;
    var KEY = 'jtpTheme';
    function systemDark() {
      return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    function current() {
      var t = root.getAttribute('data-theme');
      return (t === 'dark' || t === 'light') ? t : (systemDark() ? 'dark' : 'light');
    }
    var ttTimer = null;
    document.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest && e.target.closest('.theme-toggle');
      if (!btn) return;
      var next = current() === 'dark' ? 'light' : 'dark';
      if (!reduce) {
        root.classList.add('theme-transitioning');
        clearTimeout(ttTimer);
        ttTimer = setTimeout(function () { root.classList.remove('theme-transitioning'); }, 420);
      }
      root.setAttribute('data-theme', next);
      try { localStorage.setItem(KEY, next); } catch (err) {}
      $$('meta[name="theme-color"]').forEach(function (m) {
        m.removeAttribute('media');
        m.setAttribute('content', next === 'dark' ? '#15161d' : '#f7f7f7');
      });
    });
  })();

  /* ---------- fade-up（IntersectionObserver threshold 0.18，同網站） ---------- */
  function onReveal(el, fn) {
    if (reduce || !('IntersectionObserver' in window)) { fn(); return; }
    var o = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { fn(); o.disconnect(); }
      });
    }, { threshold: 0.35 });
    o.observe(el);
  }
  (function () {
    var els = $$('.fade-up');
    if (reduce || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var tall = e.boundingClientRect.height > window.innerHeight * 0.6;
        if (e.isIntersecting && (e.intersectionRatio >= 0.18 || tall)) {
          e.target.classList.add('in'); obs.unobserve(e.target);
        }
      });
    }, { threshold: [0, 0.18] });
    els.forEach(function (el) { obs.observe(el); });
  })();

  /* ---------- 共用：radiogroup（點選＋←→ Home End，roving tabindex） ---------- */
  function radioGroup(group, onChange) {
    var btns = $$('[role="radio"]', group);
    function select(i, focus) {
      btns.forEach(function (b, j) {
        b.setAttribute('aria-checked', j === i ? 'true' : 'false');
        b.tabIndex = j === i ? 0 : -1;
      });
      if (focus) btns[i].focus();
      onChange(btns[i], i);
    }
    btns.forEach(function (b, i) {
      b.addEventListener('click', function () { select(i, false); });
    });
    group.addEventListener('keydown', function (e) {
      var i = btns.indexOf(document.activeElement);
      if (i < 0) return;
      var n = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = Math.min(btns.length - 1, i + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = Math.max(0, i - 1);
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = btns.length - 1;
      if (n === null) return;
      e.preventDefault();
      select(n, true);
    });
    return { select: select, buttons: btns };
  }

  /* ---------- 01 反彈階梯步進器（W3a：四條階梯，一個場景負責一條光路；不閃） ----------
     LADDERS 每條階梯的欄位：
       name     分頁名（用在刻度上方的小標「<name> bounces」與 alt）
       scene    場景名（只用在 alt）
       triple   true＝三格並排版型（雲：左固定 Default · 0、中＝點選的那一格 Selected · N、右固定 Measured · 48），
                否則單張 2:1（圖左上角標牌 Selected · N）
       w, h     網頁素材的像素尺寸
       ns       刻度上的全部格數（照規格 §3.1）
       missing  圖還沒補到的格：刻度照畫但 disabled，title「frame not rendered yet」，不預載、不發請求
                （W3b：補算的格子都到了，四條都是空清單；機制保留）
       marks    記號 { def, visual, strict }；null＝沒有來源 → 這條階梯不畫記號
                （數值只能來自算圖單 W3r 的 markers.json，不准自己推）
       src(n)   該格的圖
     起始格＝Strict 那一格（雲 48、樹葉 24、Diffuse 32、Transmission 24）；
     沒有記號資料、或 Strict 那一格缺圖時＝最高的可用格。
     不閃的做法：所有階梯的可用幀在區塊接近視窗時一次預載（new Image()＋decode()），
     解碼完才以 <img class="stk"> 疊進圖框（雲的幀疊進中間那一格）。切換＝把目標幀加 .on、其他拿掉
     （同一個 task 內，瀏覽器只畫一次）；目標幀若還沒解碼完，舊幀維持顯示，等 decode() 完成才換
     → 永遠不出空白幀。三格版型整組（.tri）也在同一個 task 內開關。
     <img data-stepper-img data-lb> 是 lightbox 的點擊目標（data-lb-src＝目前那一格）。 */
  (function () {
    var box = $('[data-stepper]');
    if (!box) return;
    var frame = $('[data-stepper-frame]', box);
    var base = $('[data-stepper-img]', box);
    var tri = $('[data-stepper-tri]', box);
    var triMid = $('[data-tri-mid]', box);
    var triLeft = $('[data-tri-left]', box);
    var triRight = $('[data-tri-right]', box);
    var outs = $$('[data-stepper-n]', box);
    var types = $$('[data-stepper-type]', box);
    var group = $('[data-stepper-group]', box);
    var marks = $('[data-stepper-marks]', box);
    var caps = $$('[data-cap]', box);
    var ladderGroup = $('[data-ladder-group]', box);
    var MARK_ROWS = 3;                  // 記號區固定三列高（fqp.css .marks），四條階梯同高
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    var LADDERS = {
      volume: { name: 'Volume', scene: 'Cloud', triple: true, w: 640, h: 960,
                ns: [0, 4, 8, 12, 16, 24, 32, 48, 64], missing: [],
                // 記號四條都照 markers.json（W3r，2026-10-08）：def＝factory.value、visual／strict＝報告的
                // apply.visual／apply.strict.<channel>。雲、樹葉的值與規格 §3.1 的已知值相同。
                marks: { def: 0, visual: 48, strict: 48 },      // markers.json「Cloud - Volume」
                src: function (n) { return 'assets/cloud/volume_v' + pad(n) + '_640x960.webp'; } },
      transparent: { name: 'Transparent', scene: 'Foliage', triple: false, w: 1600, h: 800,
                ns: [0, 2, 4, 8, 16, 24, 32, 64], missing: [],
                marks: { def: 8, visual: 16, strict: 24 },      // markers.json「Foliage v2 - Transparent」
                src: function (n) { return 'assets/foliage/transparent_b' + pad(n) + '_1600x800.webp'; } },
      // 廚房兩條的值來自兩份不同的報告（Camera.001／Camera glass bottle 各一份），不可混用
      diffuse: { name: 'Diffuse', scene: 'Kitchen', triple: false, w: 1600, h: 800,
                ns: [0, 1, 2, 4, 6, 8, 12, 16, 24, 32], missing: [],
                marks: { def: 4, visual: 12, strict: 32 },      // markers.json「Kitchen, Camera.001 - Diffuse」
                src: function (n) { return 'assets/kitchen/diffuse_b' + pad(n) + '_1600x800.webp'; } },
      transmission: { name: 'Transmission', scene: 'Kitchen', triple: false, w: 1600, h: 800,
                ns: [0, 2, 4, 8, 12, 16, 24, 32], missing: [],
                marks: { def: 12, visual: 24, strict: 24 },     // markers.json「Kitchen, Camera glass bottle - Transmission」
                src: function (n) { return 'assets/kitchen/transmission_b' + pad(n) + '_1600x800.webp'; } }
    };
    /* W3c-1「差異在哪裡」（規格 §3.7 第 9 點＋§3.10 第 1 點）。每條階梯的值都取自該場景那份 1.3.0 分析報告 JSON 的
       channels.<channel>（Blender 5.1；與 markers.json 用的是同一份報告）：
         rung   ＝ diff_rung：報告那句話、那張差異小圖講的是哪一階
         tiles  ＝ diff_tiles 的 [row, col]：8 欄 × 4 列的格子，row 0 在畫面最上面、col 0 在最左邊
                  （analyzer_cli.py VISUAL_TILES＝(8, 4)、tile_position；visual_metrics.py lab_stats）
         img    ＝ diff_image 那張差異小圖（分析器自己輸出的 PNG，原尺寸 480×240 轉成無損 WebP）
       報告的原句（.txt 裡「below N, at rung R, the difference is largest …」）寫在 index.html 的 [data-diff-where]。
       Volume 沒有（整張都不同）。這裡只放報告的資料，不另算任何熱圖或指標。來源路徑與核對在 README「W3c-1 變更」。 */
    var DIFF_GRID = { cols: 8, rows: 4 };
    var DIFFS = {
      // 規格 §3.12（2026-10-08 17:10，作者要四個分頁都有差異圖）。
      // cloud_5.2\scene_copy.fqp_lightpath_report.json → channels.volume（直幅 320×480；疊在三格版型中間那一格）
      volume: { rung: 32, tiles: [[3, 0], [2, 0]], img: 'assets/diff/cloud_volume_diff_320x480.webp', w: 320, h: 480 },
      // foliage_5.1\scene_copy_v2.fqp_lightpath_report.json → channels.transparent
      transparent: { rung: 8, tiles: [[2, 3], [3, 3]], img: 'assets/diff/foliage_transparent_diff_480x240.webp', w: 480, h: 240 },
      /* 廚房兩條只放差異小圖，不畫框、不放報告的句子（規格 §3.11 的原因仍在）：報告的句子寫 below 8／below 16
         （該通道單獨量的值），刻度上的 Visual 記號卻是 12／24（整組驗證後往上調一階），並排會讓讀者以為寫錯；
         Diffuse 的框又與差異圖最顯眼的區域差一格。所以 tiles 留空，句子改成一句中性的說明（index.html）。
         報告原資料：diffuse { rung: 6, tiles: [[2, 5]] }、transmission { rung: 12, tiles: [[1, 4], [3, 4]] }。 */
      // kitchen_cam001_5.1\scene_copy.fqp_lightpath_report.json → channels.diffuse
      diffuse: { rung: 6, tiles: [], img: 'assets/diff/kitchen_cam001_diffuse_diff_480x240.webp', w: 480, h: 240 },
      // kitchen_bottle_5.1\scene_copy.fqp_lightpath_report.json → channels.transmission
      transmission: { rung: 12, tiles: [], img: 'assets/diff/kitchen_bottle_transmission_diff_480x240.webp', w: 480, h: 240 }
    };
    var DEFAULT_LADDER = 'volume';
    var cur = { ladder: null, n: null };
    var want = null;                    // 最後一次要求的幀（解碼中途又點別格時，只顯示最後那格）
    var layers = {};                    // key → { img, ready: Promise }
    function key(l, n) { return l + ':' + n; }
    function has(l, n) { return LADDERS[l].ns.indexOf(n) >= 0 && LADDERS[l].missing.indexOf(n) < 0; }
    function altOf(l, n) { return LADDERS[l].scene + ' · ' + LADDERS[l].name + ' bounces: ' + n; }
    function startN(l) {
      var L = LADDERS[l];
      if (L.marks && has(l, L.marks.strict)) return L.marks.strict;
      for (var i = L.ns.length - 1; i >= 0; i--) if (has(l, L.ns[i])) return L.ns[i];
      return L.ns[0];
    }
    function decoded(im) {
      return (im.decode ? im.decode() : new Promise(function (res, rej) {
        if (im.complete && im.naturalWidth) res(); else { im.onload = res; im.onerror = rej; }
      })).then(function () { return im; });
    }
    // 雲的左格（固定 0）與右格（固定 48，W3b）是 HTML 裡的獨立圖層；三格版型要等它們也解碼好才整組亮出來（載入失敗不擋）
    var leftReady = triLeft ? decoded(triLeft).then(null, function () { return triLeft; }) : Promise.resolve(null);
    var rightReady = triRight ? decoded(triRight).then(null, function () { return triRight; }) : Promise.resolve(null);
    // HTML 裡中間那一格的預設幀（無 JS 時顯示的那張）直接收編成該格的圖層，不重複疊一張
    (function () {
      var pre = $('[data-tri-base]', box);
      if (!pre) return;
      layers[key('volume', parseInt(pre.getAttribute('data-n'), 10))] = { img: pre, ready: decoded(pre) };
    })();

    function layer(l, n) {
      var k = key(l, n);
      if (layers[k]) return layers[k];
      var L = LADDERS[l];
      var im = new Image();
      im.className = 'stk';
      im.width = L.w; im.height = L.h;
      im.alt = '';
      im.setAttribute('aria-hidden', 'true');
      im.src = L.src(n);
      var ready = decoded(im).then(function () {
        if (L.triple) triMid.insertBefore(im, triMid.firstChild);   // 雲：疊進中間那一格
        else frame.insertBefore(im, base.nextSibling);
        return im;
      });
      layers[k] = { img: im, ready: ready };
      return layers[k];
    }
    function preloadAll() {
      Object.keys(LADDERS).forEach(function (l) {
        LADDERS[l].ns.forEach(function (n) { if (has(l, n)) layer(l, n); });
      });
    }
    // paint＝只換畫面上的那一張（疊放圖層的 .on），不動文字、選取狀態與 cur。
    // show（選格）與按住比較（W3c-1）都走這裡，所以「不閃」的做法只有一份。done＝真的換上去之後才呼叫。
    function paint(l, n, done) {
      var L = LADDERS[l];
      want = key(l, n);
      var ly = layer(l, n);
      var ready = L.triple ? Promise.all([ly.ready, leftReady, rightReady]).then(function (r) { return r[0]; }) : ly.ready;
      ready.then(function (im) {
        if (want !== key(l, n)) return;            // 已經又要了別張
        im.classList.add('on');                    // 先開新的……
        Object.keys(layers).forEach(function (k) { // ……再關其他（同一 task，無中間幀）
          if (k !== want) layers[k].img.classList.remove('on');
        });
        tri.classList.toggle('on', !!L.triple);    // 三格版型整組開關（同一 task）
        frame.classList.toggle('is-tri', !!L.triple);
        if (done) done();
      }, function () { /* 載入失敗：目前顯示的那一格照舊 */ });
    }
    function show(l, n) {
      var L = LADDERS[l];
      // 文字立即更新（標牌、alt、lightbox 來源）；圖等解碼好才換
      outs.forEach(function (o) { o.textContent = String(n); });
      types.forEach(function (t) { t.textContent = L.name; });
      base.alt = altOf(l, n);
      base.setAttribute('data-lb-src', L.src(n));
      paint(l, n);
      cur.ladder = l; cur.n = n;
      syncTools();
    }

    /* ---- W3c-1：按住比較（規格 §3.7 第 8 點）----
       按住 [data-stepper-hold]（滑鼠、觸控、鍵盤）期間，畫面切到該階梯 Visual 值那一格；放開回到讀者選的格。
       只呼叫 paint()：cur、數字鈕的選取、標牌數字、lightbox 來源都不動。Visual 那一張若還沒解碼好，
       等解碼好才換上去，而且那時還按著才換。選的格本身就是 Visual 值、或這條階梯沒有記號資料時，按鈕 disabled。
       鍵盤：焦點在步進器裡的任何地方時按住 C；焦點在這顆鈕上時按住 Space／Enter 也可以。 */
    var holdBtn = $('[data-stepper-hold]', box);
    var holding = false;
    function visualOf(l) {
      var m = LADDERS[l].marks;
      return (m && has(l, m.visual)) ? m.visual : null;
    }
    function holdOn() {
      if (holding || !holdBtn || holdBtn.disabled) return;
      var v = visualOf(cur.ladder);
      if (v === null || v === cur.n) return;
      holding = true;
      holdBtn.setAttribute('aria-pressed', 'true');
      paint(cur.ladder, v, function () { if (holding) box.classList.add('is-holding'); });
    }
    function holdOff() {
      if (!holding) return;
      holding = false;
      holdBtn.setAttribute('aria-pressed', 'false');
      box.classList.remove('is-holding');
      paint(cur.ladder, cur.n);
    }
    if (holdBtn) {
      holdBtn.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        try { holdBtn.setPointerCapture(e.pointerId); } catch (err) {}
        holdOn();
      });
      ['pointerup', 'pointercancel', 'lostpointercapture', 'blur'].forEach(function (ev) {
        holdBtn.addEventListener(ev, holdOff);
      });
      holdBtn.addEventListener('contextmenu', function (e) { e.preventDefault(); });   // 觸控長按不跳選單
      holdBtn.addEventListener('keydown', function (e) {
        if (e.key !== ' ' && e.key !== 'Enter') return;
        e.preventDefault();
        if (!e.repeat) holdOn();
      });
      holdBtn.addEventListener('keyup', function (e) {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); holdOff(); }
      });
      box.addEventListener('keydown', function (e) {
        if ((e.key !== 'c' && e.key !== 'C') || e.ctrlKey || e.metaKey || e.altKey) return;
        e.preventDefault();
        if (!e.repeat) holdOn();
      });
      document.addEventListener('keyup', function (e) {
        if (e.key === 'c' || e.key === 'C') holdOff();
      });
      window.addEventListener('blur', holdOff);
    }

    /* ---- W3c-1：差異在哪裡（資料＝上面的 DIFFS；規格 §3.12 改成四條階梯都有）----
       「選的那一格等於 diff_rung」時：細線框（有 tiles 的階梯）、那一格的說明句、可用的疊圖開關。
       同一條階梯的其他格：開關留著但 disabled，小字寫報告拍的是哪一階（讀者才知道要去哪一格）；
       框從 DOM 拿掉，離開那一格時疊圖自動關掉。沒有 DIFFS 資料的階梯整欄收起來（visibility:hidden）。
       框＝diff_tiles 換成整張圖的百分比；上下或左右相鄰（共用一條邊）的格子合併成一個外框，不相鄰的各畫一個。
       疊圖＝報告的 diff_image，到了那一格才載入，解碼好才顯示。
       三格版型（雲）：這一層搬進中間那一格（那一格才是讀者選的階），所以框與疊圖只蓋中間。 */
    var diffLayer = $('[data-stepper-diff]', box);
    var diffTools = $('[data-diff-tools]', box);
    var diffBtn = $('[data-diff-toggle]', box);
    var diffWheres = $$('[data-diff-where]', box);
    var diffHints = $$('[data-diff-hint]', box);
    var diffImgs = {};                  // ladder → { img, ready }
    var diffAt = null;                  // 目前畫著框的階梯（null＝沒有）
    var diffOn = false;                 // 疊圖開關
    function diffOf(l) {
      var d = DIFFS[l];
      return (d && has(l, d.rung)) ? d : null;
    }
    // 這一層放在哪：單張版型＝整個圖框（原位，.tri 之前）；三格版型＝中間那一格（標牌之前，蓋在幀上、標牌下）
    function placeDiffLayer(l) {
      var host = LADDERS[l].triple ? triMid : frame;
      if (diffLayer.parentNode === host) return;
      if (host === triMid) triMid.insertBefore(diffLayer, $('.plate', triMid));
      else frame.insertBefore(diffLayer, tri);
    }
    function diffRects(tiles) {
      var groups = [];
      tiles.forEach(function (t) {
        var g = null;
        groups.forEach(function (x) {
          if (!g && x.some(function (o) { return Math.abs(o[0] - t[0]) + Math.abs(o[1] - t[1]) === 1; })) g = x;
        });
        if (g) g.push(t); else groups.push([t]);
      });
      return groups.map(function (g) {
        var r0 = Math.min.apply(null, g.map(function (t) { return t[0]; }));
        var r1 = Math.max.apply(null, g.map(function (t) { return t[0]; }));
        var c0 = Math.min.apply(null, g.map(function (t) { return t[1]; }));
        var c1 = Math.max.apply(null, g.map(function (t) { return t[1]; }));
        return { left: c0 / DIFF_GRID.cols * 100, top: r0 / DIFF_GRID.rows * 100,
                 width: (c1 - c0 + 1) / DIFF_GRID.cols * 100, height: (r1 - r0 + 1) / DIFF_GRID.rows * 100 };
      });
    }
    function diffImg(l) {
      if (diffImgs[l]) return diffImgs[l];
      var im = new Image();
      im.className = 'diff-img';
      im.width = DIFFS[l].w; im.height = DIFFS[l].h;
      im.alt = '';
      im.src = DIFFS[l].img;
      diffImgs[l] = { img: im, ready: decoded(im) };
      return diffImgs[l];
    }
    function setDiffOn(v) {
      diffOn = !!v && diffAt !== null;
      if (diffBtn) diffBtn.setAttribute('aria-pressed', diffOn ? 'true' : 'false');
      // 關掉＝把小圖從圖框拿掉（解碼好的圖留在記憶體裡，下次直接放回來）；所以沒開的時候圖框裡沒有這張圖
      Object.keys(diffImgs).forEach(function (k) {
        var im = diffImgs[k].img;
        im.classList.remove('on');
        if (im.parentNode) im.parentNode.removeChild(im);
      });
      if (!diffOn) return;
      var l = diffAt;
      diffImg(l).ready.then(function (im) {
        if (!diffOn || diffAt !== l) return;
        im.classList.add('on');
        diffLayer.insertBefore(im, diffLayer.firstChild);   // 放在框的下面
      }, function () { /* 小圖載入失敗：只有框與句子 */ });
    }
    function syncDiff() {
      if (!diffLayer) return;
      var d = diffOf(cur.ladder);
      var at = (d && cur.n === d.rung) ? cur.ladder : null;
      if (at !== diffAt) {
        if (diffOn) setDiffOn(false);     // 離開那一格：疊圖自動收起
        diffAt = at;
        $$('.diff-box', diffLayer).forEach(function (b) { diffLayer.removeChild(b); });
        if (at) {
          placeDiffLayer(at);
          diffRects(d.tiles).forEach(function (r) {
            var b = document.createElement('span');
            b.className = 'diff-box';
            b.style.left = r.left + '%'; b.style.top = r.top + '%';
            b.style.width = r.width + '%'; b.style.height = r.height + '%';
            diffLayer.appendChild(b);
          });
          diffImg(at);                    // 先載入，開關一按就有
        }
      }
      if (diffTools) diffTools.classList.toggle('is-off', !d);
      if (diffBtn) diffBtn.disabled = !at;
      function showOnly(list, attr, which) {
        list.forEach(function (w) {
          var on = !!which && w.getAttribute(attr) === which;
          w.classList.toggle('on', on);
          if (on) w.removeAttribute('aria-hidden'); else w.setAttribute('aria-hidden', 'true');
        });
      }
      showOnly(diffWheres, 'data-diff-where', at);                         // 在那一格：那一格的說明句
      showOnly(diffHints, 'data-diff-hint', (d && !at) ? cur.ladder : null); // 同階梯的其他格：報告拍的是哪一階
    }
    if (diffBtn) diffBtn.addEventListener('click', function () { if (!diffBtn.disabled) setDiffOn(!diffOn); });
    // 選格或切分頁之後：按住比較能不能按、差異框要不要出現
    function syncTools() {
      if (holdBtn) {
        var v = visualOf(cur.ladder);
        holdBtn.disabled = (v === null || v === cur.n);
      }
      syncDiff();
    }

    // 數字鈕：依階梯重建（按鈕數字＝規格的格數；缺圖的格 disabled），roving tabindex＋←→ Home End
    function buildButtons(l, selN) {
      group.innerHTML = '';
      LADDERS[l].ns.forEach(function (n) {
        var b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('role', 'radio');
        b.setAttribute('data-n', String(n));
        b.textContent = String(n);
        var on = n === selN;
        b.setAttribute('aria-checked', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
        if (!has(l, n)) { b.disabled = true; b.title = 'frame not rendered yet'; }
        group.appendChild(b);
      });
    }
    // 記號（W3b 改寫，規格 §3.7 第 3 點）：.mark＝1px 指示線，left 用百分比直接落在該格刻度的中線上、往下接到刻度上緣；
    // 字（.mark-t，Jost 小字）是它的子元素，預設貼在線的右邊，超出容器右緣就收到線的左邊（.flip）。
    // 左右都用 left／right 定位，不用 transform（W3a 用 transform 位移把字翻到左邊，主審截圖裡那個位移沒有畫出來）。
    // 同格的 Visual 與 Strict 合併成一個。一個記號一列，預設由左到右排（最右邊的在最下面）；
    // 若上面那列的線會穿過下面某列的字，就換一種上下順序（最多三個記號，六種順序逐一試）。
    var ROW_ORDERS = { 1: [[0]], 2: [[0, 1], [1, 0]],
                       3: [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]] };
    function fitMarks() {
      var W = marks.clientWidth;
      if (!W) return;                     // 還沒有版面寬度（例如頁面在隱藏的分頁裡載入）：等之後的 resize 再排
      var ms = $$('.mark', marks), n = ms.length;
      if (!n || !ROW_ORDERS[n]) return;
      var left0 = marks.getBoundingClientRect().left;
      var geo = ms.map(function (s) {
        var t = s.firstElementChild;
        s.classList.remove('flip');
        var r = s.getBoundingClientRect();
        var x = (r.left + r.right) / 2 - left0;                      // x＝線的中心（＝該格刻度的中線）
        var w = t ? t.offsetWidth : 0;                               // 字寬（含與線的間距）
        var flip = x + w > W && x - w >= 0;                          // 右邊放不下、左邊放得下才收到左邊
        if (flip) s.classList.add('flip');
        return { x: x, a: flip ? x - w : x, b: flip ? x : x + w };  // a–b＝字佔的橫向範圍
      });
      var orders = ROW_ORDERS[n], best = orders[0];
      for (var p = 0; p < orders.length; p++) {
        var ord = orders[p], ok = true;   // ord[k]＝由上往下第 k 列放哪一個記號；上面的線會經過下面每一列
        for (var i = 0; i < n && ok; i++) {
          for (var j = i + 1; j < n; j++) {
            var up = geo[ord[i]], lo = geo[ord[j]];
            if (up.x > lo.a + 1 && up.x < lo.b - 1) { ok = false; break; }
          }
        }
        if (ok) { best = ord; break; }
      }
      best.forEach(function (mi, k) { ms[mi].style.setProperty('--row', String(MARK_ROWS - n + k)); });
    }
    function buildMarks(l) {
      var L = LADDERS[l], m = L.marks;
      marks.innerHTML = '';
      if (!m) return;
      var items = [{ n: m.def, t: 'Blender default' }];
      if (m.visual === m.strict) items.push({ n: m.strict, t: 'Visual = Strict', visual: true });
      else { items.push({ n: m.visual, t: 'Visual', visual: true }); items.push({ n: m.strict, t: 'Strict' }); }
      items = items.filter(function (it) { return L.ns.indexOf(it.n) >= 0; })
                   .sort(function (a, b) { return L.ns.indexOf(a.n) - L.ns.indexOf(b.n); });
      items.forEach(function (it, j) {
        var s = document.createElement('span');
        s.className = it.visual ? 'mark is-visual' : 'mark';   // W3c-1：按住比較期間，Visual 那個記號轉成正文色
        s.style.setProperty('--i', String(L.ns.indexOf(it.n)));
        s.style.setProperty('--n', String(L.ns.length));
        s.style.setProperty('--row', String(MARK_ROWS - items.length + j));
        var t = document.createElement('span');
        t.className = 'mark-t';
        t.textContent = it.t;
        s.appendChild(t);
        marks.appendChild(s);
      });
      fitMarks();
    }
    function showCap(l) {
      caps.forEach(function (c) {
        if (c.getAttribute('data-cap') === l) c.removeAttribute('aria-hidden');
        else c.setAttribute('aria-hidden', 'true');
      });
    }
    function enabledBtns() { return $$('[role="radio"]', group).filter(function (b) { return !b.disabled; }); }
    function selectBtn(b, focus) {
      holdOff();                          // W3c-1：按住比較中換格 → 先放開
      $$('[role="radio"]', group).forEach(function (x) {
        x.setAttribute('aria-checked', x === b ? 'true' : 'false');
        x.tabIndex = x === b ? 0 : -1;
      });
      if (focus) b.focus();
      show(cur.ladder, parseInt(b.getAttribute('data-n'), 10));
    }
    group.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[role="radio"]');
      if (!b || b.disabled) return;
      selectBtn(b, false);
    });
    group.addEventListener('keydown', function (e) {
      var btns = enabledBtns();           // 鍵盤只在可用的格之間走，跳過缺圖的格
      var i = btns.indexOf(document.activeElement);
      if (i < 0) return;
      var n = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = Math.min(btns.length - 1, i + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = Math.max(0, i - 1);
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = btns.length - 1;
      if (n === null) return;
      e.preventDefault();
      selectBtn(btns[n], true);
    });
    // 階梯分頁：切過去就停在該階梯的起始格
    function setLadder(l) {
      holdOff();                          // W3c-1：按住比較中切分頁 → 先放開
      var n = startN(l);
      cur.ladder = l;
      buildButtons(l, n);
      buildMarks(l);
      showCap(l);
      show(l, n);
    }
    var ladderRadio = radioGroup(ladderGroup, function (btn) {
      var l = btn.getAttribute('data-ladder');
      if (l === cur.ladder) return;
      setLadder(l);
    });
    setLadder(DEFAULT_LADDER);

    /* ---- W3c-1：報告區塊的列 → 步進器（規格 §3.2）----
       報告區塊（index.html 的 [data-report]）裡 TRANSPARENT 兩張表的每一列是 .rl[data-report-n]。
       只有「反彈值在 Transparent 階梯上有圖」的列才變成可點（role=button、可 Tab 到、Enter／Space 同效）；
       其餘的列不加任何東西，樣式不變。點了＝切到 Transparent 分頁的那一格，並把步進器的圖捲進視野。
       正在拖曳選取文字時不觸發（區塊的文字要能選取、複製）。 */
    function jump(l, n) {
      if (!has(l, n)) return;
      if (cur.ladder !== l) {
        var i = ladderRadio.buttons.map(function (b) { return b.getAttribute('data-ladder'); }).indexOf(l);
        if (i < 0) return;
        ladderRadio.select(i, false);     // → setLadder(l)（先停在該階梯的起始格，同一個 task 內下面再換到 n，畫面只換一次）
      }
      var b = $('[role="radio"][data-n="' + n + '"]', group);
      if (b && !b.disabled) selectBtn(b, false);
      if (frame.scrollIntoView) frame.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    }
    (function () {
      var report = $('[data-report]');
      if (!report) return;
      $$('[data-report-n]', report).forEach(function (row) {
        var n = parseInt(row.getAttribute('data-report-n'), 10);
        if (!has('transparent', n)) return;
        row.classList.add('is-link');
        row.setAttribute('role', 'button');
        row.tabIndex = 0;
        row.addEventListener('click', function () {
          var sel = window.getSelection ? window.getSelection() : null;
          if (sel && !sel.isCollapsed && String(sel)) return;
          jump('transparent', n);
        });
        row.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); jump('transparent', n); }
        });
      });
    })();
    window.addEventListener('resize', fitMarks);
    if (window.ResizeObserver) new window.ResizeObserver(fitMarks).observe(marks);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitMarks);

    if ('IntersectionObserver' in window) {
      var o = new IntersectionObserver(function (es) {
        if (es.some(function (e) { return e.isIntersecting; })) { preloadAll(); o.disconnect(); }
      }, { rootMargin: '600px 0px' });
      o.observe(box);
    } else preloadAll();
  })();

  /* ---------- ② 拖拉對比（W3b 加回；行為同 W3a 之前的版本，拿掉引註） ----------
     左＝64 samples, no denoise；右＝FQP。分界位置存在 --split（百分比），CSS 用 clip-path 切右圖、
     兩側標籤與分界線跟著走。圖框固定 2:1，拖曳不改頁高。
     拖曳：滑鼠＋觸控（Pointer Events；圖框 touch-action:pan-y，直向捲動照常；把手自己是 none）。
     鍵盤（焦點在把手上）：←→ 2%、Shift＋←→ 10%、PageUp／PageDown 10%、Home／End 到兩端。 */
  (function () {
    var box = $('[data-compare]');
    if (!box) return;
    var cmp = $('[data-cmp]', box);
    var la = $('[data-cmp-la]', box), lb = $('[data-cmp-lb]', box);
    var grip = $('[data-grip]', box);
    var pos = 50;
    function setPos(p) {
      pos = Math.max(0, Math.min(100, p));
      cmp.style.setProperty('--split', pos + '%');
      grip.setAttribute('aria-valuenow', String(Math.round(pos)));
      grip.setAttribute('aria-valuetext', Math.round(pos) + '% ' + la.textContent + ', ' + (100 - Math.round(pos)) + '% ' + lb.textContent);
    }
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
      if (e.target === grip || grip.contains(e.target)) grip.focus({ preventScroll: true });
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
      else if (e.key === 'PageDown') n = pos - 10;
      else if (e.key === 'PageUp') n = pos + 10;
      if (n === null) return;
      e.preventDefault();
      setPos(n);
    });
    setPos(50);
  })();

  /* ---------- ① 同步放大鏡（W3c-2 改制：倍率依原圖像素、按住翻切、鍵盤、窄螢幕分頁） ----------
     倍率 K＝1／2／4（鈕上寫 100%／200%／400%）：放大窗裡一個 CSS 像素顯示原圖（寬＝data-natural）的 1/K 個像素。
       原圖圖層的顯示寬＝原圖寬 × K、顯示高＝原圖高 × K
       圖層位移＝−（方框左上角換成原圖的整數像素）× K           → 100% 時一個像素對一個像素，不經過插值
       方框寬＝放大窗寬 ÷ K ÷ 原圖寬 × 主圖顯示寬（高同理）      → 放大窗剛好看到方框那一塊
     放大窗裡的圖是 <img> 圖層（.lay，絕對定位，只改 left／top／width／height）；三個窗同一組數字＝同一塊像素。
     位置以 0–1 的中心座標存，視窗縮放、換倍率後照比例還原。K ≥ 2 用 pixelated：不讓瀏覽器插值把雜訊抹平（三窗一致）。
     中間那個窗（stage＝data-mag-win="fqp"）裡三張原圖各有一個圖層，同一時間只有一張 .on。平常顯示的那一張（base）：
       三窗並排（>520px）＝FQP；窄螢幕分頁（≤520px，左右兩窗 display:none）＝[data-mag-tabs] 選的那一張（預設 FQP）。
     按住翻切：按住 [data-mag-flip="a,b"] 期間 stage 每 FLIP_MS 在 a、b 之間交替——按下當下先換到「不是平常那一張」的那張
       （平常那一張不在 a、b 裡時先換到 a）；放開回到平常那一張。位置與倍率不動，左右兩窗不動。
       窗下的名字（[data-mag-name] 三個 span 疊在同一格）與 aria-label 跟著畫面上的那一張換。
       不閃的做法同步進器：三張原圖在模組接近視窗時（或第一次用到時）new Image()＋decode()，解碼好才疊進窗裡、
       才能被換上去；輪到一張還沒解碼好的圖時舊的那張留著，解碼好而且那時還要它才換。換圖＝同一個 task 內改 .on
       （只動 opacity，先開新的再關其他）。
       prefers-reduced-motion: reduce（按下的當時才查）＝不自動交替：按一次切到另一張並停住，再按一次切回。
     鍵盤（焦點在模組內任何地方）：+／= 放大一級、- 縮小一級、R 方框回預設位置；方框上的方向鍵移動（Shift＝一整個方框寬）。 */
  var mags = [];
  function Magnifier(root) {
    var main = $('[data-mag-main]', root);
    var mainImg = $('[data-mag-img]', root);
    var loupe = $('[data-mag-loupe]', root);
    var wins = $$('[data-mag-win]', root);
    var CX0 = parseFloat(root.getAttribute('data-cx') || '0.6');    // 預設位置（W2a：swril 金屬網格＋盤子邊緣）；R 鍵回到這裡
    var CY0 = parseFloat(root.getAttribute('data-cy') || '0.25');
    var cx = CX0, cy = CY0;
    var NW = parseFloat(root.getAttribute('data-natural') || '3840');    // 放大源原圖寬（px）
    // 原圖高：與主圖同比例（主圖 <img> 的 width／height 屬性 1600×800 → 3840×1920）
    var NH = Math.round(NW * ((mainImg && +mainImg.getAttribute('height') / +mainImg.getAttribute('width')) || 0.5));
    var zoomGroup = $('[data-mag-zoom]', root);
    var zoomBtns = zoomGroup ? $$('[data-k]', zoomGroup) : [];
    var ZOOMS = zoomBtns.map(function (b) { return +b.getAttribute('data-k'); });    // 1, 2, 4
    var K = 1;                          // 倍率：1＝100%（預設）
    var W = 0, H = 0, L = 0, LH = 0, WW = 0, WH = 0, loaded = false;

    var KEYS = wins.map(function (w) { return w.getAttribute('data-mag-win'); });    // builtin, fqp, reference
    var SRC = {}, ARIA = {};
    wins.forEach(function (w, i) { SRC[KEYS[i]] = w.getAttribute('data-src'); ARIA[KEYS[i]] = w.getAttribute('aria-label'); });
    var BASE = 'fqp';
    var stage = wins[KEYS.indexOf(BASE)] || wins[0];
    var names = $$('[data-mag-name]', root);
    var tabGroup = $('[data-mag-tabs]', root);
    var flipBtns = $$('[data-mag-flip]', root);
    var narrowMQ = window.matchMedia ? window.matchMedia('(max-width: 520px)') : null;    // 與 fqp.css 的斷點同一個數字
    var FLIP_MS = 500;
    var sel = BASE;                     // 窄螢幕分頁選的那一張
    var want = BASE;                    // stage 要顯示的那一張（還沒解碼好時畫面上是別張）
    var lays = [];                      // 三個窗裡全部的圖層 <img>（draw() 一起定位）
    var stageLay = {};                  // stage 的圖層：key → <img>（解碼好才放進來）
    var flip = null;                    // 翻切中：{ btn, pair, timer, sticky }
    var pos = { w: 0, h: 0, x: 0, y: 0, ir: 'auto' };

    function measure() {
      var r = main.getBoundingClientRect();
      W = r.width; H = r.height;
      var wr = stage.getBoundingClientRect();           // 量中間那個窗：窄螢幕時左右兩窗不顯示
      WW = wr.width; WH = wr.height;
      L = WW / K / NW * W; LH = WH / K / NH * H;
      loupe.style.width = L + 'px';
      loupe.style.height = LH + 'px';
    }
    function place(im) {
      im.style.width = pos.w + 'px'; im.style.height = pos.h + 'px';
      im.style.left = pos.x + 'px'; im.style.top = pos.y + 'px';
      im.style.imageRendering = pos.ir;
    }
    function draw() {
      if (!W) return;
      var x = Math.max(0, Math.min(W - L, cx * W - L / 2));
      var y = Math.max(0, Math.min(H - LH, cy * H - LH / 2));
      cx = (x + L / 2) / W; cy = (y + LH / 2) / H;           // 夾邊後寫回
      loupe.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      // 方框左上角 → 原圖的整數像素（不超過「原圖寬 − 放大窗看得到的寬」，貼右緣、下緣時窗裡不露底）
      var sx = Math.max(0, Math.min(Math.round(x / W * NW), Math.floor(NW - WW / K)));
      var sy = Math.max(0, Math.min(Math.round(y / H * NH), Math.floor(NH - WH / K)));
      pos.w = NW * K; pos.h = NH * K;
      pos.x = -sx * K; pos.y = -sy * K;
      pos.ir = K >= 2 ? 'pixelated' : 'auto';
      lays.forEach(place);
      loupe.setAttribute('aria-label', 'Magnifier at ' + Math.round(cx * 100) + '% across, ' + Math.round(cy * 100) + '% down, ' + (K * 100) + '%. Use arrow keys to move.');
    }
    // 倍率鈕（radiogroup；←→ Home End）。三個倍率永遠都可選。
    function syncZoom() {
      zoomBtns.forEach(function (b) {
        var on = +b.getAttribute('data-k') === K;
        b.setAttribute('aria-checked', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
      });
    }
    function setZoom(k) {
      if (k === K || ZOOMS.indexOf(k) < 0) return;
      var hadFocus = zoomBtns.indexOf(document.activeElement) >= 0;
      K = k; measure(); draw(); syncZoom();
      if (hadFocus) zoomBtns[ZOOMS.indexOf(k)].focus();     // 焦點跟著選中的那顆（roving tabindex）
    }
    function stepZoom(d) {
      var i = ZOOMS.indexOf(K) + d;
      if (i >= 0 && i < ZOOMS.length) setZoom(ZOOMS[i]);
    }
    if (zoomGroup) {
      zoomGroup.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('[data-k]');
        if (b) setZoom(+b.getAttribute('data-k'));
      });
      zoomGroup.addEventListener('keydown', function (e) {
        var i = zoomBtns.indexOf(document.activeElement);
        if (i < 0) return;
        var n = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = Math.min(zoomBtns.length - 1, i + 1);
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = Math.max(0, i - 1);
        else if (e.key === 'Home') n = 0;
        else if (e.key === 'End') n = zoomBtns.length - 1;
        if (n === null) return;
        e.preventDefault();
        setZoom(ZOOMS[n]);
        zoomBtns[n].focus();
      });
    }

    // ---- 圖層：解碼好才疊進窗裡 ----
    function decoded(im) {
      return (im.decode ? im.decode() : new Promise(function (res, rej) {
        if (im.complete && im.naturalWidth) res(); else { im.onload = res; im.onerror = rej; }
      })).then(function () { return im; });
    }
    function mkLay(src) {
      var im = new Image();
      im.className = 'lay';
      im.alt = '';
      im.setAttribute('aria-hidden', 'true');
      im.decoding = 'sync';             // 之後每次重畫都同步解碼：就算解碼快取被清掉也不會先畫一格空的
      im.draggable = false;
      im.src = src;
      return im;
    }
    // stage 換圖：要的那一張解碼好了才換（同一個 task 內先開新的再關其他）；還沒好就維持現狀，它解碼好時會再來一次。
    // 名字與 aria-label 在真的換上去的時候才跟著換 → 字與圖永遠是同一張。
    function apply() {
      var im = stageLay[want];
      if (!im) return;
      im.classList.add('on');
      KEYS.forEach(function (k) { if (k !== want && stageLay[k]) stageLay[k].classList.remove('on'); });
      names.forEach(function (s) {
        var on = s.getAttribute('data-mag-name') === want;
        s.classList.toggle('on', on);
        if (on) s.removeAttribute('aria-hidden'); else s.setAttribute('aria-hidden', 'true');
      });
      stage.setAttribute('aria-label', ARIA[want]);
    }
    function load() {
      if (loaded) return; loaded = true;
      wins.forEach(function (w, i) {    // 左右兩窗：各一個圖層
        if (w === stage) return;
        var im = mkLay(SRC[KEYS[i]]);
        decoded(im).then(function () {
          im.classList.add('on'); place(im); w.appendChild(im); lays.push(im);
        }, function () { /* 載入失敗：那個窗留底色 */ });
      });
      KEYS.forEach(function (k) {       // 中間那個窗：三張各一個圖層
        var im = mkLay(SRC[k]);
        decoded(im).then(function () {
          place(im); stage.appendChild(im); lays.push(im); stageLay[k] = im;
          apply();
        }, function () { /* 載入失敗：這一張永遠換不上去，畫面照舊 */ });
      });
    }
    function moveTo(clientX, clientY, offX, offY) {
      var r = main.getBoundingClientRect();
      cx = (clientX - r.left - offX + L / 2) / W;
      cy = (clientY - r.top - offY + LH / 2) / H;
      draw();
    }

    // 指標：點主圖任一處 → 方框跳過去（並可直接接著拖）；拖方框 → 保持抓取點
    var drag = null;
    main.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      var onLoupe = e.target === loupe;
      var r = loupe.getBoundingClientRect();
      if (onLoupe) {
        drag = { offX: e.clientX - r.left, offY: e.clientY - r.top, id: e.pointerId };
      } else {
        drag = { offX: L / 2, offY: LH / 2, id: e.pointerId };
        moveTo(e.clientX, e.clientY, drag.offX, drag.offY);
        // 觸控點主圖只跳不拖（主圖 touch-action:pan-y，直向捲動照常）
        if (e.pointerType === 'touch') { drag = null; return; }
      }
      loupe.classList.add('dragging');
      try { main.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
      loupe.focus({ preventScroll: true });
    });
    main.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      moveTo(e.clientX, e.clientY, drag.offX, drag.offY);
    });
    function end(e) {
      if (!drag) return;
      drag = null;
      loupe.classList.remove('dragging');
      try { main.releasePointerCapture(e.pointerId); } catch (err) {}
    }
    main.addEventListener('pointerup', end);
    main.addEventListener('pointercancel', end);

    // 鍵盤：方向鍵移動（每步＝方框寬的 1/4；Shift＝一整個方框寬）
    loupe.addEventListener('keydown', function (e) {
      var sx = (e.shiftKey ? L : L / 4) / W, sy = (e.shiftKey ? LH : LH / 4) / H;
      if (e.key === 'ArrowLeft') cx -= sx;
      else if (e.key === 'ArrowRight') cx += sx;
      else if (e.key === 'ArrowUp') cy -= sy;
      else if (e.key === 'ArrowDown') cy += sy;
      else return;
      e.preventDefault();
      draw();
    });

    // 鍵盤：焦點在模組內任何地方（倍率鈕、方框、分頁、翻切鈕）時，+／= 放大一級、- 縮小一級、R 方框回預設位置。
    // Ctrl／Cmd／Alt 組合鍵不攔（瀏覽器自己的縮放、重新整理）。焦點不在模組內時事件到不了這裡。
    root.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '+' || e.key === '=') stepZoom(1);
      else if (e.key === '-') stepZoom(-1);
      else if (e.key === 'r' || e.key === 'R') { cx = CX0; cy = CY0; draw(); }
      else return;
      e.preventDefault();
    });

    // ---- 平常那一張、按住翻切、窄螢幕分頁 ----
    function base() { return (narrowMQ && narrowMQ.matches) ? sel : BASE; }
    function noMotion() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    function flipStop() {
      if (!flip) return;
      clearInterval(flip.timer);
      flip.btn.setAttribute('aria-pressed', 'false');
      flip = null;
      want = base(); apply();
    }
    function flipStart(btn, sticky) {
      flipStop();
      var pair = (btn.getAttribute('data-mag-flip') || '').split(',');
      if (pair.length !== 2 || KEYS.indexOf(pair[0]) < 0 || KEYS.indexOf(pair[1]) < 0) return;
      load();                           // 還沒捲到附近就按：這時才開始載入，解碼好之前畫面照舊
      var b = base();
      flip = { btn: btn, pair: pair, sticky: sticky, timer: 0 };
      btn.setAttribute('aria-pressed', 'true');
      want = pair[0] === b ? pair[1] : pair[0]; apply();
      if (!sticky) flip.timer = setInterval(function () {
        want = want === pair[0] ? pair[1] : pair[0]; apply();
      }, FLIP_MS);
    }
    function flipPress(btn) {
      if (noMotion()) {                 // 減少動態：不自動交替，按一次切過去、再按一次切回
        if (flip && flip.btn === btn) flipStop(); else flipStart(btn, true);
      } else if (!(flip && flip.btn === btn && !flip.sticky)) flipStart(btn, false);
    }
    function flipRelease(btn) {
      if (flip && flip.btn === btn && !flip.sticky) flipStop();
    }
    flipBtns.forEach(function (btn) {
      btn.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        try { btn.setPointerCapture(e.pointerId); } catch (err) {}
        flipPress(btn);
      });
      ['pointerup', 'pointercancel', 'lostpointercapture', 'blur'].forEach(function (ev) {
        btn.addEventListener(ev, function () { flipRelease(btn); });
      });
      btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });    // 觸控長按不跳選單
      btn.addEventListener('keydown', function (e) {
        if (e.key !== ' ' && e.key !== 'Enter') return;
        e.preventDefault();
        if (!e.repeat) flipPress(btn);
      });
      btn.addEventListener('keyup', function (e) {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flipRelease(btn); }
      });
    });
    window.addEventListener('blur', function () { if (flip) flipRelease(flip.btn); });
    // 窄螢幕分頁（≤520px 才看得到）：選平常顯示哪一張；翻切中換分頁＝先停止翻切
    if (tabGroup) radioGroup(tabGroup, function (btn) {
      sel = btn.getAttribute('data-mag-tab');
      flipStop();
      load();
      want = base(); apply();
    });

    function layout() { measure(); draw(); }
    layout();
    syncZoom();
    window.addEventListener('resize', layout);
    if (window.ResizeObserver) {
      var ro = new window.ResizeObserver(layout);
      ro.observe(main); ro.observe(stage);
    }
    if (narrowMQ) {                     // 跨過 520px：停止翻切、回到該版型平常那一張、重算方框
      var onMQ = function () { flipStop(); want = base(); apply(); layout(); };
      if (narrowMQ.addEventListener) narrowMQ.addEventListener('change', onMQ); else if (narrowMQ.addListener) narrowMQ.addListener(onMQ);
    }
    if ('IntersectionObserver' in window) {
      var o = new IntersectionObserver(function (es) {
        if (es.some(function (x) { return x.isIntersecting; })) { load(); o.disconnect(); }
      }, { rootMargin: '600px 0px' });
      o.observe(root);
    } else load();

    return { root: root, wins: wins, layout: layout,
             get: function () { return { cx: cx, cy: cy, L: L, W: W, K: K, want: want }; } };
  }
  $$('[data-mag]').forEach(function (r) { mags.push(Magnifier(r)); });

  /* ---------- ⑤ Remix Highlights Only：分段切換鈕（aria-pressed） ----------
     W2a：On／Off 兩組圖（4× 裁切＋小全圖）都已疊在 DOM，切換只改容器 data-v → CSS 換 opacity，
     不換 src，所以不會閃。aria-hidden 跟著換，讀屏只念可見那張。 */
  (function () {
    var box = $('[data-remix]');
    if (!box) return;
    var btns = $$('[data-remix-v]', box);
    var state = $('[data-remix-state]', box);
    var imgs = $$('[data-remix-img]', box);
    function set(v) {
      box.setAttribute('data-v', v);
      btns.forEach(function (x) { x.setAttribute('aria-pressed', x.getAttribute('data-remix-v') === v ? 'true' : 'false'); });
      state.textContent = v === 'on' ? 'On' : 'Off';
      imgs.forEach(function (im) {
        if (im.getAttribute('data-remix-img') === v) im.removeAttribute('aria-hidden');
        else im.setAttribute('aria-hidden', 'true');
      });
    }
    btns.forEach(function (b) {
      b.addEventListener('click', function () { set(b.getAttribute('data-remix-v')); });
    });
    set('on');
  })();

  /* ---------- 04 Animation 影片（W2a）：單一大影片＋分頁，三段同步時間軸 ----------
     三支片段疊放、同時循環播放（muted）。切分頁：目標片段 currentTime ← 目前片段 currentTime，
     等 seeked（或已在該時間）才把 .on 換過去 → 不出黑幀、同一時間點接續。
     減少動態：不自動播放，只有可見那支給 controls；切分頁時沿用目前時間與暫停狀態。 */
  (function () {
    var box = $('[data-flicker]');
    if (!box) return;
    var vids = $$('[data-flicker-v]', box);
    var group = $('[data-flicker-group]', box);
    var cur = 0, pending = null;
    if (reduce) {
      vids.forEach(function (v) { v.removeAttribute('autoplay'); try { v.pause(); } catch (err) {} });
      vids[0].controls = true;
    }
    function reveal(i) {
      vids.forEach(function (v, j) {
        v.classList.toggle('on', j === i);
        if (j === i) v.removeAttribute('aria-hidden'); else v.setAttribute('aria-hidden', 'true');
        if (reduce) v.controls = j === i;
      });
      cur = i;
    }
    function go(i) {
      if (i === cur) return;
      var from = vids[cur], to = vids[i];
      var t = from.currentTime, paused = from.paused;
      pending = i;
      var done = false;
      function finish() {
        if (done || pending !== i) return;
        done = true;
        reveal(i);
        if (!paused) { var p = to.play(); if (p && p.catch) p.catch(function () {}); }
        else { try { to.pause(); } catch (err) {} }
      }
      if (to.readyState >= 2 && Math.abs(to.currentTime - t) < 0.02) { finish(); return; }
      to.addEventListener('seeked', finish, { once: true });
      try { to.currentTime = t; } catch (err) { finish(); }
      setTimeout(finish, 400);          // 保險：seeked 沒來也不卡住
    }
    radioGroup(group, function (btn) { go(parseInt(btn.getAttribute('data-v'), 10)); });
  })();

  /* ---------- 03 CLI 逐字打出（幽靈全文佔位；減少動態直接顯示全文）。W3a：內容是四行，換行照打 ---------- */
  (function () {
    var box = $('[data-typer]');
    if (!box) return;
    var out = $('[data-typer-out]', box);
    var full = out.textContent;
    if (reduce) return;                 // 全文本來就在 DOM 裡
    out.textContent = '';
    var caret = document.createElement('span');
    caret.className = 'caret';
    caret.setAttribute('aria-hidden', 'true');
    out.appendChild(caret);
    var text = document.createTextNode('');
    out.insertBefore(text, caret);
    out.setAttribute('aria-label', full);
    onReveal(box, function () {
      var i = 0;
      (function tick() {
        i++;
        text.nodeValue = full.slice(0, i);
        if (i < full.length) {
          var ch = full.charAt(i - 1);
          setTimeout(tick, ch === '|' ? 160 : 24);
        }
      })();
    });
  })();

  /* ---------- ④ 編號步驟分頁（tablist）＋自動輪播＋暫停鈕 ----------------
     自動輪播只在區塊進入視窗、且沒有減少動態時才跑；使用者點分頁或按暫停就停。
     滑鼠移入／鍵盤焦點在分頁清單（不含暫停鈕）時暫時停住（離開後續播，除非已手動暫停）。 */
  (function () {
    var box = $('[data-tabs]');
    if (!box) return;
    var tabs = $$('[role="tab"]', box);
    var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute('aria-controls')); });
    var pauseBtn = $('[data-tabs-pause]', box);
    var pauseLbl = $('[data-tabs-pause-label]', box);
    var MS = 5200;
    box.style.setProperty('--tab-ms', MS + 'ms');
    var cur = 0, timer = null, userPaused = false, hover = false, visible = false;

    function select(i, focus) {
      cur = (i + tabs.length) % tabs.length;
      tabs.forEach(function (t, j) {
        var on = j === cur;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        panels[j].hidden = !on;
      });
      if (focus) tabs[cur].focus();
      // 重新觸發計時條動畫
      box.classList.remove('is-playing');
      if (playing()) { void box.offsetWidth; box.classList.add('is-playing'); }
    }
    function playing() { return !reduce && !userPaused && !hover && visible; }
    function schedule() {
      clearTimeout(timer);
      box.classList.toggle('is-playing', playing());
      if (playing()) timer = setTimeout(function () { select(cur + 1, false); schedule(); }, MS);
    }
    function setPaused(p) {
      userPaused = p;
      pauseBtn.setAttribute('aria-pressed', p ? 'true' : 'false');
      pauseLbl.textContent = p ? 'Play' : 'Pause';
      schedule();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(i, false); setPaused(true); });
    });
    $('[role="tablist"]', box).addEventListener('keydown', function (e) {
      var i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      var n = null;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') n = i + 1;
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') n = i - 1;
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = tabs.length - 1;
      if (n === null) return;
      e.preventDefault();
      select(n, true);
      setPaused(true);
    });
    pauseBtn.addEventListener('click', function () { setPaused(!userPaused); });
    // 暫時停住只看分頁清單本身，不含下面那顆 Pause／Play 鈕（2026-10-08 作者回報：原本掛在 .tabs-side 整塊上，
    // 滑鼠停在鈕上、或點完鈕焦點留在鈕上時都算「停住」，所以按 Play 看起來沒反應）。
    var hoverZone = $('[role="tablist"]', box);
    hoverZone.addEventListener('mouseenter', function () { hover = true; schedule(); });
    hoverZone.addEventListener('mouseleave', function () { hover = false; schedule(); });
    hoverZone.addEventListener('focusin', function () { hover = true; schedule(); });
    hoverZone.addEventListener('focusout', function () { hover = false; schedule(); });

    if (reduce) {                       // 減少動態：不輪播，暫停鈕也不需要（留位置，頁高不變）
      pauseBtn.style.visibility = 'hidden';
      pauseBtn.tabIndex = -1;
    } else if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) { visible = e.isIntersecting; });
        schedule();
      }, { threshold: 0.4 }).observe(box);
    }
    select(0, false);
    // 細線生長靠 fade-up 的 .in；線尾對齊最後一個序號（最後一格可能因標籤換行變高）
    var rail = $('.tabs-rail', box);
    function fitRail() {
      var first = $('.idx', tabs[0]), last = $('.idx', tabs[tabs.length - 1]);
      // .idx 的 offsetParent 是分頁鈕（relative），再加上分頁鈕在 tablist 內的 offsetTop
      var top = tabs[0].offsetTop + first.offsetTop + first.offsetHeight + 4;
      var bottom = tabs[tabs.length - 1].offsetTop + last.offsetTop - 4;
      rail.style.top = top + 'px';
      rail.style.bottom = 'auto';
      rail.style.height = Math.max(0, bottom - top) + 'px';
    }
    fitRail();
    window.addEventListener('resize', fitRail);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitRail);
  })();

  /* ---------- ⑥ Lightbox（role=dialog，Esc 關、焦點回原處、Tab 鎖在框內） ---------- */
  (function () {
    var dlg = $('[data-lb-dialog]');
    if (!dlg) return;
    var img = $('[data-lb-img]', dlg);
    var stage = $('[data-lb-stage]', dlg);
    var closeBtn = $('[data-lb-close]', dlg);
    var opener = null;

    function open(src, alt, from) {
      opener = from || document.activeElement;
      img.src = src;
      img.alt = alt || '';
      dlg.setAttribute('aria-label', alt ? 'Image viewer: ' + alt : 'Image viewer');
      if (embed) {
        // iframe 依內容定高：把圖放在點擊處附近，且不超出文件底（不改頁高）
        var r = from.getBoundingClientRect();
        var docH = document.body.scrollHeight;
        var stageH = 64 + document.documentElement.clientWidth / 2;
        var top = Math.max(0, Math.min(docH - stageH, r.top + window.scrollY - 64));
        dlg.style.setProperty('--lb-top', top + 'px');
      } else {
        root.style.overflow = 'hidden';
      }
      dlg.hidden = false;
      closeBtn.focus({ preventScroll: true });
    }
    function close() {
      if (dlg.hidden) return;
      dlg.hidden = true;
      img.removeAttribute('src');
      root.style.overflow = '';
      if (opener && opener.focus) opener.focus({ preventScroll: true });
      opener = null;
    }
    // 圖本身不是可聚焦元素：補 tabindex＋role=button，鍵盤也能開
    $$('img[data-lb]').forEach(function (im) {
      im.tabIndex = 0;
      im.setAttribute('role', 'button');
      im.setAttribute('aria-haspopup', 'dialog');
      // W2a：步進器的底圖不換 src（幀疊在上面），lightbox 讀 data-lb-src＝目前顯示的幀
      function srcOf() { return im.getAttribute('data-lb-src') || im.currentSrc || im.src; }
      im.addEventListener('click', function () { open(srcOf(), im.alt, im); });
      im.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(srcOf(), im.alt, im); }
      });
    });
    closeBtn.addEventListener('click', close);
    stage.addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (dlg.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'Tab') { e.preventDefault(); closeBtn.focus(); }   // 框內只有一個可聚焦元素
    });
  })();
})();
