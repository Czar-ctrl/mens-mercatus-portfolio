/**
 * Pure DSP heuristics (no DOM, no Web Audio) — runs inside analysis-worker.js or on the main
 * thread as a fallback. Hand-built features; nothing here is a trained neural network.
 */
const db = (x) => (x <= 1e-9 ? -120 : 20 * Math.log10(x));

export function rms(data, a = 0, b = data.length) {
  let s = 0;
  for (let i = a; i < b; i++) s += data[i] * data[i];
  return Math.sqrt(s / Math.max(1, b - a));
}
export function peak(data) {
  let p = 0;
  for (let i = 0; i < data.length; i++) { const v = Math.abs(data[i]); if (v > p) p = v; }
  return p;
}

/** Energy flux envelope (hop-based) used for onsets and tempo. */
export function fluxEnvelope(data, sr, hop = 512) {
  const n = Math.floor(data.length / hop);
  const env = new Float32Array(n);
  const flux = new Float32Array(n);
  let prev = 0;
  let hpPrev = 0;
  let hpOut = 0;
  for (let f = 0; f < n; f++) {
    let s = 0;
    for (let i = f * hop; i < (f + 1) * hop; i++) {
      // first-order high-pass emphasises attacks
      hpOut = 0.95 * (hpOut + data[i] - hpPrev);
      hpPrev = data[i];
      s += hpOut * hpOut;
    }
    env[f] = Math.sqrt(s / hop);
    flux[f] = Math.max(0, env[f] - prev);
    prev = env[f];
  }
  return { env, flux, hopSec: hop / sr };
}

/** Onset times (s) via adaptive-threshold peak picking on flux. */
export function onsets(data, sr, { hop = 512, sensitivity = 1.5 } = {}) {
  const { flux, hopSec } = fluxEnvelope(data, sr, hop);
  const out = [];
  const w = 8;
  let last = -1;
  // A hit right at the start of the buffer (one-shots, sliced clips) has no left neighbour.
  if (flux.length > 1 && flux[0] > 0.002 && flux[0] >= flux[1]) { out.push(0); last = 0; }
  for (let i = 1; i < flux.length - 1; i++) {
    let m = 0;
    let c = 0;
    for (let j = Math.max(0, i - w); j < Math.min(flux.length, i + w); j++) { m += flux[j]; c += 1; }
    m /= c;
    if (flux[i] > m * sensitivity && flux[i] >= flux[i - 1] && flux[i] >= flux[i + 1] && flux[i] > 0.002) {
      if (last < 0 || i - last > 3) { out.push(i * hopSec); last = i; }
    }
  }
  return out;
}

/** Per-bar RMS (dB + normalized 0..1) and onset density. */
export function barEnergy(data, sr, bpm, nBars) {
  const spBar = (60 / bpm) * 4 * sr;
  const ons = onsets(data, sr);
  const out = [];
  for (let b = 0; b < nBars; b++) {
    const a = Math.floor(b * spBar);
    const e = Math.min(data.length, Math.floor((b + 1) * spBar));
    const r = a < e ? rms(data, a, e) : 0;
    const t0 = a / sr;
    const t1 = e / sr;
    const dens = ons.filter((t) => t >= t0 && t < t1).length;
    out.push({ bar: b, rmsDb: +db(r).toFixed(1), rms: r, onsets: dens });
  }
  const maxR = Math.max(...out.map((o) => o.rms), 1e-9);
  const maxO = Math.max(...out.map((o) => o.onsets), 1);
  out.forEach((o) => {
    o.level = +(o.rms / maxR).toFixed(3);
    // predicted perceived energy: loudness + rhythmic density
    o.energy = +(0.7 * o.level + 0.3 * (o.onsets / maxO)).toFixed(3);
  });
  return out;
}

/** Band split via one-pole filters — returns energy ratios. */
export function bandRatios(data, sr) {
  const aLow = 1 - Math.exp(-2 * Math.PI * 200 / sr);
  const aHigh = 1 - Math.exp(-2 * Math.PI * 4000 / sr);
  let lp = 0;
  let lp4 = 0;
  let eLow = 0;
  let eHigh = 0;
  let eAll = 0;
  for (let i = 0; i < data.length; i++) {
    const x = data[i];
    lp += aLow * (x - lp);
    lp4 += aHigh * (x - lp4);
    const hi = x - lp4;
    eLow += lp * lp;
    eHigh += hi * hi;
    eAll += x * x;
  }
  eAll = Math.max(eAll, 1e-12);
  return { low: eLow / eAll, high: eHigh / eAll, mid: Math.max(0, 1 - eLow / eAll - eHigh / eAll) };
}

export function zeroCrossRate(data) {
  let z = 0;
  for (let i = 1; i < data.length; i++) if ((data[i - 1] >= 0) !== (data[i] >= 0)) z += 1;
  return z / Math.max(1, data.length);
}

/** 8-feature stem descriptor (the "heuristic embedding"). */
export function stemStats(data, sr) {
  const r = rms(data);
  const p = peak(data);
  const bands = bandRatios(data, sr);
  const zcr = zeroCrossRate(data);
  const ons = onsets(data, sr);
  const dur = data.length / sr;
  const { env } = fluxEnvelope(data, sr, 1024);
  const thr = Math.max(...env, 1e-9) * 0.1;
  const sustain = env.length ? env.filter((v) => v > thr).length / env.length : 0;
  return {
    rmsDb: +db(r).toFixed(1),
    peakDb: +db(p).toFixed(1),
    crestDb: +(db(p) - db(r)).toFixed(1),
    low: +bands.low.toFixed(3),
    mid: +bands.mid.toFixed(3),
    high: +bands.high.toFixed(3),
    zcr: +zcr.toFixed(4),
    centroidHz: Math.round(zcr * sr / 2),
    onsetRate: +(ons.length / Math.max(0.1, dur)).toFixed(2),
    sustain: +sustain.toFixed(3),
    silent: r < 1e-4,
  };
}

/** Rule-based role classifier over stemStats. */
export function classifyRole(st) {
  if (!st || st.silent) return { role: 'empty', confidence: 0.9, reasons: ['no signal'] };
  const scores = { drums: 0, bass: 0, vox: 0, keys: 0, fx: 0 };
  const why = { drums: [], bass: [], vox: [], keys: [], fx: [] };
  if (st.crestDb > 14) { scores.drums += 2; why.drums.push(`crest ${st.crestDb} dB`); }
  if (st.onsetRate > 3) { scores.drums += 2; why.drums.push(`${st.onsetRate} onsets/s`); }
  if (st.sustain < 0.45) { scores.drums += 1; why.drums.push('short sustain'); }
  if (st.low > 0.55) { scores.bass += 3; why.bass.push(`${Math.round(st.low * 100)}% < 200 Hz`); }
  if (st.centroidHz < 500) { scores.bass += 1; why.bass.push(`centroid ~${st.centroidHz} Hz`); }
  if (st.mid > 0.55 && st.centroidHz > 500 && st.centroidHz < 3500 && st.sustain > 0.5) { scores.vox += 2; why.vox.push('mid-band, sustained'); }
  if (st.onsetRate > 0.8 && st.onsetRate < 4 && st.crestDb > 8 && st.crestDb < 16) { scores.vox += 1; why.vox.push('syllabic onset rate'); }
  if (st.sustain > 0.6 && st.crestDb < 12) { scores.keys += 2; why.keys.push('sustained, low crest'); }
  if (st.high > 0.35 && st.onsetRate < 2) { scores.fx += 2; why.fx.push(`${Math.round(st.high * 100)}% > 4 kHz`); }
  if (st.zcr > 0.2 && st.sustain > 0.5) { scores.fx += 1; why.fx.push('noisy & sustained'); }
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [role, s] = ranked[0];
  const total = ranked.reduce((m, [, v]) => m + v, 0) || 1;
  return { role: s ? role : 'keys', confidence: +(s ? Math.min(0.9, 0.35 + s / total * 0.6) : 0.3).toFixed(2), reasons: why[role].length ? why[role] : ['weak evidence'], scores };
}

/** Tempo estimate (60–180 BPM) via autocorrelation of flux (half-time readings doubled). */
export function tempoEstimate(data, sr) {
  const { flux, hopSec } = fluxEnvelope(data, sr, 512);
  const acf = (bpm) => {
    const lag = (60 / bpm) / hopSec;
    const l0 = Math.floor(lag);
    const fr = lag - l0;
    let s = 0;
    for (let i = 0; i + l0 + 1 < flux.length; i++) s += flux[i] * (flux[i + l0] * (1 - fr) + flux[i + l0 + 1] * fr);
    return s;
  };
  let best = { bpm: 0, score: 0 };
  for (let bpm = 60; bpm <= 180; bpm += 0.5) {
    const sc = acf(bpm);
    if (sc > best.score) best = { bpm, score: sc };
  }
  if (!best.bpm) return null;
  if (best.bpm < 85) {
    let alt = { bpm: 0, score: 0 };
    for (let d = -1; d <= 1; d += 0.5) { const sc = acf(best.bpm * 2 + d); if (sc > alt.score) alt = { bpm: best.bpm * 2 + d, score: sc }; }
    if (alt.score >= best.score * 0.6) return alt.bpm;
  }
  return best.bpm;
}

/** Swing estimate: where off-beat 16th onsets land between straight (0.5) and triplet (0.67). */
export function swingEstimate(onsetTimes, bpm) {
  if (!bpm || onsetTimes.length < 8) return 0.5;
  const eighth = 60 / bpm / 2;
  const ratios = [];
  onsetTimes.forEach((t) => {
    const pos = (t % eighth) / eighth; // 0..1 within an 8th
    if (pos > 0.35 && pos < 0.8) ratios.push(pos);
  });
  if (!ratios.length) return 0.5;
  ratios.sort((a, b) => a - b);
  return +Math.max(0.5, Math.min(0.72, ratios[Math.floor(ratios.length / 2)])).toFixed(2);
}

export function refProfile(data, sr) {
  const st = stemStats(data, sr);
  const tempo = tempoEstimate(data, sr);
  const ons = onsets(data, sr);
  return {
    ...st,
    tempo,
    swing: swingEstimate(ons, tempo),
    tiltDb: +(10 * Math.log10(Math.max(st.high, 1e-6) / Math.max(st.low, 1e-6))).toFixed(1),
  };
}

/** Cosine similarity of two profile vectors (normalized features). */
export function profileSimilarity(a, b) {
  const vec = (p) => [
    (p.rmsDb + 60) / 60, p.crestDb / 30, p.low, p.mid, p.high, Math.min(1, p.onsetRate / 8), p.sustain, (p.tempo || 120) / 180, ((p.swing || 0.5) - 0.5) * 4,
  ];
  const x = vec(a);
  const y = vec(b);
  let d = 0; let nx = 0; let ny = 0;
  for (let i = 0; i < x.length; i++) { d += x[i] * y[i]; nx += x[i] * x[i]; ny += y[i] * y[i]; }
  return +(d / Math.sqrt(nx * ny || 1)).toFixed(3);
}

/**
 * Rank windows of 2/4/8 bars as hook candidates:
 *   repetition (how often a similar window recurs) + energy + onset activity.
 * @param bars [{energy, onsets, pitch?:number[]}]
 */
export function hookWindows(bars, sizes = [2, 4, 8], top = 6) {
  const n = bars.length;
  const featOf = (s, len) => {
    const v = [];
    for (let i = 0; i < len; i++) {
      const b = bars[s + i] || { energy: 0, onsets: 0 };
      v.push(b.energy, Math.min(1, b.onsets / 16), ...(b.pitch || []));
    }
    return v;
  };
  const sim = (a, b) => {
    let d = 0;
    for (let i = 0; i < a.length; i++) d += (a[i] - (b[i] || 0)) ** 2;
    return 1 / (1 + Math.sqrt(d / a.length) * 6);
  };
  const out = [];
  sizes.forEach((len) => {
    if (len > n) return;
    for (let s = 0; s + len <= n; s += Math.max(1, len / 2)) {
      const f = featOf(s, len);
      let rep = 0;
      for (let t = 0; t + len <= n; t += len) {
        if (Math.abs(t - s) < len) continue;
        if (sim(f, featOf(t, len)) > 0.82) rep += 1;
      }
      let en = 0;
      for (let i = 0; i < len; i++) en += bars[s + i].energy;
      en /= len;
      const score = Math.min(1, rep / 3) * 0.45 + en * 0.4 + (len === 4 ? 0.15 : len === 2 ? 0.08 : 0.1);
      out.push({ startBar: s, bars: len, score: +score.toFixed(3), repeats: rep, energy: +en.toFixed(2) });
    }
  });
  out.sort((a, b) => b.score - a.score);
  const picked = [];
  out.forEach((w) => {
    if (picked.length >= top) return;
    if (picked.some((p) => w.startBar < p.startBar + p.bars && p.startBar < w.startBar + w.bars && p.bars === w.bars)) return;
    picked.push(w);
  });
  return picked;
}

/**
 * Transient shaper: attackGain on the first `attackMs` after each onset, sustainGain after.
 * tighten → attackGain > 1, sustainGain < 1; smear → attackGain < 1, sustainGain ≥ 1.
 */
export function shapeTransients(data, sr, onsetTimes, { attackGain = 1.6, sustainGain = 0.7, attackMs = 12, releaseMs = 120 } = {}) {
  const out = new Float32Array(data.length);
  const gains = new Float32Array(data.length).fill(onsetTimes.length ? sustainGain : 1);
  const a = Math.floor(attackMs / 1000 * sr);
  const r = Math.floor(releaseMs / 1000 * sr);
  onsetTimes.forEach((t) => {
    const s = Math.floor(t * sr);
    for (let i = 0; i < a + r && s + i < data.length; i++) {
      const g = i < a ? attackGain : attackGain + (sustainGain - attackGain) * ((i - a) / r);
      const idx = s + i;
      if (idx >= 0) gains[idx] = i < a ? Math.max(gains[idx], g) : g;
    }
  });
  let sm = gains[0];
  for (let i = 0; i < data.length; i++) {
    sm += (gains[i] - sm) * 0.02; // de-click smoothing
    out[i] = Math.tanh(data[i] * sm * 1.05) / 1.05;
  }
  return out;
}

/** Dispatch table for the worker. */
export function runKind(kind, p) {
  switch (kind) {
    case 'barEnergy': return barEnergy(p.data, p.sr, p.bpm, p.bars);
    case 'onsets': return onsets(p.data, p.sr, p.opts);
    case 'stemStats': { const st = stemStats(p.data, p.sr); return { stats: st, role: classifyRole(st) }; }
    case 'refProfile': return refProfile(p.data, p.sr);
    case 'hookWindows': return hookWindows(p.bars, p.sizes, p.top);
    case 'shapeTransients': {
      const ons = onsets(p.data, p.sr);
      return { data: shapeTransients(p.data, p.sr, ons, p.opts), onsets: ons };
    }
    case 'peak': return { peak: peak(p.data), rms: rms(p.data) };
    default: throw new Error(`unknown analysis kind ${kind}`);
  }
}
