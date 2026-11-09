/**
 * W3 #13 Harmony Suggest Net — next-chord candidates in the session key from a hand-weighted
 * first-order Markov table (pop / soulful / afro flavours), conditioned on the last chord found in
 * your keys clips. Generates a seeded progression as a notes clip. Honest: a probability table
 * written by hand — not a neural network.
 */
import { registerFeature } from '../registry.js';
import { makeBatch } from '../command-schema.js';
import { executeBatch, resultLine } from '../command-exec.js';
import { SCALES, mulberry32, seedFrom } from '../../../audio/generator.js';
import { songBars, playheadBeat } from '../sections.js';
import { roleOfTrack } from '../roles.js';
import { sessionKey } from '../wave2/key-lock-choir.js?v=20261008md';
import { setStatus, esc } from '../w23-ui.js';

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const hzToMidi = (f) => 69 + 12 * Math.log2(f / 440);
const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

/** degree → [[nextDegree, weight]] (0-based scale degrees). */
export const TABLES = {
  pop: { 0: [[4, 3], [3, 3], [5, 2.5], [1, 1.5]], 1: [[4, 4], [3, 1], [6, 0.5]], 2: [[5, 3], [3, 2]], 3: [[0, 3], [4, 3], [1, 1.5], [5, 1]], 4: [[0, 4], [5, 2.5], [3, 1]], 5: [[3, 3.5], [1, 2], [4, 2]], 6: [[0, 3], [2, 1]] },
  soulful: { 0: [[1, 3], [5, 2.5], [3, 2], [2, 1]], 1: [[4, 5], [2, 1]], 2: [[5, 3], [1, 2]], 3: [[2, 2], [4, 2], [0, 1.5], [6, 1]], 4: [[0, 4], [2, 1.5], [5, 1.5]], 5: [[1, 4], [3, 2]], 6: [[2, 3], [0, 1]] },
  afro: { 0: [[5, 3.5], [3, 3], [6, 2.5], [4, 1]], 1: [[4, 2], [0, 2]], 2: [[6, 3], [5, 2]], 3: [[0, 3], [6, 2.5], [5, 1.5]], 4: [[0, 3], [5, 2]], 5: [[2, 2.5], [6, 3], [3, 2]], 6: [[0, 3.5], [5, 2], [3, 1]] },
};

export function chordPcs(root, scale, deg, sevenths = false) {
  const steps = sevenths ? [0, 2, 4, 6] : [0, 2, 4];
  return steps.map((s) => {
    const k = deg + s;
    return root + scale[k % scale.length] + 12 * Math.floor(k / scale.length);
  });
}

export function chordName(root, scale, deg) {
  const [a, b, c] = chordPcs(root, scale, deg);
  const third = (b - a + 12) % 12;
  const fifth = (c - a + 12) % 12;
  const q = third === 3 ? (fifth === 6 ? 'dim' : 'm') : '';
  const rn = third === 3 ? ROMAN[deg].toLowerCase() : ROMAN[deg];
  return { roman: `${rn}${q === 'dim' ? '°' : ''}`, name: `${NAMES[a % 12]}${q}` };
}

export function nextCandidates(flavor, deg) {
  const row = (TABLES[flavor] || TABLES.pop)[deg] || TABLES.pop[0];
  const tot = row.reduce((m, [, w]) => m + w, 0);
  return row.map(([d, w]) => ({ deg: d, p: w / tot })).sort((a, b) => b.p - a.p);
}

export function progression(flavor, startDeg, n, seed = 1) {
  const rng = mulberry32(seedFrom(`harm|${flavor}|${startDeg}|${seed}`));
  const out = [];
  let d = startDeg;
  for (let i = 0; i < n; i++) {
    const c = nextCandidates(flavor, d);
    let x = rng(); let pick = c[0].deg;
    for (const k of c) { if ((x -= k.p) <= 0) { pick = k.deg; break; } }
    out.push(pick); d = pick;
  }
  return out;
}

/** Last chord in keys tracks → best-matching scale degree (or tonic). */
export function lastChordDegree(engine, root, scale) {
  let best = null;
  engine.tracks.filter((t) => roleOfTrack(t) === 'keys').forEach((t) => t.clips.forEach((c) => (c.notes || []).forEach((n) => {
    const at = c.startBeat + n.beat;
    if (!best || at > best.at + 0.01) best = { at, pcs: new Set([Math.round(hzToMidi(n.freq)) % 12]) };
    else if (Math.abs(at - best.at) <= 0.01) best.pcs.add(Math.round(hzToMidi(n.freq)) % 12);
  })));
  if (!best || best.pcs.size < 2) return { deg: 0, found: false };
  let top = { deg: 0, score: -1 };
  for (let d = 0; d < 7; d++) {
    const pcs = chordPcs(root, scale, d).map((x) => x % 12);
    const s = pcs.filter((p) => best.pcs.has(p)).length + (pcs[0] === [...best.pcs].sort((a, b) => a - b)[0] ? 0.2 : 0);
    if (s > top.score) top = { deg: d, score: s };
  }
  return { deg: top.deg, found: true };
}

registerFeature({
  id: 'harmony-suggest-net',
  title: 'Harmony Suggest Net',
  blurb: 'Next-chord candidates in your key with probabilities (hand-weighted Markov table), conditioned on your last chord — then write a progression clip.',
  badge: 'DEMO',
  wave: 3,
  mount(card, ctx) {
    card.innerHTML = `
      <div class="sx-god-row">
        <label class="field"><span>Flavour</span><select data-hn-flav><option value="afro">Afro / amapiano</option><option value="pop">Pop</option><option value="soulful">Soulful (ii–V)</option></select></label>
        <label class="field"><span>Bars</span><select data-hn-n><option>4</option><option>8</option></select></label>
        <label class="field"><span>Place at</span><select data-hn-at><option value="end">After song end</option><option value="playhead">Playhead bar</option></select></label>
        <label class="toggle"><input type="checkbox" data-hn-7 /> <span>7ths</span></label>
      </div>
      <p class="fineprint" data-hn-now></p>
      <div class="sx-god-bars" data-hn-cands></div>
      <p class="fineprint" data-hn-prog></p>
      <div class="btn-row"><button type="button" class="btn sm" data-hn-roll>Suggest progression</button><button type="button" class="btn primary sm" data-hn-add>Write clip</button></div>
      <p class="fineprint" data-hn-status>Hand-weighted Markov table — honest: not a neural net · DEMO</p>
    `;
    const engine = ctx.engine;
    const status = card.querySelector('[data-hn-status]');
    let seed = 1; let prog = []; let k = null; let scale = null; let start = 0;
    const flav = () => card.querySelector('[data-hn-flav]').value;
    const refresh = () => {
      k = sessionKey(ctx);
      scale = SCALES[k.mode] || SCALES.minor;
      const last = lastChordDegree(engine, k.root, scale);
      start = last.deg;
      const cn = chordName(k.root, scale, start);
      card.querySelector('[data-hn-now]').textContent = `Key ${NAMES[k.root]} ${k.mode} · ${last.found ? 'last chord' : 'starting from'} ${cn.roman} (${cn.name})`;
      card.querySelector('[data-hn-cands]').innerHTML = nextCandidates(flav(), start).map((c) => { const n = chordName(k.root, scale, c.deg); return `<div class="bar" title="${Math.round(c.p * 100)}%"><i style="width:${Math.round(c.p * 100)}%"></i><span>${esc(n.roman)} ${esc(n.name)} · ${Math.round(c.p * 100)}%</span></div>`; }).join('');
      prog = progression(flav(), start, Number(card.querySelector('[data-hn-n]').value), seed);
      card.querySelector('[data-hn-prog]').textContent = `Progression: ${prog.map((d) => { const n = chordName(k.root, scale, d); return `${n.roman} ${n.name}`; }).join(' → ')}`;
    };
    card.addEventListener('change', refresh);
    refresh();
    card.querySelector('[data-hn-roll]').addEventListener('click', () => { seed += 1; refresh(); });
    card.querySelector('[data-hn-add]').addEventListener('click', async () => {
      refresh();
      const sev = card.querySelector('[data-hn-7]').checked;
      const notes = [];
      prog.forEach((d, i) => chordPcs(k.root, scale, d, sev).forEach((m) => notes.push({ beat: i * 4, dur: 3.8, freq: +midiToHz(48 + m).toFixed(2), vel: 0.5, wave: 'triangle' })));
      const bar = card.querySelector('[data-hn-at]').value === 'playhead' ? Math.floor(playheadBeat(engine) / 4) : songBars(engine);
      const res = await executeBatch(ctx, makeBatch(`Harmony Suggest: ${prog.length} chords`, [{ action: 'add_clip', track: 'Harmony', create_track: true, bar, name: prog.map((d) => chordName(k.root, scale, d).name).join(' '), color: '#63B3ED', source: { type: 'notes', notes, duration_beats: prog.length * 4 } }]));
      setStatus(status, `${resultLine(res)}${res.status === 'success' ? ` · at bar ${bar + 1} on Harmony` : ''}`);
    });
  },
});
