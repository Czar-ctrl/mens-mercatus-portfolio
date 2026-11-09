/* M5 "wow" layer for the portfolio pages (home, work, services, ai, case studies, resume, labs, contact). Loaded on idle by mm-motion.js,
   never inside /apps/* or iframes. Everything is transform/opacity/text only, starts after hydration and after first paint, and is off for
   prefers-reduced-motion (except the easter-egg toast, shown without animation). No numbers or claims are generated here.
   1) decode reveal: section kickers resolve from random glyphs as they scroll in (glyph set, order and timing differ every visit)
   2) 3D tilt + light sheen on cards, following the mouse (mouse/trackpad only)
   3) click spark: a few sparks fly out with the cursor ripple (mouse only, random angles)
   4) easter egg: type "mercatus" (or the Konami code) for a red pulse + toast
   5) exit wipe: a thin red line sweeps across when you follow a link to another page (never delays the navigation) */
(function () {
  'use strict';
  var w = window, d = document, root = d.documentElement;
  if (w.__mmWow) return;
  var mq = function (q) { return !!(w.matchMedia && w.matchMedia(q).matches); };
  var reduce = mq('(prefers-reduced-motion: reduce)'), fine = mq('(hover: hover) and (pointer: fine)');
  var R = Math.random, pick = function (a) { return a[Math.floor(R() * a.length)]; };
  var api = w.__mmWow = { reduce: reduce, fine: fine, seed: Math.floor(R() * 1e9), decoded: 0, tilts: 0, sparks: 0, egg: 0, wipes: 0 };
  root.classList.add('mmw-on');

  /* ---------- 1) decode reveal ---------- */
  var SETS = ['01', '0123456789ABCDEF', '<>/\\|_-=+*', '▖▗▘▝▚▞█▓▒░'];
  var GLY = pick(SETS); api.glyphs = GLY;
  var KSEL = '.pv-kicker, .mm-kick, .pv-tag, .mm-more-tag, main .text-signal.uppercase, [data-decode]';
  function decode(el) {
    if (el.__mmw) return; el.__mmw = 1;
    var tn = el.childNodes.length === 1 && el.firstChild.nodeType === 3 ? el.firstChild : null; if (!tn) return;
    var orig = tn.nodeValue, n = orig.length; if (!n || n > 64 || !/\S/.test(orig)) return;
    var order = []; for (var i = 0; i < n; i++) order.push(i); // per-element random reveal order (left-biased so it still reads left to right)
    order.sort(function (a, b) { return (a + R() * n * 0.6) - (b + R() * n * 0.6); });
    var rank = new Array(n); order.forEach(function (ix, k) { rank[ix] = k; });
    var dur = 420 + R() * 420, delay = R() * 260, t0 = 0, last = '';
    el.setAttribute('aria-busy', 'true'); el.classList.add('mmw-dec');
    function frame(now) {
      if (!t0) t0 = now; var p = Math.min(1, (now - t0 - delay) / dur), out = '';
      if (now - t0 < delay) { requestAnimationFrame(frame); return; }
      for (var i = 0; i < n; i++) { var c = orig[i]; out += (c === ' ' || rank[i] < p * n) ? c : GLY[Math.floor(R() * GLY.length)]; }
      if (out !== last) { tn.nodeValue = out; last = out; }
      if (p < 1) requestAnimationFrame(frame); else { tn.nodeValue = orig; el.removeAttribute('aria-busy'); el.classList.remove('mmw-dec'); api.decoded++; }
    }
    requestAnimationFrame(frame);
  }
  function decodeAll() {
    if (reduce || !('IntersectionObserver' in w)) return;
    var io = new IntersectionObserver(function (es) { es.forEach(function (x) { if (x.isIntersecting) { io.unobserve(x.target); decode(x.target); } }); }, { rootMargin: '0px 0px -6% 0px' });
    var seen = new WeakSet();
    var scan = function () { [].forEach.call(d.querySelectorAll(KSEL), function (el) { if (seen.has(el)) return; seen.add(el); if (el.closest('[aria-hidden="true"],.mmq,dialog')) return; io.observe(el); }); };
    scan(); setTimeout(scan, 1500); setTimeout(scan, 4000); w.addEventListener('load', function () { setTimeout(scan, 300); });
  }

  /* ---------- 2) 3D tilt + sheen ---------- */
  var TSEL = '.pv-tile, .pv-card.pv-cell, .pv-card.pv-panel, .mm-svc-card, .mm-f-tile, .mm-more a, main article.group, main li.flex.flex-col.border, main a.group.border, [data-tilt]';
  var MAX = 5, cur = null, sheen = null, tx = 0, ty = 0, rx = 0, ry = 0, mx = 50, my = 50, raf = 0;
  function tilt() {
    if (reduce || !fine) return;
    sheen = d.createElement('span'); sheen.className = 'mmw-sheen'; sheen.setAttribute('aria-hidden', 'true');
    d.addEventListener('pointerover', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      var el = e.target && e.target.closest ? e.target.closest(TSEL) : null; if (el && el.closest('iframe,[data-native-cursor],dialog')) el = null;
      if (el === cur) return; leave(); if (!el) return;
      cur = el; api.tilts++;
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      var par = el.parentElement; if (par && !par.classList.contains('mmw-persp')) par.classList.add('mmw-persp');
      el.classList.add('mmw-tilt'); el.appendChild(sheen);
    }, { passive: true });
    w.addEventListener('pointermove', function (e) {
      if (!cur || e.pointerType !== 'mouse') return; var r = cur.getBoundingClientRect(); if (!r.width) return;
      var u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height;
      if (u < -0.05 || u > 1.05 || v < -0.05 || v > 1.05) { leave(); return; }
      var k = Math.min(1, 280 / Math.max(r.width, r.height)) * MAX; // big panels tilt less (a 500 px card stays under 3 deg)
      tx = (0.5 - v) * k; ty = (u - 0.5) * k; mx = u * 100; my = v * 100; kick();
    }, { passive: true });
    d.addEventListener('pointerleave', leave); w.addEventListener('blur', leave); w.addEventListener('scroll', function () { if (cur) { var r = cur.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) leave(); } }, { passive: true });
  }
  function leave() { if (!cur) return; var el = cur; cur = null; tx = ty = 0; if (sheen.parentNode) sheen.parentNode.removeChild(sheen); el.classList.remove('mmw-tilt'); el.classList.add('mmw-out'); clearTimeout(el.__mmwT); el.__mmwT = setTimeout(function () { el.classList.remove('mmw-out'); }, 650); out.push(el); kick(); }
  var out = [];
  function kick() { if (!raf) raf = requestAnimationFrame(step); }
  function step() {
    raf = 0; rx += (tx - rx) * 0.16; ry += (ty - ry) * 0.16; var live = Math.abs(tx - rx) + Math.abs(ty - ry) > 0.02;
    if (cur) { var a = Math.sqrt(rx * rx + ry * ry); cur.style.rotate = a < 0.01 ? '' : (rx / a).toFixed(3) + ' ' + (ry / a).toFixed(3) + ' 0 ' + a.toFixed(2) + 'deg';
      cur.style.setProperty('--mmw-x', mx.toFixed(1) + '%'); cur.style.setProperty('--mmw-y', my.toFixed(1) + '%'); }
    for (var i = out.length - 1; i >= 0; i--) { var el = out[i]; el.style.rotate = ''; el.style.removeProperty('--mmw-x'); el.style.removeProperty('--mmw-y'); out.splice(i, 1); }
    if (live) kick(); else if (!cur) { rx = ry = 0; }
  }

  /* ---------- 3) click spark ---------- */
  function spark() {
    if (reduce || !fine) return;
    d.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return; var t = e.target; if (t && t.closest && t.closest('input,textarea,select,[contenteditable],iframe,canvas,video')) return;
      var host = (w.__mmCursor && w.__mmCursor.host && w.__mmCursor.host()) || d.body, n = 5 + Math.floor(R() * 4), base = R() * 6.283;
      for (var i = 0; i < n; i++) { var s = d.createElement('i'); s.className = 'mmw-spark'; s.setAttribute('aria-hidden', 'true');
        var ang = base + i * 6.283 / n + (R() - 0.5) * 0.6, dist = 18 + R() * 26;
        s.style.left = e.clientX + 'px'; s.style.top = e.clientY + 'px'; s.style.setProperty('--dx', (Math.cos(ang) * dist).toFixed(1) + 'px'); s.style.setProperty('--dy', (Math.sin(ang) * dist).toFixed(1) + 'px');
        s.style.setProperty('--r', (ang * 57.3).toFixed(0) + 'deg'); s.style.animationDuration = (380 + R() * 260).toFixed(0) + 'ms';
        s.addEventListener('animationend', function () { this.remove(); }); setTimeout(s.remove.bind(s), 900); host.appendChild(s); } // timeout: also gone if the animation never runs
      api.sparks++;
    }, { passive: true });
  }

  /* ---------- 4) easter egg ---------- */
  function egg() {
    var WORD = 'mercatus', K = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'], buf = '', kq = [];
    d.addEventListener('keydown', function (e) {
      var t = e.target; if (e.ctrlKey || e.metaKey || e.altKey || (t && t.closest && t.closest('input,textarea,select,[contenteditable]'))) return;
      kq.push(e.key.length === 1 ? e.key.toLowerCase() : e.key); if (kq.length > K.length) kq.shift();
      if (e.key.length === 1) buf = (buf + e.key.toLowerCase()).slice(-WORD.length);
      if (buf === WORD || kq.join() === K.join()) { buf = ''; kq = []; fire(); }
    });
  }
  function fire() {
    api.egg++;
    if (!reduce) { var p = d.createElement('div'); p.className = 'mmw-pulse'; p.setAttribute('aria-hidden', 'true'); d.body.appendChild(p); p.addEventListener('animationend', function () { p.remove(); }); }
    var t = d.querySelector('.mmw-toast'); if (!t) { t = d.createElement('div'); t.className = 'mmw-toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); d.body.appendChild(t); }
    t.innerHTML = '<b>Mercatus mode</b> You found the easter egg. Every system here keeps a human gate on send, pay, apply and delete. <a href="/services/#book">Book a call</a>';
    t.classList.remove('on'); void t.offsetWidth; t.classList.add('on'); clearTimeout(t.__h); t.__h = setTimeout(function () { t.classList.remove('on'); }, 6500);
    if (w.__mmCursor && w.__mmCursor.sync) w.__mmCursor.sync();
  }
  api.fire = fire;

  /* ---------- 5) exit wipe ---------- */
  function wipe() {
    if (reduce) return;
    var bar = null;
    w.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null; if (!a || a.target && a.target !== '_self' || a.hasAttribute('download')) return;
      var u; try { u = new URL(a.href, location.href); } catch (x) { return; }
      if (u.origin !== location.origin || (u.pathname === location.pathname && u.search === location.search) || /\.(pdf|docx?|zip|mp4|webm|png|jpe?g|webp)$/i.test(u.pathname)) return;
      if (!bar) { bar = d.createElement('div'); bar.className = 'mmw-wipe'; bar.setAttribute('aria-hidden', 'true'); d.body.appendChild(bar); }
      bar.classList.remove('go'); void bar.offsetWidth; bar.classList.add('go'); api.wipes++;
      setTimeout(function () { if (bar) bar.classList.remove('go'); }, 1600); // soft (client-side) navigations: clear it
    });
    w.addEventListener('pageshow', function (e) { if (e.persisted && bar) bar.classList.remove('go'); });
  }

  function start() { decodeAll(); tilt(); spark(); egg(); wipe(); root.classList.add('mmw-ready'); }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else start();
})();
