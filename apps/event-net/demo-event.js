/**
 * Event Net — interactive Blueprint Event shift walkthrough (DEMO, in-browser only).
 * Stages mirror the existing static Blueprint Event pack: signup gate → rate lock →
 * check-in → on-shift checklist → checkout & payout. Figures are the pack's own
 * illustrative mockup values (R30.23 NMW floor, R42.00 locked, 6 h) — not offers,
 * not balances. Nothing is stored server-side; progress lives in localStorage.
 */
(function () {
  "use strict";
  var K = window.MMDemoKit;
  var STAGES = [
    { id: "signup", label: "Signup gate", screen: "../../blueprint/event/signup-gate.html",
      hint: "Tick the three gates. Assist explains missing fields — it never waives a gate." },
    { id: "rate", label: "Rate lock", screen: "../../blueprint/event/rate-lock.html",
      hint: "Lock the illustrative rate before accept. The NMW floor and 4-hour rule are enforced, not negotiable." },
    { id: "checkin", label: "Check-in", screen: "../../blueprint/event/check-in-out.html",
      hint: "Try both: inside the geofence + window succeeds; outside is blocked." },
    { id: "shift", label: "On shift", screen: "../../blueprint/event/vehicle-checklist.html",
      hint: "Goods-only vehicle checklist. Passenger e-hailing is out of scope (NLTA)." },
    { id: "payout", label: "Checkout & payout", screen: "../../blueprint/event/payout.html",
      hint: "Release needs supervisor checkout and no open dispute. Toggle a dispute to see the hold path." }
  ];
  var state = { stage: 0, done: {}, log: [] };
  var walk, els = {};

  function stamp() {
    return new Date().toLocaleTimeString("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit" }) + " SAST";
  }
  function log(msg) {
    state.log.unshift(stamp() + " · " + msg);
    els.log.textContent = state.log.slice(0, 8).join("\n");
  }
  function complete(id, msg) {
    if (!state.done[id]) { state.done[id] = true; log(msg); }
    if (walk) walk.done(id);
    paintNav();
    var idx = STAGES.findIndex(function (s) { return s.id === id; });
    var next = els.panel.querySelector('[data-next]');
    if (next) next.disabled = false;
    if (idx === STAGES.length - 1) els.finale.hidden = false;
  }

  function paintNav() {
    // Stage navigator = the walkthrough chips (MMDemoKit); highlight the current stage there.
    if (walk && walk.el) walk.el.querySelectorAll(".mm-demo-bar__steps .mm-demo-chip").forEach(function (b, i) {
      b.classList.toggle("is-active", i === state.stage);
      if (i === state.stage) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
    });
    var n = Object.keys(state.done).length;
    els.count.textContent = "Stage " + (state.stage + 1) + " of " + STAGES.length + " · " + n + " complete";
  }

  function stageBody(s) {
    switch (s.id) {
      case "signup":
        return '<p>Before a worker can be rostered, the pack shows three gates:</p>' +
          '<div class="ev-checks">' +
          '<label><input type="checkbox" data-gate> 18+ confirmed</label>' +
          '<label><input type="checkbox" data-gate> Health declaration submitted</label>' +
          '<label><input type="checkbox" data-gate> Criminal-check <em>reference ID</em> on file (operators see refs, not certificates)</label>' +
          '</div><button type="button" class="mm-demo-chip mm-demo-chip--solid" data-act="gate" disabled>Submit gate</button>';
      case "rate":
        return '<div class="ev-figs"><div><b>R30.23</b><span>NMW floor / hr · illustrative 2026 mockup figure</span></div>' +
          '<div><b>R42.00</b><span>Locked offer / hr · pack mockup value</span></div></div>' +
          '<p>Shift · Venue steward · 16:00–22:00 · 6 h scheduled. Where employment applies, the 4-hour rule pays at least four hours at the locked rate on early release (subject to BCEA / sectoral rules).</p>' +
          '<button type="button" class="mm-demo-chip mm-demo-chip--solid" data-act="lock">Lock rate before accept</button>';
      case "checkin":
        return '<p>Check-in only works inside the venue geofence <em>and</em> the published window (15:30–16:30 in the mockup). Simulate a phone position:</p>' +
          '<div class="mm-demo-chips"><button type="button" class="mm-demo-chip" data-act="geo-out">Outside geofence</button>' +
          '<button type="button" class="mm-demo-chip mm-demo-chip--solid" data-act="geo-in">Inside geofence · in window</button></div>' +
          '<div class="ev-result" data-result aria-live="polite"></div>';
      case "shift":
        return '<p>Goods-movement vehicle checklist (pre-shift photos are simulated here):</p><div class="ev-checks">' +
          '<label><input type="checkbox" data-veh> Front + rear photo captured</label>' +
          '<label><input type="checkbox" data-veh> Fuel gauge + odometer recorded</label>' +
          '<label><input type="checkbox" data-veh> No damage beyond logged notes</label>' +
          '</div><button type="button" class="mm-demo-chip mm-demo-chip--solid" data-act="veh" disabled>Submit checklist</button>' +
          '<p class="mm-demo-note">Skills ladder badges recognise certifications — never a punishment score.</p>';
      case "payout":
        return '<div class="ev-checks">' +
          '<label><input type="checkbox" data-sup> Supervisor confirms checkout</label>' +
          '<label><input type="checkbox" data-dispute> Dispute open on this escrow</label></div>' +
          '<div class="ev-figs"><div><b>6.0 h</b><span>Recognised hours · mockup</span></div><div><b>R42.00</b><span>Locked / hr · mockup</span></div></div>' +
          '<button type="button" class="mm-demo-chip mm-demo-chip--solid" data-act="release">Request Netza release</button>' +
          '<div class="ev-result" data-result aria-live="polite"></div>';
    }
    return "";
  }

  function wire(s) {
    var p = els.panel;
    var res = p.querySelector("[data-result]");
    if (s.id === "signup") {
      var gates = p.querySelectorAll("[data-gate]"), btn = p.querySelector('[data-act="gate"]');
      p.querySelector(".ev-body").addEventListener("change", function () { btn.disabled = !Array.prototype.every.call(gates, function (g) { return g.checked; }); });
      btn.addEventListener("click", function () { btn.textContent = "Gate passed ✓"; btn.disabled = true; complete("signup", "Signup gate passed (18+, health, check ref)"); });
    }
    if (s.id === "rate") {
      var lb = p.querySelector('[data-act="lock"]');
      lb.addEventListener("click", function () { lb.textContent = "Locked · R42.00 / hr (mockup) ✓"; lb.disabled = true; complete("rate", "Rate locked at mockup R42.00/hr ≥ NMW floor"); });
    }
    if (s.id === "checkin") {
      p.querySelector('[data-act="geo-out"]').addEventListener("click", function () {
        res.className = "ev-result is-bad"; res.textContent = "Blocked · outside venue geofence. Move inside the boundary to check in. (Error path demo)";
        log("Check-in blocked — outside geofence");
      });
      p.querySelector('[data-act="geo-in"]').addEventListener("click", function () {
        res.className = "ev-result is-ok"; res.textContent = "Checked in at " + stamp() + " (simulated position inside geofence, inside window).";
        complete("checkin", "Checked in inside geofence + window");
      });
    }
    if (s.id === "shift") {
      var v = p.querySelectorAll("[data-veh]"), vb = p.querySelector('[data-act="veh"]');
      p.querySelector(".ev-body").addEventListener("change", function () { vb.disabled = !Array.prototype.every.call(v, function (g) { return g.checked; }); });
      vb.addEventListener("click", function () { vb.textContent = "Checklist submitted ✓"; vb.disabled = true; complete("shift", "Vehicle checklist submitted (goods only)"); });
    }
    if (s.id === "payout") {
      p.querySelector('[data-act="release"]').addEventListener("click", function () {
        var sup = p.querySelector("[data-sup]").checked, disp = p.querySelector("[data-dispute]").checked;
        if (!sup) { res.className = "ev-result is-bad"; res.textContent = "Held · waiting on supervisor checkout. Early self-checkout never releases escrow."; log("Release held — no supervisor checkout"); return; }
        if (disp) { res.className = "ev-result is-bad"; res.textContent = "Held · open dispute. Evidence pack goes to review; escrow stays held."; log("Release held — dispute open"); return; }
        res.className = "ev-result is-ok";
        res.textContent = "Release path open · ledgered to Netza (DEMO — no real money, mockup escrow ESC-88421). Assist never invents payout amounts.";
        complete("payout", "Netza release path opened (DEMO)");
      });
    }
  }

  function show(i) {
    if (i < 0 || i >= STAGES.length) return;
    state.stage = i;
    var s = STAGES[i];
    els.panel.innerHTML =
      '<p class="mm-demo-label">Stage ' + (i + 1) + " · " + s.label + "</p>" +
      '<p class="mm-demo-note" style="margin-top:0">' + s.hint + "</p>" +
      '<div class="ev-body">' + stageBody(s) + "</div>" +
      '<div class="ev-foot mm-demo-chips">' +
        '<button type="button" class="mm-demo-chip mm-demo-chip--ghost" data-prev ' + (i === 0 ? "disabled" : "") + ">← Back</button>" +
        '<button type="button" class="mm-demo-chip" data-next ' + (state.done[s.id] ? "" : "disabled") + ">" + (i === STAGES.length - 1 ? "Finish" : "Next stage →") + "</button>" +
        '<button type="button" class="mm-demo-chip mm-demo-chip--ghost" data-screen>Preview static screen</button>' +
        '<a class="mm-demo-chip mm-demo-chip--ghost" href="' + s.screen + '">Open screen ↗</a>' +
      "</div>" +
      '<div class="ev-preview" data-preview hidden></div>';
    els.panel.querySelector("[data-prev]").addEventListener("click", function () { show(i - 1); });
    els.panel.querySelector("[data-next]").addEventListener("click", function () {
      if (i < STAGES.length - 1) show(i + 1); else els.finale.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    els.panel.querySelector("[data-screen]").addEventListener("click", function () { preview(s); });
    if (state.done[s.id]) {
      els.panel.querySelectorAll(".ev-body button, .ev-body input").forEach(function (x) { x.disabled = true; });
      var note = document.createElement("p"); note.className = "ev-result is-ok"; note.textContent = "Stage already complete ✓ — Reset to replay.";
      els.panel.querySelector(".ev-body").appendChild(note);
    } else wire(s);
    paintNav();
  }

  function preview(s) {
    var box = els.panel.querySelector("[data-preview]");
    box.hidden = false;
    box.innerHTML = '<div class="mm-demo-empty"><strong>Loading static screen…</strong></div>';
    fetch(s.screen, { method: "GET", cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      box.innerHTML = '<iframe title="' + s.label + ' — static Blueprint Event mockup" src="' + s.screen + '" loading="lazy"></iframe>';
    }).catch(function () {
      K.mountEmpty(box.appendChild(document.createElement("div")), { title: "Static screen unavailable", body: "Mens Mercatus Blueprint mockup for this stage did not load. The interactive stage above still works." });
      box.firstChild.remove();
    });
  }

  function reset() {
    state = { stage: 0, done: {}, log: [] };
    els.log.textContent = "No events yet — start at Stage 1.";
    els.finale.hidden = true;
    if (walk) walk.reset();
    show(0);
  }

  function init() {
    if (!K) return;
    els.panel = document.getElementById("ev-panel");
    els.log = document.getElementById("ev-log");
    els.count = document.getElementById("ev-count");
    els.finale = document.getElementById("ev-finale");
    if (!els.panel) return;
    K.mountStatus(document.getElementById("ev-status"), { mode: "demo", label: "DEMO · simulated shift · no backend", title: "Static Blueprint Event pack + in-browser state only" });
    walk = K.mountWalkthrough(document.getElementById("ev-walk"), {
      id: "event-net-v1",
      title: "Event shift · stages",
      intro: "Run one Blueprint Event shift end to end: gate → rate → check-in → checklist → payout.",
      steps: STAGES.map(function (s) { return { id: s.id, label: s.label, hint: s.hint }; }),
      onStep: function (s, i) { show(i); },
      completeText: "Shift complete. Open the Blueprint Event hub for all 12 static screens, or ask Mercatus Assist about any gate."
    });
    // Stage completion is session-scoped; the walkthrough bar remembers chips across visits.
    if (walk) walk.reset();
    document.getElementById("ev-reset").addEventListener("click", reset);
    els.log.textContent = "No events yet — start at Stage 1.";
    show(0);
  }
  window.EventNetDemo = { STAGES: STAGES };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
