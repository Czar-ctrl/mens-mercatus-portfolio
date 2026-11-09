/* preview wave 3 AI — case-study narrator: edge-tts MP3 + WebVTT captions, inline player with a highlighted, clickable transcript. */
import { esc } from './core.js';
const d = document, B = (window.MM_AI_CONFIG || {}).base || '/';
let P = null;
export const data = () => P || (P = fetch(B + 'data/ai/narration.json?v=m1').then(r => r.json()));
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>', PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>';
export function player(host, it) {
  host.innerHTML = `<div class="mm-player"><button type="button" class="mm-play" data-mm-nar-play aria-label="Play the ${esc(it.title)} walkthrough">${PLAY}</button>
    <div class="mm-prog" role="slider" tabindex="0" aria-label="Seek" aria-valuemin="0" aria-valuemax="${Math.round(it.duration)}" aria-valuenow="0"><i></i></div>
    <span class="mm-time">0:00 / ${fmt(it.duration)}</span><button type="button" class="mm-rate" aria-label="Playback speed">1×</button></div>
    <audio preload="none" crossorigin="anonymous" src="${esc(it.audio)}"><track kind="captions" srclang="en" label="English" src="${esc(it.captions)}" default></audio>
    <div class="mm-trans" aria-label="Transcript">${it.cues.map((c, i) => `<span data-c="${i}" data-s="${c.start}">${esc(c.text)}</span>`).join(' ')}</div>
    <p class="mm-note" style="margin-top:10px">Voice: ${esc(it.voice.replace('en-ZA-', '').replace('Neural', ''))} (edge-tts, en-ZA) · script written only from <a href="${esc(it.url)}">${esc(it.source)}</a> · captions: WebVTT</p>`;
  const a = host.querySelector('audio'), btn = host.querySelector('.mm-play'), bar = host.querySelector('.mm-prog'), fill = bar.querySelector('i'), tm = host.querySelector('.mm-time'), rate = host.querySelector('.mm-rate');
  const spans = [...host.querySelectorAll('.mm-trans span')];
  let cur = -1;
  const sync = () => {
    const t = a.currentTime, dur = a.duration || it.duration; fill.style.width = (t / dur * 100) + '%'; tm.textContent = fmt(t) + ' / ' + fmt(dur); bar.setAttribute('aria-valuenow', Math.round(t));
    let k = -1; for (let i = 0; i < it.cues.length; i++) if (t >= it.cues[i].start - 0.05) k = i;
    if (k !== cur) { cur = k; spans.forEach((s, i) => { s.classList.toggle('on', i === k); s.classList.toggle('past', i < k); }); if (spans[k]) { const box = host.querySelector('.mm-trans'); box.scrollTop = spans[k].offsetTop - box.offsetTop - 40; } }
  };
  // cue changes from the real <track> (VTT) drive the highlight too
  const tr = a.textTracks && a.textTracks[0]; if (tr) { tr.mode = 'hidden'; tr.addEventListener('cuechange', () => { host.dataset.cue = tr.activeCues && tr.activeCues[0] ? tr.activeCues[0].text.slice(0, 40) : ''; }); }
  a.addEventListener('timeupdate', sync); a.addEventListener('seeked', sync);
  a.addEventListener('play', () => { btn.innerHTML = PAUSE; btn.setAttribute('aria-label', 'Pause'); d.querySelectorAll('audio').forEach(o => { if (o !== a) o.pause(); }); });
  a.addEventListener('pause', () => { btn.innerHTML = PLAY; btn.setAttribute('aria-label', 'Play the ' + it.title + ' walkthrough'); });
  a.addEventListener('ended', () => { cur = -1; spans.forEach(s => s.classList.add('past')); });
  btn.addEventListener('click', () => { if (a.paused) a.play().catch(() => {}); else a.pause(); });
  const seek = x => { const r = bar.getBoundingClientRect(); a.currentTime = Math.max(0, Math.min(1, (x - r.left) / r.width)) * (a.duration || it.duration); };
  bar.addEventListener('click', e => seek(e.clientX));
  bar.addEventListener('keydown', e => { if (e.key === 'ArrowRight') a.currentTime += 5; if (e.key === 'ArrowLeft') a.currentTime -= 5; });
  spans.forEach(s => s.addEventListener('click', () => { a.currentTime = +s.dataset.s + 0.01; if (a.paused) a.play().catch(() => {}); }));
  const R = [1, 1.25, 1.5, 0.85]; let ri = 0; rate.addEventListener('click', () => { ri = (ri + 1) % R.length; a.playbackRate = R[ri]; rate.textContent = R[ri] + '×'; });
  return a;
}
export async function full(host) {
  const D = await data();
  host.innerHTML = `<div class="mm-nar"><div class="mm-nar-list" role="group" aria-label="Choose a project">${D.items.map((it, i) => `<button type="button" aria-pressed="${i === 0}" data-i="${i}">${esc(it.title)}<span>${fmt(it.duration)}</span></button>`).join('')}</div><div class="mm-card glow" data-mm-nar-host></div></div>`;
  const ph = host.querySelector('[data-mm-nar-host]'); let a = player(ph, D.items[0]);
  host.querySelector('.mm-nar-list').addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (!b) return; if (a) a.pause(); host.querySelectorAll('.mm-nar-list button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); a = player(ph, D.items[+b.dataset.i]); });
}
export async function forUrl(url) { const D = await data(); return D.items.find(i => i.url === url || (i.urls || []).includes(url)); }
