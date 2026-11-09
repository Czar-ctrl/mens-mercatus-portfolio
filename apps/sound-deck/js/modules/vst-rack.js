/**
 * VST Rack skeleton — insert slots per track + master.
 * Browser cannot run native VST/VST3; slots await desktop/vst-bridge.
 */
import { VstBridgeClient } from '../connectors/vst-bridge-client.js?v=20261005a';

export function mountVstRack(root, engine, toast) {
  const bridge = new VstBridgeClient();
  const slots = new Map(); // trackId|'master' -> [{id, name, path, status}]

  function ensure(id) {
    if (!slots.has(id)) {
      slots.set(id, [
        { id: 's1', name: 'Empty', path: '', status: 'empty' },
        { id: 's2', name: 'Empty', path: '', status: 'empty' },
        { id: 's3', name: 'Empty', path: '', status: 'empty' },
      ]);
    }
    return slots.get(id);
  }

  root.innerHTML = `
    <div class="panel-head">
      <h2>VST Rack</h2>
      <span class="badge warn">Bridge</span>
    </div>
    <p class="panel-desc">Insert FX slots for each track and master. Native <strong>VST / VST3</strong> cannot run in the browser — drop a path/metadata for user-owned plugins; the desktop bridge hosts them later. No Image-Line redistribution.</p>
    <div class="stem-status" data-bridge>Bridge: checking…</div>
    <label class="field block"><span>Channel</span>
      <select data-channel></select>
    </label>
    <div class="vst-slots" data-slots></div>
    <div class="btn-row">
      <button type="button" class="btn ghost" data-refresh>Refresh bridge</button>
    </div>
    <p class="fineprint">Contract: <span class="mono">desktop/vst-bridge/</span> · IPC via <code>window.mmDesktop.vstBridge</code> or localhost WS.</p>
  `;

  const channelSel = root.querySelector('[data-channel]');
  const slotsEl = root.querySelector('[data-slots]');
  const bridgeStatus = root.querySelector('[data-bridge]');

  function refreshChannels() {
    const opts = [
      '<option value="master">Master</option>',
      ...engine.tracks.map((t) => `<option value="${t.id}">${t.name}</option>`),
    ];
    const cur = channelSel.value;
    channelSel.innerHTML = opts.join('');
    if (cur) channelSel.value = cur;
  }

  function renderSlots() {
    const ch = channelSel.value || 'master';
    const list = ensure(ch);
    slotsEl.innerHTML = list.map((s, idx) => `
      <div class="vst-slot" data-idx="${idx}">
        <div class="vst-slot-head">
          <span class="vst-slot-num">Insert ${idx + 1}</span>
          <span class="badge ${s.status === 'ready' ? '' : 'warn'}">${s.status}</span>
        </div>
        <div class="vst-slot-name">${s.name || 'Empty slot'}</div>
        <input type="text" data-path placeholder="Path or name e.g. /Library/Audio/Plug-Ins/VST3/MyFX.vst3" value="${s.path || ''}" />
        <div class="btn-row">
          <button type="button" class="btn sm primary" data-assign>Assign</button>
          <button type="button" class="btn sm ghost" data-clear-slot>Clear</button>
        </div>
        <div class="vst-slot-msg">${s.message || (bridge.available ? 'Awaiting host load' : 'Awaiting bridge / drop .vst3 path')}</div>
      </div>
    `).join('');
  }

  async function updateBridge() {
    const info = await bridge.probe();
    bridgeStatus.textContent = info.available
      ? `Bridge online · ${info.transport || 'ipc'}`
      : 'Bridge offline — slots store metadata only (awaiting native host)';
  }

  channelSel.addEventListener('change', renderSlots);
  engine.on('tracks', () => { refreshChannels(); renderSlots(); });

  slotsEl.addEventListener('click', async (e) => {
    const slotEl = e.target.closest('.vst-slot');
    if (!slotEl) return;
    const idx = Number(slotEl.dataset.idx);
    const ch = channelSel.value || 'master';
    const list = ensure(ch);
    if (e.target.closest('[data-clear-slot]')) {
      list[idx] = { id: list[idx].id, name: 'Empty', path: '', status: 'empty', message: '' };
      renderSlots();
      toast('Slot cleared');
      return;
    }
    if (e.target.closest('[data-assign]')) {
      const path = slotEl.querySelector('[data-path]').value.trim();
      if (!path) { toast('Enter a plugin path or name', 'warn'); return; }
      const name = path.split(/[/\\]/).pop() || path;
      list[idx].path = path;
      list[idx].name = name;
      const result = await bridge.requestLoad({ channel: ch, slot: idx, path, name });
      list[idx].status = result.ok ? 'ready' : 'pending';
      list[idx].message = result.message;
      renderSlots();
      toast(result.ok ? 'Bridge accepted plugin' : 'Saved — awaiting bridge');
    }
  });

  root.querySelector('[data-refresh]').addEventListener('click', async () => {
    await updateBridge();
    renderSlots();
    toast('Bridge status refreshed');
  });

  refreshChannels();
  ensure('master');
  updateBridge().then(renderSlots);
}
