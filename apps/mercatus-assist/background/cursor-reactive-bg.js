/**
 * Mercatus Blueprint — cursor-reactive background driver
 * Smoothly updates --mx / --my. Reduced-motion safe.
 */
(function () {
  const root = document.documentElement;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let targetX = 0.5;
  let targetY = 0.5;
  let curX = 0.5;
  let curY = 0.5;
  let raf = 0;

  function setVars() {
    root.style.setProperty("--mx", (curX * 100).toFixed(2) + "%");
    root.style.setProperty("--my", (curY * 100).toFixed(2) + "%");
  }

  function tick() {
    // light lerp — premium, not twitchy
    curX += (targetX - curX) * 0.08;
    curY += (targetY - curY) * 0.08;
    setVars();
    raf = requestAnimationFrame(tick);
  }

  function onMove(e) {
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    targetX = e.clientX / w;
    targetY = e.clientY / h;
    if (reduce) {
      curX = targetX;
      curY = targetY;
      setVars();
    }
  }

  function onLeave() {
    targetX = 0.5;
    targetY = 0.5;
  }

  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerleave", onLeave, { passive: true });

  if (!reduce) raf = requestAnimationFrame(tick);
  else setVars();
})();
