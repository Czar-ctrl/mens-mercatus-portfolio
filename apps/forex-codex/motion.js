/* LUXGEX motion — animated scroll reveals, sliding tab pill, smooth section opens. */

(function () {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const nav = document.querySelector(".tabs");
  if (!nav) return;

  // Sliding pill under the active tab
  let pill = nav.querySelector(".tab-pill");
  if (!pill) {
    pill = document.createElement("span");
    pill.className = "tab-pill";
    pill.setAttribute("aria-hidden", "true");
    nav.prepend(pill);
  }

  function movePill(el, flash) {
    if (!el) return;
    const nr = nav.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    pill.style.width = `${r.width}px`;
    pill.style.height = `${r.height}px`;
    pill.style.transform = `translate3d(${r.left - nr.left}px, ${r.top - nr.top}px, 0)`;
    pill.classList.add("on");
    if (flash) {
      pill.classList.add("flash");
      clearTimeout(movePill._t);
      movePill._t = setTimeout(() => pill.classList.remove("flash"), 420);
    }
  }

  // Hover preview — pill follows without changing is-on until click
  nav.querySelectorAll("a").forEach((a) => {
    a.addEventListener("mouseenter", () => movePill(a, false));
    a.addEventListener("focus", () => movePill(a, false));
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const id = a.getAttribute("href")?.slice(1);
      const target = id && document.getElementById(id);
      nav.querySelectorAll("a").forEach((x) => x.classList.toggle("is-on", x === a));
      movePill(a, true);
      a.classList.add("tap");
      setTimeout(() => a.classList.remove("tap"), 280);
      if (target) {
        target.classList.add("section-open");
        const top = target.getBoundingClientRect().top + window.scrollY - 88;
        window.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
        setTimeout(() => target.classList.remove("section-open"), 900);
      }
    });
  });
  nav.addEventListener("mouseleave", () => {
    const on = nav.querySelector("a.is-on");
    movePill(on, false);
  });

  // Scroll-spy with pill sync
  const links = [...nav.querySelectorAll("a")];
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const link = links.find((l) => l.getAttribute("href") === `#${en.target.id}`);
      if (!link) return;
      links.forEach((l) => l.classList.toggle("is-on", l === link));
      if (!nav.matches(":hover")) movePill(link, false);
    });
  }, { rootMargin: "-42% 0px -48% 0px", threshold: 0.01 });
  document.querySelectorAll("section[id], article[id]").forEach((s) => spy.observe(s));
  requestAnimationFrame(() => movePill(nav.querySelector("a.is-on"), false));
  addEventListener("resize", () => movePill(nav.querySelector("a.is-on"), false));

  // Reveal-on-scroll for panels / cards
  if (!reduce) {
    document.querySelectorAll(".panel, .hero, .q-card, .tool-card, .stat-block, .kpi, .sig").forEach((el, i) => {
      el.classList.add("reveal");
      el.style.setProperty("--reveal-delay", `${Math.min(i % 8, 6) * 45}ms`);
    });
    const rev = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add("in");
          rev.unobserve(en.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    document.querySelectorAll(".reveal").forEach((el) => rev.observe(el));
  }

  // Parallax aurora + progress bar
  const aurora = document.querySelector(".aurora");
  let bar = document.getElementById("scroll-progress");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "scroll-progress";
    bar.setAttribute("aria-hidden", "true");
    document.body.prepend(bar);
  }
  let ticking = false;
  addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const max = document.documentElement.scrollHeight - innerHeight;
      const p = max > 0 ? scrollY / max : 0;
      bar.style.transform = `scaleX(${p})`;
      if (aurora && !reduce) aurora.style.transform = `translate3d(0, ${scrollY * 0.04}px, 0)`;
      ticking = false;
    });
  }, { passive: true });

  // Stagger topbar entrance
  document.body.classList.add("motion-ready");
})();
