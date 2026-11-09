/**
 * Cover Remap — genre/persona FX remap on selected clip/track (DEMO).
 */
import { registerFeature } from './registry.js';
import { godApply } from './apply.js';
import { selectedTrack, lastClipOnTrack } from './util.js';

const PRESETS = {
  coastal: {
    label: 'Coastal',
    rate: 0.97,
    eq: { low: 2, mid: -1, high: 3 },
    inserts: [
      { type: 'filter', amount: 0.25 },
      { type: 'chorus', amount: 0.45 },
      { type: 'space', amount: 0.55 },
    ],
    noteMul: 1.0,
    mood: 'chill',
  },
  'egoli-drill': {
    label: 'Egoli Drill',
    rate: 1.06,
    eq: { low: 4, mid: 1, high: -2 },
    inserts: [
      { type: 'eqlow', amount: 0.35 },
      { type: 'drive', amount: 0.55 },
      { type: 'crush', amount: 0.2 },
    ],
    noteMul: 0.9439, // ~ -1 semitone feel
    mood: 'dark',
  },
  'zenkai-hype': {
    label: 'Zenkai Hype',
    rate: 1.08,
    eq: { low: 1, mid: 3, high: 4 },
    inserts: [
      { type: 'comp', amount: 0.55 },
      { type: 'delay', amount: 0.4 },
      { type: 'drive', amount: 0.35 },
    ],
    noteMul: 1.1225, // ~ +2 semitones
    mood: 'energetic',
  },
  'amapiano-glow': {
    label: 'Amapiano Glow',
    rate: 1.0,
    eq: { low: 3, mid: 0, high: 2 },
    inserts: [
      { type: 'filter', amount: 0.3 },
      { type: 'delay', amount: 0.5 },
      { type: 'space', amount: 0.4 },
    ],
    noteMul: 1.0,
    mood: 'groovy',
  },
};

function clearInserts(inserts, channelId) {
  if (!inserts?.list) return;
  [...(inserts.list(channelId) || [])].forEach((it) => inserts.remove(channelId, it.uid));
}

registerFeature({
  id: 'cover-remap',
  title: 'Cover Remap',
  blurb: 'Restyle the selected track via preset FX + pitch/rate tags (Coastal · Egoli Drill · Zenkai Hype · Amapiano Glow).',
  badge: 'DEMO',
  mount(cardEl, ctx) {
    const opts = Object.entries(PRESETS).map(([id, p]) => `<option value="${id}">${p.label}</option>`).join('');
    cardEl.innerHTML = `
      <label class="field sx-god-field">
        <span>Preset</span>
        <select data-cr-preset>${opts}</select>
      </label>
      <div class="btn-row">
        <button type="button" class="btn primary sm" data-cr-go>Remap</button>
      </div>
      <p class="fineprint" data-cr-status>Applies inserts + note remap · DEMO</p>
    `;

    cardEl.querySelector('[data-cr-go]').addEventListener('click', async () => {
      const engine = ctx.engine;
      const inserts = ctx.inserts;
      const track = selectedTrack(ctx);
      const presetId = cardEl.querySelector('[data-cr-preset]').value;
      const preset = PRESETS[presetId];
      const status = cardEl.querySelector('[data-cr-status]');

      if (!track) {
        ctx.toast?.('Select a track first', 'warn');
        return;
      }
      if (!preset) return;

      await godApply(ctx, `Cover Remap · ${preset.label}`, async () => {
        await engine.init();
        // Track EQ (engine.setTrackEq(id, band, gainDb))
        track.eq = { ...(track.eq || {}), ...preset.eq };
        if (typeof engine.setTrackEq === 'function') {
          for (const band of ['low', 'mid', 'high']) {
            if (preset.eq[band] != null) engine.setTrackEq(track.id, band, preset.eq[band]);
          }
        } else {
          if (track.eqLow) track.eqLow.gain.value = preset.eq.low;
          if (track.eqMid) track.eqMid.gain.value = preset.eq.mid;
          if (track.eqHigh) track.eqHigh.gain.value = preset.eq.high;
        }

        // Insert chain
        if (inserts?.add) {
          clearInserts(inserts, track.id);
          for (const ins of preset.inserts) {
            inserts.add(track.id, ins.type, ins.amount);
          }
        }

        // Remap clips: note freqs + meta playbackRate tag (honest — engine reads rate from meta when present via recreate)
        const clip = lastClipOnTrack(track);
        const targets = clip ? [clip] : track.clips;
        targets.forEach((c) => {
          c.meta = {
            ...(c.meta || {}),
            coverPreset: presetId,
            playbackRate: preset.rate,
            mood: preset.mood,
          };
          if (c.notes?.length) {
            c.notes = c.notes.map((n) => ({
              ...n,
              freq: (n.freq || 440) * preset.noteMul,
            }));
          }
        });

        // Stem DNA mood tag if API exposes lastAnalysis
        try {
          const dna = ctx.stemDna;
          if (dna?.lastAnalysis) {
            dna.lastAnalysis.mood = { ...(dna.lastAnalysis.mood || {}), mood: preset.mood };
            if (Array.isArray(dna.lastAnalysis.tags)) {
              dna.lastAnalysis.tags = [...new Set([...dna.lastAnalysis.tags, preset.mood, presetId])];
            }
          }
          localStorage.setItem('mm-sound-deck-stem-dna-mood', preset.mood);
        } catch (_) {}

        engine._emit?.('tracks', engine.tracks);
        status.textContent = `${preset.label} on ${track.name} · rate×${preset.rate} · DEMO`;
      });
    });
  },
});
