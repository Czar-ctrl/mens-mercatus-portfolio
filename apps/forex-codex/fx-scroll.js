/* FMC weights scrollbar + magnetic / parallax scroll + cursor field.
   Inspired by physical-weight scroll rails and kinetic feed scrolling. */

(function () {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(pointer: fine)").matches;

  /* ---------------- weight rail (right margin) ---------------- */
  const rail = document.createElement("aside");
  rail.id = "weight-rail";
  rail.setAttribute("aria-label", "Weighted scrollbar");
  rail.innerHTML = `
    <div class="wr-track">
      <div class="wr-scale" id="wr-scale">
        <div class="wr-pan" id="wr-pan"></div>
        <div class="wr-hook"></div>
      </div>
      <div class="wr-thumb" id="wr-thumb"></div>
    </div>
    <div class="wr-bin" id="wr-bin">
      <p class="wr-label">Weights</p>
      <button type="button" class="wr-w" data-mass="1" draggable="true" title="1 unit">●</button>
      <button type="button" class="wr-w" data-mass="2" draggable="true" title="2 units">●●</button>
      <button type="button" class="wr-w" data-mass="3" draggable="true" title="3 units">●●●</button>
      <button type="button" class="wr-clear" id="wr-clear" title="Remove weights">Clear</button>
    </div>
    <p class="wr-hint">Drop weights on the pan to pull the page</p>`;
  document.body.appendChild(rail);

  const pan = rail.querySelector("#wr-pan");
  const thumb = rail.querySelector("#wr-thumb");
  const scale = rail.querySelector("#wr-scale");
  let mass = 0;
  let targetY = 0;
  let currentY = 0;
  let draggingThumb = false;

  function maxScroll() {
    return Math.max(0, document.documentElement.scrollHeight - innerHeight);
  }

  function applyMassScroll() {
    const max = maxScroll();
    if (!max) return;
    // each mass unit unlocks/pulls further down the document
    const pull = Math.min(1, mass / 9);
    targetY = pull * max;
  }

  function syncThumb() {
    const max = maxScroll();
    const p = max > 0 ? scrollY / max : 0;
    const trackH = scale.clientHeight - 28;
    thumb.style.transform = `translate3d(0, ${p * trackH}px, 0)`;
    // pan hangs lower with more weight
    pan.style.transform = `translate3d(-50%, ${8 + mass * 7}px, 0)`;
    pan.dataset.mass = String(mass);
  }

  function addWeight(m) {
    mass = Math.min(9, mass + m);
    pan.classList.add("drop");
    setTimeout(() => pan.classList.remove("drop"), 280);
    const chip = document.createElement("span");
    chip.className = "wr-chip";
    chip.textContent = "●".repeat(Math.min(3, m));
    chip.dataset.mass = String(m);
    pan.appendChild(chip);
    applyMassScroll();
    if (!reduce) {
      const start = scrollY;
      const dest = targetY;
      const t0 = performance.now();
      const dur = 700 + mass * 40;
      function ease(t) { return 1 - Math.pow(1 - t, 3); }
      function step(now) {
        const k = Math.min(1, (now - t0) / dur);
        window.scrollTo(0, start + (dest - start) * ease(k));
        if (k < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    } else {
      window.scrollTo(0, targetY);
    }
    syncThumb();
  }

  rail.querySelectorAll(".wr-w").forEach((btn) => {
    btn.addEventListener("click", () => addWeight(+btn.dataset.mass));
    btn.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/mass", btn.dataset.mass);
      e.dataTransfer.effectAllowed = "copy";
    });
  });
  pan.addEventListener("dragover", (e) => { e.preventDefault(); pan.classList.add("hot"); });
  pan.addEventListener("dragleave", () => pan.classList.remove("hot"));
  pan.addEventListener("drop", (e) => {
    e.preventDefault();
    pan.classList.remove("hot");
    const m = +(e.dataTransfer.getData("text/mass") || 1);
    addWeight(m);
  });
  rail.querySelector("#wr-clear").addEventListener("click", () => {
    mass = 0;
    pan.innerHTML = "";
    applyMassScroll();
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    syncThumb();
  });

  thumb.addEventListener("pointerdown", (e) => {
    draggingThumb = true;
    thumb.setPointerCapture(e.pointerId);
  });
  thumb.addEventListener("pointermove", (e) => {
    if (!draggingThumb) return;
    const rect = scale.getBoundingClientRect();
    const trackH = rect.height - 28;
    const y = Math.min(trackH, Math.max(0, e.clientY - rect.top - 14));
    const p = trackH > 0 ? y / trackH : 0;
    // without enough mass, thumb resists — physical weights metaphor
    const unlocked = Math.min(1, mass / 6);
    const limited = p * (0.15 + unlocked * 0.85);
    window.scrollTo(0, limited * maxScroll());
  });
  thumb.addEventListener("pointerup", () => { draggingThumb = false; });

  addEventListener("scroll", () => { syncThumb(); }, { passive: true });
  addEventListener("resize", syncThumb);
  syncThumb();

  /* ---------------- optional magnetic snap (Alt/Option + wheel) — free scroll by default so Chart/Tour feel native */
  if (!reduce) {
    const sections = [...document.querySelectorAll("main > section.panel, main > article.panel, #capabilities")];
    let cool = 0;
    addEventListener("wheel", (e) => {
      if (!e.altKey) return;
      if (document.body.classList.contains("intro-lock")) return;
      if (e.target.closest?.(".highcharts-container, textarea, input, .pdf-frame, .blotter, .cal-list, .cap-pin")) return;
      const now = performance.now();
      if (now < cool) return;
      const dir = e.deltaY > 0 ? 1 : -1;
      const y = scrollY + innerHeight * 0.35;
      let idx = sections.findIndex((s) => s.offsetTop + s.offsetHeight * 0.35 > y);
      if (idx < 0) idx = sections.length - 1;
      const next = sections[Math.min(sections.length - 1, Math.max(0, idx + dir))];
      if (!next) return;
      e.preventDefault();
      cool = now + 480;
      next.classList.add("feed-snap");
      window.scrollTo({ top: next.getBoundingClientRect().top + scrollY - 80, behavior: "smooth" });
      setTimeout(() => next.classList.remove("feed-snap"), 700);
    }, { passive: false });
  }

  /* ---------------- left section progress dock ---------------- */
  const dock = document.createElement("nav");
  dock.id = "section-dock";
  dock.setAttribute("aria-label", "Section progress");
  const dockIds = ["capabilities","chart","whales","quant","flow","agi","study","journal","guide"];
  dock.innerHTML = dockIds.map((id) => {
    const el = document.getElementById(id);
    if (!el) return "";
    const label = el.querySelector("h2")?.textContent?.trim().slice(0, 28) || id;
    return `<a href="#${id}" data-id="${id}" title="${label.replace(/"/g, "")}"><i></i><span>${label}</span></a>`;
  }).join("");
  document.body.appendChild(dock);
  const dockLinks = [...dock.querySelectorAll("a")];
  const dockObs = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      dockLinks.forEach((a) => a.classList.toggle("is-on", a.dataset.id === en.target.id));
    });
  }, { rootMargin: "-40% 0px -45% 0px", threshold: 0.01 });
  dockIds.forEach((id) => { const el = document.getElementById(id); if (el) dockObs.observe(el); });


  /* ---------------- parallax / stack scroll transforms ---------------- */
  if (!reduce) {
    const cards = () => document.querySelectorAll(".panel, .q-card, .hero, .study-card, .tool-grade");
    let ticking = false;
    function paintScrollFX() {
      const vh = innerHeight;
      cards().forEach((el) => {
        const r = el.getBoundingClientRect();
        const mid = r.top + r.height * 0.5;
        const t = (mid - vh * 0.5) / vh;
        const abs = Math.min(1, Math.abs(t));
        el.style.setProperty("--fx-tilt", `${(t * -3).toFixed(2)}deg`);
        el.style.setProperty("--fx-shift", `${(t * 12).toFixed(1)}px`);
        el.style.setProperty("--fx-scale", `${(1 - abs * 0.04).toFixed(3)}`);
        el.style.setProperty("--fx-fade", `${(1 - abs * 0.35).toFixed(3)}`);
      });
      ticking = false;
    }
    addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(paintScrollFX);
    }, { passive: true });
    requestAnimationFrame(paintScrollFX);
    document.body.classList.add("scroll-fx");
  }

  /* ---------------- cursor-reactive ambient field ---------------- */
  if (fine && !reduce) {
    const field = document.createElement("canvas");
    field.id = "cursor-field";
    field.setAttribute("aria-hidden", "true");
    document.body.prepend(field);
    const ctx = field.getContext("2d");
    let W = 0, H = 0, dpr = 1;
    let mx = innerWidth / 2, my = innerHeight / 2, px = mx, py = my;
    const dots = Array.from({ length: 48 }, () => ({
      x: Math.random(), y: Math.random(),
      vx: 0, vy: 0,
      r: 0.8 + Math.random() * 1.8,
    }));
    function resize() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = innerWidth; H = innerHeight;
      field.width = W * dpr; field.height = H * dpr;
      field.style.width = `${W}px`; field.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    addEventListener("resize", resize);
    addEventListener("pointermove", (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });

    function loop() {
      px += (mx - px) * 0.08;
      py += (my - py) * 0.08;
      ctx.clearRect(0, 0, W, H);
      // reactive wash
      const grd = ctx.createRadialGradient(px, py, 0, px, py, 220);
      grd.addColorStop(0, "rgba(79,70,229,0.10)");
      grd.addColorStop(0.5, "rgba(139,92,246,0.04)");
      grd.addColorStop(1, "rgba(245,246,251,0)");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);

      dots.forEach((d) => {
        const x = d.x * W, y = d.y * H;
        const dx = px - x, dy = py - y;
        const dist = Math.hypot(dx, dy) + 1;
        const force = Math.min(2.5, 140 / dist);
        d.vx += (dx / dist) * force * 0.02;
        d.vy += (dy / dist) * force * 0.02;
        d.vx *= 0.9; d.vy *= 0.9;
        d.x = (d.x * W + d.vx) / W;
        d.y = (d.y * H + d.vy) / H;
        if (d.x < 0 || d.x > 1) d.vx *= -1;
        if (d.y < 0 || d.y > 1) d.vy *= -1;
        d.x = Math.min(1, Math.max(0, d.x));
        d.y = Math.min(1, Math.max(0, d.y));
        ctx.beginPath();
        ctx.arc(d.x * W, d.y * H, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(79,70,229,${0.15 + force * 0.08})`;
        ctx.fill();
      });
      // trailing ring around cursor
      ctx.beginPath();
      ctx.arc(px, py, 18 + Math.hypot(mx - px, my - py) * 0.08, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(79,70,229,0.25)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }
})();
