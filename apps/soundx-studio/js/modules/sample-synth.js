/**
 * Sample Synth — prompt → short Web Audio one-shots
 */
const PRESETS = {
  kick: { type: 'kick', duration: 0.45, color: '#F5C518', label: 'Kick' },
  hat: { type: 'hat', duration: 0.12, color: '#E8A838', label: 'Hat' },
  hihat: { type: 'hat', duration: 0.12, color: '#E8A838', label: 'Hat' },
  snare: { type: 'snare', duration: 0.28, color: '#D4A017', label: 'Snare' },
  pad: { type: 'pad', duration: 2.5, freqs: [220, 277, 330], color: '#B8860B', label: 'Pad' },
  bass: { type: 'tone', freq: 55, duration: 0.6, color: '#C9A227', label: 'Bass' },
  tom: { type: 'kick', duration: 0.35, color: '#DAA520', label: 'Tom' },
  noise: { type: 'noise', duration: 0.4, color: '#8a7a40', label: 'Noise' },
};

export function createSampleLibrary() {
  const samples = new Map();
  const STARTERS = [
    { id: 'starter-kick', name: 'Kick', recipe: { ...PRESETS.kick }, color: PRESETS.kick.color, source: 'starter' },
    { id: 'starter-snare', name: 'Snare', recipe: { ...PRESETS.snare }, color: PRESETS.snare.color, source: 'starter' },
    { id: 'starter-hat', name: 'Hat', recipe: { ...PRESETS.hat }, color: PRESETS.hat.color, source: 'starter' },
    { id: 'starter-bass', name: 'Bass', recipe: { ...PRESETS.bass }, color: PRESETS.bass.color, source: 'starter' },
    { id: 'starter-pad', name: 'Pad', recipe: { ...PRESETS.pad }, color: PRESETS.pad.color, source: 'starter' },
  ];
  STARTERS.forEach((s) => samples.set(s.id, { ...s, durationBeats: 1 }));
  return {
    add(sample) {
      samples.set(sample.id, sample);
      return sample;
    },
    get(id) {
      return samples.get(id);
    },
    list() {
      return [...samples.values()];
    },
    /** Ensure starter recipes have AudioBuffers (lazy, needs engine). */
    async ensureBuffers(engine) {
      await engine.init();
      for (const s of samples.values()) {
        if (!s.buffer && s.recipe) {
          s.buffer = engine.createBufferFromRecipe(s.recipe);
          s.durationBeats = Math.max(0.25, (s.recipe.duration || 0.5) / engine.secondsPerBeat);
        }
      }
    },
    samples,
  };
}

export function mountSampleSynth(root, engine, library, toast, onLibraryChange) {
  root.innerHTML = `
    <div class="panel-head">
      <h2>Sample Synth</h2>
      <span class="badge">Web Audio</span>
    </div>
    <p class="panel-desc">Describe a one-shot (kick, hat, snare, pad, bass). Generates a short synthesized buffer — no cloud, no copyrighted packs.</p>
    <form class="synth-form" data-form>
      <input type="text" placeholder="e.g. warm pad, tight kick, open hat" data-prompt />
      <button type="submit" class="btn primary">Generate</button>
    </form>
    <div class="quick-row">
      <button type="button" class="btn sm ghost" data-preset="kick">Kick</button>
      <button type="button" class="btn sm ghost" data-preset="hat">Hat</button>
      <button type="button" class="btn sm ghost" data-preset="snare">Snare</button>
      <button type="button" class="btn sm ghost" data-preset="pad">Pad</button>
    </div>
    <div class="lib-list" data-lib></div>
  `;

  const libEl = root.querySelector('[data-lib]');

  function parsePrompt(text) {
    const lower = text.toLowerCase();
    for (const key of Object.keys(PRESETS)) {
      if (lower.includes(key)) return { ...PRESETS[key], name: text.trim() || PRESETS[key].label };
    }
    // soft defaults from adjectives
    if (/warm|lush|soft|ambient/.test(lower)) return { ...PRESETS.pad, name: text.trim() };
    if (/punch|thump|boom/.test(lower)) return { ...PRESETS.kick, name: text.trim() };
    if (/tick|metal|bright/.test(lower)) return { ...PRESETS.hat, name: text.trim() };
    return { ...PRESETS.kick, name: text.trim() || 'One-shot' };
  }

  async function generate(prompt) {
    await engine.init();
    const recipe = parsePrompt(prompt || 'kick');
    const buffer = engine.createBufferFromRecipe(recipe);
    const id = `smp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const sample = {
      id,
      name: recipe.name || recipe.label,
      recipe,
      buffer,
      color: recipe.color,
      durationBeats: Math.max(0.25, (recipe.duration || 0.5) / engine.secondsPerBeat),
    };
    library.add(sample);
    renderLib();
    onLibraryChange?.();
    toast(`Generated “${sample.name}” — drag onto timeline`);
    // preview
    const src = engine.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(engine.masterGain);
    src.start();
    return sample;
  }

  function renderLib() {
    const items = library.list();
    if (!items.length) {
      libEl.innerHTML = '<div class="empty">No samples yet — generate one above.</div>';
      return;
    }
    libEl.innerHTML = items.map((s) => `
      <div class="lib-item" draggable="true" data-id="${s.id}" title="Drag to timeline">
        <span class="lib-swatch" style="background:${s.color}"></span>
        <span class="lib-name">${s.name}</span>
        <button type="button" class="btn sm ghost" data-preview="${s.id}">▶</button>
        <button type="button" class="btn sm ghost" data-add="${s.id}">+</button>
      </div>
    `).join('');

    libEl.querySelectorAll('.lib-item').forEach((el) => {
      el.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('application/x-mm-sample', el.dataset.id);
        e.dataTransfer.effectAllowed = 'copy';
      });
    });
  }

  root.querySelector('[data-form]').addEventListener('submit', (e) => {
    e.preventDefault();
    const prompt = root.querySelector('[data-prompt]').value;
    generate(prompt);
  });

  root.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => generate(btn.dataset.preset));
  });

  libEl.addEventListener('click', async (e) => {
    const prev = e.target.closest('[data-preview]');
    if (prev) {
      await engine.init();
      const s = library.get(prev.dataset.preview);
      if (!s?.buffer) return;
      const src = engine.ctx.createBufferSource();
      src.buffer = s.buffer;
      src.connect(engine.masterGain);
      src.start();
      return;
    }
    const add = e.target.closest('[data-add]');
    if (add) {
      await engine.init();
      const s = library.get(add.dataset.add);
      const track = engine.tracks[0];
      if (!s || !track) return;
      engine.addClip(track.id, {
        name: s.name,
        startBeat: Math.floor(engine.currentBeat),
        durationBeats: s.durationBeats,
        color: s.color,
        buffer: s.buffer,
        recipe: s.recipe,
      });
      toast(`Added ${s.name} to ${track.name}`);
    }
  });

  renderLib();
  return { generate, renderLib };
}
