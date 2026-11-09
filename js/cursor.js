/**
 * Custom cursor — Blueprint red ring + red center.
 * Fine pointer only; touch/coarse falls back to system cursor.
 * Uses element transform (not :root CSS vars) to avoid document-wide style invalidation.
 * Pointer samples throttled; paint coalesced to one rAF.
 */
(function () {
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (!fine) return;

  const el = document.createElement("div");
  el.className = "mm-cursor";
  el.setAttribute("aria-hidden", "true");
  document.body.appendChild(el);
  document.body.classList.add("has-custom-cursor");
  document.documentElement.classList.add("has-custom-cursor");

  let x = -100, y = -100, raf = 0, dirty = false;
  let lastSample = 0;
  const SAMPLE_MS = 32; // ~30Hz input; paint still rAF-coalesced

  function paint() {
    // Direct compositing-layer move — do not write --cursor-* on :root
    el.style.transform = "translate3d(" + x + "px," + y + "px,0)";
    dirty = false;
    raf = 0;
  }

  function onMove(e) {
    const now = performance.now();
    if (now - lastSample < SAMPLE_MS && dirty) {
      // still update coords so next paint is fresh, but skip class/raf churn
      x = e.clientX;
      y = e.clientY;
      return;
    }
    lastSample = now;
    x = e.clientX;
    y = e.clientY;
    if (!el.classList.contains("is-on")) el.classList.add("is-on");
    if (!dirty) {
      dirty = true;
      raf = requestAnimationFrame(paint);
    }
  }

  function onOver(e) {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const hit = t.closest("a, button, [role='button'], input, textarea, select, .card, .hud-link");
    el.classList.toggle("is-hover", !!hit);
  }

  window.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("pointerover", onOver, { passive: true });
  window.addEventListener("blur", () => el.classList.remove("is-on"));
})();
