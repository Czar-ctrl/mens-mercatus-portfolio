/**
 * Mixer UI — channel strips, master spectrum/level, A/B compare, fullscreen.
 * Spectrum uses a real AnalyserNode on the master bus. Idle if there is no audio context.
 */
import { toggleFullscreen } from './layout.js';
import { mixChanged } from './history.js';

const AB_KEY = 'mm-sound-deck-ab';

export function mountMixer(root, engine, mixerFx, toast, history) {
  const ab = { a: null, b: null, hearing: null };
  try {
    const saved = JSON.parse(localStorage.getItem(AB_KEY) || 'null');
    if (saved) {
      ab.a = saved.a || null;
      ab.b = saved.b || null;
    }
  } catch (_) {}

  root.innerHTML = `
    <div class="mixer-head">
      <div class="mixer-label">Mixer</div>
      <div class="ab-compare" role="group" aria-label="A/B mix compare">
        <button type="button" class="chip" data-ab-recall="a" title="Recall mix A (faders, pan, EQ, mute, solo, master, master EQ, reverb)">A</button>
        <button type="button" class="chip" data-ab-recall="b" title="Recall mix B">B</button>
        <button type="button" class="btn sm" data-ab-store="a" title="Store the current mix as A">Store A</button>
        <button type="button" class="btn sm" data-ab-store="b" title="Store the current mix as B">Store B</button>
      </div>
      <div class="master-meter" aria-label="Master spectrum and level">
        <canvas data-spectrum width="336" height="72"></canvas>
        <div class="level-col" title="Master RMS level"><i data-level></i></div>
        <span class="meter-state" data-meter-state>Idle · no audio context</span>
      </div>
      <button type="button" class="btn sm ghost" data-action="fs-mixer" data-fs="mixer" aria-pressed="false" title="Fullscreen mixer. Escape exits.">⛶ Mixer</button>
    </div>
    <div class="mixer-strips" data-strips></div>
    <p class="mixer-side-note" data-mixer-side>Channel strips · blue line above: drag to resize, double-click to collapse/expand mixer. Spectrum meters the master bus after Play.</p>
  `;

  const stripsEl = root.querySelector('[data-strips]');
  const canvas = root.querySelector('[data-spectrum]');
  const ctx2d = canvas.getContext('2d');
  const levelEl = root.querySelector('[data-level]');
  const stateEl = root.querySelector('[data-meter-state]');
  const freq = new Uint8Array(1024);
  const time = new Uint8Array(2048);
  let meterOn = true;

  function saveAb() {
    try { localStorage.setItem(AB_KEY, JSON.stringify({ a: ab.a, b: ab.b })); } catch (_) {}
  }

  function markAb() {
    root.querySelectorAll('[data-ab-recall]').forEach((btn) => {
      const slot = btn.dataset.abRecall;
      const filled = !!ab[slot];
      btn.classList.toggle('on', ab.hearing === slot);
      btn.disabled = false;
      btn.title = filled
        ? `Recall mix ${slot.toUpperCase()}`
        : `Mix ${slot.toUpperCase()} is empty — Store ${slot.toUpperCase()} first`;
    });
  }

  function render() {
    const strips = engine.tracks.map((t) => stripHtml(t)).join('');
    const master = engine._masterVol ?? engine.masterGain?.gain.value ?? 0.85;
    const meq = engine.masterEq || { low: 0, mid: 0, high: 0 };
    stripsEl.innerHTML = `
      ${strips}
      <div class="strip master">
        <div class="strip-name">Master</div>
        <label class="eq-row" title="Master low shelf"><span>Low</span><input type="range" min="-12" max="12" step="0.5" value="${meq.low}" data-master-eq="low" /></label>
        <label class="eq-row" title="Master mid peak"><span>Mid</span><input type="range" min="-12" max="12" step="0.5" value="${meq.mid}" data-master-eq="mid" /></label>
        <label class="eq-row" title="Master high shelf"><span>High</span><input type="range" min="-12" max="12" step="0.5" value="${meq.high}" data-master-eq="high" /></label>
        <label class="pan-row"><span>Pan</span><input type="range" min="-1" max="1" step="0.01" value="0" disabled title="Master pan is not wired" /></label>
        <input type="range" class="fader" min="0" max="1" step="0.01" value="${master}" data-master-vol title="Master volume" />
        <div class="strip-btns">
          <button type="button" class="chip ${engine.reverbOn ? 'on' : ''}" data-reverb title="Master reverb — convolver wet on the master bus">Rvb</button>
        </div>
      </div>
    `;
    markAb();
  }

  function stripHtml(t) {
    const audible = !(t.muted || (engine._soloActive && !t.solo));
    return `
      <div class="strip" data-strip="${t.id}">
        <div class="strip-name" title="${escapeHtml(t.name)}">${escapeHtml(t.name)}</div>
        <label class="eq-row" title="Low shelf gain"><span>Low</span>
          <input type="range" min="-12" max="12" step="0.5" value="${t.eq.low}" data-eq="low" data-id="${t.id}" />
        </label>
        <label class="eq-row" title="Mid peaking gain"><span>Mid</span>
          <input type="range" min="-12" max="12" step="0.5" value="${t.eq.mid}" data-eq="mid" data-id="${t.id}" />
        </label>
        <label class="eq-row" title="High shelf gain"><span>High</span>
          <input type="range" min="-12" max="12" step="0.5" value="${t.eq.high}" data-eq="high" data-id="${t.id}" />
        </label>
        <label class="pan-row" title="Pan"><span>L/R</span>
          <input type="range" min="-1" max="1" step="0.01" value="${t.pan}" data-pan="${t.id}" />
        </label>
        <input type="range" class="fader" min="0" max="1" step="0.01" value="${t.volume}" data-fader="${t.id}" title="Volume — Web Audio gain" />
        <div class="strip-btns">
          <button type="button" class="chip mute ${t.muted ? 'on' : ''}" data-mute="${t.id}" title="Mute — track gain ${audible ? 'open' : '0'}">M</button>
          <button type="button" class="chip solo ${t.solo ? 'on' : ''}" data-solo="${t.id}" title="Solo — silences every other track's gain">S</button>
        </div>
      </div>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function pushMix(before) {
    if (history?.applying) return;
    if (!mixChanged(before, engine.captureMix())) return;
    ab.hearing = null;
    markAb();
    if (history) history.push({ label: 'Undid mix change', undo: () => engine.applyMix(before) });
  }

  let gesture = null;
  root.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('[data-eq],[data-pan],[data-fader],[data-master-vol],[data-master-eq]')) return;
    gesture = engine.captureMix();
  });
  window.addEventListener('pointerup', () => {
    if (!gesture) return;
    const before = gesture;
    gesture = null;
    pushMix(before);
  });

  root.addEventListener('input', (e) => {
    const meq = e.target.closest('[data-master-eq]');
    if (meq) {
      engine.setMasterEq(meq.dataset.masterEq, Number(meq.value));
      return;
    }
    const eq = e.target.closest('[data-eq]');
    if (eq) {
      engine.setTrackEq(eq.dataset.id, eq.dataset.eq, Number(eq.value));
      return;
    }
    const pan = e.target.closest('[data-pan]');
    if (pan) {
      engine.setTrackPan(pan.dataset.pan, Number(pan.value));
      return;
    }
    const fader = e.target.closest('[data-fader]');
    if (fader) {
      engine.setTrackVolume(fader.dataset.fader, Number(fader.value));
      return;
    }
    const mv = e.target.closest('[data-master-vol]');
    if (mv) engine.setMasterVolume(Number(mv.value));
  });

  root.addEventListener('click', async (e) => {
    const fs = e.target.closest('[data-action="fs-mixer"]');
    if (fs) {
      const ok = toggleFullscreen(root);
      if (!ok) toast('Fullscreen is not available in this browser', 'warn');
      return;
    }
    const store = e.target.closest('[data-ab-store]');
    if (store) {
      const slot = store.dataset.abStore;
      ab[slot] = engine.captureMix();
      ab.hearing = slot;
      saveAb();
      markAb();
      toast(`Stored mix ${slot.toUpperCase()} — faders, pan, EQ, mute, solo, master, master EQ, reverb`);
      return;
    }
    const recall = e.target.closest('[data-ab-recall]');
    if (recall) {
      const slot = recall.dataset.abRecall;
      if (!ab[slot]) {
        toast(`Mix ${slot.toUpperCase()} is empty. Press Store ${slot.toUpperCase()} first.`, 'warn');
        return;
      }
      const before = engine.captureMix();
      engine.applyMix(ab[slot]);
      ab.hearing = slot;
      markAb();
      pushMix(before);
      toast(`Hearing mix ${slot.toUpperCase()}`);
      return;
    }
    const mute = e.target.closest('[data-mute]');
    if (mute) {
      const t = engine.tracks.find((x) => x.id === mute.dataset.mute);
      if (t) {
        const before = engine.captureMix();
        engine.setTrackMute(t.id, !t.muted);
        ab.hearing = null;
        pushMix(before);
      }
      return;
    }
    const solo = e.target.closest('[data-solo]');
    if (solo) {
      const t = engine.tracks.find((x) => x.id === solo.dataset.solo);
      if (t) {
        const before = engine.captureMix();
        engine.setTrackSolo(t.id, !t.solo);
        ab.hearing = null;
        pushMix(before);
      }
      return;
    }
    const rvb = e.target.closest('[data-reverb]');
    if (rvb) {
      const before = engine.captureMix();
      await mixerFx.setReverb(!engine.reverbOn);
      pushMix(before);
      toast(engine.reverbOn
        ? 'Master reverb on — convolver wet on the master bus'
        : 'Master reverb off — dry master');
      render();
    }
  });

  function drawMeter() {
    if (!meterOn) return;
    requestAnimationFrame(drawMeter);
    if (document.hidden) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx2d.clearRect(0, 0, w, h);
    ctx2d.fillStyle = '#0A0A0A';
    ctx2d.fillRect(0, 0, w, h);

    if (!engine.ctx || !engine.analyser) {
      stateEl.textContent = 'Idle · no audio context';
      levelEl.style.height = '0%';
      drawIdle('No audio context');
      return;
    }

    const state = engine.ctx.state;
    if (state !== 'running') {
      stateEl.textContent = 'Idle · press Play to start audio';
      levelEl.style.height = '0%';
      drawIdle('Audio suspended');
      return;
    }

    engine.analyser.getByteFrequencyData(freq);
    engine.analyser.getByteTimeDomainData(time);
    const bins = engine.analyser.frequencyBinCount;
    const bars = 42;
    const step = Math.max(1, Math.floor(bins / bars));
    const gap = 2;
    const bw = (w - gap * bars) / bars;
    for (let i = 0; i < bars; i++) {
      let acc = 0;
      const from = i * step;
      for (let k = 0; k < step; k++) acc += freq[from + k] || 0;
      const mag = acc / step / 255;
      const bh = Math.max(1, mag * (h - 4));
      ctx2d.fillStyle = mag > 0.82 ? '#e85d5d' : '#F5C518';
      ctx2d.fillRect(i * (bw + gap), h - bh, bw, bh);
    }

    let sum = 0;
    const n = engine.analyser.fftSize;
    for (let i = 0; i < n; i++) {
      const v = (time[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / n);
    levelEl.style.height = Math.min(100, rms * 220) + '%';
    stateEl.textContent = engine.isPlaying ? 'Live · master' : 'Live · silence until play';
  }

  function drawIdle(label) {
    ctx2d.strokeStyle = 'rgba(245,197,24,0.35)';
    ctx2d.beginPath();
    ctx2d.moveTo(0, canvas.height - 2);
    ctx2d.lineTo(canvas.width, canvas.height - 2);
    ctx2d.stroke();
    ctx2d.fillStyle = '#9a9a94';
    ctx2d.font = '20px ui-sans-serif, system-ui, sans-serif';
    ctx2d.fillText(label, 8, 28);
  }

  document.addEventListener('fullscreenchange', syncFs);
  document.addEventListener('webkitfullscreenchange', syncFs);
  function syncFs() {
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    const btn = root.querySelector('[data-action="fs-mixer"]');
    if (!btn) return;
    const on = fs === root;
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.classList.toggle('primary', on);
  }

  engine.on('tracks', () => {
    if (gesture) return;
    ab.hearing = null;
    render();
  });

  render();
  drawMeter();
  return {
    render,
    stopMeter() { meterOn = false; },
  };
}
