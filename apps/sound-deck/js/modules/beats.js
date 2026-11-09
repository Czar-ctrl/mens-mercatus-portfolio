/**
 * Beats — 16-step sequencer (kick/snare/hat/perc) synced to BPM → timeline
 */
const LANES = [
  { id: 'kick', label: 'Kick', color: '#F5C518', recipe: { type: 'kick', duration: 0.4 } },
  { id: 'snare', label: 'Snare', color: '#E8A838', recipe: { type: 'snare', duration: 0.28 } },
  { id: 'hat', label: 'Hat', color: '#C9A227', recipe: { type: 'hat', duration: 0.1 } },
  { id: 'perc', label: 'Perc', color: '#B8860B', recipe: { type: 'noise', duration: 0.15 } },
];

export function mountBeats(root, engine, toast, getSelectedTrackId) {
  const pattern = Object.fromEntries(LANES.map((l) => [l.id, Array(16).fill(false)]));
  // default four-on-floor-ish
  [0, 4, 8, 12].forEach((i) => { pattern.kick[i] = true; });
  [4, 12].forEach((i) => { pattern.snare[i] = true; });
  for (let i = 0; i < 16; i += 2) pattern.hat[i] = true;

  root.innerHTML = `
    <div class="panel-head">
      <h2>Beats</h2>
      <span class="badge">16-step</span>
    </div>
    <p class="panel-desc">Step sequencer synced to session BPM. Write the pattern onto a timeline track as one-shot clips. Virtual Drummer and Live Loops can push patterns here.</p>
    <div class="beat-grid" data-grid></div>
    <div class="btn-row" style="margin-top:10px">
      <button type="button" class="btn primary" data-write>Write to track</button>
      <button type="button" class="btn ghost" data-clear>Clear</button>
      <button type="button" class="btn ghost" data-preset="basic">Basic</button>
      <button type="button" class="btn ghost" data-preset="break">Break</button>
    </div>
    <label class="field block" style="margin-top:8px">
      <span>Target track</span>
      <select data-track></select>
    </label>
    <div class="stem-status" data-status>Pattern ready · ${engine.bpm} BPM</div>
  `;

  const grid = root.querySelector('[data-grid]');
  const trackSel = root.querySelector('[data-track]');
  const status = root.querySelector('[data-status]');

  function renderGrid() {
    grid.innerHTML = LANES.map((lane) => `
      <div class="beat-lane" data-lane="${lane.id}">
        <span class="beat-lane-label" style="color:${lane.color}">${lane.label}</span>
        <div class="beat-steps">
          ${pattern[lane.id].map((on, i) =>
            `<button type="button" class="beat-step ${on ? 'on' : ''} ${i % 4 === 0 ? 'bar' : ''}"
              data-lane="${lane.id}" data-step="${i}" aria-pressed="${on}"></button>`
          ).join('')}
        </div>
      </div>
    `).join('');
  }

  function refreshTracks() {
    const sel = getSelectedTrackId?.();
    trackSel.innerHTML = engine.tracks.map((t) =>
      `<option value="${t.id}" ${t.id === sel ? 'selected' : ''}>${t.name}</option>`
    ).join('');
  }

  function setPattern(next) {
    if (!next) return;
    LANES.forEach((l) => {
      if (Array.isArray(next[l.id]) && next[l.id].length === 16) {
        pattern[l.id] = next[l.id].map(Boolean);
      }
    });
    renderGrid();
    status.textContent = `Pattern synced · ${engine.bpm} BPM`;
  }

  function getPattern() {
    return Object.fromEntries(LANES.map((l) => [l.id, [...pattern[l.id]]]));
  }

  renderGrid();
  refreshTracks();
  engine.on('tracks', refreshTracks);
  engine.on('bpm', (bpm) => { status.textContent = `Pattern ready · ${bpm} BPM`; });

  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('.beat-step');
    if (!btn) return;
    const lane = btn.dataset.lane;
    const step = Number(btn.dataset.step);
    pattern[lane][step] = !pattern[lane][step];
    renderGrid();
  });

  root.querySelector('[data-clear]').addEventListener('click', () => {
    LANES.forEach((l) => { pattern[l.id] = Array(16).fill(false); });
    renderGrid();
    toast('Pattern cleared');
  });

  root.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      LANES.forEach((l) => { pattern[l.id] = Array(16).fill(false); });
      if (btn.dataset.preset === 'basic') {
        [0, 4, 8, 12].forEach((i) => { pattern.kick[i] = true; });
        [4, 12].forEach((i) => { pattern.snare[i] = true; });
        for (let i = 0; i < 16; i += 2) pattern.hat[i] = true;
      } else {
        [0, 3, 6, 10].forEach((i) => { pattern.kick[i] = true; });
        [4, 12].forEach((i) => { pattern.snare[i] = true; });
        for (let i = 0; i < 16; i++) if (i % 2) pattern.hat[i] = true;
        [7, 15].forEach((i) => { pattern.perc[i] = true; });
      }
      renderGrid();
      toast(`Preset: ${btn.dataset.preset}`);
    });
  });

  async function writeToTrack() {
    await engine.init();
    const trackId = trackSel.value || engine.tracks[0]?.id;
    if (!trackId) { toast('No track', 'warn'); return; }
    const buffers = {};
    LANES.forEach((l) => { buffers[l.id] = engine.createBufferFromRecipe(l.recipe); });
    let count = 0;
    LANES.forEach((lane) => {
      pattern[lane.id].forEach((on, step) => {
        if (!on) return;
        const startBeat = step * 0.25;
        engine.addClip(trackId, {
          name: lane.label,
          startBeat,
          durationBeats: 0.25,
          color: lane.color,
          buffer: buffers[lane.id],
          recipe: lane.recipe,
        });
        count++;
      });
    });
    status.textContent = `Wrote ${count} hits @ ${engine.bpm} BPM → track`;
    toast(`Beat pattern written (${count} hits)`);
    return count;
  }

  root.querySelector('[data-write]').addEventListener('click', writeToTrack);

  return { setPattern, getPattern, writeToTrack, renderGrid };
}
