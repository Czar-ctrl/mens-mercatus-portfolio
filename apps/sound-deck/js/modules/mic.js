/**
 * Mic Input — getUserMedia recording (USB / condenser via class-compliant interface).
 * Any browser-visible audio input device.
 */
export function mountMic(root, engine, toast, getSelectedTrackId) {
  root.innerHTML = `
    <div class="panel-head">
      <h2>Mic Input</h2>
      <span class="badge">getUserMedia</span>
    </div>
    <p class="panel-desc">Record from any browser-visible mic — built-in, <strong>USB class-compliant</strong>, or condenser via audio interface. Grant permission when prompted.</p>

    <label class="field block">
      <span>Input device</span>
      <select data-device>
        <option value="">Default input</option>
      </select>
    </label>

    <div class="meter-wrap" title="Input level">
      <div class="meter-label">Level</div>
      <div class="meter"><i data-meter></i></div>
    </div>

    <div class="btn-row">
      <button type="button" class="btn ghost" data-refresh title="Refresh device list">Refresh devices</button>
      <button type="button" class="btn ghost" data-arm title="Arm monitoring">Arm monitor</button>
      <button type="button" class="btn primary" data-rec>Record</button>
      <button type="button" class="btn ghost" data-stop-rec disabled>Stop</button>
    </div>

    <label class="field block">
      <span>Target track</span>
      <select data-track></select>
    </label>

    <div class="stem-status" data-status>Idle — pick a device and click Record</div>
    <p class="fineprint">Clips land as AudioBuffers on the selected timeline track at the current playhead (or beat 0 if stopped).</p>
  `;

  const deviceSel = root.querySelector('[data-device]');
  const trackSel = root.querySelector('[data-track]');
  const status = root.querySelector('[data-status]');
  const meterEl = root.querySelector('[data-meter]');
  const recBtn = root.querySelector('[data-rec]');
  const stopBtn = root.querySelector('[data-stop-rec]');
  const armBtn = root.querySelector('[data-arm]');

  let mediaStream = null;
  let mediaRecorder = null;
  let monitorNode = null;
  let analyser = null;
  let meterRaf = 0;
  let chunks = [];
  let armed = false;
  let recStartBeat = 0;

  function refreshTracks() {
    trackSel.innerHTML = engine.tracks.map((t) =>
      `<option value="${t.id}" ${t.id === getSelectedTrackId?.() ? 'selected' : ''}>${t.name}</option>`
    ).join('');
  }

  async function listDevices() {
    try {
      // Need permission before labels appear
      if (!mediaStream) {
        const tmp = await navigator.mediaDevices.getUserMedia({ audio: true });
        tmp.getTracks().forEach((t) => t.stop());
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter((d) => d.kind === 'audioinput');
      const cur = deviceSel.value;
      deviceSel.innerHTML = '<option value="">Default input</option>' +
        inputs.map((d) => `<option value="${d.deviceId}">${d.label || 'Mic ' + d.deviceId.slice(0, 6)}</option>`).join('');
      if (cur) deviceSel.value = cur;
      status.textContent = `${inputs.length} input device(s) visible to the browser`;
    } catch (err) {
      status.textContent = `Mic permission needed: ${err.message}`;
      toast('Allow microphone access', 'warn');
    }
  }

  async function openStream() {
    await engine.init();
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
      mediaStream = null;
    }
    const constraints = {
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        ...(deviceSel.value ? { deviceId: { exact: deviceSel.value } } : {}),
      },
    };
    mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    return mediaStream;
  }

  function startMeter(stream) {
    cancelAnimationFrame(meterRaf);
    const src = engine.ctx.createMediaStreamSource(stream);
    analyser = engine.ctx.createAnalyser();
    analyser.fftSize = 2048;
    src.connect(analyser);
    if (armed) {
      monitorNode = engine.ctx.createGain();
      monitorNode.gain.value = 0.35;
      src.connect(monitorNode);
      monitorNode.connect(engine.masterGain);
    }
    const data = new Uint8Array(analyser.fftSize);
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      meterEl.style.width = `${Math.min(100, rms * 280)}%`;
      meterRaf = requestAnimationFrame(tick);
    };
    tick();
    return src;
  }

  function stopMeter() {
    cancelAnimationFrame(meterRaf);
    meterEl.style.width = '0%';
    try { monitorNode?.disconnect(); } catch (_) {}
    monitorNode = null;
  }

  armBtn.addEventListener('click', async () => {
    armed = !armed;
    armBtn.classList.toggle('primary', armed);
    armBtn.textContent = armed ? 'Monitor ON' : 'Arm monitor';
    if (armed) {
      try {
        await openStream();
        startMeter(mediaStream);
        status.textContent = 'Monitoring armed — watch levels (careful with speakers ↔ mic feedback)';
        toast('Input monitor on');
      } catch (err) {
        armed = false;
        status.textContent = err.message;
        toast('Could not open mic', 'error');
      }
    } else {
      stopMeter();
      mediaStream?.getTracks().forEach((t) => t.stop());
      mediaStream = null;
      status.textContent = 'Monitor off';
    }
  });

  recBtn.addEventListener('click', async () => {
    refreshTracks();
    try {
      await openStream();
      startMeter(mediaStream);
      chunks = [];
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
      mediaRecorder = new MediaRecorder(mediaStream, mime ? { mimeType: mime } : undefined);
      mediaRecorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      mediaRecorder.onstop = async () => {
        stopMeter();
        status.textContent = 'Decoding take…';
        try {
          const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' });
          const ab = await blob.arrayBuffer();
          const buffer = await engine.ctx.decodeAudioData(ab.slice(0));
          const trackId = trackSel.value || engine.tracks[0]?.id;
          const startBeat = engine.isPlaying ? recStartBeat : (engine.currentBeat || 0);
          const durBeats = Math.max(0.25, buffer.duration / engine.secondsPerBeat);
          engine.addClip(trackId, {
            name: `Mic ${new Date().toLocaleTimeString()}`,
            startBeat,
            durationBeats: durBeats,
            color: '#F5C518',
            buffer,
          });
          status.textContent = `Recorded ${buffer.duration.toFixed(2)}s → timeline`;
          toast('Mic take placed on timeline');
        } catch (err) {
          status.textContent = `Decode failed: ${err.message}`;
          toast('Could not decode recording', 'error');
        }
        mediaStream?.getTracks().forEach((t) => t.stop());
        mediaStream = null;
        recBtn.disabled = false;
        stopBtn.disabled = true;
      };
      recStartBeat = engine.currentBeat || 0;
      mediaRecorder.start(100);
      recBtn.disabled = true;
      stopBtn.disabled = false;
      status.textContent = 'Recording…';
      toast('Recording mic');
    } catch (err) {
      status.textContent = err.message;
      toast('Mic record failed', 'error');
    }
  });

  stopBtn.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  });

  root.querySelector('[data-refresh]').addEventListener('click', listDevices);
  engine.on('tracks', refreshTracks);
  refreshTracks();
  listDevices().catch(() => {});
}
