/**
 * Ghost layer — rolling ~30s buffer of master bus audio.
 * Rewind / resample / retrigger like tape echo. Wired via Analyser→ScriptProcessor
 * or AudioWorklet-free ScriptProcessor fallback; does not break existing graph.
 */
const BUFFER_SEC = 30;

export function mountGhostLayer(root, engine, toast) {
  const panel = document.createElement('div');
  panel.className = 'ghost-layer panel-block';
  panel.setAttribute('data-ghost-panel', '');
  panel.innerHTML = `
    <div class="panel-head">
      <h2>Ghost layer</h2>
      <span class="badge" title="Rolling capture of the master bus">Tape · 30s</span>
    </div>
    <p class="panel-desc">Captures everything you hear into a rolling <strong>30s</strong> buffer. Rewind and retrigger like tape echo — dry mix stays untouched.</p>
    <div class="ghost-meter" data-ghost-meter aria-hidden="true"><i data-ghost-fill></i></div>
    <div class="btn-row ghost-controls">
      <label class="toggle" data-sx-tip="Arm rolling capture from the master bus">
        <input type="checkbox" data-ghost-arm checked />
        <span>Arm capture</span>
      </label>
      <label class="field" data-sx-tip="How far back to grab (seconds)">
        <span>Rewind</span>
        <input type="range" min="0.2" max="28" step="0.1" value="2" data-ghost-rewind />
        <em data-ghost-rewind-val>2.0s</em>
      </label>
      <label class="field" data-sx-tip="Playback rate — tape-style resample">
        <span>Rate</span>
        <input type="range" min="0.5" max="1.5" step="0.01" value="1" data-ghost-rate />
        <em data-ghost-rate-val>1.00×</em>
      </label>
    </div>
    <div class="btn-row">
      <button type="button" class="btn primary" data-ghost-fire data-sx-tip="Play the ghost slice through a wet send">Retrigger</button>
      <button type="button" class="btn ghost" data-ghost-stop>Stop ghost</button>
      <button type="button" class="btn ghost" data-ghost-clear>Clear buffer</button>
    </div>
    <div class="stem-status" data-ghost-status>Ghost idle · arm + play to fill buffer</div>
  `;
  root.appendChild(panel);

  const status = panel.querySelector('[data-ghost-status]');
  const fill = panel.querySelector('[data-ghost-fill]');
  const rewindEl = panel.querySelector('[data-ghost-rewind]');
  const rateEl = panel.querySelector('[data-ghost-rate]');
  const rewindVal = panel.querySelector('[data-ghost-rewind-val]');
  const rateVal = panel.querySelector('[data-ghost-rate-val]');
  const armEl = panel.querySelector('[data-ghost-arm]');

  let ring = null;
  let writePos = 0;
  let filled = 0;
  let sampleRate = 44100;
  let processor = null;
  let wetGain = null;
  let ghostSrc = null;
  let armed = true;
  let wired = false;

  function ensureRing(sr) {
    sampleRate = sr;
    const len = Math.ceil(BUFFER_SEC * sr);
    if (!ring || ring.length !== len) {
      ring = new Float32Array(len);
      writePos = 0;
      filled = 0;
    }
  }

  async function wire() {
    if (wired) return;
    await engine.init();
    ensureRing(engine.ctx.sampleRate);
    // Tap analyser (already on master bus) via ScriptProcessor — legacy but universal
    const bufSize = 2048;
    try {
      processor = engine.ctx.createScriptProcessor(bufSize, 1, 1);
    } catch (_) {
      status.textContent = 'Ghost unavailable (no ScriptProcessor)';
      return;
    }
    wetGain = engine.ctx.createGain();
    wetGain.gain.value = 0; // silent tap path stays muted to destination
    processor.onaudioprocess = (e) => {
      if (!armed || !ring) return;
      const input = e.inputBuffer.getChannelData(0);
      for (let i = 0; i < input.length; i++) {
        ring[writePos] = input[i];
        writePos = (writePos + 1) % ring.length;
        if (filled < ring.length) filled++;
      }
      // Keep output silent
      e.outputBuffer.getChannelData(0).fill(0);
      const pct = Math.round((filled / ring.length) * 100);
      if (fill) fill.style.width = `${pct}%`;
    };
    // Connect: analyser → processor → muted gain → destination (graph must stay alive)
    if (engine.analyser) {
      engine.analyser.connect(processor);
    } else {
      engine.masterGain.connect(processor);
    }
    processor.connect(wetGain);
    wetGain.connect(engine.ctx.destination);
    wired = true;
    status.textContent = 'Ghost armed · playing fills the 30s ring';
  }

  armEl.addEventListener('change', async (e) => {
    armed = e.target.checked;
    if (armed) {
      await wire();
      status.textContent = 'Ghost armed';
      toast?.('Ghost capture on');
    } else {
      status.textContent = 'Ghost capture paused';
      toast?.('Ghost capture off');
    }
  });

  rewindEl.addEventListener('input', () => {
    rewindVal.textContent = `${Number(rewindEl.value).toFixed(1)}s`;
  });
  rateEl.addEventListener('input', () => {
    rateVal.textContent = `${Number(rateEl.value).toFixed(2)}×`;
  });

  function sliceBuffer(secondsBack) {
    if (!ring || filled < 256) return null;
    const n = Math.min(filled, Math.floor(secondsBack * sampleRate));
    if (n < 64) return null;
    const out = engine.ctx.createBuffer(1, n, sampleRate);
    const data = out.getChannelData(0);
    let read = (writePos - n + ring.length) % ring.length;
    for (let i = 0; i < n; i++) {
      data[i] = ring[read];
      read = (read + 1) % ring.length;
    }
    return out;
  }

  panel.querySelector('[data-ghost-fire]').addEventListener('click', async () => {
    await wire();
    const sec = Number(rewindEl.value) || 2;
    const rate = Number(rateEl.value) || 1;
    const buf = sliceBuffer(sec);
    if (!buf) {
      toast?.('Ghost buffer empty — play some audio first', 'warn');
      status.textContent = 'Buffer empty';
      return;
    }
    try { ghostSrc?.stop(); } catch (_) {}
    ghostSrc = engine.ctx.createBufferSource();
    ghostSrc.buffer = buf;
    ghostSrc.playbackRate.value = rate;
    const g = engine.ctx.createGain();
    g.gain.value = 0.55;
    // Light feedback-ish delay for tape feel
    const delay = engine.ctx.createDelay(1.0);
    delay.delayTime.value = 0.18;
    const fb = engine.ctx.createGain();
    fb.gain.value = 0.25;
    ghostSrc.connect(g);
    g.connect(engine.masterGain);
    g.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(engine.masterGain);
    ghostSrc.start();
    status.textContent = `Retriggered ${sec.toFixed(1)}s @ ${rate.toFixed(2)}×`;
    toast?.('Ghost retriggered');
  });

  panel.querySelector('[data-ghost-stop]').addEventListener('click', () => {
    try { ghostSrc?.stop(); } catch (_) {}
    ghostSrc = null;
    status.textContent = 'Ghost voice stopped';
  });

  panel.querySelector('[data-ghost-clear]').addEventListener('click', () => {
    if (ring) ring.fill(0);
    writePos = 0;
    filled = 0;
    if (fill) fill.style.width = '0%';
    status.textContent = 'Ghost buffer cleared';
    toast?.('Ghost cleared');
  });

  // Auto-wire on first play
  engine.on('play', () => { if (armed) wire(); });

  return {
    wire,
    clear() { panel.querySelector('[data-ghost-clear]')?.click(); },
    get filledSec() { return filled / sampleRate; },
  };
}
