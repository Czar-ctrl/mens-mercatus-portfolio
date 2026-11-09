/**
 * Song-view Pattern picker — choose a pattern and lay it on the arrangement.
 * Sources: the live Pattern-rack state, pattern clips already in the project,
 * and built-in DEMO starters derived from the Instruments kits.
 * Place = bounce via renderPatternBuffer → engine.addClip (meta.kind = 'pattern'),
 * so double-click in Song still opens the clip in the Pattern editor.
 */
import { KITS } from '../modules/instruments.js?v=20261006p-sxs20261020b';
import { renderPatternBuffer, rowFrom } from '../modules/pattern-rack.js?v=20261006w-sxs20261020b';

const PX_PER_BEAT = 40; // keep in sync with timeline.js
const MIME = 'application/x-mm-pattern';

const STARTERS = [
  { kit: 'mm-house', label: 'House 16' },
  { kit: 'mm-trap', label: 'Trap 16' },
  { kit: 'mm-boombap', label: 'Boom-Bap' },
  { kit: 'mm-hats', label: 'Hat Layer' },
].map((s) => {
  const kit = KITS.find((k) => k.id === s.kit);
  return kit ? { ...s, rows: kit.rows.map((r) => rowFrom(r.inst, r.steps, r)), desc: kit.desc } : null;
}).filter(Boolean);

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sig = (rows) => JSON.stringify((rows || []).map((r) => [r.inst, r.midi, r.muted ? 1 : 0, r.steps.join('')]));
const hits = (rows) => (rows || []).reduce((n, r) => n + (r.muted ? 0 : r.steps.filter(Boolean).length), 0);

export function mountSongPatterns(timelineRoot, engine, toast, { patternApi, timelineApi, history } = {}) {
  const header = timelineRoot.querySelector('.timeline-header');
  const ruler = header?.querySelector('[data-ruler]');
  if (!header) return null;

  const bar = document.createElement('div');
  bar.className = 'song-pattern-bar';
  bar.setAttribute('aria-label', 'Pattern picker — place a pattern on the Song timeline');
  bar.innerHTML = `
    <span class="spb-label" title="Pick a pattern, then Place Pattern (or drag a chip onto a lane)">Pattern picker</span>
    <div class="spb-chips" data-spb-chips role="listbox" aria-label="Available patterns"></div>
    <div class="spb-actions">
      <label class="field" title="Length of the placed clip"><span>Len</span>
        <select data-spb-bars><option value="1">1 bar</option><option value="2">2 bars</option><option value="4" selected>4 bars</option><option value="8">8 bars</option></select>
      </label>
      <label class="field" title="Leave blank to place at the playhead bar"><span>Bar</span>
        <input type="number" min="1" max="64" placeholder="▸1" data-spb-at />
      </label>
      <button type="button" class="btn sm ghost" data-spb-preview title="Hear one bar of the selected pattern">▶ Preview</button>
      <button type="button" class="btn sm primary" data-spb-place title="Place the selected pattern on the selected track at the playhead (or Bar)">Place Pattern</button>
    </div>`;
  header.insertBefore(bar, ruler || null);

  const chipsEl = bar.querySelector('[data-spb-chips]');
  const atEl = bar.querySelector('[data-spb-at]');
  const barsEl = bar.querySelector('[data-spb-bars]');
  let selected = 'rack';
  let items = [];
  let placedCount = 0;

  function playheadBeat() {
    return engine.isPlaying ? engine.currentBeat : ((engine.pauseOffset || 0) / engine.secondsPerBeat || 0);
  }
  function playheadBar() { return Math.floor(playheadBeat() / 4) + 1; }

  function collect() {
    const list = [];
    const rackHits = patternApi?.hitCount?.() ?? 0;
    list.push({ id: 'rack', group: 'rack', label: 'Pattern rack', tag: rackHits ? `${rackHits} hits` : 'empty', title: 'Current state of the Pattern view channel rack', getRows: () => patternApi?.snapshot?.(1)?.rows || [] });
    const seen = new Set();
    engine.tracks.forEach((t) => t.clips.forEach((c) => {
      if (c.meta?.kind !== 'pattern' || !c.meta.rows) return;
      const k = sig(c.meta.rows);
      if (seen.has(k)) return;
      seen.add(k);
      const rows = c.meta.rows;
      list.push({ id: `clip:${t.id}:${c.id}`, group: 'project', label: c.name, tag: t.name, title: `Pattern clip in project (${t.name} @ bar ${Math.round(c.startBeat / 4) + 1})`, getRows: () => rows, sourceName: c.name });
    }));
    STARTERS.forEach((s) => list.push({ id: `starter:${s.kit}`, group: 'starter', label: s.label, tag: 'DEMO', title: `Built-in starter (DEMO · procedural Web Audio) — ${s.desc}`, getRows: () => s.rows, sourceName: s.label }));
    return list;
  }

  function render() {
    items = collect();
    if (!items.some((i) => i.id === selected)) selected = 'rack';
    chipsEl.innerHTML = items.map((i) => `
      <button type="button" class="spb-chip spb-chip--${i.group} ${i.id === selected ? 'on' : ''}" role="option" aria-selected="${i.id === selected}"
        data-spb-id="${esc(i.id)}" draggable="true" title="${esc(i.title)} · click to select · drag onto a lane">
        <span class="spb-name">${esc(i.label)}</span><span class="spb-tag ${i.tag === 'DEMO' ? 'demo' : ''}">${esc(i.tag)}</span>
      </button>`).join('');
  }

  function updatePlaceholder() { atEl.placeholder = `▸${playheadBar()}`; }

  async function place(itemId, trackId, startBar) {
    await engine.init();
    const item = items.find((i) => i.id === itemId);
    if (!item) { toast('Pick a pattern first', 'warn'); return null; }
    const rows = item.getRows().map((r) => ({ inst: r.inst, midi: r.midi, vol: r.vol, muted: !!r.muted, steps: [...r.steps], nudge: r.nudge || 0 }));
    if (!hits(rows)) { toast(item.group === 'rack' ? 'Pattern rack is empty — add steps in Pattern view or pick a starter' : 'That pattern is empty', 'warn'); return null; }
    trackId = trackId || timelineApi?.getSelectedTrackId?.() || engine.tracks[0]?.id;
    const track = engine.tracks.find((t) => t.id === trackId);
    if (!track) { toast('No track — add one first', 'warn'); return null; }
    const bars = Number(barsEl.value) || 4;
    const meta = { kind: 'pattern', bars, rows, source: item.group };
    const buffer = renderPatternBuffer(engine.ctx, meta, engine.secondsPerBeat);
    if (item.group === 'rack') placedCount += 1;
    const name = item.group === 'rack' ? `Pattern ${placedCount}` : (item.group === 'starter' ? `${item.sourceName} · DEMO` : item.sourceName);
    const clip = engine.addClip(track.id, { name, startBeat: (startBar - 1) * 4, durationBeats: bars * 4, color: '#F5C518', buffer, meta });
    if (clip && history) history.push({ label: `Removed ${name}`, undo: () => engine.removeClip(track.id, clip.id) });
    if (clip) timelineApi?.selectClip?.(track.id, clip.id);
    toast(`Placed “${name}” → ${track.name} @ bar ${startBar} (${bars} bar${bars > 1 ? 's' : ''}) · double-click to edit`);
    return clip;
  }

  chipsEl.addEventListener('click', (e) => {
    const c = e.target.closest('[data-spb-id]');
    if (!c) return;
    selected = c.dataset.spbId;
    render();
  });
  chipsEl.addEventListener('dblclick', (e) => {
    const c = e.target.closest('[data-spb-id]');
    if (c) bar.querySelector('[data-spb-place]').click();
  });
  chipsEl.addEventListener('dragstart', (e) => {
    const c = e.target.closest('[data-spb-id]');
    if (!c) return;
    selected = c.dataset.spbId;
    e.dataTransfer.setData(MIME, selected);
    e.dataTransfer.setData('text/plain', '{}');
    e.dataTransfer.effectAllowed = 'copy';
    chipsEl.querySelectorAll('.spb-chip').forEach((el) => el.classList.toggle('on', el === c));
  });

  // Capture phase so the timeline's own clip/sample drop handler never sees pattern drags.
  timelineRoot.addEventListener('drop', (e) => {
    if (!e.dataTransfer?.types?.includes(MIME)) return;
    const lane = e.target.closest?.('[data-lane]');
    if (!lane) return;
    e.preventDefault();
    e.stopPropagation();
    const id = e.dataTransfer.getData(MIME);
    const beat = (e.clientX - lane.getBoundingClientRect().left) / PX_PER_BEAT;
    place(id, lane.dataset.lane, Math.max(1, Math.floor(Math.max(0, beat) / 4) + 1));
  }, true);

  bar.querySelector('[data-spb-place]').addEventListener('click', () => {
    const typed = Number(atEl.value);
    place(selected, null, typed >= 1 ? Math.round(typed) : playheadBar());
  });

  bar.querySelector('[data-spb-preview]').addEventListener('click', async () => {
    await engine.init(); await engine.resume?.();
    const item = items.find((i) => i.id === selected);
    const rows = item?.getRows() || [];
    if (!hits(rows)) { toast('Nothing to preview — pattern is empty', 'warn'); return; }
    const src = engine.ctx.createBufferSource();
    src.buffer = renderPatternBuffer(engine.ctx, { kind: 'pattern', bars: 1, rows }, engine.secondsPerBeat);
    src.connect(engine.masterGain);
    src.start();
    toast(`Preview: ${item.label}${item.tag === 'DEMO' ? ' (DEMO synth)' : ''}`);
  });

  engine.on('tracks', render);
  engine.on('tick', updatePlaceholder);
  engine.on('stop', updatePlaceholder);
  window.addEventListener('mm-sound-deck-demo-loaded', render);
  render();
  updatePlaceholder();

  return { render, place, getSelected: () => selected, select(id) { selected = id; render(); } };
}
