/* FMC chart FX — cursor-reactive spotlight + automated pulse on last price / levels.
   Overlay is pointer-events:none so Highcharts stays fully interactive. */

(function () {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;

  let host = null;
  let canvas = null;
  let ctx = null;
  let wrap = null;
  let raf = 0;
  let mx = 0.5, my = 0.45, tx = 0.5, ty = 0.45;
  let inside = false;
  let W = 0, H = 0, dpr = 1;
  let pulse = 0;
  let autoT = 0;
  let levels = []; // {yNorm, color, label}
  let lastCloseNorm = 0.5;
  let boundChart = null;

  function ensureLayer() {
    wrap = document.querySelector(".chart-wrap") || document.getElementById("chart-hc")?.parentElement;
    host = document.getElementById("chart-hc");
    if (!wrap || !host) return false;
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "chart-fx";
      canvas.setAttribute("aria-hidden", "true");
      wrap.classList.add("has-chart-fx");
      wrap.appendChild(canvas);
      ctx = canvas.getContext("2d");
    }
    return true;
  }

  function resize() {
    if (!ensureLayer()) return;
    dpr = Math.min(devicePixelRatio || 1, 2);
    const r = host.getBoundingClientRect();
    W = Math.max(1, r.width);
    H = Math.max(1, r.height);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function readLevels(chart) {
    levels = [];
    if (!chart) return;
    try {
      const yAxis = chart.yAxis?.[0];
      if (!yAxis) return;
      const toNorm = (price) => {
        const pix = yAxis.toPixels(price, true);
        if (!Number.isFinite(pix)) return null;
        return pix / H;
      };
      // annotation labels / shapes with price
      (chart.annotations || []).forEach((an) => {
        const opt = an.options || an.userOptions || {};
        const id = String(opt.id || "");
        let price = null;
        const lab = opt.labels?.[0];
        if (lab?.point?.y != null) price = lab.point.y;
        else if (opt.shapes?.[0]?.points?.[0]?.y != null) price = opt.shapes[0].points[0].y;
        if (price == null) return;
        const n = toNorm(price);
        if (n == null || n < 0 || n > 1) return;
        let color = "rgba(79,70,229,0.55)";
        if (id.includes("whale") || id.includes("big")) color = "rgba(124,58,237,0.65)";
        else if (id.includes("call") || id.includes("flip")) color = "rgba(79,70,229,0.55)";
        else if (id.includes("put")) color = "rgba(225,29,72,0.5)";
        else if (id.includes("ob") || id.includes("fvg")) color = "rgba(5,150,105,0.35)";
        levels.push({ yNorm: n, color, id });
      });
      const priceSeries = chart.get("price");
      const d = priceSeries?.points;
      if (d?.length) {
        const last = d[d.length - 1];
        const close = last.close ?? last.y ?? last?.options?.close;
        if (close != null) {
          const n = toNorm(close);
          if (n != null) lastCloseNorm = n;
        }
      }
    } catch (_) { /* chart mid-rebuild */ }
  }

  function onPointer(e) {
    if (!host) return;
    const r = host.getBoundingClientRect();
    inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) return;
    tx = (e.clientX - r.left) / r.width;
    ty = (e.clientY - r.top) / r.height;
    wrap?.style.setProperty("--cx", `${(tx * 100).toFixed(2)}%`);
    wrap?.style.setProperty("--cy", `${(ty * 100).toFixed(2)}%`);
    wrap?.classList.toggle("chart-hot", inside);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!ctx || !W) return;
    autoT = now * 0.001;
    pulse = 0.5 + 0.5 * Math.sin(now * 0.004);

    // ease cursor
    mx += (tx - mx) * 0.12;
    my += (ty - my) * 0.12;

    // sync LXCursor if present and over chart
    if (window.LXCursor && inside) {
      // already have pointer; optional blend
    }

    ctx.clearRect(0, 0, W, H);

    // ambient sweep (automation) — soft indigo wash drifting when idle
    const sweepX = (0.5 + 0.45 * Math.sin(autoT * 0.35)) * W;
    const g0 = ctx.createRadialGradient(sweepX, H * 0.35, 0, sweepX, H * 0.35, W * 0.45);
    g0.addColorStop(0, "rgba(79,70,229,0.05)");
    g0.addColorStop(1, "rgba(79,70,229,0)");
    ctx.fillStyle = g0;
    ctx.fillRect(0, 0, W, H);

    // cursor spotlight
    if (inside || Math.hypot(tx - mx, ty - my) > 0.002) {
      const cx = mx * W, cy = my * H;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(W, H) * 0.28);
      g.addColorStop(0, "rgba(79,70,229,0.14)");
      g.addColorStop(0.45, "rgba(139,92,246,0.06)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // crosshair ticks
      ctx.strokeStyle = "rgba(79,70,229,0.22)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.moveTo(cx, 0); ctx.lineTo(cx, H);
      ctx.moveTo(0, cy); ctx.lineTo(W, cy);
      ctx.stroke();
      ctx.setLineDash([]);

      // ripple rings around cursor
      for (let i = 0; i < 3; i++) {
        const phase = (autoT * 1.2 + i * 0.45) % 1;
        ctx.beginPath();
        ctx.arc(cx, cy, 12 + phase * 70, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(79,70,229,${(1 - phase) * 0.28})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // automated last-price pulse band
    const ly = lastCloseNorm * H;
    ctx.beginPath();
    ctx.moveTo(0, ly);
    ctx.lineTo(W, ly);
    ctx.strokeStyle = `rgba(79,70,229,${0.18 + pulse * 0.22})`;
    ctx.lineWidth = 1 + pulse;
    ctx.stroke();
    const pg = ctx.createRadialGradient(W * 0.92, ly, 0, W * 0.92, ly, 40 + pulse * 20);
    pg.addColorStop(0, `rgba(79,70,229,${0.35 + pulse * 0.25})`);
    pg.addColorStop(1, "rgba(79,70,229,0)");
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(W * 0.92, ly, 28 + pulse * 10, 0, Math.PI * 2);
    ctx.fill();

    // level magnets react when cursor Y is near
    levels.forEach((lv) => {
      const y = lv.yNorm * H;
      const near = inside ? Math.max(0, 1 - Math.abs(my * H - y) / 48) : 0.25;
      const amp = 0.2 + near * 0.55 + pulse * 0.15 * near;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.strokeStyle = lv.color.replace(/[\d.]+\)$/, `${amp})`).replace("rgb(", "rgba(").replace("rgba(rgba(", "rgba(");
      // fallback if color already rgba
      ctx.strokeStyle = lv.color.includes("rgba")
        ? lv.color.replace(/,\s*[\d.]+\)$/, `, ${amp})`)
        : lv.color;
      ctx.globalAlpha = amp;
      ctx.lineWidth = 1 + near * 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (near > 0.4) {
        ctx.beginPath();
        ctx.arc(mx * W, y, 6 + near * 8, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(79,70,229,${near * 0.5})`;
        ctx.stroke();
      }
    });
  }

  function bind(chart) {
    boundChart = chart || window.LXChart?.chart;
    if (!ensureLayer()) return;
    resize();
    readLevels(boundChart);
    if (!raf) raf = requestAnimationFrame(frame);

    if (boundChart && !boundChart._lxFxHook) {
      boundChart._lxFxHook = true;
      const container = boundChart.container;
      container.addEventListener("pointermove", onPointer, { passive: true });
      container.addEventListener("pointerenter", () => { inside = true; wrap?.classList.add("chart-hot"); }, { passive: true });
      container.addEventListener("pointerleave", () => {
        inside = false;
        wrap?.classList.remove("chart-hot");
      }, { passive: true });
      // refresh levels after redraw
      Highcharts.addEvent(boundChart, "redraw", () => readLevels(boundChart));
      Highcharts.addEvent(boundChart, "render", () => readLevels(boundChart));
    }
  }

  addEventListener("resize", () => { resize(); readLevels(boundChart); });
  addEventListener("pointermove", (e) => {
    if (!host) return;
    onPointer(e);
  }, { passive: true });

  // Auto-bind when chart builds
  const prev = window.LXChart;
  function hookBuilt() {
    const c = window.LXChart?.chart;
    if (c) bind(c);
  }
  // Poll lightly until first chart exists, then rely on redraw hooks
  const boot = setInterval(() => {
    if (window.LXChart?.chart) {
      clearInterval(boot);
      bind(window.LXChart.chart);
    }
  }, 400);
  setTimeout(() => clearInterval(boot), 20000);

  window.LXChartFx = { bind, resize, readLevels };
  // Patch build completion from outside
  document.addEventListener("lx-chart-built", (e) => bind(e.detail || window.LXChart?.chart));
})();
