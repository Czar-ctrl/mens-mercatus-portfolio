/**
 * W2 #15 Key Lock Choir — diatonic harmony voices (3rd / 5th / 6th above, octave below) under a
 * MIDI lead, snapped to the session key. Audio leads are not pitch-tracked (honest limit).
 */
import { registerFeature } from '../registry.js';
import { godApply } from '../apply.js';
import { SCALES, NOTE_HZ, inferHarmonyFromProject } from '../../../audio/generator.js';
import { bindTrackSelect, setStatus } from '../w23-ui.js';

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const hzToMidi = (f) => 69 + 12 * Math.log2(f / 440);
const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function sessionKey(ctx) {
  const dna = ctx.stemDna?.lastAnalysis?.key;
  if (dna?.key && NOTE_HZ[dna.key]) return { root: Math.round(hzToMidi(NOTE_HZ[dna.key])) % 12, mode: dna.mode === 'major' ? 'major' : 'minor', source: 'Stem DNA' };
  const h = inferHarmonyFromProject(ctx.engine);
  const root = Math.round(hzToMidi(NOTE_HZ[h.name] || 440)) % 12;
  return { root, mode: 'minor', source: 'first note in project' };
}

/** Diatonic shift: move a MIDI note by `steps` scale degrees in key. */
export function diatonicShift(midi, steps, root, scale) {
  const rel = midi - root;
  const oct = Math.floor(rel / 12);
  const pc = ((rel % 12) + 12) % 12;
  let deg = 0;
  let best = 99;
  scale.forEach((s, i) => { const d = Math.abs(s - pc); if (d < best) { best = d; deg = i; } });
  const n = scale.length;
  const target = deg + steps;
  const o2 = oct + Math.floor(target / n);
  const d2 = ((target % n) + n) % n;
  return root + o2 * 12 + scale[d2];
}

const VOICES = [
  { id: '3up', label: '3rd above', steps: 2 }, { id: '5up', label: '5th above', steps: 4 },
  { id: '6up', label: '6th above', steps: 5 }, { id: '8dn', label: 'Octave below', steps: -7 },
];

registerFeature({
  id: 'key-lock-choir',
  title: 'Key Lock Choir',
  blurb: 'Stack diatonic harmony voices (3rd / 5th / 6th / octave) under a MIDI lead, locked to the session key.',
  badge: 'DEMO',
  wave: 2,
  mount(card, ctx) {
    card.innerHTML = `
      <label class="field sx-god-field"><span>Lead track (note clips)</span><select data-kc-track></select></label>
      <div class="sx-god-checks">${VOICES.map((v, i) => `<label><input type="checkbox" data-kc-v="${v.id}" ${i < 2 ? 'checked' : ''}/> ${v.label}</label>`).join('')}</div>
      <label class="field sx-god-field"><span>Choir level <em data-kc-lv>55%</em></span><input type="range" min="0.2" max="1" step="0.05" value="0.55" data-kc-vel /></label>
      <div class="btn-row"><button type="button" class="btn primary sm" data-kc-go>Build choir</button></div>
      <p class="fineprint" data-kc-status></p>
    `;
    const engine = ctx.engine;
    const sel = card.querySelector('[data-kc-track]');
    bindTrackSelect(sel, ctx);
    const lead = engine.tracks.find((t) => t.clips.some((c) => c.notes?.length) && /lead|melod|key/i.test(t.name)) || engine.tracks.find((t) => t.clips.some((c) => c.notes?.length));
    if (lead) sel.value = lead.id;
    const vel = card.querySelector('[data-kc-vel]');
    vel.addEventListener('input', () => { card.querySelector('[data-kc-lv]').textContent = `${Math.round(vel.value * 100)}%`; });
    const status = card.querySelector('[data-kc-status]');
    const k = sessionKey(ctx);
    setStatus(status, `Key ${NAMES[k.root]} ${k.mode} (${k.source}) · DEMO`);
    card.querySelector('[data-kc-go]').addEventListener('click', async () => {
      const src = engine.tracks.find((t) => t.id === sel.value);
      const clips = (src?.clips || []).filter((c) => c.notes?.length);
      if (!clips.length) { setStatus(status, 'That track has no note clips — Key Lock Choir needs a MIDI lead (audio leads are not pitch-tracked in DEMO).'); return; }
      const voices = VOICES.filter((v) => card.querySelector(`[data-kc-v="${v.id}"]`).checked);
      if (!voices.length) { setStatus(status, 'Pick at least one voice.'); return; }
      const key = sessionKey(ctx);
      const scale = SCALES[key.mode];
      let count = 0;
      try {
        await godApply(ctx, 'Key Lock Choir', async () => {
          const choir = engine.tracks.find((t) => t.name === 'Choir') || engine.addTrack('midi', 'Choir');
          choir.clips = choir.clips.filter((c) => c.meta?.tag !== 'key-lock-choir');
          clips.forEach((c) => {
            const notes = [];
            c.notes.forEach((n) => {
              const m = Math.round(hzToMidi(n.freq));
              voices.forEach((v, vi) => notes.push({ beat: n.beat + vi * 0.005, dur: n.dur, freq: midiToHz(diatonicShift(m, v.steps, key.root, scale)), wave: 'triangle', vel: (n.vel ?? 1) * Number(vel.value) }));
            });
            engine.addClip(choir.id, { name: `Choir · ${c.name}`, startBeat: c.startBeat, durationBeats: c.durationBeats, color: '#F687B3', notes, meta: { tag: 'key-lock-choir' } });
            count += notes.length;
          });
          engine._emit('tracks', engine.tracks);
        });
        setStatus(status, `${count} choir notes in ${NAMES[key.root]} ${key.mode} (${voices.map((v) => v.label).join(', ')}) on Choir`);
      } catch (e) { setStatus(status, `✗ ${e.message}`); }
    });
  },
});
