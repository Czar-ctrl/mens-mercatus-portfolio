/**
 * Persona Voice — named vocal character via insert chain + pitch/wet (DEMO).
 */
import { registerFeature } from './registry.js';
import { godApply } from './apply.js';
import { chipRow, bindChips, selectedTrack, ensureNamedTrack } from './util.js';

const PERSONAS = {
  'cartel-lead': {
    label: 'Blueprint Lead',
    inserts: [
      { type: 'eqlow', amount: 0.4 },
      { type: 'comp', amount: 0.5 },
      { type: 'delay', amount: 0.35 },
      { type: 'chorus', amount: 0.3 },
    ],
    pitch: 1.02,
    wet: 0.45,
  },
  'soft-glow': {
    label: 'Soft Glow',
    inserts: [
      { type: 'filter', amount: 0.35 },
      { type: 'chorus', amount: 0.55 },
      { type: 'space', amount: 0.5 },
    ],
    pitch: 1.0,
    wet: 0.6,
  },
  'street-gospel': {
    label: 'Street Gospel',
    inserts: [
      { type: 'comp', amount: 0.6 },
      { type: 'eqlow', amount: 0.25 },
      { type: 'space', amount: 0.65 },
      { type: 'delay', amount: 0.25 },
    ],
    pitch: 0.98,
    wet: 0.55,
  },
  'chrome-flex': {
    label: 'Chrome Flex',
    inserts: [
      { type: 'drive', amount: 0.4 },
      { type: 'crush', amount: 0.15 },
      { type: 'delay', amount: 0.45 },
      { type: 'chorus', amount: 0.4 },
    ],
    pitch: 1.05,
    wet: 0.5,
  },
};

function clearInserts(inserts, channelId) {
  if (!inserts?.list) return;
  [...(inserts.list(channelId) || [])].forEach((it) => inserts.remove(channelId, it.uid));
}

registerFeature({
  id: 'persona-voice',
  title: 'Persona Voice',
  blurb: 'Arm a named vocal character (EQ + delay + chorus stack) on Vocals or the selected track.',
  badge: 'DEMO',
  mount(cardEl, ctx) {
    const chips = Object.entries(PERSONAS).map(([id, p]) => ({ id, label: p.label }));
    cardEl.innerHTML = `
      ${chipRow(chips, { name: 'pv-persona' })}
      <label class="field sx-god-field">
        <span>Pitch-ish <em data-pv-pitch-val>1.00</em></span>
        <input type="range" min="0.85" max="1.15" step="0.01" value="1.00" data-pv-pitch />
      </label>
      <label class="field sx-god-field">
        <span>Wet <em data-pv-wet-val>0.50</em></span>
        <input type="range" min="0" max="1" step="0.05" value="0.50" data-pv-wet />
      </label>
      <div class="btn-row">
        <button type="button" class="btn primary sm" data-pv-go>Arm persona</button>
      </div>
      <p class="fineprint" data-pv-status>Targets Vocals track or selection · DEMO</p>
    `;
    const getPersona = bindChips(cardEl, '[data-chip-group="pv-persona"]');
    const pitchEl = cardEl.querySelector('[data-pv-pitch]');
    const wetEl = cardEl.querySelector('[data-pv-wet]');
    pitchEl.addEventListener('input', () => {
      cardEl.querySelector('[data-pv-pitch-val]').textContent = Number(pitchEl.value).toFixed(2);
    });
    wetEl.addEventListener('input', () => {
      cardEl.querySelector('[data-pv-wet-val]').textContent = Number(wetEl.value).toFixed(2);
    });

    // Seed sliders from first persona
    const seed = PERSONAS['cartel-lead'];
    pitchEl.value = String(seed.pitch);
    wetEl.value = String(seed.wet);
    cardEl.querySelector('[data-pv-pitch-val]').textContent = seed.pitch.toFixed(2);
    cardEl.querySelector('[data-pv-wet-val]').textContent = seed.wet.toFixed(2);

    cardEl.querySelector('[data-chip-group="pv-persona"]').addEventListener('click', () => {
      const id = getPersona();
      const p = PERSONAS[id];
      if (!p) return;
      pitchEl.value = String(p.pitch);
      wetEl.value = String(p.wet);
      cardEl.querySelector('[data-pv-pitch-val]').textContent = p.pitch.toFixed(2);
      cardEl.querySelector('[data-pv-wet-val]').textContent = p.wet.toFixed(2);
    });

    cardEl.querySelector('[data-pv-go]').addEventListener('click', async () => {
      const engine = ctx.engine;
      const inserts = ctx.inserts;
      const personaId = getPersona() || 'cartel-lead';
      const persona = PERSONAS[personaId];
      const pitch = Number(pitchEl.value) || persona.pitch;
      const wet = Number(wetEl.value) || persona.wet;
      const status = cardEl.querySelector('[data-pv-status]');

      if (!persona) return;

      await godApply(ctx, `Persona · ${persona.label}`, async () => {
        await engine.init();
        let track = engine.tracks.find((t) => /vocal|vox|voice/i.test(t.name));
        if (!track) track = selectedTrack(ctx);
        if (!track) track = ensureNamedTrack(engine, () => false, 'Vocals', 'audio');

        track.meta = { ...(track.meta || {}), personaId, pitch, wet };
        // Store on a plain field tracks already allow arbitrary props
        track.personaId = personaId;

        if (inserts?.add) {
          clearInserts(inserts, track.id);
          for (const ins of persona.inserts) {
            const amount = Math.min(1, ins.amount * (0.5 + wet));
            inserts.add(track.id, ins.type, amount);
          }
        }

        // Pitch-ish: nudge note clips on the track
        track.clips.forEach((c) => {
          c.meta = { ...(c.meta || {}), personaId, playbackRate: pitch };
          if (c.notes?.length) {
            c.notes = c.notes.map((n) => ({ ...n, freq: (n.freq || 440) * pitch }));
          }
        });

        engine._emit?.('tracks', engine.tracks);
        status.textContent = `${persona.label} armed on ${track.name} · pitch×${pitch.toFixed(2)} · wet ${wet.toFixed(2)}`;
      });
    });
  },
});
