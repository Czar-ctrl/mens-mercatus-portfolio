/**
 * Hero silk shim — page-wide mm-silk.js owns the canvas.
 * Keeps a local veil/spotlight hook on .hero--silk for text contrast.
 */
(function () {
  "use strict";
  var hero = document.querySelector(".hero--forbidden, .hero--silk");
  if (!hero) return;
  var wrap = hero.querySelector(".hero-silk");
  if (!wrap) return;
  // Prefer page-wide layer; hide local canvas
  var c = wrap.querySelector("canvas");
  if (c) c.style.display = "none";
  wrap.classList.add("hero-silk--veil-only");
  // Sync spotlight CSS vars from page silk
  function sync() {
    var x = getComputedStyle(document.documentElement).getPropertyValue("--mm-silk-x") || "68%";
    var y = getComputedStyle(document.documentElement).getPropertyValue("--mm-silk-y") || "46%";
    var spot = wrap.querySelector(".hero-silk-spotlight");
    if (spot) {
      spot.style.setProperty("--sx", x.trim());
      spot.style.setProperty("--sy", y.trim());
    }
  }
  sync();
  setInterval(sync, 80);
})();
