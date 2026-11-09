/**
 * Song view loop chrome (God Mode Wave 2 · Song End + Section Loop).
 *   ⏭ Song end  — seek + scroll to the last clip, red end marker on the ruler
 *   Loop end 4/8 — loop the last N bars of the song
 *   [ In / Out ] — drop a loop brace at the playhead (ruler braces { } stay draggable)
 *   Section chips — Intro / Verse / Drop / Outro detected from clip layout (fallback: proportional)
 * Every path calls engine.setLoopRegion, so transport In/Out/Len stay in sync via the 'loop' event.
 */
import {
  HEADER_W, PX_PER_BEAT, detectSections, endLoopRange, songEndBeat, songEndBar,
  playheadBeat, scrollTimelineToBeat, setLoop, getEnergy,
} from '../modules/god-mode/sections.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (b) => String(Math.round(b * 100) / 100);

export function mountSongLoopChrome(timelineRoot, engine, toast = () => {}) {
  const header = timelineRoot?.querySelector('.timeline-header');
  const ruler = header?.querySelector('[data-ruler]');
  if (!header || !ruler) return null;

  const bar = document.createElement('div');
  bar.className = 'song-loop-bar';
  bar.setAttribute('data-song-loop-bar', '');
  bar.setAttribute('aria-label', 'Song end and section loop');
  bar.innerHTML = `
    <span class="slb-label" title="God Mode · Song End + Section Loop">Sections</span>
    <button type="button" class="btn sm ghost" data-slb="end" title="Jump to the end of the song (last clip)">⏭ Song end</button>
    <button type="button" class="btn sm ghost" data-slb="loop-end-4" title="Loop the last 4 bars of the song">Loop end 4</button>
    <button type="button" class="btn sm ghost" data-slb="loop-end-8" title="Loop the last 8 bars of the song">8</button>
    <button type="button" class="btn sm ghost" data-slb="in" title="Set loop start brace { at the playhead">{ In</button>
    <button type="button" class="btn sm ghost" data-slb="out" title="Set loop end brace } at the playhead">Out }</button>
    <div class="slb-chips" data-slb-chips role="group" aria-label="Section chips — click to loop a section"></div>
    <span class="slb-readout" data-slb-readout></span>
  `;
  header.insertBefore(bar, ruler);

  const chipsEl = bar.querySelector('[data-slb-chips]');
  const readout = bar.querySelector('[data-slb-readout]');
  let sections = [];

  function syncActive() {
    const on = !!engine.isLooping;
    readout.textContent = `Loop ${fmt(engine.loopStart + 1)}–${fmt(engine.loopEnd)} · ${on ? 'on' : 'off'} · end bar ${fmt(songEndBar(engine))}`;
    readout.classList.toggle('on', on);
    chipsEl.querySelectorAll('[data-slb-sec]').forEach((b) => {
      const s = sections[Number(b.dataset.slbSec)];
      const active = on && s && Math.abs(s.startBar - engine.loopStart) < 0.01 && Math.abs(s.endBar - engine.loopEnd) < 0.01;
      b.classList.toggle('active', !!active);
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function renderChips() {
    sections = detectSections(engine);
    chipsEl.innerHTML = sections.map((s, i) => `
      <button type="button" class="btn sm ghost slb-chip" data-slb-sec="${i}" data-section-id="${esc(s.id)}"
        title="Loop ${esc(s.label)} · bars ${fmt(s.startBar + 1)}–${fmt(s.endBar)} (${esc(s.source)})" aria-pressed="false">${esc(s.label)}</button>`).join('');
    syncActive();
  }

  function ensureMarker() {
    const endBeat = songEndBeat(engine);
    let m = ruler.querySelector('.song-end-marker');
    if (endBeat <= 0) { m?.remove(); return; }
    if (!m) {
      m = document.createElement('div');
      m.className = 'song-end-marker';
      m.setAttribute('aria-hidden', 'true');
      m.innerHTML = '<span>END</span>';
      ruler.appendChild(m);
    }
    m.style.left = `${HEADER_W + endBeat * PX_PER_BEAT}px`;
    const heat = getEnergy();
    let h = ruler.querySelector('.song-heat');
    if (!heat?.length) { h?.remove(); return; }
    if (!h) {
      h = document.createElement('div');
      h.className = 'song-heat';
      h.title = 'Energy per bar (Drop Finder / Energy Predictor)';
      ruler.appendChild(h);
    }
    const sig = heat.map((v) => v.toFixed(2)).join(',');
    if (h.dataset.sig !== sig) {
      h.dataset.sig = sig;
      h.innerHTML = heat.map((v) => `<i style="width:${PX_PER_BEAT * 4}px;background:rgba(248,${Math.round(200 - v * 150)},60,${(0.15 + v * 0.8).toFixed(2)})"></i>`).join('');
    }
  }

  // Timeline re-renders the ruler with innerHTML — re-attach marker/heat after each render.
  try {
    new MutationObserver(() => {
      if (!ruler.querySelector('.song-end-marker') || (getEnergy() && !ruler.querySelector('.song-heat'))) ensureMarker();
    }).observe(ruler, { childList: true });
  } catch (_) {}

  let t = null;
  const refresh = () => {
    clearTimeout(t);
    t = setTimeout(() => { renderChips(); ensureMarker(); }, 60);
  };

  bar.addEventListener('click', async (e) => {
    const chip = e.target.closest('[data-slb-sec]');
    if (chip) {
      const s = sections[Number(chip.dataset.slbSec)];
      if (!s) return;
      await engine.init?.();
      setLoop(engine, s.startBar, s.endBar, true);
      scrollTimelineToBeat(s.startBar * 4, { align: 0.25 });
      toast(`Loop ${s.label} · bars ${fmt(s.startBar + 1)}–${fmt(s.endBar)}`);
      return;
    }
    const btn = e.target.closest('[data-slb]');
    if (!btn) return;
    const act = btn.dataset.slb;
    const endBeat = songEndBeat(engine);
    if (act === 'end') {
      if (endBeat <= 0) { toast('No clips yet — the song is empty', 'warn'); return; }
      const target = Math.max(0, endBeat - 4);
      engine.seekToBeat(target);
      scrollTimelineToBeat(endBeat, { align: 0.75 });
      ensureMarker();
      toast(`Song ends after bar ${fmt(endBeat / 4)} · playhead parked 1 bar before`);
    } else if (act === 'loop-end-4' || act === 'loop-end-8') {
      const n = act === 'loop-end-8' ? 8 : 4;
      const r = endLoopRange(engine, n);
      setLoop(engine, r.startBar, r.endBar, true);
      scrollTimelineToBeat(r.endBar * 4, { align: 0.75 });
      toast(`Loop last ${n} bars · ${fmt(r.startBar + 1)}–${fmt(r.endBar)}`);
    } else if (act === 'in' || act === 'out') {
      const bars = Math.round((playheadBeat(engine) / 4) * 4) / 4;
      let s = engine.loopStart;
      let en = engine.loopEnd;
      if (act === 'in') { s = bars; if (en <= s) en = s + 4; }
      else { en = bars; if (en <= s) s = Math.max(0, en - 4); }
      setLoop(engine, s, en, true);
      toast(`Loop ${act === 'in' ? '{ in' : 'out }'} @ bar ${fmt(bars + 1)}`);
    }
  });

  engine.on('tracks', refresh);
  engine.on('loop', syncActive);
  window.addEventListener('mm-sound-deck-demo-loaded', refresh);
  window.addEventListener('sx-god:energy', ensureMarker);
  renderChips();
  ensureMarker();

  const api = { refresh, getSections: () => sections.slice(), element: bar };
  try { window.__sxSongLoop = api; } catch (_) {}
  return api;
}
