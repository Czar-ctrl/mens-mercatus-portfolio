/**
 * Instruments — built-in procedural Web Audio instruments & kits.
 * Every sound here is synthesized sample-by-sample in this tab (DEMO quality, no samples shipped,
 * no third-party / Image-Line content). Used by Pattern (channel rack), Piano roll, demo packs
 * and the Plugins catalog soft-synth entries.
 */

export const INSTRUMENTS = [
  // —— Drums (one-shots; pitch ignored) ——
  { id: 'kick', name: 'Punch Kick', short: 'Kick', cat: 'drums', kind: 'drum', color: '#F5C518', dur: 0.5, desc: 'Sine sweep 160→45 Hz with click transient.' },
  { id: 'kick808', name: '808 Boom Kick', short: '808 Kick', cat: 'drums', kind: 'drum', color: '#E8B923', dur: 0.9, desc: 'Long sub boom, soft saturation.' },
  { id: 'snare', name: 'Crack Snare', short: 'Snare', cat: 'drums', kind: 'drum', color: '#E8A838', dur: 0.3, desc: 'Filtered noise + 190 Hz body.' },
  { id: 'clap', name: 'Stack Clap', short: 'Clap', cat: 'drums', kind: 'drum', color: '#D4A017', dur: 0.35, desc: 'Three noise bursts, high-passed.' },
  { id: 'hatC', name: 'Closed Hat', short: 'Hat', cat: 'drums', kind: 'drum', color: '#C9A227', dur: 0.08, desc: 'Tight high-passed noise tick.' },
  { id: 'hatO', name: 'Open Hat', short: 'Open Hat', cat: 'drums', kind: 'drum', color: '#B8962A', dur: 0.45, desc: 'Longer metallic noise wash.' },
  { id: 'rim', name: 'Rim / Perc', short: 'Rim', cat: 'drums', kind: 'drum', color: '#A88A2A', dur: 0.12, desc: 'Short dual-tone knock.' },
  { id: 'tom', name: 'Floor Tom', short: 'Tom', cat: 'drums', kind: 'drum', color: '#DAA520', dur: 0.45, desc: 'Pitched sweep 220→120 Hz.' },
  { id: 'shaker', name: 'Shaker', short: 'Shaker', cat: 'drums', kind: 'drum', color: '#9C8430', dur: 0.15, desc: 'Swelling high noise.' },
  // —— Pitched ——
  { id: 'bass808', name: '808 Bass', short: '808', cat: 'bass', kind: 'pitched', color: '#F0B90B', dur: 0.9, note: 36, wave: 'sine', desc: 'Gliding sine sub with tanh drive.' },
  { id: 'sub', name: 'Sub Bass', short: 'Sub', cat: 'bass', kind: 'pitched', color: '#C79A1E', dur: 0.6, note: 36, wave: 'sine', desc: 'Clean sine sub.' },
  { id: 'keys', name: 'Velvet Keys', short: 'Keys', cat: 'keys', kind: 'pitched', color: '#F5D061', dur: 1.2, note: 60, wave: 'triangle', desc: 'EP-style tine: sine partials, fast decay.' },
  { id: 'pluck', name: 'String Pluck', short: 'Pluck', cat: 'keys', kind: 'pitched', color: '#E6C35C', dur: 0.8, note: 57, wave: 'triangle', desc: 'Karplus–Strong plucked string.' },
  { id: 'bell', name: 'Glass Bell', short: 'Bell', cat: 'keys', kind: 'pitched', color: '#EAD38A', dur: 1.4, note: 72, wave: 'sine', desc: '2-op FM bell.' },
  { id: 'pad', name: 'Gold Pad', short: 'Pad', cat: 'pads', kind: 'pitched', color: '#B8860B', dur: 2.0, note: 57, wave: 'sine', desc: 'Detuned saws, low-passed, slow attack.' },
  { id: 'lead', name: 'Mercatus Lead', short: 'Lead', cat: 'leads', kind: 'pitched', color: '#FFD447', dur: 0.6, note: 69, wave: 'square', desc: 'Pulse lead with delayed vibrato.' },
];

export const KITS = [
  {
    id: 'mm-trap', name: 'MM Trap Kit', desc: '808 kick, snare, clap, hats + 808 bass row',
    rows: [
      { inst: 'kick808', steps: [0, 7, 10] },
      { inst: 'snare', steps: [4, 12] },
      { inst: 'clap', steps: [12] },
      { inst: 'hatC', steps: [0, 2, 4, 6, 8, 9, 10, 12, 14, 15] },
      { inst: 'hatO', steps: [6] },
      { inst: 'bass808', steps: [0, 7, 10], note: 36 },
    ],
  },
  {
    id: 'mm-house', name: 'MM House Kit', desc: 'Four-on-floor kick, clap, off-beat hats, shaker',
    rows: [
      { inst: 'kick', steps: [0, 4, 8, 12] },
      { inst: 'clap', steps: [4, 12] },
      { inst: 'hatO', steps: [2, 6, 10, 14] },
      { inst: 'hatC', steps: [3, 7, 11, 15] },
      { inst: 'shaker', steps: [1, 5, 9, 13] },
      { inst: 'rim', steps: [7, 15] },
    ],
  },
  {
    id: 'mm-boombap', name: 'MM Boom-Bap Kit', desc: 'Swingy kick/snare, hats, rim, tom fill',
    rows: [
      { inst: 'kick', steps: [0, 3, 8, 10] },
      { inst: 'snare', steps: [4, 12] },
      { inst: 'hatC', steps: [0, 2, 4, 6, 8, 10, 12, 14] },
      { inst: 'rim', steps: [7] },
      { inst: 'tom', steps: [14, 15] },
    ],
  },
  {
    id: 'mm-hats', name: 'MM Hat Kit', desc: 'Closed / open hats, shaker, rim — layer over any groove',
    rows: [
      { inst: 'hatC', steps: [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14] },
      { inst: 'hatO', steps: [3, 11] },
      { inst: 'shaker', steps: [2, 6, 10, 14] },
      { inst: 'rim', steps: [15] },
    ],
  },
];

export const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'drums', label: 'Drums' },
  { id: 'bass', label: 'Bass / 808' },
  { id: 'keys', label: 'Keys' },
  { id: 'pads', label: 'Pads' },
  { id: 'leads', label: 'Leads' },
  { id: 'kits', label: 'Kits' },
];

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const freqToMidi = (f) => Math.round(69 + 12 * Math.log2(Math.max(1, f) / 440));
export const noteName = (m) => `${NOTE_NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
export const isBlackKey = (m) => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);
export const getInstrument = (id) => INSTRUMENTS.find((i) => i.id === id) || null;
export const getKit = (id) => KITS.find((k) => k.id === id) || null;

// —— Synthesis ——
const cache = new Map(); // key -> AudioBuffer (per AudioContext sample rate)

function onePoleLP(data, cutoff, sr) {
  const a = Math.exp(-2 * Math.PI * cutoff / sr);
  let y = 0;
  for (let i = 0; i < data.length; i++) { y = (1 - a) * data[i] + a * y; data[i] = y; }
}
function onePoleHP(data, cutoff, sr) {
  const a = Math.exp(-2 * Math.PI * cutoff / sr);
  let lp = 0;
  for (let i = 0; i < data.length; i++) { lp = (1 - a) * data[i] + a * lp; data[i] = data[i] - lp; }
}
function normalize(data, peak = 0.8) {
  let m = 0;
  for (let i = 0; i < data.length; i++) m = Math.max(m, Math.abs(data[i]));
  if (m > 0) { const k = peak / m; for (let i = 0; i < data.length; i++) data[i] *= k; }
}
function fadeEdges(data, sr, inSec = 0.002, outSec = 0.02) {
  const ni = Math.floor(inSec * sr); const no = Math.min(data.length, Math.floor(outSec * sr));
  for (let i = 0; i < ni && i < data.length; i++) data[i] *= i / ni;
  for (let i = 0; i < no; i++) data[data.length - 1 - i] *= i / no;
}
const noise = () => Math.random() * 2 - 1;

function synth(id, d, sr, f, durSec) {
  const len = d.length;
  const TAU = 2 * Math.PI;
  switch (id) {
    case 'kick': {
      let ph = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr; const fr = 45 + 115 * Math.exp(-t * 28);
        ph += TAU * fr / sr;
        d[i] = Math.sin(ph) * Math.exp(-t * 8) + (t < 0.004 ? noise() * 0.5 * (1 - t / 0.004) : 0);
      }
      break;
    }
    case 'kick808': {
      let ph = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr; const fr = 48 + 72 * Math.exp(-t * 22);
        ph += TAU * fr / sr;
        d[i] = Math.tanh(2.2 * Math.sin(ph) * Math.exp(-t * 3.2));
      }
      break;
    }
    case 'snare': {
      for (let i = 0; i < len; i++) d[i] = noise() * Math.exp(-i / sr * 18);
      onePoleHP(d, 900, sr);
      for (let i = 0; i < len; i++) { const t = i / sr; d[i] = d[i] * 0.8 + Math.sin(TAU * 190 * t) * Math.exp(-t * 30) * 0.6; }
      break;
    }
    case 'clap': {
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        let env = 0;
        [0, 0.011, 0.022].forEach((o) => { if (t >= o) env = Math.max(env, Math.exp(-(t - o) * 90)); });
        if (t >= 0.022) env = Math.max(env, 0.55 * Math.exp(-(t - 0.022) * 14));
        d[i] = noise() * env;
      }
      onePoleHP(d, 1100, sr); onePoleLP(d, 6000, sr);
      break;
    }
    case 'hatC':
    case 'hatO': {
      const dec = id === 'hatC' ? 60 : 8;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const metal = Math.sign(Math.sin(TAU * 4100 * t)) * 0.3 + Math.sign(Math.sin(TAU * 5900 * t)) * 0.25;
        d[i] = (noise() * 0.7 + metal * 0.3) * Math.exp(-t * dec);
      }
      onePoleHP(d, 7000, sr); onePoleHP(d, 5000, sr);
      break;
    }
    case 'rim': {
      for (let i = 0; i < len; i++) { const t = i / sr; d[i] = (Math.sin(TAU * 820 * t) + 0.6 * Math.sin(TAU * 1250 * t)) * Math.exp(-t * 45) + noise() * 0.2 * Math.exp(-t * 120); }
      break;
    }
    case 'tom': {
      let ph = 0;
      for (let i = 0; i < len; i++) { const t = i / sr; ph += TAU * (120 + 100 * Math.exp(-t * 12)) / sr; d[i] = Math.sin(ph) * Math.exp(-t * 7); }
      break;
    }
    case 'shaker': {
      for (let i = 0; i < len; i++) { const t = i / sr; d[i] = noise() * Math.min(1, t / 0.04) * Math.exp(-Math.max(0, t - 0.04) * 35); }
      onePoleHP(d, 6000, sr);
      break;
    }
    case 'bass808': {
      let ph = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr; const fr = f * (1 + 0.6 * Math.exp(-t * 40));
        ph += TAU * fr / sr;
        const env = Math.exp(-t * 1.6) * Math.min(1, (durSec - t) / 0.06);
        d[i] = Math.tanh(1.8 * Math.sin(ph)) * env;
      }
      break;
    }
    case 'sub': {
      for (let i = 0; i < len; i++) { const t = i / sr; d[i] = Math.sin(TAU * f * t) * Math.min(1, t / 0.008) * Math.min(1, (durSec - t) / 0.05); }
      break;
    }
    case 'keys': {
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const s = Math.sin(TAU * f * t) + 0.35 * Math.sin(TAU * 2 * f * t) * Math.exp(-t * 4) + 0.18 * Math.sin(TAU * 4 * f * t) * Math.exp(-t * 14);
        d[i] = s * Math.exp(-t * 2.2) * Math.min(1, t / 0.004) * Math.min(1, (durSec - t) / 0.05);
      }
      break;
    }
    case 'pluck': {
      const period = Math.max(2, Math.round(sr / f));
      const ring = new Float32Array(period);
      for (let i = 0; i < period; i++) ring[i] = noise();
      let idx = 0;
      for (let i = 0; i < len; i++) {
        const next = (idx + 1) % period;
        const v = ring[idx];
        ring[idx] = 0.996 * 0.5 * (v + ring[next]);
        d[i] = v * Math.min(1, (durSec - i / sr) / 0.04);
        idx = next;
      }
      break;
    }
    case 'bell': {
      for (let i = 0; i < len; i++) {
        const t = i / sr; const idxMod = 3 * Math.exp(-t * 3);
        d[i] = Math.sin(TAU * f * t + idxMod * Math.sin(TAU * 3.5 * f * t)) * Math.exp(-t * 2.4) * Math.min(1, t / 0.002);
      }
      break;
    }
    case 'pad': {
      const det = [-0.11, -0.04, 0.04, 0.11];
      const ph = det.map(() => Math.random());
      for (let i = 0; i < len; i++) {
        const t = i / sr; let s = 0;
        det.forEach((dt, k) => { ph[k] = (ph[k] + f * Math.pow(2, dt / 12) / sr) % 1; s += 2 * ph[k] - 1; });
        d[i] = s * 0.25 * Math.min(1, t / 0.25) * Math.min(1, (durSec - t) / 0.3);
      }
      onePoleLP(d, Math.min(4000, f * 6), sr); onePoleLP(d, Math.min(5000, f * 8), sr);
      break;
    }
    case 'lead': {
      let ph = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr; const vib = t > 0.15 ? 1 + 0.006 * Math.sin(TAU * 5.5 * t) : 1;
        ph = (ph + f * vib / sr) % 1;
        const pulse = ph < 0.35 ? 1 : -1;
        d[i] = pulse * Math.min(1, t / 0.01) * (0.75 + 0.25 * Math.exp(-t * 6)) * Math.min(1, (durSec - t) / 0.04);
      }
      onePoleLP(d, Math.min(7000, f * 10), sr);
      break;
    }
    default: {
      for (let i = 0; i < len; i++) { const t = i / sr; d[i] = Math.sin(TAU * f * t) * Math.min(1, (durSec - t) / 0.05); }
    }
  }
}

/**
 * Render one note of an instrument to a mono AudioBuffer (cached).
 * @param ctx BaseAudioContext
 * @param instId instrument id
 * @param opts { midi, durSec } — drums ignore midi; pitched use durSec as gate length (+ small release)
 */
export function renderNote(ctx, instId, opts = {}) {
  const inst = getInstrument(instId) || INSTRUMENTS[0];
  const sr = ctx.sampleRate;
  const midi = inst.kind === 'drum' ? 0 : Math.round(opts.midi ?? inst.note ?? 60);
  const durSec = inst.kind === 'drum'
    ? inst.dur
    : Math.max(0.06, Math.min(8, Number(opts.durSec) || inst.dur));
  const key = `${inst.id}|${midi}|${durSec.toFixed(3)}|${sr}`;
  if (cache.has(key)) return cache.get(key);
  const len = Math.max(1, Math.floor(sr * durSec));
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  synth(inst.id, d, sr, midiToFreq(midi || 60), durSec);
  normalize(d, inst.kind === 'drum' ? 0.85 : 0.6);
  fadeEdges(d, sr, inst.kind === 'drum' ? 0 : 0.002, 0.01);
  if (cache.size > 400) cache.clear();
  cache.set(key, buf);
  return buf;
}

/** Sum several notes (chord) into one buffer. */
export function renderChord(ctx, instId, midis, durSec) {
  const parts = midis.map((m) => renderNote(ctx, instId, { midi: m, durSec }));
  const len = Math.max(...parts.map((p) => p.length));
  const out = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = out.getChannelData(0);
  parts.forEach((p) => { const s = p.getChannelData(0); for (let i = 0; i < s.length; i++) d[i] += s[i] / Math.sqrt(midis.length); });
  normalize(d, 0.7);
  return out;
}

/**
 * Mix note events into a single mono AudioBuffer.
 * events: [{ inst, midi, startSec, durSec, gain }]
 */
export function mixEvents(ctx, events, totalSec) {
  const sr = ctx.sampleRate;
  const len = Math.max(1, Math.floor(sr * totalSec));
  const out = ctx.createBuffer(1, len, sr);
  const d = out.getChannelData(0);
  events.forEach((ev) => {
    const src = renderNote(ctx, ev.inst, { midi: ev.midi, durSec: ev.durSec }).getChannelData(0);
    const off = Math.floor(ev.startSec * sr);
    const g = ev.gain ?? 1;
    for (let i = 0; i < src.length && off + i < len; i++) d[off + i] += src[i] * g;
  });
  let peak = 0;
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i]));
  if (peak > 0.95) { const k = 0.95 / peak; for (let i = 0; i < len; i++) d[i] *= k; }
  return out;
}

/** Fire a one-off preview through a destination node (defaults to engine master). */
export function previewNote(engine, instId, opts = {}, dest) {
  if (!engine.ctx) return null;
  const src = engine.ctx.createBufferSource();
  src.buffer = renderNote(engine.ctx, instId, opts);
  const g = engine.ctx.createGain();
  g.gain.value = opts.gain ?? 0.9;
  src.connect(g);
  g.connect(dest || engine.masterGain);
  src.start(opts.when || 0);
  return src;
}

/**
 * Instruments tab UI.
 * hooks: { armPattern(instId), armKit(kitId), useInPiano(instId) }
 */
export function mountInstruments(root, engine, library, toast, onLibraryChange, hooks = {}) {
  let cat = 'all';
  root.innerHTML = `
    <div class="panel-head">
      <h2>Instruments</h2>
      <span class="badge warn" title="Synthesized procedurally in your browser — demo quality">DEMO · Web Audio</span>
    </div>
    <p class="panel-desc">Built-in procedural instruments &amp; kits — every sound is synthesized in this tab (no samples shipped, no Image-Line content). Send drums to <strong>Pattern</strong>, melodic voices to <strong>Piano</strong>, or drop one-shots into the Library.</p>
    <div class="inst-cats" data-cats>
      ${CATEGORIES.map((c) => `<button type="button" class="btn sm ghost ${c.id === cat ? 'active' : ''}" data-cat="${c.id}">${c.label}</button>`).join('')}
    </div>
    <div class="inst-list" data-list></div>
  `;
  const list = root.querySelector('[data-list]');

  function instCard(i) {
    return `
      <div class="inst-card" data-inst="${i.id}">
        <div class="inst-card-head">
          <span class="lib-swatch" style="background:${i.color}"></span>
          <strong>${i.name}</strong>
          <span class="badge warn">Demo</span>
          <span class="inst-kind">${i.kind === 'drum' ? 'One-shot' : 'Pitched'}</span>
        </div>
        <p class="inst-desc">${i.desc}</p>
        <div class="btn-row">
          <button type="button" class="btn sm ghost" data-prev="${i.id}" title="Preview">▶</button>
          <button type="button" class="btn sm ghost" data-lib="${i.id}" title="Add a one-shot to the Library">+ Library</button>
          <button type="button" class="btn sm" data-pat="${i.id}" title="Add a row to the Pattern channel rack">→ Pattern</button>
          ${i.kind === 'pitched' ? `<button type="button" class="btn sm" data-piano="${i.id}" title="Use as the Piano roll instrument">→ Piano</button>` : ''}
        </div>
      </div>`;
  }
  function kitCard(k) {
    return `
      <div class="inst-card kit" data-kit="${k.id}">
        <div class="inst-card-head">
          <span class="lib-swatch" style="background:linear-gradient(135deg,#F5C518,#8a6d10)"></span>
          <strong>${k.name}</strong>
          <span class="badge warn">Demo kit</span>
          <span class="inst-kind">${k.rows.length} rows</span>
        </div>
        <p class="inst-desc">${k.desc}</p>
        <div class="btn-row">
          <button type="button" class="btn sm primary" data-armkit="${k.id}">Arm Pattern</button>
          <button type="button" class="btn sm ghost" data-kitlib="${k.id}">+ Library</button>
        </div>
      </div>`;
  }

  function render() {
    root.querySelectorAll('[data-cat]').forEach((b) => b.classList.toggle('active', b.dataset.cat === cat));
    const insts = INSTRUMENTS.filter((i) => cat === 'all' || i.cat === cat);
    const kits = cat === 'all' || cat === 'kits' || cat === 'drums' ? KITS : [];
    list.innerHTML = (cat === 'kits' ? '' : insts.map(instCard).join(''))
      + (kits.length ? `<div class="inst-sub">Kits</div>${kits.map(kitCard).join('')}` : '');
  }

  function addToLibrary(instId) {
    const inst = getInstrument(instId);
    if (!inst || !engine.ctx) return;
    const buffer = renderNote(engine.ctx, inst.id, { midi: inst.note, durSec: inst.dur });
    library.add({
      id: `inst-${inst.id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      name: inst.kind === 'pitched' ? `${inst.short} ${noteName(inst.note)}` : inst.short,
      buffer,
      color: inst.color,
      durationBeats: Math.max(0.25, buffer.duration / engine.secondsPerBeat),
      source: 'instrument',
    });
  }

  root.addEventListener('click', async (e) => {
    const c = e.target.closest('[data-cat]');
    if (c) { cat = c.dataset.cat; render(); return; }
    await engine.init();
    await engine.resume();
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.prev) {
      const inst = getInstrument(b.dataset.prev);
      previewNote(engine, inst.id, { midi: inst.note, durSec: inst.dur });
    } else if (b.dataset.lib) {
      addToLibrary(b.dataset.lib);
      onLibraryChange?.();
      toast(`${getInstrument(b.dataset.lib).name} added to Library`);
    } else if (b.dataset.pat) {
      hooks.armPattern?.(b.dataset.pat);
    } else if (b.dataset.piano) {
      hooks.useInPiano?.(b.dataset.piano);
    } else if (b.dataset.armkit) {
      hooks.armKit?.(b.dataset.armkit);
    } else if (b.dataset.kitlib) {
      const kit = getKit(b.dataset.kitlib);
      kit.rows.forEach((r) => addToLibrary(r.inst));
      onLibraryChange?.();
      toast(`${kit.name}: ${kit.rows.length} one-shots added to Library`);
    }
  });

  render();
  return { render };
}
