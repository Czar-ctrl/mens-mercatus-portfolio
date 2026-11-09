/**
 * Mens Mercatus — site-wide cursor-responsive ambient backgrounds.
 * Variants: web | particles | liquid | constellation | aurora | reel-pulse | light-3d
 * Persists: localStorage key mm-ambient-variant
 * Auto-inits canvas #mm-ambient-bg + picker .mm-ambient-picker
 * light-3d ("Glass Light 3D"): soft cream/glass ambient + page light palette lift
 */
(function () {
  "use strict";
  /* Godmode (2026-10-05): full .gm pages skip ambient motion. gm-lite tools (Sound Deck) keep the picker. */
  var _gmRoot = document.documentElement;
  if (_gmRoot.classList.contains("gm") && !_gmRoot.classList.contains("gm-lite")) return;

  var STORAGE_KEY = "mm-ambient-variant";
  var VARIANTS = ["web", "particles", "liquid", "constellation", "aurora", "reel-pulse", "light-3d"];
  var LABELS = {
    web: "Web",
    particles: "Particles",
    liquid: "Liquid",
    constellation: "Stars",
    aurora: "Aurora",
    "reel-pulse": "Reel",
    "light-3d": "Glass"
  };
  var TITLES = {
    web: "Web",
    particles: "Particles",
    liquid: "Liquid",
    constellation: "Stars",
    aurora: "Aurora",
    "reel-pulse": "Reel Pulse",
    "light-3d": "Glass Light 3D"
  };
  var RED = "#c8102e";
  var RED_RGB = [200, 16, 46];
  var GOLD = "#d4af37";
  var GOLD_RGB = [212, 175, 55];
  var BG = "#07080c";
  var NAVY = "#0f172a";
  /* Glass Light 3D — soft cream / sky washes (tweet inspo: modulify / landdding floating glass) */
  var LIGHT_BG = "#f4f1ea";
  var LIGHT_BG_RGB = [244, 241, 234];
  var CREAM_RGB = [252, 250, 245];
  var SKY_RGB = [186, 210, 228];
  var GLASS_RGB = [255, 255, 255];
  var DPR_MAX = 1;
  var LERP = 0.12;

  var reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine =
    window.matchMedia &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var narrow =
    window.matchMedia &&
    window.matchMedia("(max-width: 720px)").matches;
  /** Soft = static/low-cost ambient (reduced-motion OR narrow viewport). */
  var soft = reduce || narrow;

  var canvas = null;
  var ctx = null;
  var staticEl = null;
  var picker = null;
  var variant = "web";
  var raf = 0;
  var running = false;
  var w = 0;
  var h = 0;
  var dpr = 1;
  var px = 0.5;
  var py = 0.5;
  var tx = 0.5;
  var ty = 0.5;
  var t0 = performance.now();
  var state = null;

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function rand(a, b) {
    return a + Math.random() * (b - a);
  }
  function dist2(ax, ay, bx, by) {
    var dx = ax - bx;
    var dy = ay - by;
    return dx * dx + dy * dy;
  }
  function rgba(r, g, b, a) {
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }
  function gold(a) {
    return rgba(GOLD_RGB[0], GOLD_RGB[1], GOLD_RGB[2], a);
  }

  function loadVariant() {
    try {
      if (localStorage.getItem("mm-color-mode") === "light") return "light-3d";
      var v = localStorage.getItem(STORAGE_KEY);
      if (v && VARIANTS.indexOf(v) !== -1) return v;
    } catch (e) {}
    return "web";
  }

  function saveVariant(v) {
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch (e) {}
  }

  function ensureDom() {
    document.body.classList.add("mm-has-ambient");

    canvas = document.getElementById("mm-ambient-bg");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "mm-ambient-bg";
      canvas.setAttribute("aria-hidden", "true");
      document.body.insertBefore(canvas, document.body.firstChild);
    }
    ctx = canvas.getContext("2d", { alpha: false });

    staticEl = document.getElementById("mm-ambient-static");
    if (!staticEl) {
      staticEl = document.createElement("div");
      staticEl.id = "mm-ambient-static";
      staticEl.className = "mm-ambient-static";
      staticEl.setAttribute("aria-hidden", "true");
      document.body.insertBefore(staticEl, canvas.nextSibling);
    }

    var existing = document.querySelector(".mm-ambient-picker");
    if (existing) {
      picker = existing;
    } else {
      picker = document.createElement("div");
      picker.className = "mm-ambient-picker";
      picker.setAttribute("role", "group");
      picker.setAttribute("aria-label", "Ambient background");
      var label = document.createElement("span");
      label.className = "mm-ambient-picker-label";
      label.textContent = "BG";
      picker.appendChild(label);
      for (var i = 0; i < VARIANTS.length; i++) {
        var id = VARIANTS[i];
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "mm-ambient-btn";
        btn.setAttribute("data-ambient", id);
        btn.setAttribute("aria-pressed", "false");
        btn.title = TITLES[id] || LABELS[id];
        btn.textContent = LABELS[id];
        picker.appendChild(btn);
      }
      document.body.appendChild(picker);
    }

    dockSoundDeckPicker(picker);
    wirePicker(picker);
  }

  /* Sound Deck only: keep the BG rail in the status bar so it cannot cover faders, transport, or arrange. */
  function dockSoundDeckPicker(el) {
    if (!el || !document.querySelector("[data-deck]")) return;
    var bar = document.querySelector("[data-deck] .status-bar");
    if (!bar) return;
    if (el.parentNode !== bar) bar.insertBefore(el, bar.firstChild);
    el.classList.add("mm-ambient-docked");
  }

  function wirePicker(root) {
    var buttons = root.querySelectorAll("[data-ambient]");
    for (var i = 0; i < buttons.length; i++) {
      (function (btn) {
        if (btn._mmAmbientBound) return;
        btn._mmAmbientBound = true;
        btn.addEventListener("click", function () {
          setVariant(btn.getAttribute("data-ambient"));
        });
      })(buttons[i]);
    }
    syncPicker();
  }

  function syncPicker() {
    if (!picker) return;
    var buttons = picker.querySelectorAll("[data-ambient]");
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      var on = b.getAttribute("data-ambient") === variant;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    }
  }

  function setVariant(v) {
    if (VARIANTS.indexOf(v) === -1) return;
    variant = v;
    saveVariant(v);
    syncPicker();
    initState();
    try {
      window.dispatchEvent(new CustomEvent("mm-ambient-change", { detail: { variant: v } }));
    } catch (e) {}
    /* Keep color-mode storage aligned with Glass / other variants */
    try {
      if (v === "light-3d") localStorage.setItem("mm-color-mode", "light");
      else if (localStorage.getItem("mm-color-mode") === "light") localStorage.setItem("mm-color-mode", "dark");
    } catch (e2) {}
    if (v === "light-3d") {
      document.documentElement.classList.add("mm-light");
    } else {
      document.documentElement.classList.remove("mm-light");
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, soft || narrow ? 1 : DPR_MAX);
    w = Math.max(1, window.innerWidth);
    h = Math.max(1, window.innerHeight);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    initState();
  }

  /* ---------- variant state builders ---------- */

  function initWeb() {
    var count = clamp(Math.floor((w * h) / 80000), 10, 20);
    var pts = [];
    for (var i = 0; i < count; i++) {
      pts.push({
        x: Math.random() * w,
        y: Math.random() * h,
        ox: 0,
        oy: 0,
        vx: rand(-0.15, 0.15),
        vy: rand(-0.15, 0.15)
      });
    }
    for (var j = 0; j < pts.length; j++) {
      pts[j].ox = pts[j].x;
      pts[j].oy = pts[j].y;
    }
    state = { pts: pts, link: Math.min(140, Math.max(90, w * 0.11)) };
  }

  function initParticles() {
    var count = clamp(Math.floor((w * h) / 64000), 12, 24);
    var pts = [];
    for (var i = 0; i < count; i++) {
      pts.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: rand(-0.35, 0.35),
        vy: rand(-0.35, 0.35),
        r: rand(1.1, 2.4),
        trail: []
      });
    }
    state = { pts: pts };
  }

  function initLiquid() {
    state = { ripples: [], lastSpawn: 0 };
  }

  function initConstellation() {
    var count = clamp(Math.floor((w * h) / 90000), 8, 16);
    var nodes = [];
    for (var i = 0; i < count; i++) {
      nodes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        bx: 0,
        by: 0,
        phase: Math.random() * Math.PI * 2,
        orbit: 0,
        orbitA: rand(18, 48)
      });
    }
    for (var j = 0; j < nodes.length; j++) {
      nodes[j].bx = nodes[j].x;
      nodes[j].by = nodes[j].y;
    }
    state = { nodes: nodes, link: Math.min(160, Math.max(100, w * 0.13)) };
  }

  function initAurora() {
    var bands = [];
    for (var i = 0; i < 2; i++) {
      bands.push({
        y: h * (0.2 + i * 0.22),
        amp: 14 + i * 6,
        speed: 0.00028 + i * 0.0001,
        phase: Math.random() * Math.PI * 2,
        thick: 32 + i * 14,
        alpha: 0.07 + i * 0.03
      });
    }
    state = { bands: bands };
  }

  /* Dark cinematic pulse — Blueprint red/black/white, inspired by IG reel DJ6NZiWi3jJ aesthetic
     (reel itself is not embedded; motion is a local canvas interpretation). */
  function initReelPulse() {
    var rings = [];
    for (var i = 0; i < 4; i++) {
      rings.push({
        phase: (i / 4) * Math.PI * 2,
        speed: 0.00055 + i * 0.00012,
        maxR: 0.18 + i * 0.12,
        alpha: 0.22 - i * 0.035
      });
    }
    var sparks = [];
    var n = clamp(Math.floor((w * h) / 110000), 6, 14);
    for (var s = 0; s < n; s++) {
      sparks.push({
        a: Math.random() * Math.PI * 2,
        r: rand(0.08, 0.55),
        spin: rand(-0.0004, 0.0004),
        size: rand(1.2, 2.4),
        blink: Math.random() * Math.PI * 2
      });
    }
    state = { rings: rings, sparks: sparks, pulse: 0 };
  }

  /* Soft cream "Glass Light 3D" — floating frosted panes + gentle parallax
     (inspired by modulify.ai / landdding.com floating-UI-over-ambient look; no embeds). */
  function initLight3d() {
    var panes = [];
    var n = clamp(Math.floor((w * h) / 220000), 4, 7);
    for (var i = 0; i < n; i++) {
      var pw = rand(w * 0.18, w * 0.38);
      var ph = rand(h * 0.14, h * 0.28);
      panes.push({
        x: rand(w * 0.05, w * 0.75),
        y: rand(h * 0.08, h * 0.72),
        w: pw,
        h: ph,
        z: rand(0.35, 1),
        rx: rand(-6, 6),
        ry: rand(-8, 8),
        phase: Math.random() * Math.PI * 2,
        drift: rand(0.00012, 0.00028),
        r: rand(18, 28)
      });
    }
    var orbs = [];
    var on = clamp(Math.floor((w * h) / 160000), 5, 10);
    for (var o = 0; o < on; o++) {
      orbs.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: rand(40, 120),
        a: rand(0.04, 0.11),
        z: rand(0.2, 0.9),
        phase: Math.random() * Math.PI * 2
      });
    }
    state = { panes: panes, orbs: orbs };
  }

  function applyLightThemeClass(on) {
    document.body.classList.toggle("mm-ambient-light-3d", on);
    document.documentElement.classList.toggle("mm-theme-light-3d", on);
  }

  function initState() {
    if (!ctx) return;
    document.body.classList.toggle("mm-ambient-reel-pulse", variant === "reel-pulse");
    applyLightThemeClass(variant === "light-3d");
    switch (variant) {
      case "web":
        initWeb();
        break;
      case "particles":
        initParticles();
        break;
      case "liquid":
        initLiquid();
        break;
      case "constellation":
        initConstellation();
        break;
      case "aurora":
        initAurora();
        break;
      case "reel-pulse":
        initReelPulse();
        break;
      case "light-3d":
        initLight3d();
        break;
      default:
        initWeb();
    }
  }

  /* ---------- draws ---------- */

  function clearBase() {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);
    // soft navy vignette
    var g = ctx.createRadialGradient(
      w * 0.5,
      h * 0.4,
      0,
      w * 0.5,
      h * 0.5,
      Math.max(w, h) * 0.75
    );
    g.addColorStop(0, rgba(15, 23, 42, 0.55));
    g.addColorStop(1, rgba(7, 8, 12, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function drawCursorGlow(cx, cy) {
    var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 220);
    g.addColorStop(0, gold(0.14));
    g.addColorStop(0.45, rgba(15, 23, 42, 0.2));
    g.addColorStop(1, rgba(7, 8, 12, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function drawWeb(cx, cy, dt) {
    var pts = state.pts;
    var link = state.link;
    var link2 = link * link;
    var pullR = 160;
    var pullR2 = pullR * pullR;

    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      p.ox += p.vx * dt * 0.06;
      p.oy += p.vy * dt * 0.06;
      if (p.ox < -20) p.ox = w + 20;
      if (p.ox > w + 20) p.ox = -20;
      if (p.oy < -20) p.oy = h + 20;
      if (p.oy > h + 20) p.oy = -20;

      var d2 = dist2(p.ox, p.oy, cx, cy);
      var txp = p.ox;
      var typ = p.oy;
      if (d2 < pullR2 && d2 > 1) {
        var d = Math.sqrt(d2);
        var f = (1 - d / pullR) * 28;
        txp += ((cx - p.ox) / d) * f;
        typ += ((cy - p.oy) / d) * f;
      }
      p.x = lerp(p.x, txp, 0.18);
      p.y = lerp(p.y, typ, 0.18);
    }

    ctx.lineWidth = 1;
    for (var a = 0; a < pts.length; a++) {
      for (var b = a + 1; b < pts.length; b++) {
        var dd = dist2(pts[a].x, pts[a].y, pts[b].x, pts[b].y);
        if (dd > link2) continue;
        var t = 1 - Math.sqrt(dd) / link;
        var near =
          Math.min(
            dist2(pts[a].x, pts[a].y, cx, cy),
            dist2(pts[b].x, pts[b].y, cx, cy)
          ) <
          180 * 180;
        ctx.strokeStyle = near ? gold(0.15 + t * 0.45) : rgba(180, 190, 210, 0.04 + t * 0.12);
        ctx.beginPath();
        ctx.moveTo(pts[a].x, pts[a].y);
        ctx.lineTo(pts[b].x, pts[b].y);
        ctx.stroke();
      }
    }

    for (var k = 0; k < pts.length; k++) {
      var q = pts[k];
      var nearP = dist2(q.x, q.y, cx, cy) < 140 * 140;
      ctx.fillStyle = nearP ? gold(0.85) : rgba(200, 205, 220, 0.35);
      ctx.beginPath();
      ctx.arc(q.x, q.y, nearP ? 2.2 : 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawParticles(cx, cy, dt) {
    var pts = state.pts;
    var attract = 0.000045 * dt;
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      var dx = cx - p.x;
      var dy = cy - p.y;
      p.vx += dx * attract;
      p.vy += dy * attract;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx * dt * 0.06;
      p.y += p.vy * dt * 0.06;

      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;
      if (p.y < -10) p.y = h + 10;
      if (p.y > h + 10) p.y = -10;

      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 3) p.trail.shift();

      for (var t = 1; t < p.trail.length; t++) {
        var a = p.trail[t - 1];
        var b = p.trail[t];
        ctx.strokeStyle = gold(0.04 + (t / p.trail.length) * 0.2);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      var near = dist2(p.x, p.y, cx, cy) < 120 * 120;
      ctx.fillStyle = near ? gold(0.9) : rgba(212, 175, 55, 0.35);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawLiquid(cx, cy, now) {
    if (now - state.lastSpawn > 420) {
      state.ripples.push({ x: cx, y: cy, r: 4, life: 1, max: rand(90, 160) });
      if (state.ripples.length > 5) state.ripples.shift();
      state.lastSpawn = now;
    }

    // fluid gradient wash
    var g = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.max(w, h) * 0.55);
    g.addColorStop(0, gold(0.18));
    g.addColorStop(0.25, rgba(49, 46, 129, 0.28));
    g.addColorStop(0.55, rgba(15, 23, 42, 0.35));
    g.addColorStop(1, rgba(7, 8, 12, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    for (var i = state.ripples.length - 1; i >= 0; i--) {
      var r = state.ripples[i];
      r.r += 1.8;
      r.life -= 0.012;
      if (r.life <= 0 || r.r > r.max) {
        state.ripples.splice(i, 1);
        continue;
      }
      ctx.strokeStyle = gold(r.life * 0.45);
      ctx.lineWidth = 1.5 + r.life;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = rgba(120, 140, 200, r.life * 0.2);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r * 0.72, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawConstellation(cx, cy, now) {
    var nodes = state.nodes;
    var link = state.link;
    var link2 = link * link;
    var pullR = 200;
    var pullR2 = pullR * pullR;

    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      n.phase += 0.008;
      var baseX = n.bx + Math.cos(n.phase) * 6;
      var baseY = n.by + Math.sin(n.phase * 0.9) * 6;
      var d2 = dist2(baseX, baseY, cx, cy);
      if (d2 < pullR2) {
        n.orbit = lerp(n.orbit, 1, 0.08);
      } else {
        n.orbit = lerp(n.orbit, 0, 0.04);
      }
      if (n.orbit > 0.05) {
        var ang = Math.atan2(baseY - cy, baseX - cx) + now * 0.0012;
        var rad = n.orbitA * n.orbit;
        n.x = lerp(n.x, cx + Math.cos(ang) * rad, 0.12);
        n.y = lerp(n.y, cy + Math.sin(ang) * rad, 0.12);
      } else {
        n.x = lerp(n.x, baseX, 0.08);
        n.y = lerp(n.y, baseY, 0.08);
      }
    }

    ctx.lineWidth = 1;
    for (var a = 0; a < nodes.length; a++) {
      for (var b = a + 1; b < nodes.length; b++) {
        var dd = dist2(nodes[a].x, nodes[a].y, nodes[b].x, nodes[b].y);
        if (dd > link2) continue;
        var t = 1 - Math.sqrt(dd) / link;
        var orbiting = nodes[a].orbit > 0.3 || nodes[b].orbit > 0.3;
        ctx.strokeStyle = orbiting
          ? gold(0.2 + t * 0.5)
          : rgba(160, 170, 200, 0.05 + t * 0.15);
        ctx.beginPath();
        ctx.moveTo(nodes[a].x, nodes[a].y);
        ctx.lineTo(nodes[b].x, nodes[b].y);
        ctx.stroke();
      }
    }

    for (var k = 0; k < nodes.length; k++) {
      var q = nodes[k];
      var r = 1.5 + q.orbit * 2;
      ctx.fillStyle = q.orbit > 0.2 ? gold(0.95) : rgba(220, 225, 240, 0.55);
      ctx.beginPath();
      ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
      ctx.fill();
      if (q.orbit > 0.4) {
        ctx.strokeStyle = gold(0.35);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(q.x, q.y, r + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  function drawAurora(cx, cy, now) {
    var bands = state.bands;
    var bend = (cx / w - 0.5) * 80;
    var accel = 1 + (1 - Math.abs(cy / h - 0.5) * 2) * 0.6;

    for (var i = 0; i < bands.length; i++) {
      var b = bands[i];
      var yBase = b.y + (cy - h * 0.5) * 0.08 * (i + 1);
      ctx.beginPath();
      for (var x = 0; x <= w; x += 16) {
        var wave =
          Math.sin(x * 0.008 + now * b.speed * accel + b.phase) * b.amp +
          Math.sin(x * 0.003 + now * b.speed * 0.6) * (b.amp * 0.4);
        var y = yBase + wave + bend * Math.sin(x / w * Math.PI);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      // fill band downward
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      var gg = ctx.createLinearGradient(0, yBase - b.thick, 0, yBase + b.thick * 2);
      gg.addColorStop(0, rgba(7, 8, 12, 0));
      gg.addColorStop(0.35, gold(b.alpha * 0.9));
      gg.addColorStop(0.55, rgba(49, 46, 129, b.alpha * 1.2));
      gg.addColorStop(1, rgba(7, 8, 12, 0));
      ctx.fillStyle = gg;
      ctx.fill();
    }

    // cursor shear highlight
    var hg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 280);
    hg.addColorStop(0, gold(0.16));
    hg.addColorStop(0.5, rgba(80, 100, 180, 0.1));
    hg.addColorStop(1, rgba(7, 8, 12, 0));
    ctx.fillStyle = hg;
    ctx.fillRect(0, 0, w, h);
  }

  function drawReelPulse(cx, cy, now) {
    // deep black + soft red vignette (premium dark cinematic)
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, w, h);
    var vg = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
    vg.addColorStop(0, rgba(18, 8, 10, 0.9));
    vg.addColorStop(0.55, rgba(8, 6, 8, 0.55));
    vg.addColorStop(1, rgba(0, 0, 0, 0));
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);

    var ox = lerp(w * 0.5, cx, 0.35);
    var oy = lerp(h * 0.48, cy, 0.35);
    var base = Math.min(w, h);

    // horizontal scan / film grain bars (subtle)
    ctx.fillStyle = rgba(255, 255, 255, 0.015);
    var yScan = ((now * 0.04) % (h + 40)) - 20;
    ctx.fillRect(0, yScan, w, 1.5);
    ctx.fillStyle = rgba(200, 16, 46, 0.04);
    ctx.fillRect(0, (yScan + h * 0.33) % h, w, 1);

    // expanding pulse rings
    for (var i = 0; i < state.rings.length; i++) {
      var ring = state.rings[i];
      var t = (now * ring.speed + ring.phase) % 1;
      // use sin for breathe
      var breath = 0.5 + 0.5 * Math.sin(now * ring.speed * 6 + ring.phase);
      var rr = base * (0.05 + ring.maxR * (0.35 + 0.65 * breath));
      ctx.beginPath();
      ctx.arc(ox, oy, rr, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(RED_RGB[0], RED_RGB[1], RED_RGB[2], ring.alpha * (0.45 + breath * 0.55));
      ctx.lineWidth = 1.5 + breath * 2;
      ctx.stroke();
      // white hairline echo
      ctx.beginPath();
      ctx.arc(ox, oy, rr * 0.92, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(255, 255, 255, 0.04 + breath * 0.06);
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // core glow
    var core = ctx.createRadialGradient(ox, oy, 0, ox, oy, base * 0.22);
    core.addColorStop(0, rgba(255, 255, 255, 0.12));
    core.addColorStop(0.25, rgba(RED_RGB[0], RED_RGB[1], RED_RGB[2], 0.28));
    core.addColorStop(0.7, rgba(RED_RGB[0], 8, 20, 0.08));
    core.addColorStop(1, rgba(0, 0, 0, 0));
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, w, h);

    // sparse white sparks orbiting
    for (var s = 0; s < state.sparks.length; s++) {
      var sp = state.sparks[s];
      sp.a += sp.spin * 16;
      var sx = ox + Math.cos(sp.a + now * 0.0002) * (base * sp.r);
      var sy = oy + Math.sin(sp.a + now * 0.0002) * (base * sp.r * 0.72);
      var blink = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(now * 0.004 + sp.blink));
      ctx.fillStyle = rgba(255, 255, 255, 0.25 * blink);
      ctx.beginPath();
      ctx.arc(sx, sy, sp.size, 0, Math.PI * 2);
      ctx.fill();
      // micro red spark twin
      ctx.fillStyle = rgba(RED_RGB[0], RED_RGB[1], RED_RGB[2], 0.35 * blink);
      ctx.beginPath();
      ctx.arc(sx + 3, sy - 2, Math.max(0.8, sp.size * 0.55), 0, Math.PI * 2);
      ctx.fill();
    }

    // cursor following soft red bloom
    var cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 260);
    cg.addColorStop(0, rgba(RED_RGB[0], RED_RGB[1], RED_RGB[2], 0.18));
    cg.addColorStop(0.4, rgba(255, 255, 255, 0.04));
    cg.addColorStop(1, rgba(0, 0, 0, 0));
    ctx.fillStyle = cg;
    ctx.fillRect(0, 0, w, h);
  }

  function roundRectPath(x, y, rw, rh, rad) {
    var r = Math.min(rad, rw * 0.5, rh * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + rw, y, x + rw, y + rh, r);
    ctx.arcTo(x + rw, y + rh, x, y + rh, r);
    ctx.arcTo(x, y + rh, x, y, r);
    ctx.arcTo(x, y, x + rw, y, r);
    ctx.closePath();
  }

  function drawLight3d(cx, cy, now) {
    // soft cream base + sky wash (daylight ambient)
    ctx.fillStyle = LIGHT_BG;
    ctx.fillRect(0, 0, w, h);

    var sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, rgba(SKY_RGB[0], SKY_RGB[1], SKY_RGB[2], 0.42));
    sky.addColorStop(0.45, rgba(CREAM_RGB[0], CREAM_RGB[1], CREAM_RGB[2], 0.55));
    sky.addColorStop(1, rgba(LIGHT_BG_RGB[0], LIGHT_BG_RGB[1], LIGHT_BG_RGB[2], 1));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // soft meadow / horizon bloom (restrained, no photo)
    var meadow = ctx.createRadialGradient(w * 0.5, h * 1.05, 0, w * 0.5, h * 0.75, Math.max(w, h) * 0.7);
    meadow.addColorStop(0, rgba(170, 190, 150, 0.14));
    meadow.addColorStop(0.55, rgba(200, 16, 46, 0.03));
    meadow.addColorStop(1, rgba(244, 241, 234, 0));
    ctx.fillStyle = meadow;
    ctx.fillRect(0, 0, w, h);

    var ox = (cx / w - 0.5);
    var oy = (cy / h - 0.5);

    // depth orbs
    for (var i = 0; i < state.orbs.length; i++) {
      var o = state.orbs[i];
      var px = o.x + ox * 28 * o.z + Math.sin(now * 0.00025 + o.phase) * 10 * o.z;
      var py = o.y + oy * 22 * o.z + Math.cos(now * 0.00022 + o.phase) * 8 * o.z;
      var og = ctx.createRadialGradient(px, py, 0, px, py, o.r);
      og.addColorStop(0, rgba(GLASS_RGB[0], GLASS_RGB[1], GLASS_RGB[2], o.a + 0.06));
      og.addColorStop(0.45, rgba(SKY_RGB[0], SKY_RGB[1], SKY_RGB[2], o.a * 0.55));
      og.addColorStop(1, rgba(LIGHT_BG_RGB[0], LIGHT_BG_RGB[1], LIGHT_BG_RGB[2], 0));
      ctx.fillStyle = og;
      ctx.beginPath();
      ctx.arc(px, py, o.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // floating glass panes (sorted soft → near)
    var panes = state.panes.slice().sort(function (a, b) { return a.z - b.z; });
    for (var p = 0; p < panes.length; p++) {
      var pane = panes[p];
      var depth = pane.z;
      var sway = Math.sin(now * pane.drift * 40 + pane.phase) * 6 * depth;
      var px2 = pane.x + ox * (36 + depth * 48) + sway;
      var py2 = pane.y + oy * (28 + depth * 36) + Math.cos(now * pane.drift * 32 + pane.phase) * 4;
      var alpha = 0.22 + depth * 0.38;

      // soft drop shadow under pane
      ctx.save();
      ctx.translate(px2 + pane.w * 0.5, py2 + pane.h * 0.5 + 10 + depth * 8);
      ctx.scale(1 + depth * 0.04, 1);
      ctx.fillStyle = rgba(40, 35, 30, 0.045 + depth * 0.05);
      roundRectPath(-pane.w * 0.5, -pane.h * 0.5, pane.w, pane.h, pane.r);
      ctx.fill();
      ctx.restore();

      // glass body
      ctx.save();
      ctx.translate(px2 + pane.w * 0.5, py2 + pane.h * 0.5);
      // subtle CSS-like 3D tilt via canvas transform
      var skewX = ox * 0.04 * depth;
      var skewY = oy * 0.03 * depth;
      ctx.transform(1, skewY, skewX, 1, 0, 0);

      // fill
      var gg = ctx.createLinearGradient(-pane.w * 0.5, -pane.h * 0.5, pane.w * 0.5, pane.h * 0.5);
      gg.addColorStop(0, rgba(255, 255, 255, 0.55 * alpha + 0.2));
      gg.addColorStop(0.5, rgba(252, 250, 245, 0.35 * alpha + 0.12));
      gg.addColorStop(1, rgba(230, 236, 242, 0.28 * alpha + 0.08));
      ctx.fillStyle = gg;
      roundRectPath(-pane.w * 0.5, -pane.h * 0.5, pane.w, pane.h, pane.r);
      ctx.fill();

      // rim highlight
      ctx.strokeStyle = rgba(255, 255, 255, 0.55 + depth * 0.25);
      ctx.lineWidth = 1.25;
      roundRectPath(-pane.w * 0.5, -pane.h * 0.5, pane.w, pane.h, pane.r);
      ctx.stroke();

      // inner hairline (depth)
      ctx.strokeStyle = rgba(30, 28, 26, 0.06);
      ctx.lineWidth = 1;
      roundRectPath(-pane.w * 0.5 + 3, -pane.h * 0.5 + 3, pane.w - 6, pane.h - 6, Math.max(8, pane.r - 4));
      ctx.stroke();

      // restrained Blueprint red accent corner mark
      if (depth > 0.65) {
        ctx.fillStyle = rgba(RED_RGB[0], RED_RGB[1], RED_RGB[2], 0.55);
        ctx.fillRect(pane.w * 0.5 - 18, -pane.h * 0.5 + 10, 8, 2);
      }

      ctx.restore();
    }

    // cursor soft bloom (cream / faint red)
    var cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 260);
    cg.addColorStop(0, rgba(255, 255, 255, 0.35));
    cg.addColorStop(0.25, rgba(RED_RGB[0], RED_RGB[1], RED_RGB[2], 0.05));
    cg.addColorStop(0.55, rgba(SKY_RGB[0], SKY_RGB[1], SKY_RGB[2], 0.08));
    cg.addColorStop(1, rgba(244, 241, 234, 0));
    ctx.fillStyle = cg;
    ctx.fillRect(0, 0, w, h);

    // publish parallax CSS vars for page cards (subtle)
    document.documentElement.style.setProperty("--mm-l3d-ox", (ox * 8).toFixed(2) + "px");
    document.documentElement.style.setProperty("--mm-l3d-oy", (oy * 6).toFixed(2) + "px");
    document.documentElement.style.setProperty("--mm-l3d-rx", (oy * -2.2).toFixed(2) + "deg");
    document.documentElement.style.setProperty("--mm-l3d-ry", (ox * 2.8).toFixed(2) + "deg");
  }

  var lastPaint = 0;
  var FRAME_MS = 50; // ~20fps base — lighter on main thread
  var FRAME_MS_HEAVY = 66; // ~15fps for particles/liquid/aurora/reel-pulse/light-3d

  function frameBudget() {
    // Heavy variants always throttle harder
    if (variant === "particles" || variant === "liquid" || variant === "aurora" || variant === "reel-pulse" || variant === "light-3d") {
      return FRAME_MS_HEAVY;
    }
    return FRAME_MS;
  }

  function frame(now) {
    if (!running) return;
    if (document.hidden) {
      raf = 0;
      return;
    }
    raf = requestAnimationFrame(frame);
    if (now - lastPaint < frameBudget()) {
      // still lerp targets lightly without canvas work
      px = lerp(px, tx, LERP);
      py = lerp(py, ty, LERP);
      return;
    }
    lastPaint = now;

    var dt = Math.min(48, now - t0);
    t0 = now;

    px = lerp(px, tx, LERP);
    py = lerp(py, ty, LERP);
    var cx = px * w;
    var cy = py * h;

    if (variant === "reel-pulse") {
      drawReelPulse(cx, cy, now);
      return;
    }
    if (variant === "light-3d") {
      drawLight3d(cx, cy, now);
      return;
    }

    clearBase();
    if (variant !== "liquid" && variant !== "aurora") {
      drawCursorGlow(cx, cy);
    }

    switch (variant) {
      case "web":
        drawWeb(cx, cy, dt);
        break;
      case "particles":
        drawParticles(cx, cy, dt);
        break;
      case "liquid":
        drawLiquid(cx, cy, now);
        break;
      case "constellation":
        drawConstellation(cx, cy, now);
        break;
      case "aurora":
        drawAurora(cx, cy, now);
        break;
      case "reel-pulse":
        drawReelPulse(cx, cy, now);
        break;
    }
  }

  function start() {
    if (running) return;
    running = true;
    t0 = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function onPointer(e) {
    var ww = window.innerWidth || 1;
    var hh = window.innerHeight || 1;
    tx = e.clientX / ww;
    ty = e.clientY / hh;
  }

  function onVisibility() {
    if (document.hidden) stop();
    else if (!soft && !reduce) start();
  }

  function paintStaticOnce() {
    if (!ctx) return;
    if (variant === "reel-pulse") {
      ctx.fillStyle = "#050505";
      ctx.fillRect(0, 0, w, h);
      var rg = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.55);
      rg.addColorStop(0, rgba(200, 16, 46, 0.28));
      rg.addColorStop(0.4, rgba(40, 8, 12, 0.45));
      rg.addColorStop(1, "#050505");
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);
      return;
    }
    if (variant === "light-3d") {
      applyLightThemeClass(true);
      ctx.fillStyle = LIGHT_BG;
      ctx.fillRect(0, 0, w, h);
      var lg = ctx.createLinearGradient(0, 0, 0, h);
      lg.addColorStop(0, rgba(186, 210, 228, 0.4));
      lg.addColorStop(0.5, rgba(252, 250, 245, 0.7));
      lg.addColorStop(1, LIGHT_BG);
      ctx.fillStyle = lg;
      ctx.fillRect(0, 0, w, h);
      var soft = ctx.createRadialGradient(w * 0.5, h * 0.35, 0, w * 0.5, h * 0.4, Math.max(w, h) * 0.5);
      soft.addColorStop(0, rgba(255, 255, 255, 0.7));
      soft.addColorStop(0.5, rgba(200, 16, 46, 0.04));
      soft.addColorStop(1, rgba(244, 241, 234, 0));
      ctx.fillStyle = soft;
      ctx.fillRect(0, 0, w, h);
      return;
    }
    clearBase();
    var g = ctx.createRadialGradient(
      w * 0.5,
      h * 0.35,
      0,
      w * 0.5,
      h * 0.4,
      Math.max(w, h) * 0.55
    );
    g.addColorStop(0, gold(0.22));
    g.addColorStop(0.45, rgba(15, 23, 42, 0.5));
    g.addColorStop(1, BG);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function init() {
    if (!document.body) return;
    // Blueprint hub: skip heavy canvas ambient (Event pages no longer load this script)
    if (document.body.getAttribute("data-page") === "cartel") {
      soft = true;
    }
    ensureDom();
    variant = loadVariant();
    syncPicker();
    resize();

    function enterSoft(reason) {
      soft = true;
      document.body.classList.add("mm-ambient-reduced");
      if (reason === "narrow") document.body.classList.add("mm-ambient-narrow");
      else document.body.classList.remove("mm-ambient-narrow");
      stop();
      paintStaticOnce();
      if (picker) picker.setAttribute("aria-disabled", "true");
    }

    function leaveSoftIfAllowed() {
      if (reduce) return;
      soft = false;
      document.body.classList.remove("mm-ambient-reduced", "mm-ambient-narrow");
      if (picker) picker.removeAttribute("aria-disabled");
      resize();
      initState();
      start();
    }

    function onResizeSoftAware() {
      narrow =
        window.matchMedia &&
        window.matchMedia("(max-width: 720px)").matches;
      var nextSoft = reduce || narrow;
      if (nextSoft) {
        enterSoft(narrow ? "narrow" : "reduce");
        resize();
        return;
      }
      if (soft && !nextSoft) {
        leaveSoftIfAllowed();
        return;
      }
      resize();
    }

    if (soft) {
      enterSoft(narrow ? "narrow" : "reduce");
      window.addEventListener("resize", onResizeSoftAware, { passive: true });
      return;
    }

    window.addEventListener("resize", onResizeSoftAware, { passive: true });

    if (fine) {
      window.addEventListener("pointermove", onPointer, { passive: true });
    }

    document.addEventListener("visibilitychange", onVisibility);
    // Defer rAF until after load (and idle) so hero/CSS paint first
    scheduleAmbientStart();
  }

  function scheduleAmbientStart() {
    function go() {
      if (soft || reduce || document.hidden) return;
      start();
    }
    function afterLoad() {
      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(go, { timeout: 1500 });
      } else {
        setTimeout(go, 0);
      }
    }
    if (document.readyState === "complete") {
      afterLoad();
    } else {
      window.addEventListener("load", afterLoad, { once: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // public hook for debugging / external pickers
  window.MMAmbient = {
    setVariant: setVariant,
    getVariant: function () {
      return variant;
    },
    variants: VARIANTS.slice()
  };
})();
