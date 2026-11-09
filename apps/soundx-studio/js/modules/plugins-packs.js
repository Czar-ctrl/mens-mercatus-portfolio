/**
 * Plugins & Packs — one producer tab that combines:
 *  · Catalog: curated insert-FX + soft-synth names mapped to real Web Audio processors /
 *    procedural instruments (DEMO), plus Bridge stubs for user-owned native plugins.
 *  · Browser inserts: live Web Audio insert chain per track / master.
 *  · VST Rack (Bridge): existing metadata slots for the desktop bridge — no fake VST in the browser.
 *  · Packs: built-in in-browser demo packs + user-owned WAV/MP3 import.
 */
import { FX_TYPES, createInsertHost } from '../audio/fx-inserts.js?v=20261006p-sxs20261020b';
import { mountVstRack } from './vst-rack.js?v=20261005a-sxs20261020b';
import { mountFLStudio } from '../connectors/fl-studio.js?v=20261006p-sxs20261020b';

const SYNTHS = [
  { id: 'syn-808', name: 'MM 808', inst: 'bass808', desc: 'Gliding sine sub + drive → Pattern row or Piano roll.' },
  { id: 'syn-keys', name: 'MM Keys', inst: 'keys', desc: 'EP-style tine keys.' },
  { id: 'syn-pad', name: 'MM Pad', inst: 'pad', desc: 'Detuned saw pad, slow attack.' },
  { id: 'syn-lead', name: 'MM Lead', inst: 'lead', desc: 'Pulse lead with vibrato.' },
  { id: 'syn-pluck', name: 'MM Pluck', inst: 'pluck', desc: 'Karplus–Strong string.' },
  { id: 'syn-bell', name: 'MM Bell', inst: 'bell', desc: '2-operator FM bell.' },
  { id: 'syn-drums', name: 'MM Drum Machine', kit: 'mm-trap', desc: 'Procedural drum voices → arms the Pattern rack.' },
];

const BRIDGE = [
  { id: 'br-vst3-inst', name: 'Your VST3 instrument', desc: 'User-owned .vst3 synth — hosted by the desktop bridge, never in the browser.' },
  { id: 'br-vst3-fx', name: 'Your VST3 effect', desc: 'User-owned .vst3 insert — assign a path in VST Rack.' },
  { id: 'br-au', name: 'Your AU plugin (macOS)', desc: 'Audio Unit via the macOS desktop build + bridge.' },
  { id: 'br-clap', name: 'Your CLAP plugin', desc: 'Planned for the bridge protocol — metadata only today.' },
];

export function mountPluginsPacks(root, engine, library, toast, onLibraryChange, hooks = {}) {
  const inserts = hooks.inserts || createInsertHost(engine);
  let sub = 'catalog';
  let filter = 'all';
  let query = '';

  root.innerHTML = `
    <div class="panel-head">
      <h2>Plugins &amp; Packs</h2>
      <span class="badge">Demo + Bridge</span>
    </div>
    <p class="panel-desc"><strong>Demo</strong> = runs here via Web Audio (simple processors / procedural synths). <strong>Bridge</strong> = your own native VST3/AU, hosted only by the desktop bridge — browsers cannot load native plugins. No Image-Line or third-party content is shipped.</p>
    <div class="gen-tool-tabs pp-subtabs" role="tablist">
      <button type="button" class="active" data-sub="catalog" role="tab">Catalog</button>
      <button type="button" data-sub="rack" role="tab">VST Rack · Bridge</button>
      <button type="button" data-sub="packs" role="tab">Packs</button>
    </div>
    <div data-subpane="catalog">
      <div class="plug-inserts">
        <div class="plug-inserts-head">
          <strong>Browser inserts</strong>
          <label class="field"><span>Channel</span><select data-ins-ch></select></label>
        </div>
        <div class="plug-chain" data-chain></div>
      </div>
      <input type="search" class="pack-filter" placeholder="Search plugins…" data-q />
      <div class="inst-cats" data-filters>
        <button type="button" class="btn sm ghost active" data-f="all">All</button>
        <button type="button" class="btn sm ghost" data-f="fx">Effects</button>
        <button type="button" class="btn sm ghost" data-f="synth">Soft synths</button>
        <button type="button" class="btn sm ghost" data-f="bridge">Bridge</button>
      </div>
      <div class="plug-list" data-list></div>
    </div>
    <div data-subpane="rack" hidden></div>
    <div data-subpane="packs" hidden></div>
  `;

  const $ = (s) => root.querySelector(s);
  const chSel = $('[data-ins-ch]');
  const chainEl = $('[data-chain]');
  const listEl = $('[data-list]');

  mountVstRack($('[data-subpane="rack"]'), engine, toast);
  const packs = mountFLStudio($('[data-subpane="packs"]'), engine, library, toast, onLibraryChange);

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function refreshChannels() {
    const cur = chSel.value || 'master';
    chSel.innerHTML = '<option value="master">Master</option>' + engine.tracks.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
    chSel.value = [...chSel.options].some((o) => o.value === cur) ? cur : 'master';
  }

  function renderChain() {
    const items = inserts.list(chSel.value || 'master');
    if (!items.length) {
      chainEl.innerHTML = '<div class="empty">No browser inserts on this channel — hit <em>Insert</em> on an effect below.</div>';
      return;
    }
    chainEl.innerHTML = items.map((it, i) => `
      <div class="plug-slot ${it.bypass ? 'bypass' : ''}" data-uid="${it.uid}">
        <span class="vst-slot-num">${i + 1}</span>
        <strong>${FX_TYPES[it.type].name}</strong>
        <span class="badge warn">Demo</span>
        <label class="plug-amt" title="${FX_TYPES[it.type].param}"><span>${FX_TYPES[it.type].param}</span>
          <input type="range" min="0" max="1" step="0.01" value="${it.amount}" data-amt /></label>
        <button type="button" class="chip ${it.bypass ? '' : 'on'}" data-byp title="Bypass on/off">${it.bypass ? 'Off' : 'On'}</button>
        <button type="button" class="chip danger" data-rm title="Remove insert">×</button>
      </div>`).join('');
  }

  function card({ id, name, desc, tag, badge, actions }) {
    return `
      <div class="inst-card plug-card" data-card="${id}">
        <div class="inst-card-head">
          <strong>${esc(name)}</strong>
          <span class="badge ${badge === 'Bridge' ? 'bridge' : 'warn'}">${badge}</span>
          <span class="inst-kind">${tag}</span>
        </div>
        <p class="inst-desc">${esc(desc)}</p>
        <div class="btn-row">${actions}</div>
      </div>`;
  }

  function renderList() {
    root.querySelectorAll('[data-f]').forEach((b) => b.classList.toggle('active', b.dataset.f === filter));
    const q = query.toLowerCase();
    const match = (n, d) => !q || n.toLowerCase().includes(q) || d.toLowerCase().includes(q);
    let html = '';
    if (filter === 'all' || filter === 'fx') {
      const fx = Object.entries(FX_TYPES).filter(([, f]) => match(f.name, f.desc));
      if (fx.length) html += '<div class="inst-sub">Insert effects · Web Audio</div>' + fx.map(([type, f]) => card({
        id: type, name: f.name, desc: f.desc, tag: 'Insert FX', badge: 'Demo',
        actions: `<button type="button" class="btn sm primary" data-insert="${type}">Insert</button>`,
      })).join('');
    }
    if (filter === 'all' || filter === 'synth') {
      const sy = SYNTHS.filter((s) => match(s.name, s.desc));
      if (sy.length) html += '<div class="inst-sub">Soft synths · procedural</div>' + sy.map((s) => card({
        id: s.id, name: s.name, desc: s.desc, tag: s.kit ? 'Drum kit' : 'Instrument', badge: 'Demo',
        actions: s.kit
          ? `<button type="button" class="btn sm primary" data-kit="${s.kit}">Arm Pattern</button>`
          : `<button type="button" class="btn sm" data-pat="${s.inst}">→ Pattern</button><button type="button" class="btn sm primary" data-piano="${s.inst}">→ Piano</button>`,
      })).join('');
    }
    if (filter === 'all' || filter === 'bridge') {
      const br = BRIDGE.filter((b) => match(b.name, b.desc));
      if (br.length) html += '<div class="inst-sub">Native plugins · desktop bridge only</div>' + br.map((b) => card({
        id: b.id, name: b.name, desc: b.desc, tag: 'Stub', badge: 'Bridge',
        actions: '<button type="button" class="btn sm ghost" data-open-rack>Open VST Rack</button>',
      })).join('');
    }
    listEl.innerHTML = html || '<div class="empty">No plugins match.</div>';
  }

  function setSub(next) {
    sub = next;
    root.querySelectorAll('[data-sub]').forEach((b) => b.classList.toggle('active', b.dataset.sub === sub));
    root.querySelectorAll('[data-subpane]').forEach((p) => { p.hidden = p.dataset.subpane !== sub; });
  }

  root.addEventListener('click', async (e) => {
    const s = e.target.closest('[data-sub]');
    if (s) { setSub(s.dataset.sub); return; }
    const f = e.target.closest('[data-f]');
    if (f) { filter = f.dataset.f; renderList(); return; }
    if (e.target.closest('[data-open-rack]')) { setSub('rack'); return; }
    const ins = e.target.closest('[data-insert]');
    if (ins) {
      await engine.init();
      const ch = chSel.value || 'master';
      const it = inserts.add(ch, ins.dataset.insert);
      if (!it) { toast('Insert chain full (6) or channel unavailable', 'warn'); return; }
      renderChain();
      toast(`${FX_TYPES[it.type].name} inserted on ${chSel.selectedOptions[0]?.textContent || ch}`);
      return;
    }
    const pat = e.target.closest('[data-pat]');
    if (pat) { hooks.armPattern?.(pat.dataset.pat); return; }
    const pia = e.target.closest('[data-piano]');
    if (pia) { hooks.useInPiano?.(pia.dataset.piano); return; }
    const kit = e.target.closest('[data-kit]');
    if (kit) { hooks.armKit?.(kit.dataset.kit); return; }
    const slot = e.target.closest('.plug-slot');
    if (slot) {
      const ch = chSel.value || 'master';
      if (e.target.closest('[data-rm]')) { inserts.remove(ch, slot.dataset.uid); renderChain(); toast('Insert removed'); }
      else if (e.target.closest('[data-byp]')) { inserts.toggleBypass(ch, slot.dataset.uid); renderChain(); }
    }
  });
  root.addEventListener('input', (e) => {
    if (e.target.matches('[data-q]')) { query = e.target.value; renderList(); return; }
    const amt = e.target.closest('[data-amt]');
    if (amt) inserts.setAmount(chSel.value || 'master', amt.closest('.plug-slot').dataset.uid, Number(amt.value));
  });
  chSel.addEventListener('change', renderChain);
  engine.on('tracks', () => { inserts.sync(); refreshChannels(); renderChain(); });

  refreshChannels();
  renderChain();
  renderList();
  return { setSub, inserts, packs };
}
