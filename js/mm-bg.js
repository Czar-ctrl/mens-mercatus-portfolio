/* Cursor-reactive dotted field behind the first hero (preview D; G: eased pointer, click ripples, batched draw, 30 fps idle;
   BP: dim parallax back layer for depth, faint red-white pointer glow, slightly smoother easing).
   Dots bend toward the pointer (mouse, touch, or device tilt on phones). Starts after first paint (loaded on idle by mm-motion.js),
   pauses when the tab is hidden or the hero is off-screen, caps DPR, and falls back to a static gradient for reduced motion / low-end / Save-Data.
   M2: idle drift. When the pointer has been still for 2.5 s (or there is none, e.g. phones without tilt), a soft 'ghost' light glides from the
   last pointer spot onto a slow Lissajous path across the field at ~55% strength, so the field keeps moving on its own; a real move takes
   over at once. Ghost-only frames stay on the 30 fps idle budget. Reduced motion / low-end still get the static gradient (no drift). */
(function () {
  'use strict';
  var w = window, d = document, root = d.documentElement;
  var main = d.querySelector('main#content') || d.querySelector('main') || d.body;
  // first section/header of main; pages without one (e.g. /work/, /case-studies/) use main's first block
  var hero = d.querySelector('[data-mm-bg]') || main.querySelector('section, header') || main.firstElementChild;
  if (!hero || hero.querySelector('.mmbg')) return;
  var reduce = w.matchMedia('(prefers-reduced-motion: reduce)').matches, nav = navigator;
  var low = (nav.connection && nav.connection.saveData) || (nav.deviceMemory && nav.deviceMemory <= 2) || (nav.hardwareConcurrency && nav.hardwareConcurrency <= 2);
  hero.classList.add('mmbg-host');
  var box = d.createElement('div'); box.className = 'mmbg'; box.setAttribute('aria-hidden', 'true'); hero.insertBefore(box, hero.firstChild);
  function fit() { var cw = d.documentElement.clientWidth, r = hero.getBoundingClientRect(); box.style.width = cw + 'px'; box.style.left = (-r.left) + 'px';
    // tall hosts (a whole page column): keep the field to the first screen only
    var cap = Math.round(innerHeight * 0.9); if (r.height > cap * 1.2) { box.style.bottom = 'auto'; box.style.height = cap + 'px'; } else { box.style.bottom = ''; box.style.height = ''; } }
  fit();
  if (reduce || low) { box.classList.add('static'); w.addEventListener('resize', fit); return; }
  var c = d.createElement('canvas'); box.appendChild(c); var g = c.getContext('2d', { alpha: true }); if (!g) { box.classList.add('static'); return; }
  var DPR = Math.min(w.devicePixelRatio || 1, innerWidth < 700 ? 1.25 : 1.5), W = 0, H = 0, GAP = innerWidth < 700 ? 24 : 28, pts = [], far = [], plx = 0, ply = 0, glow = 0, R = innerWidth < 700 ? 130 : 190;
  function size() {
    fit(); var r = box.getBoundingClientRect(); W = r.width; H = r.height; c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); c.style.width = W + 'px'; c.style.height = H + 'px';
    pts = []; for (var y = GAP / 2; y < H; y += GAP) for (var x = GAP / 2; x < W; x += GAP) pts.push(x, y);
    far = []; for (var y2 = GAP; y2 < H; y2 += GAP * 2) for (var x2 = GAP; x2 < W; x2 += GAP * 2) far.push(x2, y2); // BP: sparse back layer for depth
  }
  size();
  var ro = 'ResizeObserver' in w ? new ResizeObserver(function () { size(); kick(); }) : null; if (ro) ro.observe(hero); else w.addEventListener('resize', function () { size(); kick(); });
  var P = w.__mmPointer || { x: -1e4, y: -1e4 }, px = -1e4, py = -1e4, tilt = null, visible = true, raf = 0, t0 = performance.now();
  w.addEventListener('deviceorientation', function (e) { if (e.gamma == null) return; tilt = { x: (Math.max(-30, Math.min(30, e.gamma)) / 60 + 0.5), y: (Math.max(-30, Math.min(30, (e.beta || 45) - 45)) / 60 + 0.5) }; kick(); }, { passive: true });
  function light() { return root.classList.contains('mm-ink-light'); }
  // G: frame-rate independent pointer easing, click ripples, batched drawing (one fillStyle for every resting dot), 30 fps when nothing reacts
  var ripples = [], lastT = performance.now(), skip = 0;
  // M5: constellation (thin links between the lit dots near the pointer; link length + density are random per visit) and a time-of-day
  // accent for those links (SAST: dawn amber, day red, dusk rose, night violet). Portfolio pages only: app heroes keep the plain field.
  var CONST = !/^\/apps\//.test(location.pathname), SEED = Math.random(), LINK = GAP * (1.55 + SEED * 0.8), DENS = 0.55 + Math.random() * 0.35;
  var HR = +new Date().toLocaleString('en-ZA', { hour: '2-digit', hour12: false, timeZone: 'Africa/Johannesburg' }) % 24;
  var PHASE = HR >= 5 && HR < 9 ? 'dawn' : HR >= 9 && HR < 17 ? 'day' : HR >= 17 && HR < 20 ? 'dusk' : 'night';
  var ACC = { dawn: ['244,150,80', '196,96,32'], day: ['230,57,70', '200,30,45'], dusk: ['255,90,120', '210,40,80'], night: ['160,120,255', '110,70,210'] }[PHASE], links = 0;
  var IDLE_MS = 2500, GHOST = 0.55, gw = 0, ax = -1e4, ay = -1e4, str = GHOST; // M2 idle drift state (str = pointer strength: 1 real, GHOST drift)
  w.addEventListener('pointerdown', function (e) { var r = box.getBoundingClientRect(); if (e.clientY < r.top || e.clientY > r.bottom) return; ripples.push({ x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() }); if (ripples.length > 3) ripples.shift(); kick(); }, { passive: true });
  function frame(now) {
    raf = 0; if (!visible || d.hidden) return;
    var dts = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    var r = box.getBoundingClientRect(), tx, ty, active;
    var t = (now - t0) / 1000, idleFor = P.has ? now - (P.t || 0) : 1e9, real = false, k;
    if (P.has && idleFor < IDLE_MS) { tx = P.x - r.left; ty = P.y - r.top; real = true; } else if (tilt) { tx = tilt.x * W; ty = tilt.y * H; real = true; }
    if (real) { gw = 0; ax = tx; ay = ty; k = 1 - Math.exp(-dts * 7); }
    else { // M2 idle drift: blend from the last real spot (ax, ay) onto a slow Lissajous path over ~3 s
      if (ax < -9e3) { ax = W * 0.62; ay = H * 0.4; }
      gw = Math.min(1, gw + dts / 3); var e = gw * gw * (3 - 2 * gw);
      var gx = W * (0.5 + 0.34 * Math.sin(t * 0.19) + 0.07 * Math.sin(t * 0.47 + 1.1)), gy = H * (0.46 + 0.26 * Math.sin(t * 0.15 + 1.3) + 0.05 * Math.cos(t * 0.41));
      tx = ax + (gx - ax) * e; ty = ay + (gy - ay) * e; k = 1 - Math.exp(-dts * 2.5);
    }
    if (px < -9e3) { px = tx; py = ty; } else { px += (tx - px) * k; py += (ty - py) * k; }
    str += ((real ? 1 : GHOST) - str) * (1 - Math.exp(-dts * 2));
    for (var q = ripples.length - 1; q >= 0; q--) if (now - ripples[q].t > 1600) ripples.splice(q, 1);
    active = real || ripples.length;
    if (!active && (skip = (skip + 1) % 2)) { kick(); return; } // idle drift at 30 fps
    var L = light(), base = L ? '17,17,20' : '255,255,255', red = L ? '200,30,45' : '230,57,70', a0 = L ? 0.2 : 0.17;
    g.setTransform(DPR, 0, 0, DPR, 0, 0); g.clearRect(0, 0, W, H);
    // BP: faint red-white glow under the pointer (fades in/out), then a dim back layer with gentle parallax for depth
    var on = px > -9e3 ? str : 0; glow += (on - glow) * (1 - Math.exp(-dts * 4));
    if (glow > 0.01 && px > -9e3) { var gr = g.createRadialGradient(px, py, 0, px, py, R * 1.5);
      gr.addColorStop(0, 'rgba(' + red + ',' + ((L ? 0.05 : 0.085) * glow).toFixed(3) + ')');
      gr.addColorStop(0.4, L ? 'rgba(17,17,20,' + (0.015 * glow).toFixed(3) + ')' : 'rgba(255,255,255,' + (0.022 * glow).toFixed(3) + ')');
      gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(px - R * 1.5, py - R * 1.5, R * 3, R * 3); }
    var tpx = px > -9e3 ? (W / 2 - px) / W * 7 : 0, tpy = py > -9e3 ? (H / 2 - py) / H * 5 : 0, kp = 1 - Math.exp(-dts * 3);
    plx += (tpx - plx) * kp; ply += (tpy - ply) * kp;
    g.fillStyle = 'rgba(' + base + ',' + (a0 * 0.5).toFixed(3) + ')';
    for (var fi = 0; fi < far.length; fi += 2) { var fx = far[fi], fy = far[fi + 1], fw = Math.sin(fx * 0.008 - t * 0.35) * 1.6;
      g.fillRect(fx + plx + fw - 0.4, fy + ply + fw * 0.5 - 0.4, 0.8, 0.8); }
    g.fillStyle = 'rgba(' + base + ',' + a0 + ')'; var hot = [];
    for (var i = 0; i < pts.length; i += 2) {
      var x = pts[i], y = pts[i + 1], wave = Math.sin(x * 0.012 + t * 0.8) * Math.cos(y * 0.014 - t * 0.6) * 2.2;
      var dx = px - x, dy = py - y, dist = Math.sqrt(dx * dx + dy * dy), f = dist < R ? 1 - dist / R : 0, ff = f * f, ox = 0, oy = 0, rp = 0;
      if (ff > 0) { ff *= str; ox = dx / dist * ff * 16; oy = dy / dist * ff * 16; }
      for (var j = 0; j < ripples.length; j++) { var R0 = ripples[j], age = (now - R0.t) / 1000, rx = x - R0.x, ry = y - R0.y, rd = Math.sqrt(rx * rx + ry * ry) || 1, band = rd - age * 420;
        if (band > -40 && band < 40) { var amp = (1 - Math.abs(band) / 40) * (1 - age / 1.6) * 7; ox += rx / rd * amp; oy += ry / rd * amp; rp = Math.max(rp, amp / 7); } }
      if (ff > 0.04 || rp > 0.15) { hot.push(x + ox + wave, y + oy + wave * 0.6, Math.max(ff, rp * 0.6)); continue; }
      g.fillRect(x + ox + wave - 0.5, y + oy + wave * 0.6 - 0.5, 1, 1);
    }
    if (CONST && hot.length > 5) { // M5 constellation: pairs of lit dots closer than LINK, thinned by a per-visit hash, capped at 110 lines
      var acc = L ? ACC[1] : ACC[0], L2 = LINK * LINK, nL = 0; g.lineWidth = 0.6;
      for (var h1 = 0; h1 < hot.length && nL < 110; h1 += 3) for (var h2 = h1 + 3; h2 < hot.length && nL < 110; h2 += 3) {
        var lx = hot[h1] - hot[h2], ly = hot[h1 + 1] - hot[h2 + 1], l2 = lx * lx + ly * ly; if (l2 > L2) continue;
        var hs = Math.sin((h1 * 12.9898 + h2 * 78.233) * (1 + SEED)) * 43758.5453; if (hs - Math.floor(hs) > DENS) continue;
        var la = (1 - l2 / L2) * Math.min(hot[h1 + 2], hot[h2 + 2]) * (L ? 0.5 : 0.65); if (la < 0.02) continue;
        g.strokeStyle = 'rgba(' + acc + ',' + la.toFixed(3) + ')'; g.beginPath(); g.moveTo(hot[h1], hot[h1 + 1]); g.lineTo(hot[h2], hot[h2 + 1]); g.stroke(); nL++; }
      links = nL; }
    for (var h = 0; h < hot.length; h += 3) { var e2 = hot[h + 2], sz = 1 + e2 * 1.6; g.fillStyle = 'rgba(' + red + ',' + (a0 + e2 * 0.6).toFixed(3) + ')'; g.fillRect(hot[h] - sz / 2, hot[h + 1] - sz / 2, sz, sz); }
    kick();
  }
  function kick() { if (!raf && visible && !d.hidden) raf = requestAnimationFrame(frame); }
  if ('IntersectionObserver' in w) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) kick(); }).observe(box);
  d.addEventListener('visibilitychange', function () { if (!d.hidden) kick(); });
  w.__mmBg = { canvas: c, dpr: DPR, get running() { return !!raf; }, constellation: CONST, phase: PHASE, accent: ACC[0], linkLen: Math.round(LINK), get links() { return links; } };
  requestAnimationFrame(function () { box.classList.add('on'); kick(); });
})();
