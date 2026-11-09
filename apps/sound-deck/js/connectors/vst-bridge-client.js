/**
 * VST bridge client — talks to Electron preload or future localhost WS.
 * See desktop/vst-bridge/README.md for IPC contract.
 */
function isLocalHost() {
  if (typeof location === 'undefined') return false;
  return location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
}

export class VstBridgeClient {
  constructor() {
    this.available = false;
    this.transport = null;
  }

  async probe() {
    const desk = typeof window !== 'undefined' ? window.mmDesktop?.vstBridge : null;
    if (desk?.available) {
      this.available = true;
      this.transport = 'mmDesktop';
      return { available: true, transport: 'mmDesktop' };
    }
    // Optional localhost probe (Phase-2 companion) — only when the deck itself runs locally.
    // On the public HTTPS site this would be blocked (mixed content / local-network prompt), so skip it.
    if (!isLocalHost()) {
      this.available = false;
      this.transport = null;
      return { available: false };
    }
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 250);
      const res = await fetch('http://127.0.0.1:17321/vst/health', { signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok) {
        this.available = true;
        this.transport = 'ws-http';
        return { available: true, transport: 'ws-http' };
      }
    } catch (_) {}
    this.available = false;
    this.transport = null;
    return { available: false };
  }

  async requestLoad({ channel, slot, path, name }) {
    await this.probe();
    if (!this.available) {
      return {
        ok: false,
        message: 'Awaiting bridge / drop .vst3 path — metadata stored locally only',
      };
    }
    if (this.transport === 'mmDesktop' && window.mmDesktop?.vstBridge?.loadPlugin) {
      try {
        const r = await window.mmDesktop.vstBridge.loadPlugin({ channel, slot, path, name });
        return { ok: !!r?.ok, message: r?.message || 'Host load requested' };
      } catch (err) {
        return { ok: false, message: err.message };
      }
    }
    try {
      const res = await fetch('http://127.0.0.1:17321/vst/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, slot, path, name }),
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, message: data.message || `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, message: err.message };
    }
  }
}
