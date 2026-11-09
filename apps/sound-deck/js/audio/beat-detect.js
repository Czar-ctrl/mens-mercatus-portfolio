/**
 * Onset and tempo estimate from a local audio buffer.
 * Energy flux peaks, then a median interval folded into a musical BPM.
 * No audio leaves the browser.
 */

export function detectBeatFromSamples(samples, sampleRate) {
  const rate = sampleRate || 44100;
  if (!samples || samples.length < rate * 0.4) {
    return null;
  }
  const frame = 1024;
  const hop = 512;
  const energies = [];
  for (let start = 0; start + frame < samples.length; start += hop) {
    let energy = 0;
    for (let i = 0; i < frame; i++) {
      const value = samples[start + i];
      energy += value * value;
    }
    energies.push(energy / frame);
  }
  if (energies.length < 8) return null;
  const flux = [0];
  for (let i = 1; i < energies.length; i++) {
    flux.push(Math.max(0, energies[i] - energies[i - 1]));
  }
  const mean = flux.reduce((sum, value) => sum + value, 0) / flux.length;
  const variance = flux.reduce((sum, value) => sum + (value - mean) ** 2, 0) / flux.length;
  const threshold = mean + Math.sqrt(variance) * 1.1;
  const onsets = [];
  for (let i = 1; i < flux.length - 1; i++) {
    if (flux[i] > threshold && flux[i] >= flux[i - 1] && flux[i] > flux[i + 1]) {
      const previous = onsets[onsets.length - 1];
      if (previous == null || i - previous > 2) onsets.push(i);
    }
  }
  if (onsets.length < 3) return null;
  const hopSeconds = hop / rate;
  const intervals = [];
  for (let i = 1; i < onsets.length; i++) {
    intervals.push((onsets[i] - onsets[i - 1]) * hopSeconds);
  }
  intervals.sort((a, b) => a - b);
  let interval = intervals[Math.floor(intervals.length / 2)];
  let bpm = 60 / interval;
  while (bpm < 70 && bpm > 0) bpm *= 2;
  while (bpm > 180) bpm /= 2;
  bpm = Math.round(bpm);
  const mid = intervals[Math.floor(intervals.length / 2)];
  const spread = intervals[Math.floor(intervals.length * 0.75)] - intervals[Math.floor(intervals.length * 0.25)];
  const confidence = Math.max(0, Math.min(1, 1 - spread / Math.max(mid, 0.05)));
  return {
    bpm: Math.max(70, Math.min(180, bpm)),
    onsets: onsets.length,
    confidence: Math.round(confidence * 100) / 100,
  };
}

export function detectSessionBeat(engine) {
  const rate = 44100;
  const seconds = 8;
  const mix = new Float32Array(rate * seconds);
  const spb = engine.secondsPerBeat || 60 / (engine.bpm || 120);
  let clips = 0;
  let trackName = "";
  for (const track of engine.tracks || []) {
    for (const clip of track.clips || []) {
      if (!clip.buffer || typeof clip.buffer.getChannelData !== "function") continue;
      const data = clip.buffer.getChannelData(0);
      const start = Math.max(0, Math.round((clip.startBeat || 0) * spb * rate));
      for (let i = 0; i < data.length && start + i < mix.length; i++) {
        mix[start + i] += data[i];
      }
      clips += 1;
      trackName = track.name || trackName;
    }
  }
  if (clips < 2) return null;
  const heard = detectBeatFromSamples(mix, rate);
  if (!heard) return null;
  return { ...heard, clips, track: trackName || "session" };
}
