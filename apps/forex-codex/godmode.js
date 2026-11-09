/* LUXGEX godmode — AGI desk + trading journal UI. */

(function () {
  const HC = window.Highcharts;
  const $ = (id) => document.getElementById(id);
  const S = () => window.LX_STATE;
  const toast = (m) => window.LX_TOAST?.(m);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (x, d) => (x == null || Number.isNaN(+x) ? "—" : Number(x).toLocaleString(undefined, { maximumFractionDigits: d ?? 2 }));
  const post = (p, b) => fetch(p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then((r) => r.json());
  const get = (p) => fetch(p).then((r) => r.json());
  const body = () => ({ symbol: S().symbol, n: S().bars, tf: S().tf, seed: S().seed, live: S().live, csv: S().csv || "" });

  let twinChart = null;
  let lastBundle = null;
  let prevConf = null;

  function deskContext(extra) {
    const st = S();
    const a = st.analysis;
    const conf = a?.oscillators?.confluence?.at(-1);
    return {
      symbol: st.symbol,
      last: a?.bars?.at(-1)?.c,
      bias: a?.structure?.bias,
      confluence: conf,
      confluence_prev: prevConf ?? conf,
      ml: st.ml,
      gex: st.gex ? { regime: st.gex.regime, above_flip: st.gex.above_flip, gamma_flip: st.gex.gamma_flip, spot: st.gex.spot } : null,
      cot_read: st.cotRead,
      delta_bias: st.deltaBias,
      astro_score: st.astroScore,
      ...extra,
    };
  }

  /* ================================================================ AGI bundle */

  async function paintAgi() {
    if (!$("agi")) return;
    const ctx = deskContext();
    const r = await post("/api/agi/bundle", { ...body(), context: ctx });
    if (!r.ok) return;
    lastBundle = r;
    if (S().analysis?.oscillators) prevConf = S().analysis.oscillators.confluence.at(-1);

    // ideas rail
    $("idea-rail").innerHTML = (r.ideas || []).map((idea, i) => `
      <button class="idea-chip" data-id="${esc(idea.id)}" style="animation-delay:${i * 40}ms">
        <span class="tag">${esc(idea.tag)}</span>
        <b>${esc(idea.title)}</b>
        <small>${esc(idea.blurb)}</small>
      </button>`).join("");
    $("idea-rail").querySelectorAll(".idea-chip").forEach((b) => b.addEventListener("click", () => focusIdea(b.dataset.id)));

    // ensemble
    const ens = r.ensemble || {};
    $("ens-action").textContent = ens.action || "—";
    $("ens-action").className = /long/.test(ens.action || "") ? "up" : /short/.test(ens.action || "") ? "dn" : "";
    $("ens-note").textContent = ens.note || "";
    const fill = $("ens-fill");
    const pct = Math.round((Number(ens.conviction) + 1) * 50);
    fill.style.width = `${Math.max(4, Math.min(100, pct))}%`;
    fill.className = ens.conviction > 0.15 ? "bull" : ens.conviction < -0.15 ? "bear" : "";
    $("ens-list").innerHTML = (ens.signals || []).map((s) => `
      <div class="ens-row"><span>${esc(s.name)}</span>
        <i style="width:${Math.abs(s.score) * 100}%;" class="${s.score >= 0 ? "pos" : "neg"}"></i>
        <b>${s.score >= 0 ? "+" : ""}${s.score.toFixed(2)}</b></div>`).join("");

    // regime / anomaly / emotion
    $("reg-name").textContent = r.regime?.regime || "—";
    $("reg-name").className = /up/.test(r.regime?.regime || "") ? "up" : /dn|high/.test(r.regime?.regime || "") ? "dn" : "";
    $("reg-note").textContent = r.regime?.note || "";
    $("anom-sev").textContent = r.anomaly?.severity || "—";
    $("anom-sev").className = r.anomaly?.severity === "critical" ? "dn" : r.anomaly?.severity === "elevated" ? "warn" : "";
    $("anom-note").textContent = r.anomaly?.note || "";
    $("emo-score").textContent = r.emotion ? `${r.emotion.score}/100 · ${r.emotion.label}` : "—";
    $("emo-note").textContent = r.emotion?.note || "";

    // alerts
    $("agi-heal").textContent = r.alerts?.heal || "All quiet.";
    $("agi-alerts").innerHTML = (r.alerts?.alerts || []).map((a) => `
      <li class="${esc(a.level)}"><span>${esc(a.kind)}</span><b>${esc(a.msg)}</b></li>`).join("") || `<li class="low"><span>status</span><b>No active alerts</b></li>`;

    // twin
    paintTwin(r.twin);

    // replay
    $("replay-note").textContent = r.replay?.note || "";
    const w = r.replay?.weights || {};
    const max = Math.max(...Object.values(w), 1);
    $("replay-bars").innerHTML = Object.entries(w).map(([k, v]) => `
      <div class="rb"><span>${esc(k)}</span><i style="width:${(v / max) * 100}%"></i><b>${v.toFixed(2)}</b></div>`).join("");
  }

  function paintTwin(twin) {
    if (!twin?.ok || !HC) return;
    $("twin-note").textContent = twin.note || "";
    const path = twin.path.map((p) => [p.i, p.c]);
    const base = twin.baseline.map((p) => [p.i, p.c]);
    if (twinChart) twinChart.destroy();
    twinChart = HC.chart("twin-hc", {
      chart: { height: 200, spacing: [8, 8, 8, 8], marginRight: 50, className: "highcharts-light", animation: { duration: 600 } },
      title: { text: "" }, credits: { enabled: false }, legend: { enabled: true, align: "left", verticalAlign: "top", itemStyle: { fontSize: "10px", fontWeight: 600 } },
      xAxis: { visible: false },
      yAxis: { title: { text: "" }, opposite: true, labels: { align: "left", x: 4, style: { fontSize: "10px" } } },
      tooltip: { shared: true, backgroundColor: "rgba(255,255,255,0.97)", borderRadius: 10, style: { fontFamily: "JetBrains Mono, monospace", fontSize: "11px" } },
      series: [
        { name: "Baseline", data: base, color: "#94a3b8", lineWidth: 1.2, marker: { enabled: false }, dashStyle: "Dash" },
        { name: "Shock path", data: path, color: "#e11d48", lineWidth: 2, marker: { enabled: false } },
      ],
    });
  }

  async function runSwarm() {
    $("swarm-grid").classList.add("thinking");
    const r = await post("/api/agi/swarm", { context: deskContext({ ensemble: lastBundle?.ensemble }) });
    $("swarm-grid").classList.remove("thinking");
    const p = r.personas || {};
    $("swarm-grid").innerHTML = ["Bull", "Bear", "Risk", "Meta"].map((k) => `
      <div class="swarm-p ${k === "Meta" ? "meta" : ""} ${k === "Bull" ? "bull" : k === "Bear" ? "bear" : ""}">
        <b>${k}</b><p>${esc(p[k] || "—").replace(/\n/g, "<br/>")}</p>
      </div>`).join("");
    toast(r.source?.startsWith("ollama") ? "Swarm debated via Ollama" : "Rule swarm (Ollama offline)");
  }

  async function runTwin() {
    const r = await post("/api/agi/twin", { ...body(), shock_pct: +$("twin-shock").value, vol_mult: +$("twin-vol").value });
    paintTwin(r);
  }

  async function askRag() {
    const q = $("rag-q").value.trim();
    if (!q) return;
    $("rag-a").textContent = "Thinking with journal memory…";
    const r = await post("/api/agi/ask", { question: q, context: deskContext({ ensemble: lastBundle?.ensemble }) });
    $("rag-a").textContent = r.answer || "—";
    toast(r.source || "RAG");
  }

  function focusIdea(id) {
    const map = { swarm: runSwarm, twin: () => $("twin-shock").focus(), rag: () => $("rag-q").focus(), journal: () => { location.hash = "#journal"; $("j-new")?.click(); }, ensemble: () => $("ens-card")?.scrollIntoView({ behavior: "smooth", block: "center" }) };
    (map[id] || (() => toast(`Engine: ${id}`)))();
  }

  /* ================================================================ Journal */

  async function paintJournal() {
    if (!$("journal")) return;
    const r = await get("/api/journal");
    const st = r.stats || {};
    $("journal-stats").innerHTML = [
      ["Trades", st.trades ?? 0],
      ["Win rate", st.trades ? `${Math.round(st.win_rate * 100)}%` : "—"],
      ["Total PnL", `${st.total_pnl >= 0 ? "+" : ""}${fmt(st.total_pnl, 2)}`],
      ["Profit factor", fmt(st.profit_factor, 2)],
      ["Best", fmt(st.best, 2)],
      ["Worst", fmt(st.worst, 2)],
    ].map(([k, v]) => `<div class="stat-block"><span>${k}</span><strong>${v}</strong></div>`).join("");

    $("j-list").innerHTML = (r.entries || []).map((e) => `
      <li class="j-item ${e.pnl >= 0 ? "win" : "loss"}" data-id="${e.id}">
        <div class="j-top">
          <b>${esc(e.symbol)}</b>
          <span class="side ${e.side}">${e.side}</span>
          <span class="pnl">${e.pnl >= 0 ? "+" : ""}${fmt(e.pnl, 2)} <i>${e.pnl_pct >= 0 ? "+" : ""}${e.pnl_pct}%</i></span>
          <span class="mood">${esc(e.mood)}</span>
        </div>
        <div class="j-mid">${esc(e.setup || "—")} · ${fmt(e.entry, 4)} → ${fmt(e.exit, 4)} · qty ${e.qty}</div>
        ${e.notes ? `<p class="j-notes">${esc(e.notes)}</p>` : ""}
        ${e.ai_review ? `<pre class="j-ai">${esc(e.ai_review.text)}</pre>` : ""}
        <div class="j-bot">
          <button data-act="review" data-id="${e.id}">AI review</button>
          <button data-act="del" data-id="${e.id}">Delete</button>
          <span class="when">${new Date(e.t * 1000).toLocaleString()}</span>
        </div>
      </li>`).join("") || `<li class="j-empty">No trades yet — log your first one.</li>`;

    $("j-list").querySelectorAll("button[data-act]").forEach((b) => b.addEventListener("click", async () => {
      if (b.dataset.act === "del") {
        if (!confirm("Delete this journal entry?")) return;
        await post("/api/journal/delete", { id: b.dataset.id });
        paintJournal();
        return;
      }
      b.disabled = true; b.textContent = "Reviewing…";
      const out = await post("/api/journal/review", { id: b.dataset.id, context: deskContext() });
      b.disabled = false; b.textContent = "AI review";
      toast(out.review?.source || "reviewed");
      paintJournal();
      paintAgi(); // refresh emotion mirror
    }));
  }

  function fillFromDesk() {
    const st = S();
    $("j-symbol").value = st.symbol;
    const last = st.analysis?.bars?.at(-1)?.c;
    if (last) { $("j-entry").value = last; $("j-exit").value = last; }
    const conf = st.analysis?.oscillators?.confluence?.at(-1) || 0;
    $("j-side").value = conf >= 0 ? "long" : "short";
    $("j-setup").value = [st.analysis?.structure?.bias, st.gex?.regime && `gex:${st.gex.regime}`, lastBundle?.regime?.regime].filter(Boolean).join(" · ");
    $("j-hint").textContent = "Desk snapshot ready — save to lock bias / GEX / ML into this entry.";
    toast("Filled from desk");
  }

  function snapshot() {
    const st = S();
    return {
      bias: st.analysis?.structure?.bias,
      confluence: st.analysis?.oscillators?.confluence?.at(-1),
      gex_regime: st.gex?.regime,
      ml_p_up: st.ml?.p_up,
      cot_read: st.cotRead,
      regime: lastBundle?.regime?.regime,
      ensemble_action: lastBundle?.ensemble?.action,
    };
  }

  async function saveEntry(e) {
    e.preventDefault();
    const payload = {
      symbol: $("j-symbol").value.trim() || S().symbol,
      side: $("j-side").value,
      mood: $("j-mood").value,
      entry: +$("j-entry").value,
      exit: +$("j-exit").value,
      qty: +$("j-qty").value || 1,
      setup: $("j-setup").value,
      tags: $("j-tags").value.split(",").map((t) => t.trim()).filter(Boolean),
      notes: $("j-notes").value,
      lessons: $("j-lessons").value,
      snapshot: snapshot(),
    };
    const r = await post("/api/journal/add", payload);
    if (!r.ok) { toast(r.error || "save failed"); return; }
    toast("Trade logged");
    $("j-form").reset();
    $("j-qty").value = "1";
    paintJournal();
    paintAgi();
  }

  function paintKernel(pack) {
    const k = pack?.kernel || {};
    const ollama = pack?.ollama || {};
    const host = $("km-host");
    if (!host) return;
    host.textContent = k.host || "—";
    $("km-host").parentElement.className = `km-chip ${k.host === "down" || (k.host === "ollama" && !ollama.ok) ? "cold" : "live"}`;
    $("km-cap").textContent = k.cap || "—";
    $("km-cap-wrap").className = `km-chip ${k.generation_allowed === false ? "cold" : ""}`;
    $("km-warm").textContent = k.warm || "—";
    $("km-warm-wrap").className = `km-chip ${k.warm === "live" ? "live" : "cold"}`;
    $("km-cost").textContent = k.cost != null ? String(k.cost) : "—";
    if (pack.lab) $("km-lab").href = pack.lab;
    if (pack.tab) document.title = pack.tab;
    const ready = pack.ready || {};
    const pill = $("km-ready");
    if (pill) {
      pill.textContent = ready.commercial_ship ? "ship" : ready.operator_ready ? "operator" : "blocked";
      $("km-ready-wrap").className = `km-chip ${ready.commercial_ship ? "live" : ready.operator_ready ? "" : "cold"}`;
    }
    const banner = $("ready-banner");
    if (banner) {
      banner.textContent = pack.not_advice || banner.textContent;
      if (ready.missing?.length && !ready.commercial_ship) {
        banner.textContent += ` Missing for paid ship: ${ready.missing.join(", ")}.`;
      }
      banner.className = `ready-banner ${ready.commercial_ship ? "is-ship" : ready.operator_ready ? "" : "is-block"}`;
    }
  }

  async function pollHealth() {
    const pack = await get("/api/health").catch(() => null);
    if (pack?.ok) paintKernel(pack);
  }

  async function paintHandshake() {
    const list = $("handshake-list");
    if (!list) return;
    const r = await get("/api/quant/handshake").catch(() => ({}));
    if (r.lab) $("handshake-lab").href = r.lab;
    const rows = r.artifacts || [];
    list.innerHTML = rows.map((a) => `
      <li><b>${esc(a.name)}</b><a href="${esc(a.preview)}" target="_blank" rel="noopener">preview</a></li>
    `).join("") || `<li>No studio artifacts yet — run a Lab engine first.</li>`;
    if (r.overnight) {
      list.insertAdjacentHTML("beforeend", `<li><b>overnight draft</b><span>${esc(r.overnight)}</span></li>`);
    }
  }

  async function ingestCsv(text, name) {
    const r = await post("/api/csv", { csv: text, tf: S().tf });
    if (!r.ok) { toast(r.error || "CSV rejected"); return; }
    S().csv = text;
    $("csv-status").textContent = `csv · ${r.n}`;
    window.LXDesk?.savePrefs({ bars: r.n });
    await window.runAll?.();
    S().bot = await post("/api/bot/reset", { symbol: S().symbol, tf: S().tf, live: false, csv: text });
    toast(`CSV tape loaded · ${r.n} bars`);
  }

  function bindCsv() {
    const drop = $("csv-drop");
    const file = $("csv-file");
    if (!drop || !file) return;
    drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("is-over"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("is-over"));
    drop.addEventListener("drop", async (e) => {
      e.preventDefault();
      drop.classList.remove("is-over");
      const f = e.dataTransfer?.files?.[0];
      if (!f) return;
      ingestCsv(await f.text(), f.name);
    });
    file.addEventListener("change", async () => {
      const f = file.files?.[0];
      if (!f) return;
      ingestCsv(await f.text(), f.name);
    });
  }

  async function restoreSession(user) {
    const local = await get("/api/session").catch(() => ({}));
    const prefs = { ...(local.prefs || {}), ...(user?.prefs || {}) };
    const has = prefs.symbol || prefs.tf || typeof prefs.live === "boolean";
    if (has) window.LXDesk?.applyPrefs(prefs);
    pollHealth();
    paintHandshake();
    return has;
  }

  function bind() {
    $("agi-refresh")?.addEventListener("click", () => paintAgi().then(() => toast("AGI bundle refreshed")));
    $("agi-swarm")?.addEventListener("click", runSwarm);
    $("twin-run")?.addEventListener("click", runTwin);
    $("rag-ask")?.addEventListener("click", askRag);
    $("rag-q")?.addEventListener("keydown", (e) => { if (e.key === "Enter") askRag(); });
    $("j-refresh")?.addEventListener("click", paintJournal);
    $("j-new")?.addEventListener("click", () => { location.hash = "#journal"; $("j-entry")?.focus(); fillFromDesk(); });
    $("j-snap")?.addEventListener("click", fillFromDesk);
    $("j-form")?.addEventListener("submit", saveEntry);
    // seed symbol field
    if ($("j-symbol") && S().symbol) $("j-symbol").value = S().symbol;
    bindCsv();
    $("km-discharge")?.addEventListener("click", async () => {
      const r = await post("/api/lab/discharge", {});
      toast(r.ok ? "Lab queue discharged" : (r.error || "discharge failed"));
      pollHealth();
    });
    $("km-overnight")?.addEventListener("click", async () => {
      const r = await post("/api/lab/overnight", {});
      toast(r.ok ? "Overnight tick ran" : (r.error || "overnight failed"));
      paintHandshake();
      pollHealth();
    });
    $("agents-refresh")?.addEventListener("click", () => paintAgents(true));
    $("agents-gloss")?.addEventListener("click", () => paintAgents(true, true));
    setInterval(pollHealth, 15000);
    setInterval(() => paintAgents(false), 180000);
    pollHealth();
    paintAgents(false);
  }

  function afterRun() {
    paintAgi();
    paintJournal();
    paintHandshake();
    pollHealth();
    paintAgents(false);
  }

  function paintAgents(force, gloss) {
    const report = $("agent-report");
    if (!report) return Promise.resolve();
    $("agents-meta").textContent = force ? "scanning…" : ($("agents-meta").textContent || "idle");
    const req = force ? post("/api/agents/run", { gloss: !!gloss }) : get("/api/agents/report");
    return req.then((r) => {
      if (!r?.ok) { report.textContent = r?.error || "scan failed"; return; }
      $("agent-cards").innerHTML = (r.agents || []).map((a) => `<article><b>${esc(a.id)}</b><p>${esc(a.role)}</p></article>`).join("");
      const groups = r.book?.groups || {};
      $("agent-book").innerHTML = Object.entries(groups).map(([g, rows]) => `
        <section>
          <h4>${esc(g)} · ${rows.length}</h4>
          <ul>${rows.slice(0, 8).map((q) => {
            const live = q.source && q.source !== "synthetic";
            return `<li class="${live ? "live" : "synth"}"><span>${esc(q.symbol)}</span><span>${esc(q.source)} ${q.change_pct ?? "—"}%</span></li>`;
          }).join("")}</ul>
        </section>`).join("");
      report.textContent = r.text || "";
      const when = r.ts ? new Date(r.ts * 1000).toLocaleTimeString() : "";
      $("agents-meta").textContent = `${r.book?.live_n ?? 0}/${r.book?.n ?? 0} live · ${r.model?.source || "rule"} · ${when}`;
    }).catch(() => { report.textContent = "agent scan unreachable"; });
  }

  window.LXGodmode = { bind, afterRun, paintAgi, paintJournal, deskContext, restoreSession, paintHandshake, paintAgents };
})();
