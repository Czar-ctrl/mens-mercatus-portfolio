/**
 * SoundX Link — one client for deck (host), phone pads (controller) and phone mic.
 *
 * Transports (all optional, used together, de-duplicated by message id `mid`):
 *  - relay : wss://api.mensmercatus.online/soundx/ws?room=CODE   (public, zero setup)
 *  - lan   : ws://MAC_IP:8791/ws                                  (LAN hub, local/desktop builds only)
 *  - bc    : BroadcastChannel('soundx-link-CODE')                 (same device, other tab — no network)
 *
 * Browsers block ws:// from an https page (mixed content + the site CSP), so LAN mode
 * is refused up-front on https with an honest message instead of a silent failure.
 */
export const RELAY_URL = 'wss://api.mensmercatus.online/soundx/ws';
export const LAN_PORT = 8791;
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L

export function makeRoomCode(len = 6) {
  const a = new Uint32Array(len);
  (globalThis.crypto || window.crypto).getRandomValues(a);
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[a[i] % ALPHABET.length];
  return s;
}
export function normRoom(s) {
  const r = String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  return r.length >= 4 ? r : '';
}
export function newMid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
/** True when this page may open the given ws URL (https pages cannot open ws://). */
export function wsAllowedFromPage(url) {
  try {
    const u = new URL(url);
    if (u.protocol === 'wss:') return true;
    if (u.protocol !== 'ws:') return false;
    if (location.protocol !== 'https:') return true;
    return false;
  } catch { return false; }
}
export function lanDefault() {
  const { protocol, hostname, port } = location;
  if (protocol === 'http:' && hostname) return `ws://${hostname}:${port || LAN_PORT}/ws`;
  return `ws://192.168.x.x:${LAN_PORT}/ws`;
}
export function relayWsUrl(room, base = RELAY_URL) {
  const u = new URL(base);
  u.searchParams.set('room', room);
  return u.href;
}

/**
 * @param {object} o
 * @param {'host'|'controller'|'mic'} o.role
 * @param {string} o.name
 * @param {string} o.room
 * @param {'relay'|'lan'} [o.mode]
 * @param {string} [o.lanUrl]
 * @param {string} [o.relayUrl]
 * @param {(msg:object, via:string)=>void} o.onMessage
 * @param {(st:object)=>void} [o.onStatus]
 */
export function createLink(o) {
  const st = {
    role: o.role, name: o.name || o.role, room: normRoom(o.room), mode: o.mode || 'relay',
    lanUrl: o.lanUrl || '', relayUrl: o.relayUrl || RELAY_URL,
    ws: 'idle', wsError: '', selfId: '', peers: [], bcPeers: new Map(), enabled: true,
  };
  let ws = null;
  let bc = null;
  let retry = null;
  let backoff = 1000;
  let bcBeat = null;
  const seen = new Set();
  const seenQ = [];

  function remember(mid) {
    if (!mid) return false;
    if (seen.has(mid)) return true;
    seen.add(mid); seenQ.push(mid);
    if (seenQ.length > 400) seen.delete(seenQ.shift());
    return false;
  }
  function counts() {
    const now = Date.now();
    for (const [k, v] of st.bcPeers) if (now - v.t > 6000) st.bcPeers.delete(k);
    const relayOthers = st.peers.filter((p) => p.id !== st.selfId);
    const bcOthers = [...st.bcPeers.values()];
    const all = [...relayOthers, ...bcOthers];
    return {
      host: all.some((p) => p.role === 'host'),
      devices: all.filter((p) => p.role === 'controller' || p.role === 'mic').length,
      relayOthers: relayOthers.length,
      bcOthers: bcOthers.length,
    };
  }
  function emit() {
    try { o.onStatus?.({ ...st, ...counts(), wsUrl: currentUrl() }); } catch (e) { console.warn('[sx-link] status', e); }
  }
  function currentUrl() {
    if (st.mode === 'lan') return st.lanUrl;
    return st.room ? relayWsUrl(st.room, st.relayUrl) : '';
  }

  function deliver(msg, via) {
    if (!msg || typeof msg !== 'object') return;
    if (remember(msg.mid)) return;
    try { o.onMessage?.(msg, via); } catch (e) { console.warn('[sx-link] onMessage', e); }
  }

  // ---- BroadcastChannel (same device) ----
  const myBcId = newMid();
  function openBc() {
    closeBc();
    if (!st.room || typeof BroadcastChannel === 'undefined') return;
    bc = new BroadcastChannel(`soundx-link-${st.room}`);
    bc.onmessage = (ev) => {
      const m = ev.data;
      if (!m || m._bc === myBcId) return;
      if (m.type === '_bc_presence') {
        const known = st.bcPeers.has(m._bc);
        st.bcPeers.set(m._bc, { id: `bc-${m._bc}`, role: m.role, name: m.name, t: Date.now() });
        if (!known) { bcPresence(); emit(); }
        return;
      }
      if (m.type === '_bc_bye') { st.bcPeers.delete(m._bc); emit(); return; }
      deliver(m, 'bc');
    };
    bcPresence();
    clearInterval(bcBeat);
    bcBeat = setInterval(() => { bcPresence(); emit(); }, 2500);
  }
  function bcPresence() {
    try { bc?.postMessage({ type: '_bc_presence', _bc: myBcId, role: st.role, name: st.name }); } catch {}
  }
  function closeBc() {
    clearInterval(bcBeat);
    if (bc) { try { bc.postMessage({ type: '_bc_bye', _bc: myBcId }); bc.close(); } catch {} }
    bc = null;
    st.bcPeers.clear();
  }

  // ---- WebSocket (relay or LAN) ----
  function closeWs() {
    clearTimeout(retry);
    if (ws) { ws.onclose = null; ws.onerror = null; ws.onmessage = null; try { ws.close(); } catch {} }
    ws = null;
  }
  function connectWs() {
    closeWs();
    if (!st.enabled) { st.ws = 'off'; emit(); return; }
    const url = currentUrl();
    if (!url) { st.ws = 'no-room'; st.wsError = 'Enter the room code shown on the deck'; emit(); return; }
    if (!wsAllowedFromPage(url)) {
      st.ws = 'blocked';
      st.wsError = location.protocol === 'https:'
        ? 'LAN ws:// hubs cannot be reached from this https page (browser mixed-content + site CSP). Use Online room, or open the deck from the hub at http://MAC_IP:8791/.'
        : 'Invalid WebSocket URL';
      emit();
      return;
    }
    st.ws = 'connecting'; st.wsError = ''; emit();
    let sock;
    try { sock = new WebSocket(url); } catch (e) { st.ws = 'error'; st.wsError = String(e.message || e); emit(); schedule(); return; }
    ws = sock;
    sock.onopen = () => {
      backoff = 1000;
      st.ws = 'open'; st.wsError = '';
      sock.send(JSON.stringify({ type: 'hello', role: st.role, name: st.name, mid: newMid() }));
      emit();
    };
    sock.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.type === 'welcome' || m.type === 'hello_ack') {
        if (m.id) st.selfId = m.id;
        if (Array.isArray(m.peers)) st.peers = m.peers;
        emit();
      } else if (m.type === 'peers') {
        st.peers = Array.isArray(m.peers) ? m.peers : [];
        emit();
      }
      deliver(m, st.mode);
    };
    sock.onerror = () => { st.wsError = st.mode === 'relay' ? 'Relay unreachable' : 'Hub unreachable'; };
    sock.onclose = () => {
      ws = null; st.peers = []; st.selfId = '';
      st.ws = 'closed'; emit(); schedule();
    };
  }
  function schedule() {
    clearTimeout(retry);
    if (!st.enabled) return;
    retry = setTimeout(connectWs, backoff);
    backoff = Math.min(15000, backoff * 2);
  }

  function send(obj) {
    const msg = { ...obj, mid: obj.mid || newMid() };
    remember(msg.mid); // never re-deliver our own message to ourselves
    let n = 0;
    if (ws && ws.readyState === 1) { try { ws.send(JSON.stringify(msg)); n++; } catch {} }
    if (bc) { try { bc.postMessage({ ...msg, _bc: myBcId, role: st.role }); n++; } catch {} }
    return n > 0;
  }

  function start() { st.enabled = true; openBc(); connectWs(); }
  function stop() { st.enabled = false; closeWs(); closeBc(); st.ws = 'off'; st.peers = []; emit(); }
  function configure(patch = {}) {
    if ('room' in patch) st.room = normRoom(patch.room);
    if ('mode' in patch) st.mode = patch.mode === 'lan' ? 'lan' : 'relay';
    if ('lanUrl' in patch) st.lanUrl = String(patch.lanUrl || '').trim();
    if ('relayUrl' in patch && patch.relayUrl) st.relayUrl = patch.relayUrl;
    if (st.enabled) { openBc(); connectWs(); } else emit();
  }

  try { window.addEventListener('pagehide', () => closeBc()); } catch {}
  return {
    start, stop, configure, send, connectWs,
    get state() { return { ...st, ...counts(), wsUrl: currentUrl() }; },
    isOpen: () => !!(ws && ws.readyState === 1),
  };
}
