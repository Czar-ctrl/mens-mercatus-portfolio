/* Replit-inspired lite patterns — local stubs only (no cloud/DB/simulators) */
(function () {
  "use strict";
  const LS = { kanban: "mc-agent-kanban", secrets: "mc-secrets-vault", artifact: "mc-artifact", deploy: "mc-deploy-type", brainstorm: "mc-brainstorm", design: "mc-design-frames" };
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const toast = m => window.MCToast?.(m);

  const COLS = ["To do", "Running", "Review", "Merged"];
  const ARTIFACTS = ["Web", "Mobile", "Deck", "Data", "Video"];
  const DEPLOYS = ["Static", "Autoscale", "Reserved VM", "Scheduled"];

  function loadKanban() {
    try { const d = JSON.parse(localStorage.getItem(LS.kanban)); if (d && d["To do"]) return d; } catch (_) {}
    return {
      "To do": [{ id: "a1", title: "Wire Launch Path cross-links", agent: "Agent 2" }],
      "Running": [{ id: "a2", title: "Theme token audit", agent: "Agent 1" }],
      "Review": [{ id: "a3", title: "Portal OTP mock", agent: "Agent 3" }],
      "Merged": [{ id: "a4", title: "Puzzle strip L→R", agent: "Agent 4" }]
    };
  }
  function saveKanban(d) { localStorage.setItem(LS.kanban, JSON.stringify(d)); }

  function loadSecrets() {
    try { return JSON.parse(localStorage.getItem(LS.secrets) || "[]"); } catch (_) { return []; }
  }
  function saveSecrets(d) { localStorage.setItem(LS.secrets, JSON.stringify(d)); }

  function loadFrames() {
    try { const d = JSON.parse(localStorage.getItem(LS.design)); if (d && d.length) return d; } catch (_) {}
    return [
      { id: "f1", title: "Mockup", w: 280, h: 180, kind: "mock" },
      { id: "f2", title: "Live preview", w: 320, h: 200, kind: "live" },
      { id: "f3", title: "Mobile frame", w: 160, h: 280, kind: "mobile" }
    ];
  }
  function saveFrames(d) { localStorage.setItem(LS.design, JSON.stringify(d)); }

  const FINDINGS = [
    { sev: "med", title: "localStorage holds session-like keys", fix: "Document demo-only persistence" },
    { sev: "low", title: "iframe SAMEORIGIN dependency", fix: "Keep Open Concierge fallback" },
    { sev: "low", title: "No CSP report-uri", fix: "Optional hardening note in Settings" },
    { sev: "info", title: "Secrets vault is local mock", fix: "Never put real keys in demo vault" }
  ];

  const api = {
    ensure() {
      this.scrubPresence();
      this.injectRailExtras();
      this.injectBrainstorm();
      this.injectMultiArtifact();
      this.patchIdeGhost();
      this.patchSalesBrief();
    },
    scrubPresence() {
      ["#mc-presence", "#mc-cursors"].forEach(sel => {
        document.querySelectorAll(sel).forEach(el => el.remove());
      });
      document.querySelectorAll(".mc-presence, .mc-av, .mc-cursor, .mc-cursors").forEach(el => el.remove());
    },
    injectRailExtras() {
      if ($("#replit-tools-pane")) return;
      const split = $("#stage-split");
      if (!split) return;
      const pane = document.createElement("section");
      pane.className = "replit-pane stage-pane";
      pane.dataset.pane = "replit";
      pane.id = "replit-tools-pane";
      pane.hidden = true;
      pane.innerHTML = `<div class="pane-label"><span>Agent Lab</span><span class="pane-badge">Replit-lite · local</span></div><div class="replit-body" id="replit-body"></div>`;
      split.appendChild(pane);

      // Left panel
      if (!$('.panel-view[data-view="replit"]')) {
        const settings = $('.panel-view[data-view="settings"]');
        if (settings) {
          const sec = document.createElement("section");
          sec.className = "panel-view";
          sec.dataset.view = "replit";
          sec.hidden = true;
          sec.innerHTML = `<div class="panel-head"><h1>Agent Lab</h1></div>
            <p class="panel-copy">Replit-inspired local stubs: Agent Kanban, Security Agent, deploy picker, secrets vault, design frames.</p>
            <button type="button" class="btn btn-primary btn-block" data-goto="replit">Open Agent Lab</button>`;
          settings.parentNode.insertBefore(sec, settings);
        }
      }
      // Rail button before settings
      if (!$('.rail-btn[data-stage="replit"]')) {
        const settingsBtn = $('.rail-btn[data-stage="settings"]');
        if (settingsBtn) {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "rail-btn";
          b.dataset.stage = "replit";
          b.title = "Agent Lab";
          b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="7" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="13" y="5" width="7" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="4" y="13" width="7" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="13" y="13" width="7" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.7"/></svg><span>Agents</span>`;
          settingsBtn.parentNode.insertBefore(b, settingsBtn);
          b.addEventListener("click", () => window.MCGoStage?.("replit"));
        }
      }
    },
    injectBrainstorm() {
      if ($("#opt-brainstorm")) return;
      const hint = $("#mode-hint");
      if (!hint) return;
      const lab = document.createElement("label");
      lab.className = "check brainstorm-toggle";
      lab.innerHTML = `<input type="checkbox" id="opt-brainstorm"><span>Free brainstorm (Plan · no-credit metaphor)</span>`;
      hint.parentNode.insertBefore(lab, hint.nextSibling);
      const on = localStorage.getItem(LS.brainstorm) === "1";
      lab.querySelector("input").checked = on;
      document.documentElement.classList.toggle("mc-brainstorm", on);
      lab.querySelector("input").addEventListener("change", e => {
        localStorage.setItem(LS.brainstorm, e.target.checked ? "1" : "0");
        document.documentElement.classList.toggle("mc-brainstorm", e.target.checked);
        toast(e.target.checked ? "Brainstorm on — Plan stays free metaphor" : "Brainstorm off");
      });
    },
    injectMultiArtifact() {
      if ($("#mc-artifacts")) return;
      const puzzle = $("#puzzle-strip");
      if (!puzzle) return;
      const strip = document.createElement("div");
      strip.id = "mc-artifacts";
      strip.className = "mc-artifacts";
      strip.setAttribute("role", "tablist");
      strip.setAttribute("aria-label", "Multi-artifact project context");
      const cur = localStorage.getItem(LS.artifact) || "Web";
      strip.innerHTML = ARTIFACTS.map(a =>
        `<button type="button" class="mc-art-chip${a === cur ? " is-active" : ""}" data-art="${a}" role="tab" aria-selected="${a === cur}">${a}</button>`
      ).join("") + `<span class="mc-art-ctx">Shared project context</span>`;
      puzzle.after(strip);
      strip.addEventListener("click", e => {
        const b = e.target.closest("[data-art]");
        if (!b) return;
        localStorage.setItem(LS.artifact, b.dataset.art);
        $$(".mc-art-chip", strip).forEach(x => {
          const on = x === b;
          x.classList.toggle("is-active", on);
          x.setAttribute("aria-selected", on ? "true" : "false");
        });
        toast("Artifact focus: " + b.dataset.art);
      });
    },
    patchIdeGhost() {
      // Hook after IDE renders — observe ide-host
      const host = $("#ide-host");
      if (!host || host.dataset.ghostBound) return;
      host.dataset.ghostBound = "1";
      const obs = new MutationObserver(() => this.ensureGhostBar(host));
      obs.observe(host, { childList: true, subtree: true });
      this.ensureGhostBar(host);
    },
    ensureGhostBar(host) {
      if (!host || $("#ghostwriter-bar", host)) return;
      const bar = document.createElement("div");
      bar.id = "ghostwriter-bar";
      bar.className = "ghostwriter-bar";
      bar.innerHTML = `<span class="gw-label">Ghostwriter</span><code class="gw-sug">// suggest: export function passGate(stage, score){ return score &gt;= (stage===1?60:70); }</code>
        <button type="button" class="btn btn-primary btn-sm" id="gw-accept">Accept</button>
        <button type="button" class="btn btn-ghost btn-sm" id="gw-reject">Reject</button>`;
      host.prepend(bar);
      $("#gw-accept", bar)?.addEventListener("click", () => { toast("Suggestion accepted (local stub)"); bar.classList.add("is-done"); });
      $("#gw-reject", bar)?.addEventListener("click", () => { toast("Suggestion rejected"); bar.remove(); });
    },
    patchSalesBrief() {
      document.addEventListener("click", e => {
        if (e.target.id === "sales-brief-gen" || e.target.closest?.("#sales-brief-gen")) {
          const out = $("#sales-brief-out");
          const intent = ($("#intent-text")?.value || "Untitled venture").slice(0, 120);
          const html = `<div class="role-card"><strong>Customer call brief</strong>
            <p><em>Venture:</em> ${esc(intent)}</p>
            <ol>
              <li>Open: confirm role + urgency in 30s.</li>
              <li>Discovery: current workaround + cost of status quo.</li>
              <li>Demo: one Concierge screen that matches their pain.</li>
              <li>Close: next step + date — no “circle back”.</li>
            </ol>
            <p class="panel-copy small">Stub generator · Sales Role Kit · local</p></div>`;
          if (out) out.innerHTML = html;
          else toast("Open Sales Role Kit to see brief");
        }
      });
    },
    render() {
      this.ensure();
      const body = $("#replit-body");
      if (!body) return;
      const kb = loadKanban();
      const secrets = loadSecrets();
      const frames = loadFrames();
      const deploy = localStorage.getItem(LS.deploy) || "Static";

      body.innerHTML = `
        <div class="role-kit-grid">
          <div class="role-section" style="grid-column:1/-1">
            <h3>Agent Kanban</h3>
            <p class="panel-copy small">Parallel agents · approve merges into main (Agent 4 signature stub).</p>
            <div class="kanban lp-agent-kanban" id="agent-kanban">${COLS.map(col => `
              <div class="kanban-col" data-col="${esc(col)}"><h4>${esc(col)}</h4>
                ${(kb[col] || []).map(c => `<div class="cand-card" data-id="${esc(c.id)}" data-col="${esc(col)}">
                  <strong>${esc(c.title)}</strong><div>${esc(c.agent)}</div>
                  ${col === "Review" ? `<button type="button" class="btn btn-accent btn-sm" data-merge="${esc(c.id)}">Approve merge</button>` : ""}
                </div>`).join("")}
              </div>`).join("")}</div>
            <button type="button" class="btn btn-ghost btn-sm" id="agent-add-task">Add task</button>
          </div>

          <div class="role-section">
            <h3>Security Agent</h3>
            <button type="button" class="btn btn-primary btn-sm" id="sec-scan">Run scan</button>
            <div id="sec-findings" class="sec-findings"></div>
          </div>

          <div class="role-section">
            <h3>Deploy type</h3>
            <p class="panel-copy small">Picker only — no real provision.</p>
            <div class="mc-deploy-picker">${DEPLOYS.map(d =>
              `<button type="button" class="mc-art-chip${d === deploy ? " is-active" : ""}" data-deploy="${esc(d)}">${esc(d)}</button>`
            ).join("")}</div>
          </div>

          <div class="role-section">
            <h3>Secrets vault</h3>
            <p class="panel-copy small">Key/value localStorage mock — demo only.</p>
            <div class="btn-row" style="flex-wrap:wrap;gap:6px">
              <input id="sec-key" placeholder="KEY" maxlength="40" style="flex:1;min-width:80px">
              <input id="sec-val" placeholder="value" maxlength="80" style="flex:1;min-width:80px">
              <button type="button" class="btn btn-ghost btn-sm" id="sec-add">Add</button>
            </div>
            <ul class="sec-list" id="sec-list">${secrets.map((s, i) =>
              `<li><code>${esc(s.k)}</code> = ••••• <button type="button" class="btn btn-ghost btn-sm" data-secrem="${i}">✕</button></li>`
            ).join("") || "<li class='panel-copy small'>Empty</li>"}</ul>
          </div>

          
          <div class="role-section" style="grid-column:1/-1">
            <h3>Connectors</h3>
            <p class="panel-copy small">Toggles + Secrets · no real money movement. Stripe test stub · Sheets CSV bridge · Slack draft-only.</p>
            <div id="connectors-panel" class="connectors-panel"></div>
          </div>
          <div class="role-section" style="grid-column:1/-1">
            <h3>Design Canvas</h3>
            <p class="panel-copy small">Frames — drag corner to resize (stub).</p>
            <div class="design-board" id="design-board">${frames.map(f => `
              <div class="design-frame" data-fid="${esc(f.id)}" style="width:${f.w}px;height:${f.h}px">
                <header>${esc(f.title)} <span class="pane-badge">${esc(f.kind)}</span></header>
                <div class="design-frame-body">${f.kind === "live"
                  ? `<div class="df-live">Live preview stub<br><strong>Mercatus Concierge</strong></div>`
                  : f.kind === "mobile"
                    ? `<div class="df-mobile">375×812<br>mock</div>`
                    : `<div class="df-mock">Wire · mockup</div>`}</div>
                <i class="df-resize" title="Resize"></i>
              </div>`).join("")}</div>
          </div>
        </div>`;

      // Kanban merge
      body.querySelectorAll("[data-merge]").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = btn.dataset.merge;
          const data = loadKanban();
          const item = (data.Review || []).find(x => x.id === id);
          if (!item) return;
          data.Review = data.Review.filter(x => x.id !== id);
          item.agent = "Agent 4 ✓";
          data.Merged = data.Merged || [];
          data.Merged.unshift(item);
          saveKanban(data);
          toast("Merged into main (Agent 4 signature)");
          this.render();
        });
      });
      $("#agent-add-task")?.addEventListener("click", () => {
        const title = prompt("Task title");
        if (!title) return;
        const data = loadKanban();
        data["To do"].push({ id: "a" + Date.now(), title, agent: "Agent " + (1 + Math.floor(Math.random() * 4)) });
        saveKanban(data);
        this.render();
      });

      $("#sec-scan")?.addEventListener("click", () => {
        const box = $("#sec-findings");
        if (!box) return;
        box.innerHTML = FINDINGS.map(f =>
          `<div class="sec-item sev-${esc(f.sev)}"><strong>${esc(f.title)}</strong><div>${esc(f.fix)}</div>
           <button type="button" class="btn btn-ghost btn-sm" data-spawn="${esc(f.fix)}">Spawn Kanban fix</button></div>`
        ).join("");
        box.querySelectorAll("[data-spawn]").forEach(b => b.addEventListener("click", () => {
          const data = loadKanban();
          data["To do"].push({ id: "s" + Date.now(), title: b.dataset.spawn, agent: "Security Agent" });
          saveKanban(data);
          toast("Fix task spawned → To do");
          this.render();
        }));
        toast("Scan complete · mock findings");
      });

      body.querySelectorAll("[data-deploy]").forEach(b => b.addEventListener("click", () => {
        localStorage.setItem(LS.deploy, b.dataset.deploy);
        toast("Deploy type: " + b.dataset.deploy + " (picker only)");
        this.render();
      }));

      $("#sec-add")?.addEventListener("click", () => {
        const k = $("#sec-key")?.value?.trim();
        const v = $("#sec-val")?.value?.trim();
        if (!k) return;
        const list = loadSecrets();
        list.push({ k, v: v || "" });
        saveSecrets(list);
        this.render();
      });
      body.querySelectorAll("[data-secrem]").forEach(b => b.addEventListener("click", () => {
        const list = loadSecrets();
        list.splice(+b.dataset.secrem, 1);
        saveSecrets(list);
        this.render();
      }));


      this.renderConnectors();
      // Device Lab preview beside design board
      const dbHost = body.querySelector("#design-device-lab");
      if (!dbHost) {
        const board = body.querySelector("#design-board");
        if (board && window.MCDevice) {
          const wrap = document.createElement("div");
          wrap.id = "design-device-lab";
          wrap.className = "design-device-lab";
          board.parentNode.appendChild(wrap);
          const live = `<div class="df-live" style="padding:12px;font-size:11px"><strong>Mercatus Concierge</strong><br>Design preview</div>`;
          window.MCDevice.mountInto(wrap, live, () => {});
        }
      }


      // Resize frames
      body.querySelectorAll(".design-frame").forEach(frame => {
        const handle = frame.querySelector(".df-resize");
        if (!handle) return;
        let start = null;
        handle.addEventListener("pointerdown", e => {
          e.preventDefault();
          start = { x: e.clientX, y: e.clientY, w: frame.offsetWidth, h: frame.offsetHeight };
          handle.setPointerCapture(e.pointerId);
        });
        handle.addEventListener("pointermove", e => {
          if (!start) return;
          const w = Math.max(120, start.w + (e.clientX - start.x));
          const h = Math.max(100, start.h + (e.clientY - start.y));
          frame.style.width = w + "px";
          frame.style.height = h + "px";
        });
        handle.addEventListener("pointerup", () => {
          if (!start) return;
          start = null;
          const frames = loadFrames();
          const f = frames.find(x => x.id === frame.dataset.fid);
          if (f) { f.w = frame.offsetWidth; f.h = frame.offsetHeight; saveFrames(frames); }
        });
      });
    },
    renderConnectors() {
      const host = document.getElementById("connectors-panel");
      if (!host) return;
      let conn = {};
      try { conn = JSON.parse(localStorage.getItem("mc-connectors") || "{}"); } catch (_) {}
      let secrets = [];
      try { secrets = JSON.parse(localStorage.getItem("mc-secrets-vault") || "[]"); } catch (_) {}
      const hasStripe = secrets.some(s => /STRIPE/i.test(s.k) && s.v);
      const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
      host.innerHTML = `
        <div class="conn-grid">
          <div class="conn-card">
            <strong>Stripe</strong>
            <label class="check"><input type="checkbox" data-conn="stripe" ${conn.stripe ? "checked" : ""}><span>Enabled</span></label>
            <p class="panel-copy small">${hasStripe ? "STRIPE_PK in Secrets — test checkout ready (stub)." : "No STRIPE_PK — demo Pay stub only. No charges."}</p>
            <button type="button" class="btn btn-ghost btn-sm" id="stripe-demo">${hasStripe ? "Open test checkout stub" : "Demo Pay stub"}</button>
          </div>
          <div class="conn-card">
            <strong>Google Sheets</strong>
            <label class="check"><input type="checkbox" data-conn="sheets" ${conn.sheets ? "checked" : ""}><span>Enabled</span></label>
            <p class="panel-copy small">CSV sync bridge to Ops sheet (download/upload).</p>
            <button type="button" class="btn btn-ghost btn-sm" id="sheets-export">Download Ops CSV</button>
            <label class="btn btn-ghost btn-sm" style="cursor:pointer">Upload CSV<input type="file" id="sheets-import" accept=".csv,text/csv" hidden></label>
          </div>
          <div class="conn-card">
            <strong>Slack</strong>
            <label class="check"><input type="checkbox" data-conn="slack" ${conn.slack ? "checked" : ""}><span>Enabled</span></label>
            <p class="panel-copy small">Draft-only notify stub — never sends.</p>
            <button type="button" class="btn btn-ghost btn-sm" id="slack-draft">Draft notify</button>
            <pre class="utm-preview" id="slack-draft-out" hidden></pre>
          </div>
          <div class="conn-card">
            <strong>Recall.ai</strong>
            <label class="check"><input type="checkbox" data-conn="recall" ${conn.recall ? "checked" : ""}><span>Enabled</span></label>
            <p class="panel-copy small">Meeting Desk connector. Live bot declined until key.</p>
            <button type="button" class="btn btn-ghost btn-sm" data-goto="meeting">Open Meeting Desk</button>
          </div>
        </div>`;
      const save = () => {
        localStorage.setItem("mc-connectors", JSON.stringify(conn));
        window.MCDB?.setSync?.("mc-connectors", conn);
      };
      host.querySelectorAll("[data-conn]").forEach(ck => ck.addEventListener("change", () => {
        conn[ck.dataset.conn] = ck.checked;
        save();
      }));
      host.querySelector("#stripe-demo")?.addEventListener("click", () => {
        window.MCToast?.(hasStripe ? "Test checkout stub — no charge" : "Demo Pay stub — no Stripe key");
      });
      host.querySelector("#sheets-export")?.addEventListener("click", () => {
        try {
          const sheet = JSON.parse(localStorage.getItem("mc-sheet") || "null");
          if (!sheet) { window.MCToast?.("No Ops sheet"); return; }
          const lines = [sheet.cols.join(",")].concat(sheet.rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")));
          const a = document.createElement("a");
          a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
          a.download = "concierge-ops-sheet.csv";
          a.click();
          window.MCToast?.("Sheets bridge: CSV downloaded");
        } catch (_) { window.MCToast?.("Export failed"); }
      });
      host.querySelector("#sheets-import")?.addEventListener("change", e => {
        const f = e.target.files?.[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
          const lines = String(reader.result).trim().split(/\r?\n/);
          const parse = line => line.split(",").map(c => c.replace(/^"|"$/g, "").replace(/""/g, '"'));
          const sheet = { cols: parse(lines[0]), rows: lines.slice(1).map(parse) };
          localStorage.setItem("mc-sheet", JSON.stringify(sheet));
          window.MCDB?.setSync?.("mc-sheet", sheet);
          window.MCToast?.("Sheets bridge: CSV imported to Ops");
        };
        reader.readAsText(f);
      });
      host.querySelector("#slack-draft")?.addEventListener("click", () => {
        const out = host.querySelector("#slack-draft-out");
        if (out) {
          out.hidden = false;
          out.textContent = `[draft only]\n#concierge\nMercatus Concierge update: Launch Path / Meeting Desk demo ready. (not sent)`;
        }
        window.MCToast?.("Slack draft only — not sent");
      });
    }
  };

  window.MCReplit = api;
})();
