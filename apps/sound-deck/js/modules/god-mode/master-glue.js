/**
 * Master Glue Bus — one-knob compressor + soft saturate on master inserts (DEMO).
 */
import { registerFeature } from './registry.js';
import { godApply } from './apply.js';

const GLUE_TAG = 'god-master-glue';

registerFeature({
  id: 'master-glue',
  title: 'Master Glue Bus',
  blurb: 'One-knob master DynamicsCompressor + soft Drive saturate via inserts. Honest limiter companion optional.',
  badge: 'DEMO',
  mount(cardEl, ctx) {
    cardEl.innerHTML = `
      <label class="field sx-god-field">
        <span>Glue <em data-mg-amt-val>0.55</em></span>
        <input type="range" min="0" max="1" step="0.05" value="0.55" data-mg-amt />
      </label>
      <label class="field sx-god-field">
        <span>Add limiter ceiling</span>
        <input type="checkbox" data-mg-lim checked />
      </label>
      <div class="btn-row">
        <button type="button" class="btn primary sm" data-mg-go>Glue master</button>
        <button type="button" class="btn sm ghost" data-mg-clear>Clear glue</button>
      </div>
      <p class="fineprint" data-mg-status>inserts on channel “master” · DEMO</p>
    `;
    const amtEl = cardEl.querySelector('[data-mg-amt]');
    amtEl.addEventListener('input', () => {
      cardEl.querySelector('[data-mg-amt-val]').textContent = Number(amtEl.value).toFixed(2);
    });
    const status = cardEl.querySelector('[data-mg-status]');

    // Track UIDs we created so Clear is precise
    const state = { uids: [] };

    cardEl.querySelector('[data-mg-clear]').addEventListener('click', async () => {
      const inserts = ctx.inserts;
      if (!inserts) {
        ctx.toast?.('Insert host unavailable', 'warn');
        return;
      }
      await godApply(ctx, 'Clear Master Glue', async () => {
        state.uids.forEach((uid) => {
          try { inserts.remove('master', uid); } catch (_) {}
        });
        // Also strip any leftover tagged via localStorage list
        try {
          const prev = JSON.parse(localStorage.getItem(GLUE_TAG) || '[]');
          prev.forEach((uid) => { try { inserts.remove('master', uid); } catch (_) {} });
          localStorage.removeItem(GLUE_TAG);
        } catch (_) {}
        state.uids = [];
        status.textContent = 'Master glue cleared · DEMO';
      });
    });

    cardEl.querySelector('[data-mg-go]').addEventListener('click', async () => {
      const engine = ctx.engine;
      const inserts = ctx.inserts;
      if (!engine || !inserts?.add) {
        ctx.toast?.('Inserts unavailable — open Plugins or wait for boot', 'warn');
        status.textContent = 'No inserts API · DEMO stub';
        return;
      }
      const amount = Number(amtEl.value) || 0.55;
      const wantLim = !!cardEl.querySelector('[data-mg-lim]')?.checked;

      await godApply(ctx, 'Master Glue', async () => {
        await engine.init();
        // Remove previous glue UIDs
        state.uids.forEach((uid) => {
          try { inserts.remove('master', uid); } catch (_) {}
        });
        state.uids = [];

        const comp = inserts.add('master', 'comp', amount);
        if (comp) {
          comp._godGlue = true;
          state.uids.push(comp.uid);
        }
        const drive = inserts.add('master', 'drive', Math.min(0.7, amount * 0.55));
        if (drive) {
          drive._godGlue = true;
          state.uids.push(drive.uid);
        }
        if (wantLim) {
          const lim = inserts.add('master', 'limiter', Math.min(0.85, 0.35 + amount * 0.5));
          if (lim) {
            lim._godGlue = true;
            state.uids.push(lim.uid);
          }
        }
        try { localStorage.setItem(GLUE_TAG, JSON.stringify(state.uids)); } catch (_) {}
        status.textContent = `Glue ${amount.toFixed(2)} on master · ${state.uids.length} inserts · DEMO`;
        if (!state.uids.length) {
          throw new Error('Could not add master inserts (chain full or ctx not ready)');
        }
      });
    });
  },
});
