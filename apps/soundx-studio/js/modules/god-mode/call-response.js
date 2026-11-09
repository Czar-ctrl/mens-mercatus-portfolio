/**
 * Call & Response — phrase length + answering percussion fill (DEMO).
 */
import { registerFeature } from './registry.js';
import { godApply } from './apply.js';
import { COLORS, drumPattern, mulberry32, seedFrom } from '../../audio/generator.js';
import { ensureNamedTrack, selectedTrack, lastClipOnTrack } from './util.js';

registerFeature({
  id: 'call-response',
  title: 'Call & Response',
  blurb: 'Capture the last phrase length on the selected track, then generate an answering percussion fill.',
  badge: 'DEMO',
  mount(cardEl, ctx) {
    cardEl.innerHTML = `
      <label class="field sx-god-field">
        <span>Phrase bars <em data-cr-bars-val>2</em></span>
        <input type="range" min="1" max="4" step="1" value="2" data-cr-bars />
      </label>
      <label class="field sx-god-field">
        <span>Fill style</span>
        <select data-cr-style>
          <option value="trap">Trap answer</option>
          <option value="four">Four-on-floor echo</option>
          <option value="straight">Straight reply</option>
          <option value="sparse">Sparse ghost</option>
        </select>
      </label>
      <div class="btn-row">
        <button type="button" class="btn primary sm" data-cr-go>Generate response</button>
      </div>
      <p class="fineprint" data-cr-status>Answers after the call clip · DEMO</p>
    `;
    const barsEl = cardEl.querySelector('[data-cr-bars]');
    const valEl = cardEl.querySelector('[data-cr-bars-val]');
    barsEl.addEventListener('input', () => { valEl.textContent = barsEl.value; });
    const status = cardEl.querySelector('[data-cr-status]');

    cardEl.querySelector('[data-cr-go]').addEventListener('click', async () => {
      const engine = ctx.engine;
      if (!engine) return;
      const track = selectedTrack(ctx);
      const call = track ? lastClipOnTrack(track) : null;
      const phraseBars = Number(barsEl.value) || 2;
      const style = cardEl.querySelector('[data-cr-style]').value || 'trap';
      const callEnd = call
        ? (call.startBeat || 0) + (call.durationBeats || phraseBars * 4)
        : (engine.currentBeat || 0);
      const startBeat = callEnd;
      const bars = phraseBars;
      const rng = mulberry32(seedFrom(`cr|${style}|${startBeat}|${engine.bpm}`));

      await godApply(ctx, 'Call & Response', async () => {
        await engine.init();
        const perc = ensureNamedTrack(
          engine,
          (t) => /drum|perc|beat|response/i.test(t.name),
          'Response Perc',
          'audio',
        );
        // Clear previous response fills on this track
        perc.clips = perc.clips.filter((c) => c.meta?.kind !== 'god-call-response');

        const pat = drumPattern(style, bars, rng);
        const kick = engine.createBufferFromRecipe({ type: 'kick', duration: 0.36 });
        const snare = engine.createBufferFromRecipe({ type: 'snare', duration: 0.22 });
        const hat = engine.createBufferFromRecipe({ type: 'hat', duration: 0.09 });

        // Answer denser on back half of phrase
        const place = (hits, name, buf, color, dur, dens = 1) => {
          hits.forEach((beat) => {
            if (rng() > dens) return;
            // Bias fills toward second half
            const local = beat;
            if (local < bars * 2 && rng() > 0.55) return;
            engine.addClip(perc.id, {
              name,
              startBeat: startBeat + beat,
              durationBeats: dur,
              color,
              buffer: buf,
              meta: { kind: 'god-call-response', role: name.toLowerCase(), style, callClipId: call?.id || null },
            });
          });
        };
        place(pat.kick, 'Ans Kick', kick, COLORS.kick, 0.35, 0.85);
        place(pat.snare, 'Ans Snare', snare, COLORS.snare, 0.28, 0.9);
        place(pat.hat, 'Ans Hat', hat, COLORS.hat, 0.15, 0.75);

        engine._emit?.('tracks', engine.tracks);
        const from = call ? `after “${call.name}”` : 'from playhead';
        status.textContent = `${bars} bar ${style} answer ${from} @ beat ${startBeat.toFixed(1)} · DEMO`;
      });
    });
  },
});
