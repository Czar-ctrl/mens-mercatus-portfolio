/**
 * Live Loops-style grid — GarageBand Live Loops–inspired scene/clip launcher.
 * Rows = clip lanes, columns = scene slots. Click cells to arm; Launch column to trigger
 * in sync with engine BPM via the shared loop-player. DEMO Web Audio — no Apple assets.
 *
 * Per-pad tweaks (16 steps inside a selected cell):
 *   · velocity (drag ↕) · tone/sharpness (Alt/Shift-drag) · yellow skip (long-press / corner)
 *   · yellow horizontal skip-guide line (drag ↕; persisted)
 *   · ghost horizontal guide line (drag ↕ / slider; separate persisted Y — not the audio Ghost layer)
 * Persists to localStorage with the pattern library.
 */
import { createLoopPlayer } from '../audio/loop-player.js?v=20261007e-sxs20261020b';

const COLS = 8;
const STEPS = 16;
const STORE_KEY = 'mm-sound-deck-live-loops';
const LANES = [
  { id: 'kick', label: 'Kick', color: '#F5C518', recipe: { type: 'kick', duration: 0.4 } },
  { id: 'snare', label: 'Snare', color: '#E8A838', recipe: { type: 'snare', duration: 0.28 } },
  { id: 'hat', label: 'Hats', color: '#C9A227', recipe: { type: 'hat', duration: 0.1 } },
  { id: 'perc', label: 'Perc', color: '#B8860B', recipe: { type: 'noise', duration: 0.15 } },
  { id: 'bass', label: 'Bass', color: '#DAA520', recipe: { type: 'bass', duration: 0.45, freq: 55 } },
];

function makePad(on = false, vel = 1, tone = 0.55, skip = false) {
  return {
    on: !!on,
    vel: Math.max(0.05, Math.min(1, Number(vel) || 1)),
    tone: Math.max(0, Math.min(1, Number(tone) || 0.55)),
    skip: !!skip,
  };
}

function normalizePad(raw) {
  if (raw && typeof raw === 'object') {
    return makePad(raw.on, raw.vel, raw.tone, raw.skip);
  }
  return makePad(!!raw);
}

function padsToBools(pads) {
  return (pads || []).map((p) => {
    const pad = normalizePad(p);
    return !!(pad.on && !pad.skip);
  });
}

/** Pre-baked 16-step patterns per lane × scene (procedural DEMO clips). */
function buildLibrary() {
  const lib = {};
  LANES.forEach((lane) => {
    lib[lane.id] = [];
    for (let c = 0; c < COLS; c++) {
      const steps = Array(STEPS).fill(false);
      if (lane.id === 'kick') {
        if (c % 3 === 0) [0, 4, 8, 12].forEach((i) => { steps[i] = true; });
        else if (c % 3 === 1) [0, 3, 8, 11].forEach((i) => { steps[i] = true; });
        else [0, 6, 8, 14].forEach((i) => { steps[i] = true; });
      } else if (lane.id === 'snare') {
        if (c % 2 === 0) [4, 12].forEach((i) => { steps[i] = true; });
        else [4, 10, 12].forEach((i) => { steps[i] = true; });
      } else if (lane.id === 'hat') {
        if (c < 3) for (let i = 0; i < STEPS; i += 2) steps[i] = true;
        else if (c < 6) for (let i = 0; i < STEPS; i++) steps[i] = true;
        else for (let i = 0; i < STEPS; i += 2) if (i % 4 !== 0) steps[i] = true;
      } else if (lane.id === 'perc') {
        [7, 15].forEach((i) => { steps[i] = true; });
        if (c >= 4) steps[3] = true;
        if (c >= 6) steps[11] = true;
      } else {
        if (c % 2 === 0) [0, 8].forEach((i) => { steps[i] = true; });
        else [0, 6, 10].forEach((i) => { steps[i] = true; });
      }
      // Slight default velocity variation so patterns aren't perfectly flat
      lib[lane.id].push(steps.map((on, i) => {
        const vel = on ? (0.75 + 0.25 * ((i % 4 === 0) ? 1 : 0.7)) : 1;
        const tone = lane.id === 'hat' ? (0.35 + 0.45 * ((i % 4) / 3)) : 0.55;
        return makePad(on, vel, tone, false);
      }));
    }
  });
  return lib;
}

function clamp01(n, fallback = 0.35) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0.04, Math.min(0.96, v));
}

function loadPersisted(library, armed) {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (!raw) return null;
    if (raw.library) {
      LANES.forEach((lane) => {
        const cols = raw.library[lane.id];
        if (!Array.isArray(cols)) return;
        cols.forEach((pads, c) => {
          if (c >= COLS || !Array.isArray(pads) || pads.length !== STEPS) return;
          library[lane.id][c] = pads.map(normalizePad);
        });
      });
    }
    if (raw.armed) {
      LANES.forEach((lane) => {
        if (Array.isArray(raw.armed[lane.id])) {
          for (let c = 0; c < COLS; c++) armed[lane.id][c] = !!raw.armed[lane.id][c];
        }
      });
    }
    const selected = (raw.selected && raw.selected.lane && Number.isFinite(raw.selected.col))
      ? { lane: raw.selected.lane, col: Number(raw.selected.col) }
      : null;
    const skipLineY = clamp01(raw.skipLineY, 0.35);
    const ghostLineY = clamp01(raw.ghostLineY, 0.18);
    return { selected, skipLineY, ghostLineY };
  } catch (_) {}
  return null;
}

function toneHz(tone) {
  // 0 = dark (~700 Hz), 0.55 ≈ open, 1 = bright (~14 kHz)
  const t = Math.max(0, Math.min(1, tone ?? 0.55));
  return 700 * Math.pow(20, t);
}

export function mountLiveLoops(root, engine, toast, { getSelectedTrackId, onPatternSync } = {}) {
  const library = buildLibrary();
  /** armed[lane][col] */
  const armed = Object.fromEntries(LANES.map((l) => [l.id, Array(COLS).fill(false)]));
  let activeScene = -1;
  let playing = false;
  const persisted = loadPersisted(library, armed);
  let selected = (persisted && persisted.selected) || { lane: 'hat', col: 0 };
  /** Yellow skip-guide line position: 0 = top of pad strip, 1 = bottom */
  let skipLineY = (persisted && Number.isFinite(persisted.skipLineY)) ? persisted.skipLineY : 0.35;
  /** Ghost guide line (visual only; not audio Ghost layer) — default above yellow */
  let ghostLineY = (persisted && Number.isFinite(persisted.ghostLineY)) ? persisted.ghostLineY : 0.18;
  let persistTimer = null;

  function persistSoon() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify({
          library,
          armed,
          selected,
          skipLineY,
          ghostLineY,
          v: 3,
        }));
      } catch (_) {}
    }, 180);
  }

  root.innerHTML = `
    <div class="panel-head">
      <h2>Live Loops</h2>
      <span class="badge warn" title="Inspired by Live Loops grids — original SoundX UI, no Apple trademarks or assets">Live Loops-style · DEMO</span>
    </div>
    <p class="panel-desc">Tap cells to arm clips, then <strong>Launch</strong> a scene. Select a cell to edit its <strong>16 pads</strong>: drag ↕ velocity · Alt-drag tone · yellow corner / long-press = skip · drag the <strong>yellow line</strong> ↕ · drag the <strong>ghost line</strong> ↕. Gold = armed · bright = playing · yellow = skip.</p>
    <div class="ll-toolbar">
      <button type="button" class="btn primary" data-ll-stop disabled>Stop loops</button>
      <button type="button" class="btn ghost" data-ll-clear>Clear arms</button>
      <button type="button" class="btn ghost" data-ll-write>Write scene → track</button>
      <span class="ll-bpm" data-ll-bpm>${engine.bpm} BPM</span>
    </div>
    <div class="ll-grid-wrap">
      <div class="ll-grid" data-ll-grid role="grid" aria-label="Live Loops grid"></div>
    </div>
    <div class="ll-pad-editor" data-ll-pads hidden>
      <div class="ll-pad-head">
        <strong data-ll-pad-title>Pads</strong>
        <span class="ll-pad-hint">↕ vel · Alt↕ tone · ● skip · yellow line ↕ · ghost line ↕</span>
        <label class="ll-ghost-slider-wrap" title="Ghost guide height">
          <span class="ll-ghost-slider-label">Ghost ↕</span>
          <input type="range" class="ll-ghost-slider" data-ll-ghost-slider min="4" max="96" step="1" value="18" aria-label="Ghost guide vertical position" />
        </label>
        <button type="button" class="btn sm ghost" data-ll-pad-reset title="Reset velocity/tone/skip on this clip">Reset pads</button>
      </div>
      <div class="ll-pads-stage" data-ll-pad-stage>
        <div class="ll-pads" data-ll-pad-row role="group" aria-label="Step pads"></div>
        <div class="ll-ghost-line" data-ll-ghost-line role="slider" tabindex="0"
          aria-label="Ghost guide line" aria-orientation="vertical"
          aria-valuemin="0" aria-valuemax="100" aria-valuenow="18"
          title="Drag up/down to reposition the ghost guide">
          <span class="ll-ghost-line-grip" aria-hidden="true"></span>
          <span class="ll-ghost-line-label" aria-hidden="true">ghost</span>
        </div>
        <div class="ll-skip-line" data-ll-skip-line role="slider" tabindex="0"
          aria-label="Yellow skip marker guide" aria-orientation="vertical"
          aria-valuemin="0" aria-valuemax="100" aria-valuenow="35"
          title="Drag up/down to reposition the yellow skip guide">
          <span class="ll-skip-line-grip" aria-hidden="true"></span>
          <span class="ll-skip-line-label" aria-hidden="true">skip</span>
        </div>
      </div>
    </div>
    <div class="stem-status" data-ll-status>Arm cells, then Launch a scene · ${engine.bpm} BPM</div>
    <div class="ll-dna-suggest" data-ll-dna hidden>
      <span class="badge warn">Stem DNA</span>
      <span data-ll-dna-text></span>
      <button type="button" class="btn sm ghost" data-ll-dna-arm>Arm suggested</button>
    </div>
  `;

  const grid = root.querySelector('[data-ll-grid]');
  const status = root.querySelector('[data-ll-status]');
  const stopBtn = root.querySelector('[data-ll-stop]');
  const bpmEl = root.querySelector('[data-ll-bpm]');
  const padEditor = root.querySelector('[data-ll-pads]');
  const padStage = root.querySelector('[data-ll-pad-stage]');
  const padRow = root.querySelector('[data-ll-pad-row]');
  const padTitle = root.querySelector('[data-ll-pad-title]');
  const skipLineEl = root.querySelector('[data-ll-skip-line]');
  const ghostLineEl = root.querySelector('[data-ll-ghost-line]');
  const ghostSliderEl = root.querySelector('[data-ll-ghost-slider]');

  function applySkipLine() {
    const y = clamp01(skipLineY, 0.35);
    skipLineY = y;
    if (padStage) padStage.style.setProperty('--ll-skip-y', `${(y * 100).toFixed(2)}%`);
    if (skipLineEl) {
      skipLineEl.setAttribute('aria-valuenow', String(Math.round(y * 100)));
      skipLineEl.style.top = `var(--ll-skip-y)`;
    }
  }

  function applyGhostLine() {
    const y = clamp01(ghostLineY, 0.18);
    ghostLineY = y;
    if (padStage) padStage.style.setProperty('--ll-ghost-y', `${(y * 100).toFixed(2)}%`);
    if (ghostLineEl) {
      ghostLineEl.setAttribute('aria-valuenow', String(Math.round(y * 100)));
      ghostLineEl.style.top = `var(--ll-ghost-y)`;
    }
    if (ghostSliderEl) {
      ghostSliderEl.value = String(Math.round(y * 100));
    }
  }

  const buffers = {};
  async function ensureBuffers() {
    await engine.init();
    LANES.forEach((l) => {
      if (!buffers[l.id]) buffers[l.id] = engine.createBufferFromRecipe(l.recipe);
    });
  }

  function activeStepsFor(laneId) {
    if (activeScene < 0 || !armed[laneId][activeScene]) return null;
    return library[laneId][activeScene];
  }

  function laneBaseGain(laneId) {
    return laneId === 'hat' ? 0.55 : laneId === 'bass' ? 0.7 : 0.85;
  }

  function triggerPad(lane, pad, when, out) {
    const p = normalizePad(pad);
    if (!p.on || p.skip) return;
    const ctx = engine.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buffers[lane.id];
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.7;
    filter.frequency.value = toneHz(p.tone);
    const g = ctx.createGain();
    g.gain.value = laneBaseGain(lane.id) * p.vel;
    src.connect(filter);
    filter.connect(g);
    g.connect(out);
    src.start(Math.max(ctx.currentTime, when));
  }

  const player = createLoopPlayer(engine, {
    getTotalSteps: () => STEPS,
    onStep(step, when, out) {
      if (!playing || activeScene < 0) return;
      LANES.forEach((lane) => {
        const steps = activeStepsFor(lane.id);
        if (!steps) return;
        triggerPad(lane, steps[step], when, out);
      });
    },
    onPosition(step) {
      grid.querySelectorAll('.ll-cell.now').forEach((el) => el.classList.remove('now'));
      padRow.querySelectorAll('.ll-pad.now').forEach((el) => el.classList.remove('now'));
      if (step < 0 || activeScene < 0) return;
      LANES.forEach((lane) => {
        if (!armed[lane.id][activeScene]) return;
        const cell = grid.querySelector(`.ll-cell[data-lane="${lane.id}"][data-col="${activeScene}"]`);
        if (cell) cell.classList.add('now');
      });
      if (selected.col === activeScene) {
        const padEl = padRow.querySelector(`.ll-pad[data-step="${step}"]`);
        if (padEl) padEl.classList.add('now');
      }
    },
  });

  function cellSkipCount(laneId, col) {
    return library[laneId][col].filter((p) => normalizePad(p).skip).length;
  }

  function renderPads() {
    const lane = LANES.find((l) => l.id === selected.lane) || LANES[2];
    const col = Math.max(0, Math.min(COLS - 1, selected.col | 0));
    selected = { lane: lane.id, col };
    const pads = library[lane.id][col];
    padEditor.hidden = false;
    padTitle.textContent = `${lane.label} · scene ${col + 1} pads`;
    padRow.innerHTML = pads.map((raw, i) => {
      const p = normalizePad(raw);
      const h = Math.round(18 + p.vel * 70);
      return `<button type="button" class="ll-pad ${p.on ? 'on' : ''} ${p.skip ? 'skip' : ''} ${i % 4 === 0 ? 'bar' : ''}"
        data-step="${i}" aria-pressed="${p.on}" title="Step ${i + 1} · vel ${Math.round(p.vel * 100)}% · tone ${Math.round(p.tone * 100)}%"
        style="--ll-color:${lane.color};--ll-vel:${h}%;--ll-tone:${p.tone}">
        <span class="ll-pad-fill" aria-hidden="true"></span>
        <span class="ll-pad-tone" aria-hidden="true"></span>
        <span class="ll-pad-skip" data-ll-skip="${i}" title="Toggle skip" aria-label="Skip step ${i + 1}"></span>
        <span class="ll-pad-num">${i + 1}</span>
      </button>`;
    }).join('');
  }

  function render() {
    const head = `<div class="ll-row ll-head" role="row">
      <span class="ll-lane-label"></span>
      ${Array.from({ length: COLS }, (_, c) => `
        <button type="button" class="ll-scene-btn ${activeScene === c ? 'active' : ''}" data-ll-launch="${c}" title="Launch scene ${c + 1}">
          ${c + 1}
        </button>`).join('')}
    </div>`;
    const rows = LANES.map((lane) => `
      <div class="ll-row" role="row" data-lane-row="${lane.id}">
        <span class="ll-lane-label" style="color:${lane.color}">${lane.label}</span>
        ${Array.from({ length: COLS }, (_, c) => {
          const on = armed[lane.id][c];
          const live = playing && activeScene === c && on;
          const sel = selected.lane === lane.id && selected.col === c;
          const skips = cellSkipCount(lane.id, c);
          return `<button type="button" class="ll-cell ${on ? 'armed' : ''} ${live ? 'playing' : ''} ${sel ? 'selected' : ''} ${skips ? 'has-skip' : ''}"
            data-lane="${lane.id}" data-col="${c}" aria-pressed="${on}"
            title="${lane.label} · scene ${c + 1}${skips ? ` · ${skips} skipped` : ''}" style="--ll-color:${lane.color}"></button>`;
        }).join('')}
      </div>`).join('');
    grid.innerHTML = head + rows;
    renderPads();
  }

  async function launchScene(col) {
    await ensureBuffers();
    await engine.resume();
    const any = LANES.some((l) => armed[l.id][col]);
    if (!any) {
      toast(`Scene ${col + 1} is empty — arm some cells first`, 'warn');
      return;
    }
    activeScene = col;
    if (!playing) {
      playing = true;
      stopBtn.disabled = false;
      await player.start();
    }
    const beatPat = {};
    ['kick', 'snare', 'hat', 'perc'].forEach((id) => {
      beatPat[id] = armed[id][col] ? padsToBools(library[id][col]) : Array(STEPS).fill(false);
    });
    onPatternSync?.(beatPat);
    status.textContent = `Scene ${col + 1} launching · ${engine.bpm} BPM`;
    toast(`Live Loops · scene ${col + 1}`);
    render();
  }

  function stopLoops() {
    playing = false;
    activeScene = -1;
    player.stop();
    stopBtn.disabled = true;
    status.textContent = `Loops stopped · ${engine.bpm} BPM`;
    render();
  }

  // —— Grid clicks (arm / select / launch) ——
  grid.addEventListener('click', (e) => {
    const launch = e.target.closest('[data-ll-launch]');
    if (launch) {
      launchScene(Number(launch.dataset.llLaunch));
      return;
    }
    const cell = e.target.closest('.ll-cell');
    if (!cell) return;
    const lane = cell.dataset.lane;
    const col = Number(cell.dataset.col);
    const alreadySel = selected.lane === lane && selected.col === col;
    selected = { lane, col };
    if (alreadySel) {
      // Second click on same cell toggles arm
      armed[lane][col] = !armed[lane][col];
    } else if (!armed[lane][col]) {
      // First select on empty cell also arms for fast workflow
      armed[lane][col] = true;
    }
    persistSoon();
    render();
  });

  // —— Yellow skip-guide line: drag ↕ within pad strip (does not toggle per-pad skip) ——
  let lineDrag = null;
  let ghostDrag = null;
  applySkipLine();
  applyGhostLine();

  function setSkipLineFromClientY(clientY) {
    if (!padStage) return;
    const rect = padStage.getBoundingClientRect();
    if (rect.height <= 0) return;
    skipLineY = clamp01((clientY - rect.top) / rect.height, skipLineY);
    applySkipLine();
    persistSoon();
  }

  function setGhostLineFromClientY(clientY) {
    if (!padStage) return;
    const rect = padStage.getBoundingClientRect();
    if (rect.height <= 0) return;
    ghostLineY = clamp01((clientY - rect.top) / rect.height, ghostLineY);
    applyGhostLine();
    persistSoon();
  }

  skipLineEl?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    skipLineEl.setPointerCapture?.(e.pointerId);
    lineDrag = { pointerId: e.pointerId };
    skipLineEl.classList.add('dragging');
    setSkipLineFromClientY(e.clientY);
  });
  skipLineEl?.addEventListener('pointermove', (e) => {
    if (!lineDrag || lineDrag.pointerId !== e.pointerId) return;
    e.preventDefault();
    setSkipLineFromClientY(e.clientY);
  });
  function endLineDrag(e) {
    if (!lineDrag) return;
    if (e && lineDrag.pointerId !== e.pointerId) return;
    lineDrag = null;
    skipLineEl?.classList.remove('dragging');
  }
  skipLineEl?.addEventListener('pointerup', endLineDrag);
  skipLineEl?.addEventListener('pointercancel', endLineDrag);
  skipLineEl?.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 0.08 : 0.03;
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      skipLineY = clamp01(skipLineY - step);
      applySkipLine();
      persistSoon();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      skipLineY = clamp01(skipLineY + step);
      applySkipLine();
      persistSoon();
    } else if (e.key === 'Home') {
      e.preventDefault();
      skipLineY = 0.04;
      applySkipLine();
      persistSoon();
    } else if (e.key === 'End') {
      e.preventDefault();
      skipLineY = 0.96;
      applySkipLine();
      persistSoon();
    }
  });

  // —— Ghost guide line: independent drag ↕ + pad-head slider (visual only) ——
  ghostLineEl?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation?.();
    ghostLineEl.classList.add('dragging');
    ghostLineEl.setPointerCapture?.(e.pointerId);
    ghostDrag = { pointerId: e.pointerId };
    setGhostLineFromClientY(e.clientY);
  });
  ghostLineEl?.addEventListener('pointermove', (e) => {
    if (!ghostDrag || ghostDrag.pointerId !== e.pointerId) return;
    e.preventDefault();
    setGhostLineFromClientY(e.clientY);
  });
  function endGhostDrag(e) {
    if (!ghostDrag) return;
    if (e && ghostDrag.pointerId !== e.pointerId) return;
    ghostDrag = null;
    ghostLineEl?.classList.remove('dragging');
  }
  ghostLineEl?.addEventListener('pointerup', endGhostDrag);
  ghostLineEl?.addEventListener('pointercancel', endGhostDrag);
  ghostLineEl?.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 0.08 : 0.03;
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      ghostLineY = clamp01(ghostLineY - step);
      applyGhostLine();
      persistSoon();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      ghostLineY = clamp01(ghostLineY + step);
      applyGhostLine();
      persistSoon();
    } else if (e.key === 'Home') {
      e.preventDefault();
      ghostLineY = 0.04;
      applyGhostLine();
      persistSoon();
    } else if (e.key === 'End') {
      e.preventDefault();
      ghostLineY = 0.96;
      applyGhostLine();
      persistSoon();
    }
  });
  ghostSliderEl?.addEventListener('input', () => {
    ghostLineY = clamp01(Number(ghostSliderEl.value) / 100, ghostLineY);
    applyGhostLine();
    persistSoon();
  });

  // —— Pad gestures: click toggle · drag vel · Alt-drag tone · corner/long-press skip ——
  let gesture = null;

  function padAt(step) {
    return library[selected.lane][selected.col][step];
  }

  function commitPad(step, patch) {
    const cur = normalizePad(padAt(step));
    library[selected.lane][selected.col][step] = makePad(
      patch.on !== undefined ? patch.on : cur.on,
      patch.vel !== undefined ? patch.vel : cur.vel,
      patch.tone !== undefined ? patch.tone : cur.tone,
      patch.skip !== undefined ? patch.skip : cur.skip,
    );
    persistSoon();
  }

  function refreshPadVisual(step) {
    const btn = padRow.querySelector(`.ll-pad[data-step="${step}"]`);
    if (!btn) return;
    const p = normalizePad(padAt(step));
    btn.classList.toggle('on', p.on);
    btn.classList.toggle('skip', p.skip);
    btn.setAttribute('aria-pressed', String(p.on));
    btn.style.setProperty('--ll-vel', `${Math.round(18 + p.vel * 70)}%`);
    btn.style.setProperty('--ll-tone', String(p.tone));
    btn.title = `Step ${step + 1} · vel ${Math.round(p.vel * 100)}% · tone ${Math.round(p.tone * 100)}%`;
  }

  padRow.addEventListener('pointerdown', (e) => {
    const skipBtn = e.target.closest('[data-ll-skip]');
    const pad = e.target.closest('.ll-pad');
    if (!pad) return;
    const step = Number(pad.dataset.step);
    if (skipBtn) {
      e.preventDefault();
      e.stopPropagation();
      const cur = normalizePad(padAt(step));
      commitPad(step, { skip: !cur.skip, on: cur.on || !cur.skip });
      refreshPadVisual(step);
      render(); // update cell has-skip
      return;
    }
    pad.setPointerCapture?.(e.pointerId);
    gesture = {
      step,
      x0: e.clientX,
      y0: e.clientY,
      vel0: normalizePad(padAt(step)).vel,
      tone0: normalizePad(padAt(step)).tone,
      moved: false,
      mode: e.altKey || e.shiftKey ? 'tone' : 'vel',
      longTimer: setTimeout(() => {
        if (!gesture || gesture.moved) return;
        const cur = normalizePad(padAt(step));
        commitPad(step, { skip: !cur.skip });
        gesture.skipDone = true;
        refreshPadVisual(step);
        render();
        toast(cur.skip ? `Step ${step + 1} unskipped` : `Step ${step + 1} skipped`, 'ok');
      }, 420),
    };
  });

  padRow.addEventListener('pointermove', (e) => {
    if (!gesture) return;
    const dy = gesture.y0 - e.clientY;
    const dx = e.clientX - gesture.x0;
    if (!gesture.moved && Math.hypot(dx, dy) > 6) {
      gesture.moved = true;
      clearTimeout(gesture.longTimer);
      if (e.altKey || e.shiftKey || Math.abs(dx) > Math.abs(dy) * 1.2) gesture.mode = 'tone';
      else gesture.mode = 'vel';
    }
    if (!gesture.moved) return;
    e.preventDefault();
    if (gesture.mode === 'tone') {
      const next = Math.max(0, Math.min(1, gesture.tone0 + dy / 80));
      commitPad(gesture.step, { tone: next, on: true });
    } else {
      const next = Math.max(0.05, Math.min(1, gesture.vel0 + dy / 100));
      commitPad(gesture.step, { vel: next, on: true });
    }
    refreshPadVisual(gesture.step);
  });

  function endGesture(e) {
    if (!gesture) return;
    clearTimeout(gesture.longTimer);
    const { step, moved, skipDone } = gesture;
    gesture = null;
    if (!moved && !skipDone) {
      const cur = normalizePad(padAt(step));
      commitPad(step, { on: !cur.on });
      refreshPadVisual(step);
    }
    // Soft preview of tweaked pad
    if (moved || (!moved && !skipDone)) {
      ensureBuffers().then(() => {
        engine.resume?.();
        if (!engine.ctx) return;
        const out = engine.masterGain || engine.ctx.destination;
        const lane = LANES.find((l) => l.id === selected.lane);
        if (lane) triggerPad(lane, padAt(step), engine.ctx.currentTime, out);
      }).catch(() => {});
    }
    // Keep cell skip badge in sync
    render();
  }

  padRow.addEventListener('pointerup', endGesture);
  padRow.addEventListener('pointercancel', endGesture);

  root.querySelector('[data-ll-pad-reset]')?.addEventListener('click', () => {
    const defaults = buildLibrary()[selected.lane][selected.col];
    library[selected.lane][selected.col] = defaults.map((p) => makePad(p.on, p.vel, p.tone, false));
    persistSoon();
    render();
    toast('Pads reset for this clip');
  });

  root.querySelector('[data-ll-stop]').addEventListener('click', stopLoops);
  root.querySelector('[data-ll-clear]').addEventListener('click', () => {
    LANES.forEach((l) => { armed[l.id] = Array(COLS).fill(false); });
    persistSoon();
    stopLoops();
    toast('Live Loops arms cleared');
  });

  root.querySelector('[data-ll-write]').addEventListener('click', async () => {
    if (activeScene < 0) {
      toast('Launch a scene first, then write it', 'warn');
      return;
    }
    await ensureBuffers();
    const trackId = getSelectedTrackId?.() || engine.tracks[0]?.id;
    if (!trackId) { toast('No track', 'warn'); return; }
    let count = 0;
    const startBeat = engine.isPlaying ? (engine.currentBeat || 0) : 0;
    LANES.forEach((lane) => {
      if (!armed[lane.id][activeScene]) return;
      library[lane.id][activeScene].forEach((raw, step) => {
        const p = normalizePad(raw);
        if (!p.on || p.skip) return;
        engine.addClip(trackId, {
          name: `LL ${lane.label}`,
          startBeat: startBeat + step * 0.25,
          durationBeats: 0.25,
          color: lane.color,
          buffer: buffers[lane.id],
          recipe: lane.recipe,
          meta: { kind: 'll-pad', vel: p.vel, tone: p.tone, lane: lane.id, step },
        });
        count++;
      });
    });
    status.textContent = `Wrote ${count} hits from scene ${activeScene + 1} → track`;
    toast(`Scene ${activeScene + 1} → timeline (${count} hits)`);
  });

  engine.on('bpm', (bpm) => {
    bpmEl.textContent = `${bpm} BPM`;
    status.textContent = playing ? `Scene ${activeScene + 1} · ${bpm} BPM` : `Arm cells, then Launch · ${bpm} BPM`;
  });

  const dnaBox = root.querySelector('[data-ll-dna]');
  const dnaText = root.querySelector('[data-ll-dna-text]');
  let suggestedCol = 0;
  function applyDnaSuggest(detail) {
    if (!detail?.compat && !detail?.tempo) return;
    const bpm = detail.compat?.bpm || detail.tempo?.bpm || engine.bpm;
    const mood = detail.compat?.mood || detail.mood?.mood || 'groovy';
    const moodMap = { energetic: 5, bright: 4, dark: 2, ambient: 0, chill: 1, groovy: 3 };
    suggestedCol = Math.max(0, Math.min(COLS - 1, moodMap[mood] ?? Math.round((bpm % 100) / 14)));
    if (dnaBox && dnaText) {
      dnaBox.hidden = false;
      dnaText.textContent = `Compatible hint: scene ${suggestedCol + 1} · ${detail.key?.label || detail.compat?.keyRoot || '?'} · ${bpm} BPM · ${mood}`;
    }
  }
  window.addEventListener('mm-stem-dna', (e) => applyDnaSuggest(e.detail));
  root.querySelector('[data-ll-dna-arm]')?.addEventListener('click', () => {
    LANES.forEach((l) => { armed[l.id][suggestedCol] = true; });
    selected = { lane: 'hat', col: suggestedCol };
    persistSoon();
    render();
    toast(`Armed scene ${suggestedCol + 1} from Stem DNA hint`);
    launchScene(suggestedCol);
  });

  render();

  return {
    stop: stopLoops,
    launchScene,
    arm(laneId, col, on = true) {
      if (!armed[laneId] || col < 0 || col >= COLS) return false;
      armed[laneId][col] = !!on;
      selected = { lane: laneId, col };
      persistSoon();
      render();
      return true;
    },
    getActiveScene: () => activeScene,
    isPlaying: () => playing,
    /** Voice / external: set pad params on selected or given lane×col×step */
    setPad(laneId, col, step, patch = {}) {
      if (!library[laneId] || col < 0 || col >= COLS || step < 0 || step >= STEPS) return false;
      const cur = normalizePad(library[laneId][col][step]);
      library[laneId][col][step] = makePad(
        patch.on !== undefined ? patch.on : cur.on,
        patch.vel !== undefined ? patch.vel : cur.vel,
        patch.tone !== undefined ? patch.tone : cur.tone,
        patch.skip !== undefined ? patch.skip : cur.skip,
      );
      persistSoon();
      if (selected.lane === laneId && selected.col === col) render();
      return true;
    },
  };
}
