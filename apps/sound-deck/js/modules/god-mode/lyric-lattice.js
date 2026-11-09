/**
 * Lyric Lattice — bar-grid lyric pad; syllable cells flash with transport beat (DEMO).
 */
import { registerFeature } from './registry.js';
import { godApply } from './apply.js';

const BARS = 8;
const BEATS_PER_BAR = 4;

function splitSyllables(line) {
  const words = String(line || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  // Rough syllable split: vowel groups; keep whole word if single
  const out = [];
  for (const w of words) {
    const parts = w.split(/(?<=[aeiouyAEIOUY])(?=[^aeiouyAEIOUY]+[aeiouyAEIOUY])/);
    if (parts.length <= 1) out.push(w);
    else parts.forEach((p) => { if (p) out.push(p); });
  }
  return out;
}

function cellsFromText(text) {
  const lines = String(text || '').split(/\n/).slice(0, BARS);
  while (lines.length < BARS) lines.push('');
  return lines.map((line, bar) => {
    const syls = splitSyllables(line);
    const cells = [];
    for (let b = 0; b < BEATS_PER_BAR; b++) {
      cells.push(syls[b] || (b === 0 ? (line.trim().split(/\s+/)[0] || '') : ''));
    }
    // Overflow syllables land on last beat joined
    if (syls.length > BEATS_PER_BAR) {
      cells[BEATS_PER_BAR - 1] = syls.slice(BEATS_PER_BAR - 1).join('·');
    }
    return { bar, cells, line };
  });
}

registerFeature({
  id: 'lyric-lattice',
  title: 'Lyric Lattice',
  blurb: 'Syllable-aware lyric pad synced to an 8-bar grid. Cells flash with the transport beat when playing.',
  badge: 'DEMO',
  mount(cardEl, ctx) {
    cardEl.innerHTML = `
      <label class="field block sx-god-field">
        <span>Lyrics (one line ≈ one bar)</span>
        <textarea data-ll-text rows="4" placeholder="Hook line one&#10;Hook line two&#10;…"></textarea>
      </label>
      <div class="sx-god-lattice" data-ll-grid aria-live="polite"></div>
      <div class="btn-row">
        <button type="button" class="btn sm ghost" data-ll-preview>Preview grid</button>
        <button type="button" class="btn primary sm" data-ll-go>Apply lattice</button>
      </div>
      <p class="fineprint" data-ll-status>8 bars × 4 beats · flash on tick · DEMO</p>
    `;
    const grid = cardEl.querySelector('[data-ll-grid]');
    const status = cardEl.querySelector('[data-ll-status]');
    const textEl = cardEl.querySelector('[data-ll-text]');
    let unsub = null;
    let lastBeat = -1;

    function renderGrid(rows, flashBeat = -1) {
      grid.innerHTML = rows.map((row) => `
        <div class="sx-god-lattice-row" data-bar="${row.bar}">
          <span class="sx-god-lattice-bar">B${row.bar + 1}</span>
          ${row.cells.map((c, i) => {
            const abs = row.bar * BEATS_PER_BAR + i;
            const on = flashBeat >= 0 && Math.floor(flashBeat) === abs;
            return `<span class="sx-god-lattice-cell${on ? ' is-flash' : ''}" data-beat="${abs}">${c || '·'}</span>`;
          }).join('')}
        </div>
      `).join('');
    }

    function preview() {
      renderGrid(cellsFromText(textEl.value), -1);
      status.textContent = 'Grid preview · play transport to flash · DEMO';
    }

    cardEl.querySelector('[data-ll-preview]').addEventListener('click', preview);

    cardEl.querySelector('[data-ll-go]').addEventListener('click', async () => {
      const engine = ctx.engine;
      if (!engine) {
        ctx.toast?.('Engine unavailable', 'error');
        return;
      }
      const text = textEl.value.trim();
      if (!text) {
        ctx.toast?.('Write at least one lyric line', 'warn');
        return;
      }
      const rows = cellsFromText(text);

      await godApply(ctx, 'Lyric Lattice', async () => {
        await engine.init();
        engine.meta = engine.meta || {};
        engine.meta.lyricLattice = {
          bars: BARS,
          text,
          rows: rows.map((r) => ({ bar: r.bar, cells: r.cells, line: r.line })),
          at: Date.now(),
          demo: true,
        };
        try {
          localStorage.setItem('mm-sound-deck-lyric-lattice', JSON.stringify(engine.meta.lyricLattice));
        } catch (_) {}
        renderGrid(rows, -1);
        status.textContent = `${BARS} bars stored on session · flash with Play · DEMO`;

        // Bind tick flash (rebind each apply)
        if (typeof unsub === 'function') {
          try { unsub(); } catch (_) {}
        }
        const onTick = (ev) => {
          const beat = Math.floor(ev?.beat ?? engine.currentBeat ?? 0);
          if (beat === lastBeat) return;
          lastBeat = beat;
          const mod = beat % (BARS * BEATS_PER_BAR);
          grid.querySelectorAll('.sx-god-lattice-cell').forEach((el) => {
            el.classList.toggle('is-flash', Number(el.dataset.beat) === mod);
          });
        };
        engine.on?.('tick', onTick);
        unsub = () => engine.off?.('tick', onTick);
      });
    });

    // Restore prior lyrics if any
    try {
      const prev = JSON.parse(localStorage.getItem('mm-sound-deck-lyric-lattice') || 'null');
      if (prev?.text) {
        textEl.value = prev.text;
        preview();
      }
    } catch (_) {}
  },
});
