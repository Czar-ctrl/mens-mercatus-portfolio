/**
 * Packs — built-in demo packs (synthesized in-browser) + user-owned sample pack import (WAV/MP3 folders).
 * No Image-Line redistribution: demo packs are procedural Web Audio renders from instruments.js;
 * imports stay in this tab's memory. VST hosting is separate (VST Rack + desktop bridge).
 */
import { renderNote, renderChord, getInstrument } from '../modules/instruments.js?v=20261006p-sxs20261020b';

/** Built-in demo packs — each item renders a one-shot from a procedural instrument. */
export const DEMO_PACKS = [
  {
    id: 'mm-demo-drums', name: 'MM Demo Drums', desc: 'Kick, 808 kick, snare, clap, hats, rim, tom, shaker',
    items: ['kick', 'kick808', 'snare', 'clap', 'hatC', 'hatO', 'rim', 'tom', 'shaker'].map((inst) => ({ inst })),
  },
  {
    id: 'mm-demo-808', name: 'MM Demo 808 & Bass', desc: '808 hits in C / F / G + clean sub',
    items: [
      { inst: 'bass808', midi: 36, name: '808 C1' },
      { inst: 'bass808', midi: 41, name: '808 F1' },
      { inst: 'bass808', midi: 43, name: '808 G1' },
      { inst: 'sub', midi: 36, name: 'Sub C1', dur: 1 },
    ],
  },
  {
    id: 'mm-demo-keys', name: 'MM Demo Keys & Pads', desc: 'Chord stabs, pad, pluck and bell one-shots',
    items: [
      { inst: 'keys', chord: [60, 64, 67], name: 'Keys C maj stab', dur: 1 },
      { inst: 'keys', chord: [57, 60, 64], name: 'Keys A min stab', dur: 1 },
      { inst: 'pad', chord: [57, 60, 64, 69], name: 'Pad A min', dur: 2.5 },
      { inst: 'pluck', midi: 57, name: 'Pluck A3' },
      { inst: 'bell', midi: 72, name: 'Bell C5' },
    ],
  },
];

export function mountFLStudio(root, engine, library, toast, onLibraryChange) {
  const loadedPacks = new Set();
  root.innerHTML = `
    <div class="panel-head">
      <h2>Packs</h2>
      <span class="badge">Demo + your samples</span>
    </div>
    <p class="panel-desc"><strong>Built-in demo packs</strong> are synthesized right here (procedural, DEMO quality). <strong>Import</strong> adds WAV/MP3 packs <em>you own</em> (e.g. folders from your FL workflows). Catalog → Library → drag to timeline. Mens Mercatus does not ship Image-Line content.</p>
    <div class="pack-demo" data-demo-packs></div>
    <div class="inst-sub">Your packs</div>
    <label class="btn block file-btn">
      Import files (multi)
      <input type="file" accept="audio/*,.wav,.mp3,.ogg,.flac" multiple data-files hidden />
    </label>
    <label class="btn block file-btn ghost">
      Import folder
      <input type="file" accept="audio/*,.wav,.mp3,.ogg,.flac" multiple webkitdirectory directory data-folder hidden />
    </label>
    <div class="stem-status" data-status>No user packs yet — import files or a folder you own</div>
    <input type="search" data-filter placeholder="Filter catalog…" class="pack-filter" />
    <div class="lib-list" data-lib></div>
    <p class="fineprint">Tip: AI Producer understands “load pack hint”. Imports stay in this browser tab (nothing is uploaded).</p>
  `;

  const status = root.querySelector('[data-status]');
  const libEl = root.querySelector('[data-lib]');
  const demoEl = root.querySelector('[data-demo-packs]');
  const filterInput = root.querySelector('[data-filter]');
  const imported = [];

  function renderDemoPacks() {
    demoEl.innerHTML = DEMO_PACKS.map((p) => `
      <div class="inst-card pack-card ${loadedPacks.has(p.id) ? 'loaded' : ''}">
        <div class="inst-card-head">
          <strong>${p.name}</strong>
          <span class="badge warn">Demo</span>
          <span class="inst-kind">${p.items.length} one-shots</span>
        </div>
        <p class="inst-desc">${p.desc}</p>
        <div class="btn-row">
          ${loadedPacks.has(p.id)
            ? '<span class="pack-ok">✓ In Library</span>'
            : `<button type="button" class="btn sm primary" data-load-pack="${p.id}">Load to Library</button>`}
        </div>
      </div>`).join('');
  }

  /** Render a demo pack into the library (idempotent). */
  async function loadDemoPack(packId, { quiet = false } = {}) {
    const pack = DEMO_PACKS.find((p) => p.id === packId);
    if (!pack || loadedPacks.has(packId)) return 0;
    await engine.init();
    pack.items.forEach((it, idx) => {
      const inst = getInstrument(it.inst);
      if (!inst) return;
      const durSec = it.dur || inst.dur;
      const buffer = it.chord
        ? renderChord(engine.ctx, inst.id, it.chord, durSec)
        : renderNote(engine.ctx, inst.id, { midi: it.midi ?? inst.note, durSec });
      library.add({
        id: `${pack.id}-${idx}`,
        name: it.name || inst.short,
        buffer,
        color: inst.color,
        durationBeats: Math.max(0.25, buffer.duration / engine.secondsPerBeat),
        source: 'demo-pack',
        pack: pack.name,
      });
    });
    loadedPacks.add(packId);
    renderDemoPacks();
    render();
    onLibraryChange?.();
    if (!quiet) toast(`${pack.name} loaded — ${pack.items.length} one-shots in Library`);
    return pack.items.length;
  }

  async function ingestFiles(fileList) {
    await engine.init();
    const files = [...fileList].filter((f) =>
      /\.(wav|mp3|ogg|flac|aiff?|m4a)$/i.test(f.name) || f.type.startsWith('audio/')
    );
    if (!files.length) {
      toast('No audio files found', 'warn');
      return;
    }
    status.textContent = `Importing ${files.length}…`;
    let ok = 0;
    for (const file of files) {
      try {
        const arr = await file.arrayBuffer();
        const buffer = await engine.ctx.decodeAudioData(arr.slice(0));
        const id = `fl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const folder = file.webkitRelativePath?.split('/')[0] || '';
        const sample = {
          id,
          name: file.name.replace(/\.[^.]+$/, ''),
          buffer,
          color: '#F5C518',
          durationBeats: Math.max(0.25, buffer.duration / engine.secondsPerBeat),
          source: 'fl-import',
          pack: folder,
        };
        library.add(sample);
        imported.push(sample);
        ok++;
      } catch (_) {}
    }
    status.textContent = `Catalogued ${ok}/${files.length} · drag to timeline`;
    render();
    onLibraryChange?.();
    toast(`Imported ${ok} sample(s)`);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function render() {
    const q = (filterInput.value || '').toLowerCase();
    const items = library.list()
      .filter((s) => s.source === 'fl-import' || s.source === 'demo-pack')
      .filter((s) => !q || s.name.toLowerCase().includes(q) || (s.pack || '').toLowerCase().includes(q));
    if (!items.length) {
      libEl.innerHTML = '<div class="empty">No pack samples yet — load a demo pack or import a folder.</div>';
      return;
    }
    libEl.innerHTML = items.map((s) => `
      <div class="lib-item" draggable="true" data-id="${s.id}">
        <span class="lib-swatch" style="background:${s.color}"></span>
        <span class="lib-name">${s.pack ? esc(s.pack) + ' / ' : ''}${esc(s.name)}</span>
        ${s.source === 'demo-pack' ? '<span class="lib-meta">Demo</span>' : '<span class="lib-meta">Yours</span>'}
        <button type="button" class="btn sm ghost" data-preview="${s.id}" title="Preview">▶</button>
        <button type="button" class="btn sm ghost" data-add="${s.id}" title="Add at playhead on the first track">+</button>
      </div>
    `).join('');
    libEl.querySelectorAll('.lib-item').forEach((el) => {
      el.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('application/x-mm-sample', el.dataset.id);
        e.dataTransfer.effectAllowed = 'copy';
      });
    });
  }

  demoEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-load-pack]');
    if (b) loadDemoPack(b.dataset.loadPack);
  });
  root.querySelector('[data-files]').addEventListener('change', (e) => {
    if (e.target.files?.length) ingestFiles(e.target.files);
    e.target.value = '';
  });
  root.querySelector('[data-folder]').addEventListener('change', (e) => {
    if (e.target.files?.length) ingestFiles(e.target.files);
    e.target.value = '';
  });
  filterInput.addEventListener('input', render);

  libEl.addEventListener('click', async (e) => {
    const prev = e.target.closest('[data-preview]');
    if (prev) {
      await engine.init();
      await engine.resume();
      const s = library.get(prev.dataset.preview);
      if (!s?.buffer) return;
      const src = engine.ctx.createBufferSource();
      src.buffer = s.buffer;
      src.connect(engine.masterGain);
      src.start();
      return;
    }
    const add = e.target.closest('[data-add]');
    if (add) {
      await engine.init();
      const s = library.get(add.dataset.add);
      const track = engine.tracks[0];
      if (!s || !track) return;
      engine.addClip(track.id, {
        name: s.name,
        startBeat: Math.floor(engine.currentBeat || 0),
        durationBeats: s.durationBeats,
        color: s.color,
        buffer: s.buffer,
      });
      toast(`Added ${s.name}`);
    }
  });

  renderDemoPacks();
  render();
  // Seed every demo pack so the Library is never empty (all procedural, generated locally).
  engine.init()
    .then(async () => { for (const p of DEMO_PACKS) await loadDemoPack(p.id, { quiet: true }); })
    .catch(() => {});

  return { loadDemoPack, render };
}
