/**
 * Mens Mercatus — page-wide silk ambient + card tilt + scroll reveal.
 * Ace tilt uses CSS vars (--mm-tilt-*) so it never stomps flip rotateY.
 * Perf: low-res canvas (~0.35×), few motes, idle skip, shared rAF, no filters/getImageData.
 */
(function () {
  "use strict";
  if (window.__mmSilkBooted) return;
  window.__mmSilkBooted = true;

  var reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine =
    window.matchMedia &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var narrow =
    window.matchMedia && window.matchMedia("(max-width: 720px)").matches;

  var SCALE = narrow ? 0.32 : 0.38;
  var DPR_CAP = 1.25;
  var FRAME_MS_ACTIVE = 22; // ~45fps when moving
  var FRAME_MS_IDLE = 120; // ~8fps when settled
  var MOTE_N = narrow ? 8 : 12;
  var IDLE_EPS = 0.0012;

  var layer = document.getElementById("mm-silk-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.id = "mm-silk-layer";
    layer.className = "mm-silk-layer";
    layer.setAttribute("aria-hidden", "true");
    layer.innerHTML =
      '<canvas id="mm-silk-bg"></canvas>' +
      '<div class="mm-silk-guilloche"></div>' +
      '<div class="mm-silk-grain"></div>';
    document.body.insertBefore(layer, document.body.firstChild);
  }
  document.body.classList.add("mm-has-silk");
  document.querySelectorAll(".hero-silk canvas").forEach(function (c) {
    c.style.display = "none";
  });

  var canvas = document.getElementById("mm-silk-bg");
  if (!canvas) return;
  var ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
  if (!ctx) return;

  var cw = 0, ch = 0, vw = 0, vh = 0;
  var raf = 0, running = false;
  var t0 = performance.now(), last = 0;
  var mx = 0.55, my = 0.4, tx = 0.55, ty = 0.4;
  var ripples = [];
  var motes = [];
  var autoA = 0;
  var lastLight = null;
  var silkX = "", silkY = "";
  var tiltJobs = []; // shared with main rAF

  function isLight() {
    return document.documentElement.classList.contains("mm-light");
  }

  function initMotes() {
    motes = [];
    for (var i = 0; i < MOTE_N; i++) {
      motes.push({
        x: Math.random(),
        y: Math.random(),
        r: 0.5 + Math.random() * 1.4,
        vx: (Math.random() - 0.5) * 0.0002,
        vy: (Math.random() - 0.5) * 0.0002,
        a: 0.12 + Math.random() * 0.28,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  function resize() {
    vw = Math.max(1, document.documentElement.clientWidth || window.innerWidth);
    vh = Math.max(1, document.documentElement.clientHeight || window.innerHeight);
    var dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    cw = Math.max(1, Math.floor(vw * SCALE * dpr));
    ch = Math.max(1, Math.floor(vh * SCALE * dpr));
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    canvas.style.width = "100%";
    canvas.style.height = "100%";
  }

  function softOrb(x, y, r, rgba) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cw, ch);
  }

  function paint(now) {
    var light = isLight();
    var t = (now - t0) * 0.001;
    if (!fine) {
      autoA += 0.0035;
      tx = 0.5 + Math.sin(autoA * 0.65) * 0.2;
      ty = 0.42 + Math.cos(autoA * 0.5) * 0.16;
    }
    mx += (tx - mx) * 0.1;
    my += (ty - my) * 0.1;

    var bendX = (mx - 0.5) * 0.1;
    var bendY = (my - 0.5) * 0.08;
    var R = Math.max(cw, ch);

    if (light) {
      ctx.fillStyle = "#f2eee5";
      ctx.fillRect(0, 0, cw, ch);
      softOrb(cw * mx, ch * my, R * 0.55, "rgba(255,255,255,0.75)");
      softOrb(cw * (0.25 + bendX), ch * (0.3 + bendY), R * 0.42, "rgba(200,16,46,0.1)");
      softOrb(cw * (0.78 + bendX * 0.5), ch * (0.6 + bendY * 0.4), R * 0.36, "rgba(212,175,55,0.08)");
    } else {
      ctx.fillStyle = "#080809";
      ctx.fillRect(0, 0, cw, ch);
      softOrb(cw * (0.22 + bendX), ch * (0.34 + bendY), R * 0.5, "rgba(200,16,46,0.17)");
      softOrb(cw * mx, ch * my, R * 0.32, "rgba(200,16,46,0.22)");
      softOrb(cw * (0.75 + bendX * 0.4), ch * (0.65 + bendY * 0.3), R * 0.4, "rgba(120,8,26,0.14)");
      softOrb(cw * 0.5, ch * 0.15, R * 0.28, "rgba(212,175,55,0.05)");
    }

    // motes (cheap arcs)
    ctx.fillStyle = light ? "rgba(200,16,46,0.28)" : "rgba(255,220,180,0.28)";
    for (var i = 0; i < motes.length; i++) {
      var m = motes[i];
      var dx = m.x - mx;
      var dy = m.y - my;
      var d2 = dx * dx + dy * dy;
      if (d2 < 0.035 && d2 > 1e-5) {
        var f = 0.00028 / d2;
        m.vx += dx * f;
        m.vy += dy * f;
      }
      m.x += m.vx;
      m.y += m.vy;
      m.vx *= 0.985;
      m.vy *= 0.985;
      if (m.x < -0.04) m.x = 1.04;
      if (m.x > 1.04) m.x = -0.04;
      if (m.y < -0.04) m.y = 1.04;
      if (m.y > 1.04) m.y = -0.04;
      ctx.globalAlpha = m.a * (0.7 + 0.3 * Math.sin(t * 1.2 + m.phase));
      ctx.beginPath();
      ctx.arc(m.x * cw, m.y * ch, m.r, 0, 6.2832);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (var r = ripples.length - 1; r >= 0; r--) {
      var rp = ripples[r];
      rp.age += 0.022;
      var life = rp.age / rp.ttl;
      if (life >= 1) {
        ripples.splice(r, 1);
        continue;
      }
      ctx.beginPath();
      ctx.strokeStyle = light
        ? "rgba(200,16,46," + (0.32 * (1 - life)) + ")"
        : "rgba(255,210,63," + (0.36 * (1 - life)) + ")";
      ctx.lineWidth = 1.5 * (1 - life) + 0.4;
      ctx.arc(rp.x * cw, rp.y * ch, life * R * 0.26, 0, 6.2832);
      ctx.stroke();
    }

    var nx = (mx * 100).toFixed(1) + "%";
    var ny = (my * 100).toFixed(1) + "%";
    if (nx !== silkX || ny !== silkY) {
      silkX = nx;
      silkY = ny;
      document.documentElement.style.setProperty("--mm-silk-x", nx);
      document.documentElement.style.setProperty("--mm-silk-y", ny);
    }
    lastLight = light;
  }

  function stepTilts() {
    for (var i = 0; i < tiltJobs.length; i++) {
      tiltJobs[i]();
    }
  }

  function isIdle() {
    return (
      Math.abs(tx - mx) < IDLE_EPS &&
      Math.abs(ty - my) < IDLE_EPS &&
      ripples.length === 0 &&
      fine
    );
  }

  function tick(now) {
    if (!running) return;
    raf = requestAnimationFrame(tick);
    if (document.hidden) return;
    stepTilts();
    var budget = isIdle() ? FRAME_MS_IDLE : FRAME_MS_ACTIVE;
    if (now - last < budget) return;
    last = now;
    paint(now);
  }

  function start() {
    if (running || reduce) return;
    running = true;
    last = 0;
    raf = requestAnimationFrame(tick);
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function onMove(e) {
    if (!fine || reduce) return;
    var W = document.documentElement.clientWidth || window.innerWidth;
    var H = document.documentElement.clientHeight || window.innerHeight;
    tx = Math.min(1, Math.max(0, e.clientX / W));
    ty = Math.min(1, Math.max(0, e.clientY / H));
  }
  function onClick(e) {
    if (reduce) return;
    // Don't ripple-steal ace clicks — still ok to paint soft pulse
    var W = document.documentElement.clientWidth || window.innerWidth;
    var H = document.documentElement.clientHeight || window.innerHeight;
    ripples.push({ x: e.clientX / W, y: e.clientY / H, age: 0, ttl: 0.75 });
    if (ripples.length > 4) ripples.shift();
  }

  /* —— Tilt via CSS vars (ace) or transform (discover cards) —— */
  function wireTilt() {
    if (reduce || !fine) return;
    document.querySelectorAll(".mm-ace-card").forEach(function (el) {
      if (el.__mmTilt) return;
      el.__mmTilt = true;
      el.classList.add("mm-tilt");
      var rx = 0, ry = 0, trx = 0, try_ = 0;
      function step() {
        rx += (trx - rx) * 0.16;
        ry += (try_ - ry) * 0.16;
        el.style.setProperty("--mm-tilt-x", rx.toFixed(2) + "deg");
        el.style.setProperty("--mm-tilt-y", ry.toFixed(2) + "deg");
      }
      tiltJobs.push(step);
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        try_ = px * 10; // mild Y
        trx = -py * 8;
      });
      el.addEventListener("pointerleave", function () {
        trx = 0;
        try_ = 0;
      });
    });

    document.querySelectorAll(".discover-card").forEach(function (el) {
      if (el.__mmTilt) return;
      el.__mmTilt = true;
      el.classList.add("mm-tilt");
      var rx = 0, ry = 0, trx = 0, try_ = 0;
      function step() {
        rx += (trx - rx) * 0.16;
        ry += (try_ - ry) * 0.16;
        if (Math.abs(rx) < 0.02 && Math.abs(ry) < 0.02 && trx === 0 && try_ === 0) {
          el.style.transform = "";
          return;
        }
        el.style.transform =
          "perspective(900px) rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg)";
      }
      tiltJobs.push(step);
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        try_ = px * 8;
        trx = -py * 8;
      });
      el.addEventListener("pointerleave", function () {
        trx = 0;
        try_ = 0;
      });
    });
  }

  /* —— Ace flip: hover (fine) / click-tap toggle (coarse) —— */
  function wireAceFlip() {
    var card = document.querySelector(".mm-ace-card");
    if (!card || card.__mmFlipWired) return;
    card.__mmFlipWired = true;
    // Ensure default front
    card.classList.remove("is-flipped");
    card.setAttribute("aria-pressed", "false");

    if (!fine) {
      card.addEventListener("click", function (e) {
        // toggle flip on tap; ignore mute button
        if (e.target.closest && e.target.closest(".mm-ace-mute")) return;
        card.classList.toggle("is-flipped");
        card.setAttribute("aria-pressed", card.classList.contains("is-flipped") ? "true" : "false");
      });
    }
  }

  function wireReveal() {
    var sels = [".section", ".mm-picks", ".discover-grid", ".hub-hero", ".section-head", ".pipe-card", ".hub-card"];
    var els = [];
    sels.forEach(function (s) {
      document.querySelectorAll(s).forEach(function (el) {
        el.classList.add("mm-reveal");
        els.push(el);
      });
    });
    if (reduce || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add("is-in");
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    els.forEach(function (el) { io.observe(el); });
  }

  initMotes();
  resize();
  paint(performance.now());
  if (!reduce) start();

  window.addEventListener("resize", function () {
    resize();
    paint(performance.now());
  }, { passive: true });
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerdown", onClick, { passive: true });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop();
    else if (!reduce) {
      paint(performance.now());
      start();
    }
  });
  window.addEventListener("mm-color-mode", function () {
    paint(performance.now());
  });
  new MutationObserver(function () {
    paint(performance.now());
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

  function bootUI() {
    wireTilt();
    wireAceFlip();
    wireReveal();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootUI);
  } else {
    bootUI();
  }
  setTimeout(function () {
    wireTilt();
    wireAceFlip();
  }, 600);

  window.MMSilk = {
    resume: start,
    pause: stop,
    paint: function () { paint(performance.now()); }
  };
})();
