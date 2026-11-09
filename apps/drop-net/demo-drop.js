/**
 * Drop Net / AI Hawk — in-browser DEMO core loop.
 * Paste (or pick) a vacancy → local template "draft" cover note + CV synopsis → review → copy.
 * No network: nothing is scraped, sent, or applied. Every output is labelled DEMO / draft-only.
 * Portfolio evidence only references public projects on this site; anything the page cannot
 * verify is left as a [bracketed placeholder] for the human to fill in.
 */
(function () {
  "use strict";
  var K = window.MMDemoKit;

  // Fictional, employer-free sample vacancies (illustrative only).
  var SAMPLES = {
    dotnet: "Backend Developer (.NET) — Johannesburg / hybrid\nWe are looking for a developer to build and maintain ASP.NET Core APIs. You will integrate third-party REST services, write SQL, work with Docker-based deployments and help add AI-assisted features (LLM APIs) to internal tools. Nice to have: Kubernetes, Azure or AWS, POPIA awareness.",
    frontend: "Frontend Engineer — Remote (SA hours)\nBuild responsive, accessible web interfaces in JavaScript/TypeScript. Experience with React or vanilla JS, CSS, Web Audio or Canvas a plus. You care about performance, mobile layouts and clear UX copy. Git, CI and testing expected.",
    data: "Junior Quant / Data Analyst — Cape Town\nSupport research with Python, pandas and SQL. Build dashboards and charting, clean market data feeds, and help evaluate trading signals in a paper / simulated environment. Interest in FX, statistics and automation required."
  };

  // Skill dictionary → public portfolio evidence on mensmercatus.online (no invented credentials).
  var SKILLS = [
    { key: ".NET / ASP.NET Core", re: /\.net|asp\.?net|c#|csharp/i, ev: "Mercatus Cartel Robot — ASP.NET Core minimal API with retrying LLM calls (see /apps/mercatus-assist/)" },
    { key: "LLM / AI APIs", re: /\b(ai|llm|gemini|openai|gpt|machine learning|ml)\b|ai-assisted/i, ev: "Mercatus Assist — Gemini-backed chat behind a same-origin proxy with DEMO fallback" },
    { key: "REST APIs", re: /\brest\b|\bapi(s)?\b|integrat/i, ev: "JobNet read-only demo API + Forex desk health endpoints on the Mens Mercatus VPS" },
    { key: "Python", re: /python|pandas|numpy/i, ev: "Forex Mercatus Codex — Python paper-trading research desk (/apps/forex-codex/)" },
    { key: "JavaScript", re: /javascript|\bjs\b|typescript|vanilla/i, ev: "SoundX AI — React + TypeScript studio with on-device ML (/apps/soundx-ai/)" },
    { key: "Web Audio / Canvas", re: /web ?audio|canvas|audio/i, ev: "SoundX AI (Web Audio mixer, EQ, reverb) + Mercatus Concierge (2D canvas editor)" },
    { key: "Responsive CSS / UX", re: /css|responsive|accessib|mobile|ux/i, ev: "This portfolio — static HTML/CSS, mobile layouts, Cartel design tokens" },
    { key: "Docker / containers", re: /docker|container/i, ev: null },
    { key: "Deploys / ops", re: /deploy|devops|\bci\b|ci\/cd/i, ev: "VPS services (systemd + nginx) and scripted static deploys for this site" },
    { key: "Kubernetes", re: /kubernetes|k8s/i, ev: "Cartel Kubernetes topology schematic (design doc, not a running cluster)" },
    { key: "Cloud (AWS / Azure)", re: /\baws\b|azure|gcp|cloud/i, ev: null },
    { key: "SQL", re: /\bsql\b|postgres|mysql/i, ev: null },
    { key: "React", re: /react/i, ev: null },
    { key: "Charting / dashboards", re: /chart|dashboard|visuali/i, ev: "Forex desk charts (Chart · Multi · Flow tabs) and the hub pipeline view" },
    { key: "FX / trading research", re: /\bfx\b|forex|trading|signal|market data/i, ev: "Forex Mercatus Codex — simulated paper desk only (no broker, no real money)" },
    { key: "Automation / pipelines", re: /automat|pipeline|scheduled|cron/i, ev: "JobNet — scheduled scrape/tailor routines producing draft-only shortlists" },
    { key: "POPIA / compliance", re: /popia|gdpr|complian|privacy/i, ev: "Cartel compliance gates schematic + Assist refusal rules" },
    { key: "Statistics", re: /statistic|regression|model/i, ev: null },
    { key: "Git / testing", re: /\bgit\b|testing|unit test/i, ev: null }
  ];

  var els = {};
  var walk = null;
  var lastDraft = "";

  function pickTitle(text) {
    var first = (text.split(/\n/).find(function (l) { return l.trim(); }) || "").trim();
    if (first.length && first.length <= 90) return first.replace(/\s+—.*$/, "").replace(/\s+-\s+.*$/, "");
    var m = text.match(/((senior|junior|mid|lead)\s+)?[a-z/.#+ ]{0,30}(engineer|developer|analyst|designer|manager|specialist)/i);
    return m ? m[0].trim() : "[Role title]";
  }
  function pickLocation(text) {
    var m = text.match(/johannesburg|cape town|durban|pretoria|remote|hybrid|gauteng/ig);
    return m ? Array.from(new Set(m.map(function (s) { return s[0].toUpperCase() + s.slice(1).toLowerCase(); }))).join(" / ") : "[Location]";
  }

  function generate(text) {
    var hits = SKILLS.filter(function (s) { return s.re.test(text); });
    var covered = hits.filter(function (s) { return s.ev; });
    var gaps = hits.filter(function (s) { return !s.ev; });
    var ratio = hits.length ? covered.length / hits.length : 0;
    var signal = !hits.length ? "unknown" : ratio >= 0.75 ? "high" : ratio >= 0.45 ? "medium" : "low";
    var title = pickTitle(text);
    var loc = pickLocation(text);

    var lines = [];
    lines.push("DEMO · AI Hawk draft — template-generated in your browser. Draft only: nothing was sent, saved, or applied.");
    lines.push("");
    lines.push("ROLE      " + title);
    lines.push("LOCATION  " + loc);
    lines.push("SIGNAL    " + signal.toUpperCase() + " (" + covered.length + "/" + hits.length + " requested skills have public portfolio evidence)");
    lines.push("");
    lines.push("── Cover note (draft) ──");
    lines.push("Dear [Hiring manager name],");
    lines.push("");
    lines.push("I'd like to be considered for the " + title + " role" + (loc !== "[Location]" ? " (" + loc + ")" : "") + ". " +
      (covered.length
        ? "The brief mentions " + covered.slice(0, 3).map(function (s) { return s.key; }).join(", ") + " — areas I've worked on in public projects you can open today:"
        : "[Explain your fit in two sentences — this demo found no matching portfolio evidence.]"));
    covered.slice(0, 4).forEach(function (s) { lines.push("  • " + s.ev); });
    lines.push("");
    lines.push("[Add one sentence on your relevant experience — the demo does not invent years, employers, or qualifications.]");
    lines.push("");
    lines.push("Portfolio: https://mensmercatus.online");
    lines.push("Kind regards,");
    lines.push("[Your name]");
    lines.push("");
    lines.push("── CV synopsis (draft bullets) ──");
    if (covered.length) covered.forEach(function (s) { lines.push("  • " + s.key + " — " + s.ev); });
    else lines.push("  • [No overlapping evidence detected — tailor manually]");
    lines.push("");
    lines.push("── Gaps to confirm before using ──");
    if (gaps.length) gaps.forEach(function (s) { lines.push("  • " + s.key + ": [confirm real experience or leave out]"); });
    else lines.push("  • None detected by keywords — still verify every claim.");
    lines.push("");
    lines.push("Human-gated: review, edit, and send yourself. AI Hawk never auto-applies.");
    return { text: lines.join("\n"), signal: signal, hits: hits.length };
  }

  function onGenerate() {
    var text = (els.input.value || "").trim();
    if (text.length < 40) {
      els.empty.hidden = false;
      K.mountEmpty(els.empty, {
        title: text ? "That blurb is too short to tailor" : "Paste a vacancy first",
        body: "Paste at least a few sentences of a job ad, or tap one of the sample vacancies above. Nothing leaves your browser."
      });
      els.out.hidden = true;
      els.input.focus();
      return;
    }
    els.empty.hidden = true;
    if (els.outEmpty) els.outEmpty.hidden = true;
    var r = generate(text);
    lastDraft = r.text;
    els.out.textContent = r.text;
    els.out.hidden = false;
    els.review.hidden = false;
    els.signal.textContent = "Signal · " + r.signal;
    els.signal.hidden = false;
    els.copy.disabled = false;
    if (walk) { walk.done("paste"); walk.done("generate"); }
    if (window.matchMedia && window.matchMedia("(max-width: 900px)").matches) {
      els.out.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function onReview() {
    var boxes = els.review.querySelectorAll("input[type=checkbox]");
    var all = Array.prototype.every.call(boxes, function (b) { return b.checked; });
    if (all && walk) walk.done("review");
  }

  function onCopy() {
    if (!lastDraft) return;
    K.copyText(lastDraft).then(function (ok) {
      els.copyMsg.textContent = ok ? "Copied draft to clipboard — paste it into your own editor." : "Copy blocked by the browser — select the text manually.";
      if (ok && walk) walk.done("copy");
    });
  }

  function init() {
    if (!K) return;
    els.input = document.getElementById("dn-input");
    els.out = document.getElementById("dn-out");
    els.empty = document.getElementById("dn-empty");
    els.review = document.getElementById("dn-review");
    els.copy = document.getElementById("dn-copy");
    els.copyMsg = document.getElementById("dn-copy-msg");
    els.signal = document.getElementById("dn-signal");
    els.outEmpty = document.getElementById("dn-out-empty");
    if (!els.input) return;

    K.mountStatus(document.getElementById("dn-status"), { mode: "demo", label: "DEMO · in-browser templates · draft only", title: "No scrape, no email, no auto-apply on this host" });

    walk = K.mountWalkthrough(document.getElementById("dn-walk"), {
      id: "drop-net",
      title: "AI Hawk · DEMO walkthrough",
      intro: "Four steps: paste a vacancy → generate a draft → review it → copy it out. Runs entirely in your browser.",
      steps: [
        { id: "paste", label: "Paste", hint: "Paste a job ad into the box, or tap a sample vacancy chip." },
        { id: "generate", label: "Generate", hint: "Press Generate draft. Templates match skills to public portfolio evidence — no LLM, no network." },
        { id: "review", label: "Review", hint: "Tick the review checklist: placeholders replaced, claims verified, gaps resolved." },
        { id: "copy", label: "Copy", hint: "Copy the draft and send it yourself. Then compare with the JobNet live shortlist." }
      ],
      onStep: function (s) {
        if (s.id === "paste") els.input.focus();
        if (s.id === "generate") document.getElementById("dn-generate").focus();
        if (s.id === "review" && !els.review.hidden) els.review.scrollIntoView({ behavior: "smooth", block: "center" });
        if (s.id === "copy" && !els.copy.disabled) els.copy.focus();
      },
      completeText: "Draft copied. Next: open the JobNet read-only shortlist to see the real pipeline output."
    });

    document.querySelectorAll("[data-dn-sample]").forEach(function (b) {
      b.addEventListener("click", function () {
        els.input.value = SAMPLES[b.getAttribute("data-dn-sample")] || "";
        els.empty.hidden = true;
        if (walk) walk.done("paste");
      });
    });
    els.input.addEventListener("input", function () {
      if (els.input.value.trim().length >= 40 && walk) walk.done("paste");
    });
    document.getElementById("dn-generate").addEventListener("click", onGenerate);
    document.getElementById("dn-clear").addEventListener("click", function () {
      els.input.value = ""; els.out.hidden = true; els.review.hidden = true; els.signal.hidden = true;
      els.copy.disabled = true; els.copyMsg.textContent = ""; lastDraft = ""; els.empty.hidden = true;
      if (els.outEmpty) els.outEmpty.hidden = false;
      els.review.querySelectorAll("input").forEach(function (b) { b.checked = false; });
      els.input.focus();
    });
    els.review.addEventListener("change", onReview);
    els.copy.addEventListener("click", onCopy);
  }

  // Exposed for verification scripts.
  window.DropNetDemo = { generate: generate, SAMPLES: SAMPLES };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
