/**
 * Mens Mercatus Sound Deck — entry
 * View modes: Pattern · Piano · Song (timeline)
 * Tabs: AI Producer · Stems · Beats · Loops · Drummer · 808 · Pedals · Voice · Vocals · Mic · Instruments · Plugins & Packs · Synth · Generate · God Mode
 * Feature pack: Ogg export · UX polish · Stem DNA · Ghost · Co-producer · Versions · Multi-device LAN
 */
import { AudioEngine } from './audio/engine.js?v=20261008md-sxs20261020b';
import { MixerFX } from './audio/mixer.js';
import { mountTransport } from './ui/transport.js?v=20261008md-sxs20261020b';
import { mountTimeline } from './ui/timeline.js?v=20261006w-sxs20261020b';
import { mountViewModes } from './ui/view-modes.js?v=20261006r-sxs20261020b';
import { mountMixer } from './ui/mixer.js';
import { createHistory } from './ui/history.js';
import { mountLayout, toggleFullscreen } from './ui/layout.js?v=20261007k-sxs20261020b';
import { createFeatureDock, mountFeatureDockCollapse } from './ui/feature-dock.js?v=20261007k-sxs20261020b';
import { mountAiProducer } from './modules/ai-producer.js?v=20261009ml-sxs20261020b';
import { mountStems } from './modules/stems.js?v=20261008md-sxs20261020b';
import { mountBeats } from './modules/beats.js?v=20261007a-sxs20261020b';
import { mountLiveLoops } from './modules/live-loops.js?v=20261007j-sxs20261020b';
import { mountVirtualDrummer } from './modules/virtual-drummer.js?v=20261007a-sxs20261020b';
import { mountAtlanta808 } from './modules/atlanta-808.js?v=20261007d-sxs20261020b';
import { mountPedalboard } from './modules/pedalboard.js?v=20261007a-sxs20261020b';
import { mountVoiceAssist } from './modules/voice-assist.js?v=20261007i-sxs20261020b';
import { createInsertHost } from './audio/fx-inserts.js?v=20261007a-sxs20261020b';
import { mountVocals } from './modules/vocals.js';
import { mountMic } from './modules/mic.js';
import { mountSampleSynth, createSampleLibrary } from './modules/sample-synth.js';
import { mountGenerate } from './modules/generate.js?v=20261009ml-sxs20261020b';
import { mountGodmodeIdeas, focusGodFeature } from './modules/godmode-ideas.js?v=20261008md-sxs20261020b';
import { mountInstruments, getInstrument, getKit } from './modules/instruments.js?v=20261006p-sxs20261020b';
import { mountPatternRack } from './modules/pattern-rack.js?v=20261006w-sxs20261020b';
import { mountSongPatterns } from './ui/song-patterns.js?v=20261006w-sxs20261020b';
import { mountSongLoopChrome } from './ui/song-loop-chrome.js?v=20261008md-sxs20261020b';
import { fitShortViewportOnce } from './ui/viewport-fit.js?v=20261008md-sxs20261020b';
fitShortViewportOnce();
import { mountPianoRoll } from './modules/piano-roll.js?v=20261006w-sxs20261020b';
import { mountDiceForge, getDiceState } from './modules/dice-forge.js?v=20261006w-sxs20261020b';
import { mountTradingfloorForm } from './ui/tradingfloor-form.js?v=20261006w-sxs20261020b';
import { mountPluginsPacks } from './modules/plugins-packs.js?v=20261007a-sxs20261020b';
import { mountUxPolish } from './modules/ux-polish.js?v=20261007l-sxs20261020b';
import { mountStemDna } from './modules/stem-dna.js?v=20261007b-sxs20261020b';
import { mountGhostLayer } from './modules/ghost-layer.js?v=20261007b-sxs20261020b';
import { mountCoProducer } from './modules/co-producer.js?v=20261007b-sxs20261020b';
import { createSessionVersions, mountSessionVersions } from './modules/session-versions.js?v=20261008md-sxs20261020b';
// multidevice-host loaded dynamically — missing file must not blank the deck
import { applyTheme } from './modules/themes.js?v=20261007l-sxs20261020b';
try { applyTheme(); } catch (_) {}

const engine = new AudioEngine();
const mixerFx = new MixerFX(engine);
const inserts = createInsertHost(engine);
engine.inserts = inserts;
const library = createSampleLibrary();
// Bump persisted mixer height so full strips (name+EQ+fader) fit after UI fix2
try {
  const k = 'mm-sound-deck-layout';
  const raw = JSON.parse(localStorage.getItem(k) || 'null');
  if (raw && Number(raw.mixer) < 340) {
    raw.mixer = 340;
    localStorage.setItem(k, JSON.stringify(raw));
  }
} catch (_) {}


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
  tip.setAttribute('aria-label', 'SoundX demo tip');
  tip.innerHTML = `
    <p class="mm-sd-tip__kicker">Playable demo path</p>
    <p class="mm-sd-tip__body">
      Load the built-in <strong>Demo</strong> arrangement (drums · bass · keys · pad), then press <strong>Play</strong> / Space.
      Or open <strong>AI Producer</strong> and ask “load demo”. This is Mens Mercatus SoundX.
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
    title: 'SoundX Studio · demo path',
    intro: 'Hear it in four steps — no mic or sign-in needed: load Demo → Play → shape the master → Generate a new part.',
    steps: [
      { id: 'demo', label: 'Load Demo', hint: 'Press Demo in the transport bar (drums · bass · keys · pad).' },
      { id: 'play', label: 'Play', hint: 'Press ▶ or Space. Watch the timecode and the master spectrum move.' },
      { id: 'mix', label: 'Shape master', hint: 'In the mixer master strip, nudge Low/Mid/High EQ or toggle Rvb (reverb).' },
      { id: 'generate', label: 'Generate', hint: 'Generate tab → pick a prompt chip → Generate arrangement. Local synthesis in your browser.' },
    ],
    onStep: (st) => {
      if (st.id === 'demo') pulse('[data-action="demo"]');
      if (st.id === 'play') pulse('[data-action="play"]');
      if (st.id === 'mix') pulse('[data-reverb]') || pulse('[data-master-eq]');
      if (st.id === 'generate') { document.querySelector('[data-tab="generate"]')?.click(); pulse('[data-ttm-go]'); }
    },
    completeText: 'That is the core loop. Explore Stems, Beats, Vocals, Synth. Mic is optional and never needed for the demo path. Recording works here too — your browser asks for microphone permission the first time (Mic tab, or pair your phone as a mic via Pair phone).',
  });
  if (!walk) return null;
  const head = walk.el.querySelector('.mm-demo-bar__head');
  const pill = document.createElement('span');
  head.insertBefore(pill, head.children[1]);
  K.mountStatus(pill, { mode: 'demo', label: 'DEMO', title: 'Browser demo · local Web Audio — runs in this tab; nothing is uploaded' });
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

  // Static Pattern | Piano | Song bar lives in index.html; lift it out before the timeline renders.
  const staticViewBar = document.querySelector('[data-timeline] [data-view-modes]');
  staticViewBar?.remove();
  const timelineApi = mountTimeline(
    document.querySelector('[data-timeline]'),
    engine,
    toast,
    library,
    history
  );
  const getSelectedTrackId = () => timelineApi?.getSelectedTrackId?.();
  const getSelectedClip = () => timelineApi?.getSelectedClip?.();

  // —— View modes: Pattern | Piano | Song ——
  const timelineRoot = document.querySelector('[data-timeline]');
  let patternApi = null;
  let pianoApi = null;
  let songPatterns = null;
  const views = mountViewModes(timelineRoot, {
    bar: staticViewBar,
    onChange(mode) {
      if (mode !== 'pattern') patternApi?.stop();
      if (mode !== 'piano') pianoApi?.stop();
      if (mode === 'pattern') {
        patternApi?.setTrack(getSelectedTrackId());
      }
      if (mode === 'song') songPatterns?.render();
      if (mode === 'piano' && pianoApi) {
        const sel = getSelectedClip();
        if (sel && sel.clipId !== pianoApi.sourceClipId && !pianoApi.dirty && (sel.clip.notes?.length || sel.clip.meta?.kind === 'piano')) {
          pianoApi.loadClip(sel.trackId, sel.clipId);
        }
      }
      setStatus(mode === 'song'
        ? 'Song view · Space play · arrows nudge'
        : `${mode === 'pattern' ? 'Pattern' : 'Piano'} view · Space previews the loop at ${engine.bpm} BPM · Song to arrange`);
    },
  });
  const onPlaced = (trackId, clipId) => { if (clipId) timelineApi?.selectClip?.(trackId, clipId); };
  let diceApi = null;
  const diceToPattern = () => {
    if (!diceApi) return;
    diceApi.roll('beats');
    patternApi.loadMeta({ kind: 'pattern', bars: 1, rows: getDiceState().beats.rows });
    toast('🎲 Dice Forge groove → Pattern rack · kick late / hats early · Space to hear');
  };
  const diceToPiano = (part) => {
    if (!diceApi) return;
    diceApi.roll(part);
    const d = getDiceState();
    const meta = part === 'chords' ? d.chords : d.melody;
    pianoApi.loadNotes({ inst: meta.inst, bars: meta.bars, notes: meta.notes });
    toast(part === 'chords' ? `🎲 Chords → Piano: ${d.chords.names.join(' → ')}` : '🎲 Sparse melody → Piano · Write to track when happy');
  };
  patternApi = mountPatternRack(views.panes.pattern, engine, toast, { getSelectedTrackId, onPlaced, onDice: diceToPattern });
  pianoApi = mountPianoRoll(views.panes.piano, engine, toast, { getSelectedTrackId, getSelectedClip, onPlaced, onDice: diceToPiano });
  // Song view: Pattern picker + Place Pattern (rack state, project pattern clips, DEMO starters)
  try {
    songPatterns = mountSongPatterns(timelineRoot, engine, toast, { patternApi, timelineApi, history });
  } catch (e) { console.warn('[Sound Deck] pattern picker', e); }
  // Song view: song end + loop braces + section chips (God Mode Wave 2)
  try {
    mountSongLoopChrome(timelineRoot, engine, toast);
  } catch (e) { console.warn('[Sound Deck] song loop chrome', e); }

  // Double-click a pattern / note clip in Song view to edit it in Pattern / Piano.
  timelineRoot.addEventListener('dblclick', (e) => {
    const el = e.target.closest('.clip');
    if (!el) return;
    const track = engine.tracks.find((t) => t.id === el.dataset.track);
    const clip = track?.clips.find((c) => c.id === el.dataset.clip);
    if (!clip) return;
    if (clip.meta?.kind === 'pattern') {
      patternApi.loadMeta(clip.meta, { trackId: track.id, startBeat: clip.startBeat });
      views.setMode('pattern');
      toast(`Pattern view: loaded “${clip.name}” — Place as clip writes a new copy`);
    } else if (clip.notes?.length || clip.meta?.kind === 'piano') {
      pianoApi.loadClip(track.id, clip.id);
      views.setMode('piano');
    }
  });

  const instrumentHooks = {
    armPattern(instId) {
      patternApi.armInstrument(instId);
      views.setMode('pattern');
    },
    armKit(kitId) {
      if (!getKit(kitId)) return;
      patternApi.armKit(kitId);
      views.setMode('pattern');
    },
    useInPiano(instId) {
      if (pianoApi.setInstrument(instId)) {
        views.setMode('piano');
        toast(`Piano roll instrument: ${getInstrument(instId)?.name}`);
      }
    },
  };

  mountMixer(document.querySelector('[data-mixer]'), engine, mixerFx, toast, history);

  mountLayout({
    app: deck,
    workspace: document.querySelector('[data-workspace]'),
    lib: document.querySelector('[data-library-panel]'),
    ai: document.querySelector('.ai-panel'),
    mixer: document.querySelector('[data-mixer]'),
    history,
    toast,
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
      <p class="panel-desc">Starters, demo packs, instruments &amp; your packs. Drag onto timeline.</p>
      <div class="lib-list" data-side-lib></div>
    `;
    const list = libPanel.querySelector('[data-side-lib]');
    if (!items.length) {
      list.innerHTML = '<div class="empty"><strong>No samples yet</strong><span>Use Synth or Generate to create one-shots, then drag them here onto the timeline.</span></div>';
      return;
    }
    list.innerHTML = items.map((s) => `
      <div class="lib-item" draggable="true" data-id="${s.id}" title="${s.source === 'starter' ? 'Starter one-shot — drag onto a track' : 'Drag onto timeline'}">
        <span class="lib-swatch" style="background:${s.color || '#F5C518'}"></span>
        <span class="lib-name">${s.name}</span>
        <span class="lib-meta">${({ starter: 'Starter', 'demo-pack': 'Demo pack', 'fl-import': 'Your pack', instrument: 'Instrument' })[s.source] || (s.source || 'Sample')}</span>
      </div>
    `).join('');
    list.querySelectorAll('.lib-item').forEach((el) => {
      el.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('application/x-mm-sample', el.dataset.id);
      });
    });
  }
  refreshLibraryPanel();
  // Materialize starter one-shot buffers so drag-to-timeline works immediately
  library.ensureBuffers?.(engine).then(() => refreshLibraryPanel()).catch(() => {});

  const panes = {
    aiproducer: document.querySelector('[data-pane="aiproducer"]'),
    stems: document.querySelector('[data-pane="stems"]'),
    beats: document.querySelector('[data-pane="beats"]'),
    loops: document.querySelector('[data-pane="loops"]'),
    drummer: document.querySelector('[data-pane="drummer"]'),
    a808: document.querySelector('[data-pane="808"]'),
    pedals: document.querySelector('[data-pane="pedals"]'),
    voice: document.querySelector('[data-pane="voice"]'),
    vocals: document.querySelector('[data-pane="vocals"]'),
    mic: document.querySelector('[data-pane="mic"]'),
    instruments: document.querySelector('[data-pane="instruments"]'),
    plugins: document.querySelector('[data-pane="plugins"]'),
    synth: document.querySelector('[data-pane="synth"]'),
    generate: document.querySelector('[data-pane="generate"]'),
    godmode: document.querySelector('[data-pane="godmode"]'),
  };

  if (panes.aiproducer) mountAiProducer(panes.aiproducer, engine, timelineApi, toast);
  let stemDnaApi = null;
  if (panes.stems) {
    mountStems(panes.stems, engine, toast);
    stemDnaApi = mountStemDna(panes.stems, engine, toast);
  }
  let beatsApi = null;
  let liveLoopsApi = null;
  let drummerApi = null;
  let pedalboardApi = null;
  const syncBeatsPattern = (pat) => { beatsApi?.setPattern?.(pat); };
  const openTab = (id) => { document.querySelector(`[data-tab="${id}"]`)?.click(); };
  if (panes.beats) beatsApi = mountBeats(panes.beats, engine, toast, getSelectedTrackId) || null;
  if (panes.loops) {
    liveLoopsApi = mountLiveLoops(panes.loops, engine, toast, {
      getSelectedTrackId,
      onPatternSync: syncBeatsPattern,
    });
  }
  if (panes.drummer) {
    drummerApi = mountVirtualDrummer(panes.drummer, engine, toast, {
      getSelectedTrackId,
      onPatternSync: syncBeatsPattern,
      patternApi,
      views,
    });
  }
  let atlanta808Api = null;
  if (panes.a808) {
    atlanta808Api = mountAtlanta808(panes.a808, engine, toast, { getSelectedTrackId });
  }
  if (panes.pedals) {
    pedalboardApi = mountPedalboard(panes.pedals, engine, toast, {
      inserts,
      getSelectedTrackId,
    });
  }
  let voiceAssistApi = null;
  if (panes.voice) {
    voiceAssistApi = mountVoiceAssist(panes.voice, engine, toast, {
      drummer: drummerApi,
      pedalboard: pedalboardApi,
      liveLoops: liveLoopsApi,
      beatsApi,
      patternApi,
      openTab,
    });
  }
  if (panes.vocals) mountVocals(panes.vocals, engine, toast, getSelectedTrackId);
  if (panes.mic) mountMic(panes.mic, engine, toast, getSelectedTrackId);
  if (panes.instruments) mountInstruments(panes.instruments, engine, library, toast, refreshLibraryPanel, instrumentHooks);
  if (panes.plugins) mountPluginsPacks(panes.plugins, engine, library, toast, refreshLibraryPanel, { ...instrumentHooks, inserts });
  if (panes.synth) mountSampleSynth(panes.synth, engine, library, toast, refreshLibraryPanel);
  if (panes.generate) mountGenerate(panes.generate, engine, library, toast, refreshLibraryPanel, getSelectedTrackId);
  // Session versions early so God Mode hub can snapshot on Apply
  const versions = createSessionVersions(engine, toast);

  if (panes.godmode) {
    // God Mode = Labs (Dice Forge · Tradingfloor Form) + live God Mode hub
    panes.godmode.innerHTML = `
      <div class="gm-labs-nav view-seg" role="tablist" aria-label="God Mode sections">
        <button type="button" role="tab" class="active" aria-selected="true" data-gm-sub="dice">🎲 Dice Forge</button>
        <button type="button" role="tab" aria-selected="false" data-gm-sub="form">Tradingfloor Form</button>
        <button type="button" role="tab" aria-selected="false" data-gm-sub="ideas">God Mode</button>
      </div>
      <div data-gm-section="dice"></div>
      <div data-gm-section="form" hidden></div>
      <div data-gm-section="ideas" hidden></div>`;
    const showSub = (id) => {
      panes.godmode.querySelectorAll('[data-gm-sub]').forEach((b) => { const on = b.dataset.gmSub === id; b.classList.toggle('active', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
      panes.godmode.querySelectorAll('[data-gm-section]').forEach((el) => { el.hidden = el.dataset.gmSection !== id; });
    };
    panes.godmode.querySelector('.gm-labs-nav').addEventListener('click', (e) => { const b = e.target.closest('[data-gm-sub]'); if (b) showSub(b.dataset.gmSub); });
    const openGodmode = (sub) => { document.querySelector('[data-tab="godmode"]')?.click(); showSub(sub); };
    try {
      diceApi = mountDiceForge(panes.godmode.querySelector('[data-gm-section="dice"]'), engine, toast, { patternApi, pianoApi, views, timelineApi, history });
    } catch (e) { console.warn('[Sound Deck] dice forge', e); }
    try {
      mountTradingfloorForm(timelineRoot, panes.godmode.querySelector('[data-gm-section="form"]'), engine, toast, {
        history, views, openPanel: () => openGodmode('form'), rollDice: (p) => diceApi?.roll(p),
      });
    } catch (e) { console.warn('[Sound Deck] tradingfloor form', e); }
    try {
      mountGodmodeIdeas(panes.godmode.querySelector('[data-gm-section="ideas"]'), {
        engine,
        toast,
        inserts,
        stemDna: stemDnaApi,
        sessionVersions: versions,
        liveLoops: liveLoopsApi,
        beats: beatsApi,
        getSelectedTrackId,
      });
    } catch (e) { console.warn('[Sound Deck] god mode hub', e); }
    try {
      if (typeof focusGodFeature === 'function') {
        window.focusGodFeature = focusGodFeature;
      }
    } catch (_) { /* ignore */ }
  }

  document.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-tab]').forEach((b) => {
        const on = b === btn;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      Object.entries(panes).forEach(([key, el]) => {
        // key 'a808' ↔ tab '808': match on the pane's own data-pane, not the object key
        if (el) el.hidden = (el.dataset.pane || key) !== btn.dataset.tab;
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
      if (e.target.closest?.('button')) e.target.blur();
      const mode = views.getMode();
      if (mode === 'pattern') { await patternApi.toggle(); return; }
      if (mode === 'piano') { await pianoApi.toggle(); return; }
      if (engine.isPlaying) engine.pause();
      else await engine.play();
    } else if ((e.key === 's' || e.key === 'S') && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      patternApi.stop();
      pianoApi.stop();
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

  // —— Feature pack: UX polish · Ghost · Co-producer · Session versions ——
  try { mountUxPolish(deck, toast); } catch (e) { console.warn('[Sound Deck] ux polish', e); }
  try {
    const { mountNightShiftSurface } = await import('./modules/night-shift-surface.js?v=20261007l-sxs20261020b');
    mountNightShiftSurface(deck, toast);
  } catch (e) { console.warn('[Sound Deck] night-shift surface', e); }

  // session versions created earlier for God Mode hub ctx
  hooks.onSessionSnap = (label) => versions.push(label);

  // Dock Ghost + Versions as ONE whole strip (blue line + Ghost + Versions collapse together)
  const mixerWrap = document.querySelector('[data-sx-mixer-wrap]') || document.querySelector('[data-mixer]');
  const { wrap: featureDockWrap, dock: featureDock } = createFeatureDock(mixerWrap, deck);
  try {
    mountFeatureDockCollapse(featureDockWrap, { toast });
  } catch (e) { console.warn('[Sound Deck] feature-dock collapse', e); }

  try {
    mountGhostLayer(featureDock.querySelector('[data-sx-dock-ghost]'), engine, toast);
  } catch (e) { console.warn('[Sound Deck] ghost', e); }
  try {
    mountSessionVersions(featureDock.querySelector('[data-sx-dock-versions]'), versions, toast);
  } catch (e) { console.warn('[Sound Deck] versions', e); }

  try {
    mountCoProducer(deck, engine, toast, { openTab });
  } catch (e) { console.warn('[Sound Deck] co-producer', e); }

  try {
    const { mountMultideviceHost } = await import('./modules/multidevice-host.js?v=20261008md-sxs20261020b');
    mountMultideviceHost(engine, toast, {
      liveLoops: liveLoopsApi,
      beatsApi,
      patternApi,
      atlanta808Api,
      voiceAssist: voiceAssistApi,
      drummer: drummerApi,
      openTab,
    });
  } catch (e) { console.warn('[Sound Deck] multidevice optional', e); }

  await engine.init();
  setStatus('Ready · Space play · 808 · Export · Ghost · Versions · Stem DNA');
  toast('SoundX ready — tip: Export ▾ for WAV / FLAC / MP3 / Ogg');
  try { mountDeckWalkthrough(engine); } catch (e) { console.warn('[Sound Deck] walkthrough', e); }
  showFirstRunTip(engine);
}

boot().catch((err) => {
  console.error(err);
  setStatus('Boot error — see console');
});
