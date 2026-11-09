/**
 * Marketing site — ClickUp Ops desk panel
 * No token required to view scaffolding; live list when local proxy reports token.
 */
(function () {
  "use strict";

  var CHECKLIST = [
    "Create ClickUp Personal API token (Settings → Apps)",
    "Copy Workspace / Team ID → CLICKUP_TEAM_ID",
    "Create Space: Mercatus Concierge",
    "Create lists: Cold-call pipeline · DropNet follow-ups · Concierge build · Meeting Desk prep",
    "Copy list IDs into clickup/config.json (from config.example.json)",
    "Put CLICKUP_API_TOKEN in .env.local (gitignored)",
    "Run: node clickup/proxy-server.js  (port 8788)",
    "Optional production: proxy at https://api.mensmercatus.online/clickup/"
  ].join("\n");

  function $(sel, el) { return (el || document).querySelector(sel); }

  function setStatus(el, state, detail) {
    if (!el) return;
    el.dataset.state = state;
    el.className = "cu-status cu-status--" + state;
    var label = {
      missing: "Token missing — scaffolding only",
      checking: "Checking proxy…",
      connected: "Connected via proxy",
      mock: "Mock tasks (no live list yet)",
      error: "Proxy / API error"
    }[state] || state;
    el.innerHTML = "<span class=\"cu-dot\" aria-hidden=\"true\"></span><strong>" + label + "</strong>" +
      (detail ? "<span class=\"cu-status-detail\">" + detail + "</span>" : "");
  }

  function renderTasks(host, tasks, source) {
    if (!host) return;
    if (!tasks || !tasks.length) {
      host.innerHTML = "<p class=\"cu-empty\">No open tasks.</p>";
      return;
    }
    host.innerHTML =
      "<p class=\"cu-source\">Source: <code>" + source + "</code></p><ul class=\"cu-task-list\">" +
      tasks.map(function (t) {
        var st = (t.status && t.status.status) || "open";
        var list = (t.list && t.list.name) || "";
        return "<li class=\"cu-task\"><span class=\"cu-task-status\">" + st + "</span>" +
          "<div><strong>" + escapeHtml(t.name || "Untitled") + "</strong>" +
          (list ? "<span class=\"cu-task-list-name\">" + escapeHtml(list) + "</span>" : "") +
          "</div></li>";
      }).join("") +
      "</ul>";
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  function copyChecklist() {
    var text = "Mercatus Concierge — ClickUp setup\n\n" + CHECKLIST;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        var btn = $("#cu-copy-checklist");
        if (btn) {
          var prev = btn.textContent;
          btn.textContent = "Copied";
          setTimeout(function () { btn.textContent = prev; }, 1600);
        }
      });
    } else {
      window.prompt("Copy checklist:", text);
    }
  }

  function assetBase() {
    var s = document.querySelector('script[src*="clickup/desk.js"]');
    if (s && s.src) {
      try {
        var u = new URL(s.src, window.location.href);
        return u.href.replace(/desk\.js(\?.*)?$/, "");
      } catch (e) { /* fall through */ }
    }
    return "clickup/";
  }

  function loadConfig() {
    var base = assetBase();
    return fetch(base + "config.example.json", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; })
      .then(function (example) {
        return fetch(base + "config.json", { cache: "no-store" })
          .then(function (r) { return r.ok ? r.json() : example; })
          .catch(function () { return example; });
      });
  }

  function init() {
    var root = $("#clickup-desk");
    if (!root || !window.MercatusClickUp) return;

    var statusEl = $("#cu-connection-status");
    var tasksEl = $("#cu-tasks");
    var spaceEl = $("#cu-space-structure");

    setStatus(statusEl, "checking");

    var space = window.MercatusClickUp.SUGGESTED_SPACE;
    if (spaceEl) {
      spaceEl.innerHTML =
        "<strong>" + escapeHtml(space.name) + "</strong>" +
        "<ul>" + space.lists.map(function (n) {
          return "<li>" + escapeHtml(n) + "</li>";
        }).join("") + "</ul>";
    }

    var openBtn = $("#cu-open-clickup");
    if (openBtn) {
      openBtn.addEventListener("click", function (e) {
        e.preventDefault();
        window.open("https://app.clickup.com/", "_blank", "noopener");
      });
    }
    var copyBtn = $("#cu-copy-checklist");
    if (copyBtn) copyBtn.addEventListener("click", copyChecklist);

    var refreshBtn = $("#cu-refresh-tasks");
    function refresh() {
      setStatus(statusEl, "checking");
      loadConfig().then(function (cfg) {
        var client = window.MercatusClickUp.create(cfg);
        return client.listDeskTasks().then(function (result) {
          if (result.error) {
            setStatus(statusEl, "error", escapeHtml(result.error));
          } else if (result.connected && result.source === "live") {
            setStatus(statusEl, "connected", "List " + escapeHtml(result.listId || ""));
          } else if (result.connected) {
            setStatus(statusEl, "mock", "Token on proxy — add list IDs in config.json");
          } else {
            setStatus(statusEl, "missing", "Set CLICKUP_API_TOKEN + start clickup/proxy-server.js");
          }
          renderTasks(tasksEl, result.tasks, result.source);
        });
      }).catch(function (err) {
        setStatus(statusEl, "error", escapeHtml(String(err && err.message || err)));
        renderTasks(tasksEl, window.MercatusClickUp.MOCK_TASKS, "mock");
      });
    }

    if (refreshBtn) refreshBtn.addEventListener("click", refresh);
    refresh();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
