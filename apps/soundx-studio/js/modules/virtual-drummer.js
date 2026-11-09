/**
 * Virtual Drummer — DEMO AI drummer (local procedural / rule-based).
 * Genre presets + intensity/complexity → kick/snare/hat/perc into Beats + Pattern rack + drums track.
 * Honest “DEMO AI drummer” label — not a cloud model.
 */

const GENRES = [
  {
    id: 'house',
    label: 'House',
    bpm: 124,
    kit: 'mm-house',
    base: {
      kick: [0, 4, 8, 12],
      snare: [4, 12],
      hat: [0, 2, 4, 6, 8, 10, 12, 14],
      perc: [7, 15],
    },
  },
  {
    id: 'hiphop',
    label: 'Hip-Hop',
    bpm: 92,
    kit: 'mm-boombap',
    base: {
      kick: [0, 3, 8, 10],
      snare: [4, 12],
      hat: [0, 2, 4, 6, 8, 10, 12, 14],
      perc: [7],
    },
  },
  {
    id: 'amapiano',
    label: 'Amapiano',
    bpm: 112,
    kit: 'mm-house',
    base: {
      kick: [0, 6, 8, 14],
      snare: [4, 12],
      hat: [2, 6, 10, 14],
      perc: [3, 7, 11, 15],
    },
  },
  {
    id: 'afrobeat',
    label: 'Afrobeat',
    bpm: 108,
    kit: 'mm-house',
    base: {
      kick: [0, 3, 8, 11],
      snare: [4, 12],
      hat: [0, 2, 4, 5, 6, 8, 10, 12, 13, 14],
      perc: [1, 7, 9, 15],
    },
  },
  {
    id: 'rock',
    label: 'Rock',
    bpm: 128,
    kit: 'mm-boombap',
    base: {
      kick: [0, 8],
      snare: [4, 12],
      hat: [0, 2, 4, 6, 8, 10, 12, 14],
      perc: [15],
    },
  },
  {
    id: 'electronic',
    label: 'Electronic',
    bpm: 130,
    kit: 'mm-trap',
    base: {
      kick: [0, 4, 8, 10, 12],
      snare: [4, 12],
      hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      perc: [6, 14],
    },
  },
];

const LANES = [
  { id: 'kick', label: 'Kick', color: '#F5C518', recipe: { type: 'kick', duration: 0.4 } },
  { id: 'snare', label: 'Snare', color: '#E8A838', recipe: { type: 'snare', duration: 0.28 } },
  { id: 'hat', label: 'Hat', color: '#C9A227', recipe: { type: 'hat', duration: 0.1 } },
  { id: 'perc', label: 'Perc', color: '#B8860B', recipe: { type: 'noise', duration: 0.15 } },
];

function emptyPattern() {
  return Object.fromEntries(LANES.map((l) => [l.id, Array(16).fill(false)]));
}

function fromHits(hits) {
  const p = emptyPattern();
  Object.entries(hits).forEach(([id, steps]) => {
    (steps || []).forEach((i) => { if (i >= 0 && i < 16) p[id][i] = true; });
  });
  return p;
}

/** Intensity densifies kicks/hats; complexity adds ghost notes & perc. Pure local rules. */
function generatePattern(genreId, intensity = 0.55, complexity = 0.4) {
  const g = GENRES.find((x) => x.id === genreId) || GENRES[0];
  const p = fromHits(g.base);
  const i = Math.max(0, Math.min(1, intensity));
  const c = Math.max(0, Math.min(1, complexity));

  // Intensity: extra kicks on offbeats, denser hats
  if (i > 0.35) {
    [2, 10].forEach((s) => { if (Math.random() < i) p.kick[s] = true; });
  }
  if (i > 0.65) {
    for (let s = 0; s < 16; s++) if (s % 2) p.hat[s] = true;
  }
  if (i < 0.3) {
    // sparse — strip some hats
    p.hat = p.hat.map((on, s) => on && s % 4 === 0);
  }

  // Complexity: ghost snares, syncopated perc, open spaces
  if (c > 0.4) {
    [6, 14].forEach((s) => { if (Math.random() < c) p.snare[s] = true; });
    [1, 5, 9, 13].forEach((s) => { if (Math.random() < c * 0.7) p.perc[s] = true; });
  }
  if (c > 0.7) {
    [7, 15].forEach((s) => { p.kick[s] = Math.random() < 0.5; });
    for (let s = 0; s < 16; s++) if (Math.random() < 0.25) p.hat[s] = !p.hat[s];
  }

  return { pattern: p, genre: g, intensity: i, complexity: c };
}

function patternToKitRows(pattern) {
  const hits = (id) => pattern[id].map((on, i) => (on ? i : -1)).filter((i) => i >= 0);
  return [
    { inst: 'kick', steps: hits('kick') },
    { inst: 'snare', steps: hits('snare') },
    { inst: 'hatC', steps: hits('hat') },
    { inst: 'rim', steps: hits('perc') },
  ];
}

export function mountVirtualDrummer(root, engine, toast, {
  getSelectedTrackId,
  onPatternSync,
  patternApi,
  views,
} = {}) {
  let state = {
    genre: 'house',
    intensity: 0.55,
    complexity: 0.4,
    pattern: emptyPattern(),
    lastGenre: null,
  };

  root.innerHTML = `
    <div class="panel-head">
      <h2>Virtual Drummer</h2>
      <span class="badge warn" title="Local procedural rules — not a cloud LLM">DEMO AI drummer</span>
    </div>
    <p class="panel-desc">Pick a genre, set intensity &amp; complexity, then Generate. Patterns land in Beats / Live Loops sync and can write to the Drums track. Pure local rules — honest DEMO.</p>

    <div class="vd-genres" role="group" aria-label="Genre presets">
      ${GENRES.map((g) => `
        <button type="button" class="vd-genre ${g.id === state.genre ? 'active' : ''}" data-vd-genre="${g.id}" title="~${g.bpm} BPM">
          ${g.label}
        </button>`).join('')}
    </div>

    <div class="vd-xy" aria-label="Intensity and complexity">
      <label class="field block">
        <span>Intensity <em data-vd-i-val>55%</em></span>
        <input type="range" min="0" max="100" value="55" data-vd-intensity />
      </label>
      <label class="field block">
        <span>Complexity <em data-vd-c-val>40%</em></span>
        <input type="range" min="0" max="100" value="40" data-vd-complexity />
      </label>
    </div>

    <div class="vd-preview beat-grid" data-vd-preview aria-label="Generated pattern preview"></div>

    <div class="btn-row" style="margin-top:10px">
      <button type="button" class="btn primary" data-vd-gen>Generate</button>
      <button type="button" class="btn ghost" data-vd-write>Write to Drums track</button>
      <button type="button" class="btn ghost" data-vd-bpm title="Set engine BPM to genre default">Apply genre BPM</button>
      <label class="toggle" title="Also push into Pattern rack">
        <input type="checkbox" data-vd-rack checked /> Pattern rack
      </label>
    </div>
    <div class="stem-status" data-vd-status>Ready · pick genre → Generate</div>
  `;

  const preview = root.querySelector('[data-vd-preview]');
  const status = root.querySelector('[data-vd-status]');
  const iVal = root.querySelector('[data-vd-i-val]');
  const cVal = root.querySelector('[data-vd-c-val]');

  function renderPreview() {
    preview.innerHTML = LANES.map((lane) => `
      <div class="beat-lane" data-lane="${lane.id}">
        <span class="beat-lane-label" style="color:${lane.color}">${lane.label}</span>
        <div class="beat-steps">
          ${state.pattern[lane.id].map((on, i) =>
            `<span class="beat-step ${on ? 'on' : ''} ${i % 4 === 0 ? 'bar' : ''}" aria-hidden="true"></span>`
          ).join('')}
        </div>
      </div>`).join('');
  }

  function applyToRack(genre) {
    if (!patternApi || !root.querySelector('[data-vd-rack]')?.checked) return;
    const rows = patternToKitRows(state.pattern);
    patternApi.loadMeta({ kind: 'pattern', bars: 1, rows: rows.map((r) => ({
      inst: r.inst, midi: 60, vol: 0.8, muted: false, steps: Array(16).fill(0).map((_, i) => (r.steps.includes(i) ? 1 : 0)), nudge: 0,
    })) });
    views?.setMode?.('pattern');
  }

  function generate() {
    const result = generatePattern(state.genre, state.intensity, state.complexity);
    state.pattern = result.pattern;
    state.lastGenre = result.genre;
    renderPreview();
    onPatternSync?.(state.pattern);
    applyToRack(result.genre);
    status.textContent = `Generated ${result.genre.label} · I ${Math.round(result.intensity * 100)}% · C ${Math.round(result.complexity * 100)}% · DEMO AI drummer`;
    toast(`Virtual Drummer · ${result.genre.label}`);
    return result;
  }

  async function writeToTrack() {
    await engine.init();
    const sel = getSelectedTrackId?.();
    let track = engine.tracks.find((t) => /drum/i.test(t.name))
      || engine.tracks.find((t) => t.id === sel)
      || engine.tracks[0];
    const trackId = track?.id;
    if (!trackId) { toast('No track', 'warn'); return; }
    const buffers = {};
    LANES.forEach((l) => { buffers[l.id] = engine.createBufferFromRecipe(l.recipe); });
    let count = 0;
    LANES.forEach((lane) => {
      state.pattern[lane.id].forEach((on, step) => {
        if (!on) return;
        engine.addClip(trackId, {
          name: `VD ${lane.label}`,
          startBeat: step * 0.25,
          durationBeats: 0.25,
          color: lane.color,
          buffer: buffers[lane.id],
          recipe: lane.recipe,
        });
        count++;
      });
    });
    status.textContent = `Wrote ${count} hits → ${track?.name || 'track'} @ ${engine.bpm} BPM`;
    toast(`Drummer wrote ${count} hits`);
  }

  root.querySelector('.vd-genres').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-vd-genre]');
    if (!btn) return;
    state.genre = btn.dataset.vdGenre;
    root.querySelectorAll('[data-vd-genre]').forEach((b) => b.classList.toggle('active', b === btn));
  });

  root.querySelector('[data-vd-intensity]').addEventListener('input', (e) => {
    state.intensity = Number(e.target.value) / 100;
    iVal.textContent = `${e.target.value}%`;
  });
  root.querySelector('[data-vd-complexity]').addEventListener('input', (e) => {
    state.complexity = Number(e.target.value) / 100;
    cVal.textContent = `${e.target.value}%`;
  });

  root.querySelector('[data-vd-gen]').addEventListener('click', generate);
  root.querySelector('[data-vd-write]').addEventListener('click', writeToTrack);
  root.querySelector('[data-vd-bpm]').addEventListener('click', () => {
    const g = GENRES.find((x) => x.id === state.genre) || GENRES[0];
    engine.setBpm(g.bpm);
    toast(`BPM → ${g.bpm} (${g.label})`);
  });

  renderPreview();

  return {
    generate,
    writeToTrack,
    setGenre(id) {
      if (!GENRES.some((g) => g.id === id)) return false;
      state.genre = id;
      root.querySelectorAll('[data-vd-genre]').forEach((b) => b.classList.toggle('active', b.dataset.vdGenre === id));
      return true;
    },
    setIntensity(v) {
      state.intensity = Math.max(0, Math.min(1, v));
      const el = root.querySelector('[data-vd-intensity]');
      if (el) el.value = String(Math.round(state.intensity * 100));
      iVal.textContent = `${Math.round(state.intensity * 100)}%`;
    },
    setComplexity(v) {
      state.complexity = Math.max(0, Math.min(1, v));
      const el = root.querySelector('[data-vd-complexity]');
      if (el) el.value = String(Math.round(state.complexity * 100));
      cVal.textContent = `${Math.round(state.complexity * 100)}%`;
    },
    getState: () => ({ ...state, pattern: { ...state.pattern } }),
    genres: GENRES,
  };
}

export { GENRES, generatePattern };
