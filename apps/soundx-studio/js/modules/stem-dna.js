/**
 * Stem DNA — Web Audio heuristics for key / tempo / mood on uploaded stems.
 * Honest DEMO AI (not ML). Auto-tags stems; Live Loops can prefer compatible clips.
 */
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function hzToMidi(hz) {
  return 69 + 12 * Math.log2(hz / 440);
}

function correlate(chroma, profile, shift) {
  let s = 0;
  for (let i = 0; i < 12; i++) s += chroma[i] * profile[(i + shift) % 12];
  return s;
}

/** Estimate musical key via chroma + Krumhansl-ish profiles (heuristic). */
export function estimateKey(buffer) {
  const ch = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  const chroma = new Float64Array(12);
  const hop = Math.floor(sr / 40);
  const win = Math.min(2048, Math.floor(sr / 20));
  for (let i = 0; i + win < ch.length; i += hop) {
    // zero-crossing + energy proxy toward pitch class via autocorrelation peak
    let bestLag = 0;
    let best = 0;
    const minLag = Math.floor(sr / 800);
    const maxLag = Math.floor(sr / 80);
    for (let lag = minLag; lag < maxLag; lag += 2) {
      let sum = 0;
      for (let j = 0; j < win - lag; j += 4) sum += ch[i + j] * ch[i + j + lag];
      if (sum > best) { best = sum; bestLag = lag; }
    }
    if (bestLag > 0 && best > 0.01) {
      const hz = sr / bestLag;
      if (hz > 55 && hz < 1200) {
        const midi = Math.round(hzToMidi(hz));
        chroma[((midi % 12) + 12) % 12] += Math.sqrt(best);
      }
    }
  }
  let tot = 0;
  for (let i = 0; i < 12; i++) tot += chroma[i];
  if (tot < 1e-6) return { key: 'C', mode: 'major', label: 'C major', confidence: 0.15 };

  let bestKey = 0;
  let bestMode = 'major';
  let bestScore = -Infinity;
  for (let s = 0; s < 12; s++) {
    const maj = correlate(chroma, MAJOR_PROFILE, s);
    const min = correlate(chroma, MINOR_PROFILE, s);
    if (maj > bestScore) { bestScore = maj; bestKey = s; bestMode = 'major'; }
    if (min > bestScore) { bestScore = min; bestKey = s; bestMode = 'minor'; }
  }
  const label = `${NOTE_NAMES[bestKey]} ${bestMode}`;
  return { key: NOTE_NAMES[bestKey], mode: bestMode, label, confidence: Math.min(0.92, 0.35 + bestScore / (tot * 8)) };
}

/** Estimate tempo via onset-energy autocorrelation (heuristic BPM). */
export function estimateTempo(buffer) {
  const ch = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  const hop = 512;
  const energies = [];
  for (let i = 0; i + hop < ch.length; i += hop) {
    let e = 0;
    for (let j = 0; j < hop; j++) e += ch[i + j] * ch[i + j];
    energies.push(e);
  }
  const onset = [];
  for (let i = 1; i < energies.length; i++) {
    onset.push(Math.max(0, energies[i] - energies[i - 1]));
  }
  const fps = sr / hop;
  const minBpm = 70;
  const maxBpm = 180;
  let bestBpm = 120;
  let bestScore = 0;
  for (let bpm = minBpm; bpm <= maxBpm; bpm += 1) {
    const period = (60 / bpm) * fps;
    let score = 0;
    for (let i = 0; i < onset.length; i++) {
      const phase = (i % period) / period;
      if (phase < 0.08 || phase > 0.92) score += onset[i];
    }
    if (score > bestScore) { bestScore = score; bestBpm = bpm; }
  }
  // Prefer even BPMs near common dance tempos when close
  const commons = [90, 100, 110, 120, 128, 140, 150];
  for (const c of commons) {
    if (Math.abs(c - bestBpm) <= 3) bestBpm = c;
  }
  return { bpm: bestBpm, confidence: Math.min(0.88, 0.3 + bestScore / (onset.reduce((a, b) => a + b, 0) + 1e-6)) };
}

/** Mood from spectral / dynamic heuristics. */
export function estimateMood(buffer) {
  const ch = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  let sum = 0;
  let sumSq = 0;
  let zc = 0;
  let prev = 0;
  const n = Math.min(ch.length, sr * 12);
  for (let i = 0; i < n; i++) {
    const v = ch[i];
    sum += Math.abs(v);
    sumSq += v * v;
    if ((v >= 0) !== (prev >= 0)) zc++;
    prev = v;
  }
  const rms = Math.sqrt(sumSq / n);
  const zcr = zc / n;
  const brightness = zcr; // proxy
  let mood = 'chill';
  if (rms > 0.18 && brightness > 0.08) mood = 'energetic';
  else if (rms > 0.12 && brightness < 0.05) mood = 'dark';
  else if (brightness > 0.1) mood = 'bright';
  else if (rms < 0.06) mood = 'ambient';
  else mood = 'groovy';
  return { mood, rms: +rms.toFixed(3), brightness: +brightness.toFixed(3) };
}

export function analyzeStemBuffer(buffer) {
  const key = estimateKey(buffer);
  const tempo = estimateTempo(buffer);
  const mood = estimateMood(buffer);
  const tags = [
    key.label,
    `${tempo.bpm} BPM`,
    mood.mood,
    'stem-dna',
    'DEMO-AI',
  ];
  // Compatibility helpers for Live Loops
  const compat = {
    keyRoot: key.key,
    mode: key.mode,
    bpm: tempo.bpm,
    mood: mood.mood,
    tags,
  };
  return { key, tempo, mood, tags, compat, demo: true };
}

/**
 * Mount Stem DNA UI into an existing stems panel root (appends section).
 * @returns API { lastAnalysis, getCompat, analyze }
 */
export function mountStemDna(root, engine, toast, { onAnalyzed } = {}) {
  let last = null;
  const section = document.createElement('div');
  section.className = 'stem-dna';
  section.setAttribute('data-stem-dna', '');
  section.innerHTML = `
    <div class="panel-head" style="margin-top:14px">
      <h2>Stem DNA</h2>
      <span class="badge warn" title="Web Audio heuristics — not a neural net">DEMO AI</span>
    </div>
    <p class="panel-desc">Analyze the loaded stem for estimated <strong>key</strong>, <strong>tempo</strong>, and <strong>mood</strong>. Tags feed Live Loops compatibility hints. Honest DEMO — autocorrelation / chroma heuristics, not ML.</p>
    <div class="btn-row">
      <button type="button" class="btn primary" data-dna-run disabled>Analyze DNA</button>
      <button type="button" class="btn ghost" data-dna-apply-bpm disabled title="Nudge session BPM toward estimate">Apply BPM</button>
    </div>
    <div class="stem-dna-result" data-dna-result hidden>
      <div class="stem-dna-chips" data-dna-chips></div>
      <p class="fineprint" data-dna-detail></p>
    </div>
  `;
  root.appendChild(section);

  const runBtn = section.querySelector('[data-dna-run]');
  const bpmBtn = section.querySelector('[data-dna-apply-bpm]');
  const result = section.querySelector('[data-dna-result]');
  const chips = section.querySelector('[data-dna-chips]');
  const detail = section.querySelector('[data-dna-detail]');

  function setBuffer(buffer) {
    runBtn.disabled = !buffer;
    if (!buffer) {
      bpmBtn.disabled = true;
      result.hidden = true;
      last = null;
    }
  }

  // Hook: stems module exposes buffer via custom event or we observe decode
  root.addEventListener('mm-stem-decoded', (e) => {
    setBuffer(e.detail?.buffer || null);
  });

  runBtn.addEventListener('click', () => {
    // Prefer event-cached buffer; fall back to window hook
    const buf = section._buffer || window.__mmStemBuffer || null;
    if (!buf) {
      toast?.('Load a stem first (drop / browse above)', 'warn');
      return;
    }
    toast?.('Analyzing Stem DNA…');
    try {
      last = analyzeStemBuffer(buf);
      chips.innerHTML = last.tags.map((t) => `<span class="sx-chip">${t}</span>`).join('');
      detail.textContent = `Key conf ~${Math.round(last.key.confidence * 100)}% · Tempo conf ~${Math.round(last.tempo.confidence * 100)}% · RMS ${last.mood.rms} · DEMO heuristics`;
      result.hidden = false;
      bpmBtn.disabled = false;
      try {
        localStorage.setItem('mm-sound-deck-stem-dna', JSON.stringify({
          tags: last.tags, bpm: last.tempo.bpm, key: last.key.label, mood: last.mood.mood, at: Date.now(),
        }));
      } catch (_) {}
      onAnalyzed?.(last);
      window.dispatchEvent(new CustomEvent('mm-stem-dna', { detail: last }));
      toast?.(`Stem DNA: ${last.key.label} · ${last.tempo.bpm} BPM · ${last.mood.mood}`);
    } catch (err) {
      toast?.(`DNA failed: ${err.message || err}`, 'error');
    }
  });

  bpmBtn.addEventListener('click', () => {
    if (!last) return;
    engine.setBpm(last.tempo.bpm);
    toast?.(`BPM → ${last.tempo.bpm} (from Stem DNA)`);
  });

  // Public: set buffer from stems ingest
  const api = {
    setBuffer(buffer) {
      section._buffer = buffer;
      window.__mmStemBuffer = buffer;
      setBuffer(buffer);
    },
    get lastAnalysis() { return last; },
    getCompat() { return last?.compat || null; },
    analyze(buffer) {
      if (buffer) api.setBuffer(buffer);
      runBtn.click();
      return last;
    },
  };
  return api;
}
