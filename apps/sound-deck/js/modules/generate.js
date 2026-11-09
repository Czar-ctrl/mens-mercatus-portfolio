/**
 * Generate — in-house Web Audio music tools (Mens Mercatus original).
 * Inspired by text-to-music / stems / continuation workflows — local oscillators
 * & envelopes only. Not a cloud foundation model. No Suno / Greysound.
 */
import {
  COLORS,
  GENRES,
  MOODS,
  SCALES,
  bassNotes,
  chordFreqs,
  degToHz,
  drumPattern,
  inferHarmonyFromProject,
  lastClipEndBeat,
  matchGenre,
  matchMood,
  matchScale,
  melodyContour,
  mulberry32,
  parseRoot,
  seedFrom,
} from '../audio/generator.js';
import { detectSessionBeat } from '../audio/beat-detect.js?v=20261009ml';

const QUICK_PROMPTS = [
  'dark house groove',
  'lofi chill A minor',
  'energetic trap drums',
  'warm ambient pad bed',
  'pop melody in C major',
  'jazzy dorian bass walk',
];

const STEM_KINDS = [
  { id: 'drums', label: 'Drums', color: COLORS.drums },
  { id: 'bass', label: 'Bass', color: COLORS.bass },
  { id: 'melody', label: 'Melody', color: COLORS.melody },
  { id: 'pad', label: 'Pad', color: COLORS.pad },
  { id: 'fx', label: 'FX', color: COLORS.fx },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function openGodFeature(id) {
  document.dispatchEvent(new CustomEvent('sx-god:focus', { detail: { id } }));
}

export function mountGenerate(root, engine, library, toast, onLibraryChange, getSelectedTrackId) {
  root.innerHTML = `
    <div class="panel-head">
      <h2>Generate</h2>
      <span class="badge">Web Audio</span>
    </div>
    <p class="panel-desc">In-house AI Music tools — text-to-music, stems, and song continuation via local synthesis (oscillators / noise / envelopes). <strong>Not</strong> a cloud foundation model. Offline in your browser.</p>

    <div class="gen-tool-tabs" role="tablist" aria-label="Generate tools">
      <button type="button" class="gen-tool active" data-tool-tab="ttm" role="tab" aria-selected="true">Text-to-music</button>
      <button type="button" class="gen-tool" data-tool-tab="stems" role="tab" aria-selected="false">Stems</button>
      <button type="button" class="gen-tool" data-tool-tab="cont" role="tab" aria-selected="false">Continue</button>
    </div>

    <div class="gen-pane" data-tool-pane="ttm">
      <label class="field block">
        <span>Prompt</span>
        <textarea data-ttm-prompt rows="2" placeholder="e.g. dark house groove in A minor, warm pads…"></textarea>
      </label>
      <div class="quick-row" data-ttm-chips>
        ${QUICK_PROMPTS.map((p) => `<button type="button" class="btn sm ghost" data-chip="${p}">${p}</button>`).join('')}
      </div>
      <div class="gen-grid">
        <label class="field">
          <span>Genre</span>
          <select data-ttm-genre>
            ${Object.keys(GENRES).map((g) => `<option value="${g}">${g}</option>`).join('')}
          </select>
        </label>
        <label class="field">
          <span>Mood</span>
          <select data-ttm-mood>
            ${Object.keys(MOODS).map((m) => `<option value="${m}">${m}</option>`).join('')}
          </select>
        </label>
        <label class="field">
          <span>Bars</span>
          <select data-ttm-bars>
            <option value="4">4</option>
            <option value="8" selected>8</option>
            <option value="12">12</option>
            <option value="16">16</option>
          </select>
        </label>
        <label class="field">
          <span>Use session BPM</span>
          <select data-ttm-bpm-mode>
            <option value="listen" selected>Listen to the session</option>
            <option value="session">Session (${engine.bpm})</option>
            <option value="genre">Genre default</option>
          </select>
        </label>
      </div>
      <div class="btn-row">
        <button type="button" class="btn primary" data-ttm-go>Generate arrangement</button>
        <button type="button" class="btn ghost sm" data-god-hook="prompt-arrangement" title="Open God Mode · Prompt → Arrangement">God: Prompt → Arrangement</button>
        <button type="button" class="btn ghost sm" data-god-hook="intent-copilot" title="Open God Mode · Intent Co-Pilot (plain-language edits, undoable)">God: Intent Co-Pilot</button>
        <button type="button" class="btn ghost sm" data-god-hook="agi-desk" title="Open God Mode · AGI Desk (honest) — routes to local tools only">God: AGI Desk</button>
      </div>
    </div>

    <div class="gen-pane" data-tool-pane="stems" hidden>
      <label class="field block">
        <span>Stem prompt</span>
        <input type="text" data-stem-prompt placeholder="e.g. punchy kick pattern, warm pad…" />
      </label>
      <div class="quick-row">
        ${STEM_KINDS.map((s) => `<button type="button" class="btn sm ghost" data-stem-kind="${s.id}" style="border-color:${s.color}">${s.label}</button>`).join('')}
      </div>
      <label class="field block">
        <span>Stem type</span>
        <select data-stem-type>
          ${STEM_KINDS.map((s) => `<option value="${s.id}">${s.label}</option>`).join('')}
        </select>
      </label>
      <label class="field block">
        <span>Bars</span>
        <select data-stem-bars>
          <option value="2">2</option>
          <option value="4" selected>4</option>
          <option value="8">8</option>
        </select>
      </label>
      <label class="field block">
        <span>Target track</span>
        <select data-stem-track>
          <option value="__new__">New track</option>
        </select>
      </label>
      <div class="btn-row">
        <button type="button" class="btn primary" data-stem-go>Generate stem</button>
      </div>
    </div>

    <div class="gen-pane" data-tool-pane="cont" hidden>
      <p class="panel-desc" style="margin-top:0">Uses session BPM and last clip(s) / playhead to append a coherent next phrase (harmony + rhythm feel).</p>
      <label class="field block">
        <span>Continue bars</span>
        <select data-cont-bars>
          <option value="2">2</option>
          <option value="4" selected>4</option>
          <option value="8">8</option>
        </select>
      </label>
      <label class="field block">
        <span>Place after</span>
        <select data-cont-place>
          <option value="last" selected>Last clip end</option>
          <option value="playhead">Playhead</option>
        </select>
      </label>
      <label class="field block">
        <span>Hint (optional)</span>
        <input type="text" data-cont-hint placeholder="e.g. brighter, add hats, A minor…" />
      </label>
      <div class="btn-row">
        <button type="button" class="btn primary" data-cont-go>Continue song</button>
        <button type="button" class="btn ghost sm" data-god-hook="continue-clip" title="Open God Mode · Continue Clip">God: Continue Clip</button>
      </div>
    </div>

    <div class="stem-progress" data-progress hidden>
      <div class="stem-progress-bar"><i data-pbar></i></div>
      <span data-ptext>0%</span>
    </div>
    <div class="stem-status" data-status>Ready · local Web Audio · ${engine.bpm} BPM</div>
    <p class="fineprint">Honest limits: procedural multi-layer synth arrangements — not vocal synthesis or a trained music LM.</p>
  `;

  const status = root.querySelector('[data-status]');
  const progress = root.querySelector('[data-progress]');
  const pbar = root.querySelector('[data-pbar]');
  const ptext = root.querySelector('[data-ptext]');
  const stemTrackSel = root.querySelector('[data-stem-track]');
  const bpmModeSel = root.querySelector('[data-ttm-bpm-mode]');

  root.addEventListener('click', (e) => {
    const hook = e.target.closest('[data-god-hook]');
    if (!hook) return;
    e.preventDefault();
    openGodFeature(hook.dataset.godHook);
  });

  engine.on('bpm', (bpm) => {
    status.textContent = status.textContent.replace(/\d+ BPM/, `${bpm} BPM`) || `Ready · local Web Audio · ${bpm} BPM`;
    const opt = bpmModeSel.querySelector('option[value="session"]');
    if (opt) opt.textContent = `Session (${bpm})`;
  });

  function setProgress(pct, label) {
    progress.hidden = pct <= 0 && !label;
    if (pct <= 0 && !label) {
      progress.hidden = true;
      return;
    }
    progress.hidden = false;
    pbar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    ptext.textContent = label || `${Math.round(pct)}%`;
  }

  async function withProgress(steps, work) {
    setProgress(4, steps[0] || 'Starting…');
    await sleep(40);
    const result = await work((i, msg) => {
      const pct = 8 + (i / Math.max(1, steps.length)) * 90;
      setProgress(pct, msg || steps[i] || 'Working…');
    });
    setProgress(100, 'Done');
    await sleep(280);
    setProgress(0);
    return result;
  }

  // —— tool tabs ——
  root.querySelectorAll('[data-tool-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('[data-tool-tab]').forEach((b) => {
        const on = b === btn;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      root.querySelectorAll('[data-tool-pane]').forEach((pane) => {
        pane.hidden = pane.dataset.toolPane !== btn.dataset.toolTab;
      });
    });
  });

  root.querySelector('[data-ttm-chips]').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-chip]');
    if (!chip) return;
    const ta = root.querySelector('[data-ttm-prompt]');
    ta.value = chip.dataset.chip;
    const g = matchGenre(chip.dataset.chip);
    const mood = matchMood(chip.dataset.chip, GENRES[g].mood);
    root.querySelector('[data-ttm-genre]').value = g;
    root.querySelector('[data-ttm-mood]').value = mood;
  });

  root.querySelectorAll('[data-stem-kind]').forEach((btn) => {
    btn.addEventListener('click', () => {
      root.querySelector('[data-stem-type]').value = btn.dataset.stemKind;
      const input = root.querySelector('[data-stem-prompt]');
      if (!input.value.trim()) input.value = `${btn.textContent} phrase`;
    });
  });

  function refreshStemTracks() {
    const sel = getSelectedTrackId?.();
    const opts = [`<option value="__new__">New track</option>`];
    engine.tracks.forEach((t) => {
      opts.push(`<option value="${t.id}" ${t.id === sel ? 'selected' : ''}>${t.name}</option>`);
    });
    stemTrackSel.innerHTML = opts.join('');
  }
  refreshStemTracks();
  engine.on('tracks', refreshStemTracks);

  function ensureNamedTrack(pred, name, type = 'audio') {
    while (engine.tracks.length < 4) {
      engine.addTrack(engine.tracks.length >= 2 ? 'midi' : 'audio');
    }
    let t = engine.tracks.find(pred);
    if (!t) t = engine.addTrack(type, name);
    else if (name && /^Track\s/i.test(t.name)) t.name = name;
    return t;
  }

  function addToLibrary(name, buffer, color, recipe) {
    if (!library || !buffer) return null;
    const id = `gen-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const sample = {
      id,
      name,
      buffer,
      color,
      recipe: recipe || null,
      durationBeats: Math.max(0.25, buffer.duration / engine.secondsPerBeat),
    };
    library.add(sample);
    onLibraryChange?.();
    return sample;
  }

  function writeDrums(track, bars, style, startBeat, rng) {
    const pat = drumPattern(style, bars, rng);
    const kick = engine.createBufferFromRecipe({ type: 'kick', duration: 0.42 });
    const snare = engine.createBufferFromRecipe({ type: 'snare', duration: 0.28 });
    const hat = engine.createBufferFromRecipe({ type: 'hat', duration: 0.1 });
    const perc = engine.createBufferFromRecipe({ type: 'noise', duration: 0.14 });
    let n = 0;
    const place = (hits, name, buf, color, dur = 0.25) => {
      hits.forEach((beat) => {
        engine.addClip(track.id, {
          name,
          startBeat: startBeat + beat,
          durationBeats: dur,
          color,
          buffer: buf,
        });
        n++;
      });
    };
    place(pat.kick, 'Kick', kick, COLORS.kick, 0.4);
    place(pat.snare, 'Snare', snare, COLORS.snare, 0.3);
    place(pat.hat, 'Hat', hat, COLORS.hat, 0.2);
    place(pat.perc, 'Perc', perc, COLORS.fx, 0.2);
    addToLibrary(`Gen Drums ${bars}b`, kick, COLORS.drums, { type: 'kick', duration: 0.42 });
    return n;
  }

  function writeBass(track, rootHz, bars, pattern, scale, startBeat, rng) {
    const rel = bassNotes(rootHz, bars, pattern, scale, rng);
    if (!rel.length) return;
    engine.addClip(track.id, {
      name: 'Gen Bass',
      startBeat,
      durationBeats: bars * 4,
      color: COLORS.bass,
      notes: rel,
    });
  }

  function writePad(track, rootHz, scale, bars, startBeat) {
    const freqs = chordFreqs(rootHz, scale, 'triad');
    const durSec = Math.min(8, bars * 4 * engine.secondsPerBeat);
    const buf = engine.createBufferFromRecipe({ type: 'pad', duration: durSec, freqs });
    engine.addClip(track.id, {
      name: 'Gen Pad',
      startBeat,
      durationBeats: bars * 4,
      color: COLORS.pad,
      buffer: buf,
      recipe: { type: 'pad', duration: durSec, freqs },
    });
    addToLibrary('Gen Pad', buf, COLORS.pad, { type: 'pad', duration: durSec, freqs });
  }

  function writeLead(track, rootHz, scale, bars, sparse, startBeat, rng) {
    const steps = bars * 4;
    const contour = melodyContour(scale, steps, rng, sparse);
    const notes = contour.map((n) => ({
      beat: n.beat,
      dur: n.dur,
      freq: degToHz(rootHz, n.degree, n.octave),
      wave: 'sine',
    }));
    engine.addClip(track.id, {
      name: 'Gen Lead',
      startBeat,
      durationBeats: bars * 4,
      color: COLORS.lead,
      notes,
    });
  }

  function writeFx(track, bars, startBeat, rng) {
    const noise = engine.createBufferFromRecipe({ type: 'noise', duration: 0.8 });
    for (let b = 0; b < bars; b++) {
      if (rng() > 0.55) {
        engine.addClip(track.id, {
          name: 'FX riser',
          startBeat: startBeat + b * 4 + 3,
          durationBeats: 1,
          color: COLORS.fx,
          buffer: noise,
          recipe: { type: 'noise', duration: 0.8 },
        });
      }
    }
    addToLibrary('Gen FX', noise, COLORS.fx, { type: 'noise', duration: 0.8 });
  }

  function resolvePromptContext(prompt, genreKey, moodKey) {
    const genre = GENRES[genreKey] || GENRES.pop;
    const moodName = moodKey || matchMood(prompt, genre.mood);
    const mood = MOODS[moodName] || MOODS.chill;
    const { name, hz } = parseRoot(prompt);
    const scaleName = matchScale(prompt, genre.scale);
    const scale = SCALES[scaleName] || SCALES.minor;
    let rootHz = hz;
    if (mood.rootShift) rootHz = hz * Math.pow(2, mood.rootShift / 12);
    // prefer mid-low for pads/bass friendliness
    if (rootHz > 300) rootHz /= 2;
    const rng = mulberry32(seedFrom(`${prompt}|${genreKey}|${moodName}|${engine.bpm}`));
    return { genre, mood, moodName, rootName: name, rootHz, scaleName, scale, rng };
  }

  // —— Text-to-music ——
  root.querySelector('[data-ttm-go]').addEventListener('click', async () => {
    const prompt = root.querySelector('[data-ttm-prompt]').value.trim() || 'house groove';
    const genreKey = root.querySelector('[data-ttm-genre]').value;
    const moodKey = root.querySelector('[data-ttm-mood]').value;
    const bars = Number(root.querySelector('[data-ttm-bars]').value) || 8;
    const bpmMode = root.querySelector('[data-ttm-bpm-mode]').value;

    await engine.init();
    const ctx = resolvePromptContext(prompt, genreKey, moodKey);
    let heardNote = '';
    if (bpmMode === 'listen') {
      const heard = detectSessionBeat(engine);
      if (heard) {
        engine.setBpm(heard.bpm);
        heardNote = `Heard ${heard.bpm} BPM from ${heard.onsets} onsets (${heard.clips} clips, confidence ${heard.confidence}). `;
      } else {
        heardNote = 'No rhythmic audio on the timeline yet, so Generate kept the session tempo. ';
      }
    } else if (bpmMode === 'genre' && ctx.genre.defaultBpm) {
      engine.setBpm(ctx.genre.defaultBpm);
    }

    try {
      await withProgress(
        ['Init engine…', 'Drums…', 'Bass…', 'Pad…', 'Lead…', 'Library…'],
        async (tick) => {
          tick(0, 'Preparing tracks…');
          const drums = ensureNamedTrack((t) => /drum|perc|beat/i.test(t.name), 'Drums', 'audio');
          const bass = ensureNamedTrack((t) => /bass/i.test(t.name), 'Bass', 'audio');
          const pad = ensureNamedTrack((t) => /pad|atmos/i.test(t.name), 'Pad', 'audio');
          const lead = ensureNamedTrack((t) => /lead|melod|key|synth/i.test(t.name) || t.type === 'midi', 'Lead', 'midi');

          // clear existing on these tracks for a clean arrange
          [drums, bass, pad, lead].forEach((t) => { t.clips = []; });

          tick(1, 'Writing drums…');
          await sleep(30);
          writeDrums(drums, bars, ctx.genre.drum, 0, ctx.rng);

          tick(2, 'Writing bass…');
          await sleep(30);
          writeBass(bass, ctx.rootHz, bars, ctx.genre.bass, ctx.scale, 0, ctx.rng);

          tick(3, 'Rendering pad…');
          await sleep(30);
          writePad(pad, ctx.rootHz, ctx.scale, bars, 0);

          tick(4, 'Writing lead…');
          await sleep(30);
          writeLead(lead, ctx.rootHz, ctx.scale, bars, ctx.mood.leadSparse, 0, ctx.rng);

          tick(5, 'Updating library…');
          engine._emit('tracks', engine.tracks);
        }
      );

      status.textContent = `${heardNote}Arrangement · ${bars} bars · ${ctx.rootName} ${ctx.scaleName} · ${genreKey}/${moodKey} · ${engine.bpm} BPM`;
      toast(`Generated ${bars}-bar arrangement — press Space`);
    } catch (err) {
      console.error(err);
      status.textContent = `Generate failed: ${err.message || err}`;
      toast('Generate failed', 'error');
      setProgress(0);
    }
  });

  // —— Stem generation ——
  root.querySelector('[data-stem-go]').addEventListener('click', async () => {
    const prompt = root.querySelector('[data-stem-prompt]').value.trim();
    const kind = root.querySelector('[data-stem-type]').value;
    const bars = Number(root.querySelector('[data-stem-bars]').value) || 4;
    let trackId = stemTrackSel.value;

    await engine.init();
    const genreKey = matchGenre(prompt || kind);
    const ctx = resolvePromptContext(prompt || kind, genreKey, matchMood(prompt, GENRES[genreKey].mood));
    const startBeat = Math.floor(engine.currentBeat / 4) * 4;

    try {
      await withProgress(['Stem…', 'Place…'], async (tick) => {
        tick(0, `Building ${kind}…`);
        let track;
        if (trackId === '__new__') {
          const meta = STEM_KINDS.find((s) => s.id === kind);
          track = engine.addTrack(kind === 'melody' ? 'midi' : 'audio', meta?.label || 'Stem');
          trackId = track.id;
        } else {
          track = engine.tracks.find((t) => t.id === trackId) || engine.tracks[0];
        }
        if (!track) throw new Error('No track');

        if (kind === 'drums') {
          writeDrums(track, bars, ctx.genre.drum, startBeat, ctx.rng);
        } else if (kind === 'bass') {
          writeBass(track, ctx.rootHz, bars, ctx.genre.bass, ctx.scale, startBeat, ctx.rng);
        } else if (kind === 'melody') {
          writeLead(track, ctx.rootHz, ctx.scale, bars, ctx.mood.leadSparse, startBeat, ctx.rng);
        } else if (kind === 'pad') {
          writePad(track, ctx.rootHz, ctx.scale, bars, startBeat);
        } else {
          writeFx(track, bars, startBeat, ctx.rng);
        }
        tick(1, 'Placing on timeline…');
        engine._emit('tracks', engine.tracks);
      });

      status.textContent = `Stem “${kind}” · ${bars} bars @ beat ${startBeat} · ${engine.bpm} BPM`;
      toast(`${kind} stem written to timeline`);
    } catch (err) {
      console.error(err);
      status.textContent = `Stem failed: ${err.message || err}`;
      toast('Stem generate failed', 'error');
      setProgress(0);
    }
  });

  // —— Song continuation ——
  root.querySelector('[data-cont-go]').addEventListener('click', async () => {
    const bars = Number(root.querySelector('[data-cont-bars]').value) || 4;
    const place = root.querySelector('[data-cont-place]').value;
    const hint = root.querySelector('[data-cont-hint]').value.trim();

    await engine.init();
    const startBeat = place === 'playhead'
      ? Math.max(0, Math.floor(engine.currentBeat))
      : Math.max(lastClipEndBeat(engine), Math.floor(engine.currentBeat));

    const inferred = inferHarmonyFromProject(engine);
    const genreKey = matchGenre(hint || 'pop');
    const prompt = hint || `${inferred.name} continuation`;
    const ctx = resolvePromptContext(prompt, genreKey, matchMood(hint, GENRES[genreKey].mood));
    // Prefer inferred root if hint has no explicit note
    if (!/\b([A-G](?:#|b)?)\b/i.test(hint || '')) {
      ctx.rootHz = inferred.hz;
      ctx.rootName = inferred.name;
    }

    try {
      await withProgress(
        ['Analyze…', 'Rhythm…', 'Harmony…', 'Melody…'],
        async (tick) => {
          tick(0, 'Reading project feel…');
          const drums = ensureNamedTrack((t) => /drum|perc|beat/i.test(t.name), 'Drums', 'audio');
          const bass = ensureNamedTrack((t) => /bass/i.test(t.name), 'Bass', 'audio');
          const pad = ensureNamedTrack((t) => /pad|atmos/i.test(t.name), 'Pad', 'audio');
          const lead = ensureNamedTrack((t) => /lead|melod|key|synth/i.test(t.name) || t.type === 'midi', 'Lead', 'midi');

          tick(1, 'Continuing drums…');
          await sleep(30);
          writeDrums(drums, bars, ctx.genre.drum, startBeat, ctx.rng);

          tick(2, 'Continuing bass + pad…');
          await sleep(30);
          writeBass(bass, ctx.rootHz, bars, ctx.genre.bass, ctx.scale, startBeat, ctx.rng);
          writePad(pad, ctx.rootHz, ctx.scale, bars, startBeat);

          tick(3, 'Continuing lead…');
          await sleep(30);
          writeLead(lead, ctx.rootHz, ctx.scale, bars, ctx.mood.leadSparse, startBeat, ctx.rng);
          engine._emit('tracks', engine.tracks);
        }
      );

      status.textContent = `Continued +${bars} bars from beat ${startBeat} · ${ctx.rootName} ${ctx.scaleName} · ${engine.bpm} BPM`;
      toast(`Appended ${bars} bars — press Space`);
    } catch (err) {
      console.error(err);
      status.textContent = `Continue failed: ${err.message || err}`;
      toast('Continue failed', 'error');
      setProgress(0);
    }
  });
}
