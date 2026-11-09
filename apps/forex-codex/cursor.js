/* LUXGEX cursor — lagging ring + crisp dot. Always above intro overlays. */

(function () {
  const fine = matchMedia("(pointer: fine)").matches;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const el = document.getElementById("lx-cursor");

  // If no custom cursor, keep the system cursor visible.
  if (!fine || !el || reduce) {
    document.body.classList.remove("has-cursor");
    if (el) el.style.display = "none";
    return;
  }

  document.body.classList.add("has-cursor");
  const ring = el.querySelector(".ring");
  const dot = el.querySelector(".dot");
  const label = el.querySelector(".label");
  let tx = innerWidth / 2, ty = innerHeight / 2, rx = tx, ry = ty, dx = tx, dy = ty;
  let visible = true, magnet = null, raf = 0, mode = "";

  const LABELS = {
    "#live-toggle": "toggle live", "#run-all": "compute", "#regen": "new tape",
    "#auth-open": "account", ".highcharts-menu-item-btn": "draw", ".tk": "load",
    ".pane-pop": "expand", "#rp-toggle": "replay", ".q-load": "backtest",
    ".ly": "layout", "#ring-enter": "enter desk", "#ring-skip": "skip",
    ".wr-w": "add weight", "#wr-clear": "clear weights",
  };

  function setMode(m) {
    if (m === mode) return;
    mode = m;
    el.classList.remove("hover", "press", "text", "cross", "draw", "is-hidden");
    if (m) el.classList.add(m);
    if (!visible) el.classList.add("is-hidden");
  }

  function show() {
    visible = true;
    el.classList.remove("is-hidden");
    el.style.opacity = "1";
  }

  function hide() {
    visible = false;
    el.classList.add("is-hidden");
  }

  show();
  // Park ring/dot at centre until first move
  ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%)`;
  dot.style.transform = `translate3d(${dx}px, ${dy}px, 0) translate(-50%, -50%)`;

  addEventListener("pointermove", (e) => {
    tx = e.clientX; ty = e.clientY;
    show();
    const t = e.target;
    const over = t.closest?.("button, a, select, summary, .tk, .q-card, .tool-card, .sig, .gex-row, label.switch, input[type=range], .pane-head, .wr-w, .wr-thumb, .wr-pan");
    const chart = t.closest?.(".highcharts-container");
    const text = t.closest?.("input, textarea, [contenteditable]");
    if (text) setMode("text");
    else if (chart) {
      setMode(chart.closest(".highcharts-draw-mode") || document.querySelector(".highcharts-stocktools-wrapper .highcharts-active") ? "draw" : "cross");
    } else if (over) setMode("hover");
    else setMode("");

    magnet = over && !over.matches("input[type=range], .pane-head, .q-card, .tool-card") ? over : null;
    let txt = "";
    for (const [sel, name] of Object.entries(LABELS)) if (t.closest?.(sel)) { txt = name; break; }
    if (!txt && over?.dataset?.cursor) txt = over.dataset.cursor;
    if (!txt && mode === "draw") txt = "click to place";
    label.textContent = txt;
    label.classList.toggle("show", !!txt);
  }, { passive: true });

  addEventListener("pointerdown", () => el.classList.add("press"));
  addEventListener("pointerup", () => el.classList.remove("press"));
  document.documentElement.addEventListener("mouseleave", hide);
  document.documentElement.addEventListener("mouseenter", show);

  function frame() {
    let gx = tx, gy = ty;
    if (magnet) {
      const r = magnet.getBoundingClientRect();
      gx = tx + (r.left + r.width / 2 - tx) * 0.22;
      gy = ty + (r.top + r.height / 2 - ty) * 0.22;
    }
    rx += (gx - rx) * 0.22; ry += (gy - ry) * 0.22;
    dx += (tx - dx) * 0.55; dy += (ty - dy) * 0.55;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%)`;
    dot.style.transform = `translate3d(${dx}px, ${dy}px, 0) translate(-50%, -50%)`;
    label.style.transform = `translate3d(${dx + 18}px, ${dy + 16}px, 0)`;
    raf = requestAnimationFrame(frame);
  }
  frame();

  window.LXCursor = {
    get x() { return dx; },
    get y() { return dy; },
    get rawX() { return tx; },
    get rawY() { return ty; },
    show, hide,
  };

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else { show(); frame(); }
  });
})();
