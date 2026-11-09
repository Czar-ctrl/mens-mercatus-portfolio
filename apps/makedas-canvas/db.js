/* Concierge DB — IndexedDB shared store (not Replit DB). localStorage migrate + fallback. */
(function () {
  "use strict";
  const DB_NAME = "mercatus-concierge";
  const DB_VER = 1;
  const STORE = "kv";
  const MIGRATE_KEYS = [
    "mc-sheet", "mc-recruit", "mc-estate", "mc-team", "mc-roles",
    "mc-portal", "mc-launch-path", "mc-idea-vault", "mc-capability-radar",
    "mc-us-foundation", "mc-us-track-on", "mc-agent-kanban", "mc-secrets-vault",
    "mc-connectors", "mc-artifact", "mc-deploy-type", "mc-design-frames",
    "mc-ownership-handoff",
    "mc-business-deploy",
    "mc-deploy-path"
  ];

  let dbp = null;
  let ready = false;
  let useIdb = typeof indexedDB !== "undefined";

  function openDb() {
    if (!useIdb) return Promise.reject(new Error("no idb"));
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }

  function idbGet(key) {
    return openDb().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const r = tx.objectStore(STORE).get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    }));
  }

  function idbSet(key, val) {
    return openDb().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(val, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    }));
  }

  function idbDel(key) {
    return openDb().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    }));
  }

  function idbAll() {
    return openDb().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const store = tx.objectStore(STORE);
      const out = {};
      const req = store.openCursor();
      req.onsuccess = e => {
        const cur = e.target.result;
        if (cur) { out[cur.key] = cur.value; cur.continue(); }
        else resolve(out);
      };
      req.onerror = () => reject(req.error);
    }));
  }

  async function migrate() {
    if (!useIdb) return;
    try {
      await openDb();
      for (const k of MIGRATE_KEYS) {
        const existing = await idbGet(k);
        if (existing !== undefined) continue;
        const raw = localStorage.getItem(k);
        if (raw == null) continue;
        let val = raw;
        try { val = JSON.parse(raw); } catch (_) {}
        await idbSet(k, val);
      }
      ready = true;
    } catch (_) {
      useIdb = false;
      ready = true;
    }
  }

  const api = {
    label: "Saved in this browser",
    ready: () => ready,
    usingIdb: () => useIdb && ready,
    async init() {
      await migrate();
      ready = true;
      return this;
    },
    async get(key, fallback) {
      if (useIdb) {
        try {
          const v = await idbGet(key);
          if (v !== undefined) return v;
        } catch (_) {}
      }
      try {
        const raw = localStorage.getItem(key);
        if (raw == null) return fallback;
        try { return JSON.parse(raw); } catch (_) { return raw; }
      } catch (_) { return fallback; }
    },
    async set(key, val) {
      if (useIdb) {
        try { await idbSet(key, val); } catch (_) {}
      }
      try {
        const s = typeof val === "string" ? val : JSON.stringify(val);
        localStorage.setItem(key, s);
      } catch (_) {}
    },
    getSync(key, fallback) {
      // sync path still localStorage (writers dual-write)
      try {
        const raw = localStorage.getItem(key);
        if (raw == null) return fallback;
        try { return JSON.parse(raw); } catch (_) { return raw; }
      } catch (_) { return fallback; }
    },
    setSync(key, val) {
      try {
        const s = typeof val === "string" ? val : JSON.stringify(val);
        localStorage.setItem(key, s);
      } catch (_) {}
      if (useIdb) idbSet(key, typeof val === "string" ? (() => { try { return JSON.parse(val); } catch (_) { return val; } })() : val).catch(() => {});
    },
    async exportAll() {
      let data = {};
      if (useIdb) {
        try { data = await idbAll(); } catch (_) {}
      }
      if (!Object.keys(data).length) {
        MIGRATE_KEYS.forEach(k => {
          const raw = localStorage.getItem(k);
          if (raw != null) {
            try { data[k] = JSON.parse(raw); } catch (_) { data[k] = raw; }
          }
        });
      }
      return {
        product: "Mercatus Concierge",
        store: "Concierge DB",
        exportedAt: new Date().toISOString(),
        data
      };
    },
    async importAll(payload) {
      const data = payload && payload.data ? payload.data : payload;
      if (!data || typeof data !== "object") throw new Error("bad backup");
      for (const [k, v] of Object.entries(data)) {
        await this.set(k, v);
      }
    },
    downloadBackup() {
      this.exportAll().then(blob => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([JSON.stringify(blob, null, 2)], { type: "application/json" }));
        a.download = "mercatus-concierge-backup.json";
        a.click();
        window.MCToast?.("Backup exported");
      });
    },
    bindUi(host) {
      if (!host || host.dataset.cdbBound) return;
      host.dataset.cdbBound = "1";
      host.innerHTML = `<div class="cdb-bar">
        <span class="pane-badge">${this.label}</span>
        <button type="button" class="btn btn-ghost btn-sm" id="cdb-export">Export JSON</button>
        <label class="btn btn-ghost btn-sm" style="cursor:pointer">Import JSON<input type="file" id="cdb-import" accept="application/json,.json" hidden></label>
      </div>`;
      host.querySelector("#cdb-export")?.addEventListener("click", () => this.downloadBackup());
      host.querySelector("#cdb-import")?.addEventListener("change", async e => {
        const f = e.target.files?.[0];
        if (!f) return;
        try {
          const text = await f.text();
          await this.importAll(JSON.parse(text));
          window.MCToast?.("Backup imported — reload recommended");
        } catch (err) {
          window.MCToast?.("Import failed");
        }
        e.target.value = "";
      });
    }
  };

  // Patch localStorage dual-write for known keys after init
  const _setItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function (k, v) {
    _setItem(k, v);
    if (useIdb && MIGRATE_KEYS.includes(k)) {
      let val = v;
      try { val = JSON.parse(v); } catch (_) {}
      idbSet(k, val).catch(() => {});
    }
  };

  window.MCDB = api;
})();
