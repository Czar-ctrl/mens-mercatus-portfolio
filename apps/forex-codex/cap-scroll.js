/* FMC capability rail — sticky scrubbed horizontal tour (Alphenex-inspired, desk-native). */

(function () {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pin = document.getElementById("capabilities");
  const track = document.getElementById("cap-track");
  const fill = document.getElementById("cap-bar-fill");
  const idxEl = document.getElementById("cap-idx");
  const totalEl = document.getElementById("cap-total");
  const dotsHost = document.getElementById("cap-dots");
  if (!pin || !track) return;

  const cards = [...track.querySelectorAll(".cap-card")];
  const N = cards.length;
  if (totalEl) totalEl.textContent = String(N).padStart(2, "0");

  // Build dots
  if (dotsHost) {
    dotsHost.innerHTML = cards.map((_, i) =>
      `<button type="button" class="cap-dot" role="tab" aria-label="Capability ${i + 1}" data-i="${i}"></button>`
    ).join("");
  }

  function setPinHeight() {
    // Extra scroll runway so each card gets ~85vh of scrub
    const run = Math.max(N * 0.85, 3.2);
    pin.style.height = `${run * 100}vh`;
  }
  setPinHeight();
  addEventListener("resize", setPinHeight);

  let active = 0;
  let raf = 0;

  function maxX() {
    return Math.max(0, track.scrollWidth - track.parentElement.clientWidth);
  }

  function progress() {
    const rect = pin.getBoundingClientRect();
    const total = pin.offsetHeight - innerHeight;
    if (total <= 0) return 0;
    // when sticky engages, rect.top ~= 0 (under topbar ~64-72)
    const scrolled = Math.min(total, Math.max(0, -rect.top));
    return scrolled / total;
  }

  function paint() {
    raf = 0;
    const p = progress();
    const x = -maxX() * p;
    track.style.transform = `translate3d(${x}px, 0, 0)`;
    if (fill) fill.style.transform = `scaleX(${p})`;

    const i = Math.min(N - 1, Math.max(0, Math.round(p * (N - 1))));
    if (i !== active) {
      active = i;
      cards.forEach((c, k) => c.classList.toggle("is-on", k === i));
      dotsHost?.querySelectorAll(".cap-dot").forEach((d, k) => d.classList.toggle("is-on", k === i));
      if (idxEl) idxEl.textContent = String(i + 1).padStart(2, "0");
    } else {
      cards.forEach((c, k) => {
        const dist = Math.abs(k - p * (N - 1));
        c.style.setProperty("--cap-depth", Math.min(1, dist).toFixed(3));
      });
    }

    // depth for neighbours
    cards.forEach((c, k) => {
      const dist = Math.abs(k - p * (N - 1));
      c.style.setProperty("--cap-depth", Math.min(1, dist).toFixed(3));
      c.classList.toggle("is-on", k === active);
    });
  }

  function onScroll() {
    if (raf) return;
    raf = requestAnimationFrame(paint);
  }

  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  requestAnimationFrame(paint);

  function jumpTo(i) {
    const total = pin.offsetHeight - innerHeight;
    const y = pin.offsetTop + (i / Math.max(1, N - 1)) * total;
    window.scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
  }

  dotsHost?.addEventListener("click", (e) => {
    const btn = e.target.closest(".cap-dot");
    if (!btn) return;
    jumpTo(+btn.dataset.i);
  });

  pin.addEventListener("click", (e) => {
    const jump = e.target.closest("[data-goto]");
    if (!jump) return;
    const id = jump.getAttribute("data-goto")?.slice(1);
    const target = id && document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    target.classList.add("section-open");
    setTimeout(() => target.classList.remove("section-open"), 900);
  });

  // Keyboard when focused in section
  pin.tabIndex = 0;
  pin.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); jumpTo(Math.min(N - 1, active + 1)); }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); jumpTo(Math.max(0, active - 1)); }
  });
})();
