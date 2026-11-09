/**
 * Session versioning — snapshot on meaningful changes; roll back.
 * Cap ~40 snaps in memory + IndexedDB when available (localStorage fallback for metadata).
 */
const MAX = 40;
const IDB_NAME = 'mm-soundx-versions';
const IDB_STORE = 'snaps';
const LS_META = 'mm-sound-deck-versions-meta';

function openDb() {
  return new Promise((resolve, reject) => {
    if (!indexedDB) { resolve(null); return; }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

async function idbPut(db, snap) {
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(snap);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch (_) { resolve(false); }
  });
}

async function idbDelete(db, id) {
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch (_) { resolve(false); }
  });
}

export function createSessionVersions(engine, toast) {
  const snaps = []; // { id, label, at, json }
  let db = null;
  let applying = false;
  let seq = 0;

  openDb().then((d) => { db = d; });

  function summarize(json) {
    const tracks = json?.tracks?.length || 0;
    const clips = (json?.tracks || []).reduce((n, t) => n + (t.clips?.length || 0), 0);
    return `${tracks} tracks · ${clips} clips · ${json?.bpm || '?'} BPM`;
  }

  async function push(label = 'Edit') {
    if (applying) return null;
    let json;
    try {
      json = engine.toJSON();
    } catch (_) {
      return null;
    }
    const last = snaps[snaps.length - 1];
    if (last && JSON.stringify(last.json) === JSON.stringify(json)) return null;

    seq += 1;
    const snap = {
      id: `v${Date.now()}-${seq}`,
      label: String(label || 'Edit').slice(0, 48),
      at: Date.now(),
      json,
      summary: summarize(json),
    };
    snaps.push(snap);
    while (snaps.length > MAX) {
      const drop = snaps.shift();
      idbDelete(db, drop.id);
    }
    await idbPut(db, snap);
    try {
      localStorage.setItem(LS_META, JSON.stringify(snaps.map((s) => ({
        id: s.id, label: s.label, at: s.at, summary: s.summary,
      }))));
    } catch (_) {}
    window.dispatchEvent(new CustomEvent('mm-session-versions', { detail: { snaps: list() } }));
    return snap;
  }

  async function restore(id) {
    const snap = snaps.find((s) => s.id === id);
    if (!snap) {
      toast?.('Snapshot not found', 'warn');
      return false;
    }
    applying = true;
    try {
      await engine.init();
      engine.fromJSON(JSON.parse(JSON.stringify(snap.json)));
      toast?.(`Restored: ${snap.label}`);
      window.dispatchEvent(new CustomEvent('mm-sound-deck-demo-loaded'));
      return true;
    } catch (err) {
      toast?.(`Restore failed: ${err.message || err}`, 'error');
      return false;
    } finally {
      applying = false;
    }
  }

  function list() {
    return snaps.map((s) => ({
      id: s.id, label: s.label, at: s.at, summary: s.summary,
    }));
  }

  // Debounced auto-snapshot on meaningful engine events
  let timer = null;
  function schedule(label) {
    clearTimeout(timer);
    timer = setTimeout(() => push(label), 700);
  }
  engine.on('tracks', () => schedule('Arrangement'));
  engine.on('bpm', () => schedule('Tempo'));
  engine.on('loop', () => schedule('Loop'));

  // Seed one snapshot after a short delay
  setTimeout(() => push('Session start'), 800);

  /** Deep copy of a snapshot's project JSON (Session Diff / Diff Explain). */
  function get(id) {
    const snap = snaps.find((s) => s.id === id);
    return snap ? { id: snap.id, label: snap.label, at: snap.at, json: JSON.parse(JSON.stringify(snap.json)) } : null;
  }

  return {
    push,
    restore,
    list,
    get,
    get applying() { return applying; },
    get max() { return MAX; },
  };
}

export function mountSessionVersions(root, versions, toast) {
  const panel = document.createElement('div');
  panel.className = 'session-versions panel-block';
  panel.setAttribute('data-versions-panel', '');
  panel.innerHTML = `
    <div class="panel-head">
      <h2>Session versions</h2>
      <span class="badge">Last ${versions.max}</span>
    </div>
    <p class="panel-desc">Every meaningful change saves a snapshot (in-memory + IndexedDB). Roll back anytime — buffers rehydrate from recipes / notes.</p>
    <div class="btn-row">
      <button type="button" class="btn primary" data-ver-save data-sx-tip="Force a named snapshot now">Save snapshot</button>
      <button type="button" class="btn ghost" data-ver-refresh>Refresh</button>
    </div>
    <ul class="sx-version-list" data-ver-list></ul>
  `;
  root.appendChild(panel);
  const listEl = panel.querySelector('[data-ver-list]');

  function render() {
    const items = versions.list().slice().reverse();
    if (!items.length) {
      listEl.innerHTML = '<li class="empty">No snapshots yet</li>';
      return;
    }
    listEl.innerHTML = items.map((s) => {
      const t = new Date(s.at);
      const time = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return `<li data-id="${s.id}">
        <div>
          <strong>${escapeHtml(s.label)}</strong>
          <span class="muted">${time} · ${escapeHtml(s.summary || '')}</span>
        </div>
        <button type="button" class="btn sm ghost" data-ver-restore="${s.id}">Restore</button>
      </li>`;
    }).join('');
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);
  }

  panel.querySelector('[data-ver-save]').addEventListener('click', async () => {
    const label = `Manual ${new Date().toLocaleTimeString()}`;
    await versions.push(label);
    render();
    toast?.('Snapshot saved');
  });
  panel.querySelector('[data-ver-refresh]').addEventListener('click', render);
  listEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-ver-restore]');
    if (!btn) return;
    await versions.restore(btn.getAttribute('data-ver-restore'));
    render();
  });

  window.addEventListener('mm-session-versions', render);
  render();
  return { render };
}
