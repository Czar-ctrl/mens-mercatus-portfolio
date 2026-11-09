/**
 * Cinema Mix Modes — headphone / club / car / phone preview curves on master (DEMO).
 */
import { registerFeature } from './registry.js';
import { godApply } from './apply.js';
import { chipRow, bindChips } from './util.js';

const MODES = {
  headphone: {
    label: 'Headphone',
    eq: { low: 1, mid: 0, high: 3 },
    space: 0.25,
    drive: 0.05,
    masterVol: null,
  },
  club: {
    label: 'Club',
    eq: { low: 5, mid: -1, high: 2 },
    space: 0.55,
    drive: 0.2,
    masterVol: null,
  },
  car: {
    label: 'Car',
    eq: { low: 4, mid: 2, high: -1 },
    space: 0.15,
    drive: 0.12,
    masterVol: null,
  },
  phone: {
    label: 'Phone',
    eq: { low: -2, mid: 3, high: 4 },
    space: 0.1,
    drive: 0.08,
    masterVol: null,
  },
};

const CINEMA_TAG = 'god-cinema-mix';

registerFeature({
  id: 'cinema-mix',
  title: 'Cinema Mix Modes',
  blurb: 'Preview headphone / club / car / phone via master EQ + space IR insert. Generated IR — not a measured room.',
  badge: 'DEMO',
  mount(cardEl, ctx) {
    const chips = Object.entries(MODES).map(([id, m]) => ({ id, label: m.label }));
    cardEl.innerHTML = `
      ${chipRow(chips, { name: 'cm-mode' })}
      <label class="field sx-god-field">
        <span>Wet space <em data-cm-wet-val>auto</em></span>
        <input type="range" min="0" max="1" step="0.05" value="0.5" data-cm-wet />
      </label>
      <div class="btn-row">
        <button type="button" class="btn primary sm" data-cm-go>Apply cinema mix</button>
        <button type="button" class="btn sm ghost" data-cm-reset>Reset EQ</button>
      </div>
      <p class="fineprint" data-cm-status>Master EQ + space/drive inserts · DEMO IR</p>
    `;
    const getMode = bindChips(cardEl, '[data-chip-group="cm-mode"]');
    const wetEl = cardEl.querySelector('[data-cm-wet]');
    const wetVal = cardEl.querySelector('[data-cm-wet-val]');
    const status = cardEl.querySelector('[data-cm-status]');
    const state = { uids: [] };

    function syncWetLabel() {
      const id = getMode() || 'headphone';
      const base = MODES[id]?.space ?? 0.25;
      // slider is a multiplier around preset
      const mul = Number(wetEl.value) || 0.5;
      wetVal.textContent = (base * (0.4 + mul * 1.2)).toFixed(2);
    }
    wetEl.addEventListener('input', syncWetLabel);
    cardEl.querySelector('[data-chip-group="cm-mode"]').addEventListener('click', () => {
      const id = getMode();
      const m = MODES[id];
      if (m) wetEl.value = '0.5';
      syncWetLabel();
    });
    syncWetLabel();

    function clearCinemaInserts(inserts) {
      state.uids.forEach((uid) => {
        try { inserts.remove('master', uid); } catch (_) {}
      });
      try {
        const prev = JSON.parse(localStorage.getItem(CINEMA_TAG) || '[]');
        prev.forEach((uid) => { try { inserts.remove('master', uid); } catch (_) {} });
      } catch (_) {}
      state.uids = [];
    }

    cardEl.querySelector('[data-cm-reset]').addEventListener('click', async () => {
      const engine = ctx.engine;
      const inserts = ctx.inserts;
      if (!engine) return;
      await godApply(ctx, 'Cinema Mix Reset', async () => {
        await engine.init();
        engine.masterEq = { low: 0, mid: 0, high: 0 };
        if (typeof engine.setMasterEq === 'function') {
          for (const band of ['low', 'mid', 'high']) engine.setMasterEq(band, 0);
        } else {
          if (engine.masterEqLow) engine.masterEqLow.gain.value = 0;
          if (engine.masterEqMid) engine.masterEqMid.gain.value = 0;
          if (engine.masterEqHigh) engine.masterEqHigh.gain.value = 0;
        }
        if (inserts) clearCinemaInserts(inserts);
        try { localStorage.removeItem(CINEMA_TAG); } catch (_) {}
        status.textContent = 'Master EQ flat · cinema inserts cleared · DEMO';
      });
    });

    cardEl.querySelector('[data-cm-go]').addEventListener('click', async () => {
      const engine = ctx.engine;
      const inserts = ctx.inserts;
      if (!engine) return;
      const modeId = getMode() || 'headphone';
      const mode = MODES[modeId];
      const mul = Number(wetEl.value) || 0.5;
      const spaceAmt = Math.min(0.9, mode.space * (0.4 + mul * 1.2));

      await godApply(ctx, `Cinema · ${mode.label}`, async () => {
        await engine.init();
        engine.masterEq = { ...mode.eq };
        if (typeof engine.setMasterEq === 'function') {
          for (const band of ['low', 'mid', 'high']) {
            engine.setMasterEq(band, mode.eq[band]);
          }
        } else {
          if (engine.masterEqLow) engine.masterEqLow.gain.value = mode.eq.low;
          if (engine.masterEqMid) engine.masterEqMid.gain.value = mode.eq.mid;
          if (engine.masterEqHigh) engine.masterEqHigh.gain.value = mode.eq.high;
        }

        if (inserts?.add) {
          clearCinemaInserts(inserts);
          const space = inserts.add('master', 'space', spaceAmt);
          if (space) {
            space._godCinema = true;
            state.uids.push(space.uid);
          }
          if (mode.drive > 0.01) {
            const drive = inserts.add('master', 'drive', mode.drive);
            if (drive) {
              drive._godCinema = true;
              state.uids.push(drive.uid);
            }
          }
          try { localStorage.setItem(CINEMA_TAG, JSON.stringify(state.uids)); } catch (_) {}
        }

        engine.meta = engine.meta || {};
        engine.meta.cinemaMix = { mode: modeId, eq: mode.eq, space: spaceAmt, demo: true };
        status.textContent = `${mode.label} · EQ L${mode.eq.low}/M${mode.eq.mid}/H${mode.eq.high} · space ${spaceAmt.toFixed(2)} · DEMO IR`;
      });
    });
  },
});
