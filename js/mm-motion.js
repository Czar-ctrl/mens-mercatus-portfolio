/* Mens Mercatus motion layer (preview D, upgraded in G: velocity-stretch cursor, magnetic hover, scroll reveal, loads the G layer): custom cursor, scroll progress, footer live status.
   Optional modules via the script tag: data-bg (cursor-reactive background), data-marquee (live ticker).
   Rules: fine pointer + no reduced motion for the cursor; native cursor kept on inputs, charts, iframes, videos' own controls;
   transform/opacity only, one rAF loop, one pointermove listener; nothing touches the server markup before React hydrates. */
(function () {
  'use strict';
  var w = window, d = document, root = d.documentElement;
  if (w.__mmMotion) return; w.__mmMotion = true;
  var me = d.currentScript || d.querySelector('script[src*="mm-motion.js"]');
  var V = (me && me.src.split('?')[1]) || '';
  var mq = function (q) { return w.matchMedia && w.matchMedia(q).matches; };
  var reduce = mq('(prefers-reduced-motion: reduce)'), fine = mq('(hover: hover) and (pointer: fine)'), inFrame = w.top !== w.self;
  var P = w.__mmPointer = { x: innerWidth / 2, y: innerHeight / 2, t: 0, has: false, type: '' };

  function hydrated() {
    if (!d.querySelector('script[src*="/_next/"]')) return d.readyState !== 'loading';
    var n = d.querySelector('main') || d.querySelector('h1'); if (!n) return d.readyState === 'complete';
    for (var k in n) if (k.indexOf('__reactFiber') === 0 || k.indexOf('__reactProps') === 0) return true;
    return false;
  }
  function whenHydrated(fn) { var n = 0; (function tick() { if (hydrated() || ++n > 40) fn(); else setTimeout(tick, 125); })(); }
  function load(name) { var s = d.createElement('script'); s.src = '/js/' + name + '.js' + (V ? '?' + V : ''); s.defer = true; d.head.appendChild(s); }

  /* ---------- theme: static pages use html.mm-light, Next pages drop html.dark in light mode ---------- */
  var isNext = !!d.querySelector('script[src*="/_next/"]');
  function ink() { root.classList.toggle('mm-ink-light', root.classList.contains('mm-light') || (isNext && !root.classList.contains('dark'))); }
  ink(); new MutationObserver(ink).observe(root, { attributes: true, attributeFilter: ['class'] });

  /* ---------- single pointer listener (shared with the background) ---------- */
  var onMove = null;
  w.addEventListener('pointermove', function (e) { P.x = e.clientX; P.y = e.clientY; P.t = performance.now(); P.has = true; P.type = e.pointerType; if (onMove) onMove(e); }, { passive: true });

  /* ---------- cursor ---------- */
  function cursor() {
    if (!fine || reduce || inFrame || root.hasAttribute('data-mm-native-cursor')) return;
    var ring = d.createElement('div'), dot = d.createElement('div'), lab = d.createElement('span');
    ring.className = 'mmc-ring'; dot.className = 'mmc-dot'; lab.className = 'mmc-label';
    ring.setAttribute('aria-hidden', 'true'); dot.setAttribute('aria-hidden', 'true'); ring.appendChild(lab);
    d.body.appendChild(ring); d.body.appendChild(dot);
    root.classList.add('mmc-on'); w.__mmCursor = { ring: ring, dot: dot };
    /* M3: stay on top of every popup. A modal <dialog> (showModal) or an open popover is drawn in the browser's top layer, above ANY
       z-index, so a cursor left in <body> ends up underneath it. While one is open the ring + dot live inside the topmost one and go back
       to <body> when it closes. If that element would trap position:fixed (transform / filter / contain on it) the native cursor comes
       back instead (html.mmc-native). Ordinary overlays: max z-index + the cursor is kept as the last child of <body> so ties go to it. */
    var stack = [], host = d.body, native = false;
    function isTop(el) { if (!el.isConnected) return false; try { return el.tagName === 'DIALOG' ? el.matches(':modal') : el.matches(':popover-open'); } catch (e) { return el.tagName === 'DIALOG' && el.open && el.hasAttribute('aria-modal'); } }
    function traps(el) { var c = getComputedStyle(el); return c.transform !== 'none' || c.filter !== 'none' || c.perspective !== 'none' || (c.backdropFilter || 'none') !== 'none' || /paint|layout|strict|content/.test(c.contain || '') || /transform|filter|perspective/.test(c.willChange || '') || (c.containerType || 'normal') !== 'normal'; }
    function place(h) { if (ring.parentNode !== h || h.lastChild !== dot) { h.appendChild(ring); h.appendChild(dot); } }
    function sync() {
      stack = stack.filter(isTop); var top = stack[stack.length - 1] || null;
      if (!top) { var all = d.querySelectorAll('dialog[open],[popover]'); for (var i = 0; i < all.length; i++) if (isTop(all[i])) top = all[i]; if (top) stack.push(top); }
      host = top || d.body; var nat = !!top && traps(top);
      if (nat !== native) { native = nat; root.classList.toggle('mmc-native', nat); }
      place(host); root.toggleAttribute('data-mmc-host', !!top);
    }
    function opened(el) { var i = stack.indexOf(el); if (i >= 0) stack.splice(i, 1); stack.push(el); }
    function mine(n) { return n === ring || n === dot || n.nodeType !== 1 || n.classList.contains('mmc-ripple'); }
    new MutationObserver(function (ms) { for (var i = 0; i < ms.length; i++) if (ms[i].target.open) opened(ms[i].target); sync(); })
      .observe(d.body, { attributes: true, attributeFilter: ['open'], subtree: true });
    new MutationObserver(function (ms) {   // direct children of <body> only (toasts, portals): keep the cursor last
      var go = false; for (var i = 0; i < ms.length && !go; i++) { var L = ms[i].addedNodes; for (var j = 0; j < L.length; j++) if (!mine(L[j])) { go = true; break; } }
      if (go) sync();
    }).observe(d.body, { childList: true });
    d.addEventListener('toggle', function (e) { var t = e.target; if (t && t.nodeType === 1 && (t.tagName === 'DIALOG' || t.hasAttribute('popover'))) { if (e.newState === 'open') opened(t); sync(); } }, true);
    d.addEventListener('close', function () { sync(); }, true);
    w.__mmCursor.sync = sync; w.__mmCursor.host = function () { return host; };
    var rx = innerWidth / 2, ry = innerHeight / 2, vx = 0, vy = 0, s = 0, vs = 0, tgtS = 1, state = '', magEl = null, hidden = true, last = performance.now();
    var NATIVE = 'input:not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]):not([type=range]),textarea,select,[contenteditable=""],[contenteditable=true],iframe,canvas,.tv-lightweight-charts,[data-native-cursor],video::-webkit-media-controls';
    var MAG = 'a,button,[role=button],summary,label[for],.pv-tile,[data-magnetic]';
    function classify(t) {
      if (!t || !t.closest) return ['', null];
      if (t.closest(NATIVE.replace(',video::-webkit-media-controls', ''))) return ['native', null];
      var v = t.closest('video'); if (v) return [v.paused ? 'play' : 'pause', null];
      var dr = t.closest('[data-drag],[draggable=true],.pv-hz-track,.pv-swipe-row,[data-cursor=drag]'); if (dr && !t.closest('a,button')) return ['drag', null];
      var m = t.closest(MAG); if (!m) return ['', null];
      var lbl = m.getAttribute('data-cursor-label');
      if (!lbl) { var card = m.matches('.pv-tile,[data-card]') || (m.tagName === 'A' && m.querySelector('img,video,h3')); var ext = m.tagName === 'A' && m.hostname && m.hostname !== location.hostname; lbl = card ? 'View' : ext ? 'Open ↗' : m.tagName === 'A' ? 'Open' : ''; }
      var r = m.getBoundingClientRect(); return [lbl ? 'label' : 'link', m, lbl, r.width * r.height < 160000];
    }
    onMove = function (e) {
      if (hidden) { hidden = false; ring.classList.add('on'); dot.classList.add('on'); if (!s) { rx = e.clientX; ry = e.clientY; } }
      ring.classList.remove('idle');
      if (host !== d.body && host) { if (!isTop(host)) sync(); else if (traps(host) !== native) sync(); }
      var c = classify(e.target), st = c[0];
      magEl = c[3] ? c[1] : null;
      if (st !== state || (st === 'label' && lab.textContent !== c[2])) {
        state = st; ring.setAttribute('data-s', st); dot.setAttribute('data-s', st);
        lab.textContent = st === 'label' ? c[2] : st === 'play' ? 'Play' : st === 'pause' ? 'Pause' : st === 'drag' ? '‹ Drag ›' : '';
        tgtS = st === 'label' || st === 'play' || st === 'pause' || st === 'drag' ? 2.4 : st === 'link' ? 1.6 : st === 'native' ? 0.0001 : 1;
      }
      kick();
    };
    d.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || state === 'native') return;
      var r = d.createElement('div'); r.className = 'mmc-ripple'; r.setAttribute('aria-hidden', 'true');
      r.style.transform = 'translate3d(' + e.clientX + 'px,' + e.clientY + 'px,0)'; (host && host.isConnected ? host : d.body).insertBefore(r, ring.parentNode === (host || d.body) ? ring : null);
      r.addEventListener('animationend', function () { r.remove(); }); vs -= 0.35; kick();
    }, { passive: true });
    d.documentElement.addEventListener('pointerleave', function () { hidden = true; ring.classList.remove('on'); dot.classList.remove('on'); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Tab') { ring.classList.remove('on'); dot.classList.remove('on'); hidden = true; } });
    // iframes swallow pointer events: hide ours, the frame shows the native cursor
    function frames() { d.querySelectorAll('iframe').forEach(function (f) { if (f.__mmc) return; f.__mmc = 1; f.addEventListener('mouseenter', function () { hidden = true; ring.classList.remove('on'); dot.classList.remove('on'); }); }); }
    frames(); setTimeout(frames, 3000);

    // auto intro (once per session): the ring draws in at the centre and orbits once
    var intro = 0; try { if (!sessionStorage.getItem('mmc-intro')) { sessionStorage.setItem('mmc-intro', '1'); intro = performance.now(); ring.classList.add('on', 'intro'); dot.classList.add('on'); hidden = false; } } catch (e) { }

    var raf = 0, idleAt = 0, str = 0, ang = 0;
    function kick() { if (!raf && !d.hidden) raf = requestAnimationFrame(frame); }
    function frame(now) {
      raf = 0; var dt = Math.min(48, now - last) / 16.667; last = now;
      var tx = P.has ? P.x : innerWidth / 2, ty = P.has ? P.y : innerHeight / 2, live = false;
      if (intro) {
        var k = (now - intro) / 1400; if (k >= 1 || P.has) { intro = 0; ring.classList.remove('intro'); if (!P.has) { hidden = true; ring.classList.remove('on'); dot.classList.remove('on'); } }
        else { var a = k * Math.PI * 2; tx += Math.cos(a) * 60 * (1 - k); ty += Math.sin(a) * 60 * (1 - k); tgtS = 1 + Math.sin(k * Math.PI) * 0.8; live = true; }
      }
      if (magEl) { var r = magEl.getBoundingClientRect(); tx += (r.left + r.width / 2 - tx) * 0.35; ty += (r.top + r.height / 2 - ty) * 0.35; }
      var idle = P.has && now - P.t > 4000 && !intro;
      if (idle) { if (!idleAt) { idleAt = now; ring.classList.add('idle'); } var t = (now - idleAt) / 1000; tx += Math.cos(t * 1.4) * 9; ty += Math.sin(t * 1.4) * 9; live = true; } else idleAt = 0;
      // spring (critically damped-ish)
      var K = 0.15, D = 0.7; vx = (vx + (tx - rx) * K * dt) * Math.pow(D, dt); vy = (vy + (ty - ry) * K * dt) * Math.pow(D, dt); rx += vx * dt; ry += vy * dt;
      var bs = idle ? tgtS * (1 + Math.sin((now - idleAt) / 520) * 0.12) : tgtS;
      vs = (vs + (bs - s) * 0.2 * dt) * Math.pow(0.62, dt); s += vs * dt;
      // G: velocity stretch (squash along the direction of travel), eased so it never snaps; off while a label is shown
      var sp = Math.sqrt(vx * vx + vy * vy), st = state === 'label' || state === 'play' || state === 'pause' || state === 'drag' ? 0 : Math.min(0.32, sp * 0.018);
      str += (st - str) * Math.min(1, 0.25 * dt); if (sp > 0.4) ang = Math.atan2(vy, vx);
      var S = Math.max(0, s), a = (ang * 57.29578).toFixed(1);
      ring.style.transform = 'translate3d(' + rx.toFixed(2) + 'px,' + ry.toFixed(2) + 'px,0) rotate(' + a + 'deg) scale(' + (S * (1 + str)).toFixed(3) + ',' + (S * (1 - str * 0.55)).toFixed(3) + ') rotate(' + (-a) + 'deg)';
      lab.style.transform = 'scale(' + (1 / Math.max(0.6, s)).toFixed(3) + ')';
      dot.style.transform = 'translate3d(' + (P.has ? P.x : tx) + 'px,' + (P.has ? P.y : ty) + 'px,0)';
      if (live || str > 0.003 || Math.abs(vx) + Math.abs(vy) + Math.abs(vs) > 0.02 || Math.abs(tx - rx) + Math.abs(ty - ry) > 0.3) kick();
      else if (P.has && now - P.t < 4000) setTimeout(kick, Math.max(0, 4000 - (now - P.t)) + 20); // wake for idle orbit
    }
    d.addEventListener('visibilitychange', function () { if (!d.hidden) kick(); });
    kick();
  }

  /* ---------- scroll progress ---------- */
  function progress() {
    if (root.hasAttribute('data-mm-no-progress')) return;
    var b = d.createElement('div'); b.className = 'mm-progress'; b.setAttribute('aria-hidden', 'true'); d.body.appendChild(b);
    var q = 0; function upd() { q = 0; var h = d.documentElement.scrollHeight - innerHeight; b.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, scrollY / h) : 0).toFixed(4) + ')'; }
    w.addEventListener('scroll', function () { if (!q) q = requestAnimationFrame(upd); }, { passive: true }); upd();
  }

  /* ---------- footer: live service health + latest ship (both from first-party, already-public sources) ---------- */
  function status() {
    if (me && me.hasAttribute('data-no-status')) return;
    var f = d.querySelector('footer'); if (!f || f.querySelector('.mm-status')) return;
    var box = d.createElement('div'); box.className = 'mm-status';
    box.innerHTML = '<span class="mm-health" data-st="wait"><i aria-hidden="true"></i><span>Checking live services…</span></span><span class="mm-ship"></span>';
    f.appendChild(box);
    // sit inside the footer's existing bottom padding: no extra height, so no CLS and no shifted scroll triggers
    var first = f.firstElementChild !== box ? f.firstElementChild : null;
    if (first && getComputedStyle(f).position !== 'static') {
      box.classList.add('mm-status-in');
      var out = 0, place = function () { if (out) return; var pb = parseFloat(getComputedStyle(first).paddingBottom) || 0, bh = box.offsetHeight; if (pb < bh + 8) { out = 1; box.classList.remove('mm-status-in'); box.style.top = ''; return; } box.style.top = Math.round(first.offsetTop + first.offsetHeight - pb + (pb - bh) / 2) + 'px'; };
      place(); if ('ResizeObserver' in w) { var ro = new ResizeObserver(place); ro.observe(first); ro.observe(box); }
    }
    var go = function () {
      var API = 'https://api.mensmercatus.online', E = [['Assist robot', '/health'], ['Forex desk', '/forex/api/health'], ['JobNet API', '/jobnet/api/health'], ['THINK', '/think/api/health']];
      Promise.all(E.map(function (e) { var c = new AbortController(); setTimeout(function () { c.abort(); }, 8000); return fetch(API + e[1], { signal: c.signal, cache: 'no-store' }).then(function (r) { return r.ok; }).catch(function () { return false; }); })).then(function (ok) {
        var up = ok.filter(Boolean).length, h = box.querySelector('.mm-health'), t = new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg' });
        h.setAttribute('data-st', up === E.length ? 'up' : up ? 'part' : 'down');
        h.title = E.map(function (e, i) { return e[0] + ': ' + (ok[i] ? 'up' : 'no answer'); }).join(' · ');
        h.querySelector('span').textContent = (up === E.length ? 'All ' + up + ' live services up' : up + ' of ' + E.length + ' live services answering') + ' · checked ' + t + ' SAST';
      });
      fetch('/data/ai/shipped.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (j) {
        var e = (j.entries || [])[0]; if (!e) return; var s = box.querySelector('.mm-ship'), dt = new Date(e.date + '+02:00');
        s.innerHTML = 'Latest ship: <a href="' + (e.link || '/ai/') + '"></a> <time></time>'; s.querySelector('a').textContent = e.project + ' · ' + e.title;
        s.querySelector('time').textContent = isNaN(dt) ? '' : dt.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', timeZone: 'Africa/Johannesburg' });
      }).catch(function () { });
    };
    if ('IntersectionObserver' in w) { var io = new IntersectionObserver(function (es) { if (es.some(function (x) { return x.isIntersecting; })) { io.disconnect(); go(); } }, { rootMargin: '400px' }); io.observe(box); } else go();
  }


  /* ---------- G: magnetic hover (buttons pull up to 10 px, cards up to 5 px). Uses the CSS `translate` property so it composes with
     any existing transform; one rAF loop, springs back on leave; fine pointer + no reduced motion only; skips GSAP-driven .pv-mag ---------- */
  function magnetic() {
    if (!fine || reduce || inFrame) return;
    var BTN = '[data-magnetic],.mm-btn,.mmg-btn,.mmq-pause,.mmg-fab a,.mm-db,header nav a', CARD = '.mm-svc-card,.mm-tool,.mmg-node,.mmg-vid,.mmg-doc,.mm-svc-proof a,[data-magnetic-card]';
    var cur = null, items = [], raf = 0, last = performance.now();
    function pick(t) { if (!t || !t.closest) return null; var e = t.closest(BTN + ',' + CARD); if (!e || e.dataset.pvMag || e.closest('.mmq-lanes,iframe,[data-native-cursor]')) return null; return e; }
    function item(e) { for (var i = 0; i < items.length; i++) if (items[i].e === e) return items[i]; var it = { e: e, x: 0, y: 0, tx: 0, ty: 0, card: !e.matches(BTN) }; items.push(it); return it; }
    w.addEventListener('pointermove', function (ev) {
      if (ev.pointerType !== 'mouse') return; var e = pick(ev.target);
      if (cur && cur.e !== e) { cur.tx = cur.ty = 0; cur = null; }
      if (e) { cur = item(e); var r = e.getBoundingClientRect(), k = cur.card ? 0.04 : 0.22, m = cur.card ? 5 : 10;
        cur.tx = Math.max(-m, Math.min(m, (ev.clientX - r.left - r.width / 2) * k)); cur.ty = Math.max(-m, Math.min(m, (ev.clientY - r.top - r.height / 2) * k)); }
      kick();
    }, { passive: true });
    d.addEventListener('pointerleave', function () { if (cur) { cur.tx = cur.ty = 0; cur = null; kick(); } });
    function kick() { if (!raf && !d.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } }
    function frame(now) {
      raf = 0; var dt = Math.min(48, now - last) / 16.667, a = 1 - Math.pow(1 - 0.18, dt); last = now; var live = false;
      for (var i = items.length - 1; i >= 0; i--) { var it = items[i]; it.x += (it.tx - it.x) * a; it.y += (it.ty - it.y) * a;
        if (Math.abs(it.tx - it.x) + Math.abs(it.ty - it.y) > 0.05) live = true;
        if (!it.tx && !it.ty && Math.abs(it.x) + Math.abs(it.y) < 0.05) { it.e.style.translate = ''; items.splice(i, 1); continue; }
        it.e.style.translate = it.x.toFixed(2) + 'px ' + it.y.toFixed(2) + 'px'; }
      if (live) kick();
    }
  }

  /* ---------- G: scroll-triggered reveal. Only blocks that start BELOW the fold get hidden (no LCP/CLS cost: opacity/translate only);
     Next pages keep their own wave-2 animations, so this runs on static pages and on the G sections. ---------- */
  function reveal() {
    if (reduce || !('IntersectionObserver' in w) || (me && me.hasAttribute('data-no-reveal'))) return; // M2: app shells opt out (no DOM observer on busy React UIs)
    var SEL = '.mm-labpage .mm-labsec .mm-wrap > *, .mm-labpage .mm-svc-card, .mm-labpage .mm-tool, [data-mmg] .mmg-wrap > *, .mmg-node, .mmg-vid, .mmg-feed li, .mmg-doc, [data-reveal]';
    var io = new IntersectionObserver(function (es) { es.forEach(function (x) { if (x.isIntersecting) { var n = x.target; io.unobserve(n);
      var sib = n.parentNode ? [].indexOf.call(n.parentNode.children, n) : 0; n.style.transitionDelay = Math.min(4, sib) * 70 + 'ms'; n.classList.add('in');
      setTimeout(function () { n.style.transitionDelay = ''; }, 1400); } }); }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    var seen = new WeakSet();
    function scan() { [].forEach.call(d.querySelectorAll(SEL), function (n) { if (seen.has(n)) return; seen.add(n); if (n.closest('.mmr') || n.closest('.mmg-dlg,.mmg-fab')) return;
      var r = n.getBoundingClientRect(); if (r.top < innerHeight * 0.92 || !r.height) return; n.classList.add('mmr'); io.observe(n); }); }
    scan(); w.addEventListener('mmg-ready', function () { setTimeout(scan, 60); });
    if ('MutationObserver' in w) { var t = 0; new MutationObserver(function () { clearTimeout(t); t = setTimeout(scan, 120); }).observe(d.querySelector('main') || d.body, { childList: true, subtree: true }); }
  }

  function css(cb) {
    if (d.querySelector('link[href*="mm-motion.css"]')) return cb();
    var l = d.createElement('link'); l.rel = 'stylesheet'; l.href = '/css/mm-motion.css' + (V ? '?' + V : ''); l.onload = l.onerror = function () { cb(); }; d.head.appendChild(l);
  }
  function start() {
    whenHydrated(function () { css(go); });
    function go() {
      cursor(); progress(); status(); magnetic(); reveal();
      var idle = w.requestIdleCallback || function (f) { setTimeout(f, 200); };
      var later = function () { idle(function () { if (me && me.hasAttribute('data-bg') && !inFrame) load('mm-bg'); if (me && me.hasAttribute('data-marquee')) load('mm-marquee'); if (!me || !me.hasAttribute('data-no-g')) load('g/g-layer'); if (!inFrame && !/^\/apps\//.test(location.pathname) && !(me && me.hasAttribute('data-no-wow'))) load('mm-wow'); }, { timeout: 1500 }); };
      if (d.readyState === 'complete') later(); else w.addEventListener('load', later);
    }
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else start();
})();
