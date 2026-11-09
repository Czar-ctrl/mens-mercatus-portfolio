/**
 * Mercatus Concierge — ClickUp REST client (v2)
 * Browser-safe when routed through proxy_base (token never in the page).
 * Direct Authorization header only when running in Node with CLICKUP_API_TOKEN.
 */
(function (root) {
  "use strict";

  var API = "https://api.clickup.com/api/v2";
  var MOCK_TASKS = [
    { id: "mock-1", name: "Warm intro — Cape Town atelier lead", status: { status: "open" }, list: { name: "Cold-call pipeline" }, priority: { priority: "high" }, due_date: null },
    { id: "mock-2", name: "DropNet follow-up — JobNet careers handoff (read-only)", status: { status: "in progress" }, list: { name: "DropNet follow-ups" }, priority: { priority: "normal" }, due_date: null },
    { id: "mock-3", name: "Ship ClickUp Ops desk scaffolding", status: { status: "open" }, list: { name: "Concierge build" }, priority: { priority: "urgent" }, due_date: null },
    { id: "mock-4", name: "Prep Meeting Desk brief for founder sync", status: { status: "open" }, list: { name: "Meeting Desk prep" }, priority: { priority: "normal" }, due_date: null }
  ];

  var SUGGESTED_SPACE = {
    name: "Mercatus Concierge",
    lists: [
      "Cold-call pipeline",
      "DropNet follow-ups",
      "Concierge build",
      "Meeting Desk prep"
    ]
  };

  function mergeConfig(cfg) {
    var base = {
      team_id: "",
      space_id: "",
      lists: {},
      proxy_base: "http://127.0.0.1:8788",
      production_proxy: "https://api.mensmercatus.online/clickup/",
      clickup_app_url: "https://app.clickup.com/",
      token: ""
    };
    if (!cfg) return base;
    Object.keys(cfg).forEach(function (k) { base[k] = cfg[k]; });
    return base;
  }

  function ClickUpClient(config) {
    this.config = mergeConfig(config || {});
    if (typeof process !== "undefined" && process.env) {
      if (!this.config.token && process.env.CLICKUP_API_TOKEN) {
        this.config.token = process.env.CLICKUP_API_TOKEN;
      }
      if (!this.config.team_id && process.env.CLICKUP_TEAM_ID) {
        this.config.team_id = process.env.CLICKUP_TEAM_ID;
      }
    }
  }

  ClickUpClient.prototype.hasToken = function () {
    return !!(this.config.token || this._proxyAlive);
  };

  ClickUpClient.prototype.suggestedSpace = function () {
    return SUGGESTED_SPACE;
  };

  ClickUpClient.prototype.mockTasks = function () {
    return MOCK_TASKS.slice();
  };

  ClickUpClient.prototype._base = function () {
    // Prefer local/production proxy in browser so token stays server-side
    if (typeof window !== "undefined") {
      return (this.config.proxy_base || "").replace(/\/$/, "");
    }
    return API;
  };

  ClickUpClient.prototype._headers = function () {
    var h = { Accept: "application/json", "Content-Type": "application/json" };
    if (typeof window === "undefined" && this.config.token) {
      h.Authorization = this.config.token;
    }
    return h;
  };

  ClickUpClient.prototype._path = function (path) {
    var base = this._base();
    if (typeof window !== "undefined") {
      // Proxy mounts ClickUp paths under /api/v2/...
      return base + "/api/v2" + path;
    }
    return base + path;
  };

  ClickUpClient.prototype.request = function (path, opts) {
    opts = opts || {};
    var self = this;
    return fetch(this._path(path), {
      method: opts.method || "GET",
      headers: this._headers(),
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          var err = new Error("ClickUp " + res.status + ": " + (t || res.statusText));
          err.status = res.status;
          throw err;
        });
      }
      return res.json();
    }).then(function (data) {
      self._proxyAlive = true;
      return data;
    });
  };

  ClickUpClient.prototype.ping = function () {
    var self = this;
    var base = (this.config.proxy_base || "").replace(/\/$/, "");
    if (typeof window === "undefined") {
      return this.getTeams().then(function () {
        return { ok: true, mode: "direct" };
      });
    }
    return fetch(base + "/health")
      .then(function (r) { return r.json(); })
      .then(function (j) {
        self._proxyAlive = !!(j && j.tokenConfigured);
        return {
          ok: true,
          mode: "proxy",
          tokenConfigured: !!(j && j.tokenConfigured),
          teamId: j && j.teamId
        };
      })
      .catch(function () {
        self._proxyAlive = false;
        return { ok: false, mode: "proxy", tokenConfigured: false };
      });
  };

  ClickUpClient.prototype.getTeams = function () {
    return this.request("/team").then(function (d) { return d.teams || []; });
  };

  ClickUpClient.prototype.getSpaces = function (teamId) {
    var id = teamId || this.config.team_id;
    return this.request("/team/" + encodeURIComponent(id) + "/space?archived=false")
      .then(function (d) { return d.spaces || []; });
  };

  ClickUpClient.prototype.getLists = function (spaceId) {
    var id = spaceId || this.config.space_id;
    return this.request("/space/" + encodeURIComponent(id) + "/list?archived=false")
      .then(function (d) { return d.lists || []; });
  };

  ClickUpClient.prototype.getFolderlessLists = function (spaceId) {
    var id = spaceId || this.config.space_id;
    return this.request("/space/" + encodeURIComponent(id) + "/list?archived=false")
      .then(function (d) { return d.lists || []; });
  };

  ClickUpClient.prototype.getTasks = function (listId, query) {
    var q = query || "archived=false&include_closed=false";
    return this.request("/list/" + encodeURIComponent(listId) + "/task?" + q)
      .then(function (d) { return d.tasks || []; });
  };

  ClickUpClient.prototype.getOpenTasks = function (listId) {
    if (!listId) {
      return Promise.resolve(this.mockTasks());
    }
    return this.getTasks(listId);
  };

  /**
   * Resolve open tasks: live when proxy+token+listId; else mock.
   */
  ClickUpClient.prototype.listDeskTasks = function () {
    var self = this;
    var listId =
      (this.config.lists && this.config.lists.concierge_build && this.config.lists.concierge_build.id) ||
      (this.config.lists && this.config.lists.cold_calls && this.config.lists.cold_calls.id) ||
      this.config.default_list_id ||
      "";

    if (!listId || listId.indexOf("YOUR_") === 0) {
      return this.ping().then(function (p) {
        return {
          source: "mock",
          connected: !!(p && p.tokenConfigured),
          tasks: self.mockTasks(),
          ping: p
        };
      });
    }

    return this.ping().then(function (p) {
      if (!p || !p.tokenConfigured) {
        return { source: "mock", connected: false, tasks: self.mockTasks(), ping: p };
      }
      return self.getTasks(listId).then(function (tasks) {
        return { source: "live", connected: true, tasks: tasks, ping: p, listId: listId };
      }).catch(function (err) {
        return {
          source: "mock",
          connected: true,
          error: String(err && err.message || err),
          tasks: self.mockTasks(),
          ping: p
        };
      });
    });
  };

  var api = {
    ClickUpClient: ClickUpClient,
    MOCK_TASKS: MOCK_TASKS,
    SUGGESTED_SPACE: SUGGESTED_SPACE,
    create: function (cfg) { return new ClickUpClient(cfg); }
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.MercatusClickUp = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
