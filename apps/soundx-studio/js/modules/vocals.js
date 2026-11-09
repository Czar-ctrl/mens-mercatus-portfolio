/**
 * Vocals — record + processing chain (gate / HPF / comp / de-ess stub / reverb)
 */
export function mountVocals(root, engine, toast, getSelectedTrackId) {
  root.innerHTML = `
    <div class="panel-head">
      <h2>Vocals</h2>
      <span class="badge">Chain</span>
    </div>
    <p class="panel-desc">Record a vocal take, monitor through a light chain, then bounce the processed buffer to a track. Gate / de-esser are honest stubs; HPF, compressor, and reverb are live Web Audio.</p>

    <div class="vocal-chain">
      <label class="toggle"><input type="checkbox" data-fx="gate" checked /> <span>Noise gate (stub)</span></label>
      <label class="field block"><span>High-pass (Hz)</span>
        <input type="range" min="20" max="300" value="80" data-fx="hpf" />
        <em data-hpf-val>80</em>
      </label>
      <label class="field block"><span>Compressor threshold</span>
        <input type="range" min="-60" max="0" value="-24" data-fx="thresh" />
        <em data-thresh-val>-24 dB</em>
      </label>
      <label class="toggle"><input type="checkbox" data-fx="deess" checked /> <span>De-esser (stub)</span></label>
      <label class="field block"><span>Reverb mix</span>
        <input type="range" min="0" max="100" value="18" data-fx="verb" />
        <em data-verb-val>18%</em>
      </label>
    </div>

    <div class="meter-wrap"><div class="meter-label">Input</div><div class="meter"><i data-meter></i></div></div>

    <div class="btn-row">
      <button type="button" class="btn primary" data-rec>Record vocal</button>
      <button type="button" class="btn ghost" data-stop disabled>Stop</button>
      <button type="button" class="btn ghost" data-bounce disabled>Bounce to track</button>
    </div>
    <label class="field block"><span>Target track</span><select data-track></select></label>
    <div class="stem-status" data-status>Ready — chain live on monitor when recording</div>
  `;

  const status = root.querySelector('[data-status]');
  const meterEl = root.querySelector('[data-meter]');
  const trackSel = root.querySelector('[data-track]');
  const recBtn = root.querySelector('[data-rec]');
  const stopBtn = root.querySelector('[data-stop]');
  const bounceBtn = root.querySelector('[data-bounce]');

  let stream = null;
  let recorder = null;
  let chunks = [];
  let lastBuffer = null;
  let chain = null;
  let meterRaf = 0;

  function refreshTracks() {
    const sel = getSelectedTrackId?.();
    trackSel.innerHTML = engine.tracks.map((t) =>
      `<option value="${t.id}" ${t.id === sel ? 'selected' : ''}>${t.name}</option>`
    ).join('');
  }
  refreshTracks();
  engine.on('tracks', refreshTracks);

  root.querySelector('[data-fx="hpf"]').addEventListener('input', (e) => {
    root.querySelector('[data-hpf-val]').textContent = e.target.value;
    if (chain?.hpf) chain.hpf.frequency.value = Number(e.target.value);
  });
  root.querySelector('[data-fx="thresh"]').addEventListener('input', (e) => {
    root.querySelector('[data-thresh-val]').textContent = `${e.target.value} dB`;
    if (chain?.comp) chain.comp.threshold.value = Number(e.target.value);
  });
  root.querySelector('[data-fx="verb"]').addEventListener('input', (e) => {
    root.querySelector('[data-verb-val]').textContent = `${e.target.value}%`;
    if (chain?.verbGain) chain.verbGain.gain.value = Number(e.target.value) / 100 * 0.5;
  });

  async function buildChain(ctx) {
    const hpf = ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = Number(root.querySelector('[data-fx="hpf"]').value);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = Number(root.querySelector('[data-fx="thresh"]').value);
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.01;
    comp.release.value = 0.15;
    const dry = ctx.createGain();
    dry.gain.value = 1;
    const verbGain = ctx.createGain();
    verbGain.gain.value = Number(root.querySelector('[data-fx="verb"]').value) / 100 * 0.5;
    // short synthetic impulse
    const len = ctx.sampleRate * 0.8;
    const impulse = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = impulse.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2) * 0.35;
    }
    const conv = ctx.createConvolver();
    conv.buffer = impulse;
    const out = ctx.createGain();
    out.gain.value = 0.85;
    hpf.connect(comp);
    comp.connect(dry);
    dry.connect(out);
    comp.connect(conv);
    conv.connect(verbGain);
    verbGain.connect(out);
    return { input: hpf, hpf, comp, verbGain, out };
  }

  async function processOffline(buffer) {
    const ctx = engine.ctx;
    const offline = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    const src = offline.createBufferSource();
    src.buffer = buffer;
    const hpf = offline.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = Number(root.querySelector('[data-fx="hpf"]').value);
    const comp = offline.createDynamicsCompressor();
    comp.threshold.value = Number(root.querySelector('[data-fx="thresh"]').value);
    comp.ratio.value = 4;
    comp.attack.value = 0.01;
    comp.release.value = 0.15;
    // simple gate stub: soft noise floor trim via gain curve on amplitude
    const gateOn = root.querySelector('[data-fx="gate"]').checked;
    const deessOn = root.querySelector('[data-fx="deess"]').checked;
    const deess = offline.createBiquadFilter();
    deess.type = 'peaking';
    deess.frequency.value = 6500;
    deess.Q.value = 1.2;
    deess.gain.value = deessOn ? -4 : 0;
    const verbMix = Number(root.querySelector('[data-fx="verb"]').value) / 100;
    const dry = offline.createGain();
    dry.gain.value = 1 - verbMix * 0.4;
    const wet = offline.createGain();
    wet.gain.value = verbMix * 0.45;
    const len = Math.floor(offline.sampleRate * 0.7);
    const impulse = offline.createBuffer(2, len, offline.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = impulse.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4) * 0.3;
    }
    const conv = offline.createConvolver();
    conv.buffer = impulse;
    src.connect(hpf);
    hpf.connect(deess);
    deess.connect(comp);
    comp.connect(dry);
    dry.connect(offline.destination);
    comp.connect(conv);
    conv.connect(wet);
    wet.connect(offline.destination);
    src.start(0);
    let rendered = await offline.startRendering();
    if (gateOn) {
      // soft gate: attenuate samples below threshold
      for (let c = 0; c < rendered.numberOfChannels; c++) {
        const data = rendered.getChannelData(c);
        const thr = 0.02;
        for (let i = 0; i < data.length; i++) {
          if (Math.abs(data[i]) < thr) data[i] *= 0.15;
        }
      }
    }
    return rendered;
  }

  recBtn.addEventListener('click', async () => {
    try {
      await engine.init();
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false },
      });
      chain = await buildChain(engine.ctx);
      const src = engine.ctx.createMediaStreamSource(stream);
      const analyser = engine.ctx.createAnalyser();
      src.connect(analyser);
      analyser.connect(chain.input);
      chain.out.connect(engine.masterGain);
      const data = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        meterEl.style.width = `${Math.min(100, Math.sqrt(sum / data.length) * 260)}%`;
        meterRaf = requestAnimationFrame(tick);
      };
      tick();

      chunks = [];
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = async () => {
        cancelAnimationFrame(meterRaf);
        try { chain?.out?.disconnect(); } catch (_) {}
        stream?.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        const ab = await blob.arrayBuffer();
        lastBuffer = await engine.ctx.decodeAudioData(ab.slice(0));
        bounceBtn.disabled = false;
        status.textContent = `Take ${lastBuffer.duration.toFixed(2)}s captured — Bounce applies chain`;
        toast('Vocal take ready');
        recBtn.disabled = false;
        stopBtn.disabled = true;
      };
      recorder.start(100);
      recBtn.disabled = true;
      stopBtn.disabled = false;
      status.textContent = 'Recording vocals through chain…';
      toast('Vocal record');
    } catch (err) {
      status.textContent = err.message;
      toast('Vocal mic failed', 'error');
    }
  });

  stopBtn.addEventListener('click', () => {
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  });

  bounceBtn.addEventListener('click', async () => {
    if (!lastBuffer) return;
    status.textContent = 'Rendering vocal chain…';
    try {
      const processed = await processOffline(lastBuffer);
      const trackId = trackSel.value || engine.tracks[0]?.id;
      const startBeat = engine.currentBeat || 0;
      engine.addClip(trackId, {
        name: `Vocal ${new Date().toLocaleTimeString()}`,
        startBeat,
        durationBeats: Math.max(0.25, processed.duration / engine.secondsPerBeat),
        color: '#F5C518',
        buffer: processed,
      });
      status.textContent = 'Processed vocal bounced to timeline';
      toast('Vocal bounced');
    } catch (err) {
      status.textContent = err.message;
      toast('Bounce failed', 'error');
    }
  });
}
