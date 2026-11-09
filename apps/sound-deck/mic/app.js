/**
 * SoundX phone mic — Speak (Web Speech → text command) or Record (take → deck clip / LAN hub STT).
 * Pairs via Online room (wss relay), LAN hub, or same-device tab (BroadcastChannel).
 */
import { mountPhoneLink } from '../js/link/phone-link-ui.js?v=20261008md';

const qs = (s) => document.querySelector(s);
const MAX_REC_MS = 60_000;
let mediaRecorder = null;
let chunks = [];
let recognition = null;
let recTimer = null;

const phone = mountPhoneLink({
  role: 'mic',
  name: 'Phone Mic',
  onMessage: (msg) => {
    if (msg.type === 'stt_result' && msg.text) {
      qs('[data-text]').textContent = msg.text;
      qs('[data-mode-badge]').textContent = msg.engine === 'deck-clip' ? 'Deck · take received' : (msg.demo ? 'DEMO STT' : `LIVE · ${msg.engine || 'stt'}`);
    }
    if (msg.type === 'host_say' && msg.text) qs('[data-text]').textContent = `Deck: ${msg.text}`;
  },
  onState: (s) => {
    qs('[data-record]').textContent = mediaRecorder?.state === 'recording'
      ? '■ Stop recording'
      : (s.mode === 'lan' ? '● Record → Mac STT' : '● Record take → deck');
  },
});

function pushText(text, demo = false, engine = 'phone-webspeech') {
  const t = String(text || '').trim();
  if (!t) return;
  qs('[data-text]').textContent = t;
  phone.send({ type: 'stt_text', text: t, demo, engine });
}

qs('.chips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-chip]');
  if (b) pushText(b.dataset.chip, false, 'chip');
});

function micErrorText(err) {
  const n = err?.name || '';
  if (n === 'NotAllowedError' || n === 'SecurityError') return 'Microphone permission was denied. Allow the mic for mensmercatus.online in your browser site settings, then try again.';
  if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'No microphone found on this device.';
  if (n === 'NotReadableError') return 'The microphone is busy in another app — close it and retry.';
  if (!window.isSecureContext) return 'Microphone needs https (or localhost). Open this page over https.';
  return `Mic error: ${err?.message || err}`;
}

function getRecognition() {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor) return null;
  const r = new Ctor();
  r.lang = 'en-ZA';
  r.interimResults = true;
  r.continuous = false;
  return r;
}

qs('[data-listen]').addEventListener('click', () => {
  const r = getRecognition();
  if (!r) {
    qs('[data-text]').textContent = 'This browser has no Web Speech (try Chrome on Android, or Safari on iPhone). Use the command chips, or Record a take.';
    qs('[data-mode-badge]').textContent = 'No Web Speech';
    return;
  }
  recognition = r;
  qs('[data-stop]').hidden = false;
  qs('[data-mode-badge]').textContent = 'Phone STT · listening';
  let finalText = '';
  r.onresult = (ev) => {
    let interim = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const piece = ev.results[i][0].transcript;
      if (ev.results[i].isFinal) finalText += piece;
      else interim += piece;
    }
    qs('[data-text]').textContent = finalText || interim || '…';
  };
  r.onend = () => {
    qs('[data-stop]').hidden = true;
    if (finalText.trim()) pushText(finalText, false, 'phone-webspeech');
  };
  r.onerror = (ev) => {
    qs('[data-stop]').hidden = true;
    const e = ev?.error || '';
    qs('[data-text]').textContent = e === 'not-allowed' || e === 'service-not-allowed'
      ? 'Microphone / speech permission denied — allow it in browser site settings.'
      : e === 'no-speech' ? 'No speech heard — tap Speak and try again.' : `Speech error: ${e || 'unknown'}`;
  };
  try { r.start(); } catch {}
});

function toB64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

qs('[data-record]').addEventListener('click', async () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') { mediaRecorder.stop(); return; }
  if (!navigator.mediaDevices?.getUserMedia) {
    qs('[data-text]').textContent = micErrorText({ name: window.isSecureContext ? 'NotFoundError' : 'SecurityError' });
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } });
    chunks = [];
    const mime = window.MediaRecorder?.isTypeSupported?.('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : window.MediaRecorder?.isTypeSupported?.('audio/mp4') ? 'audio/mp4' : '';
    mediaRecorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    mediaRecorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    mediaRecorder.onstop = async () => {
      clearTimeout(recTimer);
      stream.getTracks().forEach((t) => t.stop());
      qs('[data-record]').classList.remove('rec');
      qs('[data-record]').textContent = phone.state().mode === 'lan' ? '● Record → Mac STT' : '● Record take → deck';
      qs('[data-stop]').hidden = true;
      const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' });
      const b64 = toB64(await blob.arrayBuffer());
      const slice = 48_000;
      let ok = true;
      for (let i = 0; i < b64.length; i += slice) ok = phone.send({ type: 'mic_chunk', data: b64.slice(i, i + slice) }) && ok;
      ok = phone.send({ type: 'mic_end', mime: blob.type || 'audio/webm' }) && ok;
      qs('[data-mode-badge]').textContent = ok ? 'Sent to deck…' : 'Not linked';
      qs('[data-text]').textContent = ok ? `Sent ${(blob.size / 1024).toFixed(1)} KB take to the deck…` : 'Not linked to a deck — check the room code and tap Connect.';
    };
    mediaRecorder.start(250);
    recTimer = setTimeout(() => { if (mediaRecorder?.state === 'recording') mediaRecorder.stop(); }, MAX_REC_MS);
    qs('[data-record]').classList.add('rec');
    qs('[data-record]').textContent = '■ Stop recording';
    qs('[data-stop]').hidden = false;
    qs('[data-mode-badge]').textContent = 'Recording (max 60 s)';
    qs('[data-perm]').textContent = '';
  } catch (err) {
    qs('[data-text]').textContent = micErrorText(err);
    qs('[data-mode-badge]').textContent = 'Mic blocked';
  }
});

qs('[data-stop]').addEventListener('click', () => {
  try { recognition?.stop(); } catch {}
  if (mediaRecorder?.state === 'recording') mediaRecorder.stop();
  qs('[data-stop]').hidden = true;
});

// Honest permission hint up-front (Permissions API where available)
(async () => {
  try {
    const p = await navigator.permissions?.query({ name: 'microphone' });
    if (p?.state === 'denied') qs('[data-perm]').textContent = 'Microphone is blocked for this site in your browser settings — allow it to record. (Speak may still prompt.)';
  } catch {}
})();
window.__sxPhone = phone;
