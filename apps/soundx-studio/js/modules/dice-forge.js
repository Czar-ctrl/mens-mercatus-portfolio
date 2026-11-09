/**
 * Dice Forge — seeded randomiser for Beats · Melody · Chords with a Deep House /
 * Tradingfloor bias (kick sits late, hats push early, sparse melody, lush 7th/9th chords).
 *
 * Everything writes into state the app already uses:
 *   Beats  → Pattern rack rows (patternApi.loadMeta) — rows carry `nudge` (fraction of a 1/16 step)
 *   Melody → Piano roll notes (pianoApi.loadNotes)
 *   Chords → Piano roll notes (pad / keys) + a sub bass line that follows the roots
 * "Place on Song" bounces all three as editable clips (meta.kind pattern / piano).
 * Sound = procedural Web Audio instruments (DEMO synth), not sampled packs.
 */
import { renderPatternBuffer } from './pattern-rack.js?v=20261006w-sxs20261020b';
import { renderPianoBuffer } from './piano-roll.js?v=20261006w-sxs20261020b';
import { mixEvents, noteName, getInstrument } from './instruments.js?v=20261006p-sxs20261020b';

export const MODES = {
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
};

export const KEYS = [
  { id: 'Am', label: 'A minor', root: 57, mode: 'aeolian' },
  { id: 'F#m', label: 'F♯ minor', root: 54, mode: 'aeolian' },
  { id: 'Gm', label: 'G minor', root: 55, mode: 'aeolian' },
  { id: 'Cm', label: 'C minor', root: 48, mode: 'aeolian' },
  { id: 'Ddor', label: 'D dorian', root: 50, mode: 'dorian' },
  { id: 'Edor', label: 'E dorian', root: 52, mode: 'dorian' },
  { id: 'Bbm', label: 'B♭ minor', root: 58, mode: 'aeolian' },
  { id: 'Ephr', label: 'E phrygian', root: 52, mode: 'phrygian' },
];

const PROGRESSIONS = {
  aeolian: [[0, 5, 2, 6], [0, 3, 6, 2], [0, 4, 5, 3], [0, 5, 3, 4], [0, 6, 5, 6], [0, 3, 4, 0]],
  dorian: [[0, 3, 0, 3], [0, 1, 0, 3], [0, 6, 3, 0], [0, 3, 6, 4]],
  phrygian: [[0, 1, 0, 6], [0, 1, 6, 1], [0, 6, 5, 1]],
};

/* —— seeded RNG (mulberry32) —— */
export function rng(seed) {
  let a = seed >>> 0;
  const r = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.chance = (p) => r() < p;
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  r.int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  return r;
}
export const newSeed = () => Math.floor(Math.random() * 1e9);
export const getKey = (id) => KEYS.find((k) => k.id === id) || KEYS[0];

function stepsWhere(r, steps, p) { return steps.filter(() => r.chance(p)); }
function toRow(inst, on, { vol = 0.8, nudge = 0, acc = [], midi } = {}) {
  const steps = Array(16).fill(0);
  on.forEach((s) => { steps[s] = acc.includes(s) ? 2 : 1; });
  return { inst, midi: midi ?? getInstrument(inst)?.note ?? 60, vol, muted: false, steps, nudge };
}

/** Beats — 1-bar 16-step Pattern-rack rows, deep house pocket. */
export function rollBeats(seed) {
  const r = rng(seed);
  const rows = [];
  const kick = [0, 4, 8, 12];
  if (r.chance(0.22)) kick.push(r.pick([14, 15, 7]));
  rows.push(toRow('kick', kick, { vol: 0.92, nudge: 0.06 + r() * 0.04 }));
  const clap = [4, 12];
  if (r.chance(0.25)) clap.push(15);
  rows.push(toRow(r.chance(0.8) ? 'clap' : 'snare', clap, { vol: 0.62, nudge: 0.02 }));
  let open = stepsWhere(r, [2, 6, 10, 14], 0.88);
  if (open.length < 3) open = [2, 6, 10, 14];
  rows.push(toRow('hatO', open, { vol: 0.5, nudge: -0.05 }));
  const closed = [];
  for (let s = 0; s < 16; s++) {
    if (open.includes(s)) continue;
    if (r.chance(s % 2 ? 0.62 : 0.3)) closed.push(s);
  }
  rows.push(toRow('hatC', closed, { vol: 0.38, nudge: -0.07, acc: closed.filter((s) => s % 4 === 3 && r.chance(0.5)) }));
  if (r.chance(0.6)) rows.push(toRow('shaker', stepsWhere(r, [1, 3, 5, 7, 9, 11, 13, 15], 0.55), { vol: 0.32, nudge: -0.04 }));
  // Afro-tech perc: syncopated rim/tom figure
  const pool = [3, 6, 7, 10, 11, 13, 15];
  const perc = [];
  const n = r.int(2, 4);
  while (perc.length < n) { const s = r.pick(pool); if (!perc.includes(s)) perc.push(s); }
  rows.push(toRow('rim', perc.sort((a, b) => a - b), { vol: 0.5, nudge: 0.03 }));
  if (r.chance(0.35)) rows.push(toRow('tom', [r.pick([10, 11, 13]), 14].filter((v, i, a) => a.indexOf(v) === i), { vol: 0.42 }));
  return { bars: 1, rows, seed };
}

function scaleMidi(key, degree, octave = 0) {
  const sc = MODES[key.mode];
  const o = Math.floor(degree / 7);
  const d = ((degree % 7) + 7) % 7;
  return key.root + sc[d] + 12 * (o + octave);
}

/** Melody — 2 bars, sparse, syncopated, mostly scale degrees 0/2/3/4/6 of the mode. */
export function rollMelody(seed, keyId) {
  const r = rng(seed ^ 0x9e3779b9);
  const key = getKey(keyId);
  const slots = [
    { s: 0, w: 0.5 }, { s: 1.5, w: 1.4 }, { s: 0.75, w: 1 }, { s: 2.5, w: 1.3 }, { s: 1, w: 0.4 },
    { s: 3, w: 0.6 }, { s: 3.5, w: 1.2 }, { s: 2.75, w: 0.9 }, { s: 1.75, w: 0.8 }, { s: 2, w: 0.3 },
  ];
  const count = r.int(3, 5);
  const chosen = [];
  const bag = [...slots];
  while (chosen.length < count && bag.length) {
    const total = bag.reduce((t, x) => t + x.w, 0);
    let x = r() * total;
    const i = bag.findIndex((b) => (x -= b.w) <= 0);
    chosen.push(bag.splice(Math.max(0, i), 1)[0].s);
  }
  chosen.sort((a, b) => a - b);
  const pref = [0, 2, 4, 3, 6, 0, 4];
  let deg = r.pick([0, 2, 4]);
  const bar1 = chosen.map((start, i) => {
    if (i) deg = Math.max(-1, Math.min(7, deg + r.pick([-2, -1, 1, 2, 0, pref[r.int(0, 6)] - deg])));
    const next = chosen[i + 1] ?? 4;
    const len = Math.min(next - start, r.pick([0.25, 0.5, 0.5, 0.75, 1]));
    return { midi: scaleMidi(key, deg, 1), start, len: Math.max(0.25, len), vel: +(0.62 + r() * 0.28).toFixed(2) };
  });
  // Bar 2 = answer: same rhythm, last note resolves to root / 3rd, maybe one note dropped (space).
  const bar2 = bar1.map((n, i) => ({ ...n, start: n.start + 4 })).filter((n, i, a) => !(i === 1 && a.length > 3 && r.chance(0.5)));
  if (bar2.length) bar2[bar2.length - 1].midi = scaleMidi(key, r.pick([0, 2, -3]), 1);
  const inst = r.pick(['pluck', 'pluck', 'keys', 'bell']);
  return { inst, bars: 2, notes: [...bar1, ...bar2], seed, key: key.id };
}

function chordName(midis) {
  const root = midis[0];
  const iv = midis.map((m) => (m - root) % 12);
  const m3 = iv.includes(3), M3 = iv.includes(4), b5 = iv.includes(6) && !iv.includes(7);
  const b7 = iv.includes(10), M7 = iv.includes(11), nine = iv.includes(2) || iv.includes(1);
  const n = noteName(root).replace(/-?\d+$/, '');
  if (m3 && b5) return `${n}m7♭5`;
  if (m3) return `${n}m${b7 ? (nine ? '9' : '7') : ''}`;
  if (M3 && M7) return `${n}maj${nine ? '9' : '7'}`;
  if (M3 && b7) return `${n}${nine ? '9' : '7'}`;
  return n;
}

/** Chords — 4 bars, one chord per bar, diatonic 7ths/9ths, voice-led + sub bass following roots. */
export function rollChords(seed, keyId) {
  const r = rng(seed ^ 0x51ed27);
  const key = getKey(keyId);
  const prog = r.pick(PROGRESSIONS[key.mode]);
  const style = r.pick(['held', 'held', 'stab', 'push']);
  const notes = [];
  const bass = [];
  const names = [];
  let prev = null;
  prog.forEach((deg, bar) => {
    const stack = [0, 2, 4, 6].concat(r.chance(0.6) ? [8] : []).map((k) => scaleMidi(key, deg + k, 0));
    names.push(chordName(stack));
    // voice-lead: fold each tone into 50..72 closest to previous chord centre
    const centre = prev ? prev.reduce((a, b) => a + b, 0) / prev.length : 60;
    const voiced = stack.slice(1).map((m) => {
      let best = m;
      for (let o = -24; o <= 24; o += 12) if (Math.abs(m + o - centre) < Math.abs(best - centre) && m + o >= 50 && m + o <= 74) best = m + o;
      return best;
    }).sort((a, b) => a - b);
    prev = voiced;
    const b0 = bar * 4;
    const rhythm = style === 'held' ? [[0, 3.9, 0.62]]
      : style === 'stab' ? [[0, 0.75, 0.7], [1.5, 0.5, 0.58], [3, 0.75, 0.64]]
        : [[0, 2.5, 0.64], [3.5, 0.5, 0.56]];
    rhythm.forEach(([s, len, vel]) => voiced.forEach((m) => notes.push({ midi: m, start: b0 + s, len, vel })));
    const rootB = scaleMidi(key, deg, -1) - (scaleMidi(key, deg, -1) > 45 ? 12 : 0);
    const bp = r.pick([
      [[0.5, 0.4], [1.5, 0.4], [2.5, 0.4], [3.5, 0.4]],
      [[0, 0.75], [1.5, 0.5], [2.75, 0.5], [3.5, 0.4]],
      [[0, 1.25], [2.5, 0.5], [3.25, 0.5]],
    ]);
    bp.forEach(([s, len], i) => bass.push({ midi: i === bp.length - 1 && r.chance(0.3) ? rootB + 12 : rootB, start: b0 + s, len, vel: 0.82 }));
  });
  return { inst: style === 'held' ? 'pad' : 'keys', bars: 4, notes, bass: { inst: 'sub', bars: 4, notes: bass }, names, style, seed, key: key.id };
}

export function rollAll(seed, keyId) {
  return { beats: rollBeats(seed), melody: rollMelody(seed, keyId), chords: rollChords(seed, keyId) };
}

/* —— shared store so Tradingfloor Form can use the latest rolls —— */
const listeners = new Set();
const store = { seed: 0, key: 'Am', beats: null, melody: null, chords: null };
export function getDiceState() { return store; }
export function onDiceChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { listeners.forEach((fn) => { try { fn(store); } catch (_) {} }); }
export function ensureDice() {
  if (!store.beats) { store.seed = newSeed(); Object.assign(store, rollAll(store.seed, store.key)); }
  return store;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Dice Forge panel (mounted in the Godmode tab).
 * deps: { patternApi, pianoApi, views, timelineApi, history }
 */
export function mountDiceForge(root, engine, toast, deps = {}) {
  ensureDice();
  root.classList.add('df-panel');
  root.innerHTML = `
    <div class="panel-head">
      <h2><span class="df-die" aria-hidden="true">🎲</span> Dice Forge</h2>
      <span class="badge">Live</span><span class="badge warn" title="Procedural Web Audio instruments">Demo synth</span>
    </div>
    <p class="panel-desc">Seeded randomiser with a <strong>Deep House · Tradingfloor</strong> bias — kick sits late, hats push early, sparse melody, lush 7th/9th chords. Rolls write straight into Pattern / Piano or onto the Song.</p>
    <div class="df-controls">
      <label class="field"><span>Key</span><select data-df-key>${KEYS.map((k) => `<option value="${k.id}">${k.label}</option>`).join('')}</select></label>
      <span class="df-seed" data-df-seed title="Same seed + key = same roll"></span>
      <button type="button" class="btn primary df-rollall" data-df-roll="all" title="Roll beats, melody and chords together">🎲 Roll all</button>
    </div>
    <section class="df-card" data-df-card="beats">
      <header><strong>Beats</strong><span class="df-sub">16-step · pocket nudged</span>
        <div class="df-btns">
          <button type="button" class="btn sm" data-df-roll="beats" title="Roll a new groove">🎲 Beats</button>
          <button type="button" class="btn sm ghost" data-df-play="beats" title="Audition 2 bars">▶</button>
          <button type="button" class="btn sm ghost" data-df-send="beats" title="Load into the Pattern rack">→ Pattern</button>
        </div></header>
      <div class="df-grid" data-df-beats></div>
    </section>
    <section class="df-card" data-df-card="melody">
      <header><strong>Melody</strong><span class="df-sub">2 bars · sparse</span>
        <div class="df-btns">
          <button type="button" class="btn sm" data-df-roll="melody">🎲 Melody</button>
          <button type="button" class="btn sm ghost" data-df-play="melody" title="Audition">▶</button>
          <button type="button" class="btn sm ghost" data-df-send="melody" title="Load into the Piano roll">→ Piano</button>
        </div></header>
      <div class="df-notes" data-df-melody></div>
    </section>
    <section class="df-card" data-df-card="chords">
      <header><strong>Chords</strong><span class="df-sub">4 bars · minor / modal</span>
        <div class="df-btns">
          <button type="button" class="btn sm" data-df-roll="chords">🎲 Chords</button>
          <button type="button" class="btn sm ghost" data-df-play="chords" title="Audition chords + bass">▶</button>
          <button type="button" class="btn sm ghost" data-df-send="chords" title="Load chords into the Piano roll">→ Piano</button>
          <button type="button" class="btn sm ghost" data-df-send="bass" title="Load the bass line into the Piano roll">Bass → Piano</button>
        </div></header>
      <div class="df-chords" data-df-chords></div>
    </section>
    <div class="df-place">
      <label class="field"><span>At bar</span><input type="number" min="1" max="128" placeholder="▸ playhead" data-df-bar /></label>
      <label class="field"><span>Repeat</span><select data-df-rep><option value="4">4 bars</option><option value="8" selected>8 bars</option><option value="16">16 bars</option></select></label>
      <button type="button" class="btn primary" data-df-place title="Bounce beats, chords, bass and melody as editable clips on Dice tracks">Place all on Song</button>
    </div>
    <p class="fineprint">Clips stay editable — double-click a Dice clip in Song to open it in Pattern / Piano. Ctrl/⌘+Z undoes the last Place.</p>
  `;
  const $ = (s) => root.querySelector(s);
  const keySel = $('[data-df-key]');
  keySel.value = store.key;

  function render() {
    $('[data-df-seed]').textContent = `seed ${store.seed}`;
    const b = store.beats;
    $('[data-df-beats]').innerHTML = b.rows.map((r) => {
      const inst = getInstrument(r.inst);
      const nud = r.nudge ? `<em class="${r.nudge > 0 ? 'late' : 'early'}">${r.nudge > 0 ? 'late' : 'early'}</em>` : '<em></em>';
      return `<div class="df-row"><span class="df-rname">${esc(inst?.short || r.inst)}</span>${nud}<span class="df-steps">${r.steps.map((v, i) => `<i class="${v ? 'on' : ''} ${v === 2 ? 'acc' : ''} ${i % 4 === 0 ? 'beat' : ''}"></i>`).join('')}</span></div>`;
    }).join('');
    const m = store.melody;
    $('[data-df-melody]').innerHTML = `<span class="df-inst">${esc(getInstrument(m.inst)?.name || m.inst)}</span>` + m.notes.map((n) => `<span class="df-note" title="beat ${+(n.start + 1).toFixed(2)} · len ${n.len}">${noteName(n.midi)}<small>${+(n.start + 1).toFixed(2)}</small></span>`).join('');
    const c = store.chords;
    $('[data-df-chords]').innerHTML = `<span class="df-inst">${esc(getInstrument(c.inst)?.name)} · ${c.style}</span>` + c.names.map((n) => `<span class="df-chord">${esc(n)}</span>`).join('<span class="df-arrow">→</span>');
  }

  function roll(part) {
    const s = newSeed();
    store.key = keySel.value;
    if (part === 'all') { store.seed = s; Object.assign(store, rollAll(s, store.key)); }
    else if (part === 'beats') store.beats = rollBeats(s);
    else if (part === 'melody') store.melody = rollMelody(s, store.key);
    else if (part === 'chords') store.chords = rollChords(s, store.key);
    if (part !== 'all') store.seed = s;
    root.querySelectorAll(part === 'all' ? '.df-card' : `[data-df-card="${part}"]`).forEach((el) => {
      el.classList.remove('df-flash'); void el.offsetWidth; el.classList.add('df-flash');
    });
    render();
    emit();
    if (part === 'all') {
      deps.patternApi?.loadMeta?.({ kind: 'pattern', bars: 1, rows: store.beats.rows });
      toast(`Rolled ${getKey(store.key).label}: ${store.chords.names.join(' → ')} · beats loaded in Pattern`);
    } else toast(`🎲 ${part[0].toUpperCase() + part.slice(1)} rolled (seed ${s})`);
  }

  async function audition(part) {
    await engine.init(); await engine.resume?.();
    const spb = engine.secondsPerBeat;
    let buf;
    if (part === 'beats') buf = renderPatternBuffer(engine.ctx, { kind: 'pattern', bars: 2, rows: store.beats.rows }, spb);
    else if (part === 'melody') buf = renderPianoBuffer(engine.ctx, { kind: 'piano', ...store.melody }, spb);
    else {
      const ev = (meta) => meta.notes.map((n) => ({ inst: meta.inst, midi: n.midi, startSec: n.start * spb, durSec: Math.max(0.06, n.len * spb), gain: n.vel }));
      buf = mixEvents(engine.ctx, [...ev(store.chords), ...ev(store.chords.bass)], 16 * spb + 1);
    }
    const src = engine.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(engine.masterGain);
    src.start();
    toast(`Audition: ${part} @ ${engine.bpm} BPM (DEMO synth)`);
  }

  function send(part) {
    if (part === 'beats') {
      deps.patternApi?.loadMeta?.({ kind: 'pattern', bars: 1, rows: store.beats.rows });
      deps.views?.setMode?.('pattern');
      toast('Dice beats → Pattern rack (kick late / hats early nudges kept)');
      return;
    }
    const meta = part === 'melody' ? store.melody : part === 'bass' ? store.chords.bass : store.chords;
    const ok = deps.pianoApi?.loadNotes?.({ inst: meta.inst, bars: meta.bars, notes: meta.notes });
    if (ok) { deps.views?.setMode?.('piano'); toast(`Dice ${part} → Piano roll (${getInstrument(meta.inst)?.name}) · Write to track when happy`); }
  }

  function ensureTrack(name, type = 'audio') {
    return engine.tracks.find((t) => t.name === name) || engine.addTrack(type, name);
  }

  async function placeAll() {
    await engine.init();
    const typed = Number($('[data-df-bar]').value);
    const ph = engine.isPlaying ? engine.currentBeat : ((engine.pauseOffset || 0) / engine.secondsPerBeat || 0);
    const startBar = typed >= 1 ? Math.round(typed) : Math.floor(ph / 4) + 1;
    const rep = Number($('[data-df-rep]').value) || 8;
    const at = (startBar - 1) * 4;
    const added = [];
    const add = (track, clip) => { const c = engine.addClip(track.id, clip); if (c) added.push([track.id, c.id]); };
    const spb = engine.secondsPerBeat;
    const beatsMeta = { kind: 'pattern', bars: rep, rows: store.beats.rows.map((r) => ({ ...r, steps: [...r.steps] })), source: 'dice' };
    add(ensureTrack('Dice · Beats'), { name: `Dice beats · ${rep}b`, startBeat: at, durationBeats: rep * 4, color: '#F5C518', meta: beatsMeta, buffer: renderPatternBuffer(engine.ctx, beatsMeta, spb) });
    const loopNotes = (meta, unit) => {
      const out = [];
      for (let o = 0; o < rep * 4; o += unit * 4) meta.notes.forEach((n) => { if (n.start + o < rep * 4) out.push({ ...n, start: n.start + o }); });
      return { kind: 'piano', inst: meta.inst, bars: rep, notes: out, source: 'dice' };
    };
    const chordsMeta = loopNotes(store.chords, store.chords.bars);
    add(ensureTrack('Dice · Chords'), { name: `${store.chords.names.join(' ')}`, startBeat: at, durationBeats: rep * 4, color: '#B8860B', meta: chordsMeta, buffer: renderPianoBuffer(engine.ctx, chordsMeta, spb) });
    const bassMeta = loopNotes(store.chords.bass, store.chords.bass.bars);
    add(ensureTrack('Dice · Bass'), { name: 'Dice sub bass', startBeat: at, durationBeats: rep * 4, color: '#C79A1E', meta: bassMeta, buffer: renderPianoBuffer(engine.ctx, bassMeta, spb) });
    const melMeta = loopNotes(store.melody, store.melody.bars);
    add(ensureTrack('Dice · Melody', 'midi'), { name: `Dice ${getInstrument(store.melody.inst)?.short} hook`, startBeat: at, durationBeats: rep * 4, color: '#FFD447', meta: melMeta, buffer: renderPianoBuffer(engine.ctx, melMeta, spb) });
    deps.history?.push?.({ label: 'Removed Dice Forge clips', undo: () => added.forEach(([t, c]) => engine.removeClip(t, c)) });
    deps.views?.setMode?.('song');
    toast(`Dice Forge → Song @ bar ${startBar}: beats, chords, bass, melody (${rep} bars) · Ctrl+Z to undo`);
  }

  root.addEventListener('click', (e) => {
    const r = e.target.closest('[data-df-roll]'); if (r) { roll(r.dataset.dfRoll); return; }
    const p = e.target.closest('[data-df-play]'); if (p) { audition(p.dataset.dfPlay); return; }
    const s = e.target.closest('[data-df-send]'); if (s) { send(s.dataset.dfSend); return; }
    if (e.target.closest('[data-df-place]')) placeAll();
  });
  keySel.addEventListener('change', () => {
    store.key = keySel.value;
    store.melody = rollMelody(store.seed, store.key);
    store.chords = rollChords(store.seed, store.key);
    render(); emit();
    toast(`Key → ${getKey(store.key).label} (melody + chords re-voiced)`);
  });
  onDiceChange(() => { if (keySel.value !== store.key) keySel.value = store.key; render(); });
  render();
  return { roll, render, placeAll, getState: () => store };
}
