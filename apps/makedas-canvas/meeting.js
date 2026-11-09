/* Meeting Desk — Recall.ai–inspired lite (no live bot without API key) */
(function () {
  "use strict";
  const LS = { prep: "mc-meeting-prep", last: "mc-meeting-last" };
  const SPEAKERS = [
    { id: "s1", name: "Katlego", color: "#c8102e" },
    { id: "s2", name: "Amina", color: "#3b82f6" },
    { id: "s3", name: "Jordan", color: "#16a34a" }
  ];
  const MOCK_LANES = [
    { sp: "s1", t: "0:12", text: "Goal today: confirm whether Concierge Launch Path unblocks their founder onboarding." },
    { sp: "s2", t: "0:48", text: "We still track discovery notes in Notion — nothing scores the venture asset." },
    { sp: "s3", t: "1:20", text: "If we could push action items into the client portal, ops would actually close the loop." },
    { sp: "s1", t: "2:05", text: "Proposal: pilot Meeting Desk summary → Portal messages this week." },
    { sp: "s2", t: "2:40", text: "I can own the pilot if the transcript attributes speakers cleanly." }
  ];

  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const toast = m => window.MCToast?.(m);

  function secrets() {
    try { return JSON.parse(localStorage.getItem("mc-secrets-vault") || "[]"); } catch (_) { return []; }
  }
  function hasRecallKey() {
    return secrets().some(s => /RECALL/i.test(s.k) && s.v);
  }
  function connectors() {
    try { return JSON.parse(localStorage.getItem("mc-connectors") || "{}"); } catch (_) { return {}; }
  }
  function saveConnectors(c) {
    localStorage.setItem("mc-connectors", JSON.stringify(c));
    window.MCDB?.setSync?.("mc-connectors", c);
  }

  const api = {
    ensure() {
      if ($("#meeting-pane")) return;
      const split = $("#stage-split");
      if (!split) return;
      const pane = document.createElement("section");
      pane.className = "meeting-pane stage-pane";
      pane.dataset.pane = "meeting";
      pane.id = "meeting-pane";
      pane.hidden = true;
      pane.innerHTML = `<div class="pane-label"><span>Meeting Desk</span><span class="pane-badge">Recall.ai–lite · no live bot</span></div><div class="meeting-host" id="meeting-host"></div>`;
      split.appendChild(pane);

      if (!$('.panel-view[data-view="meeting"]')) {
        const settings = $('.panel-view[data-view="settings"]');
        if (settings) {
          const sec = document.createElement("section");
          sec.className = "panel-view";
          sec.dataset.view = "meeting";
          sec.hidden = true;
          sec.innerHTML = `<div class="panel-head"><h1>Meeting Desk</h1></div>
            <p class="panel-copy">Meeting recording desk inspired by Recall.ai infrastructure — mock diarized lanes, post-call summary, call prep. Live Zoom/Meet bot declined until API key.</p>
            <button type="button" class="btn btn-primary btn-block" data-goto="meeting">Open Meeting Desk</button>`;
          settings.parentNode.insertBefore(sec, settings);
        }
      }
      if (!$('.rail-btn[data-stage="meeting"]')) {
        const settingsBtn = $('.rail-btn[data-stage="settings"]');
        if (settingsBtn) {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "rail-btn";
          b.dataset.stage = "meeting";
          b.title = "Meeting Desk";
          b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M17 10l4-2v8l-4-2z" fill="none" stroke="currentColor" stroke-width="1.7"/></svg><span>Meet</span>`;
          settingsBtn.parentNode.insertBefore(b, settingsBtn);
          b.addEventListener("click", () => window.MCGoStage?.("meeting"));
        }
      }
    },
    render() {
      this.ensure();
      const host = $("#meeting-host");
      if (!host) return;
      const mode = host.dataset.mode || "bot";
      const view = host.dataset.view || "speaker";
      const conn = connectors();
      const keyed = hasRecallKey();

      host.innerHTML = `
        <div class="meeting-layout">
          <div class="meeting-col">
            <div class="mode-toggle" role="tablist">
              <button type="button" class="mode-btn${mode === "bot" ? " is-active" : ""}" data-mmode="bot">Bot join</button>
              <button type="button" class="mode-btn${mode === "desktop" ? " is-active" : ""}" data-mmode="desktop">Desktop SDK</button>
            </div>
            <p class="panel-copy small">${mode === "bot"
              ? "Bot join UI — would send a meeting bot to Zoom/Meet/Teams when Recall.ai key is connected."
              : "Desktop SDK style — local capture metaphor for speaker vs gallery clean recording."}</p>

            <div class="meet-connector settings-block">
              <p class="eyebrow">Connector · Recall.ai</p>
              <p class="panel-copy small">Recall.ai records and transcribes meetings through its API. This desk is a demo: nothing joins your calls.</p>
              <label class="check"><input type="checkbox" id="recall-conn" ${conn.recall ? "checked" : ""} ${keyed ? "" : ""}><span>Enable Recall.ai connector stub</span></label>
              <p class="panel-copy small">${keyed
                ? "RECALL_* key found in Secrets — connect stub ready (no live join)."
                : "Add RECALL_API_KEY in Secrets vault to enable connect stub. Live Zoom bot declined until key."}</p>
              <button type="button" class="btn btn-ghost btn-sm" id="recall-connect" ${keyed && conn.recall ? "" : "disabled"}>${keyed && conn.recall ? "Connected (stub)" : "Connect (needs key)"}</button>
            </div>

            <div class="settings-block">
              <p class="eyebrow">Call Prep</p>
              <div class="meet-prep-card">
                <strong>Founder pilot sync</strong>
                <div class="panel-copy small">Thu · 10:00 SAST · Google Meet (sample)</div>
                <button type="button" class="btn btn-primary btn-sm" id="meet-brief">Generate call brief</button>
                <div id="meet-brief-out" hidden></div>
              </div>
            </div>
          </div>

          <div class="meeting-col meeting-col--stage">
            <div class="btn-row">
              <button type="button" class="btn btn-ghost btn-sm${view === "speaker" ? " is-active" : ""}" data-mview="speaker">Speaker view</button>
              <button type="button" class="btn btn-ghost btn-sm${view === "gallery" ? " is-active" : ""}" data-mview="gallery">Gallery view</button>
              <button type="button" class="btn btn-accent btn-sm" id="meet-end">End call → summary</button>
            </div>
            <div class="meet-stage ${view === "gallery" ? "is-gallery" : "is-speaker"}">
              ${view === "gallery"
                ? SPEAKERS.map(s => `<div class="meet-tile" style="--sc:${s.color}"><span>${esc(s.name)}</span></div>`).join("")
                : `<div class="meet-tile meet-tile--focus" style="--sc:${SPEAKERS[1].color}"><span>${esc(SPEAKERS[1].name)} · speaking</span></div>
                   <div class="meet-side">${SPEAKERS.filter(s => s.id !== "s2").map(s => `<div class="meet-tile meet-tile--sm" style="--sc:${s.color}"><span>${esc(s.name)}</span></div>`).join("")}</div>`}
            </div>
            <div class="meet-lanes" aria-label="Diarized transcript">
              <p class="eyebrow">Per-speaker lanes · 100% diarized mock</p>
              ${MOCK_LANES.map(l => {
                const sp = SPEAKERS.find(s => s.id === l.sp);
                return `<div class="meet-lane" style="--sc:${sp.color}"><em>${esc(sp.name)}</em><span class="t">${esc(l.t)}</span><p>${esc(l.text)}</p></div>`;
              }).join("")}
            </div>
            <div id="meet-summary" class="meet-summary" hidden></div>
          </div>
        </div>`;

      host.dataset.mode = mode;
      host.dataset.view = view;

      host.querySelectorAll("[data-mmode]").forEach(b => b.addEventListener("click", () => {
        host.dataset.mode = b.dataset.mmode;
        this.render();
      }));
      host.querySelectorAll("[data-mview]").forEach(b => b.addEventListener("click", () => {
        host.dataset.view = b.dataset.mview;
        this.render();
      }));
      $("#recall-conn")?.addEventListener("change", e => {
        const c = connectors();
        c.recall = e.target.checked;
        saveConnectors(c);
        this.render();
      });
      $("#recall-connect")?.addEventListener("click", () => {
        if (!hasRecallKey()) { toast("Add RECALL_API_KEY in Secrets first"); return; }
        toast("Recall.ai connected (stub) — live join declined");
      });
      $("#meet-brief")?.addEventListener("click", () => {
        const out = $("#meet-brief-out");
        if (!out) return;
        out.hidden = false;
        out.innerHTML = `<div class="role-card"><strong>Call brief</strong>
          <ol>
            <li>Confirm pain: unscored discovery notes.</li>
            <li>Demo: Meeting Desk → Portal message push.</li>
            <li>Ask: pilot owner + date.</li>
            <li>Risk: no live bot until Recall key.</li>
          </ol>
          <button type="button" class="btn btn-ghost btn-sm" data-goto="roles" id="meet-to-sales">Open Sales kit</button>
        </div>`;
        try {
          const sw = document.getElementById("role-switcher");
          if (sw) sw.value = "sales";
        } catch (_) {}
        toast("Brief ready · enhances Sales kit");
      });
      $("#meet-end")?.addEventListener("click", () => this.postCall());
    },
    postCall() {
      const box = $("#meet-summary");
      if (!box) return;
      const summary = {
        summary: "Pilot interest in Concierge Meeting Desk pushing diarized action items into Portal. Amina owns pilot if speaker attribution stays clean.",
        actions: [
          { who: "Amina", item: "Own Meeting Desk → Portal pilot" },
          { who: "Jordan", item: "Confirm ops closes loop on portal messages" },
          { who: "Katlego", item: "Send pilot scope + date" }
        ]
      };
      localStorage.setItem(LS.last, JSON.stringify(summary));
      window.MCDB?.setSync?.(LS.last, summary);
      box.hidden = false;
      box.innerHTML = `<p class="eyebrow">Post-call</p>
        <p>${esc(summary.summary)}</p>
        <ul>${summary.actions.map(a => `<li><strong>${esc(a.who)}:</strong> ${esc(a.item)}</li>`).join("")}</ul>
        <div class="btn-row">
          <button type="button" class="btn btn-primary btn-sm" id="meet-push-portal">Push to Portal messages</button>
          <button type="button" class="btn btn-ghost btn-sm" id="meet-push-ops">Add Ops sheet row</button>
        </div>`;
      $("#meet-push-portal")?.addEventListener("click", () => {
        try {
          const st = JSON.parse(localStorage.getItem("mc-portal") || "{}");
          st.messages = st.messages || [];
          summary.actions.forEach(a => st.messages.unshift({ from: a.who, body: a.item, at: Date.now() }));
          localStorage.setItem("mc-portal", JSON.stringify(st));
          window.MCDB?.setSync?.("mc-portal", st);
        } catch (_) {}
        toast("Stub messages pushed to Portal store");
        window.MCGoStage?.("portal");
      });
      $("#meet-push-ops")?.addEventListener("click", () => {
        try {
          const sheet = JSON.parse(localStorage.getItem("mc-sheet") || "null") || { cols: ["Metric", "Owner", "Status", "Notes"], rows: [] };
          sheet.rows.push(["Meeting actions", "Amina", "Open", summary.summary.slice(0, 80)]);
          localStorage.setItem("mc-sheet", JSON.stringify(sheet));
          window.MCDB?.setSync?.("mc-sheet", sheet);
        } catch (_) {}
        toast("Ops sheet row added");
        window.MCGoStage?.("ops");
      });
    }
  };
  window.MCMeeting = api;
})();
