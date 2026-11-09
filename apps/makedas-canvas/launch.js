/* Launch Path — Blueprint-native venture coach (patterns adapted; not a clone) */
(function () {
  "use strict";
  const LS = {
    path: "mc-launch-path",
    vault: "mc-idea-vault",
    radar: "mc-capability-radar",
    usTrack: "mc-us-foundation",
    usOn: "mc-us-track-on",
    deployPath: "mc-deploy-path",
    bizDeploy: "mc-business-deploy",
    handoff: "mc-ownership-handoff",
    drafts: "mc-launch-drafts"
  };

  const STAGES = [
    { id: 1, key: "direction", name: "Founder Direction", pass: 60,
      learn: "Name the problem, who hurts, and why you care enough to ship. Vague vibes fail here.",
      dims: ["customer", "offer", "execution"] },
    { id: 2, key: "discovery", name: "Customer Discovery", pass: 70,
      learn: "Talk to buyers before you build. Capture who, what they tried, and why it failed.",
      dims: ["customer", "evidence"] },
    { id: 3, key: "offer", name: "Offer Design", pass: 70,
      learn: "Package a clear promise, price signal, and delivery shape. Soft offers hide weak demand.",
      dims: ["offer", "commercial", "customer"] },
    { id: 4, key: "mvp", name: "MVP Build", pass: 70,
      learn: "Ship the smallest thing that proves the offer. Scope creep is a fail.",
      dims: ["execution", "evidence"] },
    { id: 5, key: "messaging", name: "Messaging & Demand", pass: 70,
      learn: "One sharp hook, one channel, one CTA. Noise without response is not demand.",
      dims: ["offer", "customer", "commercial"] },
    { id: 6, key: "sales", name: "Sales Readiness", pass: 70,
      learn: "Script the conversation: qualify, objection, close. Hope is not a pipeline.",
      dims: ["commercial", "execution", "customer"] },
    { id: 7, key: "launch", name: "Launch Readiness", pass: 70,
      learn: "Checklist the go-live: asset, channel, metric, rollback. Launch is an event with owners.",
      dims: ["execution", "evidence", "commercial"] }
  ];

  const DIMS = ["Customer", "Offer", "Commercial", "Evidence", "Execution"];
  const DIM_KEYS = ["customer", "offer", "commercial", "evidence", "execution"];

  const US_ITEMS = [
    { id: "llc", title: "Business LLC", note: "Pick formation state and registered agent before you chase banking." },
    { id: "ein", title: "EIN", note: "Get the IRS number once the entity exists — banks and processors will ask." },
    { id: "itin", title: "ITIN strategy", note: "Decide if you need a personal tax ID for banking or credit before you apply blind." },
    { id: "banking", title: "Business banking", note: "Open a US business account only after EIN + entity docs are clean." },
    { id: "processors", title: "Payment processors", note: "Stripe/PayPal expect a real entity and bank — not a personal workaround forever." },
    { id: "bizcredit", title: "Business credit", note: "Separate trade lines from personal credit so one bad month does not torch both." },
    { id: "perscredit", title: "Personal credit", note: "Some underwriters still look at you — know the score before you pitch." },
    { id: "compliance", title: "Compliance", note: "Tax filing, BOI/reporting, and state renewals are boring until they block a deal." },
    { id: "growth", title: "Growth roadmap", note: "Once rails work, map hire / raise / expand — not before the foundation holds." }
  ];

  const ALONGSIDE = ["ITIN", "Banking", "Credit", "Compliance", "Bookkeeping", "Consulting"];

  const DEPLOY_STEPS = [
    { id: "define", label: "Define" },
    { id: "scope", label: "Scope" },
    { id: "build", label: "Build" },
    { id: "launch", label: "Launch" }
  ];

  const BUSINESS_PILLARS = [
    { id: "brand", title: "Brand & Positioning",
      items: [
        { id: "offer", label: "Clear offer one-liner" },
        { id: "messaging", label: "Core messaging locked" },
        { id: "identity", label: "Digital identity (mark, colors, voice)" }
      ]},
    { id: "presence", title: "Digital Presence",
      items: [
        { id: "website", label: "Website live or staged" },
        { id: "domain", label: "Domain pointed" },
        { id: "email", label: "Business email live" },
        { id: "google", label: "Google / maps presence" }
      ]},
    { id: "revenue", title: "Revenue Infrastructure",
      items: [
        { id: "leads", label: "Lead capture live" },
        { id: "payments", label: "Payments path ready" },
        { id: "crm", label: "CRM / pipeline stub" },
        { id: "intake", label: "Client intake flow" }
      ]},
    { id: "ops", title: "Operations",
      items: [
        { id: "automation", label: "Key automation named" },
        { id: "ai", label: "AI workflow (optional)" },
        { id: "analytics", label: "Analytics wired" },
        { id: "docs", label: "Ops docs / runbook" }
      ]}
  ];

  const HANDOFF_ITEMS = [
    { id: "domain", label: "Domain ownership transferred / credentials shared" },
    { id: "website", label: "Website admin access handed over" },
    { id: "accounts", label: "Accounts list (email, hosting, tools) delivered" },
    { id: "customer", label: "Customer data export / access documented" },
    { id: "note", label: "Clean handoff note written" }
  ];

  const CRED_PILLARS = [
    "Look established",
    "Generate opportunities",
    "Get found",
    "Own your infrastructure"
  ];


  const CROSS = {
    3: { label: "Seed Ops sheet + Founders waitlist", action: "seedOffer" },
    4: { label: "Open Concierge + Paint", action: "openMvp" },
    5: { label: "Open Marketers Role Kit", action: "openMessaging" },
    6: { label: "Open Client Portal (demo client)", action: "openSales" },
    7: { label: "Bolt Slides present + publish checklist", action: "openLaunch" }
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function loadPath() {
    try {
      const d = JSON.parse(localStorage.getItem(LS.path) || "null");
      if (d && d.stages) return d;
    } catch (_) {}
    const stages = {};
    STAGES.forEach(s => { stages[s.id] = { best: 0, attempts: 0, last: null, unlocked: s.id === 1 }; });
    return { active: 1, stages, coachOn: true };
  }

  function savePath(d) { localStorage.setItem(LS.path, JSON.stringify(d)); }
  function loadDrafts() { try { return JSON.parse(localStorage.getItem(LS.drafts) || "{}") || {}; } catch (_) { return {}; } }
  function saveDraft(stageId, text) { const d = loadDrafts(); d[stageId] = String(text || "").slice(0, 2000); try { localStorage.setItem(LS.drafts, JSON.stringify(d)); } catch (_) {} }

  function loadVault() {
    try { return JSON.parse(localStorage.getItem(LS.vault) || "[]"); } catch (_) { return []; }
  }
  function saveVault(v) { localStorage.setItem(LS.vault, JSON.stringify(v)); }

  function loadRadar() {
    try {
      const d = JSON.parse(localStorage.getItem(LS.radar) || "null");
      if (d && typeof d.customer === "number") return d;
    } catch (_) {}
    return { customer: 20, offer: 20, commercial: 20, evidence: 20, execution: 20 };
  }
  function saveRadar(r) { localStorage.setItem(LS.radar, JSON.stringify(r)); }

  function loadUs() {
    try {
      const d = JSON.parse(localStorage.getItem(LS.usTrack) || "null");
      if (d && d.checks) return d;
    } catch (_) {}
    const checks = {};
    US_ITEMS.forEach(i => { checks[i.id] = false; });
    return { checks };
  }
  function saveUs(d) { localStorage.setItem(LS.usTrack, JSON.stringify(d)); }

  function loadDeployStep() {
    try { return localStorage.getItem(LS.deployPath) || "define"; } catch (_) { return "define"; }
  }
  function saveDeployStep(id) {
    localStorage.setItem(LS.deployPath, id);
    window.MCDB?.setSync?.(LS.deployPath, id);
  }
  function loadBiz() {
    try {
      const d = JSON.parse(localStorage.getItem(LS.bizDeploy) || "null");
      if (d && d.checks) return d;
    } catch (_) {}
    const checks = {};
    BUSINESS_PILLARS.forEach(p => p.items.forEach(i => { checks[p.id + "." + i.id] = false; }));
    return { checks };
  }
  function saveBiz(d) {
    localStorage.setItem(LS.bizDeploy, JSON.stringify(d));
    window.MCDB?.setSync?.(LS.bizDeploy, d);
  }
  function loadHandoff() {
    try {
      const d = JSON.parse(localStorage.getItem(LS.handoff) || "null");
      if (d && d.checks) return d;
    } catch (_) {}
    const checks = {};
    HANDOFF_ITEMS.forEach(i => { checks[i.id] = false; });
    return { checks, note: "" };
  }
  function saveHandoff(d) {
    localStorage.setItem(LS.handoff, JSON.stringify(d));
    window.MCDB?.setSync?.(LS.handoff, d);
  }

  function usOn() { return localStorage.getItem(LS.usOn) === "1"; }
  function setUsOn(on) { localStorage.setItem(LS.usOn, on ? "1" : "0"); }

  /** Heuristic rubric — keyword + structure, honest coach tone */
  function evaluate(stageId, text) {
    const stage = STAGES.find(s => s.id === stageId) || STAGES[0];
    const raw = String(text || "").trim();
    const t = raw.toLowerCase();
    const words = raw.split(/\s+/).filter(Boolean);
    const sentences = raw.split(/[.!?]+/).filter(s => s.trim().length > 8);

    const strengths = [];
    const strengthen = [];
    let score = 18;

    // Structure
    if (words.length >= 40) { score += 12; strengths.push("Enough substance to judge — not a one-liner."); }
    else if (words.length >= 18) { score += 6; }
    else { strengthen.push("Expand the asset: aim for concrete detail, not a slogan."); }

    if (sentences.length >= 3) { score += 8; strengths.push("Multi-sentence structure shows thought."); }
    else { strengthen.push("Break into clear sentences: who, what, proof, ask."); }

    // Clarity / direction
    const clarity = /(problem|because|so that|goal|mission|why|focus)/.test(t);
    if (clarity) { score += 8; strengths.push("Direction language present (problem / why / focus)."); }
    else if (stageId === 1) strengthen.push("State the problem and why you are the one to solve it.");

    // Customer
    const BN = (window.MCBuilder && window.MCBuilder.BUYER_NOUNS) || "owners?|managers?|teams?|businesses|customers?|clients?|users?";
    const customer = /(customer|buyer|user|persona|segment|who buys|audience|founder|sme|enterprise|b2b|b2c|target market|niche)/.test(t)
      || new RegExp("\\b(for|helps?|serving|serve|sell(?:ing)? to|aimed at|targets?|targeting)\\s+(?:the\\s+|our\\s+)?(?:[a-z-]+\\s){0,4}(" + BN + ")\\b").test(t)
      || new RegExp("\\b(" + BN + ")\\s+(?:who|that|in|at)\\b").test(t);
    if (customer) { score += 10; strengths.push("Buyer / audience named."); }
    else strengthen.push("Name a specific buyer — role, context, or segment.");

    // Evidence
    const evidence = /(interview|survey|metric|data|tested|validated|spoke to|n=|%\s|revenue|signups?|waitlist)/.test(t);
    if (evidence) { score += 12; strengths.push("Evidence or signal called out."); }
    else strengthen.push("Add one piece of evidence (conversation, metric, or test).");

    // Commercial
    const commercial = /(price|pricing|\$|r\d|mrr|arr|margin|pay|invoice|deal|close|pipeline)/.test(t);
    if (commercial) { score += 10; strengths.push("Commercial angle present."); }
    else if (stageId >= 3) strengthen.push("Include price, deal shape, or revenue path.");

    // Execution
    const execution = /(mvp|ship|build|launch|channel|cta|script|checklist|timeline|week|sprint|owner)/.test(t);
    if (execution) { score += 10; strengths.push("Execution next-step language."); }
    else strengthen.push("Name the next shippable action with an owner or timeline.");

    // Stage-specific bonuses
    if (stageId === 2 && /(pain|workaround|alternative|competitor)/.test(t)) { score += 6; strengths.push("Discovery depth: pain / workaround."); }
    if (stageId === 3 && /(promise|deliver|package|offer)/.test(t)) { score += 6; strengths.push("Offer packaging language."); }
    if (stageId === 5 && /(hook|headline|utm|landing|ads?)/.test(t)) { score += 6; strengths.push("Messaging channel cues."); }
    if (stageId === 6 && /(objection|qualify|demo|proposal)/.test(t)) { score += 6; strengths.push("Sales conversation cues."); }
    if (stageId === 7 && /(go-live|rollback|metric|owner|checklist)/.test(t)) { score += 6; strengths.push("Launch ops cues."); }

    // Cap / floor
    score = Math.max(12, Math.min(96, score));
    if (strengthen.length > 3) strengthen.length = 3;
    if (strengths.length > 3) strengths.length = 3;
    if (!strengths.length) strengths.push("You showed up with text — that is the bar to beat.");
    if (!strengthen.length) strengthen.push("Tighten specificity: numbers, names, deadlines.");

    const passed = score >= stage.pass;
    const nextStep = passed
      ? (stageId < 7
        ? `Pass. Unlock stage ${stageId + 1} (${STAGES[stageId].name}) and submit the next venture asset.`
        : "Pass. Run the publish checklist and present the deck — Launch Path complete for this venture.")
      : `Fail (${score}/${stage.pass} needed). Fix: ${strengthen[0]} Then re-submit.`;

    return { score, pass: stage.pass, passed, strengths, strengthen, nextStep, stageId, dims: stage.dims };
  }

  function applyRadar(result) {
    const r = loadRadar();
    const bump = result.passed ? 8 : 3;
    const frac = result.score / 100;
    (result.dims || []).forEach(k => {
      if (r[k] != null) r[k] = Math.min(100, Math.round(r[k] * 0.85 + (frac * 100) * 0.15 + bump));
    });
    saveRadar(r);
    return r;
  }

  function firstLook(idea) {
    const raw = String(idea || "").trim();
    if (!raw) return { line: "", score: 0, note: "Paste a rough idea first." };
    const t = raw.replace(/\s+/g, " ");
    // Sharpen: lead with verb/for, trim fluff
    let line = t, missing = [];
    if (window.MCBuilder) { const sh = window.MCBuilder.sharpen(t); line = sh.line || t; missing = sh.missing || []; }
    if (line.length > 160) line = line.slice(0, 157) + "…";
    // Mock preview score
    const preview = evaluate(1, t);
    const score = Math.min(72, Math.round(preview.score * 0.7 + (t.length > 40 ? 8 : 0)));
    return {
      line,
      score,
      missing,
      note: missing.length ? missing.join(" ") : "Clear: buyer, offer and outcome are all there. Add proof before you submit Stage 1."
    };
  }

  function pokeHoles(idea) {
    const title = (idea && idea.title) || "this idea";
    return [
      `Who already tried ${title} and quit — and why would they try again with you?`,
      `If the buyer said no tomorrow, what single assumption breaks first?`,
      `What is the smallest paid test that proves ${title} is worth chasing vs parking?`
    ];
  }

  function formatCoachHtml(result, title) {
    const badge = result.passed
      ? `<span class="lp-badge lp-badge--pass">PASS ${result.score}/100</span>`
      : `<span class="lp-badge lp-badge--fail">FAIL ${result.score}/100 · need ${result.pass}</span>`;
    const meter = `<div class="lp-score-row">
        <div class="lp-score-big" aria-hidden="true"><span>${result.score}</span><small>/100</small></div>
        <div class="lp-score-meta">${title ? `<p class="lp-score-title">${esc(title)}</p>` : ""}${badge}
          <div class="lp-meter" role="img" aria-label="Score ${result.score} out of 100. Pass mark ${result.pass}."><i style="width:${result.score}%"></i><b style="left:${result.pass}%" title="Pass mark ${result.pass}"></b></div>
          <p class="lp-meter-legend">Pass mark ${result.pass}/100 · ${result.passed ? "passed" : (result.pass - result.score) + " points to go"}</p>
        </div>
      </div>`;
    return `<div class="lp-coach-card ${result.passed ? "is-pass" : "is-fail"}">${meter}
      <p class="lp-coach-label">Strengths</p><ul>${result.strengths.map(s => `<li>${esc(s)}</li>`).join("")}</ul>
      <p class="lp-coach-label">Strengthen</p><ul>${result.strengthen.map(s => `<li>${esc(s)}</li>`).join("")}</ul>
      <p class="lp-next"><strong>Next:</strong> ${esc(result.nextStep)}</p></div>`;
  }

  function coachReply(text, path) {
    const stageId = (path && path.active) || 1;
    const result = evaluate(stageId, text);
    return formatCoachHtml(result) + `<p class="panel-copy small">Coach mode · local heuristic · Stage ${stageId}. Submit in Launch Path to persist scores.</p>`;
  }

  function radarSvg(r) {
    const cx = 90, cy = 90, maxR = 70;
    const n = DIM_KEYS.length;
    const pts = DIM_KEYS.map((k, i) => {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const v = Math.max(0, Math.min(100, r[k] || 0)) / 100;
      return [cx + Math.cos(ang) * maxR * v, cy + Math.sin(ang) * maxR * v];
    });
    const poly = pts.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
    const grid = [0.25, 0.5, 0.75, 1].map(f => {
      const ring = DIM_KEYS.map((_, i) => {
        const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        return (cx + Math.cos(ang) * maxR * f).toFixed(1) + "," + (cy + Math.sin(ang) * maxR * f).toFixed(1);
      }).join(" ");
      return `<polygon points="${ring}" fill="none" stroke="currentColor" opacity=".15"/>`;
    }).join("");
    const spokes = DIM_KEYS.map((_, i) => {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      return `<line x1="${cx}" y1="${cy}" x2="${(cx + Math.cos(ang) * maxR).toFixed(1)}" y2="${(cy + Math.sin(ang) * maxR).toFixed(1)}" stroke="currentColor" opacity=".2"/>`;
    }).join("");
    const labels = DIM_KEYS.map((k, i) => {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const lx = cx + Math.cos(ang) * (maxR + 14);
      const ly = cy + Math.sin(ang) * (maxR + 14);
      return `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="9" fill="currentColor">${DIMS[i].slice(0, 4)}</text>`;
    }).join("");
    return `<svg class="lp-radar-svg" viewBox="0 0 180 180" width="180" height="180" aria-label="Capability radar">${grid}${spokes}<polygon points="${poly}" fill="var(--accent)" fill-opacity=".35" stroke="var(--accent)" stroke-width="2"/>${labels}</svg>`;
  }

  function radarBars(r) {
    return `<div class="lp-radar-bars">${DIM_KEYS.map((k, i) => {
      const v = Math.round(r[k] || 0);
      return `<div class="lp-bar-row"><span>${DIMS[i]}</span><div class="lp-bar"><i style="width:${v}%"></i></div><em>${v}</em></div>`;
    }).join("")}</div>`;
  }

  const api = {
    STAGES, DIMS, US_ITEMS, ALONGSIDE, CROSS, DEPLOY_STEPS, BUSINESS_PILLARS, HANDOFF_ITEMS, CRED_PILLARS,
    loadPath, savePath, loadDrafts, loadVault, saveVault, loadRadar, saveRadar,
    loadUs, saveUs, usOn, setUsOn,
    evaluate, applyRadar, firstLook, pokeHoles, formatCoachHtml, coachReply, radarSvg, radarBars,
    isUnlocked(stageId, path) {
      const p = path || loadPath();
      if (stageId === 1) return true;
      const prev = p.stages[stageId - 1];
      return !!(prev && prev.best >= (STAGES[stageId - 2].pass));
    },
    advancedUnlocked(path) {
      const p = path || loadPath();
      // Stage 4 pass unlocks Ops deep / Portal owner / Slides present metaphorically
      return (p.stages[4] && p.stages[4].best >= 70) || (p.stages[7] && p.stages[7].best >= 70);
    },
    recordEval(stageId, text) {
      const p = loadPath();
      const result = evaluate(stageId, text);
      const st = p.stages[stageId] || { best: 0, attempts: 0, last: null, unlocked: stageId === 1 };
      st.attempts = (st.attempts || 0) + 1;
      st.last = { score: result.score, at: Date.now(), passed: result.passed };
      if (result.score > (st.best || 0)) st.best = result.score;
      st.lastResult = { score: result.score, pass: result.pass, passed: result.passed, strengths: result.strengths, strengthen: result.strengthen, nextStep: result.nextStep, stageId: result.stageId };
      if (result.passed) {
        st.unlocked = true;
        if (p.stages[stageId + 1]) p.stages[stageId + 1].unlocked = true;
        if (stageId < 7) p.active = stageId + 1;
      }
      p.stages[stageId] = st;
      savePath(p);
      applyRadar(result);
      return { result, path: p };
    },
    _resultHtml(view, active) {
      const sid = view.stageId;
      let title = view.stored ? `Your last evaluation · Stage ${sid}` : `Stage ${sid} result`;
      let extra = "";
      if (!view.stored && view.result.passed && sid !== active.id) {
        extra = `<p class="lp-unlocked">Stage ${active.id} (${esc(active.name)}) is now unlocked — you're on it. Submit your next asset below.</p>`;
      }
      return formatCoachHtml(view.result, title) + extra;
    },
    mount(host) {
      if (!host) return;
      this._host = host;
      this.render();
    },
    render() {
      const host = this._host || document.getElementById("launch-host");
      if (!host) return;
      // Never lose what the user is typing: store the open draft, then keep focus/caret across the redraw
      const cur = host.querySelector("#lp-submit");
      if (cur && cur.dataset.stage) saveDraft(+cur.dataset.stage, cur.value);
      const keep = window.MCKeepFocus || ((r, f) => f());
      keep(host, () => this._paint(host));
    },
    _paint(host) {
      const path = loadPath();
      const vault = loadVault();
      const radar = loadRadar();
      const us = loadUs();
      const showUs = usOn();
      const deployStep = loadDeployStep();
      const biz = loadBiz();
      const handoff = loadHandoff();
      const active = STAGES.find(s => s.id === path.active) || STAGES[0];
      const st = path.stages[active.id] || {};
      const cross = CROSS[active.id];
      const firstLocked = STAGES.find(s => s.id > 1 && !(path.stages[s.id - 1] && path.stages[s.id - 1].best >= STAGES[s.id - 2].pass));
      const unlockHint = firstLocked
        ? `<p class="lp-unlock-hint"><strong>How to unlock:</strong> score ${STAGES[firstLocked.id - 2].pass}+ on Stage ${firstLocked.id - 1} (${esc(STAGES[firstLocked.id - 2].name)}) to open Stage ${firstLocked.id} (${esc(firstLocked.name)}). Each stage opens the next.</p>`
        : `<p class="lp-unlock-hint"><strong>All stages unlocked.</strong> Keep improving your best scores.</p>`;
      const drafts = loadDrafts();
      const shown = this._last && (this._last.stageId === active.id || (this._last.result.passed && this._last.stageId + 1 === active.id)) ? this._last : null;
      const stored = !shown && st.lastResult ? { stageId: active.id, result: st.lastResult, stored: true } : null;
      const resultView = shown || stored;
      const draftText = drafts[active.id] != null ? drafts[active.id] : (shown && shown.stageId === active.id ? shown.text : "");

      host.innerHTML = `
        <div class="lp-layout">
          <div class="lp-col lp-col--map">
            <div class="pane-label"><span>Launch Path</span><span class="pane-badge">Venture coach · local</span></div>
            <p class="panel-copy small">Learn → Submit → Evaluate → Improve → Progress. Honest scores, not flattery. Vault private in localStorage.</p>
            <p class="eyebrow">Your 7 stages</p>
            <div class="lp-journey">${STAGES.map(s => {
              const ps = path.stages[s.id] || {};
              const open = s.id === 1 || (path.stages[s.id - 1] && path.stages[s.id - 1].best >= STAGES[s.id - 2].pass);
              const locked = !open;
              const done = (ps.best || 0) >= s.pass;
              const cur = s.id === path.active;
              return `<button type="button" class="lp-stage-chip${cur ? " is-active" : ""}${done ? " is-done" : ""}${locked ? " is-locked" : ""}" data-lp-stage="${s.id}" ${locked ? `aria-disabled="true" title="Locked — score ${STAGES[s.id - 2].pass}+ on Stage ${s.id - 1} to unlock"` : ""} ${cur ? 'aria-current="step"' : ""}>
                <span class="lp-sn">${s.id}</span>
                <span class="lp-sn-name">${esc(s.name)}</span>
                <span class="lp-sn-score${locked ? " lp-lock" : ""}">${locked ? `<span aria-hidden="true">🔒</span> Score ${STAGES[s.id - 2].pass}+ on Stage ${s.id - 1} to unlock` : (ps.best ? "Best " + ps.best + "/100" + (done ? " ✓" : "") : "Not scored")}</span>
              </button>`;
            }).join("")}</div>
            ${unlockHint}

            <div class="lp-deploy-path settings-block">
              <p class="eyebrow">Deploy Path</p>
              <p class="panel-copy small">Agency-style engagement flow — alongside the 7 coach stages, not instead of them.</p>
              <div class="lp-deploy-strip" role="list">${DEPLOY_STEPS.map(s => {
                const on = s.id === deployStep;
                return `<button type="button" class="lp-deploy-chip${on ? " is-active" : ""}" data-deploy-step="${s.id}" role="listitem">${esc(s.label)}</button>`;
              }).join("")}<span class="lp-deploy-arrow" aria-hidden="true">→</span></div>
            </div>
            <div class="lp-cred-tip settings-block">
              <p class="eyebrow">Credibility pillars</p>
              <div class="lp-cred-row">${CRED_PILLARS.map(c => `<span class="lp-chip">${esc(c)}</span>`).join("")}</div>
              <p class="panel-copy small">Mercatus tip: look established, earn opportunities, get found, and keep the keys — your infrastructure, not a rented storefront.</p>
            </div>
            <div class="lp-radar-wrap">
              <p class="eyebrow">Capability radar</p>
              <div class="lp-radar-row">${radarSvg(radar)}${radarBars(radar)}</div>
              <p class="panel-copy small">Living scores from evaluations — not a quiz.</p>
            </div>
            <div class="lp-price-note settings-block">
              <p class="eyebrow">Competitive note (display only · no charge)</p>
              <p class="panel-copy small">Comparable market: Stage 1 free; Stages 2–7 founding ~$49/mo vs ~$99 standard. This shell stays free & local.</p>
            </div>
          </div>
          <div class="lp-col lp-col--work">
            <div class="lp-work-head">
              <h3>Stage ${active.id}: ${esc(active.name)}</h3>
              <span class="lp-pass-req" id="lp-counter">Pass mark <strong>${active.pass}/100</strong> · Attempts <strong>${st.attempts || 0}</strong> · Best <strong>${st.best || 0}/100</strong></span>
            </div>
            <div class="lp-learn"><p class="eyebrow">Learn</p><p>${esc(active.learn)}</p></div>
            <label class="field"><span>Your submission for Stage ${active.id}</span>
              <textarea id="lp-submit" data-stage="${active.id}" rows="6" maxlength="2000" placeholder="Write or paste your answer — e.g. the problem, who has it, what you've heard from buyers, your offer and the next step you'll ship…">${esc(draftText)}</textarea>
            </label>
            <p class="lp-tip">Tip: name a specific buyer, add one piece of evidence (a conversation or number), and say what you will ship next. Drafts save as you type. Press Ctrl+Enter (⌘+Enter on Mac) to evaluate.</p>
            <div class="btn-row">
              <button type="button" class="btn btn-primary" id="lp-eval">Evaluate my answer</button>
              ${cross ? `<button type="button" class="btn btn-accent btn-sm" id="lp-cross" data-cross="${cross.action}">${esc(cross.label)}</button>` : ""}
            </div>
            <div id="lp-result" class="lp-result" role="status" aria-live="polite" ${resultView ? "" : "hidden"}>${resultView ? this._resultHtml(resultView, active) : ""}</div>

            <div class="lp-vault settings-block">
              <p class="eyebrow">Idea Vault</p>
              <p class="panel-copy small">Park shiny ideas. Stay focused on the active venture. Private · localStorage.</p>
              <div class="btn-row" style="flex-wrap:wrap;gap:6px">
                <input id="lp-vault-title" type="text" placeholder="Idea title" aria-label="Idea title" maxlength="80" style="flex:1;min-width:120px">
                <input id="lp-vault-note" type="text" placeholder="One-line note" aria-label="Idea note" maxlength="160" style="flex:2;min-width:140px">
                <button type="button" class="btn btn-ghost btn-sm" id="lp-vault-add">Park</button>
              </div>
              <div class="lp-vault-list" id="lp-vault-list">${vault.length ? vault.map((v, i) => `
                <div class="lp-vault-card" data-vi="${i}">
                  <strong>${esc(v.title)}</strong>
                  <p>${esc(v.note || "")}</p>
                  <div class="btn-row">
                    <button type="button" class="btn btn-ghost btn-sm" data-poke="${i}">Poke holes</button>
                    <button type="button" class="btn btn-ghost btn-sm" data-seed="${i}">Seed Intent</button>
                    <button type="button" class="btn btn-ghost btn-sm" data-who="${i}">Who buys?</button>
                    <button type="button" class="btn btn-ghost btn-sm" data-worth="${i}">Worth chasing?</button>
                    <button type="button" class="btn btn-ghost btn-sm" data-rmv="${i}">Remove</button>
                  </div>
                  <div class="lp-poke" id="lp-poke-${i}" hidden></div>
                </div>`).join("") : `<div class="empty-state"><strong>No parked ideas yet</strong><p>Type a title above and press Park to keep a shiny idea out of your way.</p></div>`}</div>
            </div>


            <div class="lp-biz settings-block">
              <p class="eyebrow">Business Deploy</p>
              <p class="panel-copy small">Four pillars — brand, presence, revenue rails, ops. Persists in Concierge DB.</p>
              <div class="lp-biz-pillars">${BUSINESS_PILLARS.map(p => `
                <div class="lp-biz-pillar">
                  <strong>${esc(p.title)}</strong>
                  <ul>${p.items.map(i => {
                    const kid = p.id + "." + i.id;
                    return `<li><label class="check"><input type="checkbox" data-biz="${kid}" ${biz.checks[kid] ? "checked" : ""}><span>${esc(i.label)}</span></label></li>`;
                  }).join("")}</ul>
                </div>`).join("")}</div>
              <div class="btn-row" style="flex-wrap:wrap;gap:6px;margin-top:8px">
                <button type="button" class="btn btn-ghost btn-sm" data-goto="ops">→ Ops sheet</button>
                <button type="button" class="btn btn-ghost btn-sm" data-goto="portal">→ Portal</button>
                <button type="button" class="btn btn-ghost btn-sm" data-goto="meeting">→ Meeting Desk</button>
                <button type="button" class="btn btn-ghost btn-sm" id="lp-biz-us">→ US Foundation</button>
              </div>
            </div>

            <div class="lp-handoff settings-block">
              <p class="eyebrow">Ownership Handoff</p>
              <p class="panel-copy small">Client keeps the keys. Check each transfer before you celebrate “launch.”</p>
              <ul class="lp-handoff-list">${HANDOFF_ITEMS.map(i => `
                <li><label class="check"><input type="checkbox" data-handoff="${i.id}" ${handoff.checks[i.id] ? "checked" : ""}><span>${esc(i.label)}</span></label></li>
              `).join("")}</ul>
              <label class="field"><span>Handoff note</span>
                <textarea id="lp-handoff-note" rows="2" maxlength="500" placeholder="What was transferred, to whom, and where credentials live…">${esc(handoff.note || "")}</textarea>
              </label>
            </div>

            <details class="lp-packages settings-block">
              <summary>Market packages (intel only · not Concierge pricing)</summary>
              <p class="panel-copy small">Competitive reference for Concierge pitch conversations. No CTAs · no checkout.</p>
              <ul class="panel-copy small">
                <li><strong>Website tiers:</strong> Launch · Growth · Authority (agency market often ~$2k / ~$3.5k / ~$5k — verify locally)</li>
                <li><strong>Care / mgmt:</strong> Care ~$99 · Growth management ~$299 · Digital partner ~$699 /mo (market notes)</li>
              </ul>
              <p class="panel-copy small">Concierge stays free & local for demos; use these figures only as sales context.</p>
            </details>
            <div class="lp-us settings-block">
              <label class="check"><input type="checkbox" id="lp-us-toggle" ${showUs ? "checked" : ""}><span>Non-US founder track — US Foundation checklist</span></label>
              <div id="lp-us-panel" ${showUs ? "" : "hidden"}>
                <p class="panel-copy small">Sequenced rails for building a US financial identity. Educational checklist only — not legal or tax advice. No checkout.</p>
                <div class="lp-alongside">${ALONGSIDE.map(c => `<span class="lp-chip">${esc(c)}</span>`).join("")}</div>
                <div class="lp-us-compare">
                  <div class="lp-cmp"><h4>With foundation</h4><ul><li>Entity + EIN unlock banking</li><li>Processors trust the stack</li><li>Credit builds on separate rails</li><li>Compliance is scheduled, not surprise</li></ul></div>
                  <div class="lp-cmp lp-cmp--without"><h4>Without</h4><ul><li>Personal accounts as workaround</li><li>Processor freezes / KYC loops</li><li>Credit mixed with personal risk</li><li>Growth blocked by paperwork</li></ul></div>
                </div>
                <ol class="lp-us-list">${US_ITEMS.map(item => `
                  <li><label class="check"><input type="checkbox" data-us="${item.id}" ${us.checks[item.id] ? "checked" : ""}><span><strong>${esc(item.title)}</strong> — ${esc(item.note)}</span></label></li>
                `).join("")}</ol>
              </div>
            </div>
          </div>
        </div>`;

      this._bind(host, path);
    },
    _bind(host, path) {
      const self = this;
      host.querySelectorAll("[data-lp-stage]").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = +btn.dataset.lpStage;
          if (!self.isUnlocked(id, path)) { window.MCToast?.(`Locked — score ${STAGES[id - 2].pass}+ on Stage ${id - 1} first`); return; }
          path.active = id;
          savePath(path);
          self.render();
        });
      });
      const ta = host.querySelector("#lp-submit");
      if (ta) {
        const sid = +ta.dataset.stage || path.active;
        ta.addEventListener("input", () => saveDraft(sid, ta.value));
        ta.addEventListener("keydown", e => {
          e.stopPropagation(); // typing in the answer box never reaches page-level shortcuts
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); host.querySelector("#lp-eval")?.click(); }
        });
      }
      host.querySelector("#lp-eval")?.addEventListener("click", () => {
        const field = host.querySelector("#lp-submit");
        const text = field ? field.value : "";
        if (!text.trim()) {
          const box = host.querySelector("#lp-result");
          if (box) { box.hidden = false; box.innerHTML = `<div class="lp-coach-card is-empty"><strong>Write your answer first.</strong><p class="panel-copy small">Type or paste your Stage ${path.active} submission in the box above, then press Evaluate.</p></div>`; }
          field?.focus();
          return;
        }
        const stageId = path.active;
        saveDraft(stageId, text);
        const { result } = self.recordEval(stageId, text);
        self._last = { stageId, result, text };
        if (result.passed && stageId < 7) saveDraft(stageId + 1, loadDrafts()[stageId + 1] || "");
        window.MCToast?.(result.passed ? `Pass ${result.score}/100 — ${stageId < 7 ? "Stage " + (stageId + 1) + " unlocked" : "Launch Path complete"}` : `Scored ${result.score}/100 — ${result.pass} needed. See feedback.`);
        self.render();
        const box = (self._host || host).querySelector("#lp-result");
        if (box) box.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
      host.querySelector("#lp-cross")?.addEventListener("click", e => {
        const act = e.currentTarget.dataset.cross;
        self.runCross(act);
      });
      host.querySelector("#lp-vault-add")?.addEventListener("click", () => {
        const title = host.querySelector("#lp-vault-title")?.value?.trim();
        const note = host.querySelector("#lp-vault-note")?.value?.trim() || "";
        if (!title) return;
        const v = loadVault();
        v.unshift({ title, note, at: Date.now() });
        saveVault(v);
        self.render();
      });
      host.querySelectorAll("[data-poke]").forEach(b => b.addEventListener("click", () => {
        const i = +b.dataset.poke;
        const v = loadVault()[i];
        const el = host.querySelector("#lp-poke-" + i);
        if (!el) return;
        const qs = pokeHoles(v);
        el.hidden = false;
        el.innerHTML = `<ol>${qs.map(q => `<li>${esc(q)}</li>`).join("")}</ol>`;
      }));
      host.querySelectorAll("[data-seed]").forEach(b => b.addEventListener("click", () => {
        const v = loadVault()[+b.dataset.seed];
        if (!v) return;
        const ta = document.getElementById("intent-text");
        if (ta) ta.value = v.title + (v.note ? " — " + v.note : "");
        localStorage.setItem("mc-intent", ta?.value || "");
        window.MCGoStage?.("intent");
        window.MCToast?.("Seeded Intent from vault");
      }));
      host.querySelectorAll("[data-who]").forEach(b => b.addEventListener("click", () => {
        const el = host.querySelector("#lp-poke-" + b.dataset.who);
        if (el) { el.hidden = false; el.innerHTML = `<p class="panel-copy small">Stub: name 3 buyer roles, where they hang out, and what they already pay for. Then run Customer Discovery (Stage 2).</p>`; }
      }));
      host.querySelectorAll("[data-worth]").forEach(b => b.addEventListener("click", () => {
        const el = host.querySelector("#lp-poke-" + b.dataset.worth);
        if (el) { el.hidden = false; el.innerHTML = `<p class="panel-copy small">Stub: score desire (1–5), ability to pay (1–5), your unfair access (1–5). Below 9 total → park it.</p>`; }
      }));
      host.querySelectorAll("[data-rmv]").forEach(b => b.addEventListener("click", () => {
        const v = loadVault();
        v.splice(+b.dataset.rmv, 1);
        saveVault(v);
        self.render();
      }));

      host.querySelectorAll("[data-deploy-step]").forEach(b => b.addEventListener("click", () => {
        saveDeployStep(b.dataset.deployStep);
        self.render();
      }));
      host.querySelectorAll("[data-biz]").forEach(ck => ck.addEventListener("change", () => {
        const biz = loadBiz();
        biz.checks[ck.dataset.biz] = ck.checked;
        saveBiz(biz);
      }));
      host.querySelectorAll("[data-handoff]").forEach(ck => ck.addEventListener("change", () => {
        const h = loadHandoff();
        h.checks[ck.dataset.handoff] = ck.checked;
        saveHandoff(h);
      }));
      host.querySelector("#lp-handoff-note")?.addEventListener("change", e => {
        const h = loadHandoff();
        h.note = e.target.value;
        saveHandoff(h);
      });
      host.querySelector("#lp-biz-us")?.addEventListener("click", () => {
        setUsOn(true);
        self.render();
        host.querySelector("#lp-us-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });

      host.querySelector("#lp-us-toggle")?.addEventListener("change", e => {
        setUsOn(e.target.checked);
        self.render();
      });
      host.querySelectorAll("[data-us]").forEach(ck => ck.addEventListener("change", () => {
        const us = loadUs();
        us.checks[ck.dataset.us] = ck.checked;
        saveUs(us);
      }));
    },
    runCross(action) {
      if (action === "seedOffer") {
        try {
          const sheet = JSON.parse(localStorage.getItem("mc-sheet") || "null");
          if (sheet && sheet.rows) {
            sheet.rows.push(["Offer design", "Founder", "Draft", "From Launch Path Stage 3"]);
            localStorage.setItem("mc-sheet", JSON.stringify(sheet));
          }
          const roles = JSON.parse(localStorage.getItem("mc-roles") || "{}");
          if (!roles.founders) roles.founders = { funding: [], waitlist: [], okrs: [] };
          if (!Array.isArray(roles.founders.waitlist)) roles.founders.waitlist = [];
          roles.founders.waitlist.push("launch-path-offer@" + Date.now());
          localStorage.setItem("mc-roles", JSON.stringify(roles));
        } catch (_) {}
        window.MCGoStage?.("ops");
        window.MCToast?.("Seeded Ops sheet row + waitlist stub");
      } else if (action === "openMvp") {
        window.MCGoStage?.("atelier");
        window.MCToast?.("Open Concierge — then Paint for MVP visuals");
        setTimeout(() => window.MCGoStage?.("paint"), 1200);
      } else if (action === "openMessaging") {
        try {
          const ev = new Event("change");
          const sw = document.getElementById("role-switcher");
          if (sw) { sw.value = "marketers"; sw.dispatchEvent(ev); }
        } catch (_) {}
        window.MCGoStage?.("roles");
        window.MCToast?.("Marketers Role Kit");
      } else if (action === "openSales") {
        window.MCGoStage?.("portal");
        window.MCToast?.("Client Portal — use Demo as client");
      } else if (action === "openLaunch") {
        window.MCGoStage?.("slides");
        window.MCToast?.("Slides — present stub + publish from topbar");
      }
    },
    renderFoundersVault(container) {
      if (!container) return;
      const vault = loadVault();
      const showUs = usOn();
      const us = loadUs();
      container.innerHTML = `
        <div class="lp-founders-extra">
          <div class="role-section">
            <h3>Idea Vault</h3>
            <p class="panel-copy small">Park ideas · poke holes · seed Intent. Same vault as Launch Path.</p>
            <div class="btn-row" style="flex-wrap:wrap;gap:6px">
              <input id="fk-vault-title" type="text" placeholder="Idea title" aria-label="Idea title" maxlength="80" style="flex:1;min-width:100px">
              <input id="fk-vault-note" type="text" placeholder="One-line note" aria-label="Idea note" maxlength="160" style="flex:2;min-width:120px">
              <button type="button" class="btn btn-ghost btn-sm" id="fk-vault-add">Park</button>
            </div>
            <div class="lp-vault-list">${vault.slice(0, 5).map((v, i) => `
              <div class="lp-vault-card"><strong>${esc(v.title)}</strong><p>${esc(v.note || "")}</p>
              <button type="button" class="btn btn-ghost btn-sm" data-fk-poke="${i}">Poke holes</button>
              <div class="lp-poke" id="fk-poke-${i}" hidden></div></div>`).join("") || "<p class='panel-copy small'>Empty</p>"}</div>
          </div>
          <div class="role-section">
            <h3>US Foundation</h3>
            <label class="check"><input type="checkbox" id="fk-us-toggle" ${showUs ? "checked" : ""}><span>Show non-US founder track</span></label>
            <div id="fk-us-panel" ${showUs ? "" : "hidden"}>
              <div class="lp-alongside">${ALONGSIDE.map(c => `<span class="lp-chip">${esc(c)}</span>`).join("")}</div>
              <div class="lp-us-compare">
                <div class="lp-cmp"><h4>With</h4><ul><li>Clean entity rails</li><li>Bank + processor ready</li></ul></div>
                <div class="lp-cmp lp-cmp--without"><h4>Without</h4><ul><li>Workarounds break</li><li>KYC loops</li></ul></div>
              </div>
              <ol class="lp-us-list">${US_ITEMS.map(item => `
                <li><label class="check"><input type="checkbox" data-fk-us="${item.id}" ${us.checks[item.id] ? "checked" : ""}><span><strong>${esc(item.title)}</strong> — ${esc(item.note)}</span></label></li>
              `).join("")}</ol>
            </div>
          </div>
          <button type="button" class="btn btn-accent btn-sm" data-goto="launch">Open Launch Path</button>
        </div>`;
      container.querySelector("#fk-vault-add")?.addEventListener("click", () => {
        const title = container.querySelector("#fk-vault-title")?.value?.trim();
        const note = container.querySelector("#fk-vault-note")?.value?.trim() || "";
        if (!title) return;
        const v = loadVault();
        v.unshift({ title, note, at: Date.now() });
        saveVault(v);
        this.renderFoundersVault(container);
        if (this._host) this.render();
      });
      container.querySelectorAll("[data-fk-poke]").forEach(b => b.addEventListener("click", () => {
        const i = +b.dataset.fkPoke;
        const el = container.querySelector("#fk-poke-" + i);
        if (!el) return;
        el.hidden = false;
        el.innerHTML = `<ol>${pokeHoles(loadVault()[i]).map(q => `<li>${esc(q)}</li>`).join("")}</ol>`;
      }));
      container.querySelector("#fk-us-toggle")?.addEventListener("change", e => {
        setUsOn(e.target.checked);
        this.renderFoundersVault(container);
      });
      container.querySelectorAll("[data-fk-us]").forEach(ck => ck.addEventListener("change", () => {
        const u = loadUs();
        u.checks[ck.dataset.fkUs] = ck.checked;
        saveUs(u);
      }));
    }
  };

  window.MCLaunch = api;
})();
