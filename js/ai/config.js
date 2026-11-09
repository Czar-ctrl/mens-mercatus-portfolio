/* preview wave 3 AI — configuration (edit here; no build step). The Ask Katlego chat (and its optional generative mode) was removed
   from the preview on 2026-10-20 18:00 SAST; it now lives in the standalone local app /workspace/ask-katlego-local/. */
window.MM_AI_CONFIG = window.MM_AI_CONFIG || {
  version: 'w3c-F3-20261021',
  base: '/',
  model: { id: 'Xenova/all-MiniLM-L6-v2', dtype: 'q8', path: '/models/', wasm: '/js/ai/vendor/ort/' },
  contact: { email: 'katlego.mokoto.km@gmail.com', phone: '065 842 4274' },
  f: { version: 'F-20261021', apiBase: /^(www\.)?mensmercatus\.online$/.test(location.hostname) ? 'https://api.mensmercatus.online/leads' : '/leads' },  // H: live site → mm-leads on the API host (CORS-allowed); previews keep the same-origin proxy
  services: { firstClientOffer: false }
};
