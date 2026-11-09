/**
 * Mens Mercatus Sound Deck — entry
 * AI Producer · Stems · Beats · Vocals · Mic · VST · Synth · Generate · FL Packs · Godmode Ideas
 */
import { AudioEngine } from './audio/engine.js';
import { MixerFX } from './audio/mixer.js';
import { mountTransport } from './ui/transport.js?v=20261005a';
import { mountTimeline } from './ui/timeline.js';
import { mountMixer } from './ui/mixer.js';
import { createHistory } from './ui/history.js';
import { mountLayout, toggleFullscreen } from './ui/layout.js?v=20261003a';
import { mountAiProducer } from './modules/ai-producer.js?v=20261005a';
import { mountStems } from './modules/stems.js';
import { mountBeats } from './modules/beats.js';
import { mountVocals } from './modules/vocals.js';
import { mountMic } from './modules/mic.js';
import { mountVstRack } from './modules/vst-rack.js?v=20261005a';
import { mountSampleSynth, createSampleLibrary } from './modules/sample-synth.js';
import { mountGenerate } from './modules/generate.js';
import { mountFLStudio } from './connectors/fl-studio.js';
import { mountGodmodeIdeas } from './modules/godmode-ideas.js?v=20261006g';

const engine = new AudioEngine();
const mixerFx = new MixerFX(engine);
const library = createSampleLibrary();

const toastEl = document.querySelector('[data-toast]');
const statusEl = document.querySelector('[data-status-bar]');

function toast(msg, kind = 'info') {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.dataset.kind = kind;
  toastEl.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toastEl.classList.remove('show'), 3200);
}

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg;
}


const TIP_KEY = 'mm-sound-deck-tip-dismissed';

function showFirstRunTip(engine) {
  try {
    if (localStorage.getItem(TIP_KEY) === '1') return;
  } catch (e) {}

  const tip = document.createElement('div');
  tip.className = 'mm-sd-tip';
  tip.setAttribute('role', 'dialog');
  tip.setAttribute('aria-label', 'Sound Deck demo tip');
  tip.innerHTML = `
    <p class="mm-sd-tip__kicker">Playable demo path</p>
    <p class="mm-sd-tip__body">
      Load the built-in <strong>Demo</strong> arrangement (drums · bass · keys · pad), then press <strong>Play</strong> / Space.
      Or open <strong>AI Producer</strong> and ask “load demo”. This is Mens Mercatus Sound Deck — not Greysound.
    </p>
    <div class="mm-sd-tip__actions">
      <button type="button" class="mm-sd-tip__btn primary" data-tip="load">Load Demo + Play</button>
      <button type="button" class="mm-sd-tip__btn" data-tip="highlight">Show Demo button</button>
      <button type="button" class="mm-sd-tip__btn ghost" data-tip="dismiss">Dismiss</button>
    </div>
  `;
  document.body.appendChild(tip);

  const demoBtn = document.querySelector('[data-action="demo"]');
  function dismiss() {
    try { localStorage.setItem(TIP_KEY, '1'); } catch (e) {}
    tip.hidden = true;
    tip.remove();
    if (demoBtn) demoBtn.classList.remove('mm-sd-demo-pulse');
  }

  tip.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-tip]');
    if (!btn) return;
    const act = btn.dataset.tip;
    if (act === 'dismiss') {
      dismiss();
      return;
    }
    if (act === 'highlight') {
      if (demoBtn) {
        demoBtn.classList.add('mm-sd-demo-pulse');
        demoBtn.focus();
        toast('Demo is in the transport bar (top right)');
      }
      return;
    }
    if (act === 'load') {
      try {
        await engine.init();
        engine.loadDemoProject();
        // Timeline UI may need a refresh — dispatch a soft signal
        window.dispatchEvent(new CustomEvent('mm-sound-deck-demo-loaded'));
        toast('Demo arrangement loaded — playing');
        await engine.play();
        setStatus('Demo playing · Space pause · S stop');
        dismiss();
      } catch (err) {
        console.error(err);
        toast('Could not start demo — try Demo then Play', 'error');
      }
    }
  });
}


/**
 * Portfolio walkthrough (shared MMDemoKit from ../../js/demo-kit.js).
 * Happy path never needs the microphone: Demo → Play → master EQ/reverb → Generate (local synthesis).
 * No-ops when the kit is absent (desktop/Electron or standalone serve).
 */
function mountDeckWalkthrough(engine) {
  const K = window.MMDemoKit;
  const nav = document.querySelector('[data-deck] > nav.mm-four-strip');
  if (!K || !nav) return null;
  const host = document.createElement('div');
  host.className = 'mm-sd-walk';
  nav.after(host);
  const pulse = (sel) => {
    document.querySelectorAll('.mm-sd-demo-pulse').forEach((el) => el.classList.remove('mm-sd-demo-pulse'));
    const el = document.querySelector(sel);
    if (el) { el.classList.add('mm-sd-demo-pulse'); el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); el.focus({ preventScroll: true }); }
    return el;
  };
  const walk = K.mountWalkthrough(host, {
    id: 'sound-deck',
    title: 'Sound Deck · demo path',
    intro: 'Hear it in four steps — no mic or sign-in needed: load Demo → Play → shape the master → Generate a new part.',
    steps: [
      { id: 'demo', label: 'Load Demo', hint: 'Press Demo in the transport bar (drums · bass · keys · pad).' },
      { id: 'play', label: 'Play', hint: 'Press ▶ or Space. Watch the timecode and the master spectrum move.' },
      { id: 'mix', label: 'Shape the master', hint: 'In the mixer master strip, nudge Low/Mid/High EQ or toggle Rvb (reverb).' },
      { id: 'generate', label: 'Generate', hint: 'Generate tab → pick a prompt chip → Generate arrangement. Local synthesis in your browser.' },
    ],
    onStep: (st) => {
      if (st.id === 'demo') pulse('[data-action="demo"]');
      if (st.id === 'play') pulse('[data-action="play"]');
      if (st.id === 'mix') pulse('[data-reverb]') || pulse('[data-master-eq]');
      if (st.id === 'generate') { document.querySelector('[data-tab="generate"]')?.click(); pulse('[data-ttm-go]'); }
    },
    completeText: 'That is the core loop. Explore Stems, Beats, Vocals, Synth. Mic is optional and never needed for the demo path (the public host currently blocks microphone access by policy; use the local/desktop build for recording).',
  });
  if (!walk) return null;
  const head = walk.el.querySelector('.mm-demo-bar__head');
  const pill = document.createElement('span');
  head.insertBefore(pill, head.children[1]);
  K.mountStatus(pill, { mode: 'demo', label: 'Browser demo · local Web Audio', title: 'Runs entirely in this tab; nothing is uploaded' });
  if (walk.progress().done.length >= 4 || window.matchMedia('(max-width: 520px)').matches && walk.progress().done.length) {
    walk.el.querySelector('[data-k="toggle"]')?.click();
  }

  window.addEventListener('mm-sound-deck-demo-loaded', () => walk.done('demo'));
  engine.on('play', () => walk.done('play'));
  document.addEventListener('input', (e) => { if (e.target.closest?.('[data-master-eq],[data-master-vol]')) walk.done('mix'); });
  document.addEventListener('click', (e) => {
    if (e.target.closest?.('[data-reverb]')) walk.done('mix');
    if (e.target.closest?.('[data-ttm-go],[data-stem-go],[data-cont-go]')) {
      const onTracks = () => { engine.off('tracks', onTracks); clearTimeout(timer); walk.done('generate'); };
      const timer = setTimeout(() => engine.off('tracks', onTracks), 30000);
      engine.on('tracks', onTracks);
    }
  });
  return walk;
}

async function boot() {
  if (window.mmDesktop?.isDesktop) document.body.classList.add('mm-desktop');

  const history = createHistory(toast);
  const deck = document.querySelector('[data-deck]');
  const hooks = {};
  mountTransport(document.querySelector('[data-transport]'), engine, toast, hooks);

  const timelineApi = mountTimeline(
    document.querySelector('[data-timeline]'),
    engine,
    toast,
    library,
    history
  );
  const getSelectedTrackId = () => timelineApi?.getSelectedTrackId?.();

  mountMixer(document.querySelector('[data-mixer]'), engine, mixerFx, toast, history);

  mountLayout({
    app: deck,
    workspace: document.querySelector('[data-workspace]'),
    lib: document.querySelector('[data-library-panel]'),
    ai: document.querySelector('.ai-panel'),
    mixer: document.querySelector('[data-mixer]'),
    history,
  });

  function setFocus(on) {
    deck.classList.toggle('is-focus', on);
    const btn = document.querySelector('[data-action="focus"]');
    if (btn) {
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.classList.toggle('primary', on);
    }
  }

  hooks.onUndo = () => history.undo();
  hooks.onFocus = () => {
    const next = !deck.classList.contains('is-focus');
    setFocus(next);
    toast(next ? 'Focus mode — arrange and transport. Escape exits.' : 'Focus mode off');
  };
  hooks.onFullscreen = () => {
    const ok = toggleFullscreen(deck);
    if (!ok) toast('Fullscreen is not available in this browser', 'warn');
  };
  document.addEventListener('fullscreenchange', syncDeckFs);
  document.addEventListener('webkitfullscreenchange', syncDeckFs);
  function syncDeckFs() {
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    const btn = document.querySelector('[data-action="fs-deck"]');
    if (!btn) return;
    const on = fs === deck;
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.classList.toggle('primary', on);
  }

  const libPanel = document.querySelector('[data-library-panel]');
  function refreshLibraryPanel() {
    if (!libPanel) return;
    const items = library.list();
    libPanel.innerHTML = `
      <div class="panel-head"><h2>Library</h2></div>
      <p class="panel-desc">Synths &amp; FL packs. Drag onto timeline.</p>
      <div class="lib-list" data-side-lib></div>
    `;
    const list = libPanel.querySelector('[data-side-lib]');
    if (!items.length) {
      list.innerHTML = '<div class="empty">Generate, AI Producer “make beat”, Synth, or FL Packs.</div>';
      return;
    }
    list.innerHTML = items.map((s) => `
      <div class="lib-item" draggable="true" data-id="${s.id}">
        <span class="lib-swatch" style="background:${s.color}"></span>
        <span class="lib-name">${s.name}</span>
      </div>
    `).join('');
    list.querySelectorAll('.lib-item').forEach((el) => {
      el.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('application/x-mm-sample', el.dataset.id);
      });
    });
  }
  refreshLibraryPanel();

  const panes = {
    aiproducer: document.querySelector('[data-pane="aiproducer"]'),
    stems: document.querySelector('[data-pane="stems"]'),
    beats: document.querySelector('[data-pane="beats"]'),
    vocals: document.querySelector('[data-pane="vocals"]'),
    mic: document.querySelector('[data-pane="mic"]'),
    vst: document.querySelector('[data-pane="vst"]'),
    synth: document.querySelector('[data-pane="synth"]'),
    generate: document.querySelector('[data-pane="generate"]'),
    fl: document.querySelector('[data-pane="fl"]'),
    godmode: document.querySelector('[data-pane="godmode"]'),
  };

  if (panes.aiproducer) mountAiProducer(panes.aiproducer, engine, timelineApi, toast);
  if (panes.stems) mountStems(panes.stems, engine, toast);
  if (panes.beats) mountBeats(panes.beats, engine, toast, getSelectedTrackId);
  if (panes.vocals) mountVocals(panes.vocals, engine, toast, getSelectedTrackId);
  if (panes.mic) mountMic(panes.mic, engine, toast, getSelectedTrackId);
  if (panes.vst) mountVstRack(panes.vst, engine, toast);
  if (panes.synth) mountSampleSynth(panes.synth, engine, library, toast, refreshLibraryPanel);
  if (panes.generate) mountGenerate(panes.generate, engine, library, toast, refreshLibraryPanel, getSelectedTrackId);
  if (panes.fl) mountFLStudio(panes.fl, engine, library, toast, refreshLibraryPanel);
  if (panes.godmode) mountGodmodeIdeas(panes.godmode);

  document.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-tab]').forEach((b) => {
        const on = b === btn;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      Object.entries(panes).forEach(([key, el]) => {
        if (el) el.hidden = key !== btn.dataset.tab;
      });
    });
  });

  window.addEventListener('keydown', async (e) => {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      history.undo();
      return;
    }
    if (e.code === 'Space') {
      e.preventDefault();
      if (engine.isPlaying) engine.pause();
      else await engine.play();
    } else if ((e.key === 's' || e.key === 'S') && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      engine.stop();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      timelineApi?.nudge?.(e.key === 'ArrowRight' ? 1 : -1);
    } else if (e.key === 'Escape') {
      const fs = document.fullscreenElement || document.webkitFullscreenElement;
      if (fs) return;
      if (deck.classList.contains('is-focus')) {
        setFocus(false);
        toast('Focus mode off');
      }
    }
  });

  await engine.init();
  setStatus('Ready · Space play · arrows nudge · Snap & loop on the ruler · A/B on the mixer');
  toast('Sound Deck ready — tap Load Demo or Demo in transport');
  try { mountDeckWalkthrough(engine); } catch (e) { console.warn('[Sound Deck] walkthrough', e); }
  showFirstRunTip(engine);
}

boot().catch((err) => {
  console.error(err);
  setStatus('Boot error — see console');
});
