/**
 * Continue Clip — extend last clip on selected track by N bars (DEMO).
 */
import { registerFeature } from './registry.js';
import { godApply } from './apply.js';
import { selectedTrack, lastClipOnTrack, cloneNotes } from './util.js';

registerFeature({
  id: 'continue-clip',
  title: 'Continue Clip',
  blurb: 'Duplicate & lightly mutate the last clip on the selected track, offset by N bars.',
  badge: 'DEMO',
  mount(cardEl, ctx) {
    cardEl.innerHTML = `
      <label class="field sx-god-field">
        <span>Bars <em data-cc-bars-val>4</em></span>
        <input type="range" min="2" max="16" step="1" value="4" data-cc-bars />
      </label>
      <div class="btn-row">
        <button type="button" class="btn primary sm" data-cc-go>Continue</button>
      </div>
      <p class="fineprint" data-cc-status>Select a track with clips · DEMO</p>
    `;
    const slider = cardEl.querySelector('[data-cc-bars]');
    const valEl = cardEl.querySelector('[data-cc-bars-val]');
    slider.addEventListener('input', () => { valEl.textContent = slider.value; });

    cardEl.querySelector('[data-cc-go]').addEventListener('click', async () => {
      const engine = ctx.engine;
      const track = selectedTrack(ctx);
      const bars = Number(slider.value) || 4;
      const status = cardEl.querySelector('[data-cc-status]');

      if (!track) {
        ctx.toast?.('Select a track first', 'warn');
        status.textContent = 'No track selected';
        return;
      }
      const src = lastClipOnTrack(track);
      if (!src) {
        ctx.toast?.('Select a clip first — track has no clips', 'warn');
        status.textContent = 'No clip on selected track';
        return;
      }

      await godApply(ctx, 'Continue Clip', async () => {
        await engine.init();
        const startBeat = (src.startBeat || 0) + (src.durationBeats || bars * 4);
        const durationBeats = bars * 4;
        const notes = cloneNotes(src.notes, (n, i) => {
          // light mutate: nudge pitch ± semitone-ish, velocity wobble
          if (n.freq) n.freq *= i % 3 === 0 ? 1.059 : i % 5 === 0 ? 0.944 : 1;
          n.vel = Math.max(0.35, Math.min(1, (n.vel ?? 0.85) * (0.9 + (i % 4) * 0.03)));
          n.beat = (n.beat || 0) % durationBeats;
        });
        const clip = {
          name: `${src.name || 'Clip'} Cont.`,
          startBeat,
          durationBeats,
          color: src.color || '#F5C518',
          buffer: src.buffer || null,
          recipe: src.recipe ? { ...src.recipe } : null,
          notes,
          meta: {
            ...(src.meta || {}),
            kind: 'god-continue',
            fromClipId: src.id,
            bars,
          },
        };
        // If only buffer (no notes), still place — same buffer continues the vibe
        if (!clip.notes && !clip.buffer && !clip.recipe) {
          throw new Error('Clip has no playable content to continue');
        }
        engine.addClip(track.id, clip);
        status.textContent = `+${bars} bars from beat ${startBeat.toFixed(1)} on ${track.name}`;
      });
    });
  },
});
