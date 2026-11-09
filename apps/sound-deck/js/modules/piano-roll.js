/**
 * Piano view — piano roll (keys × 1/16 grid) for Sound Deck.
 * Edits the selected note clip (engine MIDI-like clip.notes or a previous piano clip) or a new clip.
 * Write as "Audio bounce" renders the procedural instrument into an AudioBuffer clip;
 * "MIDI notes" writes clip.notes, which the engine plays back as oscillators (with velocity).
 */
import { INSTRUMENTS, getInstrument, renderNote, mixEvents, midiToFreq, freqToMidi, noteName, isBlackKey } from './instruments.js?v=20261006p';
import { createLoopPlayer } from '../audio/loop-player.js?v=20261006p';

const CELL_W = 20; // px per 1/16 note
const ROW_H = 14;
const STEP = 0.25; // beats per cell
const PITCHED = INSTRUMENTS.filter((i) => i.kind === 'pitched');

export function renderPianoBuffer(ctx, meta, secondsPerBeat) {
  const bars = Math.max(1, meta.bars || 1);
  const events = (meta.notes || []).map((n) => ({
    inst: meta.inst, midi: n.midi, startSec: n.start * secondsPerBeat, durSec: Math.max(0.06, n.len * secondsPerBeat), gain: n.vel ?? 0.8,
  }));
  const maxEnd = events.reduce((m, e) => Math.max(m, e.startSec + e.durSec), 0);
  return mixEvents(ctx, events, Math.max(bars * 4 * secondsPerBeat, maxEnd) + 0.05);
}

export function mountPianoRoll(root, engine, toast, { getSelectedTrackId, getSelectedClip, onPlaced, onDice } = {}) {
  engine.metaRenderers.set('piano', (meta, eng) => renderPianoBuffer(eng.ctx, meta, eng.secondsPerBeat));

  const st = {
    inst: 'keys',
    notes: [
      { midi: 60, start: 0, len: 1, vel: 0.8 }, { midi: 64, start: 1, len: 1, vel: 0.7 },
      { midi: 67, start: 2, len: 1, vel: 0.75 }, { midi: 72, start: 3, len: 1, vel: 0.9 },
    ],
    bars: 1,
    low: 48,
    keys: 25,
    newLen: 0.5,
    vel: 0.8,
    source: null, // { trackId, clipId, name }
    dirty: false,
    playStep: -1,
  };
  let clipCount = 0;

  root.innerHTML = `
    <div class="pv-toolbar">
      <div class="pv-title"><strong>Piano roll</strong><span class="badge warn" title="Procedural instrument / engine oscillators">Demo synth</span></div>
      <button type="button" class="btn icon primary" data-pr-play title="Preview loop (Space while in Piano view)">▶</button>
      <label class="field"><span>Inst</span>
        <select data-pr-inst>${PITCHED.map((i) => `<option value="${i.id}">${i.name}</option>`).join('')}</select>
      </label>
      <label class="field"><span>Bars</span>
        <select data-pr-bars><option value="1">1</option><option value="2">2</option><option value="4">4</option><option value="8">8</option></select>
      </label>
      <label class="field"><span>Len</span>
        <select data-pr-len><option value="0.25">1/16</option><option value="0.5" selected>1/8</option><option value="1">1/4</option><option value="2">1/2</option><option value="4">1 bar</option></select>
      </label>
      <label class="field pr-vel" title="Velocity for new notes. Shift+click a note to apply it; mouse-wheel over a note nudges its velocity."><span>Vel</span>
        <input type="range" min="0.1" max="1" step="0.05" value="0.8" data-pr-vel /><output data-pr-velout>80</output>
      </label>
      <div class="btn-row pr-oct">
        <button type="button" class="btn sm ghost" data-pr-oct="-1" title="Octave down">Oct −</button>
        <button type="button" class="btn sm ghost" data-pr-oct="1" title="Octave up">Oct +</button>
      </div>
      <button type="button" class="btn sm ghost" data-pr-clear>Clear</button>
      <button type="button" class="btn sm df-mini" data-pr-dice="melody" title="Dice Forge — roll a sparse deep house melody">🎲 Melody</button>
      <button type="button" class="btn sm df-mini" data-pr-dice="chords" title="Dice Forge — roll lush minor / modal chords">🎲 Chords</button>
    </div>
    <div class="pr-source">
      <span data-pr-source></span>
      <button type="button" class="btn sm ghost" data-pr-load title="Load the clip selected in Song view">Load selected clip</button>
      <button type="button" class="btn sm ghost" data-pr-new title="Start a fresh MIDI clip">New clip</button>
    </div>
    <div class="pr-wrap" data-pr-wrap>
      <div class="pr-keys" data-pr-keys></div>
      <div class="pr-grid" data-pr-grid></div>
    </div>
    <div class="pv-footer">
      <label class="field"><span>Track</span><select data-pr-track></select></label>
      <label class="field"><span>At bar</span><input type="number" min="1" max="64" step="0.25" value="1" data-pr-bar /></label>
      <label class="field"><span>Write as</span>
        <select data-pr-mode>
          <option value="audio">Audio bounce (instrument)</option>
          <option value="midi">MIDI notes (engine osc)</option>
        </select>
      </label>
      <label class="toggle" data-pr-replace-wrap hidden><input type="checkbox" data-pr-replace checked /><span>Replace source</span></label>
      <button type="button" class="btn primary" data-pr-write>Write to track</button>
      <span class="pv-hint">Click grid = add · click note = delete · Shift+click = set velocity · double-click a clip in Song to edit</span>
    </div>
  `;

  const $ = (s) => root.querySelector(s);
  const grid = $('[data-pr-grid]');
  const keysEl = $('[data-pr-keys]');
  const trackSel = $('[data-pr-track]');
  const playBtn = $('[data-pr-play]');

  const high = () => st.low + st.keys - 1;
  const cols = () => st.bars * 16;

  function playNote(midi, vel = st.vel, when = 0, durBeats = st.newLen, dest) {
    if (!engine.ctx) return;
    const src = engine.ctx.createBufferSource();
    src.buffer = renderNote(engine.ctx, st.inst, { midi, durSec: Math.max(0.06, durBeats * engine.secondsPerBeat) });
    const g = engine.ctx.createGain();
    g.gain.value = vel;
    src.connect(g); g.connect(dest || engine.masterGain);
    src.start(when);
  }

  const player = createLoopPlayer(engine, {
    getTotalSteps: cols,
    onStep(step, when, out) {
      st.notes.forEach((n) => {
        const ns = Math.floor(n.start / STEP + 1e-6);
        if (ns !== step) return;
        playNote(n.midi, n.vel, when + (n.start - ns * STEP) * engine.secondsPerBeat, n.len, out);
      });
    },
    onPosition(step) {
      st.playStep = step;
      const ph = grid.querySelector('.pr-playhead');
      if (ph) { ph.style.transform = `translateX(${Math.max(0, step) * CELL_W}px)`; ph.hidden = step < 0; }
    },
  });

  function renderKeys() {
    let html = '';
    for (let m = high(); m >= st.low; m--) {
      html += `<button type="button" class="pr-key ${isBlackKey(m) ? 'black' : ''} ${m % 12 === 0 ? 'c' : ''}" data-key="${m}" style="height:${ROW_H}px">${m % 12 === 0 || !isBlackKey(m) && st.keys <= 25 ? noteName(m) : ''}</button>`;
    }
    keysEl.innerHTML = html;
  }

  function renderGrid() {
    const w = cols() * CELL_W;
    const h = st.keys * ROW_H;
    grid.style.width = `${w}px`;
    grid.style.height = `${h}px`;
    grid.style.setProperty('--cell', `${CELL_W}px`);
    let rowsHtml = '';
    for (let m = high(), r = 0; m >= st.low; m--, r++) {
      if (isBlackKey(m)) rowsHtml += `<div class="pr-rowbg black" style="top:${r * ROW_H}px;height:${ROW_H}px"></div>`;
      if (m % 12 === 0) rowsHtml += `<div class="pr-rowbg cline" style="top:${(r + 1) * ROW_H - 1}px"></div>`;
    }
    const notesHtml = st.notes.map((n, i) => {
      if (n.midi < st.low || n.midi > high()) return '';
      const top = (high() - n.midi) * ROW_H;
      return `<div class="pr-note" data-note="${i}" style="left:${(n.start / STEP) * CELL_W}px;width:${Math.max(4, (n.len / STEP) * CELL_W - 1)}px;top:${top + 1}px;height:${ROW_H - 2}px;opacity:${(0.35 + 0.65 * n.vel).toFixed(2)}" title="${noteName(n.midi)} · beat ${+(n.start + 1).toFixed(2)} · len ${n.len} · vel ${Math.round(n.vel * 100)}"></div>`;
    }).join('');
    const outside = st.notes.filter((n) => n.midi < st.low || n.midi > high()).length;
    grid.innerHTML = `${rowsHtml}${notesHtml}<div class="pr-playhead" ${st.playStep < 0 ? 'hidden' : ''} style="height:${h}px;transform:translateX(${Math.max(0, st.playStep) * CELL_W}px)"></div>`;
    grid.title = outside ? `${outside} note(s) outside the visible octaves — use Oct −/+` : '';
  }

  function renderSource() {
    const t = st.source && engine.tracks.find((x) => x.id === st.source.trackId);
    const label = st.source?.clipId
      ? `Editing <strong>${esc(st.source.name)}</strong> on ${esc(t?.name || 'track')}`
      : 'New MIDI clip — writes to the track below';
    $('[data-pr-source]').innerHTML = `${label}${st.dirty ? ' · <em>unsaved</em>' : ''} · ${st.notes.length} note${st.notes.length === 1 ? '' : 's'} · ${getInstrument(st.inst)?.name}`;
    $('[data-pr-replace-wrap]').hidden = !st.source?.clipId;
  }

  function render() {
    $('[data-pr-inst]').value = st.inst;
    $('[data-pr-bars]').value = String(st.bars);
    renderKeys();
    renderGrid();
    renderSource();
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function refreshTracks() {
    const cur = trackSel.value || getSelectedTrackId?.();
    trackSel.innerHTML = engine.tracks.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
    if (cur && engine.tracks.some((t) => t.id === cur)) trackSel.value = cur;
  }

  function fitRange() {
    if (!st.notes.length) return;
    const lo = Math.min(...st.notes.map((n) => n.midi));
    const hi = Math.max(...st.notes.map((n) => n.midi));
    st.low = Math.max(12, Math.floor(lo / 12) * 12);
    st.keys = Math.max(25, Math.min(61, Math.ceil((hi - st.low + 1) / 12) * 12 + 1));
  }

  function mark() { st.dirty = true; renderSource(); }

  grid.addEventListener('click', async (e) => {
    await engine.init(); await engine.resume();
    const noteEl = e.target.closest('.pr-note');
    if (noteEl) {
      const i = Number(noteEl.dataset.note);
      if (e.shiftKey) {
        st.notes[i].vel = st.vel;
        toast(`Velocity ${Math.round(st.vel * 100)}`);
      } else {
        st.notes.splice(i, 1);
      }
      renderGrid(); mark();
      return;
    }
    const rect = grid.getBoundingClientRect();
    const col = Math.floor((e.clientX - rect.left) / CELL_W);
    const row = Math.floor((e.clientY - rect.top) / ROW_H);
    if (col < 0 || col >= cols() || row < 0 || row >= st.keys) return;
    const midi = high() - row;
    const start = col * STEP;
    const len = Math.min(st.newLen, st.bars * 4 - start);
    st.notes.push({ midi, start, len, vel: st.vel });
    playNote(midi, st.vel, 0, Math.min(len, 1));
    renderGrid(); mark();
  });

  grid.addEventListener('wheel', (e) => {
    const noteEl = e.target.closest('.pr-note');
    if (!noteEl) return;
    e.preventDefault();
    const n = st.notes[Number(noteEl.dataset.note)];
    n.vel = Math.max(0.05, Math.min(1, Math.round((n.vel + (e.deltaY < 0 ? 0.05 : -0.05)) * 100) / 100));
    renderGrid(); mark();
  }, { passive: false });

  keysEl.addEventListener('click', async (e) => {
    const k = e.target.closest('[data-key]');
    if (!k) return;
    await engine.init(); await engine.resume();
    playNote(Number(k.dataset.key), st.vel, 0, 1);
  });

  $('[data-pr-inst]').addEventListener('change', (e) => { st.inst = e.target.value; renderSource(); });
  $('[data-pr-bars]').addEventListener('change', (e) => {
    st.bars = Number(e.target.value) || 1;
    st.notes = st.notes.filter((n) => n.start < st.bars * 4);
    renderGrid(); mark();
  });
  $('[data-pr-len]').addEventListener('change', (e) => { st.newLen = Number(e.target.value) || 0.5; });
  $('[data-pr-vel]').addEventListener('input', (e) => {
    st.vel = Number(e.target.value);
    $('[data-pr-velout]').textContent = String(Math.round(st.vel * 100));
  });
  root.querySelectorAll('[data-pr-oct]').forEach((b) => b.addEventListener('click', () => {
    st.low = Math.max(12, Math.min(96, st.low + 12 * Number(b.dataset.prOct)));
    renderKeys(); renderGrid();
  }));
  $('[data-pr-clear]').addEventListener('click', () => { st.notes = []; renderGrid(); mark(); });
  $('[data-pr-new]').addEventListener('click', () => newClip());
  $('[data-pr-load]').addEventListener('click', () => {
    const sel = getSelectedClip?.();
    if (!sel) { toast('Select a clip in Song view first (click it), then Load', 'warn'); return; }
    loadClip(sel.trackId, sel.clipId);
  });
  playBtn.addEventListener('click', toggle);
  root.querySelectorAll('[data-pr-dice]').forEach((b) => b.addEventListener('click', () => {
    if (onDice) onDice(b.dataset.prDice);
    else toast('Dice Forge lives in the Godmode tab', 'warn');
  }));

  async function toggle() {
    if (player.playing) player.stop();
    else await player.start();
    playBtn.textContent = player.playing ? '⏹' : '▶';
    playBtn.classList.toggle('is-on', player.playing);
    return true;
  }

  function newClip(trackId, startBeat = 0) {
    st.source = null;
    st.notes = [];
    st.dirty = false;
    refreshTracks();
    if (trackId) trackSel.value = trackId;
    $('[data-pr-bar]').value = String(startBeat / 4 + 1);
    render();
  }

  function guessInst(notes) {
    const avg = notes.reduce((s, n) => s + n.midi, 0) / Math.max(1, notes.length);
    const wave = notes[0]?.wave;
    if (avg < 48) return 'bass808';
    if (wave === 'square') return 'lead';
    if (wave === 'sawtooth') return avg < 55 ? 'bass808' : 'pad';
    return 'keys';
  }

  /** Load a timeline clip. Returns 'piano' | 'pattern' | 'audio' | null */
  function loadClip(trackId, clipId) {
    const track = engine.tracks.find((t) => t.id === trackId);
    const clip = track?.clips.find((c) => c.id === clipId);
    if (!clip) return null;
    refreshTracks();
    trackSel.value = trackId;
    $('[data-pr-bar]').value = String(+(clip.startBeat / 4 + 1).toFixed(2));
    if (clip.meta?.kind === 'pattern') return 'pattern';
    if (clip.meta?.kind === 'piano') {
      st.inst = clip.meta.inst || st.inst;
      st.notes = (clip.meta.notes || []).map((n) => ({ ...n }));
      st.bars = clip.meta.bars || Math.max(1, Math.ceil(clip.durationBeats / 4));
    } else if (clip.notes?.length) {
      const raw = clip.notes.map((n) => ({ midi: freqToMidi(n.freq), start: n.beat, len: n.dur || 0.25, vel: n.vel ?? 0.8, wave: n.wave }))
        .filter((n) => n.midi >= 12 && n.midi <= 108);
      st.inst = guessInst(raw);
      st.notes = raw.map(({ wave, ...n }) => n);
      const need = Math.ceil(Math.max(clip.durationBeats, ...st.notes.map((n) => n.start + n.len)) / 4);
      st.bars = [1, 2, 4, 8].find((b) => b >= need) || 8;
    } else {
      // Audio clip: no note data to edit — honest fallback: start a new MIDI clip at its position.
      newClip(trackId, clip.startBeat);
      toast(`“${clip.name}” is audio (no notes) — started a new MIDI clip at its position`, 'warn');
      return 'audio';
    }
    st.source = { trackId, clipId, name: clip.name };
    st.dirty = false;
    fitRange();
    render();
    toast(`Piano roll: editing “${clip.name}”`);
    return 'piano';
  }

  $('[data-pr-write]').addEventListener('click', async () => {
    await engine.init();
    const trackId = trackSel.value || getSelectedTrackId?.() || engine.tracks[0]?.id;
    if (!trackId) { toast('No track', 'warn'); return; }
    if (!st.notes.length) { toast('No notes — click the grid to add some', 'warn'); return; }
    const mode = $('[data-pr-mode]').value;
    const startBeat = Math.max(0, (Number($('[data-pr-bar]').value) || 1) - 1) * 4;
    const inst = getInstrument(st.inst);
    const notes = st.notes.map((n) => ({ ...n })).sort((a, b) => a.start - b.start);
    const meta = { kind: 'piano', inst: st.inst, bars: st.bars, notes };
    const src = st.source ? { ...st.source } : null;
    const replace = !!(src?.clipId && $('[data-pr-replace]').checked);
    if (replace) engine.removeClip(src.trackId, src.clipId);
    clipCount += 1;
    const name = replace ? src.name : `${inst.short} roll ${clipCount}`;
    const base = { name, startBeat, durationBeats: st.bars * 4, color: inst.color, meta };
    const clip = mode === 'midi'
      ? engine.addClip(trackId, { ...base, notes: notes.map((n) => ({ beat: n.start, dur: n.len, freq: midiToFreq(n.midi), wave: inst.wave || 'sine', vel: n.vel })) })
      : engine.addClip(trackId, { ...base, buffer: renderPianoBuffer(engine.ctx, meta, engine.secondsPerBeat) });
    st.source = clip ? { trackId, clipId: clip.id, name } : null;
    st.dirty = false;
    renderSource();
    const t = engine.tracks.find((x) => x.id === trackId);
    toast(`${replace ? 'Updated' : 'Wrote'} “${name}” → ${t?.name || 'track'} (${mode === 'midi' ? 'MIDI notes' : 'audio bounce'})`);
    onPlaced?.(trackId, clip?.id);
  });

  engine.on('tracks', () => {
    refreshTracks();
    if (st.source?.clipId) {
      const t = engine.tracks.find((x) => x.id === st.source.trackId);
      if (!t?.clips.some((c) => c.id === st.source.clipId)) { st.source = null; renderSource(); }
    }
  });
  refreshTracks();
  render();

  return {
    toggle,
    stop() { if (player.playing) { player.stop(); playBtn.textContent = '▶'; playBtn.classList.remove('is-on'); } },
    loadClip,
    newClip,
    /** Load generated notes (Dice Forge) as a fresh, unsaved clip */
    loadNotes({ inst, notes, bars } = {}) {
      if (!Array.isArray(notes)) return false;
      if (inst && getInstrument(inst)?.kind === 'pitched') st.inst = inst;
      st.bars = [1, 2, 4, 8].find((b) => b >= (bars || 1)) || 8;
      st.notes = notes.filter((n) => n.start < st.bars * 4).map((n) => ({ midi: n.midi, start: n.start, len: n.len, vel: n.vel ?? 0.8 }));
      st.source = null;
      st.dirty = true;
      refreshTracks();
      fitRange();
      render();
      return true;
    },
    get dirty() { return st.dirty; },
    get sourceClipId() { return st.source?.clipId || null; },
    setInstrument(id) {
      const inst = getInstrument(id);
      if (!inst || inst.kind !== 'pitched') return false;
      st.inst = id;
      if (inst.note && (inst.note < st.low || inst.note > high())) { st.low = Math.floor(inst.note / 12) * 12 - 12; st.keys = 25; }
      render();
      return true;
    },
  };
}
