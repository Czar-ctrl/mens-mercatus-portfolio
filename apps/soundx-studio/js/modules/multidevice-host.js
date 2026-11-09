/**
 * SoundX multi-device host — pairs the deck with phone pads / phone mic.
 *
 * Links (used together, de-duplicated):
 *  - Online room (default): public wss relay on api.mensmercatus.online, paired by a short room code / QR.
 *  - LAN hub: ws://MAC_IP:8791/ws (only from the local/desktop build — https pages cannot open ws://).
 *  - Same device: BroadcastChannel — the Controller / Mic opened in another tab of this browser.
 * Receives pad / pattern / scene / transport / voice text / mic clips. Uses live-loops public API only.
 */
import { previewNote, getKit } from './instruments.js?v=20261006p-sxs20261020b';
import { parseLocalVoice } from './voice-assist.js?v=20261007a-sxs20261020b';
import { createLink, makeRoomCode, normRoom, lanDefault, RELAY_URL, LAN_PORT } from '../link/sx-link.js?v=20261008md-sxs20261020b';
import { drawQr } from '../vendor/qr-arase.js?v=20261008md-sxs20261020b';

const STORE_LAN = 'mm-soundx-hub-ws';
const STORE_ROOM = 'mm-soundx-room';
const STORE_MODE = 'mm-soundx-link-mode';

function ls(k, v) {
  try {
    if (v === undefined) return localStorage.getItem(k);
    localStorage.setItem(k, v);
  } catch {}
  return null;
}
function servedByLanHub() {
  return location.protocol === 'http:' && (location.port === String(LAN_PORT));
}

/**
 * @param {object} engine AudioEngine
 * @param {function} toast
 * @param {object} apis { liveLoops, beatsApi, patternApi, atlanta808Api, voiceAssist, drummer, openTab }
 */
export function mountMultideviceHost(engine, toast, apis = {}) {
  const { liveLoops, beatsApi, patternApi, atlanta808Api, voiceAssist, drummer, openTab } = apis;

  let room = normRoom(ls(STORE_ROOM)) || makeRoomCode();
  ls(STORE_ROOM, room);
  let mode = ls(STORE_MODE) || (servedByLanHub() ? 'lan' : 'relay');
  if (!['relay', 'lan', 'off'].includes(mode)) mode = 'relay';
  let lanUrl = ls(STORE_LAN) || lanDefault();
  if (/^ws:\/\/127\.0\.0\.1:8791\/ws$/.test(lanUrl) && servedByLanHub()) lanUrl = lanDefault();

  let barEl = null;
  let lastSt = null;
  const log = [];
  const micParts = new Map();
  let lastStt = { text: '', t: 0 };

  function el(sel) { return barEl?.querySelector(sel); }

  function ensureBar() {
    if (barEl) return barEl;
    barEl = document.createElement('div');
    barEl.className = 'sx-multidevice-bar';
    barEl.innerHTML = `
      <span class="sx-md-dot" data-md-dot></span>
      <span class="sx-md-status" data-md-status>Multi-device · starting…</span>
      <select data-md-mode title="How phones reach this deck">
        <option value="relay">Online room</option>
        <option value="lan">LAN hub</option>
        <option value="off">Off</option>
      </select>
      <span class="sx-md-room" data-md-roomwrap title="Room code — type it on the phone, or scan the QR">Room <b data-md-room></b>
        <button type="button" class="btn sm ghost" data-md-newroom title="New room code">↻</button></span>
      <input type="text" data-md-url title="LAN hub WebSocket URL" placeholder="ws://MAC_IP:8791/ws" />
      <button type="button" class="btn sm ghost" data-md-connect>Connect hub</button>
      <button type="button" class="btn sm ghost" data-md-qr title="Pair a phone (QR)">Pair phone</button>
      <a class="btn sm ghost" data-md-ctrl href="controller/" target="_blank" rel="noopener">Controller</a>
      <a class="btn sm ghost" data-md-mic href="mic/" target="_blank" rel="noopener">Mic</a>
      <div class="sx-md-pop" data-md-pop hidden>
        <div class="sx-md-pop-head"><b>Pair a phone</b><button type="button" class="btn sm ghost" data-md-popclose>✕</button></div>
        <div class="sx-md-pop-tabs"><button type="button" class="btn sm active" data-md-qrkind="controller">Pads</button><button type="button" class="btn sm ghost" data-md-qrkind="mic">Mic</button></div>
        <canvas data-md-qrcanvas width="180" height="180"></canvas>
        <p class="sx-md-code">Room <b data-md-room2></b></p>
        <p class="sx-md-fine" data-md-qrurl></p>
        <p class="sx-md-fine">Scan with the phone camera (any network — no Wi‑Fi pairing needed), or open <b>mensmercatus.online/apps/soundx-studio/controller/</b> and type the room code. Same computer: just click <b>Controller</b>.</p>
      </div>
    `;
    const style = document.createElement('style');
    style.textContent = `
      .sx-multidevice-bar { position: relative; display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
        padding: 6px 10px; background: rgba(20,16,8,0.92); border-bottom: 1px solid rgba(245,197,24,0.2);
        font-size: 12px; color: #c9b87a; z-index: 40; }
      .sx-multidevice-bar input, .sx-multidevice-bar select { background: #1a150c; border: 1px solid #3a3018; color: #f3e9c8;
        border-radius: 6px; padding: 4px 8px; font-size: 11px; }
      .sx-multidevice-bar input { flex: 1; min-width: 160px; max-width: 260px; }
      .sx-multidevice-bar[data-mode="relay"] [data-md-url], .sx-multidevice-bar[data-mode="off"] [data-md-url] { display: none; }
      .sx-multidevice-bar[data-mode="lan"] [data-md-roomwrap] { opacity: .65; }
      .sx-md-room b { font-family: ui-monospace, monospace; letter-spacing: 2px; color: #f5c518; font-size: 13px; }
      .sx-md-status { min-width: 180px; }
      .sx-md-dot { width: 8px; height: 8px; border-radius: 50%; background: #e85d5d; flex: 0 0 auto; }
      .sx-md-dot.on { background: #3dd68c; box-shadow: 0 0 6px #3dd68c; }
      .sx-md-dot.wait { background: #f5c518; }
      .sx-md-pop { position: absolute; top: 100%; right: 10px; margin-top: 4px; width: 250px; padding: 10px; z-index: 60;
        background: #120f08; border: 1px solid rgba(245,197,24,.35); border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,.6); }
      .sx-md-pop[hidden] { display: none; }
      .sx-md-pop-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; color: #f3e9c8; }
      .sx-md-pop-tabs { display: flex; gap: 6px; margin-bottom: 8px; }
      .sx-md-pop canvas { display: block; margin: 0 auto; width: 180px; height: 180px; border-radius: 6px; background: #fff; }
      .sx-md-code { text-align: center; margin: 8px 0 4px; } .sx-md-code b { font: 700 20px ui-monospace, monospace; letter-spacing: 4px; color: #f5c518; }
      .sx-md-fine { font-size: 10.5px; line-height: 1.35; color: #a8996a; margin: 4px 0 0; word-break: break-all; }
    `;
    document.head.appendChild(style);
    const deck = document.querySelector('[data-deck]') || document.body;
    const nav = deck.querySelector('.mm-four-strip');
    if (nav?.nextSibling) deck.insertBefore(barEl, nav.nextSibling);
    else deck.insertBefore(barEl, deck.firstChild);

    el('[data-md-mode]').value = mode;
    barEl.dataset.mode = mode;
    el('[data-md-url]').value = lanUrl;
    el('[data-md-mode]').addEventListener('change', (e) => setMode(e.target.value));
    el('[data-md-newroom]').addEventListener('click', () => {
      room = makeRoomCode(); ls(STORE_ROOM, room);
      link.configure({ room });
      refreshLinks();
      toast(`New room ${room} — re-scan the QR on your phone`);
    });
    el('[data-md-connect]').addEventListener('click', () => {
      const typed = el('[data-md-url]').value.trim();
      // Back-compat: a ws:// URL typed while in Online mode means "use the LAN hub".
      if (mode !== 'lan' && /^wss?:\/\//.test(typed) && typed !== lanUrl) setMode('lan');
      if (mode === 'off') setMode('relay');
      if (mode === 'lan') { lanUrl = el('[data-md-url]').value.trim() || lanDefault(); ls(STORE_LAN, lanUrl); link.configure({ lanUrl }); }
      link.start();
    });
    el('[data-md-url]').addEventListener('change', () => { lanUrl = el('[data-md-url]').value.trim(); ls(STORE_LAN, lanUrl); refreshLinks(); });
    el('[data-md-qr]').addEventListener('click', () => { const p = el('[data-md-pop]'); p.hidden = !p.hidden; if (!p.hidden) drawPairQr('controller'); });
    el('[data-md-popclose]').addEventListener('click', () => { el('[data-md-pop]').hidden = true; });
    // close the pairing popover on outside press / Escape so it never sits over Export etc.
    document.addEventListener('pointerdown', (e) => {
      const pop = el('[data-md-pop]');
      if (pop && !pop.hidden && !barEl.contains(e.target)) pop.hidden = true;
    }, true);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const pop = el('[data-md-pop]'); if (pop) pop.hidden = true; } });
    barEl.querySelectorAll('[data-md-qrkind]').forEach((b) => b.addEventListener('click', () => {
      barEl.querySelectorAll('[data-md-qrkind]').forEach((x) => { x.classList.toggle('active', x === b); x.classList.toggle('ghost', x !== b); });
      drawPairQr(b.dataset.mdQrkind);
    }));
    return barEl;
  }

  const PUBLIC_BASE = 'https://mensmercatus.online/apps/soundx-studio/';
  /** Desktop app / localhost builds: phones cannot open localhost, so QR codes use the public pages. */
  function phoneBase() {
    const h = location.hostname;
    if (location.protocol === 'file:' || h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '') return PUBLIC_BASE;
    return location.href;
  }
  function pageUrl(kind, forPhone = false) {
    const u = new URL(`${kind}/`, forPhone && mode !== 'lan' ? phoneBase() : location.href);
    u.search = '';
    u.hash = '';
    if (mode === 'lan') {
      const m = /^wss?:\/\/([^/]+)/.exec(lanUrl || '');
      if (m) u.searchParams.set('hub', m[1]);
    }
    u.searchParams.set('room', room);
    return u.href;
  }
  function refreshLinks() {
    if (!barEl) return;
    el('[data-md-room]').textContent = room;
    el('[data-md-room2]').textContent = room;
    el('[data-md-ctrl]').href = pageUrl('controller');
    el('[data-md-mic]').href = pageUrl('mic');
    const pop = el('[data-md-pop]');
    if (pop && !pop.hidden) drawPairQr(barEl.querySelector('[data-md-qrkind].active')?.dataset.mdQrkind || 'controller');
  }
  function drawPairQr(kind) {
    const url = pageUrl(kind, true);
    try { drawQr(el('[data-md-qrcanvas]'), url, { size: 180 }); } catch (e) { console.warn('[multidevice] qr', e); }
    el('[data-md-qrurl]').textContent = url;
  }

  function setMode(m) {
    mode = ['relay', 'lan', 'off'].includes(m) ? m : 'relay';
    ls(STORE_MODE, mode);
    if (barEl) { barEl.dataset.mode = mode; el('[data-md-mode]').value = mode; }
    if (mode === 'off') { link.stop(); }
    else { link.configure({ mode, lanUrl, room }); link.start(); }
    refreshLinks();
  }

  function renderStatus(st) {
    lastSt = st;
    if (!barEl) return;
    let text; let cls = '';
    const via = st.mode === 'lan' ? 'LAN hub' : 'Online room';
    const same = st.bcOthers ? ` · ${st.bcOthers} same-device tab(s)` : '';
    if (!st.enabled || st.ws === 'off') { text = 'Multi-device · off'; }
    else if (st.ws === 'open') {
      cls = st.devices ? 'on' : 'wait';
      text = st.devices ? `${via} ${st.room} · ${st.devices} phone/tab linked` : `${via} ${st.room} · waiting for phone…`;
    } else if (st.ws === 'blocked') {
      cls = st.bcOthers ? 'wait' : '';
      text = `LAN hub blocked on https${same} — use Online room`;
    } else if (st.ws === 'connecting') { text = `${via} · connecting…`; }
    else { text = `${via} · ${st.wsError || 'offline'} — retrying${same}`; cls = st.bcOthers ? 'wait' : ''; }
    el('[data-md-status]').textContent = text;
    el('[data-md-status]').title = st.wsError || st.wsUrl || '';
    const dot = el('[data-md-dot]');
    dot.classList.toggle('on', cls === 'on');
    dot.classList.toggle('wait', cls === 'wait');
    el('[data-md-connect]').textContent = st.ws === 'open' ? 'Connected ✓' : 'Connect hub';
  }

  function note(text) {
    log.push({ t: Date.now(), text });
    if (log.length > 60) log.shift();
    if (barEl) el('[data-md-status]').textContent = text;
  }

  function flashPad(pad, inst) {
    window.dispatchEvent(new CustomEvent('mm-soundx-remote-pad', { detail: { pad, inst } }));
  }
  function hostState(extra = {}) {
    link.send({ type: 'host_state', playing: !!engine.isPlaying, bpm: engine.bpm, ...extra });
  }

  async function handlePad(msg) {
    await engine.init();
    await engine.resume?.();
    const v = Number(msg.velocity);
    const vel = Math.max(0.05, Math.min(1, Number.isFinite(v) ? v : 0.9));
    const inst = String(msg.inst || 'kick');
    const midi = Number.isFinite(Number(msg.midi)) ? Number(msg.midi) : 36;
    previewNote(engine, inst, { midi, gain: vel, durSec: 0.5 });
    flashPad(msg.pad, inst);
    note(`Pad ${msg.pad ?? '?'} · ${inst} · vel ${vel.toFixed(2)}`);
  }

  async function handlePattern(msg) {
    const id = msg.patternId;
    if (!id) return;
    openTab?.('beats');
    const kit = getKit(id);
    if (kit && beatsApi?.setPattern) {
      const lanes = { kick: Array(16).fill(false), snare: Array(16).fill(false), hat: Array(16).fill(false), perc: Array(16).fill(false) };
      kit.rows.forEach((row) => {
        const target = /kick/i.test(row.inst) ? 'kick' : /snare|clap/i.test(row.inst) ? 'snare' : /hat/i.test(row.inst) ? 'hat' : 'perc';
        (row.steps || []).forEach((s) => { if (s >= 0 && s < 16) lanes[target][s] = true; });
      });
      beatsApi.setPattern(lanes);
      toast(`Remote pattern · ${kit.name}`);
    }
    if (atlanta808Api?.setPattern && /trap|808/i.test(id)) {
      try { atlanta808Api.setPattern('trap') || atlanta808Api.setPattern?.(id); } catch {}
    }
    if (patternApi?.armKit) patternApi.armKit(id);
    note(`Pattern · ${id}`);
  }

  async function handleScene(msg) {
    const scene = Math.max(1, Math.min(8, Number(msg.scene) || 1));
    openTab?.('loops');
    ['kick', 'snare', 'hat'].forEach((lane) => liveLoops?.arm?.(lane, scene - 1, true));
    await liveLoops?.launchScene?.(scene - 1);
    toast(`Remote scene ${scene}`);
    note(`Scene ${scene}`);
  }

  async function handleTransport(msg) {
    const a = msg.action;
    await engine.init();
    if (a === 'play') { if (!engine.isPlaying) await engine.play(); }
    else if (a === 'pause') { if (engine.isPlaying) engine.pause(); }
    else if (a === 'stop') { liveLoops?.stop?.(); patternApi?.stop?.(); engine.stop(); }
    else return;
    note(`Transport · ${a} (from phone)`);
  }

  async function handleStt(msg) {
    const text = String(msg.text || '').trim();
    if (!text) return;
    if (text === lastStt.text && Date.now() - lastStt.t < 2000) return; // LAN hub + same-device double path
    lastStt = { text, t: Date.now() };
    const label = msg.demo ? 'DEMO STT' : (msg.engine || 'STT');
    toast(`${label}: ${text.slice(0, 80)}`);
    note(`Voice · ${label}: ${text.slice(0, 40)}`);
    if (voiceAssist?.handleUtterance) {
      await voiceAssist.handleUtterance(text);
      const say = voiceAssist.parseLocalVoice?.(text)?.say || 'OK';
      speakLocal(say);
      link.send({ type: 'host_say', text: say });
      return;
    }
    const plan = parseLocalVoice(text);
    for (const cmd of plan.commands || []) {
      const a = cmd.action;
      const p = cmd.params || {};
      try {
        if (a === 'play') { await engine.init(); await engine.play(); }
        else if (a === 'stop') { liveLoops?.stop?.(); engine.stop(); }
        else if (a === 'pause') { if (engine.isPlaying) engine.pause(); }
        else if (a === 'set_bpm' && p.bpm) engine.setBpm(Math.max(40, Math.min(240, Number(p.bpm))));
        else if (a === 'launch_scene') await handleScene({ scene: p.scene || 1 });
        else if (a === 'drummer_generate' || a === 'make_beat') {
          openTab?.('drummer');
          drummer?.generate?.();
          if (a === 'make_beat') await drummer?.writeToTrack?.();
        } else if (a === 'load_demo') {
          await engine.init();
          engine.loadDemoProject();
          window.dispatchEvent(new CustomEvent('mm-sound-deck-demo-loaded'));
        }
      } catch (err) { console.warn('[multidevice]', a, err); }
    }
    speakLocal(plan.say || text);
    link.send({ type: 'host_say', text: plan.say || 'OK' });
    hostState();
  }

  /** Phone "Record" over the relay/same-device: the deck has no server STT, so the take lands as an audio clip. */
  async function handleMicChunk(msg) {
    const k = msg.from || 'local';
    const arr = micParts.get(k) || [];
    if (arr.join('').length > 8_000_000) return; // ~6 MB audio cap
    arr.push(String(msg.data || ''));
    micParts.set(k, arr);
  }
  async function handleMicEnd(msg) {
    const k = msg.from || 'local';
    const b64 = (msg.data ? String(msg.data) : (micParts.get(k) || []).join(''));
    micParts.delete(k);
    if (!b64) { link.send({ type: 'stt_result', text: '', demo: true, error: 'empty audio' }); return; }
    try {
      await engine.init();
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const buffer = await engine.ctx.decodeAudioData(bytes.buffer.slice(0));
      let track = engine.tracks.find((t) => t.name === 'Phone Mic');
      if (!track) track = engine.addTrack('audio', 'Phone Mic');
      const spb = 60 / (engine.bpm || 120);
      const startBeat = Math.max(0, Math.floor(engine.currentBeat || 0));
      engine.addClip(track.id, {
        name: `Phone take ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        startBeat,
        durationBeats: Math.max(0.25, buffer.duration / spb),
        color: '#7fd3ff',
        buffer,
        meta: { kind: 'phone-mic', seconds: buffer.duration },
      });
      const say = `Phone take added to “Phone Mic” track at beat ${startBeat + 1} (${buffer.duration.toFixed(1)} s). Speech-to-text needs the Speak button (phone Web Speech) or the LAN hub with whisper.`;
      toast(`Phone mic · clip added (${buffer.duration.toFixed(1)} s)`);
      note(`Mic · clip ${buffer.duration.toFixed(1)} s added`);
      link.send({ type: 'stt_result', text: say, demo: true, engine: 'deck-clip' });
    } catch (err) {
      console.warn('[multidevice] mic decode', err);
      link.send({ type: 'stt_result', text: `Deck could not decode that recording (${err?.message || err}). Try Speak instead.`, demo: true, engine: 'deck-clip' });
    }
  }

  function speakLocal(text) {
    try {
      if (!window.speechSynthesis || !text) return;
      const u = new SpeechSynthesisUtterance(String(text).slice(0, 140));
      u.rate = 1.05;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {}
  }

  const rx = [];
  function onMessage(msg, via) {
    if (msg.type && !/^(welcome|hello_ack|peers|pong)$/.test(msg.type)) {
      rx.push({ type: msg.type, via, t: Date.now(), pad: msg.pad, action: msg.action });
      if (rx.length > 50) rx.shift();
    }
    switch (msg.type) {
      case 'pad': handlePad(msg); break;
      case 'pattern': handlePattern(msg); break;
      case 'scene': handleScene(msg); break;
      case 'transport': handleTransport(msg); break;
      case 'stt_result': if (msg.engine !== 'deck-clip') handleStt(msg); break;
      case 'stt_text': handleStt({ ...msg, engine: msg.engine || 'phone-webspeech' }); break;
      case 'mic_chunk': if (via !== 'lan') handleMicChunk(msg); break;
      case 'mic_end': if (via !== 'lan') handleMicEnd(msg); break;
      case 'state_req': hostState(); break;
      default: break;
    }
  }

  const link = createLink({
    role: 'host', name: 'SoundX deck', room, mode: mode === 'off' ? 'relay' : mode, lanUrl,
    onMessage, onStatus: renderStatus,
  });

  ensureBar();
  refreshLinks();
  try {
    ['play', 'pause', 'stop'].forEach((ev) => engine.on?.(ev, () => hostState({ action: ev })));
  } catch {}
  if (mode === 'off') { link.stop(); }
  else link.start();

  const api = {
    connect: () => { if (mode === 'off') setMode('relay'); else link.start(); },
    isConnected: () => !!lastSt && lastSt.ws === 'open',
    send: (obj) => link.send(obj),
    state: () => ({ ...link.state, room, mode, log: log.slice(-10), rx: rx.slice(-20) }),
    setMode,
    room: () => room,
    controllerUrl: () => pageUrl('controller'),
    micUrl: () => pageUrl('mic'),
    phoneControllerUrl: () => pageUrl('controller', true),
    relayUrl: RELAY_URL,
  };
  window.__sxMultidevice = api;
  return api;
}
