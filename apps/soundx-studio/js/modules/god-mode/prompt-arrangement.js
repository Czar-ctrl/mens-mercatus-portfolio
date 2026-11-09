/**
 * Prompt → Arrangement — text + genre chips → multi-track skeleton (DEMO).
 */
import { registerFeature } from './registry.js';
import { godApply } from './apply.js';
import {
  COLORS,
  GENRES,
  MOODS,
  SCALES,
  bassNotes,
  chordFreqs,
  degToHz,
  drumPattern,
  matchGenre,
  matchMood,
  matchScale,
  melodyContour,
  mulberry32,
  parseRoot,
  seedFrom,
} from '../../audio/generator.js';
import { ensureNamedTrack, chipRow, bindChips } from './util.js';

const GENRE_CHIPS = [
  { id: 'amapiano', label: 'Amapiano' },
  { id: 'trap', label: 'Trap' },
  { id: 'house', label: 'House' },
  { id: 'afrobeat', label: 'Afrobeat' },
  { id: 'drill', label: 'Drill' },
];

/** Map UI genre chips onto generator GENRES keys / drum styles */
const CHIP_TO_GENRE = {
  amapiano: { key: 'house', drum: 'four', bass: 'pulse', scale: 'minor', bpm: 112 },
  trap: { key: 'trap', drum: 'trap', bass: '808', scale: 'minor', bpm: 140 },
  house: { key: 'house', drum: 'four', bass: 'pulse', scale: 'minor', bpm: 124 },
  afrobeat: { key: 'pop', drum: 'straight', bass: 'root-fifth', scale: 'major', bpm: 108 },
  drill: { key: 'trap', drum: 'trap', bass: '808', scale: 'minor', bpm: 142 },
};

function writeDrums(engine, track, bars, style, startBeat, rng) {
  const pat = drumPattern(style, bars, rng);
  const kick = engine.createBufferFromRecipe({ type: 'kick', duration: 0.42 });
  const snare = engine.createBufferFromRecipe({ type: 'snare', duration: 0.28 });
  const hat = engine.createBufferFromRecipe({ type: 'hat', duration: 0.1 });
  const place = (hits, name, buf, color, dur) => {
    hits.forEach((beat) => {
      engine.addClip(track.id, {
        name, startBeat: startBeat + beat, durationBeats: dur, color, buffer: buf,
        meta: { kind: 'god-arrangement', role: name.toLowerCase() },
      });
    });
  };
  place(pat.kick, 'Kick', kick, COLORS.kick, 0.4);
  place(pat.snare, 'Snare', snare, COLORS.snare, 0.3);
  place(pat.hat, 'Hat', hat, COLORS.hat, 0.2);
}

function writeBass(engine, track, rootHz, bars, pattern, scale, startBeat, rng) {
  const rel = bassNotes(rootHz, bars, pattern, scale, rng);
  if (!rel.length) return;
  engine.addClip(track.id, {
    name: 'GM Bass',
    startBeat,
    durationBeats: bars * 4,
    color: COLORS.bass,
    notes: rel,
    meta: { kind: 'god-arrangement', role: 'bass' },
  });
}

function writeChords(engine, track, rootHz, scale, bars, startBeat) {
  const freqs = chordFreqs(rootHz, scale, 'triad');
  const durSec = Math.min(8, bars * 4 * engine.secondsPerBeat);
  const buf = engine.createBufferFromRecipe({ type: 'pad', duration: durSec, freqs });
  engine.addClip(track.id, {
    name: 'GM Chords',
    startBeat,
    durationBeats: bars * 4,
    color: COLORS.pad,
    buffer: buf,
    recipe: { type: 'pad', duration: durSec, freqs },
    meta: { kind: 'god-arrangement', role: 'chords' },
  });
}

function writeLead(engine, track, rootHz, scale, bars, sparse, startBeat, rng) {
  const contour = melodyContour(scale, bars * 4, rng, sparse);
  const notes = contour.map((n) => ({
    beat: n.beat,
    dur: n.dur,
    freq: degToHz(rootHz, n.degree, n.octave),
    wave: 'sine',
  }));
  engine.addClip(track.id, {
    name: 'GM Lead',
    startBeat,
    durationBeats: bars * 4,
    color: COLORS.lead,
    notes,
    meta: { kind: 'god-arrangement', role: 'lead' },
  });
}

registerFeature({
  id: 'prompt-arrangement',
  title: 'Prompt → Arrangement',
  blurb: 'Text + genre → Drums / Bass / Chords / Lead skeleton at session BPM. Local Web Audio — not a cloud model.',
  badge: 'DEMO',
  mount(cardEl, ctx) {
    cardEl.innerHTML = `
      <label class="field block sx-god-field">
        <span>Prompt</span>
        <textarea data-pa-prompt rows="2" placeholder="e.g. dark amapiano groove in A minor…"></textarea>
      </label>
      ${chipRow(GENRE_CHIPS, { name: 'pa-genre' })}
      <div class="btn-row">
        <button type="button" class="btn primary sm" data-pa-go>Generate arrangement</button>
      </div>
      <p class="fineprint" data-pa-status>8 bars · session BPM · DEMO</p>
    `;
    const getGenre = bindChips(cardEl, '[data-chip-group="pa-genre"]');

    cardEl.querySelector('[data-pa-go]').addEventListener('click', async () => {
      const engine = ctx.engine;
      if (!engine) {
        ctx.toast?.('Engine unavailable', 'error');
        return;
      }
      const prompt = cardEl.querySelector('[data-pa-prompt]').value.trim() || 'house groove';
      const chip = getGenre() || 'house';
      const map = CHIP_TO_GENRE[chip] || CHIP_TO_GENRE.house;
      const genreKey = matchGenre(prompt) !== 'pop' ? matchGenre(prompt) : map.key;
      const genre = GENRES[genreKey] || GENRES.house;
      const moodName = matchMood(prompt, genre.mood);
      const mood = MOODS[moodName] || MOODS.groovy;
      const { name, hz } = parseRoot(prompt);
      const scaleName = matchScale(prompt, map.scale || genre.scale);
      const scale = SCALES[scaleName] || SCALES.minor;
      let rootHz = hz;
      if (mood.rootShift) rootHz *= Math.pow(2, mood.rootShift / 12);
      if (rootHz > 300) rootHz /= 2;
      const bars = 8;
      const rng = mulberry32(seedFrom(`gm|${prompt}|${chip}|${engine.bpm}`));
      const status = cardEl.querySelector('[data-pa-status]');

      await godApply(ctx, 'Prompt → Arrangement', async () => {
        await engine.init();
        const drums = ensureNamedTrack(engine, (t) => /drum|perc|beat/i.test(t.name), 'Drums', 'audio');
        const bass = ensureNamedTrack(engine, (t) => /bass/i.test(t.name), 'Bass', 'audio');
        const chords = ensureNamedTrack(engine, (t) => /chord|pad|key|atmos/i.test(t.name), 'Chords', 'audio');
        const lead = ensureNamedTrack(engine, (t) => /lead|melod|synth/i.test(t.name) || t.type === 'midi', 'Lead', 'midi');
        [drums, bass, chords, lead].forEach((t) => { t.clips = []; });
        writeDrums(engine, drums, bars, map.drum || genre.drum, 0, rng);
        writeBass(engine, bass, rootHz, bars, map.bass || genre.bass, scale, 0, rng);
        writeChords(engine, chords, rootHz, scale, bars, 0);
        writeLead(engine, lead, rootHz, scale, bars, mood.leadSparse, 0, rng);
        engine._emit?.('tracks', engine.tracks);
        status.textContent = `${bars} bars · ${name} ${scaleName} · ${chip} · ${engine.bpm} BPM · DEMO`;
      });
    });
  },
});
