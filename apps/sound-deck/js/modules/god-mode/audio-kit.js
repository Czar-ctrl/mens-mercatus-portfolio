/**
 * Shared audio helpers for God Mode Wave 2/3 — synthesized one-shots (no samples shipped),
 * pattern bouncing, region render, mono mixdown. Local Web Audio only.
 */
import { encodeWav } from '../../audio/export-audio.js';

export { encodeWav };

const voiceCache = new Map(); // `${voice}|${sr}` -> Float32Array

function noise(rng) { return rng() * 2 - 1; }
function lcg(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** Mono one-shot samples per voice at sample rate sr. */
export function voiceSamples(voice, sr) {
  const key = `${voice}|${sr}`;
  if (voiceCache.has(key)) return voiceCache.get(key);
  const rng = lcg(voice.length * 7919 + 13);
  const make = (sec, fn) => {
    const n = Math.max(1, Math.floor(sec * sr));
    const d = new Float32Array(n);
    for (let i = 0; i < n; i++) d[i] = fn(i / sr, i, n);
    return d;
  };
  let out;
  switch (voice) {
    case 'kick': {
      let ph = 0;
      out = make(0.42, (t) => { const f = 48 + 110 * Math.exp(-t * 28); ph += (2 * Math.PI * f) / sr; return Math.sin(ph) * Math.exp(-t * 7.5) * 0.95; });
      break;
    }
    case 'clap': out = make(0.28, (t) => {
      const bursts = [0, 0.011, 0.022, 0.034];
      let env = 0;
      bursts.forEach((b) => { if (t >= b) env = Math.max(env, Math.exp(-(t - b) * (b === 0.034 ? 18 : 90))); });
      return noise(rng) * env * 0.55;
    }); break;
    case 'snare': out = make(0.24, (t) => (noise(rng) * 0.6 + Math.sin(2 * Math.PI * 190 * t) * 0.45) * Math.exp(-t * 20) * 0.7); break;
    case 'hat': { let lp = 0; out = make(0.07, (t) => { const n = noise(rng); const hp = n - lp; lp += (n - lp) * 0.35; return hp * Math.exp(-t * 70) * 0.38; }); break; }
    case 'ohat': { let lp = 0; out = make(0.32, (t) => { const n = noise(rng); const hp = n - lp; lp += (n - lp) * 0.3; return hp * Math.exp(-t * 11) * 0.28; }); break; }
    case 'shaker': { let lp = 0; out = make(0.11, (t) => { const n = noise(rng); const hp = n - lp; lp += (n - lp) * 0.55; const a = Math.min(1, t / 0.012); return hp * a * Math.exp(-t * 34) * 0.32; }); break; }
    case 'conga_hi': out = make(0.22, (t) => { const f = 420 * (1 + 0.25 * Math.exp(-t * 60)); return Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 16) * 0.5 + noise(rng) * Math.exp(-t * 120) * 0.12; }); break;
    case 'conga_lo': out = make(0.3, (t) => { const f = 260 * (1 + 0.3 * Math.exp(-t * 50)); return Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 11) * 0.55 + noise(rng) * Math.exp(-t * 110) * 0.1; }); break;
    case 'tom': { let ph = 0; out = make(0.36, (t) => { const f = 120 + 90 * Math.exp(-t * 18); ph += (2 * Math.PI * f) / sr; return Math.sin(ph) * Math.exp(-t * 9) * 0.6; }); break; }
    case 'rim': out = make(0.06, (t) => (Math.sin(2 * Math.PI * 1700 * t) * 0.5 + noise(rng) * 0.3) * Math.exp(-t * 80) * 0.5); break;
    case 'logdrum': { let ph = 0; out = make(0.55, (t) => { const f = 55 * Math.pow(2, 0.6 * Math.exp(-t * 14)); ph += (2 * Math.PI * f) / sr; const s = Math.sin(ph); return Math.tanh(s * 2.2) * Math.exp(-t * 4.2) * 0.62; }); break; }
    case 'cowbell': out = make(0.18, (t) => ((Math.sin(2 * Math.PI * 587 * t) > 0 ? 1 : -1) * 0.5 + (Math.sin(2 * Math.PI * 845 * t) > 0 ? 1 : -1) * 0.5) * Math.exp(-t * 22) * 0.16); break;
    default: out = make(0.1, (t) => Math.sin(2 * Math.PI * 440 * t) * Math.exp(-t * 30) * 0.3);
  }
  voiceCache.set(key, out);
  return out;
}

/**
 * Mix hits [{beat, voice, vel}] into one mono AudioBuffer of lengthBeats at bpm.
 */
export function bounceHits(engine, hits, lengthBeats, bpm = engine.bpm) {
  const ctx = engine.ctx;
  const sr = ctx.sampleRate;
  const spb = 60 / bpm;
  const len = Math.max(1, Math.ceil(lengthBeats * spb * sr));
  const buf = ctx.createBuffer(1, len, sr);
  const out = buf.getChannelData(0);
  hits.forEach((h) => {
    const smp = voiceSamples(h.voice, sr);
    const at = Math.round(h.beat * spb * sr);
    const vel = Math.max(0, Math.min(1.2, h.vel ?? 1));
    for (let i = 0; i < smp.length && at + i < len; i++) if (at + i >= 0) out[at + i] += smp[i] * vel;
  });
  softClip(out);
  return buf;
}

export function softClip(arr, ceil = 0.98) {
  for (let i = 0; i < arr.length; i++) {
    const x = arr[i];
    if (x > ceil || x < -ceil) arr[i] = Math.tanh(x);
  }
}

/** Noise riser (rising band + level) ending at the buffer end. */
export function riserBuffer(engine, seconds = 2, seed = 7) {
  const ctx = engine.ctx;
  const sr = ctx.sampleRate;
  const n = Math.floor(seconds * sr);
  const buf = ctx.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);
  const rng = lcg(seed);
  let lp = 0;
  let lp2 = 0;
  for (let i = 0; i < n; i++) {
    const p = i / n;
    const a = 0.02 + 0.5 * p * p;
    const x = noise(rng);
    lp += (x - lp) * (0.02 + 0.5 * p);
    lp2 += (lp - lp2) * (0.05 + 0.6 * p);
    const sweep = Math.sin(2 * Math.PI * (200 + 1800 * p * p) * (i / sr)) * 0.15 * p;
    d[i] = (lp - lp2 * 0.5 + sweep) * a;
  }
  return buf;
}

/** Downlifter / impact for the downbeat after a transition. */
export function impactBuffer(engine, seconds = 1.6, seed = 11) {
  const ctx = engine.ctx;
  const sr = ctx.sampleRate;
  const n = Math.floor(seconds * sr);
  const buf = ctx.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);
  const rng = lcg(seed);
  let ph = 0;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const f = 38 + 70 * Math.exp(-t * 6);
    ph += (2 * Math.PI * f) / sr;
    lp += (noise(rng) - lp) * Math.max(0.01, 0.3 * Math.exp(-t * 3));
    d[i] = Math.sin(ph) * Math.exp(-t * 3.2) * 0.7 + lp * Math.exp(-t * 2.2) * 0.35;
  }
  return buf;
}

/**
 * Offline render of [startBeat, endBeat) — same rules as export renderMixdown
 * (mute/solo/volume/pan), windowed so clips that start before the region play from an offset.
 * @param {object} opts { trackIds?: string[] (only these), includeMaster?: boolean }
 */
export async function renderRegion(engine, startBeat, endBeat, { trackIds = null, tailSec = 0.05, channels = 2 } = {}) {
  await engine.init();
  const spb = 60 / engine.bpm;
  const t0 = startBeat * spb;
  const dur = Math.max(0.05, (endBeat - startBeat) * spb + tailSec);
  const sr = engine.ctx.sampleRate;
  const offline = new OfflineAudioContext(channels, Math.ceil(dur * sr), sr);
  const master = offline.createGain();
  master.gain.value = trackIds ? 1 : (engine._masterVol ?? 0.85);
  master.connect(offline.destination);
  const soloOn = engine.tracks.some((t) => t.solo);
  for (const track of engine.tracks) {
    if (trackIds) { if (!trackIds.includes(track.id)) continue; }
    else { if (track.muted) continue; if (soloOn && !track.solo) continue; }
    const g = offline.createGain();
    g.gain.value = trackIds ? 1 : (track.volume ?? 0.8);
    const pan = offline.createStereoPanner ? offline.createStereoPanner() : null;
    if (pan) { pan.pan.value = trackIds ? 0 : (track.pan ?? 0); g.connect(pan); pan.connect(master); } else g.connect(master);
    for (const clip of track.clips) {
      const cs = (clip.startBeat || 0) * spb - t0;
      const ce = cs + (clip.durationBeats || 0) * spb;
      if (ce <= 0 || cs >= dur) continue;
      if (clip.notes?.length) {
        for (const n of clip.notes) {
          const nw = cs + (n.beat || 0) * spb;
          const nd = (n.dur || 0.25) * spb;
          if (nw + nd <= 0 || nw >= dur) continue;
          const at = Math.max(0, nw);
          const osc = offline.createOscillator();
          const ng = offline.createGain();
          osc.type = n.wave || 'sine';
          osc.frequency.value = n.freq || 440;
          const peak = 0.35 * Math.max(0.05, Math.min(1, n.vel ?? 1));
          ng.gain.setValueAtTime(0.0001, at);
          ng.gain.exponentialRampToValueAtTime(peak, at + 0.01);
          ng.gain.exponentialRampToValueAtTime(0.0001, Math.max(at + 0.02, nw + nd));
          osc.connect(ng); ng.connect(g);
          osc.start(at); osc.stop(Math.max(at + 0.03, nw + nd + 0.02));
        }
        continue;
      }
      let buffer = clip.buffer;
      if (!buffer && clip.recipe) { buffer = engine.createBufferFromRecipe(clip.recipe); clip.buffer = buffer; }
      if (!buffer) continue;
      const src = offline.createBufferSource();
      src.buffer = buffer;
      src.connect(g);
      const offset = cs < 0 ? -cs : 0;
      if (offset >= buffer.duration) continue;
      try { src.start(Math.max(0, cs), offset); } catch (_) {}
    }
  }
  return offline.startRendering();
}

/** Mono Float32Array copy of an AudioBuffer (averaged channels). */
export function toMono(buffer, maxSec = 600) {
  const n = Math.min(buffer.length, Math.floor(maxSec * buffer.sampleRate));
  const out = new Float32Array(n);
  const ch = buffer.numberOfChannels;
  for (let c = 0; c < ch; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < n; i++) out[i] += d[i] / ch;
  }
  return out;
}

/** Mono mixdown of the whole song (or bars) for analysis. */
export async function songMono(engine, { maxBars = 64, trackIds = null, minBars = 1 } = {}) {
  let end = 0;
  engine.tracks.forEach((t) => t.clips.forEach((c) => { end = Math.max(end, (c.startBeat || 0) + (c.durationBeats || 0)); }));
  const bars = Math.max(minBars, Math.min(maxBars, Math.ceil(end / 4)));
  const buf = await renderRegion(engine, 0, bars * 4, { trackIds, channels: 1, tailSec: 0 });
  return { data: toMono(buf), sr: buf.sampleRate, bars, bpm: engine.bpm };
}

/** Decode a File / Blob / ArrayBuffer into an AudioBuffer on the engine context. */
export async function decodeAudio(engine, src) {
  await engine.init();
  const ab = src instanceof ArrayBuffer ? src : await src.arrayBuffer();
  return engine.ctx.decodeAudioData(ab.slice(0));
}
