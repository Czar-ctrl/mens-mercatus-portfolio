/* FMC Tour background — automated ambient field + cursor-reactive spotlight. */

(function () {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wrap = document.querySelector(".cap-track-wrap");
  if (!wrap) return;

  const canvas = document.createElement("canvas");
  canvas.id = "cap-bg";
  canvas.setAttribute("aria-hidden", "true");
  wrap.prepend(canvas);
  wrap.classList.add("has-cap-bg");
  const ctx = canvas.getContext("2d");

  let W = 0, H = 0, dpr = 1;
  let mx = 0.5, my = 0.45, tx = 0.5, ty = 0.45;
  let inside = false;
  let t = 0;
  let raf = 0;
  const nodes = Array.from({ length: 28 }, (_, i) => ({
    x: (i * 0.137) % 1,
    y: (i * 0.271 + 0.13) % 1,
    r: 1.2 + (i % 5) * 0.45,
    s: 0.35 + (i % 7) * 0.08,
    phase: i * 0.7,
  }));
  const ripples = [];

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    const r = wrap.getBoundingClientRect();
    W = Math.max(1, r.width);
    H = Math.max(1, r.height);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function onMove(e) {
    const r = wrap.getBoundingClientRect();
    tx = (e.clientX - r.left) / Math.max(1, r.width);
    ty = (e.clientY - r.top) / Math.max(1, r.height);
    inside = tx >= 0 && tx <= 1 && ty >= 0 && ty <= 1;
    if (inside && ripples.length < 10) {
      ripples.push({ x: tx, y: ty, life: 0, max: 0.9 + Math.random() * 0.4 });
    }
  }

  function paint() {
    raf = 0;
    t += 0.016;
    mx += (tx - mx) * 0.12;
    my += (ty - my) * 0.12;

    ctx.clearRect(0, 0, W, H);

    // base wash
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "rgba(238,242,255,0.95)");
    g.addColorStop(0.55, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(245,243,255,0.9)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // automated drifting orbs
    for (let i = 0; i < 5; i++) {
      const ox = (0.15 + i * 0.18 + Math.sin(t * 0.22 + i) * 0.06) * W;
      const oy = (0.25 + ((i * 0.17) % 0.55) + Math.cos(t * 0.18 + i * 1.3) * 0.08) * H;
      const rad = (90 + i * 28) * (0.85 + 0.15 * Math.sin(t * 0.3 + i));
      const orb = ctx.createRadialGradient(ox, oy, 0, ox, oy, rad);
      orb.addColorStop(0, i % 2 ? "rgba(79,70,229,0.14)" : "rgba(139,92,246,0.12)");
      orb.addColorStop(1, "rgba(79,70,229,0)");
      ctx.fillStyle = orb;
      ctx.beginPath();
      ctx.arc(ox, oy, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    // soft grid that breathes
    ctx.save();
    ctx.strokeStyle = "rgba(79,70,229,0.06)";
    ctx.lineWidth = 1;
    const gap = 42 + Math.sin(t * 0.4) * 2;
    const ox = (mx - 0.5) * 24;
    const oy = (my - 0.5) * 18;
    for (let x = -gap; x < W + gap; x += gap) {
      ctx.beginPath();
      ctx.moveTo(x + ox, 0);
      ctx.lineTo(x + ox + oy * 0.15, H);
      ctx.stroke();
    }
    for (let y = -gap; y < H + gap; y += gap) {
      ctx.beginPath();
      ctx.moveTo(0, y + oy);
      ctx.lineTo(W, y + oy + ox * 0.08);
      ctx.stroke();
    }
    ctx.restore();

    // constellation nodes + links
    const pts = nodes.map((n) => {
      const x = (n.x + Math.sin(t * n.s + n.phase) * 0.03) * W;
      const y = (n.y + Math.cos(t * n.s * 0.9 + n.phase) * 0.04) * H;
      return { x, y, r: n.r };
    });
    ctx.strokeStyle = "rgba(79,70,229,0.1)";
    ctx.lineWidth = 1;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x;
        const dy = pts[i].y - pts[j].y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 130 * 130) {
          ctx.globalAlpha = 1 - Math.sqrt(d2) / 130;
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
    pts.forEach((p) => {
      ctx.fillStyle = "rgba(79,70,229,0.35)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // cursor spotlight
    if (inside || Math.hypot(tx - 0.5, ty - 0.5) > 0.02) {
      const cx = mx * W;
      const cy = my * H;
      const spot = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.42);
      spot.addColorStop(0, "rgba(99,102,241,0.22)");
      spot.addColorStop(0.35, "rgba(139,92,246,0.08)");
      spot.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = spot;
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = "rgba(79,70,229,0.28)";
      ctx.setLineDash([5, 7]);
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, H);
      ctx.moveTo(0, cy);
      ctx.lineTo(W, cy);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "rgba(79,70,229,0.55)";
      ctx.beginPath();
      ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // ripples from pointer
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.life += 0.025;
      if (r.life > r.max) { ripples.splice(i, 1); continue; }
      const rad = r.life * 90;
      ctx.strokeStyle = `rgba(79,70,229,${(1 - r.life / r.max) * 0.35})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(r.x * W, r.y * H, rad, 0, Math.PI * 2);
      ctx.stroke();
    }

    // automated horizontal sweep (price-tape feel)
    const sweepY = ((Math.sin(t * 0.35) * 0.5 + 0.5) * 0.7 + 0.15) * H;
    const sg = ctx.createLinearGradient(0, sweepY - 18, 0, sweepY + 18);
    sg.addColorStop(0, "rgba(79,70,229,0)");
    sg.addColorStop(0.5, "rgba(79,70,229,0.08)");
    sg.addColorStop(1, "rgba(79,70,229,0)");
    ctx.fillStyle = sg;
    ctx.fillRect(0, sweepY - 18, W, 36);

    if (!reduce) raf = requestAnimationFrame(paint);
  }

  function kick() {
    if (!raf) raf = requestAnimationFrame(paint);
  }

  resize();
  addEventListener("resize", () => { resize(); kick(); });
  wrap.addEventListener("pointermove", onMove, { passive: true });
  wrap.addEventListener("pointerenter", () => { inside = true; kick(); });
  wrap.addEventListener("pointerleave", () => { inside = false; });

  // idle auto wander when pointer leaves
  setInterval(() => {
    if (inside || reduce) return;
    tx = 0.35 + Math.sin(performance.now() / 3200) * 0.28;
    ty = 0.4 + Math.cos(performance.now() / 4100) * 0.22;
  }, 80);

  if (reduce) {
    paint();
  } else {
    kick();
  }
})();
