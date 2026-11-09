/**
 * Ghost Harmony — muted chord pad under lead from key / Stem DNA (DEMO).
 */
import { registerFeature } from './registry.js';
import { godApply } from './apply.js';
import {
  COLORS, SCALES, chordFreqs, parseRoot, matchScale, NOTE_HZ,
} from '../../audio/generator.js';
import { ensureNamedTrack, selectedTrack, lastClipOnTrack, chipRow, bindChips } from './util.js';

const QUALITIES = [
  { id: 'triad', label: 'Triad' },
  { id: 'seventh', label: '7th' },
];

registerFeature({
  id: 'ghost-harmony',
  title: 'Ghost Harmony',
  blurb: 'Drop a muted chord pad under the lead from Stem DNA / session key — ghost layer you can unmute.',
  badge: 'DEMO',
  mount(cardEl, ctx) {
    cardEl.innerHTML = `
      <label class="field sx-god-field">
        <span>Root (blank = DNA / A)</span>
        <input type="text" data-gh-root placeholder="e.g. A minor" />
      </label>
      ${chipRow(QUALITIES, { name: 'gh-qual' })}
      <div class="btn-row">
        <button type="button" class="btn primary sm" data-gh-go>Add ghost chords</button>
      </div>
      <p class="fineprint" data-gh-status>Muted Chords track · unmute to hear · DEMO</p>
    `;
    const getQual = bindChips(cardEl, '[data-chip-group="gh-qual"]');
    const status = cardEl.querySelector('[data-gh-status]');

    cardEl.querySelector('[data-gh-go]').addEventListener('click', async () => {
      const engine = ctx.engine;
      if (!engine) return;
      const raw = cardEl.querySelector('[data-gh-root]').value.trim();
      const dna = ctx.stemDna?.lastAnalysis;
      let rootName = parseRoot(raw).name;
      let rootHz = parseRoot(raw).hz;
      if (!raw && dna?.key?.key) {
        rootName = dna.key.key;
        rootHz = (NOTE_HZ[rootName] || 220) / 2;
      } else if (!raw) {
        rootHz = 110;
        rootName = 'A';
      } else {
        rootHz = parseRoot(raw).hz;
        if (rootHz > 300) rootHz /= 2;
      }
      const scaleName = matchScale(raw || dna?.key?.mode || 'minor', dna?.key?.mode === 'major' ? 'major' : 'minor');
      const scale = SCALES[scaleName] || SCALES.minor;
      const quality = getQual() || 'triad';

      // Align under lead if present
      const lead = engine.tracks.find((t) => /lead|melod|synth/i.test(t.name)) || selectedTrack(ctx);
      const leadClip = lead ? lastClipOnTrack(lead) : null;
      const startBeat = leadClip?.startBeat ?? 0;
      const durationBeats = leadClip?.durationBeats ?? 16;

      await godApply(ctx, 'Ghost Harmony', async () => {
        await engine.init();
        const track = ensureNamedTrack(
          engine,
          (t) => /ghost|chord|pad|harm/i.test(t.name),
          'Ghost Chords',
          'audio',
        );
        // Clear prior ghost clips on this track
        track.clips = track.clips.filter((c) => c.meta?.kind !== 'god-ghost-harmony');
        const freqs = chordFreqs(rootHz, scale, quality);
        const durSec = Math.min(12, durationBeats * engine.secondsPerBeat);
        const buf = engine.createBufferFromRecipe({ type: 'pad', duration: durSec, freqs });
        engine.addClip(track.id, {
          name: `Ghost ${rootName} ${quality}`,
          startBeat,
          durationBeats,
          color: COLORS.pad,
          buffer: buf,
          recipe: { type: 'pad', duration: durSec, freqs },
          meta: {
            kind: 'god-ghost-harmony',
            root: rootName,
            scale: scaleName,
            quality,
            freqs,
          },
        });
        track.muted = true;
        track.volume = Math.min(track.volume ?? 0.7, 0.65);
        if (typeof engine.setTrackVolume === 'function') {
          engine.setTrackVolume(track.id, track.volume);
        }
        engine._emit?.('tracks', engine.tracks);
        status.textContent = `${rootName} ${scaleName} ${quality} · muted on ${track.name} · ${durationBeats} beats · DEMO`;
      });
    });
  },
});
