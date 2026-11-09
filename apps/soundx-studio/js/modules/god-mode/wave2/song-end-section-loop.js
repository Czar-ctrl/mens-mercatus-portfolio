/**
 * W2 #1 Song End + Section Loop — jump to the last clip, set { } braces, loop detected sections.
 * Song view has the same controls inline (js/ui/song-loop-chrome.js); this card applies via the
 * command protocol so each loop change is one Restore point.
 */
import { registerFeature } from '../registry.js';
import { makeBatch } from '../command-schema.js';
import { executeBatch, resultLine } from '../command-exec.js';
import { detectSections, endLoopRange, songEndBeat, songEndBar, scrollTimelineToBeat, playheadBeat } from '../sections.js';
import { esc, fmtBar, onEngine, setStatus } from '../w23-ui.js';

registerFeature({
  id: 'song-end-section-loop',
  title: 'Song End + Section Loop',
  blurb: 'Jump to the end of the song, drag { } braces, or tap Intro / Verse / Drop / Outro chips to loop that part. Also inline on the Song timeline.',
  badge: 'DEMO',
  wave: 2,
  mount(card, ctx) {
    card.innerHTML = `
      <p class="fineprint" data-sl-info></p>
      <div class="sx-god-row">
        <button type="button" class="btn sm" data-sl="end">⏭ Jump to song end</button>
        <button type="button" class="btn sm ghost" data-sl="last4">Loop last 4</button>
        <button type="button" class="btn sm ghost" data-sl="last8">Loop last 8</button>
      </div>
      <div class="sx-god-chips" data-sl-chips role="group" aria-label="Sections"></div>
      <div class="sx-god-row">
        <label class="field"><span>{ In bar</span><input type="number" min="1" step="0.25" data-sl-in /></label>
        <label class="field"><span>Out bar }</span><input type="number" min="1" step="0.25" data-sl-out /></label>
        <button type="button" class="btn sm ghost" data-sl="here-in" title="In brace at playhead">{ @ playhead</button>
        <button type="button" class="btn primary sm" data-sl="braces">Loop braces</button>
      </div>
      <p class="fineprint" data-sl-status>Section detection: clip names → clip-layout activity → proportional fallback · DEMO</p>
    `;
    const engine = ctx.engine;
    const info = card.querySelector('[data-sl-info]');
    const chips = card.querySelector('[data-sl-chips]');
    const inEl = card.querySelector('[data-sl-in]');
    const outEl = card.querySelector('[data-sl-out]');
    const status = card.querySelector('[data-sl-status]');
    let secs = [];

    const sync = () => {
      secs = detectSections(engine);
      const end = songEndBar(engine);
      info.textContent = end > 0
        ? `Song ends after bar ${fmtBar(end)} · ${secs.length} sections (${secs[0]?.source}) · loop ${fmtBar(engine.loopStart + 1)}–${fmtBar(engine.loopEnd)} ${engine.isLooping ? 'on' : 'off'}`
        : 'Empty song — sections fall back to a 4-bar proportional split.';
      chips.innerHTML = secs.map((s, i) => `<button type="button" class="btn sm ghost sx-god-chip${engine.isLooping && s.startBar === engine.loopStart && s.endBar === engine.loopEnd ? ' active' : ''}" data-sec="${i}" title="bars ${fmtBar(s.startBar + 1)}–${fmtBar(s.endBar)}">${esc(s.label)} <em>${fmtBar(s.startBar + 1)}–${fmtBar(s.endBar)}</em></button>`).join('');
      if (document.activeElement !== inEl) inEl.value = fmtBar(engine.loopStart + 1);
      if (document.activeElement !== outEl) outEl.value = fmtBar(engine.loopEnd);
    };
    onEngine(engine, 'tracks', sync, card);
    onEngine(engine, 'loop', sync, card);
    sync();

    const loop = async (s, e, label) => {
      const res = await executeBatch(ctx, makeBatch(label, [{ action: 'set_loop_region', start_bar: s, end_bar: e, looping: true }]));
      setStatus(status, resultLine(res));
      if (res.status === 'success') scrollTimelineToBeat(s * 4, { align: 0.25 });
    };

    chips.addEventListener('click', (e) => {
      const b = e.target.closest('[data-sec]');
      const s = b && secs[Number(b.dataset.sec)];
      if (s) loop(s.startBar, s.endBar, `Loop ${s.label}`);
    });
    card.addEventListener('click', (e) => {
      const b = e.target.closest('[data-sl]');
      if (!b) return;
      const act = b.dataset.sl;
      if (act === 'end') {
        const end = songEndBeat(engine);
        if (!end) { setStatus(status, 'Song is empty — nothing to jump to.'); return; }
        engine.seekToBeat(Math.max(0, end - 4));
        scrollTimelineToBeat(end, { align: 0.75 });
        setStatus(status, `Playhead parked 1 bar before the end (bar ${fmtBar(end / 4)}). Open the Song view to see the red END marker.`);
      } else if (act === 'last4' || act === 'last8') {
        const r = endLoopRange(engine, act === 'last8' ? 8 : 4);
        loop(r.startBar, r.endBar, `Loop last ${act === 'last8' ? 8 : 4} bars`);
      } else if (act === 'here-in') {
        inEl.value = fmtBar(Math.floor(playheadBeat(engine)) / 4 + 1);
      } else if (act === 'braces') {
        const s = Number(inEl.value) - 1;
        const en = Number(outEl.value);
        loop(s, en, 'Loop braces');
      }
    });
  },
});
