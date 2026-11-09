/**
 * Stem Split — polished demo DSP band split (NOT Demucs / ML separation).
 * OfflineAudioContext filter banks → 4 timeline tracks.
 */
function openGodFeature(id) {
  document.dispatchEvent(new CustomEvent('sx-god:focus', { detail: { id } }));
}

export function mountStems(root, engine, toast) {
  root.innerHTML = `
    <div class="panel-head">
      <h2>Stem Split</h2>
      <span class="badge warn">Demo DSP</span>
    </div>
    <p class="panel-desc">Load one audio file and split it into <strong>4 EQ bands</strong> (low / mid / high / residual) via offline filters. Honest demo — <strong>not</strong> neural source separation (Demucs, UVR, etc.).</p>

    <div class="stem-drop" data-drop tabindex="0" role="button" aria-label="Drop audio file here">
      <div class="stem-drop-inner">
        <strong>Drop audio here</strong>
        <span>WAV, MP3, OGG, FLAC</span>
      </div>
      <label class="btn sm primary file-btn stem-browse">
        Browse
        <input type="file" accept="audio/*,.wav,.mp3,.ogg,.flac,.m4a" data-file hidden />
      </label>
    </div>

    <div class="stem-file-meta" data-meta hidden>
      <div class="stem-file-name" data-fname>—</div>
      <div class="stem-file-stats" data-fstats>—</div>
      <div class="stem-wave" data-wave aria-hidden="true"></div>
    </div>

    <label class="field block stem-opt">
      <span>Split mode</span>
      <select data-mode>
        <option value="standard">Standard — LP / BP / HP / Notch</option>
        <option value="wide">Wide mid — broader bandpass</option>
        <option value="tight">Tight — steeper crossover feel</option>
      </select>
    </label>

    <label class="toggle stem-opt" title="Replace clips on first 4 tracks">
      <input type="checkbox" data-replace checked />
      <span>Replace tracks 1–4</span>
    </label>

    <div class="stem-progress" data-progress hidden>
      <div class="stem-progress-bar"><i data-pbar></i></div>
      <span data-ptext>0%</span>
    </div>

    <div class="stem-status" data-status>No file loaded — drop or browse to begin</div>

    <div class="btn-row">
      <button type="button" class="btn primary" data-split disabled>Split to 4 tracks</button>
      <button type="button" class="btn ghost" data-preview disabled title="Audition dry original">Preview dry</button>
      <button type="button" class="btn ghost" data-clear disabled>Clear</button>
    </div>
    <div class="btn-row sx-god-hooks" aria-label="God Mode shortcuts">
      <button type="button" class="btn ghost sm" data-god-hook="stem-remix-desk" title="Open God Mode · Stem Remix Desk">God: Stem Remix</button>
      <button type="button" class="btn ghost sm" data-god-hook="key-bpm-lock" title="Open God Mode · Key/BPM Lock Warp">God: Key/BPM Lock</button>
      <button type="button" class="btn ghost sm" data-god-hook="stem-colorist" title="Open God Mode · Stem Colorist (Wave 2)">God: Stem Colorist</button>
      <button type="button" class="btn ghost sm" data-god-hook="stem-role-classifier" title="Open God Mode · Stem Role Classifier (Wave 3)">God: Role Classifier</button>
    </div>

    <ul class="stem-legend">
      <li><span class="dot" style="background:#F5C518"></span> <strong>Low</strong> — energy below ~250 Hz</li>
      <li><span class="dot" style="background:#E8A838"></span> <strong>Mid</strong> — body ~250 Hz–2.5 kHz</li>
      <li><span class="dot" style="background:#C9A227"></span> <strong>High</strong> — air above ~2.5 kHz</li>
      <li><span class="dot" style="background:#8a7a40"></span> <strong>Residual</strong> — notch / complement blend</li>
    </ul>
    <p class="fineprint">For real stems (vocals/drums/bass), export from a dedicated ML tool, then import each file onto its own track.</p>
  `;

  let decodedBuffer = null;
  let fileName = '';
  let previewSrc = null;

  const status = root.querySelector('[data-status]');
  const splitBtn = root.querySelector('[data-split]');
  const previewBtn = root.querySelector('[data-preview]');
  const clearBtn = root.querySelector('[data-clear]');
  const fileInput = root.querySelector('[data-file]');
  const drop = root.querySelector('[data-drop]');
  const meta = root.querySelector('[data-meta]');
  const fname = root.querySelector('[data-fname]');
  const fstats = root.querySelector('[data-fstats]');
  const wave = root.querySelector('[data-wave]');
  const progress = root.querySelector('[data-progress]');
  const pbar = root.querySelector('[data-pbar]');
  const ptext = root.querySelector('[data-ptext]');
  const modeSel = root.querySelector('[data-mode]');
  const replaceChk = root.querySelector('[data-replace]');

  root.addEventListener('click', (e) => {
    const hook = e.target.closest('[data-god-hook]');
    if (!hook) return;
    e.preventDefault();
    openGodFeature(hook.dataset.godHook);
  });

  function setProgress(pct, label) {
    progress.hidden = false;
    pbar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    ptext.textContent = label || `${Math.round(pct)}%`;
  }

  function hideProgress() {
    progress.hidden = true;
  }

  function drawWaveform(buffer) {
    const w = 280;
    const h = 40;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0A0A0A';
    ctx.fillRect(0, 0, w, h);
    const data = buffer.getChannelData(0);
    const step = Math.floor(data.length / w);
    ctx.strokeStyle = '#F5C518';
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      let min = 1;
      let max = -1;
      for (let i = 0; i < step; i++) {
        const v = data[x * step + i] || 0;
        if (v < min) min = v;
        if (v > max) max = v;
      }
      const y1 = ((1 + min) / 2) * h;
      const y2 = ((1 + max) / 2) * h;
      ctx.moveTo(x, y1);
      ctx.lineTo(x, y2);
    }
    ctx.stroke();
    wave.innerHTML = '';
    wave.appendChild(canvas);
  }

  async function ingestFile(file) {
    if (!file) return;
    await engine.init();
    status.textContent = `Decoding ${file.name}…`;
    setProgress(10, 'Decoding…');
    splitBtn.disabled = true;
    try {
      const arr = await file.arrayBuffer();
      setProgress(40, 'Decoding…');
      decodedBuffer = await engine.ctx.decodeAudioData(arr.slice(0));
      fileName = file.name;
      fname.textContent = file.name;
      fstats.textContent = `${decodedBuffer.duration.toFixed(2)}s · ${decodedBuffer.numberOfChannels} ch · ${decodedBuffer.sampleRate} Hz`;
      meta.hidden = false;
      drawWaveform(decodedBuffer);
      status.textContent = 'Ready to split into 4 demo DSP bands';
      splitBtn.disabled = false;
      previewBtn.disabled = false;
      clearBtn.disabled = false;
      hideProgress();
      toast('Audio decoded — ready to split');
      try {
        window.__mmStemBuffer = decodedBuffer;
        root.dispatchEvent(new CustomEvent('mm-stem-decoded', { detail: { buffer: decodedBuffer, name: fileName }, bubbles: true }));
      } catch (_) {}
    } catch (err) {
      status.textContent = `Could not decode: ${err.message || 'unsupported format'}`;
      decodedBuffer = null;
      meta.hidden = true;
      splitBtn.disabled = true;
      previewBtn.disabled = true;
      hideProgress();
      toast('Decode failed', 'error');
    }
  }

  fileInput.addEventListener('change', (e) => {
    ingestFile(e.target.files?.[0]);
    e.target.value = '';
  });

  ['dragenter', 'dragover'].forEach((ev) => {
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach((ev) => {
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.remove('dragover');
    });
  });
  drop.addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) ingestFile(file);
  });

  previewBtn.addEventListener('click', async () => {
    if (!decodedBuffer) return;
    await engine.init();
    try { previewSrc?.stop(); } catch (_) {}
    previewSrc = engine.ctx.createBufferSource();
    previewSrc.buffer = decodedBuffer;
    const g = engine.ctx.createGain();
    g.gain.value = 0.7;
    previewSrc.connect(g);
    g.connect(engine.masterGain);
    previewSrc.start();
    toast('Previewing dry original');
    status.textContent = 'Playing dry preview…';
    previewSrc.onended = () => {
      status.textContent = 'Ready to split into 4 demo DSP bands';
    };
  });

  clearBtn.addEventListener('click', () => {
    try { previewSrc?.stop(); } catch (_) {}
    decodedBuffer = null;
    fileName = '';
    try { window.__mmStemBuffer = null; root.dispatchEvent(new CustomEvent('mm-stem-decoded', { detail: { buffer: null }, bubbles: true })); } catch (_) {}
    meta.hidden = true;
    splitBtn.disabled = true;
    previewBtn.disabled = true;
    clearBtn.disabled = true;
    hideProgress();
    status.textContent = 'No file loaded — drop or browse to begin';
    toast('Stem input cleared');
  });

  splitBtn.addEventListener('click', async () => {
    if (!decodedBuffer) return;
    await engine.init();
    splitBtn.disabled = true;
    status.textContent = 'Rendering band splits (offline)…';
    setProgress(5, 'Starting…');

    try {
      const mode = modeSel.value;
      const bands = await splitIntoBands(engine.ctx, decodedBuffer, mode, (pct, label) => {
        setProgress(pct, label);
      });

      // normalize peak per band so quiet filters still audible
      bands.forEach(normalizePeak);

      const names = ['Stem Low', 'Stem Mid', 'Stem High', 'Stem Residual'];
      const colors = ['#F5C518', '#E8A838', '#C9A227', '#8a7a40'];

      if (replaceChk.checked) {
        while (engine.tracks.length < 4) engine.addTrack('audio');
      } else {
        for (let i = 0; i < 4; i++) engine.addTrack('audio', names[i]);
      }

      const startIdx = replaceChk.checked ? 0 : engine.tracks.length - 4;

      bands.forEach((buf, i) => {
        const track = engine.tracks[startIdx + i];
        track.name = names[i];
        track.type = 'audio';
        track.clips = [];
        const durBeats = Math.max(1, buf.duration / engine.secondsPerBeat);
        engine.addClip(track.id, {
          name: `${names[i]} · ${fileName}`,
          startBeat: 0,
          durationBeats: durBeats,
          color: colors[i],
          buffer: buf,
        });
      });

      setProgress(100, 'Done');
      status.textContent = `Split complete — 4 band stems on timeline. Demo DSP only (mode: ${mode}).`;
      toast('Band stems placed on timeline');
      engine._emit('tracks', engine.tracks);
    } catch (err) {
      status.textContent = `Split failed: ${err.message || err}`;
      toast('Stem split failed', 'error');
    }
    splitBtn.disabled = false;
    setTimeout(hideProgress, 800);
  });
}

function bandSpecs(mode) {
  if (mode === 'wide') {
    return [
      { type: 'lowpass', freq: 300, Q: 0.7 },
      { type: 'bandpass', freq: 900, Q: 0.35 },
      { type: 'highpass', freq: 2000, Q: 0.7 },
      { type: 'notch', freq: 800, Q: 0.25 },
    ];
  }
  if (mode === 'tight') {
    return [
      { type: 'lowpass', freq: 200, Q: 1.2 },
      { type: 'bandpass', freq: 1000, Q: 0.9 },
      { type: 'highpass', freq: 3200, Q: 1.1 },
      { type: 'notch', freq: 1200, Q: 0.5 },
    ];
  }
  return [
    { type: 'lowpass', freq: 250, Q: 0.707 },
    { type: 'bandpass', freq: 800, Q: 0.5 },
    { type: 'highpass', freq: 2500, Q: 0.707 },
    { type: 'notch', freq: 1000, Q: 0.3 },
  ];
}

async function splitIntoBands(ctx, buffer, mode, onProgress) {
  const specs = bandSpecs(mode);
  const results = [];
  // Cap very long files for MVP responsiveness (~90s)
  const maxSamples = Math.min(buffer.length, Math.floor(buffer.sampleRate * 90));
  const trimmed = maxSamples < buffer.length ? sliceBuffer(ctx, buffer, maxSamples) : buffer;

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    onProgress?.(10 + i * 20, `Band ${i + 1}/4…`);
    const offline = new OfflineAudioContext(
      trimmed.numberOfChannels,
      trimmed.length,
      trimmed.sampleRate
    );
    const src = offline.createBufferSource();
    src.buffer = trimmed;
    const filter = offline.createBiquadFilter();
    filter.type = spec.type;
    filter.frequency.value = spec.freq;
    if (spec.Q != null) filter.Q.value = spec.Q;
    // cascade a second similar filter for tighter mode feel
    let node = filter;
    src.connect(filter);
    if (mode === 'tight' && spec.type !== 'notch') {
      const f2 = offline.createBiquadFilter();
      f2.type = spec.type;
      f2.frequency.value = spec.freq;
      if (spec.Q != null) f2.Q.value = spec.Q;
      filter.connect(f2);
      node = f2;
    }
    node.connect(offline.destination);
    src.start(0);
    results.push(await offline.startRendering());
    onProgress?.(25 + i * 20, `Band ${i + 1}/4 done`);
  }
  return results;
}

function sliceBuffer(ctx, buffer, length) {
  const out = ctx.createBuffer(buffer.numberOfChannels, length, buffer.sampleRate);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    out.copyToChannel(buffer.getChannelData(c).slice(0, length), c);
  }
  return out;
}

function normalizePeak(buffer, target = 0.85) {
  let peak = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) {
      const a = Math.abs(data[i]);
      if (a > peak) peak = a;
    }
  }
  if (peak < 1e-6) return;
  const g = target / peak;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) data[i] *= g;
  }
}
