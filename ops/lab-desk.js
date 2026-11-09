/**
 * Mercatus Lab Ops desk — luxury-minimal kanban
 * Data: ops/lab-tasks.json (disk) + localStorage cache for status moves
 * Zero SaaS — no ClickUp / tokens / proxies
 */
(function () {
  "use strict";

  var STORAGE_KEY = "mercatus-lab-ops-v1";
  var COLUMNS = [
    { id: "backlog", label: "Backlog" },
    { id: "doing", label: "Doing" },
    { id: "done", label: "Done" }
  ];
  var DEFAULT_LISTS = [
    "Cold-call pipeline",
    "DropNet follow-ups",
    "Concierge build",
    "Meeting Desk prep"
  ];

  var state = {
    tasks: [],
    lists: DEFAULT_LISTS.slice(),
    filter: "all",
    source: "disk"
  };

  function $(sel, el) { return (el || document).querySelector(sel); }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  function normalizeStatus(s) {
    var v = String(s || "backlog").toLowerCase().replace(/\s+/g, " ").trim();
    if (v === "open" || v === "to do" || v === "todo" || v === "back log") return "backlog";
    if (v === "in progress" || v === "in-progress" || v === "progress" || v === "active") return "doing";
    if (v === "closed" || v === "complete" || v === "completed") return "done";
    if (v === "backlog" || v === "doing" || v === "done") return v;
    return "backlog";
  }

  function loadOverrides() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return (parsed && parsed.statuses) || {};
    } catch (e) {
      return {};
    }
  }

  function saveOverrides(map) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        statuses: map,
        updated: new Date().toISOString()
      }));
    } catch (e) { /* ignore quota */ }
  }

  function applyOverrides(tasks) {
    var map = loadOverrides();
    return tasks.map(function (t) {
      var copy = Object.assign({}, t);
      copy.status = normalizeStatus(map[t.id] != null ? map[t.id] : t.status);
      return copy;
    });
  }

  function setTaskStatus(id, status) {
    var map = loadOverrides();
    map[id] = normalizeStatus(status);
    saveOverrides(map);
    state.tasks = state.tasks.map(function (t) {
      if (t.id !== id) return t;
      return Object.assign({}, t, { status: normalizeStatus(status) });
    });
    state.source = "localStorage + disk";
    render();
  }

  function resetBoard() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* */ }
    return loadBoard();
  }

  function dataUrl() {
    return new URL("lab-tasks.json", window.location.href).href;
  }

  function loadBoard() {
    setStatus("checking", "Reading Lab JSON…");
    return fetch(dataUrl(), { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("lab-tasks.json " + r.status);
        return r.json();
      })
      .then(function (data) {
        var tasks = (data.tasks || []).map(function (t) {
          return {
            id: t.id || ("lab-" + Math.random().toString(36).slice(2, 8)),
            name: t.name || "Untitled",
            status: normalizeStatus(t.status),
            list: t.list || "Concierge build",
            priority: (t.priority || "normal").toLowerCase(),
            note: t.note || ""
          };
        });
        state.lists = (data.lists && data.lists.length) ? data.lists.slice() : DEFAULT_LISTS.slice();
        state.tasks = applyOverrides(tasks);
        state.source = Object.keys(loadOverrides()).length ? "localStorage + disk" : "ops/lab-tasks.json";
        setStatus("local", "Powered by Mercatus Lab (local)");
        renderFilters();
        render();
      })
      .catch(function (err) {
        state.tasks = applyOverrides(fallbackTasks());
        state.lists = DEFAULT_LISTS.slice();
        state.source = "embedded fallback";
        setStatus("local", "Fallback seed · " + escapeHtml(String(err && err.message || err)));
        renderFilters();
        render();
      });
  }

  function fallbackTasks() {
    return [
      { id: "mock-1", name: "Warm intro — Cape Town atelier lead", status: "doing", list: "Cold-call pipeline", priority: "high", note: "" },
      { id: "mock-2", name: "DropNet follow-up — JobNet careers handoff", status: "backlog", list: "DropNet follow-ups", priority: "normal", note: "Read-only" },
      { id: "mock-3", name: "Polish Mercatus Lab Ops desk", status: "doing", list: "Concierge build", priority: "urgent", note: "" },
      { id: "mock-4", name: "Prep Meeting Desk brief", status: "backlog", list: "Meeting Desk prep", priority: "normal", note: "" },
      { id: "mock-7", name: "Maison token pass on ops chrome", status: "done", list: "Concierge build", priority: "normal", note: "" }
    ];
  }

  function setStatus(stateName, detail) {
    var el = $("#ops-connection-status");
    if (!el) return;
    el.dataset.state = stateName;
    el.className = "ops-status ops-status--" + stateName;
    var label = stateName === "checking" ? "Loading…" : "Local board";
    el.innerHTML =
      "<span class=\"ops-dot\" aria-hidden=\"true\"></span><strong>" + label + "</strong>" +
      (detail ? "<span class=\"ops-status-detail\">" + detail + "</span>" : "");
    var pill = $("#ops-source-pill");
    if (pill) pill.textContent = state.source || "JSON on disk";
  }

  function visibleTasks() {
    if (state.filter === "all") return state.tasks.slice();
    return state.tasks.filter(function (t) { return t.list === state.filter; });
  }

  function renderFilters() {
    var host = $("#ops-filters");
    if (!host) return;
    var lists = ["all"].concat(state.lists);
    host.innerHTML = lists.map(function (name) {
      var id = name === "all" ? "all" : name;
      var label = name === "all" ? "All lists" : shortList(name);
      var active = state.filter === id ? " is-active" : "";
      var sel = state.filter === id ? "true" : "false";
      return "<button type=\"button\" class=\"ops-filter" + active + "\" data-list=\"" +
        escapeHtml(id) + "\" role=\"tab\" aria-selected=\"" + sel + "\">" + escapeHtml(label) + "</button>";
    }).join("");
    host.querySelectorAll(".ops-filter").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.filter = btn.getAttribute("data-list") || "all";
        renderFilters();
        render();
      });
    });
  }

  function shortList(name) {
    if (name === "Cold-call pipeline") return "Cold-call";
    if (name === "DropNet follow-ups") return "DropNet";
    if (name === "Concierge build") return "Concierge";
    if (name === "Meeting Desk prep") return "Meeting Desk";
    return name;
  }

  function priorityClass(p) {
    if (p === "urgent") return "ops-pri--urgent";
    if (p === "high") return "ops-pri--high";
    if (p === "low") return "ops-pri--low";
    return "ops-pri--normal";
  }

  function cardHtml(t) {
    var opts = COLUMNS.map(function (c) {
      var sel = c.id === t.status ? " selected" : "";
      return "<option value=\"" + c.id + "\"" + sel + ">" + c.label + "</option>";
    }).join("");
    return (
      "<article class=\"ops-card\" draggable=\"true\" data-id=\"" + escapeHtml(t.id) + "\" data-status=\"" + escapeHtml(t.status) + "\">" +
        "<div class=\"ops-card-top\">" +
          "<span class=\"ops-list-tag\">" + escapeHtml(shortList(t.list)) + "</span>" +
          "<span class=\"ops-pri " + priorityClass(t.priority) + "\">" + escapeHtml(t.priority) + "</span>" +
        "</div>" +
        "<h4 class=\"ops-card-title\">" + escapeHtml(t.name) + "</h4>" +
        (t.note ? "<p class=\"ops-card-note\">" + escapeHtml(t.note) + "</p>" : "") +
        "<label class=\"ops-card-move\"><span class=\"visually-hidden\">Status</span>" +
          "<select class=\"ops-status-select\" data-id=\"" + escapeHtml(t.id) + "\" aria-label=\"Move status\">" + opts + "</select>" +
        "</label>" +
      "</article>"
    );
  }

  function render() {
    var host = $("#ops-kanban");
    if (!host) return;
    var tasks = visibleTasks();
    host.innerHTML = COLUMNS.map(function (col) {
      var colTasks = tasks.filter(function (t) { return t.status === col.id; });
      return (
        "<div class=\"ops-col\" data-column=\"" + col.id + "\">" +
          "<header class=\"ops-col-head\">" +
            "<span class=\"ops-col-label\">" + escapeHtml(col.label) + "</span>" +
            "<span class=\"ops-col-count\">" + colTasks.length + "</span>" +
          "</header>" +
          "<div class=\"ops-col-body\" data-drop=\"" + col.id + "\">" +
            (colTasks.length
              ? colTasks.map(cardHtml).join("")
              : "<p class=\"ops-col-empty\">Empty</p>") +
          "</div>" +
        "</div>"
      );
    }).join("");

    host.querySelectorAll(".ops-status-select").forEach(function (sel) {
      sel.addEventListener("change", function () {
        setTaskStatus(sel.getAttribute("data-id"), sel.value);
      });
    });

    bindDrag(host);
    var pill = $("#ops-source-pill");
    if (pill) pill.textContent = state.source;
  }

  function bindDrag(host) {
    var dragId = null;
    host.querySelectorAll(".ops-card").forEach(function (card) {
      card.addEventListener("dragstart", function (e) {
        dragId = card.getAttribute("data-id");
        card.classList.add("is-dragging");
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", dragId);
        }
      });
      card.addEventListener("dragend", function () {
        card.classList.remove("is-dragging");
        dragId = null;
        host.querySelectorAll(".ops-col-body").forEach(function (b) {
          b.classList.remove("is-drop-target");
        });
      });
    });
    host.querySelectorAll(".ops-col-body").forEach(function (body) {
      body.addEventListener("dragover", function (e) {
        e.preventDefault();
        body.classList.add("is-drop-target");
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      });
      body.addEventListener("dragleave", function () {
        body.classList.remove("is-drop-target");
      });
      body.addEventListener("drop", function (e) {
        e.preventDefault();
        body.classList.remove("is-drop-target");
        var id = (e.dataTransfer && e.dataTransfer.getData("text/plain")) || dragId;
        var col = body.getAttribute("data-drop");
        if (id && col) setTaskStatus(id, col);
      });
    });
  }

  function init() {
    if (!$("#lab-desk")) return;
    var refresh = $("#ops-refresh");
    var reset = $("#ops-reset-board");
    if (refresh) refresh.addEventListener("click", loadBoard);
    if (reset) reset.addEventListener("click", function () {
      resetBoard();
    });
    loadBoard();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
