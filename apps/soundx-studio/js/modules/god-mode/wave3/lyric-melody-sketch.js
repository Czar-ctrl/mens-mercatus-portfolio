/**
 * W3 #7 Lyric → Melody Sketch — syllabify lyrics, place one note per syllable on a rhythm grid,
 * shape pitch with a contour in the session key (stressed syllables lifted, line ends resolve to
 * tonic/fifth). Writes a notes clip (with syllables attached) through the command protocol.
 * Rules + key math — no generative model, no vocals.
 */
import { registerFeature } from '../registry.js';
import { makeBatch } from '../command-schema.js';
import { executeBatch, resultLine } from '../command-exec.js';
import { SCALES } from '../../../audio/generator.js';
import { songBars, playheadBeat } from '../sections.js';
import { sessionKey } from '../wave2/key-lock-choir.js?v=20261008md-sxs20261020b';
import { lineSyllables } from './lyric-core.js?v=20261008md-sxs20261020b';
import { setStatus, esc } from '../w23-ui.js';

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const CONTOURS = {
  arch: (t) => Math.sin(Math.PI * t) * 4,
  rise: (t) => t * 5,
  fall: (t) => (1 - t) * 5,
  chant: (t, i) => [0, 0, 2, 0, 1, 0][i % 6],
  call: (t, i, line) => (line % 2 ? (1 - t) * 4 : t * 4),
};
const RHYTHMS = { eighths: [0.5], sixteenths: [0.25], syncopated: [0.75, 0.75, 0.5], triplet: [1 / 3] };

export function sketchNotes(lyrics, { root = 9, mode = 'minor', contour = 'arch', rhythm = 'eighths', octave = 4 } = {}) {
  const scale = SCALES[mode] || SCALES.minor;
  const base = 12 * (octave + 1) + root;
  const pattern = RHYTHMS[rhythm] || RHYTHMS.eighths;
  const fn = CONTOURS[contour] || CONTOURS.arch;
  const lines = String(lyrics || '').split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const notes = [];
  let lineStart = 0;
  lines.forEach((line, li) => {
    const syls = lineSyllables(line);
    let beat = lineStart;
    syls.forEach((s, i) => {
      const t = syls.length > 1 ? i / (syls.length - 1) : 0;
      let deg = Math.round(fn(t, i, li)) + (s.stress ? 1 : 0);
      if (s.end) deg = li % 2 ? 4 : 0;
      const oct = Math.floor(deg / scale.length);
      const pc = scale[((deg % scale.length) + scale.length) % scale.length];
      let dur = pattern[i % pattern.length];
      if (s.end) dur = Math.max(dur * 2, 1);
      notes.push({ beat: +beat.toFixed(4), freq: +midiToHz(base + pc + 12 * oct).toFixed(2), dur: +(dur * 0.95).toFixed(3), vel: s.stress ? 0.9 : 0.62, wave: 'triangle', syl: s.syl });
      beat += dur;
    });
    lineStart = Math.ceil((beat + 0.01) / 4) * 4; // next line on the next bar
  });
  return { notes, lengthBeats: Math.max(4, lineStart), lines: lines.length };
}

registerFeature({
  id: 'lyric-melody-sketch',
  title: 'Lyric → Melody Sketch',
  blurb: 'Paste lyrics → one note per syllable in your session key, shaped by a contour, stresses lifted, lines resolving home. A MIDI sketch to sing over.',
  badge: 'DEMO',
  wave: 3,
  mount(card, ctx) {
    card.innerHTML = `
      <label class="field block"><span>Lyrics (one line per phrase)</span><textarea rows="3" data-lm-text placeholder="We dance in the city tonight&#10;Lights on, we never sleep"></textarea></label>
      <div class="sx-god-row">
        <label class="field"><span>Contour</span><select data-lm-contour><option value="arch">Arch</option><option value="rise">Rise</option><option value="fall">Fall</option><option value="call">Call / response</option><option value="chant">Chant</option></select></label>
        <label class="field"><span>Rhythm</span><select data-lm-rhythm><option value="eighths">8ths</option><option value="sixteenths">16ths (flow)</option><option value="syncopated">Syncopated</option><option value="triplet">Triplets</option></select></label>
        <label class="field"><span>Place at</span><select data-lm-at><option value="end">After song end</option><option value="playhead">Playhead bar</option><option value="0">Bar 1</option></select></label>
      </div>
      <p class="fineprint" data-lm-key></p>
      <div class="btn-row"><button type="button" class="btn primary sm" data-lm-go>Sketch melody</button></div>
      <p class="fineprint" data-lm-status>Syllables → notes with rules in key · a sketch, not a vocal · DEMO</p>
    `;
    const engine = ctx.engine;
    const status = card.querySelector('[data-lm-status]');
    const keyEl = card.querySelector('[data-lm-key]');
    const showKey = () => { const k = sessionKey(ctx); keyEl.textContent = `Key: ${NAMES[k.root]} ${k.mode} (${k.source})`; return k; };
    showKey();
    card.querySelector('[data-lm-go]').addEventListener('click', async () => {
      const text = card.querySelector('[data-lm-text]').value;
      const k = showKey();
      const sk = sketchNotes(text, { root: k.root, mode: k.mode, contour: card.querySelector('[data-lm-contour]').value, rhythm: card.querySelector('[data-lm-rhythm]').value });
      if (!sk.notes.length) { setStatus(status, 'Type some lyrics first'); return; }
      const at = card.querySelector('[data-lm-at]').value;
      const bar = at === 'end' ? songBars(engine) : at === 'playhead' ? Math.floor(playheadBeat(engine) / 4) : 0;
      const name = `Lyric sketch · ${sk.notes.length} syl`;
      const res = await executeBatch(ctx, makeBatch('Lyric → Melody Sketch', [{ action: 'add_clip', track: 'Lyric Melody', create_track: true, bar, name, color: '#F687B3', source: { type: 'notes', notes: sk.notes, duration_beats: sk.lengthBeats } }]), {
        extra: () => {
          const t = engine.tracks.find((x) => x.name === 'Lyric Melody');
          const c = t && [...t.clips].reverse().find((x) => x.name === name && Math.abs(x.startBeat - bar * 4) < 1e-6);
          if (c) c.meta = { ...(c.meta || {}), tag: 'lyric-melody-sketch', lyrics: text.slice(0, 2000), role: 'vox' };
        },
      });
      setStatus(status, `${resultLine(res)}${res.status === 'success' ? ` · ${sk.lines} line${sk.lines === 1 ? '' : 's'}, ${sk.notes.length} syllables at bar ${bar + 1} · open Melody → Lyric Slots to edit words` : ''}`);
      void esc;
    });
  },
});
