(function () {
  const root = document.getElementById("pipeline-root");
  const meta = document.getElementById("hub-meta");
  const disc = document.getElementById("hub-disclaimer");
  if (!root) return;

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, "&#39;");
  }

  function cardHTML(item) {
    const href = item.href || "#";
    const ext = /^https?:\/\//i.test(href);
    const blank = ext ? '" target="_blank" rel="noopener"' : '"';
    return (
      '<a class="pipe-card pipe-card-link" data-pipe href="' +
      escapeAttr(href) +
      blank +
      ">" +
      '<p class="lane">' +
      escapeHtml(item.kicker || "Tease") +
      "</p>" +
      "<h3>" +
      escapeHtml(item.app || "App") +
      "</h3>" +
      '<p class="hook">' +
      escapeHtml(item.hook || "") +
      "</p>" +
      '<p class="tool">' +
      escapeHtml(item.inner || item.tool || "") +
      "</p>" +
      '<p class="snap">' +
      escapeHtml(item.line || "") +
      "</p>" +
      '<span class="more">Open app <span aria-hidden="true">→</span></span>' +
      "</a>"
    );
  }

  function observe() {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("is-in");
        });
      },
      { threshold: 0.22, rootMargin: "0px 0px -8% 0px" }
    );
    root.querySelectorAll("[data-pipe]").forEach((el) => io.observe(el));
  }

  function render(data) {
    if (meta) {
      meta.innerHTML =
        "<span>As of <strong>" +
        escapeHtml(data.as_of || "—") +
        "</strong></span><span><strong>" +
        (data.teasers || []).length +
        "</strong> flagship teasers</span><span>Return with browser <strong>Back</strong></span>";
    }
    if (disc && data.disclaimer) disc.textContent = data.disclaimer;

    const teasers = data.teasers || [];
    let html = '<p class="hub-section-label">Flagship systems — click a card · browser Back to return</p>';
    html += '<div class="pipeline-rail">';
    teasers.forEach((t) => {
      html += cardHTML(t);
    });
    html += "</div>";
    root.innerHTML = html;
    observe();
  }

  const fallback = {
    as_of: new Date().toISOString().slice(0, 10),
    disclaimer:
      "Paper / local research only. Not live brokerage. Not investment advice.",
    teasers: [
      {
        app: "Mercatus SoundX",
        kicker: "Sound Deck · local Web Audio",
        hook: "Generate · stems · continue · Demo + Play · Mic.",
        inner: "AI Producer · Generate · mic · transport Demo",
        line: "Opens /apps/soundx-ai/ — SoundX AI studio.",
        href: "apps/soundx-ai/",
      },
      {
        app: "JobNet",
        kicker: "Career pipeline · draft-only",
        hook: "Noon · 3 AM · inbox · 24h nudge.",
        inner: "18 Gmail drafts + reminder · demo",
        line: "Opens /apps/jobnet/ — live read-only demo; human Send only.",
        href: "apps/jobnet/",
      },
      {
        app: "Mercatus Blueprint",
        kicker: "Event mode pack",
        hook: "Twelve Event screens + schematics.",
        inner: "Signup · rate lock · payout · diagrams",
        line: "Opens /blueprint/ — static pack.",
        href: "blueprint/",
      },
      {
        app: "Forex Mercatus Codex",
        kicker: "Live paper research desk",
        hook: "Chart · Multi · Whales on one paper desk.",
        inner: "Chart · Multi · Whales · live paper desk",
        line: "Opens /apps/forex-codex/ — live paper desk, no broker.",
        href: "/apps/forex-codex/",
      },
    ],
  };

  fetch("data/daily-pipeline.json", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then(render)
    .catch(() => render(fallback));
})();
