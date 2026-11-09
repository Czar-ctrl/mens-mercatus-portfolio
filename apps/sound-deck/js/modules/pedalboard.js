/**
 * Pedalboard-style FX chain — stomp toggles wired to existing fx-inserts / Web Audio.
 * Attaches to Master by default (documented in UI). Add / remove / reorder pedals.
 * DEMO processors — same MM Comp/Filter/Drive/Delay/Space nodes as Plugins inserts.
 */
import { FX_TYPES } from '../audio/fx-inserts.js?v=20261007a';

const DEFAULT_PEDALS = [
  { type: 'filter', label: 'Filter', amount: 0.35 },
  { type: 'drive', label: 'Drive', amount: 0.4 },
  { type: 'delay', label: 'Delay', amount: 0.35 },
  { type: 'space', label: 'Space', amount: 0.45 },
];

const STOMP_COLORS = {
  filter: '#C9A227',
  drive: '#E85D04',
  delay: '#4A90A4',
  space: '#7B68A6',
  comp: '#F5C518',
  crush: '#B8860B',
  chorus: '#5B8C5A',
  eqlow: '#888',
  limiter: '#DAA520',
};

export function mountPedalboard(root, engine, toast, { inserts, getSelectedTrackId } = {}) {
  if (!inserts) {
    root.innerHTML = '<p class="panel-desc">Pedalboard needs the shared insert host.</p>';
    return null;
  }

  let target = 'master'; // 'master' | trackId
  /** local mirror of stomps we own: { uid, type, label } */
  let board = [];

  root.innerHTML = `
    <div class="panel-head">
      <h2>Pedalboard</h2>
      <span class="badge warn">Web Audio · DEMO</span>
    </div>
    <p class="panel-desc">Stomp-style FX chain on the <strong data-pb-target-label>Master</strong> bus — Filter, Drive, Delay, Space (reverb). Same insert nodes as Plugins &amp; Packs. Toggle stomps, tweak amounts, reorder.</p>

    <div class="pb-toolbar">
      <label class="field">
        <span>Attach to</span>
        <select data-pb-target>
          <option value="master">Master bus</option>
        </select>
      </label>
      <button type="button" class="btn ghost" data-pb-seed title="Load default pedalboard">Default stomps</button>
      <button type="button" class="btn ghost" data-pb-clear>Clear board</button>
    </div>

    <div class="pb-board" data-pb-board role="list" aria-label="Pedalboard chain"></div>

    <div class="pb-add">
      <span class="pb-add-label">Add pedal</span>
      <div class="pb-add-row">
        ${['filter', 'drive', 'delay', 'space', 'comp', 'chorus', 'crush'].map((t) =>
          `<button type="button" class="btn sm ghost" data-pb-add="${t}">${FX_TYPES[t]?.name?.replace(/^MM /, '') || t}</button>`
        ).join('')}
      </div>
    </div>
    <div class="stem-status" data-pb-status>Pedalboard → Master · empty — hit Default stomps or Add</div>
  `;

  const boardEl = root.querySelector('[data-pb-board]');
  const targetSel = root.querySelector('[data-pb-target]');
  const status = root.querySelector('[data-pb-status]');
  const targetLabel = root.querySelector('[data-pb-target-label]');

  function refreshTargets() {
    const cur = targetSel.value || 'master';
    targetSel.innerHTML = '<option value="master">Master bus</option>' +
      engine.tracks.map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
    targetSel.value = [...targetSel.options].some((o) => o.value === cur) ? cur : 'master';
    target = targetSel.value;
    targetLabel.textContent = target === 'master' ? 'Master' : (engine.tracks.find((t) => t.id === target)?.name || 'track');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function syncFromHost() {
    const items = inserts.list(target);
    board = items.map((it) => ({
      uid: it.uid,
      type: it.type,
      label: FX_TYPES[it.type]?.name?.replace(/^MM /, '') || it.type,
      amount: it.amount,
      bypass: it.bypass,
    }));
  }

  function render() {
    syncFromHost();
    if (!board.length) {
      boardEl.innerHTML = '<div class="empty">No pedals on this channel — <em>Default stomps</em> or Add below.</div>';
      status.textContent = `Pedalboard → ${targetLabel.textContent} · empty`;
      return;
    }
    boardEl.innerHTML = board.map((p, i) => `
      <div class="pb-stomp ${p.bypass ? 'off' : 'on'}" data-uid="${p.uid}" role="listitem" style="--stomp:${STOMP_COLORS[p.type] || '#F5C518'}">
        <div class="pb-stomp-top">
          <button type="button" class="pb-move" data-pb-up title="Move earlier in chain" ${i === 0 ? 'disabled' : ''}>▲</button>
          <button type="button" class="pb-move" data-pb-down title="Move later in chain" ${i === board.length - 1 ? 'disabled' : ''}>▼</button>
        </div>
        <button type="button" class="pb-footswitch" data-pb-toggle aria-pressed="${!p.bypass}" title="Toggle ${p.label}">
          <span class="pb-led"></span>
        </button>
        <strong class="pb-name">${escapeHtml(p.label)}</strong>
        <label class="pb-amt">
          <span>${FX_TYPES[p.type]?.param || 'Amt'}</span>
          <input type="range" min="0" max="1" step="0.01" value="${p.amount}" data-pb-amt />
        </label>
        <button type="button" class="pb-rm" data-pb-rm title="Remove pedal">×</button>
      </div>`).join('<span class="pb-cable" aria-hidden="true"></span>');
    status.textContent = `Pedalboard → ${targetLabel.textContent} · ${board.filter((p) => !p.bypass).length}/${board.length} engaged`;
  }

  async function seedDefaults() {
    await engine.init();
    // Clear existing then add defaults
    [...inserts.list(target)].forEach((it) => inserts.remove(target, it.uid));
    for (const ped of DEFAULT_PEDALS) {
      inserts.add(target, ped.type, ped.amount);
    }
    // Start bypassed so user stomps them on intentionally (except leave space soft)
    const items = inserts.list(target);
    items.forEach((it, idx) => {
      if (it.type !== 'space' && !it.bypass) inserts.toggleBypass(target, it.uid);
    });
    render();
    toast('Default pedalboard on ' + targetLabel.textContent);
  }

  async function addPedal(type) {
    await engine.init();
    const it = inserts.add(target, type, 0.45);
    if (!it) { toast('Chain full (max 6) or channel unavailable', 'warn'); return; }
    render();
    toast(`${FX_TYPES[type].name} → ${targetLabel.textContent}`);
  }

  /**
   * Reorder by remove+re-add in new order (insert host has no move API).
   */
  function reorder(uid, dir) {
    const items = inserts.list(target);
    const i = items.findIndex((x) => x.uid === uid);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= items.length) return;
    const snapshot = items.map((x) => ({ type: x.type, amount: x.amount, bypass: x.bypass }));
    const tmp = snapshot[i];
    snapshot[i] = snapshot[j];
    snapshot[j] = tmp;
    [...items].forEach((it) => inserts.remove(target, it.uid));
    snapshot.forEach((s) => {
      const it = inserts.add(target, s.type, s.amount);
      if (it && s.bypass) inserts.toggleBypass(target, it.uid);
    });
    render();
  }

  boardEl.addEventListener('click', (e) => {
    const stomp = e.target.closest('.pb-stomp');
    if (!stomp) return;
    const uid = stomp.dataset.uid;
    if (e.target.closest('[data-pb-toggle]')) {
      inserts.toggleBypass(target, uid);
      render();
      return;
    }
    if (e.target.closest('[data-pb-rm]')) {
      inserts.remove(target, uid);
      render();
      toast('Pedal removed');
      return;
    }
    if (e.target.closest('[data-pb-up]')) { reorder(uid, -1); return; }
    if (e.target.closest('[data-pb-down]')) { reorder(uid, 1); return; }
  });

  boardEl.addEventListener('input', (e) => {
    const amt = e.target.closest('[data-pb-amt]');
    if (!amt) return;
    const uid = amt.closest('.pb-stomp')?.dataset.uid;
    if (uid) inserts.setAmount(target, uid, Number(amt.value));
  });

  targetSel.addEventListener('change', () => {
    target = targetSel.value;
    targetLabel.textContent = target === 'master' ? 'Master' : (engine.tracks.find((t) => t.id === target)?.name || 'track');
    render();
  });

  root.querySelector('[data-pb-seed]').addEventListener('click', seedDefaults);
  root.querySelector('[data-pb-clear]').addEventListener('click', () => {
    [...inserts.list(target)].forEach((it) => inserts.remove(target, it.uid));
    render();
    toast('Pedalboard cleared');
  });
  root.querySelector('.pb-add-row').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pb-add]');
    if (b) addPedal(b.dataset.pbAdd);
  });

  engine.on('tracks', () => { inserts.sync(); refreshTargets(); render(); });
  refreshTargets();
  render();

  return {
    seedDefaults,
    addPedal,
    setTarget(id) {
      if (id !== 'master' && !engine.tracks.some((t) => t.id === id)) return false;
      targetSel.value = id;
      target = id;
      targetLabel.textContent = id === 'master' ? 'Master' : (engine.tracks.find((t) => t.id === id)?.name || 'track');
      render();
      return true;
    },
    /** Engage or nudge an FX by type on current target */
    engage(type, amount) {
      const items = inserts.list(target);
      let it = items.find((x) => x.type === type);
      if (!it) it = inserts.add(target, type, amount ?? 0.5);
      if (!it) return false;
      if (it.bypass) inserts.toggleBypass(target, it.uid);
      if (amount != null) inserts.setAmount(target, it.uid, amount);
      render();
      return true;
    },
    bump(type, delta = 0.1) {
      const items = inserts.list(target);
      let it = items.find((x) => x.type === type);
      if (!it) {
        it = inserts.add(target, type, Math.max(0, Math.min(1, 0.4 + delta)));
      } else {
        if (it.bypass) inserts.toggleBypass(target, it.uid);
        inserts.setAmount(target, it.uid, Math.max(0, Math.min(1, it.amount + delta)));
      }
      render();
      return !!it;
    },
    bypass(type, on) {
      const it = inserts.list(target).find((x) => x.type === type);
      if (!it) return false;
      if (on && !it.bypass) inserts.toggleBypass(target, it.uid);
      if (!on && it.bypass) inserts.toggleBypass(target, it.uid);
      render();
      return true;
    },
    getTarget: () => target,
    refresh: render,
  };
}
