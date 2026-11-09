/**
 * Read-only mix telemetry for agents — per-track + master AnalyserNode taps, sampled on
 * requestAnimationFrame (never in the audio path). Snapshot: { peakDb, rmsDb, clips, holdDb }.
 * Feeds Safety Fader, Auto-Mix Balancer, Vocal Duck Conductor, Crowd Reaction Sim, AGI Desk.
 */
const taps = new Map(); // id -> { an, buf, peakDb, rmsDb, clips, holdDb, name }
let raf = 0;
let engineRef = null;
let users = 0;
let frame = 0;
const listeners = new Set();

const toDb = (x) => (x <= 1e-6 ? -120 : 20 * Math.log10(x));

function tapFor(id, srcNode, name) {
  const ctx = engineRef.ctx;
  let t = taps.get(id);
  if (!t) {
    const an = ctx.createAnalyser();
    an.fftSize = 1024;
    an.smoothingTimeConstant = 0;
    t = { an, buf: new Float32Array(an.fftSize), peakDb: -120, rmsDb: -120, holdDb: -120, clips: 0, name, src: null };
    taps.set(id, t);
  }
  t.name = name;
  // Insert rewires call src.disconnect(), dropping fan-out taps; connect() again is a no-op if still wired.
  if (srcNode) {
    try { srcNode.connect(t.an); t.src = srcNode; } catch (_) {}
  }
  return t;
}

function sample() {
  raf = requestAnimationFrame(sample);
  if (!engineRef?.ctx || (typeof document !== 'undefined' && document.hidden)) return;
  frame += 1;
  if (frame % 2) return;
  const live = new Set(['master']);
  tapFor('master', engineRef.analyser || engineRef.masterEqHigh, 'Master'); // post master inserts
  engineRef.tracks.forEach((t) => { live.add(t.id); if (t.gainNode) tapFor(t.id, t.gainNode, t.name); });
  [...taps.keys()].forEach((id) => {
    if (!live.has(id)) { try { taps.get(id).src?.disconnect(taps.get(id).an); } catch (_) {} taps.delete(id); }
  });
  taps.forEach((t) => {
    t.an.getFloatTimeDomainData(t.buf);
    let pk = 0;
    let sum = 0;
    for (let i = 0; i < t.buf.length; i++) { const v = Math.abs(t.buf[i]); if (v > pk) pk = v; sum += v * v; }
    t.peakDb = toDb(pk);
    t.rmsDb = toDb(Math.sqrt(sum / t.buf.length));
    t.holdDb = Math.max(t.peakDb, t.holdDb - 0.4);
    if (pk >= 0.999) t.clips += 1;
  });
  if (frame % 6 === 0) listeners.forEach((fn) => { try { fn(snapshot()); } catch (_) {} });
}

/** Start (ref-counted). Returns stop(). */
export function startTelemetry(engine) {
  engineRef = engine;
  users += 1;
  if (!raf && typeof requestAnimationFrame === 'function') raf = requestAnimationFrame(sample);
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    users = Math.max(0, users - 1);
    if (!users && raf) { cancelAnimationFrame(raf); raf = 0; }
  };
}

export function snapshot() {
  const out = {};
  taps.forEach((t, id) => {
    out[id] = { name: t.name, peakDb: +t.peakDb.toFixed(1), rmsDb: +t.rmsDb.toFixed(1), holdDb: +t.holdDb.toFixed(1), clips: t.clips };
  });
  return out;
}

export function onTelemetry(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function resetClips() { taps.forEach((t) => { t.clips = 0; t.holdDb = -120; }); }

/** Tracks whose peak hold crossed −0.1 dBFS or registered clipped frames. */
export function whoIsClipping() {
  return Object.entries(snapshot()).filter(([, v]) => v.clips > 0 || v.holdDb > -0.1).map(([id, v]) => ({ id, ...v }));
}

export function isRunning() { return !!raf; }
