/**
 * Cursor-reactive soft glow — lerped --mx/--my via rAF only while moving.
 * Avoids perpetual main-thread animation when idle.
 */
(function () {
  const root = document.documentElement;
  if (root.classList.contains("gm") || root.classList.contains("gm-lite")) return; /* godmode: no decorative glow */
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  let tx = 0.5, ty = 0.5, cx = 0.5, cy = 0.5, raf = 0;

  function setVars() {
    root.style.setProperty("--mx", (cx * 100).toFixed(2) + "%");
    root.style.setProperty("--my", (cy * 100).toFixed(2) + "%");
  }

  function tick() {
    raf = 0;
    const dx = tx - cx, dy = ty - cy;
    cx += dx * 0.12;
    cy += dy * 0.12;
    setVars();
    if (Math.abs(dx) > 0.0008 || Math.abs(dy) > 0.0008) {
      raf = requestAnimationFrame(tick);
    }
  }

  function kick() {
    if (!raf) raf = requestAnimationFrame(tick);
  }

  if (!fine || reduce) {
    setVars();
    return;
  }

  window.addEventListener("pointermove", (e) => {
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    tx = e.clientX / w;
    ty = e.clientY / h;
    kick();
  }, { passive: true });

  window.addEventListener("pointerleave", () => { tx = 0.5; ty = 0.5; kick(); }, { passive: true });
  setVars();
})();
