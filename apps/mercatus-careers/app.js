
/* DROP_REMOVED_FROM_CAREERS */
  try {
    if ((location.hash || '').replace(/^#\/?/, '').split('?')[0] === 'drop') {
      location.replace('#/feed');
    }
  } catch (e) {}
/* Mercatus Careers · Mercatus Carrier LLC
   Feed · Boards · Drop · Bulk · Intel · Tracker · Profile · job desk.
   JobNet API + Assist hook. DropNet apply modes: Manual (default) | Automatic | Bulk.
   Manual = draft-only. Automatic/Bulk queue for apply agent — never auto-send Gmail. */
(() => {
  "use strict";

  const API = "https://api.mensmercatus.online/jobnet";
  const ASSIST_URL = "https://api.mensmercatus.online/api/mercatus-cartel/assist";
  const CHAT_URL = "https://api.mensmercatus.online/api/mercatus-cartel/chat";
  const HEALTH_URL = "https://api.mensmercatus.online/health";
  const TRACK_KEY = "mm.careers.tracker.v1";
  const PROFILE_KEY = "mm.careers.profile.v1";
  const CACHE_KEY = "mm.careers.listings.v1";
  const BULK_KEY = "mm.careers.bulk.v1";
  const APPLY_MODE_KEY = "mm.careers.dropnet.applyMode.v1";
  const APPLY_QUEUE_KEY = "mm.careers.dropnet.applyQueue.v1";
  const LEGACY = {
    tracker: "mm.jobnet.tracker.v1",
    profile: "mm.jobnet.profile.v1",
    listings: "mm.jobnet.listings.v1",
  };

  const app = document.getElementById("app");
  const toastEl = document.getElementById("toast");
  const statusEl = document.getElementById("jn-status");

  const STAGES = ["saved", "applied", "interview", "offer", "closed"];
  const STAGE_LABEL = {
    saved: "Saved",
    applied: "Applied",
    interview: "Interview",
    offer: "Offer",
    closed: "Closed",
  };

  /* Core boards only — LI + GD + SA (Pnet/Careers24). BeBee removed from primary chips. */
  const SOURCES = [
    { key: "linkedin", name: "LinkedIn", icon: "💼", color: "#0a66c2", live: true },
    { key: "glassdoor", name: "Glassdoor", icon: "🚪", color: "#0caa41", live: true },
    { key: "pnet", name: "Pnet", icon: "🇿🇦", color: "#00b4d8", live: false },
    { key: "careers24", name: "Careers24", icon: "📋", color: "#e63946", live: false },
  ];

  const DEFAULT_PROFILE = {
    name: "Katlego Mokoto",
    title: "AI Engineer · Full-Stack + .NET",
    email: "katlego.mokoto.km@gmail.com",
    location: "Johannesburg · Pretoria · Cape Town · Durban",
    summary: "",
    skills: "Python, TypeScript, LLMs, RAG, agents, .NET, full-stack, distributed systems",
    target_keywords: "AI engineer, LLM engineer, machine learning, systems architect, full-stack, .NET",
    auto_query: "AI engineer LLM machine learning .NET full-stack",
    portfolio: "https://mensmercatus.online",
  };

  const jobCache = new Map();
  let lastListings = [];
  let lastRun = null;
  let routeGen = 0;

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const toast = (msg) => {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove("show"), 2400);
  };
  const alive = (token) => token === routeGen;
  const fitClass = (n) => (n >= 70 ? "fit" : n >= 45 ? "mid" : "low");
  const hueOf = (s) => {
    let h = 0;
    for (const c of String(s || "")) h = (h * 33 + c.charCodeAt(0)) % 360;
    return h;
  };
  const srcMeta = (key) => SOURCES.find((s) => s.key === key) || { name: key || "Board", icon: "📌", color: "#888" };
  const signalFit = (signal) => ({ high: 82, medium: 58, low: 34 }[String(signal || "").toLowerCase()] || null);

  function loadTracker() {
    try {
      return JSON.parse(localStorage.getItem(TRACK_KEY) || "{}");
    } catch {
      return {};
    }
  }
  function saveTracker(t) {
    localStorage.setItem(TRACK_KEY, JSON.stringify(t));
  }
  function trackJob(job, stage) {
    const t = loadTracker();
    const id = job.id || job.url || `${job.company}-${job.title}`;
    t[id] = {
      ...(t[id] || {}),
      id,
      title: job.title || "",
      company: job.company || job.company_name || "",
      url: job.url || job.apply_url || "",
      location: job.location || "",
      fit: job.fit_score || t[id]?.fit || signalFit(job.signal),
      stage: stage || t[id]?.stage || "saved",
      job,
      updated: new Date().toISOString(),
    };
    saveTracker(t);
    toast(`${STAGE_LABEL[t[id].stage]} · ${t[id].company}`);
  }

  function loadProfile() {
    try {
      return { ...DEFAULT_PROFILE, ...JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}") };
    } catch {
      return { ...DEFAULT_PROFILE };
    }
  }
  function saveProfile(p) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  }

  function migrateLegacyKeys() {
    try {
      if (!localStorage.getItem(TRACK_KEY) && localStorage.getItem(LEGACY.tracker)) {
        localStorage.setItem(TRACK_KEY, localStorage.getItem(LEGACY.tracker));
      }
      if (!localStorage.getItem(PROFILE_KEY) && localStorage.getItem(LEGACY.profile)) {
        localStorage.setItem(PROFILE_KEY, localStorage.getItem(LEGACY.profile));
      }
      if (!localStorage.getItem(CACHE_KEY) && localStorage.getItem(LEGACY.listings)) {
        localStorage.setItem(CACHE_KEY, localStorage.getItem(LEGACY.listings));
      }
    } catch (_) {}
  }

  function loadBulk() {
    try {
      return JSON.parse(localStorage.getItem(BULK_KEY) || '{"items":[]}');
    } catch {
      return { items: [] };
    }
  }
  function saveBulk(b) {
    localStorage.setItem(BULK_KEY, JSON.stringify(b));
  }

  const DEFAULT_APPLY_MODE = {
    mode: "manual",
    threshold: 80,
    bulk: { days: [1, 2, 3, 4, 5], time: "08:17" },
    autoConfirm: false,
  };
  const DOW_LABELS = [
    { d: 0, label: "Sun" },
    { d: 1, label: "Mon" },
    { d: 2, label: "Tue" },
    { d: 3, label: "Wed" },
    { d: 4, label: "Thu" },
    { d: 5, label: "Fri" },
    { d: 6, label: "Sat" },
  ];

  function loadApplyMode() {
    try {
      const raw = JSON.parse(localStorage.getItem(APPLY_MODE_KEY) || "null");
      if (!raw || typeof raw !== "object") return { ...DEFAULT_APPLY_MODE, bulk: { ...DEFAULT_APPLY_MODE.bulk, days: [...DEFAULT_APPLY_MODE.bulk.days] } };
      const days = Array.isArray(raw.bulk?.days)
        ? raw.bulk.days.map(Number).filter((n) => n >= 0 && n <= 6)
        : [...DEFAULT_APPLY_MODE.bulk.days];
      const mode = ["manual", "automatic", "bulk"].includes(raw.mode) ? raw.mode : "manual";
      let threshold = Number(raw.threshold);
      if (!Number.isFinite(threshold)) threshold = 80;
      threshold = Math.max(0, Math.min(100, Math.round(threshold)));
      const time = typeof raw.bulk?.time === "string" && /^\d{1,2}:\d{2}$/.test(raw.bulk.time)
        ? raw.bulk.time.padStart(5, "0")
        : "08:17";
      return {
        mode,
        threshold,
        bulk: { days: days.length ? days : [...DEFAULT_APPLY_MODE.bulk.days], time },
        autoConfirm: !!raw.autoConfirm,
      };
    } catch {
      return { ...DEFAULT_APPLY_MODE, bulk: { ...DEFAULT_APPLY_MODE.bulk, days: [...DEFAULT_APPLY_MODE.bulk.days] } };
    }
  }
  function saveApplyMode(cfg) {
    const next = {
      mode: cfg.mode || "manual",
      threshold: Math.max(0, Math.min(100, Number(cfg.threshold) || 80)),
      bulk: {
        days: Array.isArray(cfg.bulk?.days) ? cfg.bulk.days.map(Number) : [1, 2, 3, 4, 5],
        time: cfg.bulk?.time || "08:17",
      },
      autoConfirm: !!cfg.autoConfirm,
    };
    localStorage.setItem(APPLY_MODE_KEY, JSON.stringify(next));
    return next;
  }

  function loadApplyQueue() {
    try {
      return JSON.parse(localStorage.getItem(APPLY_QUEUE_KEY) || '{"items":[],"updated":null}');
    } catch {
      return { items: [], updated: null };
    }
  }
  function saveApplyQueue(q) {
    localStorage.setItem(APPLY_QUEUE_KEY, JSON.stringify(q));
  }

  /** Honest queue stub: records intended applies in localStorage (+ exportable JSON).
   *  Live LinkedIn Easy Apply needs the Lab/browser apply agent — Careers static app cannot submit. */
  function queueApplyJobs(roles, opts) {
    const cfg = loadApplyMode();
    const threshold = opts?.threshold != null ? Number(opts.threshold) : cfg.threshold;
    const reason = opts?.reason || cfg.mode;
    const q = loadApplyQueue();
    const existing = new Set((q.items || []).map((x) => String(x.id || x.apply_url || x.url)));
    const now = new Date().toISOString();
    const added = [];
    const logEntries = [];
    for (const r of roles || []) {
      const fit = r.fit_score != null ? Number(r.fit_score) : signalFit(r.signal);
      if (fit == null || fit < threshold) continue;
      const id = String(r.id || r.apply_url || r.url || `${r.company}-${r.title}`);
      if (existing.has(id)) continue;
      existing.add(id);
      const item = {
        id,
        title: r.title || "",
        company: r.company || "",
        location: r.location || "",
        fit_score: fit,
        apply_url: r.apply_url || r.url || "",
        url: r.url || r.apply_url || "",
        board: r.board || r.source || "",
        status: "queued_for_apply_agent",
        reason,
        threshold,
        queued_at: now,
        note: "Queued for Lab/browser apply agent — Careers static app does not live-submit Easy Apply.",
      };
      q.items.push(item);
      added.push(item);
      logEntries.push({
        id,
        title: item.title,
        company: item.company,
        fit_score: fit,
        action: "queued",
        mode: reason,
        at: now,
        result: "queued_for_apply_agent",
      });
    }
    q.updated = now;
    q.schema = "dropnet-apply-queue/v1";
    q.path_hint = "/workspace/jobnet/dropnet/apply-queue.json";
    q.log_hint = "apps/mercatus-careers/dropnet/apply-log.json";
    saveApplyQueue(q);

    // Client-side apply-log mirror (browser cannot write disk; export + agent sync)
    try {
      const LOG_KEY = "mm.careers.dropnet.applyLog.v1";
      const log = JSON.parse(localStorage.getItem(LOG_KEY) || '{"entries":[]}');
      log.entries = (log.entries || []).concat(logEntries);
      log.updated = now;
      log.schema = "dropnet-apply-log/v1";
      localStorage.setItem(LOG_KEY, JSON.stringify(log));
    } catch (_) {}

    return { added, queue: q, threshold };
  }

  function exportApplyQueueDownload() {
    const q = loadApplyQueue();
    const blob = new Blob([JSON.stringify(q, null, 2)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: "apply-queue.json",
    });
    a.click();
  }

  function dowCronHint(days, time) {
    const [hh, mm] = String(time || "08:17").split(":");
    const sorted = [...new Set((days || []).map(Number))].sort((a, b) => a - b);
    const dayPart = sorted.length === 7 ? "*" : sorted.join(",") || "1-5";
    return `${Number(mm) || 17} ${Number(hh) || 8} * * ${dayPart}`;
  }

  async function callAssist(message, toolId) {
    const r = await fetch(ASSIST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolId: toolId || "careers", message }),
    });
    if (!r.ok) throw new Error("assist " + r.status);
    const data = await r.json();
    const text = data.suggestion || data.content || data.text || "";
    if (!text) throw new Error("empty assist");
    return { text, model: data.model || "unknown", raw: data };
  }

  async function callChat(message) {
    const r = await fetch(CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolId: "careers", message }),
    });
    if (!r.ok) throw new Error("chat " + r.status);
    const data = await r.json();
    return { text: data.content || data.suggestion || "", model: data.model || "unknown", role: data.role };
  }

  const DROP_SKILLS = [
    { key: ".NET / ASP.NET Core", re: /\.net|asp\.?net|c#|csharp/i, ev: "Mercatus Blueprint Robot — ASP.NET Core minimal API" },
    { key: "LLM / AI APIs", re: /\b(ai|llm|gemini|openai|gpt|machine learning|ml)\b|ai-assisted/i, ev: "Mercatus Assist — Gemini-backed chat" },
    { key: "REST APIs", re: /\brest\b|\bapi(s)?\b|integrat/i, ev: "JobNet read-only demo API" },
    { key: "Python", re: /python|pandas|numpy/i, ev: "Forex Mercatus Codex — Python paper desk" },
    { key: "JavaScript", re: /javascript|\bjs\b|typescript|vanilla/i, ev: "Sound Dex — browser DAW" },
    { key: "Web Audio / Canvas", re: /web ?audio|canvas|audio/i, ev: "Sound Dex + Concierge canvas" },
    { key: "Responsive CSS / UX", re: /css|responsive|accessib|mobile|ux/i, ev: "This portfolio — Blueprint tokens" },
    { key: "Docker / containers", re: /docker|container/i, ev: null },
    { key: "Kubernetes", re: /kubernetes|k8s/i, ev: "Blueprint K8s topology schematic" },
    { key: "SQL", re: /\bsql\b|postgres|mysql/i, ev: null },
    { key: "React", re: /react/i, ev: null },
    { key: "FX / trading research", re: /\bfx\b|forex|trading|signal|market data/i, ev: "Forex Mercatus Codex — paper only" },
    { key: "POPIA / compliance", re: /popia|gdpr|complian|privacy/i, ev: "Blueprint compliance gates" },
  ];
  const DROP_SAMPLES = {
    dotnet: "Backend Developer (.NET) — Johannesburg / hybrid\nWe are looking for a developer to build and maintain ASP.NET Core APIs. You will integrate third-party REST services, write SQL, work with Docker-based deployments and help add AI-assisted features (LLM APIs) to internal tools. Nice to have: Kubernetes, Azure or AWS, POPIA awareness.",
    frontend: "Frontend Engineer — Remote (SA hours)\nBuild responsive, accessible web interfaces in JavaScript/TypeScript. Experience with React or vanilla JS, CSS, Web Audio or Canvas a plus. You care about performance, mobile layouts and clear UX copy. Git, CI and testing expected.",
    data: "Junior Quant / Data Analyst — Cape Town\nSupport research with Python, pandas and SQL. Build dashboards and charting, clean market data feeds, and help evaluate trading signals in a paper / simulated environment. Interest in FX, statistics and automation required.",
  };

  function dropGenerate(text) {
    const hits = DROP_SKILLS.filter((s) => s.re.test(text));
    const covered = hits.filter((s) => s.ev);
    const gaps = hits.filter((s) => !s.ev);
    const ratio = hits.length ? covered.length / hits.length : 0;
    const signal = !hits.length ? "unknown" : ratio >= 0.75 ? "high" : ratio >= 0.45 ? "medium" : "low";
    const first = (text.split(/\n/).find((l) => l.trim()) || "").trim();
    const title =
      first.length && first.length <= 90
        ? first.replace(/\s+—.*$/, "").replace(/\s+-\s+.*$/, "")
        : "[Role title]";
    const locM = text.match(/johannesburg|cape town|durban|pretoria|remote|hybrid|gauteng/gi);
    const loc = locM
      ? Array.from(new Set(locM.map((s) => s[0].toUpperCase() + s.slice(1).toLowerCase()))).join(" / ")
      : "[Location]";
    const lines = [
      "DropNet · AI Hawk draft — template-generated in your browser. Draft only: nothing was sent or applied.",
      "",
      "ROLE      " + title,
      "LOCATION  " + loc,
      "SIGNAL    " + signal.toUpperCase() + " (" + covered.length + "/" + hits.length + " skills with public evidence)",
      "",
      "── Cover note (draft) ──",
      "Dear [Hiring manager name],",
      "",
      "I'd like to be considered for the " +
        title +
        " role" +
        (loc !== "[Location]" ? " (" + loc + ")" : "") +
        ". " +
        (covered.length
          ? "The brief mentions " + covered.slice(0, 3).map((s) => s.key).join(", ") + " — areas I've worked on in public projects:"
          : "[Explain your fit — no matching portfolio evidence detected.]"),
    ];
    covered.slice(0, 4).forEach((s) => lines.push("  • " + s.ev));
    lines.push("", "[Add one sentence on relevant experience — do not invent employers.]", "");
    lines.push("Portfolio: https://mensmercatus.online", "Kind regards,", "[Your name]", "");
    lines.push("── CV synopsis (draft) ──");
    if (covered.length) covered.forEach((s) => lines.push("  • " + s.key + " — " + s.ev));
    else lines.push("  • [No overlapping evidence — tailor manually]");
    lines.push("", "── Gaps to confirm ──");
    if (gaps.length) gaps.forEach((s) => lines.push("  • " + s.key + ": [confirm or leave out]"));
    else lines.push("  • None detected — still verify every claim.");
    lines.push("", "Human-gated: review, edit, submit yourself. Careers never auto-applies.");
    return { text: lines.join("\n"), signal, hits: hits.length };
  }

  function setStatusPills({ jobnet, assist }) {
    const pj = document.getElementById("pill-jobnet");
    const pa = document.getElementById("pill-assist");
    if (pj && jobnet) {
      pj.textContent = jobnet.label;
      pj.className = "pill " + (jobnet.ok ? "live" : "down");
    }
    if (pa && assist) {
      pa.textContent = assist.label;
      pa.className = "pill " + (assist.ok ? "live" : "down");
    }
  }


  function normalize(raw) {
    const fit = signalFit(raw.signal);
    return {
      id: raw.id,
      source: raw.source || "linkedin",
      title: raw.title || "",
      company_name: raw.company || raw.company_name || "",
      company: raw.company || raw.company_name || "",
      location: raw.location || "",
      posted: raw.posted || "",
      published_at: raw.posted || "",
      url: raw.url || "",
      apply_url: raw.url || "",
      absolute_url: raw.url || "",
      signal: raw.signal || "",
      why: raw.why || "",
      new_since_last_run: !!raw.new_since_last_run,
      fit_score: fit,
      listing_valid: true,
      is_sa: /south africa|gauteng|cape town|johannesburg|pretoria|za\b/i.test(
        `${raw.location || ""} ${raw.url || ""}`
      ),
      is_remote: /remote/i.test(raw.location || ""),
    };
  }

  function remember(posts) {
    lastListings = posts || lastListings;
    (posts || []).forEach((p) => p && p.id && jobCache.set(p.id, p));
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ at: Date.now(), run: lastRun, posts: lastListings.slice(0, 80) })
      );
    } catch (_) {}
  }

  function loadCached() {
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (!c || !Array.isArray(c.posts) || !c.posts.length) return null;
      lastRun = c.run || null;
      remember(c.posts.map(normalize));
      return lastListings;
    } catch {
      return null;
    }
  }

  async function fetchListings() {
    let data = null;
    try {
      const r = await fetch(`${API}/api/listings?limit=100`, { cache: "no-store" });
      if (!r.ok) throw new Error("listings " + r.status);
      data = await r.json();
    } catch (err) {
      const r2 = await fetch("./data/listings.json", { cache: "no-store" });
      if (!r2.ok) throw err;
      data = await r2.json();
    }
    lastRun = data.run || null;
    const posts = (data.listings || []).map(normalize);
    remember(posts);
    return { posts, run: lastRun, n: data.n || posts.length };
  }

  async function fetchHealth() {
    try {
      const r = await fetch(`${API}/api/health`, { cache: "no-store" });
      if (!r.ok) throw new Error("health " + r.status);
      return await r.json();
    } catch (err) {
      const r2 = await fetch("./data/health.json", { cache: "no-store" });
      if (!r2.ok) throw err;
      return await r2.json();
    }
  }

  function sast(iso) {
    try {
      return (
        new Date(iso).toLocaleString("en-ZA", {
          timeZone: "Africa/Johannesburg",
          dateStyle: "medium",
          timeStyle: "short",
        }) + " SAST"
      );
    } catch {
      return "—";
    }
  }

  function moveInk() {
    const ink = document.getElementById("tab-ink");
    const active = document.querySelector("#tabs button.active");
    if (!ink || !active) return;
    ink.style.width = `${active.offsetWidth}px`;
    ink.style.transform = `translateX(${active.offsetLeft}px)`;
  }

  function stageIn() {
    app.classList.remove("jn-stage-in");
    void app.offsetWidth;
    app.classList.add("jn-stage-in");
    requestAnimationFrame(moveInk);
  }

  function copy(text) {
    navigator.clipboard.writeText(text).then(
      () => toast("Copied"),
      () => toast("Select and copy manually")
    );
  }

  function postHTML(p) {
    const sm = srcMeta(p.source);
    const apply = p.apply_url || p.url || "";
    return `<article class="jn-post">
      <div class="avatar" aria-hidden="true" style="--hue:${hueOf(p.company_name)}">${esc(((p.company_name || "?").slice(0, 1) || "?").toUpperCase())}</div>
      <div>
        <div class="jn-line">
          <strong>${esc(p.company_name)}</strong>
          <span class="jn-source" style="--sc:${sm.color}">${sm.icon} ${esc(sm.name)}</span>
          ${p.fit_score != null ? `<span class="jn-pill ${fitClass(Number(p.fit_score))}">fit ${Number(p.fit_score)}</span>` : ""}
          ${p.signal ? `<span class="jn-pill ${esc(p.signal)}">${esc(p.signal)} signal</span>` : ""}
          ${p.new_since_last_run ? `<span class="jn-pill ok">new</span>` : ""}
          ${p.is_sa ? `<span class="jn-pill">🇿🇦 ZA</span>` : ""}
          ${p.is_remote ? `<span class="jn-pill remote">remote</span>` : ""}
        </div>
        <p class="jn-title">${esc(p.title)}</p>
        <div class="jn-post-meta">${[p.location, p.posted].filter(Boolean).map(esc).join(" · ")}</div>
        ${p.why ? `<p class="jn-why">${esc(p.why)}</p>` : ""}
        <div class="jn-actions">
          <button class="jn-btn primary sm" data-act="open" data-id="${esc(p.id)}">Open desk</button>
          ${apply ? `<a class="jn-btn sm" href="${esc(apply)}" target="_blank" rel="noopener">Open posting ↗</a>` : ""}
          ${apply ? `<button class="jn-btn ghost sm" data-act="copy" data-url="${esc(apply)}">Copy link</button>` : ""}
          <button class="jn-btn ghost sm" data-act="save" data-id="${esc(p.id)}">Save</button>
        </div>
      </div>
    </article>`;
  }

  function wirePosts(root) {
    root.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-act]");
      if (!b) return;
      if (b.dataset.act === "copy") copy(b.dataset.url);
      if (b.dataset.act === "save") trackJob(jobCache.get(b.dataset.id) || { id: b.dataset.id });
      if (b.dataset.act === "open") location.hash = `#/job?id=${encodeURIComponent(b.dataset.id)}`;
    });
  }

  function sourceChips(active) {
    return `<div class="jn-sfb" id="sfb">
      <button type="button" class="${!active ? "active" : ""}" data-src="" style="--sc:#c8102e">All</button>
      ${SOURCES.map(
        (s) =>
          `<button type="button" class="${active === s.key ? "active" : ""}" data-src="${s.key}" style="--sc:${s.color}" title="${esc(s.note || (s.live ? "Live shortlist" : "Filter chip — open board externally"))}">${s.icon} ${s.name}</button>`
      ).join("")}
    </div>`;
  }

  function filterPosts(posts, { q, src, remote }) {
    let out = posts.slice();
    if (src) out = out.filter((p) => (p.source || "") === src);
    if (remote) out = out.filter((p) => p.is_remote);
    if (q) {
      const n = q.toLowerCase();
      out = out.filter((p) =>
        `${p.title} ${p.company_name} ${p.location} ${p.why} ${p.source}`.toLowerCase().includes(n)
      );
    }
    return out;
  }

  /* ── routes ───────────────────────────────────────────────────────────── */
  async function renderFeed(params, token) {
    const profile = loadProfile();
    const q0 = params.get("q") || "";
    const src0 = params.get("src") || "";
    app.innerHTML = `
      <section class="jn-hero">
        <h1>Roles that match you</h1>
        <p>Read-only shortlist from the JobNet demo API (LinkedIn + Glassdoor). Draft packets stay in your browser — you submit on the employer site.</p>
      </section>
      <form class="jn-compose" id="f">
        <input type="text" id="q" placeholder="Filter… blank uses profile auto_query" value="${esc(q0)}" />
        <label class="check"><input type="checkbox" id="remote" ${params.get("remote") === "1" ? "checked" : ""}/> Remote</label>
        <button class="jn-btn primary" type="submit">Refresh</button>
        <button class="jn-btn ghost" type="button" id="use-auto">Use auto_query</button>
      </form>
      ${sourceChips(src0)}
      <p class="jn-meta" id="meta">Loading…</p>
      <div id="list"></div>`;

    const list = document.getElementById("list");
    wirePosts(list);
    let activeSrc = src0;

    document.getElementById("sfb").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-src]");
      if (!b) return;
      activeSrc = b.dataset.src || "";
      document.querySelectorAll("#sfb button").forEach((x) => x.classList.toggle("active", x.dataset.src === activeSrc));
      paint();
    });
    document.getElementById("use-auto").onclick = () => {
      document.getElementById("q").value = profile.auto_query || profile.target_keywords || "";
      paint();
    };

    const ensure = async () => {
      if (lastListings.length) return lastListings;
      try {
        const { posts } = await fetchListings();
        return posts;
      } catch {
        return loadCached() || [];
      }
    };

    const paint = async () => {
      document.getElementById("meta").textContent = "Loading live listings…";
      const all = await ensure();
      if (!alive(token)) return;
      const q = document.getElementById("q").value.trim();
      const remote = document.getElementById("remote").checked;
      let posts = filterPosts(all, { q, src: activeSrc, remote });
      /* Non-live chips (Pnet/Careers24): show empty with honest note if no matching source in API */
      if (activeSrc && !SOURCES.find((s) => s.key === activeSrc)?.live && !posts.length) {
        list.innerHTML = `<p class="jn-empty">No live ${esc(srcMeta(activeSrc).name)} rows in this shortlist run. Live scrape covers LinkedIn + Glassdoor. Open the board externally, or switch to All / LinkedIn.</p>`;
        document.getElementById("meta").textContent = `0 posts · chip ${activeSrc} (not in VPS shortlist)`;
      } else {
        list.innerHTML = posts.length
          ? posts.map(postHTML).join("")
          : `<p class="jn-empty">No posts match. Clear filters or tap Use auto_query.</p>`;
        const when = lastRun?.scraped_at ? sast(lastRun.scraped_at) : "—";
        document.getElementById("meta").textContent = `${posts.length} posts · scraped ${when}${
          q ? ` · filter "${q}"` : profile.auto_query ? ` · profile auto_query ready` : ""
        }`;
      }
      history.replaceState(
        null,
        "",
        `#/feed?${new URLSearchParams({
          q,
          remote: remote ? "1" : "0",
          src: activeSrc,
        })}`
      );
    };

    document.getElementById("f").addEventListener("submit", (e) => {
      e.preventDefault();
      paint();
    });
    await paint();
  }

  async function renderBoards(_params, token) {
    if (!alive(token)) return;
    if (!lastListings.length) {
      try {
        await fetchListings();
      } catch {
        loadCached();
      }
    }
    if (!alive(token)) return;
    const counts = {};
    SOURCES.forEach((s) => (counts[s.key] = 0));
    lastListings.forEach((p) => {
      const k = p.source || "";
      if (k in counts) counts[k] += 1;
      else counts[k] = (counts[k] || 0) + 1;
    });
    const when = lastRun?.scraped_at ? sast(lastRun.scraped_at) : "—";
    app.innerHTML = `
      <section class="jn-hero">
        <h1>Core boards</h1>
        <p>Short sweep of the active shortlist — LinkedIn + Glassdoor live; SA chips for discovery. Latest scrape ${esc(when)}.</p>
      </section>
      <div class="jn-board-grid">
        ${SOURCES.map((s) => {
          const n = counts[s.key] || 0;
          return `<div class="jn-board-card" style="--sc:${s.color}">
            <div>${s.icon}</div>
            <div class="bc-name">${esc(s.name)}</div>
            <div class="bc-count">${n}</div>
            <div class="bc-note">${s.live ? "Live in VPS shortlist" : esc(s.note || "Filter chip · open board externally")}</div>
            <button class="jn-btn sm primary" data-src="${s.key}">Filter feed</button>
          </div>`;
        }).join("")}
      </div>
      <p class="jn-meta" style="margin-top:1rem">${lastListings.length} total roles in memory · draft-only desk</p>`;
    app.querySelectorAll("button[data-src]").forEach((b) => {
      b.onclick = () => {
        location.hash = `#/feed?src=${encodeURIComponent(b.dataset.src)}`;
      };
    });
  }

  async function renderIntel(params, token) {
    if (!alive(token)) return;
    const focus = jobCache.get(params.get("id") || "") || lastListings[0] || null;
    const titleDefault = params.get("title") || focus?.title || "AI Engineer";
    const companyDefault = params.get("company") || focus?.company_name || "";

    app.innerHTML = `
      <section class="jn-hero">
        <h1>Role intel</h1>
        <p>Company / role fit notes from the shortlist, plus Glassdoor salary lookup links. One focused view — not a second product.</p>
      </section>
      <form class="jn-compose" id="intf">
        <input type="text" id="intq" value="${esc(titleDefault)}" placeholder="Role title" />
        <input type="text" id="intco" value="${esc(companyDefault)}" placeholder="Company (optional)" style="flex:0.8" />
        <button class="jn-btn primary" type="submit">Refresh intel</button>
      </form>
      <div class="jn-intel-grid" id="intel-grid"></div>`;

    const paint = () => {
      const title = document.getElementById("intq").value.trim() || "AI Engineer";
      const company = document.getElementById("intco").value.trim();
      const matches = lastListings.filter((p) => {
        const hay = `${p.title} ${p.company_name}`.toLowerCase();
        return (
          (!title || hay.includes(title.toLowerCase().split(/\s+/)[0])) &&
          (!company || (p.company_name || "").toLowerCase().includes(company.toLowerCase()))
        );
      });
      const top = matches[0] || focus;
      const gdSalary = `https://www.glassdoor.com/Salaries/index.htm?keyword=${encodeURIComponent(title)}`;
      const gdCompany = company
        ? `https://www.glassdoor.com/Search/results.htm?keyword=${encodeURIComponent(company)}`
        : "https://www.glassdoor.com/";
      const grid = document.getElementById("intel-grid");
      grid.innerHTML = `
        <div class="jn-panel">
          <h3>Fit notes</h3>
          ${
            top
              ? `<div class="jn-intel-row"><span>Role</span><strong>${esc(top.title)}</strong></div>
                 <div class="jn-intel-row"><span>Company</span><strong>${esc(top.company_name)}</strong></div>
                 <div class="jn-intel-row"><span>Signal</span><strong>${esc(top.signal || "—")}</strong></div>
                 <div class="jn-intel-row"><span>Fit score</span><strong>${top.fit_score != null ? top.fit_score : "—"}</strong></div>
                 <p class="jn-why" style="margin-top:0.65rem">${esc(top.why || "No why-note on this listing.")}</p>
                 <div class="jn-actions" style="margin-top:0.75rem">
                   <button class="jn-btn sm primary" data-open="${esc(top.id)}">Open desk</button>
                   <button class="jn-btn sm ghost" data-save="${esc(top.id)}">Save</button>
                 </div>`
              : `<p class="jn-muted">Load Feed first, then open Intel from a role.</p>`
          }
        </div>
        <div class="jn-panel">
          <h3>Glassdoor salary</h3>
          <div class="jn-intel-row"><span>Lookup</span><strong>${esc(title)}</strong></div>
          <div class="jn-intel-row"><span>Market</span><strong>Public Glassdoor pages</strong></div>
          <p class="jn-muted" style="font-size:0.84rem;margin:0.55rem 0">Opens Glassdoor in a new tab. Salary figures are not scraped or stored here.</p>
          <a class="jn-btn sm" href="${esc(gdSalary)}" target="_blank" rel="noopener">Salary search ↗</a>
          <a class="jn-btn sm ghost" href="${esc(gdCompany)}" target="_blank" rel="noopener">Company page ↗</a>
        </div>
        <div class="jn-panel">
          <h3>Shortlist cover</h3>
          <div class="jn-intel-row"><span>In memory</span><strong>${lastListings.length}</strong></div>
          <div class="jn-intel-row"><span>LinkedIn</span><strong>${lastListings.filter((p) => p.source === "linkedin").length}</strong></div>
          <div class="jn-intel-row"><span>Glassdoor</span><strong>${lastListings.filter((p) => p.source === "glassdoor").length}</strong></div>
          <div class="jn-intel-row"><span>Matching filter</span><strong>${matches.length}</strong></div>
        </div>`;
      grid.querySelectorAll("[data-open]").forEach((b) => {
        b.onclick = () => (location.hash = `#/job?id=${encodeURIComponent(b.dataset.open)}`);
      });
      grid.querySelectorAll("[data-save]").forEach((b) => {
        b.onclick = () => trackJob(jobCache.get(b.dataset.save) || { id: b.dataset.save });
      });
    };

    document.getElementById("intf").addEventListener("submit", (e) => {
      e.preventDefault();
      paint();
    });
    if (!lastListings.length) {
      try {
        await fetchListings();
      } catch {
        loadCached();
      }
    }
    if (!alive(token)) return;
    paint();
  }

  function draftFit(job, profile) {
    const skills = String(profile.skills || "")
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const hay = `${job.title} ${job.why} ${job.location}`.toLowerCase();
    const hits = skills.filter((s) => hay.includes(s.toLowerCase()));
    const gaps = skills.filter((s) => !hits.includes(s)).slice(0, 4);
    const base = job.fit_score != null ? job.fit_score : signalFit(job.signal) || 50;
    const boost = Math.min(12, hits.length * 3);
    const score = Math.min(95, base + boost);
    return {
      score,
      hits,
      gaps,
      text: `Fit ${score}/100 for ${job.title} @ ${job.company_name}\nSignal: ${job.signal || "n/a"}\nMatches: ${hits.join(", ") || "—"}\nGaps to address: ${gaps.join(", ") || "—"}\nWhy (shortlist): ${job.why || "—"}`,
    };
  }

  function draftBrief(job) {
    return `ROLE BRIEF — ${job.title} @ ${job.company_name}
Location: ${job.location || "—"}
Board: ${srcMeta(job.source).name}
Posted: ${job.posted || "—"}

What the shortlist says:
${job.why || "No annotated why-note."}

Draft checklist (human-gated):
1. Open posting and confirm still live.
2. Map 2–3 proof bullets from your profile to the why-note.
3. Build packet → review → submit on employer site.
4. Mark Applied in Tracker only after you submit.`;
  }

  function draftPacket(job, profile) {
    const fit = draftFit(job, profile);
    return `APPLY PACKET (DRAFT ONLY — do not auto-submit)
Role: ${job.title}
Company: ${job.company_name}
Apply URL: ${job.url || "—"}

CANDIDATE
Name: ${profile.name || "[your name]"}
Headline: ${profile.title || ""}
Email: ${profile.email || "[email]"}
Location: ${profile.location || ""}

SUMMARY
${profile.summary || "[1–2 lines from Profile]"}

SKILLS
${profile.skills || ""}

COVER (draft)
Hi ${job.company_name} hiring team — I'm applying for ${job.title}. ${fit.hits.length ? `Relevant strengths: ${fit.hits.slice(0, 3).join(", ")}.` : ""} ${job.why ? `I'm especially interested because: ${job.why}` : ""} Happy to share a portfolio walkthrough.

FIT NOTES
${fit.text}

HOW TO SUBMIT
1. Open the posting link above.
2. Paste answers from this packet — edit before send.
3. Attach your CV manually.
4. Submit on the employer site (never from this desk).
5. Mark Applied in Tracker.`;
  }

  function draftOutreach(job, profile) {
    const subj = `Interest in ${job.title} — ${profile.name || "candidate"}`;
    const body = `Hi ${job.company_name} team,

I saw the ${job.title} role${job.location ? ` (${job.location})` : ""} and wanted to introduce myself briefly.

${profile.summary || "I'm an engineer focused on AI systems and shipping reliable product."}

Happy to share a tailored CV or a short portfolio walkthrough if useful.

Best,\n${profile.name || "[name]"}`;
    return `Subject: ${subj}\n\n${body}\n\n— Saved as local draft only. Copy into Gmail yourself; nothing is sent from Careers.`;
  }

  function draftInterview(job) {
    return `INTERVIEW PREP — ${job.title} @ ${job.company_name}

Likely angles (from shortlist why):
${job.why || "General AI / software systems interview."}

Practice prompts:
1. Walk me through a production LLM or agent feature you shipped end-to-end.
2. How do you gate risky automation (human-in-the-loop)?
3. Trade-offs: latency vs quality for retrieval / tools.
4. Tell me about a failure in production and what you changed.
5. Why this company / this role?

After the call: paste notes into Tracker (Interview stage) and distill next steps yourself.`;
  }

  async function renderJob(params, token) {
    const id = params.get("id");
    let job = jobCache.get(id) || loadTracker()[id]?.job;
    if (!job && !lastListings.length) {
      try {
        await fetchListings();
      } catch {
        loadCached();
      }
    }
    if (!alive(token)) return;
    job = jobCache.get(id) || loadTracker()[id]?.job;
    if (!job) {
      app.innerHTML = `<div class="jn-panel"><h2>Role not loaded</h2><p class="jn-muted">Open it from Feed first.</p><button class="jn-btn" onclick="location.hash='#/feed'">← Feed</button></div>`;
      return;
    }
    const profile = loadProfile();
    const sm = srcMeta(job.source);
    const apply = job.apply_url || job.url || "";
    const TOOLS = [
      ["fit", "Fit score", "Match vs gaps from profile skills"],
      ["brief", "Role brief", "What this listing is asking for"],
      ["packet", "Apply packet", "Draft answers + cover — copy only"],
      ["outreach", "Outreach email", "Gmail draft text — you send"],
      ["interview", "Interview prep", "Practice prompts for this role"],
    ];

    app.innerHTML = `
      <div class="jn-split">
        <div>
          <div class="jn-panel">
            <div class="jn-line">
              <strong>${esc(job.company_name)}</strong>
              <span class="jn-source" style="--sc:${sm.color}">${sm.icon} ${esc(sm.name)}</span>
              ${job.fit_score != null ? `<span class="jn-pill ${fitClass(Number(job.fit_score))}">fit ${Number(job.fit_score)}</span>` : ""}
              ${job.signal ? `<span class="jn-pill">${esc(job.signal)}</span>` : ""}
            </div>
            <h2 style="font-size:1.25rem;margin:0.35rem 0">${esc(job.title)}</h2>
            <p class="jn-muted">${[job.location, job.posted].filter(Boolean).map(esc).join(" · ")}</p>
            ${job.why ? `<p class="jn-why">${esc(job.why)}</p>` : ""}
            <div class="jn-actions" style="margin-top:0.75rem">
              ${apply ? `<a class="jn-btn primary" href="${esc(apply)}" target="_blank" rel="noopener">Open posting ↗</a>` : ""}
              <button class="jn-btn" id="fillnow">Build packet</button>
              <button class="jn-btn ghost" id="todrop">Build Drop packet</button>
              <button class="jn-btn ghost" id="save">Save</button>
              <button class="jn-btn ghost" id="applied">Mark applied</button>
              <button class="jn-btn ghost" id="intelbtn">Intel</button>
            </div>
          </div>
          <div class="jn-panel" style="margin-top:0.75rem">
            <h3 id="ai-title">Draft tools <span class="jn-model-tag" id="ai-model"></span></h3>
            <pre class="jn-ai" id="ai">Pick a tool on the right. Assist runs LIVE when available; offline drafts fall back locally.</pre>
            <div class="jn-actions" style="margin-top:0.55rem">
              <button class="jn-btn sm ghost" id="copyai">Copy result</button>
              <button class="jn-btn sm ghost" id="askassist">Ask Assist</button>
            </div>
            <div class="jn-assist-pane" id="assist-pane" hidden>
              <textarea id="assist-q" placeholder="Ask Careers Assist about this role…"></textarea>
              <button class="jn-btn sm primary" id="assist-go">Send to Assist</button>
            </div>
          </div>
        </div>
        <aside>
          <div class="jn-panel">
            <h3>Job desk</h3>
            <p class="jn-muted" style="font-size:0.8rem;margin:0 0 0.55rem">Draft-only · Assist LIVE + local fallback</p>
            <div class="jn-tools">
              ${TOOLS.map(([k, label, sub]) => `<button class="jn-btn" data-tool="${k}">${esc(label)}<small>${esc(sub)}</small></button>`).join("")}
            </div>
          </div>
        </aside>
      </div>`;

    const out = document.getElementById("ai");
    const title = document.getElementById("ai-title");
    const modelEl = document.getElementById("ai-model");
    const localDraft = (kind) => {
      if (kind === "fit") return draftFit(job, profile).text;
      if (kind === "brief") return draftBrief(job);
      if (kind === "packet") return draftPacket(job, profile);
      if (kind === "outreach") return draftOutreach(job, profile);
      if (kind === "interview") return draftInterview(job);
      return "";
    };
    const promptFor = (kind) => {
      const base = `Role: ${job.title}\nCompany: ${job.company_name}\nLocation: ${job.location || ""}\nBoard: ${job.source || ""}\nWhy: ${job.why || ""}\nCandidate skills: ${profile.skills}\nHeadline: ${profile.title}\nSummary: ${profile.summary || ""}`;
      const asks = {
        fit: "Write a concise fit score note (score/100, matches, gaps) for this candidate vs role. Draft only.",
        brief: "Write a short role brief and human-gated apply checklist. Draft only.",
        packet: "Write an apply packet (candidate block, cover draft, fit notes, how-to-submit). Draft only — never imply auto-submit.",
        outreach: "Write a short outreach email (subject + body) the candidate will copy into Gmail themselves. Draft only — do not send.",
        interview: "Write 5 interview practice prompts tailored to this role. Draft only.",
      };
      return `${asks[kind] || "Help with this role."}\n\n${base}`;
    };
    const run = async (kind) => {
      const labels = { fit: "Fit score", brief: "Role brief", packet: "Apply packet", outreach: "Outreach email", interview: "Interview prep" };
      title.textContent = labels[kind] || kind;
      out.textContent = "Calling Assist…";
      modelEl.textContent = "";
      try {
        const { text, model } = await callAssist(promptFor(kind), "careers");
        out.textContent = text + "\n\n— Assist LIVE · model " + model + " · draft only";
        modelEl.textContent = "· " + model;
        if (kind === "packet") toast("Packet ready — copy & submit on employer site");
      } catch (err) {
        out.textContent = localDraft(kind) + "\n\n— offline draft (Assist unreachable)";
        modelEl.textContent = "· offline";
        toast("offline draft");
      }
    };

    document.getElementById("save").onclick = () => trackJob(job, "saved");
    document.getElementById("fillnow").onclick = () => run("packet");
    document.getElementById("todrop").onclick = () => {
      const vac = [job.title, job.company_name, job.location, job.why, job.url].filter(Boolean).join("\n");
      try { sessionStorage.setItem("mm.careers.drop.prefill", vac); } catch (_) {}
      location.hash = "#/feed"; // Drop removed from Careers
    };
    document.getElementById("applied").onclick = () => trackJob(job, "applied");
    document.getElementById("intelbtn").onclick = () =>
      (location.hash = `#/intel?title=${encodeURIComponent(job.title || "")}&company=${encodeURIComponent(job.company_name || "")}&id=${encodeURIComponent(job.id || "")}`);
    document.getElementById("copyai").onclick = () => copy(out.textContent);
    document.getElementById("askassist").onclick = () => {
      const pane = document.getElementById("assist-pane");
      pane.hidden = !pane.hidden;
    };
    document.getElementById("assist-go").onclick = async () => {
      const q = document.getElementById("assist-q").value.trim();
      if (!q) return;
      out.textContent = "Assist…";
      try {
        const msg = `Context: ${job.title} @ ${job.company_name}. Skills: ${profile.skills}.\n\nUser: ${q}`;
        const { text, model } = await callChat(msg);
        out.textContent = text + "\n\n— Assist chat · " + model;
        modelEl.textContent = "· " + model;
      } catch {
        out.textContent = "Assist chat unavailable. Try draft tools with offline fallback.";
        toast("offline draft");
      }
    };
    document.querySelectorAll("[data-tool]").forEach((b) => {
      b.addEventListener("click", () => run(b.dataset.tool));
    });
  }

  async function renderTracker(_params, token) {
    if (!alive(token)) return;
    const t = loadTracker();
    const items = Object.values(t).sort((a, b) => (b.updated || "").localeCompare(a.updated || ""));
    const count = (s) => items.filter((i) => i.stage === s).length;
    app.innerHTML = `
      <section class="jn-hero">
        <h1>Application tracker</h1>
        <p>Pipeline lives in this browser (localStorage). Export JSON any time. Draft-only — marking Applied is your record after you submit elsewhere.</p>
      </section>
      <div class="jn-stats">${STAGES.map((s) => `<div class="jn-stat"><b>${count(s)}</b><span>${STAGE_LABEL[s]}</span></div>`).join("")}</div>
      <div class="jn-actions" style="margin-bottom:0.75rem">
        <button class="jn-btn sm" id="export">Export JSON</button>
        <button class="jn-btn sm ghost" id="clear">Clear closed</button>
      </div>
      <div class="jn-kanban">${STAGES.map(
        (s) => `<div class="jn-col"><h3>${STAGE_LABEL[s]}</h3>${
          items
            .filter((i) => i.stage === s)
            .map(
              (i) => `<div class="jn-card">
            <strong>${esc(i.title)}</strong>
            <small>${esc(i.company)}${i.location ? ` · ${esc(i.location)}` : ""}${i.fit != null ? ` · fit ${i.fit}` : ""}</small>
            <div class="jn-actions">
              <button class="jn-btn sm ghost" data-open="${esc(i.id)}">Desk</button>
              ${i.url ? `<a class="jn-btn sm ghost" href="${esc(i.url)}" target="_blank" rel="noopener">Posting</a>` : ""}
              <button class="jn-btn sm ghost" data-del="${esc(i.id)}">✕</button>
            </div>
            <select data-stage="${esc(i.id)}">${STAGES.map((x) => `<option value="${x}" ${x === i.stage ? "selected" : ""}>${STAGE_LABEL[x]}</option>`).join("")}</select>
          </div>`
            )
            .join("") || `<p class="jn-muted" style="font-size:0.8rem">Empty</p>`
        }</div>`
      ).join("")}</div>`;

    document.getElementById("export").onclick = () => {
      const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
      const a = Object.assign(document.createElement("a"), {
        href: URL.createObjectURL(blob),
        download: "careers-applications.json",
      });
      a.click();
    };
    document.getElementById("clear").onclick = () => {
      const tr = loadTracker();
      Object.keys(tr).forEach((k) => tr[k].stage === "closed" && delete tr[k]);
      saveTracker(tr);
      renderTracker();
    };
  }

  async function renderProfile(_params, token) {
    if (!alive(token)) return;
    const p = loadProfile();
    app.innerHTML = `
      <section class="jn-hero">
        <h1>Profile</h1>
        <p>Stored locally in this browser. Auto_query seeds the Feed filter; skills drive fit/packet drafts.</p>
      </section>
      <form class="jn-panel" id="pf" style="max-width:720px">
        <div class="jn-field"><label>Full name</label><input name="name" value="${esc(p.name)}" /></div>
        <div class="jn-field"><label>Headline</label><input name="title" value="${esc(p.title)}" /></div>
        <div class="jn-field"><label>Email</label><input name="email" value="${esc(p.email)}" /></div>
        <div class="jn-field"><label>Location</label><input name="location" value="${esc(p.location)}" /></div>
        <div class="jn-field"><label>Summary</label><textarea name="summary">${esc(p.summary)}</textarea></div>
        <div class="jn-field"><label>Skills (comma-separated)</label><textarea name="skills">${esc(p.skills)}</textarea></div>
        <div class="jn-field"><label>Target keywords</label><textarea name="target_keywords">${esc(p.target_keywords)}</textarea></div>
        <div class="jn-field"><label>Auto query (Feed default filter)</label><input name="auto_query" value="${esc(p.auto_query)}" /></div>
        <div class="jn-actions">
          <button class="jn-btn primary" type="submit">Save profile</button>
          <span class="jn-muted" id="pstatus"></span>
        </div>
      </form>`;
    document.getElementById("pf").addEventListener("submit", (e) => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(e.target).entries());
      saveProfile({ ...DEFAULT_PROFILE, ...body });
      document.getElementById("pstatus").textContent = "Saved locally";
      toast("Profile saved");
    });
  }

  async function renderDrop(params, token) {
    if (!alive(token)) return;
    let prefill = "";
    try {
      prefill = sessionStorage.getItem("mm.careers.drop.prefill") || "";
      if (params.get("vacancy")) prefill = params.get("vacancy");
    } catch (_) {}

    let applyCfg = loadApplyMode();
    const modeBanner = (cfg) => {
      if (cfg.mode === "automatic") {
        return `<div class="jn-warn-banner jn-warn-auto" role="alert"><strong>Automatic mode:</strong> leads with fit ≥ ${cfg.threshold} are queued for the apply agent <em>without asking each time</em>. Live LinkedIn Easy Apply still needs the Lab/browser apply agent — this desk only queues + logs. Digests stay draft-first email.</div>`;
      }
      if (cfg.mode === "bulk") {
        const days = (cfg.bulk.days || []).map((d) => DOW_LABELS.find((x) => x.d === d)?.label || d).join(", ");
        return `<div class="jn-warn-banner jn-warn-auto" role="status"><strong>Bulk mode:</strong> scheduled scrape + auto-apply queue at <strong>${esc(cfg.bulk.time)}</strong> SAST on <strong>${esc(days || "—")}</strong> for fit ≥ ${cfg.threshold}. Parent creates/updates a routine from the Bulk schedule (see <code>dropnet-bulk-apply.prompt.txt</code>). Digests stay draft-first.</div>`;
      }
      return `<div class="jn-warn-banner" role="status">Manual mode (default) · draft-only / never auto-apply. Apply opens the employer page in a new tab. Daily digest is a Gmail <strong>draft</strong> to katlego.mokoto.km@gmail.com (weekday mornings ~08:17 SAST).</div>`;
    };

    const dayChecks = (cfg) =>
      DOW_LABELS.map(
        (x) =>
          `<label class="jn-dow"><input type="checkbox" data-dow="${x.d}" ${(cfg.bulk.days || []).includes(x.d) ? "checked" : ""}/> ${x.label}</label>`
      ).join("");

    const modePanelHtml = (cfg) => `
      <div class="jn-apply-mode" id="dn-apply-mode">
        <div class="jn-apply-mode-head">
          <strong>Apply mode</strong>
          <span class="jn-muted" style="font-size:0.75rem">Persists in this browser · key <code>mm.careers.dropnet.applyMode.v1</code></span>
        </div>
        <div class="jn-seg" role="radiogroup" aria-label="Apply mode">
          <label class="jn-seg-opt ${cfg.mode === "manual" ? "active" : ""}"><input type="radio" name="dn-mode" value="manual" ${cfg.mode === "manual" ? "checked" : ""}/> Manual</label>
          <label class="jn-seg-opt ${cfg.mode === "automatic" ? "active" : ""}"><input type="radio" name="dn-mode" value="automatic" ${cfg.mode === "automatic" ? "checked" : ""}/> Automatic</label>
          <label class="jn-seg-opt ${cfg.mode === "bulk" ? "active" : ""}"><input type="radio" name="dn-mode" value="bulk" ${cfg.mode === "bulk" ? "checked" : ""}/> Bulk</label>
        </div>
        <div class="jn-apply-mode-body" id="dn-mode-auto" style="${cfg.mode === "automatic" ? "" : "display:none"}">
          <div class="jn-field-inline">
            <label for="dn-threshold-auto">Fit threshold</label>
            <input type="range" id="dn-threshold-auto" min="50" max="100" step="1" value="${cfg.threshold}" />
            <input type="number" id="dn-threshold-auto-num" min="0" max="100" value="${cfg.threshold}" class="jn-thresh-num" />
          </div>
          ${
            cfg.autoConfirm
              ? `<p class="jn-muted" style="font-size:0.8rem;margin:0.35rem 0 0">Confirmed: Automatic will queue applies without asking each time.</p>`
              : `<label class="jn-confirm-gate"><input type="checkbox" id="dn-auto-confirm" /> I understand Automatic will apply without asking each time.</label>
                 <p class="jn-muted" style="font-size:0.78rem;margin:0.35rem 0 0">Enable is gated until you check the box. Nothing is queued until confirmed.</p>`
          }
        </div>
        <div class="jn-apply-mode-body" id="dn-mode-bulk" style="${cfg.mode === "bulk" ? "" : "display:none"}">
          <p class="jn-muted" style="font-size:0.8rem;margin:0 0 0.45rem">Bulk runs scrape then auto-applies at this time (Africa/Johannesburg).</p>
          <div class="jn-dow-row" id="dn-bulk-days">${dayChecks(cfg)}</div>
          <div class="jn-field-inline" style="margin-top:0.45rem">
            <label for="dn-bulk-time">Time (SAST)</label>
            <input type="time" id="dn-bulk-time" value="${esc(cfg.bulk.time || "08:17")}" />
            <label for="dn-threshold-bulk">Fit ≥</label>
            <input type="number" id="dn-threshold-bulk" min="0" max="100" value="${cfg.threshold}" class="jn-thresh-num" />
          </div>
          <p class="jn-muted" style="font-size:0.75rem;margin:0.4rem 0 0">Cron hint · <code id="dn-cron-hint">${esc(dowCronHint(cfg.bulk.days, cfg.bulk.time))}</code> · routine prompt <code>/workspace/jobnet/routines/dropnet-bulk-apply.prompt.txt</code></p>
          <div class="jn-actions" style="margin-top:0.5rem">
            <button type="button" class="jn-btn sm primary" id="dn-bulk-queue-now">Queue above-threshold now</button>
            <button type="button" class="jn-btn sm ghost" id="dn-export-queue">Export apply-queue.json</button>
          </div>
        </div>
        <div class="jn-apply-queue-status" id="dn-queue-status"></div>
      </div>`;

    app.innerHTML = `
      <section class="jn-hero">
        <h1>DropNet · AI Hawk</h1>
        <p>Operational job-lead desk for Mercatus Careers. Morning LI+GD scan → ranked leads → draft cover/CV packets. Apply mode below controls Manual drafts vs Automatic/Bulk queue for the apply agent.</p>
      </section>
      <div id="dn-mode-banner">${modeBanner(applyCfg)}</div>
      ${modePanelHtml(applyCfg)}
      <div class="jn-drop-status" id="dn-status-strip">Loading today’s leads…</div>
      <div id="dn-leads" class="jn-drop-leads"></div>
      <div class="jn-drop-grid">
        <div class="jn-panel">
          <h3>1 · Vacancy</h3>
          <p class="jn-muted" style="font-size:0.8rem;margin:0 0 0.55rem">Paste a vacancy, use a sample, or tap Draft packet on a lead above. Prefill from job desk still works.</p>
          <div class="jn-actions" style="margin-bottom:0.55rem">
            <button type="button" class="jn-btn sm" data-sample="dotnet">Sample · .NET</button>
            <button type="button" class="jn-btn sm" data-sample="frontend">Sample · frontend</button>
            <button type="button" class="jn-btn sm" data-sample="data">Sample · data</button>
          </div>
          <textarea id="dn-input" placeholder="Paste vacancy text…">${esc(prefill)}</textarea>
          <div class="jn-actions" style="margin-top:0.55rem">
            <button type="button" class="jn-btn primary" id="dn-generate">Generate draft</button>
            <button type="button" class="jn-btn ghost" id="dn-assist">Polish with Assist</button>
            <button type="button" class="jn-btn ghost" id="dn-clear">Clear</button>
          </div>
        </div>
        <div class="jn-panel">
          <h3>2 · Draft <span class="jn-model-tag" id="dn-signal"></span></h3>
          <pre class="jn-ai" id="dn-out" style="max-height:420px">No draft yet. Paste a vacancy, open Draft packet from a lead, or use Build Drop packet from a job desk.</pre>
          <div class="jn-actions" style="margin-top:0.55rem">
            <button type="button" class="jn-btn sm" id="dn-copy" disabled>Copy draft</button>
          </div>
        </div>
      </div>`;

    const input = document.getElementById("dn-input");
    const out = document.getElementById("dn-out");
    const signal = document.getElementById("dn-signal");
    const copyBtn = document.getElementById("dn-copy");
    const statusStrip = document.getElementById("dn-status-strip");
    const leadsEl = document.getElementById("dn-leads");
    let last = "";
    let lastDigest = null;

    const paintQueueStatus = () => {
      const el = document.getElementById("dn-queue-status");
      if (!el) return;
      const q = loadApplyQueue();
      const n = (q.items || []).length;
      const pending = (q.items || []).filter((x) => x.status === "queued_for_apply_agent").length;
      el.innerHTML = (n
        ? `<span class="pill demo">${n} in apply queue</span><span class="pill">${pending} queued for apply agent</span>`
        : `<span class="pill">Apply queue empty</span><span class="pill">Manual = no auto-queue</span>`) +
        `<button type="button" class="jn-btn sm ghost" id="dn-export-queue-any">Export apply-queue.json</button>`;
      el.querySelector("#dn-export-queue-any")?.addEventListener("click", () => {
        exportApplyQueueDownload();
        toast("Downloaded apply-queue.json");
      });
    };

    const syncModeUi = () => {
      applyCfg = loadApplyMode();
      const banner = document.getElementById("dn-mode-banner");
      if (banner) banner.innerHTML = modeBanner(applyCfg);
      document.querySelectorAll(".jn-seg-opt").forEach((lab) => {
        const inp = lab.querySelector('input[name="dn-mode"]');
        lab.classList.toggle("active", !!inp?.checked);
      });
      const autoBody = document.getElementById("dn-mode-auto");
      const bulkBody = document.getElementById("dn-mode-bulk");
      if (autoBody) autoBody.style.display = applyCfg.mode === "automatic" ? "" : "none";
      if (bulkBody) bulkBody.style.display = applyCfg.mode === "bulk" ? "" : "none";
      const cron = document.getElementById("dn-cron-hint");
      if (cron) cron.textContent = dowCronHint(applyCfg.bulk.days, applyCfg.bulk.time);
      paintQueueStatus();
    };

    const persistFromDom = () => {
      const mode = document.querySelector('input[name="dn-mode"]:checked')?.value || "manual";
      let threshold = applyCfg.threshold;
      if (mode === "automatic") {
        threshold = Number(document.getElementById("dn-threshold-auto-num")?.value ?? document.getElementById("dn-threshold-auto")?.value ?? 80);
      } else if (mode === "bulk") {
        threshold = Number(document.getElementById("dn-threshold-bulk")?.value ?? 80);
      }
      const days = [...document.querySelectorAll("#dn-bulk-days input[data-dow]:checked")].map((el) => Number(el.dataset.dow));
      const time = document.getElementById("dn-bulk-time")?.value || "08:17";
      let autoConfirm = applyCfg.autoConfirm;
      if (mode === "automatic" && !autoConfirm) {
        autoConfirm = !!document.getElementById("dn-auto-confirm")?.checked;
      }
      // Switching away from automatic does not clear autoConfirm once granted
      applyCfg = saveApplyMode({ mode, threshold, bulk: { days: days.length ? days : [1, 2, 3, 4, 5], time }, autoConfirm });
      syncModeUi();
      // Re-render confirm gate if just unlocked
      if (mode === "automatic" && autoConfirm) {
        const autoBody = document.getElementById("dn-mode-auto");
        if (autoBody && !autoBody.querySelector(".jn-confirm-done")) {
          const gate = autoBody.querySelector(".jn-confirm-gate");
          if (gate) {
            gate.outerHTML = `<p class="jn-muted jn-confirm-done" style="font-size:0.8rem;margin:0.35rem 0 0">Confirmed: Automatic will queue applies without asking each time.</p>`;
          }
        }
        maybeAutoQueue();
      }
      return applyCfg;
    };

    const maybeAutoQueue = () => {
      const cfg = loadApplyMode();
      if (cfg.mode !== "automatic" || !cfg.autoConfirm || !lastDigest?.roles?.length) return;
      const { added } = queueApplyJobs(lastDigest.roles, { threshold: cfg.threshold, reason: "automatic" });
      if (added.length) {
        toast(`Queued ${added.length} for apply agent (fit ≥ ${cfg.threshold})`);
        paintQueueStatus();
        paintLeads(lastDigest);
      }
    };

    const vacancyFromLead = (r) =>
      [r.title || "", r.company ? "— " + r.company : "", r.location || "", "", r.why || r.match_reason || "", "", r.apply_url || r.url || ""]
        .filter(Boolean)
        .join("\n");

    const queuedIds = () => new Set((loadApplyQueue().items || []).map((x) => String(x.id)));

    const renderLeadCard = (r) => {
      const fit = r.fit_score != null ? Number(r.fit_score) : signalFit(r.signal);
      const why = r.match_reason || r.why || "";
      const apply = r.apply_url || r.url || "";
      const open = r.url || apply;
      const board = r.board || r.source || "";
      const id = String(r.id || apply || open || "");
      const queued = queuedIds().has(id);
      const cfg = loadApplyMode();
      const above = fit != null && fit >= cfg.threshold;
      return `<article class="jn-drop-lead jn-card" data-id="${esc(r.id || "")}">
        <div class="jn-drop-lead-top">
          <strong>${esc(r.title || "Role")}</strong>
          <div class="jn-pills">
            ${fit != null ? `<span class="jn-pill ${fitClass(fit)}">fit ${fit}%</span>` : ""}
            ${r.signal ? `<span class="jn-pill ${esc(String(r.signal))}">${esc(r.signal)}</span>` : ""}
            ${board ? `<span class="jn-pill">${esc(board)}</span>` : ""}
            ${queued ? `<span class="jn-pill demo">queued for apply agent</span>` : ""}
            ${!queued && cfg.mode !== "manual" && above ? `<span class="jn-pill mid">≥ threshold</span>` : ""}
          </div>
        </div>
        <small>${esc(r.company || "")}${r.location ? " · " + esc(r.location) : ""}</small>
        ${why ? `<p class="jn-drop-why">${esc(why)}</p>` : ""}
        <div class="jn-actions">
          ${open ? `<a class="jn-btn sm ghost" href="${esc(open)}" target="_blank" rel="noopener">Open</a>` : ""}
          ${apply ? `<a class="jn-btn sm primary" href="${esc(apply)}" target="_blank" rel="noopener">Apply</a>` : ""}
          <button type="button" class="jn-btn sm" data-draft-lead>Draft packet</button>
          ${
            cfg.mode !== "manual" && !queued && above
              ? `<button type="button" class="jn-btn sm ghost" data-queue-lead>Queue apply</button>`
              : ""
          }
        </div>
      </article>`;
    };

    const paintLeads = (digest) => {
      if (!digest || !Array.isArray(digest.roles) || !digest.roles.length) {
        leadsEl.innerHTML = `<p class="jn-empty">No leads in <code>dropnet/latest.json</code> yet. The morning DropNet · AI Hawk routine will populate this desk.</p>`;
        statusStrip.innerHTML = `<span class="pill demo">No digest yet</span><span class="pill">Daily digest · draft email to katlego.mokoto.km@gmail.com</span><span class="pill">Mode · ${esc(loadApplyMode().mode)}</span>`;
        return;
      }
      const roles = [...digest.roles].sort((a, b) => (Number(b.fit_score) || 0) - (Number(a.fit_score) || 0));
      const groups = digest.groups || {};
      let top = Array.isArray(groups.top_matches) ? groups.top_matches : roles.filter((r) => Number(r.fit_score) >= 70);
      let also = Array.isArray(groups.also_worth_a_look) ? groups.also_worth_a_look : roles.filter((r) => Number(r.fit_score) < 70);
      if (!top.length && !also.length) {
        top = roles.filter((r) => Number(r.fit_score) >= 70);
        also = roles.filter((r) => Number(r.fit_score) < 70);
      }
      const scraped = digest.scraped_at || digest.generated_at || "";
      const when = scraped ? sast(scraped) : "—";
      const cfg = loadApplyMode();
      statusStrip.innerHTML = `
        <span class="pill live">Last scrape · ${esc(when)}</span>
        <span class="pill">${roles.length} leads · ${top.length} top · ${also.length} also</span>
        <span class="pill">Daily digest · draft email to katlego.mokoto.km@gmail.com</span>
        <span class="pill">Mode · ${esc(cfg.mode)}${cfg.mode !== "manual" ? " · fit ≥ " + cfg.threshold : ""}</span>
        <span class="pill">Quiet hours · weekday ~08:17 SAST</span>`;
      let html = "";
      if (top.length) {
        html += `<h3 class="jn-drop-group-title">Top matches</h3><div class="jn-drop-lead-grid">${top.map(renderLeadCard).join("")}</div>`;
      }
      if (also.length) {
        html += `<h3 class="jn-drop-group-title">Also worth a look</h3><div class="jn-drop-lead-grid">${also.map(renderLeadCard).join("")}</div>`;
      }
      leadsEl.innerHTML = html;
      leadsEl.querySelectorAll("[data-draft-lead]").forEach((btn) => {
        btn.onclick = () => {
          const card = btn.closest("[data-id]");
          const id = card?.dataset?.id;
          const role = roles.find((r) => String(r.id) === String(id)) || top.concat(also).find((r) => String(r.id) === String(id));
          if (!role) return;
          input.value = vacancyFromLead(role);
          document.getElementById("dn-generate").click();
          input.scrollIntoView({ behavior: "smooth", block: "center" });
        };
      });
      leadsEl.querySelectorAll("[data-queue-lead]").forEach((btn) => {
        btn.onclick = () => {
          const card = btn.closest("[data-id]");
          const id = card?.dataset?.id;
          const role = roles.find((r) => String(r.id) === String(id));
          if (!role) return;
          const c = loadApplyMode();
          if (c.mode === "automatic" && !c.autoConfirm) {
            toast("Confirm Automatic gate first");
            return;
          }
          const { added } = queueApplyJobs([role], { threshold: 0, reason: c.mode });
          toast(added.length ? "Queued for apply agent" : "Already queued");
          paintQueueStatus();
          paintLeads(digest);
        };
      });
    };

    // Mode controls
    document.querySelectorAll('input[name="dn-mode"]').forEach((inp) => {
      inp.addEventListener("change", () => {
        const next = inp.value;
        if (next === "automatic" && !loadApplyMode().autoConfirm) {
          // Switch UI to automatic but do not queue until confirm
          const cur = loadApplyMode();
          saveApplyMode({ ...cur, mode: "automatic" });
          syncModeUi();
          toast("Check the confirm box to enable Automatic queueing");
          return;
        }
        persistFromDom();
        if (lastDigest) paintLeads(lastDigest);
      });
    });
    const bindThresh = (rangeId, numId) => {
      const range = document.getElementById(rangeId);
      const num = document.getElementById(numId);
      if (range && num) {
        range.addEventListener("input", () => {
          num.value = range.value;
          persistFromDom();
          if (lastDigest) paintLeads(lastDigest);
        });
        num.addEventListener("change", () => {
          range.value = num.value;
          persistFromDom();
          if (lastDigest) paintLeads(lastDigest);
        });
      }
    };
    bindThresh("dn-threshold-auto", "dn-threshold-auto-num");
    document.getElementById("dn-threshold-bulk")?.addEventListener("change", () => {
      persistFromDom();
      if (lastDigest) paintLeads(lastDigest);
    });
    document.getElementById("dn-auto-confirm")?.addEventListener("change", (e) => {
      if (e.target.checked) {
        persistFromDom();
        toast("Automatic enabled — above-threshold leads will queue");
      }
    });
    document.querySelectorAll("#dn-bulk-days input[data-dow]").forEach((el) => {
      el.addEventListener("change", () => persistFromDom());
    });
    document.getElementById("dn-bulk-time")?.addEventListener("change", () => persistFromDom());
    document.getElementById("dn-bulk-queue-now")?.addEventListener("click", () => {
      if (!lastDigest?.roles?.length) {
        toast("No leads to queue yet");
        return;
      }
      const cfg = persistFromDom();
      const { added } = queueApplyJobs(lastDigest.roles, { threshold: cfg.threshold, reason: "bulk" });
      toast(added.length ? `Bulk-queued ${added.length} for apply agent` : "Nothing new above threshold");
      paintQueueStatus();
      paintLeads(lastDigest);
    });
    document.getElementById("dn-export-queue")?.addEventListener("click", () => {
      exportApplyQueueDownload();
      toast("Downloaded apply-queue.json");
    });
    // Also export button when not in bulk — add via queue status click? Manual/auto get export in status
    paintQueueStatus();

    try {
      const res = await fetch("./dropnet/latest.json", { cache: "no-store" });
      if (!alive(token)) return;
      if (!res.ok) throw new Error("latest " + res.status);
      const digest = await res.json();
      lastDigest = digest;
      paintLeads(digest);
      maybeAutoQueue();
    } catch {
      if (!alive(token)) return;
      leadsEl.innerHTML = `<p class="jn-empty">Could not load <code>./dropnet/latest.json</code>. Empty desk until the daily DropNet · AI Hawk run writes it.</p>`;
      statusStrip.innerHTML = `<span class="pill down">latest.json missing</span><span class="pill">Daily digest · draft email to katlego.mokoto.km@gmail.com</span><span class="pill">Mode · ${esc(loadApplyMode().mode)}</span>`;
    }

    document.querySelectorAll("[data-sample]").forEach((b) => {
      b.onclick = () => {
        input.value = DROP_SAMPLES[b.dataset.sample] || "";
      };
    });
    document.getElementById("dn-generate").onclick = () => {
      const text = input.value.trim();
      if (text.length < 40) {
        toast("Paste a longer vacancy first");
        return;
      }
      const r = dropGenerate(text);
      last = r.text;
      out.textContent = r.text;
      signal.textContent = "· signal " + r.signal + " · template";
      copyBtn.disabled = false;
    };
    document.getElementById("dn-assist").onclick = async () => {
      const text = input.value.trim();
      if (text.length < 40) {
        toast("Paste a vacancy first");
        return;
      }
      out.textContent = "Assist polishing…";
      try {
        const { text: t, model } = await callAssist(
          "Turn this vacancy into a draft cover note + CV synopsis. Use only public portfolio evidence; leave [placeholders] for unverified claims. Draft only.\n\n" + text,
          "careers"
        );
        last = t;
        out.textContent = t + "\n\n— Assist LIVE · " + model;
        signal.textContent = "· " + model;
        copyBtn.disabled = false;
      } catch {
        const r = dropGenerate(text);
        last = r.text;
        out.textContent = r.text + "\n\n— offline draft";
        signal.textContent = "· offline";
        copyBtn.disabled = false;
        toast("offline draft");
      }
    };
    document.getElementById("dn-clear").onclick = () => {
      input.value = "";
      out.textContent = "No draft yet.";
      signal.textContent = "";
      last = "";
      copyBtn.disabled = true;
      try { sessionStorage.removeItem("mm.careers.drop.prefill"); } catch (_) {}
    };
    copyBtn.onclick = () => copy(last || out.textContent);
    if (prefill.length >= 40) {
      document.getElementById("dn-generate").click();
    }
  }

  async function renderBulk(_params, token) {
    if (!alive(token)) return;
    if (!lastListings.length) {
      try { await fetchListings(); } catch { loadCached(); }
    }
    if (!alive(token)) return;
    const allowed = new Set(["linkedin", "glassdoor", "pnet", "careers24"]);
    const targets = lastListings.filter((p) => allowed.has(p.source || "linkedin"));
    const bulk = loadBulk();
    app.innerHTML = `
      <section class="jn-hero">
        <h1>Bulk Apply · draft queue</h1>
        <p>Queues Assist-tailored packets for LI + GD + SA boards. <strong>Never</strong> submits on LinkedIn/Glassdoor/ATS and never sends Gmail. You review each draft, then apply on the employer site.</p>
      </section>
      <div class="jn-warn-banner">
        LIVE submit / send is <strong>blocked</strong> until you explicitly approve. This desk only builds DRAFT packets.
        Shortlist in memory: ${targets.length} · queued drafts: ${bulk.items.length}.
      </div>
      <div class="jn-actions" style="margin-bottom:0.85rem">
        <button class="jn-btn primary" id="bulk-run">Queue draft packets (Assist)</button>
        <button class="jn-btn ghost" id="bulk-local">Queue offline drafts</button>
        <button class="jn-btn ghost" id="bulk-export">Export queue JSON</button>
        <button class="jn-btn ghost" id="bulk-clear">Clear queue</button>
      </div>
      <p class="jn-meta" id="bulk-meta">Ready · ${targets.length} roles from LI/GD/SA filters</p>
      <div id="bulk-list"></div>`;

    const list = document.getElementById("bulk-list");
    const meta = document.getElementById("bulk-meta");
    const paint = () => {
      const b = loadBulk();
      if (!b.items.length) {
        list.innerHTML = `<p class="jn-empty">No drafts queued yet. Tap Queue draft packets.</p>`;
        return;
      }
      list.innerHTML = b.items
        .map(
          (it) => `<article class="jn-bulk-card">
          <div class="jn-line">
            <strong>${esc(it.title)}</strong>
            <span class="jn-pill">${esc(it.company)}</span>
            <span class="jn-pill ${it.mode === "assist" ? "ok" : "mid"}">${esc(it.mode || "draft")}</span>
            ${it.model ? `<span class="jn-pill">${esc(it.model)}</span>` : ""}
            <span class="jn-pill demo">needs approval before LIVE apply</span>
          </div>
          <p class="jn-muted" style="font-size:0.8rem;margin:0.25rem 0">${esc(it.source)} · ${esc(it.location || "")}</p>
          <div class="jn-actions">
            ${it.url ? `<a class="jn-btn sm" href="${esc(it.url)}" target="_blank" rel="noopener">Open posting ↗</a>` : ""}
            <button class="jn-btn sm ghost" data-copy="${esc(it.id)}">Copy packet</button>
            <button class="jn-btn sm ghost" data-desk="${esc(it.jobId || it.id)}">Open desk</button>
          </div>
          <pre class="jn-ai">${esc((it.packet || "").slice(0, 1200))}${(it.packet || "").length > 1200 ? "…" : ""}</pre>
        </article>`
        )
        .join("");
      list.querySelectorAll("[data-copy]").forEach((btn) => {
        btn.onclick = () => {
          const it = loadBulk().items.find((x) => x.id === btn.dataset.copy);
          if (it) copy(it.packet || "");
        };
      });
      list.querySelectorAll("[data-desk]").forEach((btn) => {
        btn.onclick = () => (location.hash = `#/job?id=${encodeURIComponent(btn.dataset.desk)}`);
      });
    };
    paint();

    const queueOne = async (job, useAssist) => {
      const profile = loadProfile();
      let packet = draftPacket(job, profile);
      let mode = "offline";
      let model = "";
      if (useAssist) {
        try {
          const prompt = `Write a concise apply packet (cover + fit notes + how-to-submit checklist) for:\nRole: ${job.title}\nCompany: ${job.company_name}\nLocation: ${job.location || ""}\nWhy: ${job.why || ""}\nSkills: ${profile.skills}\nDraft only — candidate will submit on employer site.`;
          const r = await callAssist(prompt, "careers");
          packet = r.text;
          mode = "assist";
          model = r.model;
        } catch (_) {
          mode = "offline";
        }
      }
      return {
        id: "bulk-" + (job.id || Math.random().toString(36).slice(2)),
        jobId: job.id,
        title: job.title,
        company: job.company_name,
        location: job.location,
        source: job.source,
        url: job.url || job.apply_url || "",
        packet,
        mode,
        model,
        signal: job.signal,
        status: "draft_queued",
        needsApprovalForLive: true,
        updated: new Date().toISOString(),
      };
    };

    const runQueue = async (useAssist) => {
      const profile = loadProfile();
      void profile;
      meta.textContent = useAssist ? "Calling Assist for each role…" : "Building offline drafts…";
      const items = [];
      // Prefer high/medium; include all LI/GD/SA present
      const ordered = targets.slice().sort((a, b) => {
        const rank = { high: 0, medium: 1, low: 2 };
        return (rank[a.signal] ?? 3) - (rank[b.signal] ?? 3);
      });
      for (let i = 0; i < ordered.length; i++) {
        meta.textContent = `Drafting ${i + 1}/${ordered.length}: ${ordered[i].title}`;
        items.push(await queueOne(ordered[i], useAssist));
      }
      saveBulk({ items, builtAt: new Date().toISOString(), policy: "draft_only" });
      meta.textContent = `Queued ${items.length} DRAFT packets · 0 live submits · all need your approval before any employer apply`;
      toast(`Queued ${items.length} drafts`);
      paint();
    };

    // Prefill from on-disk tailor inbox if browser queue empty
    if (!loadBulk().items.length) {
      fetch("./bulk-apply/manifest.json", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then(async (man) => {
          if (!man || !man.items || !man.items.length) return;
          const items = [];
          for (const row of man.items) {
            const id = (row.jobId || row.id || "").replace(/^bulk-/, "");
            let packet = "";
            try {
              const detail = await fetch("./bulk-apply/" + id + ".json", { cache: "no-store" }).then((x) => x.json());
              packet = detail.packet || "";
            } catch (_) {}
            items.push({
              id: row.id || ("bulk-" + id),
              jobId: row.jobId || id,
              title: row.title,
              company: row.company,
              location: row.location || "",
              source: row.source,
              url: row.url || "",
              packet: packet || "(open Export / re-queue to refresh full packet text)",
              mode: row.mode || "assist",
              model: row.model || "",
              signal: row.signal,
              status: "draft_queued",
              needsApprovalForLive: true,
              updated: man.builtAt || new Date().toISOString(),
            });
          }
          saveBulk({ items, builtAt: man.builtAt, policy: "draft_only", importedFrom: "bulk-apply/manifest.json" });
          meta.textContent = `Imported ${items.length} DRAFT packets from tailor inbox · 0 live submits · approval required before Apply/Send`;
          paint();
        })
        .catch(() => {});
    }

    document.getElementById("bulk-run").onclick = () => runQueue(true);
    document.getElementById("bulk-local").onclick = () => runQueue(false);
    document.getElementById("bulk-export").onclick = () => {
      const blob = new Blob([JSON.stringify(loadBulk(), null, 2)], { type: "application/json" });
      const a = Object.assign(document.createElement("a"), {
        href: URL.createObjectURL(blob),
        download: "careers-bulk-drafts.json",
      });
      a.click();
    };
    document.getElementById("bulk-clear").onclick = () => {
      saveBulk({ items: [] });
      paint();
      meta.textContent = "Queue cleared";
    };
  }

  const routes = {
    "/feed": renderFeed,
    "/boards": renderBoards,
    // "/drop": renderDrop, // Drop removed from Careers shell
    "/bulk": renderBulk,
    "/intel": renderIntel,
    "/job": renderJob,
    "/tracker": renderTracker,
    "/profile": renderProfile,
  };

  function route() {
    const token = ++routeGen;
    const hash = location.hash || "#/feed";
    const [path, qs] = hash.slice(1).split("?");
    const params = new URLSearchParams(qs || "");
    document.querySelectorAll("#tabs button").forEach((b) =>
      b.classList.toggle(
        "active",
        b.dataset.nav === `#${path}` ||
          (path === "/job" && b.dataset.nav === "#/feed") ||
          (path === "/bulk" && b.dataset.nav === "#/bulk")
      )
    );
    moveInk();
    const run = () =>
      (routes[path] || renderFeed)(params, token)
        .then(() => {
          if (alive(token)) stageIn();
        })
        .catch((err) => {
          if (!alive(token)) return;
          app.innerHTML = `<div class="jn-panel"><h2>Something broke</h2><pre class="jn-ai">${esc(String(err))}</pre></div>`;
        });
    run();
  }

  document.getElementById("tabs").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-nav]");
    if (b) location.hash = b.dataset.nav;
  });
  window.addEventListener("hashchange", route);
  window.addEventListener("resize", moveInk);

  app.addEventListener("change", (e) => {
    const sel = e.target.closest("select[data-stage]");
    if (!sel) return;
    const tr = loadTracker();
    if (tr[sel.dataset.stage]) {
      tr[sel.dataset.stage].stage = sel.value;
      tr[sel.dataset.stage].updated = new Date().toISOString();
      saveTracker(tr);
      renderTracker();
    }
  });
  app.addEventListener("click", (e) => {
    const del = e.target.closest("[data-del]");
    const open = e.target.closest("[data-open]");
    if (del) {
      const tr = loadTracker();
      delete tr[del.dataset.del];
      saveTracker(tr);
      renderTracker();
    }
    if (open) {
      const tr = loadTracker();
      if (tr[open.dataset.open]?.job) jobCache.set(open.dataset.open, tr[open.dataset.open].job);
      location.hash = `#/job?id=${encodeURIComponent(open.dataset.open)}`;
    }
  });

  /* boot: migrate keys, dual health, cache, route */
  migrateLegacyKeys();
  loadCached();
  fetchHealth()
    .then((h) => {
      const run = h.latest_run || {};
      const when = run.scraped_at ? sast(run.scraped_at) : "—";
      if (statusEl)
        statusEl.textContent = `LIVE shortlist · draft-only · scrape ${when} · ${run.counts?.shortlist ?? "?"} roles`;
      setStatusPills({
        jobnet: { ok: true, label: `JobNet LIVE · ${run.counts?.shortlist ?? "?"} shortlisted` },
      });
    })
    .catch(() => {
      if (statusEl) statusEl.textContent = "JobNet unreachable · cache/demo · draft-only";
      setStatusPills({ jobnet: { ok: false, label: "JobNet down" } });
    });
  fetch(HEALTH_URL, { cache: "no-store" })
    .then((r) => r.json())
    .then((h) => {
      const ok = !!h.llmConfigured;
      setStatusPills({
        assist: {
          ok,
          label: ok ? `Assist LIVE · ${h.llmModel || "llm"}` : "Assist · llm off",
        },
      });
    })
    .catch(() => setStatusPills({ assist: { ok: false, label: "Assist down" } }));

  if (!location.hash || location.hash === "#" || location.hash === "#/") location.hash = "#/feed";
  else route();
  requestAnimationFrame(moveInk);
})();
