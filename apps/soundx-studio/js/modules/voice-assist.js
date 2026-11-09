import { setTheme, setAccent, resolveThemePhrase, THEMES } from './themes.js?v=20261007i-sxs20261020b';
/**
 * Voice Assist · Mercatus Bot — mic → STT → intent → SoundX actions.
 * STT: Web Speech API (SpeechRecognition / webkitSpeechRecognition).
 * Intent: POST same-origin /api/cartel/ when healthy; else LOCAL keyword/regex parser.
 * Never auto-sends email or navigates away. LIVE/LOCAL pill is honest.
 */


function abortAfter(ms) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  const c = typeof AbortController !== 'undefined' ? new AbortController() : null;
  if (c) setTimeout(() => c.abort(), ms);
  return c?.signal;
}

const CARTEL_API = '/api/cartel/index.php?path=';
const SYSTEM_HINT = `You are Mercatus Bot for Mens Mercatus SoundX.
Reply with ONLY a JSON object (no markdown) of the form:
{"commands":[{"action":"...","params":{...}}],"say":"short confirmation"}
Allowed actions: play, stop, pause, set_bpm, make_beat, add_bassline, set_genre, drummer_generate,
fx_engage, fx_bump, trigger_loop, launch_scene, load_demo, set_intensity, set_theme, set_accent, help.
params examples: {"bpm":120}, {"genre":"amapiano"}, {"type":"space","delta":0.15}, {"scene":1}, {"lane":"kick","col":0}, {"theme":"ableton-dark"|"light"|"high-contrast"}, {"accent":"#F5C518"}.
Genres: house, hiphop, amapiano, afrobeat, rock, electronic.
FX types: space, delay, drive, filter, comp.
Keep say under 12 words. Do not send email or leave SoundX.`;

/** Robust LOCAL command parser — same command set as LIVE. */
export function parseLocalVoice(text) {
  const t = String(text || '').trim().toLowerCase();
  if (!t) return { commands: [], say: 'Say something — play, make a beat, more reverb…', source: 'local' };

  const commands = [];
  let say = '';

  if (/\b(stop|halt)\b/.test(t) && !/\bstop\s*loop/.test(t)) {
    commands.push({ action: 'stop' });
    say = 'Stopping.';
  } else if (/\bpause\b/.test(t)) {
    commands.push({ action: 'pause' });
    say = 'Paused.';
  } else if (/\b(play|start|go)\b/.test(t)) {
    commands.push({ action: 'play' });
    say = 'Playing.';
  }

  const bpmM = t.match(/\b(?:set\s+)?bpm\s*(?:to\s*)?(\d{2,3})\b/) || t.match(/\b(\d{2,3})\s*bpm\b/);
  if (bpmM) {
    commands.push({ action: 'set_bpm', params: { bpm: Number(bpmM[1]) } });
    say = `BPM ${bpmM[1]}.`;
  }

  const genreMap = [
    [/amapiano/, 'amapiano'],
    [/afrobeat|afro beat/, 'afrobeat'],
    [/hip[- ]?hop|boom\s*bap/, 'hiphop'],
    [/\bhouse\b/, 'house'],
    [/\brock\b/, 'rock'],
    [/electronic|edm|techno|trap/, 'electronic'],
  ];
  for (const [re, id] of genreMap) {
    if (re.test(t) && (/switch|genre|drummer|style|make|set|to\b/.test(t) || /amapiano|afrobeat/.test(t))) {
      commands.push({ action: 'set_genre', params: { genre: id } });
      commands.push({ action: 'drummer_generate' });
      say = `Virtual Drummer · ${id}.`;
      break;
    }
  }

  if (/\b(make a beat|make beat|add (a )?beat|add drums|new beat|drum pattern)\b/.test(t) ||
      (/\bbeat\b/.test(t) && /\b(make|generate|add|drop)\b/.test(t))) {
    if (!commands.some((c) => c.action === 'drummer_generate')) {
      commands.push({ action: 'drummer_generate' });
      commands.push({ action: 'make_beat' });
      say = say || 'Generating a beat.';
    }
  }

  if (/\b(add (a )?bass|bassline|bass line)\b/.test(t)) {
    commands.push({ action: 'add_bassline' });
    say = say || 'Adding a bassline.';
  }

  if (/\b(more|turn up|add|increase)\b.*\b(reverb|space)\b|\breverb\b.*\b(up|more)\b|\badd reverb\b/.test(t)) {
    commands.push({ action: 'fx_bump', params: { type: 'space', delta: 0.15 } });
    say = say || 'More space (reverb).';
  }
  if (/\b(less|turn down|kill)\b.*\b(reverb|space)\b/.test(t)) {
    commands.push({ action: 'fx_bump', params: { type: 'space', delta: -0.2 } });
    say = say || 'Less reverb.';
  }
  if (/\b(more|turn up|add|increase)\b.*\bdelay\b|\bdelay\b.*\b(up|more)\b|\badd delay\b/.test(t)) {
    commands.push({ action: 'fx_bump', params: { type: 'delay', delta: 0.15 } });
    say = say || 'More delay.';
  }
  if (/\b(add |more |turn on )?(distortion|drive|overdrive)\b/.test(t)) {
    commands.push({ action: 'fx_engage', params: { type: 'drive', amount: 0.55 } });
    say = say || 'Drive on.';
  }
  if (/\b(more |add )?filter\b|\bopen (the )?filter\b/.test(t)) {
    commands.push({ action: 'fx_bump', params: { type: 'filter', delta: 0.12 } });
    say = say || 'Filter nudged.';
  }

  const sceneM = t.match(/\b(?:launch|trigger)\s+(?:scene\s+)?(\d)\b/) || t.match(/\bscene\s+(\d)\b/);
  if (sceneM) {
    commands.push({ action: 'launch_scene', params: { scene: Number(sceneM[1]) } });
    say = say || `Launching scene ${sceneM[1]}.`;
  }
  if (/\btrigger loop\b|\btrigger (a )?cell\b|\blive loops?\b/.test(t) && !sceneM) {
    commands.push({ action: 'trigger_loop', params: { lane: 'kick', col: 0 } });
    commands.push({ action: 'launch_scene', params: { scene: 1 } });
    say = say || 'Arming Live Loops scene 1.';
  }

  if (/\b(load )?demo\b/.test(t)) {
    commands.push({ action: 'load_demo' });
    say = say || 'Loading demo.';
  }

  // Theme / accent
  if (/\b(theme|dark mode|light mode|high[- ]?contrast)\b/.test(t) ||
      (/\b(switch|set|use|change)\b/.test(t) && /\b(ableton|dark|light|accent|gold|teal|violet|rose)\b/.test(t))) {
    const hit = resolveThemePhrase(t);
    if (hit?.theme) {
      commands.push({ action: 'set_theme', params: { theme: hit.theme } });
      const lab = THEMES.find((x) => x.id === hit.theme)?.label || hit.theme;
      say = `Theme ${lab}.`;
    } else if (hit?.accent) {
      commands.push({ action: 'set_accent', params: { accent: hit.accent } });
      say = `Accent ${hit.accent}.`;
    } else if (/\btheme\b/.test(t)) {
      commands.push({ action: 'set_theme', params: { theme: 'ableton-dark' } });
      say = 'Ableton Dark theme.';
    }
  }

  if (/\bhelp\b|\bwhat can you\b|\bcommands\b/.test(t)) {
    commands.push({ action: 'help' });
    say = 'Play, stop, BPM, make a beat, theme light, accent teal, Amapiano, more reverb, launch scene 1.';
  }

  if (!commands.length) {
    return {
      commands: [{ action: 'help' }],
      say: 'Didn’t catch a SoundX command — try “make a beat” or “play”.',
      source: 'local',
    };
  }
  return { commands, say: say || 'On it.', source: 'local' };
}

async function checkCartelHealth() {
  try {
    const res = await fetch(`${CARTEL_API}/health`, { cache: 'no-store', signal: abortAfter(4000) });
    if (!res.ok) return { ok: false };
    const data = await res.json().catch(() => ({}));
    return { ok: true, data };
  } catch (_) {
    return { ok: false };
  }
}

async function cartelIntent(transcript) {
  const url = `${CARTEL_API}/api/mercatus-cartel/chat`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `${SYSTEM_HINT}\n\nUser said: ${transcript}`,
      history: [],
    }),
    signal: abortAfter(12000),
  });
  if (!res.ok) throw new Error(`cartel ${res.status}`);
  const data = await res.json();
  const reply = data.reply || data.message || data.content || '';
  const jsonMatch = String(reply).match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('no json');
  const parsed = JSON.parse(jsonMatch[0]);
  if (!parsed.commands) throw new Error('no commands');
  return { commands: parsed.commands, say: parsed.say || 'Done.', source: 'live' };
}

export function mountVoiceAssist(root, engine, toast, apis = {}) {
  const {
    drummer,
    pedalboard,
    liveLoops,
    beatsApi,
    patternApi,
    openTab,
  } = apis;

  let listening = false;
  let recognition = null;
  let mode = 'local'; // 'live' | 'local'
  let lastTranscript = '';

  root.innerHTML = `
    <div class="panel-head">
      <h2>Voice Assist</h2>
      <span class="badge" data-va-pill title="LIVE = Mercatus Blueprint /api/cartel/ · LOCAL = in-browser parser">LOCAL</span>
    </div>
    <p class="panel-desc"><strong>Mercatus Bot</strong> listens in this tab — speak a command, see the transcript, watch SoundX react. Uses Web Speech API for STT. LIVE when Blueprint Assist is healthy; otherwise the same commands run through the LOCAL parser. Never leaves SoundX or sends mail.</p>

    <div class="va-controls">
      <button type="button" class="btn primary va-mic" data-va-listen aria-pressed="false">🎙 Listen</button>
      <button type="button" class="btn ghost" data-va-health>Check Assist</button>
      <button type="button" class="btn ghost" data-va-stop-listen hidden>Stop</button>
    </div>

    <div class="va-transcript" data-va-transcript aria-live="polite">
      <span class="va-label">Transcript</span>
      <p data-va-text>Tap Listen, then say “make a beat”, “switch to Amapiano”, “turn up reverb”, “play”, or “set BPM 120”.</p>
    </div>

    <div class="va-log" data-va-log aria-live="polite"></div>

    <div class="va-chips" role="group" aria-label="Try these">
      ${['make a beat', 'switch to Amapiano', 'turn up reverb', 'more delay', 'add distortion', 'play', 'stop', 'set BPM 120', 'launch scene 1', 'theme blink', 'theme night shift', 'theme flower house', 'theme light', 'high contrast', 'accent teal'].map((c) =>
        `<button type="button" class="btn sm ghost" data-va-chip="${c}">${c}</button>`
      ).join('')}
    </div>
    <div class="stem-status" data-va-status>Voice Assist · Mercatus Bot · LOCAL parser ready</div>
  `;

  const pill = root.querySelector('[data-va-pill]');
  const textEl = root.querySelector('[data-va-text]');
  const logEl = root.querySelector('[data-va-log]');
  const status = root.querySelector('[data-va-status]');
  const listenBtn = root.querySelector('[data-va-listen]');
  const stopBtn = root.querySelector('[data-va-stop-listen]');

  function setMode(next, detail) {
    mode = next;
    pill.textContent = next === 'live' ? 'LIVE' : 'LOCAL';
    pill.classList.toggle('warn', next !== 'live');
    pill.classList.toggle('live', next === 'live');
    status.textContent = next === 'live'
      ? `Voice Assist · Mercatus Bot · LIVE · /api/cartel/${detail ? ' · ' + detail : ''}`
      : 'Voice Assist · Mercatus Bot · LOCAL parser (Blueprint Assist unreachable)';
  }

  function log(msg, kind = 'bot') {
    const row = document.createElement('div');
    row.className = `va-msg va-msg--${kind}`;
    row.textContent = msg;
    logEl.appendChild(row);
    logEl.scrollTop = logEl.scrollHeight;
  }

  async function refreshHealth() {
    status.textContent = 'Checking /api/cartel/ health…';
    const h = await checkCartelHealth();
    setMode(h.ok ? 'live' : 'local', h.ok ? 'ok' : '');
    toast(h.ok ? 'Blueprint Assist reachable — LIVE intent' : 'Blueprint offline — LOCAL parser', h.ok ? 'info' : 'warn');
    return h.ok;
  }

  async function resolveIntent(transcript) {
    if (mode === 'live') {
      try {
        return await cartelIntent(transcript);
      } catch (err) {
        log(`LIVE intent failed (${err.message}) — using LOCAL parser`, 'sys');
        setMode('local');
      }
    }
    return parseLocalVoice(transcript);
  }

  async function execute(plan) {
    const cmds = plan.commands || [];
    for (const cmd of cmds) {
      const a = cmd.action;
      const p = cmd.params || {};
      try {
        if (a === 'play') {
          await engine.init();
          await engine.play();
        } else if (a === 'stop') {
          liveLoops?.stop?.();
          engine.stop();
        } else if (a === 'pause') {
          if (engine.isPlaying) engine.pause();
        } else if (a === 'set_bpm' && p.bpm) {
          engine.setBpm(Math.max(40, Math.min(240, Number(p.bpm))));
        } else if (a === 'set_genre' && p.genre) {
          openTab?.('drummer');
          drummer?.setGenre?.(p.genre);
          const g = drummer?.genres?.find((x) => x.id === p.genre);
          if (g?.bpm) engine.setBpm(g.bpm);
        } else if (a === 'set_intensity' && p.value != null) {
          drummer?.setIntensity?.(Number(p.value));
        } else if (a === 'drummer_generate' || a === 'make_beat') {
          openTab?.('drummer');
          const r = drummer?.generate?.();
          if (a === 'make_beat') await drummer?.writeToTrack?.();
          if (!r && beatsApi) {
            // fallback: basic pattern into beats
            beatsApi.setPattern?.({
              kick: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
              snare: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
              hat: Array(16).fill(false).map((_, i) => i % 2 === 0),
              perc: Array(16).fill(false),
            });
          }
        } else if (a === 'add_bassline') {
          openTab?.('aiproducer');
          // Lightweight bass stub on Bass track
          await engine.init();
          const bass = engine.tracks.find((t) => /bass/i.test(t.name)) || engine.tracks[1];
          if (bass) {
            const buf = engine.createBufferFromRecipe({ type: 'tone', freq: 55, duration: 0.4 });
            [0, 4, 8, 12].forEach((step) => {
              engine.addClip(bass.id, {
                name: 'Voice bass',
                startBeat: step * 0.25,
                durationBeats: 0.5,
                color: '#DAA520',
                buffer: buf,
                recipe: { type: 'tone', freq: 55, duration: 0.4 },
              });
            });
            toast('Bassline stub on Bass track');
          }
        } else if (a === 'fx_engage') {
          openTab?.('pedals');
          await engine.init();
          if (!pedalboard?.getTarget || insertsEmpty()) pedalboard?.seedDefaults?.();
          pedalboard?.engage?.(p.type || 'space', p.amount ?? 0.5);
        } else if (a === 'fx_bump') {
          openTab?.('pedals');
          await engine.init();
          if (insertsEmpty()) await pedalboard?.seedDefaults?.();
          pedalboard?.bump?.(p.type || 'space', p.delta ?? 0.1);
        } else if (a === 'launch_scene') {
          openTab?.('loops');
          const scene = Math.max(1, Math.min(8, Number(p.scene) || 1));
          // Arm a sensible default column if empty
          ['kick', 'snare', 'hat'].forEach((lane) => liveLoops?.arm?.(lane, scene - 1, true));
          await liveLoops?.launchScene?.(scene - 1);
        } else if (a === 'trigger_loop') {
          openTab?.('loops');
          liveLoops?.arm?.(p.lane || 'kick', p.col ?? 0, true);
        } else if (a === 'load_demo') {
          await engine.init();
          engine.loadDemoProject();
          window.dispatchEvent(new CustomEvent('mm-sound-deck-demo-loaded'));
        } else if (a === 'set_theme' && p.theme) {
          setTheme(p.theme, toast);
        } else if (a === 'set_accent' && (p.accent || p.hex || p.color)) {
          setAccent(p.accent || p.hex || p.color, toast);
        } else if (a === 'help') {
          /* say handles it */
        }
      } catch (err) {
        log(`Command ${a} failed: ${err.message}`, 'sys');
      }
    }
    if (plan.say) log(`${plan.source === 'live' ? 'LIVE' : 'LOCAL'} · ${plan.say}`, 'bot');
  }

  function insertsEmpty() {
    try {
      return !engine.inserts?.list?.('master')?.length;
    } catch (_) {
      return true;
    }
  }

  async function handleUtterance(transcript) {
    lastTranscript = transcript;
    textEl.textContent = transcript;
    log(`You · ${transcript}`, 'user');
    const plan = await resolveIntent(transcript);
    await execute(plan);
  }

  function getRecognition() {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return null;
    const r = new Ctor();
    r.lang = 'en-ZA';
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    return r;
  }

  function stopListening() {
    listening = false;
    listenBtn.setAttribute('aria-pressed', 'false');
    listenBtn.classList.remove('listening');
    listenBtn.textContent = '🎙 Listen';
    stopBtn.hidden = true;
    try { recognition?.stop(); } catch (_) {}
    recognition = null;
  }

  function startListening() {
    const r = getRecognition();
    if (!r) {
      toast('Web Speech API not available in this browser — use the chips', 'warn');
      status.textContent = 'No SpeechRecognition — type via chips or Chrome/Edge';
      return;
    }
    recognition = r;
    listening = true;
    listenBtn.setAttribute('aria-pressed', 'true');
    listenBtn.classList.add('listening');
    listenBtn.textContent = '● Listening…';
    stopBtn.hidden = false;
    status.textContent = `Listening · ${mode.toUpperCase()} · speak now`;

    let finalText = '';
    r.onresult = (ev) => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const piece = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) finalText += piece;
        else interim += piece;
      }
      textEl.textContent = finalText || interim || '…';
    };
    r.onerror = (ev) => {
      log(`STT: ${ev.error}`, 'sys');
      stopListening();
      if (ev.error === 'not-allowed') toast('Allow microphone for Voice Assist', 'warn');
    };
    r.onend = () => {
      const said = finalText.trim();
      stopListening();
      if (said) handleUtterance(said);
      else status.textContent = `Voice Assist · Mercatus Bot · ${mode.toUpperCase()} · no speech captured`;
    };
    try {
      r.start();
    } catch (err) {
      stopListening();
      toast('Could not start speech recognition', 'error');
    }
  }

  listenBtn.addEventListener('click', () => {
    if (listening) stopListening();
    else startListening();
  });
  stopBtn.addEventListener('click', stopListening);
  root.querySelector('[data-va-health]').addEventListener('click', refreshHealth);
  root.querySelector('.va-chips').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-va-chip]');
    if (chip) handleUtterance(chip.dataset.vaChip);
  });

  // Initial health probe (non-blocking)
  refreshHealth().catch(() => setMode('local'));

  return {
    handleUtterance,
    parseLocalVoice,
    refreshHealth,
    getMode: () => mode,
  };
}
