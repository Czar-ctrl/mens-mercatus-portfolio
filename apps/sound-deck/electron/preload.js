/**
 * Preload — desktop bridge placeholder for Phase-2 VST companion.
 */
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('mmDesktop', {
  platform: process.platform,
  isDesktop: true,
  vstBridge: {
    available: false,
    note: 'Phase-2 native VST bridge — see desktop/vst-bridge/README.md',
    async loadPlugin() {
      return { ok: false, message: 'Awaiting bridge / drop .vst3 path' };
    },
    async listPlugins() { return []; },
    async bypass() {},
  },
});
