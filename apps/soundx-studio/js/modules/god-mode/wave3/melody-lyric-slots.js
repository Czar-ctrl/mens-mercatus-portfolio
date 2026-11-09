/**
 * W3 #8 Melody → Lyric Slots — reads a melody clip, groups notes into phrases and shows one empty
 * syllable slot per note (strong-beat slots marked). Type a line per phrase; syllables flow into the
 * slots with a live count. Save stores syllables on the notes (clip meta) — Restore-safe.
 */
import { registerFeature } from '../registry.js';
import { godApply } from '../apply.js';
import { downloadBlob } from '../util.js';
import { lineSyllables, phrasesFromNotes } from './lyric-core.js?v=20261008md-sxs20261020b';
import { onEngine, setStatus, esc } from '../w23-ui.js';

const PLACEHOLDER = ['la', 'da', 'na', 'oh', 'yeah', 'hey'];

function noteClips(engine) {
  const out = [];
  engine.tracks.forEach((t) => t.clips.forEach((c) => { if (c.notes?.length) out.push({ t, c }); }));
  // Lyric sketches first, then vocal / lead-ish tracks, then everything else.
  const rank = ({ t, c }) => (c.meta?.tag === 'lyric-melody-sketch' || c.meta?.lyricSlots ? 0 : /vox|vocal|lead|melod|hook|lyric/i.test(t.name) ? 1 : /bass|chord|pad|harmony/i.test(t.name) ? 3 : 2);
  return out.sort((a, b) => rank(a) - rank(b));
}

registerFeature({
  id: 'melody-lyric-slots',
  title: 'Melody → Lyric Slots',
  blurb: 'Pick a melody clip → empty syllable slots per note, grouped into phrases. Type lines and see if they fit; save the syllables onto the notes.',
  badge: 'DEMO',
  wave: 3,
  mount(card, ctx) {
    card.innerHTML = `
      <div class="sx-god-row"><label class="field"><span>Melody clip</span><select data-ml-clip></select></label></div>
      <div data-ml-phrases></div>
      <div class="btn-row"><button type="button" class="btn sm" data-ml-fill>Placeholder syllables</button><button type="button" class="btn primary sm" data-ml-save>Save to clip</button><button type="button" class="btn sm ghost" data-ml-dl>Lyric sheet .txt</button></div>
      <p class="fineprint" data-ml-status>• = strong-beat slot (put stressed syllables there) · local only · DEMO</p>
    `;
    const engine = ctx.engine;
    const sel = card.querySelector('[data-ml-clip]');
    const box = card.querySelector('[data-ml-phrases]');
    const status = card.querySelector('[data-ml-status]');
    let pick = null; let phrases = []; let lines = []; let userPicked = false;
    const fillSel = () => {
      const keep = sel.value;
      const list = noteClips(engine);
      sel.innerHTML = list.length ? list.map(({ t, c }) => `<option value="${esc(c.id)}">${esc(t.name)} · ${esc(c.name || 'clip')} (${c.notes.length} notes)</option>`).join('') : '<option value="">No note clips yet</option>';
      if (userPicked && keep && list.some(({ c }) => c.id === keep)) sel.value = keep;
      if (sel.value !== keep) lines = [];
    };
    const slotsHtml = (p, li) => {
      const syls = lineSyllables(lines[li] || '');
      return p.notes.map((n, i) => `<input type="text" readonly value="${esc(syls[i]?.syl || '')}" title="beat ${(+n.beat).toFixed(2)}${p.strong[i] ? ' · strong' : ''}" class="${p.strong[i] ? 'is-strong' : ''}" placeholder="${p.strong[i] ? '•' : ''}" />`).join('');
    };
    const render = () => {
      const found = noteClips(engine).find(({ c }) => c.id === sel.value);
      pick = found || null;
      if (!pick) { box.innerHTML = ''; return; }
      phrases = phrasesFromNotes(pick.c.notes);
      if (lines.length !== phrases.length) {
        lines = phrases.map((p) => p.notes.map((n) => n.syl || '').filter(Boolean).join(' ').trim());
      }
      box.innerHTML = phrases.map((p, i) => {
        const n = lineSyllables(lines[i] || '').length;
        return `<div class="sx-god-phrase"><label class="field block"><span>Phrase ${i + 1} · beat ${(p.startBeat + 1).toFixed(1)} · <em data-ml-count="${i}" class="${n === p.slots ? 'ok' : n > p.slots ? 'over' : ''}">${n}/${p.slots}</em> syllables</span><input type="text" data-ml-line="${i}" value="${esc(lines[i] || '')}" placeholder="${p.slots} syllables" /></label><div class="sx-god-slots" data-ml-slots="${i}">${slotsHtml(p, i)}</div></div>`;
      }).join('');
    };
    box.addEventListener('input', (e) => {
      const inp = e.target.closest('[data-ml-line]');
      if (!inp) return;
      const i = Number(inp.dataset.mlLine);
      lines[i] = inp.value;
      const n = lineSyllables(inp.value).length;
      const cnt = box.querySelector(`[data-ml-count="${i}"]`);
      cnt.textContent = `${n}/${phrases[i].slots}`;
      cnt.className = n === phrases[i].slots ? 'ok' : n > phrases[i].slots ? 'over' : '';
      box.querySelector(`[data-ml-slots="${i}"]`).innerHTML = slotsHtml(phrases[i], i);
    });
    sel.addEventListener('change', () => { userPicked = true; lines = []; render(); });
    onEngine(engine, 'tracks', () => { if (!card.contains(document.activeElement)) { fillSel(); render(); } }, card);
    fillSel(); render();
    card.querySelector('[data-ml-fill]').addEventListener('click', () => {
      lines = phrases.map((p) => p.notes.map((_, i) => PLACEHOLDER[i % PLACEHOLDER.length]).join(' '));
      render();
    });
    card.querySelector('[data-ml-save]').addEventListener('click', async () => {
      if (!pick) { setStatus(status, 'Pick a melody clip'); return; }
      let filled = 0;
      try {
        await godApply(ctx, 'Melody → Lyric Slots', async () => {
          const c = pick.c;
          c.notes = c.notes.map((n) => ({ ...n }));
          phrases.forEach((p, i) => {
            const syls = lineSyllables(lines[i] || '');
            p.notes.forEach((pn, k) => { const s = syls[k]?.syl || ''; c.notes[pn.idx].syl = s; if (s) filled += 1; });
          });
          c.meta = { ...(c.meta || {}), lyricSlots: phrases.map((p, i) => ({ startBeat: p.startBeat, slots: p.slots, line: lines[i] || '' })) };
          engine._emit?.('tracks', engine.tracks);
        });
        setStatus(status, `✓ ${filled} syllables saved on “${pick.c.name}” · undo via Restore`);
      } catch (err) { setStatus(status, `✗ ${err.message}`); }
    });
    card.querySelector('[data-ml-dl]').addEventListener('click', () => {
      if (!pick) return;
      const spb = engine.secondsPerBeat;
      const txt = phrases.map((p, i) => `[${((pick.c.startBeat + p.startBeat) * spb).toFixed(2)}s · bar ${Math.floor((pick.c.startBeat + p.startBeat) / 4) + 1}] ${lines[i] || '(empty)'}  (${lineSyllables(lines[i] || '').length}/${p.slots})`).join('\n');
      downloadBlob(new Blob([`${pick.t.name} — ${pick.c.name}\n${engine.bpm} BPM\n\n${txt}\n`], { type: 'text/plain' }), 'soundx-lyric-slots.txt');
      setStatus(status, 'Lyric sheet downloaded');
    });
  },
});
