/**
 * Drop into a React app (or adapt for Vue/Svelte).
 * Mount once on the app shell; keep a fixed .mm-bg behind content.
 */
import { useEffect } from "react";

export function useCursorReactiveBg(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let tx = 0.5, ty = 0.5, cx = 0.5, cy = 0.5, raf = 0;

    const set = () => {
      root.style.setProperty("--mx", `${(cx * 100).toFixed(2)}%`);
      root.style.setProperty("--my", `${(cy * 100).toFixed(2)}%`);
    };
    const tick = () => {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      set();
      raf = requestAnimationFrame(tick);
    };
    const onMove = (e: PointerEvent) => {
      tx = e.clientX / (window.innerWidth || 1);
      ty = e.clientY / (window.innerHeight || 1);
      if (reduce) { cx = tx; cy = ty; set(); }
    };
    const onLeave = () => { tx = 0.5; ty = 0.5; };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave, { passive: true });
    if (!reduce) raf = requestAnimationFrame(tick);
    else set();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, [enabled]);
}
