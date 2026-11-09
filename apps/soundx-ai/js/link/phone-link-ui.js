/**
 * Phone-side pairing UI shared by controller/ and mic/ pages.
 * Reads ?room= (from the deck QR / link) and ?hub= (LAN hub host[:port]).
 */
import { createLink, normRoom, lanDefault, wsAllowedFromPage, LAN_PORT } from './sx-link.js';

const STORE = 'soundx-ai:phone-link-v1';

function load() {
  try { return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch { return {}; }
}
function save(v) { try { localStorage.setItem(STORE, JSON.stringify(v)); } catch {} }

export function mountPhoneLink({ role, name, onMessage, onState }) {
  const qs = (s) => document.querySelector(s);
  const q = new URLSearchParams(location.search);
  const saved = load();
  const hubParam = q.get('hub');
  const roomParam = normRoom(q.get('room'));
  const servedByHub = location.protocol === 'http:' && location.port === String(LAN_PORT);

  let mode = hubParam || servedByHub ? 'lan' : (saved.mode === 'lan' && location.protocol !== 'https:' ? 'lan' : 'relay');
  let room = roomParam || normRoom(saved.room);
  let lanUrl = hubParam
    ? `ws://${hubParam.replace(/^wss?:\/\//, '').replace(/\/ws\/?$/, '').replace(/\/$/, '')}${/:\d+$/.test(hubParam) ? '' : ':' + LAN_PORT}/ws`
    : (servedByHub ? lanDefault() : (saved.lanUrl || lanDefault()));

  const roomInput = qs('[data-room]');
  const modeSel = qs('[data-link-mode]');
  const urlInput = qs('[data-ws-url]');
  const statusEl = qs('[data-status]');
  const dotEl = qs('[data-dot]');
  const cfg = qs('[data-cfg]');

  roomInput.value = room;
  modeSel.value = mode;
  urlInput.value = lanUrl;
  cfg.dataset.mode = mode;

  function persist() { save({ room, mode, lanUrl }); }
  persist();

  let st = null;
  function setStatus(text, cls) {
    statusEl.textContent = text;
    dotEl.classList.toggle('on', cls === 'on');
    dotEl.classList.toggle('wait', cls === 'wait');
  }
  function render(s) {
    st = s;
    const sameTab = s.bcOthers && [...s.bcPeers.values()].some((p) => p.role === 'host');
    if (s.ws === 'open' && s.host) setStatus(`Linked · ${s.mode === 'lan' ? 'LAN hub' : 'room ' + s.room} · deck online`, 'on');
    else if (sameTab) setStatus('Linked · same-device deck tab', 'on');
    else if (s.ws === 'open') setStatus(`Online · room ${s.room} · waiting for deck (open SoundX → Pair phone)`, 'wait');
    else if (s.ws === 'no-room') setStatus('Enter the room code shown on the deck', '');
    else if (s.ws === 'blocked') setStatus('LAN ws:// blocked on https — switch to Online room', '');
    else if (s.ws === 'connecting') setStatus('Connecting…', '');
    else setStatus(`${s.wsError || 'Offline'} — retrying`, '');
    onState?.(s);
  }

  const link = createLink({ role, name, room, mode, lanUrl, onMessage, onStatus: render });

  function apply() {
    room = normRoom(roomInput.value);
    roomInput.value = room;
    mode = modeSel.value === 'lan' ? 'lan' : 'relay';
    lanUrl = urlInput.value.trim() || lanDefault();
    cfg.dataset.mode = mode;
    persist();
    if (mode === 'lan' && !wsAllowedFromPage(lanUrl)) {
      qs('[data-hint]').textContent = 'This page is https, so the browser blocks ws:// LAN hubs. Use Online room, or open http://MAC_IP:8791/controller/ from the hub.';
    }
    link.configure({ room, mode, lanUrl });
    link.start();
  }
  qs('[data-reconnect]').addEventListener('click', apply);
  roomInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') apply(); });
  modeSel.addEventListener('change', apply);

  link.start();
  return {
    link,
    send: (obj) => {
      const ok = link.send(obj);
      const s = link.state;
      const linked = (s.ws === 'open' && s.host) || [...s.bcPeers.values()].some((p) => p.role === 'host');
      if (!linked) setStatus(ok ? 'Sent — but no deck in this room yet' : 'Offline — tap Connect', ok ? 'wait' : '');
      return ok;
    },
    state: () => link.state,
  };
}
