/* FMC Ringwriter intro — phrase coiled on spinning rings.
   Cursor melts glyphs → dots; hold to charge, release to fire a ripple. */

(function () {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const force = new URLSearchParams(location.search).has("intro");
  if (force) sessionStorage.removeItem("fmc_intro_done");
  if (reduce || (!force && sessionStorage.getItem("fmc_intro_done") === "1")) return;

  const root = document.createElement("div");
  root.id = "ring-intro";
  root.innerHTML = `
    <canvas id="ring-canvas" aria-hidden="true"></canvas>
    <div class="ring-ui">
      <p class="ring-kicker">FX MERCATUS CODEX</p>
      <h1 class="ring-title">Ringwriter</h1>
      <p class="ring-hint">Move to melt glyphs · hold to charge · release to ripple the rings</p>
      <div class="ring-charge"><i id="ring-charge-fill"></i></div>
      <button type="button" class="btn primary" id="ring-enter">Enter the desk</button>
      <button type="button" class="btn ghost small" id="ring-skip">Skip</button>
    </div>`;
  document.body.prepend(root);
  document.body.classList.add("intro-lock");

  const canvas = root.querySelector("#ring-canvas");
  const ctx = canvas.getContext("2d");
  const fill = root.querySelector("#ring-charge-fill");
  const PHRASE = "FX MERCATUS CODEX · PAPER DESK · WHALES · GAMMA · QUANT · ";
  const RINGS = 5;
  let W = 0, H = 0, dpr = 1;
  let mx = 0, my = 0, holding = false, charge = 0;
  const ripples = [];
  const rings = [];

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  addEventListener("resize", resize);

  for (let i = 0; i < RINGS; i++) {
    const radius = 70 + i * 52;
    const chars = [];
    const count = Math.max(18, Math.floor((Math.PI * 2 * radius) / 14));
    for (let c = 0; c < count; c++) {
      chars.push({
        ch: PHRASE[c % PHRASE.length],
        melt: 0,
        spinKick: 0,
      });
    }
    rings.push({
      radius,
      angle: (i % 2 ? 1 : -1) * i * 0.4,
      speed: (i % 2 ? 1 : -1) * (0.0022 + i * 0.00035),
      chars,
    });
  }

  function dismiss() {
    sessionStorage.setItem("fmc_intro_done", "1");
    root.classList.add("out");
    document.body.classList.remove("intro-lock");
    setTimeout(() => root.remove(), 700);
  }

  root.querySelector("#ring-enter").addEventListener("click", dismiss);
  root.querySelector("#ring-skip").addEventListener("click", dismiss);

  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    mx = e.clientX - r.left;
    my = e.clientY - r.top;
  });
  canvas.addEventListener("pointerdown", (e) => {
    holding = true;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointerup", (e) => {
    if (!holding) return;
    holding = false;
    if (charge > 0.15) {
      ripples.push({ x: mx, y: my, r: 8, max: 40 + charge * 280, life: 0.6 + charge * 1.4, life: 1 });
      rings.forEach((ring, i) => {
        const dx = mx - W / 2, dy = my - H / 2;
        const dist = Math.hypot(dx, dy);
        const hit = Math.abs(dist - ring.radius);
        if (hit < 80 + charge * 60) {
          ring.speed += (i % 2 ? 1 : -1) * (0.018 + charge * 0.04);
          ring.chars.forEach((ch) => { ch.spinKick = charge; });
        }
      });
    }
    charge = 0;
    fill.style.transform = "scaleX(0)";
  });
  canvas.addEventListener("pointerleave", () => { holding = false; charge = 0; fill.style.transform = "scaleX(0)"; });

  let last = performance.now();
  function frame(now) {
    if (!document.body.contains(root)) return;
    const dt = Math.min(32, now - last); last = now;
    if (holding) {
      charge = Math.min(1, charge + dt * 0.0011);
      fill.style.transform = `scaleX(${charge})`;
    }

    ctx.clearRect(0, 0, W, H);
    // soft field
    const g = ctx.createRadialGradient(mx, my, 0, mx, my, 280);
    g.addColorStop(0, "rgba(79,70,229,0.16)");
    g.addColorStop(1, "rgba(245,246,251,0)");
    ctx.fillStyle = "#f3f4fa";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const cx = W / 2, cy = H / 2;
    rings.forEach((ring) => {
      ring.speed *= 0.994;
      ring.angle += ring.speed * (dt / 16);
      const n = ring.chars.length;
      for (let i = 0; i < n; i++) {
        const ch = ring.chars[i];
        const a = ring.angle + (i / n) * Math.PI * 2;
        const x = cx + Math.cos(a) * ring.radius;
        const y = cy + Math.sin(a) * ring.radius;
        const dist = Math.hypot(x - mx, y - my);
        const targetMelt = dist < 56 ? 1 - dist / 56 : 0;
        ch.melt += (targetMelt - ch.melt) * 0.18;
        ch.spinKick *= 0.96;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a + Math.PI / 2 + ch.spinKick * 0.6);
        if (ch.melt > 0.55) {
          ctx.fillStyle = `rgba(79,70,229,${0.35 + ch.melt * 0.5})`;
          ctx.beginPath();
          ctx.arc(0, 0, 2.2 + ch.melt * 1.6, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.globalAlpha = 1 - ch.melt * 0.7;
          ctx.fillStyle = "#0b1020";
          ctx.font = "600 12px JetBrains Mono, ui-monospace, monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(ch.ch, 0, 0);
          if (ch.melt > 0.2) {
            ctx.globalAlpha = ch.melt;
            ctx.fillStyle = "#4f46e5";
            ctx.beginPath();
            ctx.arc(0, 6, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(cx, cy, ring.radius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(79,70,229,0.08)";
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // ripples
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i];
      rp.r += rp.force * 6;
      rp.life -= 0.016;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(79,70,229,${Math.max(0, rp.life) * 0.55})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      if (rp.r > rp.max || rp.life <= 0) ripples.splice(i, 1);
    }

    // core mark
    ctx.fillStyle = "#4f46e5";
    ctx.beginPath();
    ctx.arc(cx, cy, 6 + charge * 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "800 9px Sora, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("FMC", cx, cy);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
