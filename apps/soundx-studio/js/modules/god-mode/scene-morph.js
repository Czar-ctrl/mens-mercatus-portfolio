/**
 * Scene Morph — crossfade / step Live Loops scenes over N bars (DEMO).
 */
import { registerFeature } from './registry.js';
import { godApply } from './apply.js';

const COLS = 4; // Live Loops default column count

registerFeature({
  id: 'scene-morph',
  title: 'Scene Morph',
  blurb: 'Morph Live Loops scenes with a stepped crossfade over N bars. Honest toast if Loops API is offline.',
  badge: 'DEMO',
  mount(cardEl, ctx) {
    cardEl.innerHTML = `
      <label class="field sx-god-field">
        <span>From scene</span>
        <select data-sm-from>
          ${[0, 1, 2, 3].map((i) => `<option value="${i}">Scene ${i + 1}</option>`).join('')}
        </select>
      </label>
      <label class="field sx-god-field">
        <span>To scene</span>
        <select data-sm-to>
          ${[0, 1, 2, 3].map((i) => `<option value="${i}" ${i === 1 ? 'selected' : ''}>Scene ${i + 1}</option>`).join('')}
        </select>
      </label>
      <label class="field sx-god-field">
        <span>Morph bars <em data-sm-bars-val>4</em></span>
        <input type="range" min="1" max="8" step="1" value="4" data-sm-bars />
      </label>
      <div class="btn-row">
        <button type="button" class="btn primary sm" data-sm-go>Morph scenes</button>
        <button type="button" class="btn sm ghost" data-sm-stop>Stop morph</button>
      </div>
      <p class="fineprint" data-sm-status>Uses liveLoops.launchScene · DEMO</p>
    `;
    const barsEl = cardEl.querySelector('[data-sm-bars]');
    const valEl = cardEl.querySelector('[data-sm-bars-val]');
    barsEl.addEventListener('input', () => { valEl.textContent = barsEl.value; });
    const status = cardEl.querySelector('[data-sm-status]');
    let morphTimer = null;

    function clearMorph() {
      if (morphTimer) {
        clearTimeout(morphTimer);
        morphTimer = null;
      }
    }

    cardEl.querySelector('[data-sm-stop]').addEventListener('click', () => {
      clearMorph();
      status.textContent = 'Morph cancelled · DEMO';
      ctx.toast?.('Scene morph stopped', 'ok');
    });

    cardEl.querySelector('[data-sm-go]').addEventListener('click', async () => {
      const ll = ctx.liveLoops;
      const engine = ctx.engine;
      if (!ll?.launchScene) {
        ctx.toast?.('Live Loops API not available — open Loops tab first', 'warn');
        status.textContent = 'No liveLoops.launchScene · honest DEMO stub';
        return;
      }
      const from = Math.max(0, Math.min(COLS - 1, Number(cardEl.querySelector('[data-sm-from]').value) || 0));
      const to = Math.max(0, Math.min(COLS - 1, Number(cardEl.querySelector('[data-sm-to]').value) || 1));
      const bars = Number(barsEl.value) || 4;
      if (from === to) {
        ctx.toast?.('Pick two different scenes', 'warn');
        return;
      }

      await godApply(ctx, `Scene Morph ${from + 1}→${to + 1}`, async () => {
        await engine?.init?.();
        clearMorph();
        // Launch "from", then after N bars launch "to"
        ll.launchScene(from);
        // Soft volume dip mid-morph if we can touch tracks
        const midMs = Math.max(200, (bars * 2) * (60 / (engine?.bpm || 120)) * 1000);
        const endMs = Math.max(400, bars * 4 * (60 / (engine?.bpm || 120)) * 1000);

        if (engine?.tracks) {
          engine.tracks.forEach((t) => {
            t.meta = { ...(t.meta || {}), sceneMorphFrom: from, sceneMorphTo: to };
          });
        }

        morphTimer = setTimeout(() => {
          // Midpoint: slight master dip feel via track volumes (restored on land)
          if (engine?.setTrackVolume) {
            engine.tracks.forEach((t) => {
              const v = t.volume ?? 0.85;
              t.meta = { ...(t.meta || {}), preMorphVol: v };
              engine.setTrackVolume(t.id, Math.max(0.2, v * 0.7));
            });
          }
          morphTimer = setTimeout(() => {
            ll.launchScene(to);
            if (engine?.setTrackVolume) {
              engine.tracks.forEach((t) => {
                const v = t.meta?.preMorphVol ?? t.volume ?? 0.85;
                engine.setTrackVolume(t.id, v);
              });
              engine._emit?.('tracks', engine.tracks);
            }
            status.textContent = `Landed scene ${to + 1} after ${bars} bars · DEMO`;
            morphTimer = null;
          }, Math.max(100, endMs - midMs));
        }, midMs);

        status.textContent = `Morphing scene ${from + 1} → ${to + 1} over ~${bars} bars · DEMO`;
      });
    });
  },
});
