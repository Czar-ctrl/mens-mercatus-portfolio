/**
 * Forex Mercatus Codex portfolio shell — honest status pill from desk health, guided tour that
 * drives the embedded desk via hash routes (#chart · #multi · #flow · #bot), and an
 * iframe fallback when the desk is unreachable. Paper only: nothing here can place an order.
 */
(function () {
  "use strict";
  var K = window.MMDemoKit;
  var DESK = "https://api.mensmercatus.online/forex/";
  var HEALTH = DESK + "api/health";


  var QUOTE_API = "https://open.er-api.com/v6/latest/USD";
  var QUOTE_PAIRS = [
    { id: "EURUSD", base: "EUR", invert: true },
    { id: "GBPUSD", base: "GBP", invert: true },
    { id: "USDJPY", base: "JPY", invert: false },
    { id: "USDCHF", base: "CHF", invert: false },
    { id: "AUDUSD", base: "AUD", invert: true },
    { id: "USDCAD", base: "CAD", invert: false },
    { id: "USDZAR", base: "ZAR", invert: false },
    { id: "NZDUSD", base: "NZD", invert: true }
  ];
  var lastQuotes = {};

  function fmtPx(pair, n) {
    if (!isFinite(n)) return "—";
    var d = (pair.indexOf("JPY") >= 0) ? 3 : 5;
    return n.toFixed(d);
  }

  function renderQuotes(rates, meta) {
    var grid = document.getElementById("fx-quotes-grid");
    var metaEl = document.getElementById("fx-quotes-meta");
    if (!grid) return;
    var html = "";
    QUOTE_PAIRS.forEach(function (p) {
      var raw = rates[p.base];
      if (raw == null) return;
      var px = p.invert ? (1 / raw) : raw;
      var prev = lastQuotes[p.id];
      var cls = "";
      if (prev != null) {
        if (px > prev) cls = " is-up";
        else if (px < prev) cls = " is-down";
      }
      lastQuotes[p.id] = px;
      html += '<li><span class="fx-q-pair">' + p.id + '</span><span class="fx-q-px' + cls + '">' + fmtPx(p.id, px) + "</span></li>";
    });
    grid.innerHTML = html || "<li>No rates</li>";
    if (metaEl) {
      var when = meta && meta.time_last_update_utc ? meta.time_last_update_utc : new Date().toISOString();
      metaEl.textContent = "USD base · " + when + " · auto-refresh 60s";
    }
  }

  function loadQuotes() {
    var metaEl = document.getElementById("fx-quotes-meta");
    fetch(QUOTE_API, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        if (!d || d.result !== "success" || !d.rates) throw new Error("bad payload");
        renderQuotes(d.rates, d);
      })
      .catch(function () {
        if (metaEl) metaEl.textContent = "Quote feed unreachable · retrying…";
      });
  }

  function init() {
    var frame = document.getElementById("fmc-frame");
    var wrap = document.getElementById("fmc-frame-wrap");
    var msg = document.getElementById("fmc-frame-msg");
    var legacy = document.getElementById("fmc-status");
    var status = K ? K.mountStatus(document.getElementById("fmc-kit-status"), { mode: "checking", label: "Paper desk · checking…" }) : null;
    var facts = document.getElementById("fmc-facts");

    function go(hash) {
      if (!frame) return;
      frame.src = DESK + "#" + hash;
      wrap.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (K) {
      K.mountWalkthrough(document.getElementById("fmc-walk"), {
        id: "forex-codex",
        title: "Paper desk · guided tour",
        intro: "Four stops inside the embedded desk. Each chip jumps the desk to the right tab. Paper only — no broker, no real money.",
        steps: [
          { id: "open", label: "Open desk", hint: "The desk loads below (Chart tab). Give it a few seconds on first load." },
          { id: "pair", label: "Pick a symbol", hint: "Use the Symbol picker (SPX · NQ · BTC · XAU · EURUSD) and a timeframe (1m–1h)." },
          { id: "compare", label: "Compare markets", hint: "Multi shows several symbols side by side; Flow shows order-flow context." },
          { id: "paper", label: "One paper action", hint: "Bot tab → press Start or Step 10. Your session-scoped paper bot simulates fills; Reset any time. Broker fields are rejected." }
        ],
        onStep: function (s, i, api) {
          go({ open: "chart", pair: "chart", compare: "multi", paper: "bot" }[s.id]);
          api.done(s.id);
        },
        completeText: "Tour done. Open the full-screen desk for more room, or browse the desk screenshots."
      });
    }

    fetch(HEALTH, { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (h) {
        var mode = (h && h.paper_mode) || "paper";
        var n = h && h.paper_sessions && h.paper_sessions.sessions;
        var label = "Live paper desk · online · " + mode + (n != null ? " · " + n + " active sessions" : "");
        if (legacy) legacy.textContent = label;
        if (status) status.set("paper", "PAPER · " + mode.replace(/_/g, " ") + (n != null ? " · " + n + " sessions" : ""), "paper_only=" + !!h.paper_only);
        if (facts) {
          var syms = (h.symbols || []).join(" · ");
          var data = (h.data || []).join(" · ");
          facts.textContent = "From desk health: paper_only=" + (h.paper_only ? "true" : "false") +
            (syms ? " · symbols " + syms : "") + (data ? " · data " + data : "") +
            (h.paper_sessions ? " · max " + h.paper_sessions.max + " sessions, " + Math.round((h.paper_sessions.ttl_s || 0) / 3600) + " h idle TTL" : "");
        }
      })
      .catch(function () {
        if (legacy) { legacy.textContent = "Live paper desk · unreachable right now"; legacy.classList.remove("live"); }
        if (status) status.set("offline", "Desk unreachable · screenshots below");
        if (wrap) wrap.classList.add("is-failed");
        if (msg) msg.innerHTML = "<strong>The live paper desk is not responding right now.</strong><span>Try <a href=\"" + DESK + "\" target=\"_blank\" rel=\"noopener\">opening it directly</a>, or browse the <a href=\"../fmc-screenshots/\">desk screenshots</a>.</span>";
      });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
