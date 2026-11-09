/**
 * Dot + lagging ring + hover label. Fine pointer only; touch-safe.
 */
(function () {
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!fine) return;

  var dot = document.createElement("div");
  var ring = document.createElement("div");
  var label = document.createElement("div");
  dot.className = "mm-cur-dot";
  ring.className = "mm-cur-ring";
  label.className = "mm-cur-label";
  dot.setAttribute("aria-hidden", "true");
  ring.setAttribute("aria-hidden", "true");
  label.setAttribute("aria-hidden", "true");
  document.body.appendChild(dot);
  document.body.appendChild(ring);
  document.body.appendChild(label);
  document.body.classList.add("has-mm-cur");
  document.documentElement.classList.add("has-mm-cur");

  var x = -100, y = -100, rx = -100, ry = -100;
  var raf = 0, hoverLabel = "";

  function paint() {
    dot.style.transform = "translate3d(" + x + "px," + y + "px,0)";
    if (reduce) {
      rx = x; ry = y;
    } else {
      rx += (x - rx) * 0.18;
      ry += (y - ry) * 0.18;
    }
    ring.style.transform = "translate3d(" + rx + "px," + ry + "px,0)";
    if (hoverLabel) {
      label.textContent = hoverLabel;
      label.classList.add("is-on");
      label.style.transform = "translate3d(" + x + "px," + y + "px,0)";
    } else {
      label.classList.remove("is-on");
    }
    raf = requestAnimationFrame(paint);
  }

  function onMove(e) {
    x = e.clientX; y = e.clientY;
    if (!dot.classList.contains("is-on")) {
      dot.classList.add("is-on");
      ring.classList.add("is-on");
    }
  }

  function labelFor(el) {
    if (!el) return "";
    var t = el.getAttribute("data-cursor") || el.getAttribute("aria-label") || "";
    if (!t && el.tagName === "A") {
      t = (el.textContent || "").trim().slice(0, 28);
      if (/^https?:/.test(el.getAttribute("href") || "")) t = t || "Open";
      if ((el.getAttribute("href") || "").indexOf(".pdf") !== -1) t = "PDF";
    }
    if (!t && (el.tagName === "BUTTON" || el.getAttribute("role") === "button")) {
      t = (el.textContent || "Click").trim().slice(0, 24);
    }
    return t;
  }

  function onOver(e) {
    var t = e.target;
    if (!(t instanceof Element)) return;
    var hit = t.closest("a, button, [role='button'], input, textarea, .gz-card, .gz-btn, .gz-chip, .gz-doc, .gz-pipe, [data-cursor]");
    ring.classList.toggle("is-hover", !!hit);
    hoverLabel = hit ? labelFor(hit) : "";
  }

  window.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("pointerover", onOver, { passive: true });
  window.addEventListener("blur", function () {
    dot.classList.remove("is-on");
    ring.classList.remove("is-on");
    label.classList.remove("is-on");
  });
  document.addEventListener("pointerdown", function () { ring.classList.add("is-press"); });
  document.addEventListener("pointerup", function () { ring.classList.remove("is-press"); });
  raf = requestAnimationFrame(paint);
})();
