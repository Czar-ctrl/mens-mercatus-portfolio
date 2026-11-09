/**
 * Audio mixdown + export — WAV / FLAC / MP3 / Ogg.
 * WAV is always real PCM. Other formats use MediaRecorder when the browser
 * supports them; otherwise DEMO-honest WAV fallbacks with clear toasts.
 */
const FORMATS = [
  { id: 'wav', label: 'WAV (PCM)', ext: 'wav', mime: 'audio/wav', mode: 'pcm' },
  { id: 'flac', label: 'FLAC', ext: 'flac', mime: 'audio/flac', mode: 'recorder', recorderTypes: ['audio/flac', 'audio/x-flac'] },
  { id: 'mp3', label: 'MP3', ext: 'mp3', mime: 'audio/mpeg', mode: 'recorder', recorderTypes: ['audio/mpeg', 'audio/mp3'] },
  { id: 'ogg', label: 'Ogg Vorbis / Opus', ext: 'ogg', mime: 'audio/ogg', mode: 'ogg', recorderTypes: ['audio/ogg;codecs=opus', 'audio/ogg;codecs=vorbis', 'audio/ogg'] },
];

export function listExportFormats() {
  return FORMATS.map((f) => ({
    ...f,
    available: f.mode === 'pcm' || !!pickRecorderMime(f.recorderTypes || []),
  }));
}

function pickRecorderMime(types) {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return null;
  for (const t of types) {
    try {
      if (MediaRecorder.isTypeSupported(t)) return t;
    } catch (_) {}
  }
  return null;
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

/** Encode AudioBuffer → 16-bit stereo/mono WAV Blob */
export function encodeWav(buffer) {
  const numCh = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const len = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numCh * bytesPerSample;
  const dataSize = len * blockAlign;
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  const channels = [];
  for (let c = 0; c < numCh; c++) channels.push(buffer.getChannelData(c));
  let off = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < numCh; c++) {
      let s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  return new Blob([ab], { type: 'audio/wav' });
}

/**
 * Render arrangement to OfflineAudioContext (up to maxBars, default from content).
 */
export async function renderMixdown(engine, { maxBars = 32, padSec = 0.15 } = {}) {
  await engine.init();
  let endBeat = 0;
  engine.tracks.forEach((t) => {
    if (t.muted) return;
    t.clips.forEach((c) => {
      endBeat = Math.max(endBeat, (c.startBeat || 0) + (c.durationBeats || 0));
    });
  });
  if (endBeat < 0.25) endBeat = 4;
  const bars = Math.min(maxBars, Math.ceil(endBeat / 4) + 0.25);
  const durationSec = (bars * 4) * (60 / engine.bpm) + padSec;
  const sr = engine.ctx.sampleRate;
  const frames = Math.ceil(durationSec * sr);
  const offline = new OfflineAudioContext(2, frames, sr);
  const master = offline.createGain();
  master.gain.value = engine._masterVol ?? 0.85;
  master.connect(offline.destination);

  const spb = 60 / engine.bpm;
  const soloOn = engine.tracks.some((t) => t.solo);

  for (const track of engine.tracks) {
    if (track.muted) continue;
    if (soloOn && !track.solo) continue;
    const g = offline.createGain();
    g.gain.value = track.volume ?? 0.8;
    const panner = offline.createStereoPanner?.() || null;
    if (panner) {
      panner.pan.value = track.pan ?? 0;
      g.connect(panner);
      panner.connect(master);
    } else {
      g.connect(master);
    }

    for (const clip of track.clips) {
      const when = (clip.startBeat || 0) * spb;
      if (clip.notes?.length) {
        for (const n of clip.notes) {
          const noteWhen = when + (n.beat || 0) * spb;
          const osc = offline.createOscillator();
          const ng = offline.createGain();
          osc.type = n.wave || 'sine';
          osc.frequency.value = n.freq || 440;
          const dur = (n.dur || 0.25) * spb;
          const peak = 0.35 * Math.max(0.05, Math.min(1, n.vel ?? 1));
          ng.gain.setValueAtTime(0.0001, noteWhen);
          ng.gain.exponentialRampToValueAtTime(peak, noteWhen + 0.01);
          ng.gain.exponentialRampToValueAtTime(0.0001, noteWhen + dur);
          osc.connect(ng);
          ng.connect(g);
          osc.start(noteWhen);
          osc.stop(noteWhen + dur + 0.02);
        }
        continue;
      }
      let buffer = clip.buffer;
      if (!buffer && clip.recipe) {
        buffer = engine.createBufferFromRecipe(clip.recipe);
        clip.buffer = buffer;
      }
      if (!buffer) continue;
      const src = offline.createBufferSource();
      src.buffer = buffer;
      src.connect(g);
      try {
        src.start(when);
      } catch (_) {}
    }
  }

  return offline.startRendering();
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/** Play AudioBuffer into MediaStreamDestination and capture with MediaRecorder. */
async function recordBuffer(buffer, mimeType) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  try {
    const dest = ctx.createMediaStreamDestination();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    // Silent monitor path keeps the graph alive without blasting speakers during capture
    const mute = ctx.createGain();
    mute.gain.value = 0.0001;
    src.connect(dest);
    src.connect(mute);
    mute.connect(ctx.destination);

    const chunks = [];
    const rec = new MediaRecorder(dest.stream, { mimeType, audioBitsPerSecond: 192000 });
    const done = new Promise((resolve, reject) => {
      rec.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
      rec.onerror = () => reject(new Error('MediaRecorder failed'));
      rec.onstop = () => resolve(new Blob(chunks, { type: mimeType.split(';')[0] }));
    });
    rec.start(50);
    src.start();
    await new Promise((r) => {
      src.onended = r;
      setTimeout(r, (buffer.duration + 0.4) * 1000);
    });
    if (rec.state !== 'inactive') rec.stop();
    const blob = await done;
    await ctx.close().catch(() => {});
    if (!blob.size) throw new Error('Empty recording');
    return blob;
  } catch (err) {
    try { await ctx.close(); } catch (_) {}
    throw err;
  }
}

/**
 * Export mixdown in the chosen format.
 * @returns {{ ok: boolean, format: string, demo: boolean, note?: string, filename?: string }}
 */
export async function exportAudio(engine, formatId, toast) {
  const fmt = FORMATS.find((f) => f.id === formatId) || FORMATS[0];
  const stamp = Date.now();
  const base = `mm-soundx-${stamp}`;

  toast?.(`Rendering mixdown for ${fmt.label}…`);
  let buffer;
  try {
    buffer = await renderMixdown(engine);
  } catch (err) {
    toast?.(`Mixdown failed: ${err.message || err}`, 'error');
    return { ok: false, format: fmt.id, demo: false, note: String(err) };
  }

  if (fmt.mode === 'pcm') {
    const blob = encodeWav(buffer);
    const filename = `${base}.wav`;
    downloadBlob(blob, filename);
    toast?.('WAV exported (PCM 16-bit)');
    return { ok: true, format: 'wav', demo: false, filename };
  }

  const mime = pickRecorderMime(fmt.recorderTypes || []);
  if (mime) {
    try {
      const blob = await recordBuffer(buffer, mime);
      const filename = `${base}.${fmt.ext}`;
      downloadBlob(blob, filename);
      const demo = fmt.id === 'ogg' && !/vorbis/i.test(mime);
      const note = demo
        ? 'Browser captured Ogg Opus (Vorbis rarely available in MediaRecorder) — working Ogg path'
        : `${fmt.label} exported via MediaRecorder`;
      toast?.(demo ? `Ogg Opus exported · DEMO-honest (not Vorbis)` : `${fmt.label} exported`);
      return { ok: true, format: fmt.id, demo, note, filename, mime };
    } catch (err) {
      console.warn('[SoundX export]', fmt.id, err);
    }
  }

  // DEMO fallback: real WAV bytes with the requested extension + honest toast
  const wav = encodeWav(buffer);
  const filename = `${base}.${fmt.ext}.wav`;
  downloadBlob(wav, filename);
  const note = `${fmt.label} encoder unavailable in this browser — downloaded PCM WAV as ${filename} (DEMO fallback)`;
  toast?.(note, 'warn');
  return { ok: true, format: fmt.id, demo: true, note, filename };
}

export { FORMATS as EXPORT_FORMATS };
