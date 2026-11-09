/**
 * Smart project recommender — keyword match over flagship systems.
 * Optional THINK boost when online; falls back to local scoring.
 */
(function () {
  var PROJECTS = [
    {
      id: "jobnet",
      title: "JobNet · Career Pipeline",
      blurb: "Draft-only scrape → rank → tailor → human approval. Never auto-applies.",
      href: "/apps/jobnet/",
      tags: ["jobs", "career", "agents", "automation", "gmail", "pipeline", "hiring", "draft"]
    },
    {
      id: "assist",
      title: "Mercatus Assist + THINK",
      blurb: "Live Gemini multimodal desk — chat, image, voice — with labelled DEMO fallback.",
      href: "/think/",
      tags: ["ai", "llm", "gemini", "chat", "assist", "multimodal", "rag", "agents"]
    },
    {
      id: "forex",
      title: "Forex Mercatus Codex",
      blurb: "Session-scoped paper research desk: charts, multi-market, bounded paper bot.",
      href: "/apps/forex-codex/",
      tags: ["forex", "trading", "quant", "charts", "python", "research", "markets", "paper"]
    },
    {
      id: "soundx",
      title: "SoundX Browser DAW",
      blurb: "Client-side Web Audio studio: load demo, shape, master, generate.",
      href: "/apps/soundx-ai/",
      tags: ["audio", "music", "dsp", "web audio", "daw", "browser", "producer"]
    },
    {
      id: "concierge",
      title: "Mercatus Concierge",
      blurb: "Builder shell — venture coach, design picks, Plan/Build, studio kits.",
      href: "/apps/makedas-canvas/",
      tags: ["builder", "ux", "design", "startup", "canvas", "product"]
    },
    {
      id: "dotnet",
      title: "Full-stack .NET systems",
      blurb: "ASP.NET Core 8 APIs, React 19 workspaces, human-gated agentic workflows.",
      href: "/vault/Katlego_Mokoto_CV_2026-10-14.pdf",
      tags: ["dotnet", "csharp", "c#", "asp.net", "fullstack", "backend", "api"]
    }
  ];

  var root = document.getElementById("gz-rec");
  if (!root) return;
  var out = root.querySelector("[data-rec-out]");
  var chips = root.querySelectorAll("[data-rec]");

  function score(query, p) {
    var q = query.toLowerCase();
    var s = 0;
    p.tags.forEach(function (t) {
      if (q.indexOf(t) !== -1) s += 3;
      q.split(/\s+/).forEach(function (w) {
        if (w.length > 2 && t.indexOf(w) !== -1) s += 1;
      });
    });
    if (q.indexOf(p.title.toLowerCase().split(" ")[0]) !== -1) s += 2;
    return s;
  }

  function render(query) {
    var ranked = PROJECTS.map(function (p) {
      return { p: p, s: score(query, p) };
    }).sort(function (a, b) { return b.s - a.s; });
    var top = ranked.filter(function (r) { return r.s > 0; }).slice(0, 3);
    if (!top.length) top = ranked.slice(0, 2);

    var html = "<p>Best fit for <strong>" + escapeHtml(query) + "</strong>:</p><ul style='margin:0.5rem 0 0;padding-left:1.1rem'>";
    top.forEach(function (r) {
      html += "<li style='margin-bottom:0.45rem'><a href='" + r.p.href + "' target='_blank' rel='noopener'><strong>" +
        escapeHtml(r.p.title) + "</strong></a> — " + escapeHtml(r.p.blurb) + "</li>";
    });
    html += "</ul>";
    out.innerHTML = html;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  chips.forEach(function (btn) {
    btn.addEventListener("click", function () {
      chips.forEach(function (b) { b.classList.remove("is-hot"); });
      btn.classList.add("is-hot");
      render(btn.getAttribute("data-rec") || btn.textContent);
    });
  });

  var custom = root.querySelector("[data-rec-custom]");
  var go = root.querySelector("[data-rec-go]");
  if (go && custom) {
    go.addEventListener("click", function () {
      var q = (custom.value || "").trim();
      if (q) render(q);
    });
    custom.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        var q = (custom.value || "").trim();
        if (q) render(q);
      }
    });
  }
})();
