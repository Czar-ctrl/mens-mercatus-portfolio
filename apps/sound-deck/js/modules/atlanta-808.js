/**
 * Atlanta 808 — dedicated sub bass synth + rolls (SoundX).
 * Web Audio: sine/triangle + quiet square, LPF, long amp decay, soft-clip drive, portamento.
 * Pattern presets: straight 8ths, 16th rolls, triplet rolls, trap boom-bap accents.
 * Honest DEMO label — procedural local synthesis, not a sampled ROM or cloud model.
 */
import { createLoopPlayer } from '../audio/loop-player.js?v=20261007a';
import { midiToFreq, noteName } from './instruments.js?v=20261006p';

const COLOR = '#F0B90B';

const ROOT_NOTES = [
  { id: 'C', midi: 36 }, { id: 'C#', midi: 37 }, { id: 'D', midi: 38 }, { id: 'Eb', midi: 39 },
  { id: 'E', midi: 40 }, { id: 'F', midi: 41 }, { id: 'F#', midi: 42 }, { id: 'G', midi: 43 },
  { id: 'Ab', midi: 44 }, { id: 'A', midi: 45 }, { id: 'Bb', midi: 46 }, { id: 'B', midi: 47 },
];

/** Pattern libraries — steps as 16th-grid OR triplet metadata */
const PATTERNS = [
  {
    id: 'boom',
    label: 'Trap boom',
    desc: 'Long root hits on 1 & 3 + fifth slide accent',
    grid: 16,
    hits: [
      { step: 0, deg: 0, vel: 1 },
      { step: 6, deg: 7, vel: 0.85, glideFrom: 0 },
      { step: 8, deg: 0, vel: 0.95 },
      { step: 14, deg: -5, vel: 0.8, glideFrom: 0 },
    ],
  },
  {
    id: '8ths',
    label: 'Straight 8ths',
    desc: 'Root on every 8th — classic hold / boom',
    grid: 16,
    hits: [
      { step: 0, deg: 0, vel: 1 },
      { step: 2, deg: 0, vel: 0.75 },
      { step: 4, deg: 0, vel: 0.9 },
      { step: 6, deg: 0, vel: 0.7 },
      { step: 8, deg: 0, vel: 1 },
      { step: 10, deg: 0, vel: 0.75 },
      { step: 12, deg: 0, vel: 0.9 },
      { step: 14, deg: 0, vel: 0.7 },
    ],
  },
  {
    id: '16th-roll',
    label: '16th roll',
    desc: 'Atlanta-style machine-gun 16ths into a boom',
    grid: 16,
    hits: [
      { step: 0, deg: 0, vel: 1 },
      { step: 8, deg: 0, vel: 0.55 },
      { step: 9, deg: 0, vel: 0.6 },
      { step: 10, deg: 0, vel: 0.7 },
      { step: 11, deg: 0, vel: 0.8 },
      { step: 12, deg: 0, vel: 1 },
      { step: 14, deg: 7, vel: 0.85, glideFrom: 0 },
    ],
  },
  {
    id: 'triplet',
    label: 'Triplet roll',
    desc: '8th-note triplet rolls into the downbeat (trap fill)',
    grid: 24, // 24 steps = 16th triplet grid over 1 bar (3 per 8th × 8)
    hits: [
      { step: 0, deg: 0, vel: 1 },
      { step: 12, deg: 0, vel: 0.55 },
      { step: 13, deg: 0, vel: 0.65 },
      { step: 14, deg: 0, vel: 0.75 },
      { step: 15, deg: 0, vel: 0.85 },
      { step: 16, deg: 0, vel: 0.95 },
      { step: 18, deg: 7, vel: 0.9, glideFrom: 0 },
      { step: 21, deg: 0, vel: 0.8, glideFrom: 7 },
    ],
  },
  {
    id: 'boombap',
    label: 'Boom-bap accents',
    desc: 'Sparse trap boom-bap: root, ghost, fifth slide',
    grid: 16,
    hits: [
      { step: 0, deg: 0, vel: 1 },
      { step: 3, deg: 0, vel: 0.45 },
      { step: 7, deg: 7, vel: 0.7, glideFrom: 0 },
      { step: 8, deg: 0, vel: 0.95 },
      { step: 11, deg: -5, vel: 0.55 },
      { step: 14, deg: 0, vel: 0.85, glideFrom: -5 },
    ],
  },
  {
    id: 'slide5',
    label: 'Root → fifth',
    desc: 'Long glide root to fifth then back (portamento showcase)',
    grid: 16,
    hits: [
      { step: 0, deg: 0, vel: 1 },
      { step: 4, deg: 7, vel: 0.95, glideFrom: 0 },
      { step: 8, deg: 0, vel: 1, glideFrom: 7 },
      { step: 12, deg: 12, vel: 0.85, glideFrom: 0 },
    ],
  },
];

function makeDriveCurve(amount, samples = 1024) {
  const curve = new Float32Array(samples);
  const k = 1 + amount * 40;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

/**
 * Offline-render one 808 hit into a mono AudioBuffer (for write-to-track / one-shot preview).
 * Supports optional startFreq → endFreq glide over glideSec.
 */
export function render808Hit(ctx, {
  freq = 55,
  startFreq = null,
  duration = 1.4,
  decay = 1.8,
  cutoff = 280,
  drive = 0.45,
  volume = 0.85,
  squareMix = 0.12,
  wave = 'sine',
  glideSec = 0,
} = {}) {
  const sr = ctx.sampleRate;
  const len = Math.max(1, Math.floor(sr * duration));
  const offline = new OfflineAudioContext(1, len, sr);
  const t0 = 0;
  const f0 = startFreq || freq;
  const f1 = freq;

  const osc = offline.createOscillator();
  osc.type = wave === 'triangle' ? 'triangle' : 'sine';
  osc.frequency.setValueAtTime(f0, t0);
  if (glideSec > 0.001 && Math.abs(f1 - f0) > 0.01) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + Math.min(glideSec, duration * 0.9));
  } else {
    osc.frequency.setValueAtTime(f1, t0);
  }

  const sq = offline.createOscillator();
  sq.type = 'square';
  sq.frequency.setValueAtTime(f0, t0);
  if (glideSec > 0.001 && Math.abs(f1 - f0) > 0.01) {
    sq.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + Math.min(glideSec, duration * 0.9));
  } else {
    sq.frequency.setValueAtTime(f1, t0);
  }
  const sqGain = offline.createGain();
  sqGain.gain.value = Math.max(0, Math.min(0.35, squareMix));

  const filter = offline.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = Math.max(40, cutoff);
  filter.Q.value = 0.7;

  const shaper = offline.createWaveShaper();
  shaper.curve = makeDriveCurve(Math.max(0.01, drive));
  shaper.oversample = '2x';

  const amp = offline.createGain();
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), t0 + 0.008);
  // long 808 boom decay
  const decayRate = Math.max(0.4, decay);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.min(duration, 0.05 + 2.8 / decayRate));

  osc.connect(filter);
  sq.connect(sqGain);
  sqGain.connect(filter);
  filter.connect(shaper);
  shaper.connect(amp);
  amp.connect(offline.destination);

  osc.start(t0);
  sq.start(t0);
  osc.stop(t0 + duration);
  sq.stop(t0 + duration);

  // Sync render — OfflineAudioContext.startRendering returns a Promise
  // Callers should await; we return the promise.
  return offline.startRendering();
}

function degToMidi(rootMidi, deg) {
  return rootMidi + (deg || 0);
}

export function mountAtlanta808(root, engine, toast, { getSelectedTrackId } = {}) {
  const state = {
    rootId: 'C',
    octave: 1, // MIDI 36 = C1 when root C + octave 1 → we use ROOT_NOTES midi + (octave-1)*12
    glideMs: 80,
    cutoff: 280,
    decay: 1.8,
    drive: 0.45,
    volume: 0.85,
    squareMix: 0.12,
    wave: 'sine',
    patternId: 'boom',
    playing: false,
  };

  let player = null;
  let liveNodes = []; // cleanup bag for scheduled voices

  root.innerHTML = `
    <div class="panel-head">
      <h2>Atlanta 808</h2>
      <span class="badge warn" title="Procedural Web Audio sub synth — not a ROM sample pack">DEMO · Web Audio</span>
    </div>
    <p class="panel-desc">Deep sub 808 with portamento slides, LPF, long boom decay, and soft-clip drive. Roll presets (8ths, 16ths, triplets, boom-bap). Play live or write to the Bass track.</p>

    <div class="a808-patterns" role="group" aria-label="808 pattern presets">
      ${PATTERNS.map((p) => `
        <button type="button" class="a808-pat ${p.id === state.patternId ? 'active' : ''}"
          data-a808-pat="${p.id}" title="${p.desc}">${p.label}</button>`).join('')}
    </div>
    <p class="a808-pat-desc" data-a808-pat-desc>${PATTERNS[0].desc}</p>

    <div class="a808-preview beat-grid" data-a808-preview aria-label="808 pattern preview"></div>

    <div class="a808-controls">
      <label class="field">
        <span>Root</span>
        <select data-a808-root>
          ${ROOT_NOTES.map((n) => `<option value="${n.id}" ${n.id === state.rootId ? 'selected' : ''}>${n.id}</option>`).join('')}
        </select>
      </label>
      <label class="field">
        <span>Octave</span>
        <select data-a808-oct>
          ${[0, 1, 2].map((o) => `<option value="${o}" ${o === state.octave ? 'selected' : ''}>${o}</option>`).join('')}
        </select>
      </label>
      <label class="field">
        <span>Wave</span>
        <select data-a808-wave>
          <option value="sine" selected>Sine (sub)</option>
          <option value="triangle">Triangle</option>
        </select>
      </label>
      <label class="field block">
        <span>Glide <em data-a808-glide-val>80</em> ms</span>
        <input type="range" min="0" max="400" value="80" data-a808-glide />
      </label>
      <label class="field block">
        <span>LPF cutoff <em data-a808-cut-val>280</em> Hz</span>
        <input type="range" min="60" max="1200" value="280" data-a808-cut />
      </label>
      <label class="field block">
        <span>Decay <em data-a808-dec-val>1.8</em></span>
        <input type="range" min="40" max="400" value="180" data-a808-dec />
      </label>
      <label class="field block">
        <span>Drive / sat <em data-a808-drv-val>45</em>%</span>
        <input type="range" min="0" max="100" value="45" data-a808-drv />
      </label>
      <label class="field block">
        <span>Square mix <em data-a808-sq-val>12</em>%</span>
        <input type="range" min="0" max="35" value="12" data-a808-sq />
      </label>
      <label class="field block">
        <span>Volume <em data-a808-vol-val>85</em>%</span>
        <input type="range" min="0" max="100" value="85" data-a808-vol />
      </label>
    </div>

    <div class="btn-row" style="margin-top:10px">
      <button type="button" class="btn primary" data-a808-play>Play pattern</button>
      <button type="button" class="btn ghost" data-a808-stop disabled>Stop</button>
      <button type="button" class="btn ghost" data-a808-oneshot title="Trigger one root boom">▶ One-shot</button>
      <button type="button" class="btn ghost" data-a808-write>Write to Bass track</button>
      <button type="button" class="btn ghost" data-a808-bpm title="Set BPM ~140 trap">Trap BPM 140</button>
    </div>
    <div class="stem-status" data-a808-status>Ready · pick pattern → Play · DEMO Web Audio 808</div>
  `;

  const preview = root.querySelector('[data-a808-preview]');
  const status = root.querySelector('[data-a808-status]');
  const playBtn = root.querySelector('[data-a808-play]');
  const stopBtn = root.querySelector('[data-a808-stop]');
  const patDesc = root.querySelector('[data-a808-pat-desc]');

  function rootMidi() {
    const n = ROOT_NOTES.find((x) => x.id === state.rootId) || ROOT_NOTES[0];
    return n.midi + (state.octave - 1) * 12;
  }

  function currentPattern() {
    return PATTERNS.find((p) => p.id === state.patternId) || PATTERNS[0];
  }

  function synthParams() {
    return {
      decay: state.decay,
      cutoff: state.cutoff,
      drive: state.drive,
      volume: state.volume,
      squareMix: state.squareMix,
      wave: state.wave,
      glideSec: state.glideMs / 1000,
    };
  }

  function renderPreview() {
    const pat = currentPattern();
    const steps = pat.grid;
    const cols = steps <= 16 ? 16 : steps;
    const on = Array(cols).fill(false);
    const tip = Array(cols).fill('');
    pat.hits.forEach((h) => {
      if (h.step >= 0 && h.step < cols) {
        on[h.step] = true;
        tip[h.step] = `deg ${h.deg}${h.glideFrom != null ? ' · glide' : ''}`;
      }
    });
    // Show as one lane; for 24-step triplet, use denser grid class
    preview.classList.toggle('a808-triplet', steps > 16);
    preview.innerHTML = `
      <div class="beat-lane" data-lane="808">
        <span class="beat-lane-label" style="color:${COLOR}">808</span>
        <div class="beat-steps" style="grid-template-columns:repeat(${cols},1fr)">
          ${on.map((o, i) =>
            `<span class="beat-step ${o ? 'on' : ''} ${i % (steps > 16 ? 6 : 4) === 0 ? 'bar' : ''}" title="${tip[i] || ''}" aria-hidden="true"></span>`
          ).join('')}
        </div>
      </div>`;
    patDesc.textContent = pat.desc;
  }

  /** Schedule a live voice into `out` at `when`. */
  function triggerLive(ctx, out, {
    freq, startFreq, when, duration = 1.2, vel = 1,
  }) {
    const p = synthParams();
    const f0 = Math.max(20, startFreq || freq);
    const f1 = Math.max(20, freq);
    const osc = ctx.createOscillator();
    osc.type = p.wave === 'triangle' ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(f0, when);
    if (p.glideSec > 0.001 && Math.abs(f1 - f0) > 0.05) {
      osc.frequency.exponentialRampToValueAtTime(f1, when + Math.min(p.glideSec, duration * 0.85));
    } else {
      osc.frequency.setValueAtTime(f1, when);
    }

    const sq = ctx.createOscillator();
    sq.type = 'square';
    sq.frequency.setValueAtTime(f0, when);
    if (p.glideSec > 0.001 && Math.abs(f1 - f0) > 0.05) {
      sq.frequency.exponentialRampToValueAtTime(f1, when + Math.min(p.glideSec, duration * 0.85));
    } else {
      sq.frequency.setValueAtTime(f1, when);
    }
    const sqG = ctx.createGain();
    sqG.gain.value = p.squareMix;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = p.cutoff;
    filter.Q.value = 0.7;

    const shaper = ctx.createWaveShaper();
    shaper.curve = makeDriveCurve(Math.max(0.01, p.drive));
    shaper.oversample = '2x';

    const amp = ctx.createGain();
    const peak = Math.max(0.001, p.volume * vel);
    amp.gain.setValueAtTime(0.0001, when);
    amp.gain.exponentialRampToValueAtTime(peak, when + 0.008);
    const decayDur = Math.min(duration, 0.05 + 2.6 / Math.max(0.4, p.decay));
    amp.gain.exponentialRampToValueAtTime(0.0001, when + decayDur);

    osc.connect(filter);
    sq.connect(sqG);
    sqG.connect(filter);
    filter.connect(shaper);
    shaper.connect(amp);
    amp.connect(out);

    osc.start(when);
    sq.start(when);
    const stopAt = when + duration + 0.05;
    osc.stop(stopAt);
    sq.stop(stopAt);

    const bag = { osc, sq, amp, filter, shaper, sqG };
    liveNodes.push(bag);
    setTimeout(() => {
      liveNodes = liveNodes.filter((n) => n !== bag);
      try { osc.disconnect(); sq.disconnect(); amp.disconnect(); filter.disconnect(); shaper.disconnect(); sqG.disconnect(); } catch (_) {}
    }, (duration + 0.2) * 1000);

    return bag;
  }

  function stopLive() {
    if (player?.playing) player.stop();
    liveNodes.forEach((n) => {
      try {
        n.amp.gain.cancelScheduledValues(0);
        n.amp.gain.setValueAtTime(0, engine.ctx?.currentTime || 0);
        n.osc.stop();
        n.sq.stop();
      } catch (_) {}
    });
    liveNodes = [];
    state.playing = false;
    playBtn.disabled = false;
    stopBtn.disabled = true;
    status.textContent = `Stopped · ${currentPattern().label} · ${noteName(rootMidi())}`;
  }

  async function playPattern() {
    await engine.init();
    await engine.resume();
    stopLive();

    const pat = currentPattern();
    const total = pat.grid;
    const stepBeats = 4 / total; // one bar
    const rm = rootMidi();
    const hitMap = new Map();
    pat.hits.forEach((h) => hitMap.set(h.step, h));

    // Hold length: until next hit or ~1.2s of boom
    function hitDurationBeats(step) {
      const next = pat.hits.map((h) => h.step).filter((s) => s > step).sort((a, b) => a - b)[0];
      if (next != null) return Math.max(stepBeats * 0.9, (next - step) * stepBeats * 0.95);
      return Math.min(2.5, (total - step) * stepBeats);
    }

    player = createLoopPlayer(engine, {
      getTotalSteps: () => total,
      stepBeats,
      onStep(step, when, out) {
        const h = hitMap.get(step);
        if (!h || !out) return;
        const midi = degToMidi(rm, h.deg);
        const freq = midiToFreq(midi);
        let startFreq = freq;
        if (h.glideFrom != null) {
          startFreq = midiToFreq(degToMidi(rm, h.glideFrom));
        }
        const durBeats = hitDurationBeats(step);
        const durSec = Math.max(0.35, durBeats * engine.secondsPerBeat * (state.decay > 2 ? 1.15 : 1));
        triggerLive(engine.ctx, out, {
          freq,
          startFreq,
          when,
          duration: durSec,
          vel: h.vel ?? 1,
        });
      },
      onPosition(step) {
        preview.querySelectorAll('.beat-step').forEach((el, i) => {
          el.classList.toggle('now', i === step);
        });
      },
    });

    await player.start();
    state.playing = true;
    playBtn.disabled = true;
    stopBtn.disabled = false;
    status.textContent = `Playing ${pat.label} · ${noteName(rm)} · glide ${state.glideMs}ms · DEMO`;
    toast(`808 · ${pat.label}`);
  }

  async function oneShotClean() {
    await engine.init();
    await engine.resume();
    const freq = midiToFreq(rootMidi());
    const fifth = midiToFreq(rootMidi() + 7);
    const out = engine.ctx.createGain();
    out.gain.value = 1;
    out.connect(engine.masterGain);
    triggerLive(engine.ctx, out, {
      freq: fifth,
      startFreq: freq,
      when: engine.ctx.currentTime + 0.02,
      duration: 1.8,
      vel: 1,
    });
    status.textContent = `One-shot ${noteName(rootMidi())} → fifth · glide ${state.glideMs}ms · DEMO`;
    toast('808 one-shot');
  }

  async function writeToTrack() {
    await engine.init();
    const sel = getSelectedTrackId?.();
    let track = engine.tracks.find((t) => /bass/i.test(t.name))
      || engine.tracks.find((t) => t.id === sel)
      || engine.tracks[1]
      || engine.tracks[0];
    if (!track) { toast('No track', 'warn'); return; }

    const pat = currentPattern();
    const rm = rootMidi();
    const p = synthParams();
    const stepBeats = 4 / pat.grid;
    let count = 0;

    // Clear existing demo-ish clips? No — append like Drummer does.
    for (const h of pat.hits) {
      const midi = degToMidi(rm, h.deg);
      const freq = midiToFreq(midi);
      const startFreq = h.glideFrom != null ? midiToFreq(degToMidi(rm, h.glideFrom)) : freq;
      const next = pat.hits.map((x) => x.step).filter((s) => s > h.step).sort((a, b) => a - b)[0];
      const durBeats = next != null
        ? Math.max(0.35, (next - h.step) * stepBeats)
        : Math.max(0.75, (pat.grid - h.step) * stepBeats);
      const durSec = Math.max(0.4, durBeats * engine.secondsPerBeat * 1.1);
      const buffer = await render808Hit(engine.ctx, {
        freq,
        startFreq,
        duration: durSec,
        decay: p.decay,
        cutoff: p.cutoff,
        drive: p.drive,
        volume: p.volume * (h.vel ?? 1),
        squareMix: p.squareMix,
        wave: p.wave,
        glideSec: h.glideFrom != null ? p.glideSec : Math.min(p.glideSec, 0.02),
      });
      engine.addClip(track.id, {
        name: `808 ${noteName(midi)}`,
        startBeat: h.step * stepBeats,
        durationBeats: durBeats,
        color: COLOR,
        buffer,
        recipe: {
          type: 'tone',
          freq,
          duration: durSec,
          _atlanta808: true,
          pattern: pat.id,
          midi,
        },
      });
      count++;
    }
    status.textContent = `Wrote ${count} 808 hits → ${track.name} · ${pat.label} @ ${engine.bpm} BPM`;
    toast(`808 wrote ${count} hits to ${track.name}`);
  }

  // —— Wire UI ——
  root.querySelector('.a808-patterns').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-a808-pat]');
    if (!btn) return;
    state.patternId = btn.dataset.a808Pat;
    root.querySelectorAll('[data-a808-pat]').forEach((b) => b.classList.toggle('active', b === btn));
    renderPreview();
  });

  root.querySelector('[data-a808-root]').addEventListener('change', (e) => {
    state.rootId = e.target.value;
    status.textContent = `Root ${noteName(rootMidi())}`;
  });
  root.querySelector('[data-a808-oct]').addEventListener('change', (e) => {
    state.octave = Number(e.target.value);
    status.textContent = `Root ${noteName(rootMidi())}`;
  });
  root.querySelector('[data-a808-wave]').addEventListener('change', (e) => {
    state.wave = e.target.value;
  });

  const bindRange = (sel, key, display, fmt) => {
    const el = root.querySelector(sel);
    const lab = root.querySelector(display);
    el.addEventListener('input', () => {
      const v = Number(el.value);
      if (key === 'glideMs') state.glideMs = v;
      else if (key === 'cutoff') state.cutoff = v;
      else if (key === 'decay') state.decay = v / 100;
      else if (key === 'drive') state.drive = v / 100;
      else if (key === 'squareMix') state.squareMix = v / 100;
      else if (key === 'volume') state.volume = v / 100;
      if (lab) lab.textContent = fmt(v);
    });
  };
  bindRange('[data-a808-glide]', 'glideMs', '[data-a808-glide-val]', (v) => String(v));
  bindRange('[data-a808-cut]', 'cutoff', '[data-a808-cut-val]', (v) => String(v));
  bindRange('[data-a808-dec]', 'decay', '[data-a808-dec-val]', (v) => (v / 100).toFixed(1));
  bindRange('[data-a808-drv]', 'drive', '[data-a808-drv-val]', (v) => String(v));
  bindRange('[data-a808-sq]', 'squareMix', '[data-a808-sq-val]', (v) => String(v));
  bindRange('[data-a808-vol]', 'volume', '[data-a808-vol-val]', (v) => String(v));

  playBtn.addEventListener('click', () => playPattern().catch((err) => {
    console.error(err);
    toast('808 play failed', 'warn');
  }));
  stopBtn.addEventListener('click', stopLive);
  root.querySelector('[data-a808-oneshot]').addEventListener('click', () => oneShotClean().catch(console.error));
  root.querySelector('[data-a808-write]').addEventListener('click', () => writeToTrack().catch((err) => {
    console.error(err);
    toast('808 write failed', 'warn');
  }));
  root.querySelector('[data-a808-bpm]').addEventListener('click', () => {
    engine.setBpm(140);
    toast('BPM → 140 (trap)');
  });

  engine.on('bpm', (bpm) => {
    if (!state.playing) status.textContent = `Ready · ${currentPattern().label} · ${bpm} BPM · DEMO`;
  });

  renderPreview();

  return {
    playPattern,
    stop: stopLive,
    writeToTrack,
    getState: () => ({ ...state }),
    setPattern(id) {
      if (!PATTERNS.some((p) => p.id === id)) return false;
      state.patternId = id;
      root.querySelectorAll('[data-a808-pat]').forEach((b) => b.classList.toggle('active', b.dataset.a808Pat === id));
      renderPreview();
      return true;
    },
    patterns: PATTERNS,
  };
}

export { PATTERNS, ROOT_NOTES };
