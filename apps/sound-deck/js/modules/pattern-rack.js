/**
 * Pattern view — FL-style channel rack (instrument rows × 16 steps) for Sound Deck.
 * Play loops the pattern at the engine BPM; "Place as clip" bounces N bars into one audio clip
 * (editable source kept in clip.meta), "Place as hits" writes one-shot clips per step.
 * Instruments are procedural Web Audio (DEMO) — see instruments.js.
 */
import { INSTRUMENTS, KITS, getInstrument, getKit, renderNote, mixEvents, noteName } from './instruments.js?v=20261006p';
import { createLoopPlayer } from '../audio/loop-player.js?v=20261006p';

const STEPS = 16;
const ACCENT = 1;
const NORMAL = 0.72;
let patternCount = 0;

export function rowFrom(instId, steps = [], extra = {}) {
  const inst = getInstrument(instId) || INSTRUMENTS[0];
  const arr = Array(STEPS).fill(0);
  steps.forEach((s) => { if (s >= 0 && s < STEPS) arr[s] = 1; });
  return { inst: inst.id, midi: extra.note ?? inst.note ?? 60, vol: extra.vol ?? 0.8, muted: false, steps: arr, nudge: extra.nudge || 0 };
}

/** meta → events → AudioBuffer (used for bounce + JSON reload) */
export function renderPatternBuffer(ctx, meta, secondsPerBeat) {
  const stepSec = secondsPerBeat / 4;
  const bars = Math.max(1, meta.bars || 1);
  const events = [];
  let tail = 0;
  (meta.rows || []).forEach((r) => {
    if (r.muted) return;
    const inst = getInstrument(r.inst);
    if (!inst) return;
    const durSec = inst.kind === 'drum' ? inst.dur : Math.min(inst.dur, stepSec * 4);
    tail = Math.max(tail, durSec);
    for (let b = 0; b < bars; b++) {
      r.steps.forEach((v, i) => {
        if (!v) return;
        // r.nudge = micro-timing as a fraction of one 1/16 step (+ late / − early), Dice Forge pocket
        events.push({ inst: inst.id, midi: r.midi, startSec: Math.max(0, (b * STEPS + i + (r.nudge || 0)) * stepSec), durSec, gain: r.vol * (v === 2 ? ACCENT : NORMAL) });
      });
    }
  });
  return mixEvents(ctx, events, bars * STEPS * stepSec + Math.min(1, tail));
}

export function mountPatternRack(root, engine, toast, { getSelectedTrackId, onPlaced, onDice } = {}) {
  engine.metaRenderers.set('pattern', (meta, eng) => renderPatternBuffer(eng.ctx, meta, eng.secondsPerBeat));

  let rows = getKit('mm-house').rows.map((r) => rowFrom(r.inst, r.steps, r));
  let pos = -1;

  const instOptions = INSTRUMENTS.map((i) => `<option value="${i.id}">${i.name}${i.kind === 'pitched' ? ' (pitched)' : ''}</option>`).join('');
  root.innerHTML = `
    <div class="pv-toolbar">
      <div class="pv-title"><strong>Pattern</strong><span class="badge warn" title="Procedural Web Audio instruments">Demo synth</span></div>
      <button type="button" class="btn icon primary" data-pp-play title="Play / stop pattern loop (Space while in Pattern view)">▶</button>
      <span class="pv-bpm" data-pp-bpm>${engine.bpm} BPM · engine</span>
      <label class="field"><span>Kit</span>
        <select data-pp-kit><option value="">Arm kit…</option>${KITS.map((k) => `<option value="${k.id}">${k.name}</option>`).join('')}</select>
      </label>
      <label class="field"><span>+ Row</span>
        <select data-pp-add><option value="">Instrument…</option>${instOptions}</select>
      </label>
      <button type="button" class="btn sm ghost" data-pp-clear title="Clear all steps">Clear</button>
      <button type="button" class="btn sm df-mini" data-pp-dice title="Dice Forge — roll a deep house / Tradingfloor groove into the rack">🎲 Dice</button>
    </div>
    <div class="pp-rack" data-pp-rack></div>
    <div class="pv-footer">
      <label class="field"><span>Track</span><select data-pp-track></select></label>
      <label class="field"><span>At bar</span><input type="number" min="1" max="64" value="1" data-pp-bar /></label>
      <label class="field"><span>Repeat</span>
        <select data-pp-bars><option value="1">1 bar</option><option value="2">2 bars</option><option value="4" selected>4 bars</option><option value="8">8 bars</option></select>
      </label>
      <button type="button" class="btn primary" data-pp-place title="Bounce the pattern into one audio clip on the track (stays editable)">Place as clip</button>
      <button type="button" class="btn ghost" data-pp-hits title="Write each step as its own one-shot clip">Place as hits</button>
      <span class="pv-hint">Click step · Shift+click accent · Space plays pattern · Song view to arrange</span>
    </div>
  `;
  const rack = root.querySelector('[data-pp-rack]');
  const playBtn = root.querySelector('[data-pp-play]');
  const trackSel = root.querySelector('[data-pp-track]');
  const bpmEl = root.querySelector('[data-pp-bpm]');

  const player = createLoopPlayer(engine, {
    getTotalSteps: () => STEPS,
    onStep(step, when, out) {
      rows.forEach((r) => {
        const v = r.steps[step];
        if (!v || r.muted) return;
        const inst = getInstrument(r.inst);
        const src = engine.ctx.createBufferSource();
        src.buffer = renderNote(engine.ctx, r.inst, { midi: r.midi, durSec: inst.kind === 'drum' ? inst.dur : Math.min(inst.dur, engine.secondsPerBeat) });
        const g = engine.ctx.createGain();
        g.gain.value = r.vol * (v === 2 ? ACCENT : NORMAL);
        src.connect(g); g.connect(out);
        src.start(Math.max(engine.ctx.currentTime, when + (r.nudge || 0) * engine.secondsPerBeat / 4));
      });
    },
    onPosition(step) {
      pos = step;
      rack.querySelectorAll('.pp-step.now').forEach((el) => el.classList.remove('now'));
      if (step >= 0) rack.querySelectorAll(`.pp-step[data-step="${step}"]`).forEach((el) => el.classList.add('now'));
    },
  });

  function noteOptions(sel) {
    let html = '';
    for (let m = 24; m <= 84; m++) html += `<option value="${m}" ${m === sel ? 'selected' : ''}>${noteName(m)}</option>`;
    return html;
  }

  function render() {
    if (!rows.length) {
      rack.innerHTML = '<div class="empty">No rows — add an instrument or arm a kit (Instruments tab → Arm Pattern).</div>';
      return;
    }
    rack.innerHTML = `
      <div class="pp-row pp-ruler" aria-hidden="true">
        <span></span><span class="pp-name">Channel</span><span></span><span></span>
        <div class="pp-steps">${Array.from({ length: STEPS }, (_, i) => `<span class="pp-num ${i % 4 === 0 ? 'bar' : ''}">${i % 4 === 0 ? i / 4 + 1 : '·'}</span>`).join('')}</div><span></span>
      </div>` + rows.map((r, idx) => {
      const inst = getInstrument(r.inst);
      return `
        <div class="pp-row ${r.muted ? 'muted' : ''}" data-row="${idx}">
          <button type="button" class="chip mute ${r.muted ? 'on' : ''}" data-pp-mute="${idx}" title="Mute row">M</button>
          <button type="button" class="pp-name ${r.nudge ? (r.nudge > 0 ? 'nudge-late' : 'nudge-early') : ''}" data-pp-prev="${idx}" style="--c:${inst.color}" title="Preview ${inst.name}${r.nudge ? ` · pocket ${r.nudge > 0 ? '+' : ''}${Math.round(r.nudge * 100)}% of a step (${r.nudge > 0 ? 'late' : 'early'})` : ''}">${inst.short}</button>
          ${inst.kind === 'pitched'
            ? `<select class="pp-pitch" data-pp-pitch="${idx}" title="Row pitch">${noteOptions(r.midi)}</select>`
            : '<span class="pp-pitch pp-pitch--na" title="One-shot">—</span>'}
          <input type="range" min="0" max="1" step="0.01" value="${r.vol}" data-pp-vol="${idx}" title="Row volume" />
          <div class="pp-steps">
            ${r.steps.map((v, i) => `<button type="button" class="pp-step ${v ? 'on' : ''} ${v === 2 ? 'acc' : ''} ${Math.floor(i / 4) % 2 ? 'alt' : ''} ${i === pos ? 'now' : ''}"
              data-pp-step="${idx}" data-step="${i}" aria-pressed="${!!v}" aria-label="${inst.short} step ${i + 1}"></button>`).join('')}
          </div>
          <button type="button" class="chip danger" data-pp-del="${idx}" title="Remove row">×</button>
        </div>`;
    }).join('');
  }

  function refreshTracks() {
    const cur = trackSel.value || getSelectedTrackId?.();
    trackSel.innerHTML = engine.tracks.map((t) => `<option value="${t.id}">${t.name}</option>`).join('');
    if (cur && engine.tracks.some((t) => t.id === cur)) trackSel.value = cur;
  }

  function syncPlay() {
    playBtn.textContent = player.playing ? '⏹' : '▶';
    playBtn.classList.toggle('is-on', player.playing);
  }

  async function toggle() {
    if (player.playing) player.stop();
    else await player.start();
    syncPlay();
    return true;
  }

  rack.addEventListener('click', async (e) => {
    const st = e.target.closest('[data-pp-step]');
    if (st) {
      const r = rows[Number(st.dataset.ppStep)];
      const i = Number(st.dataset.step);
      if (e.shiftKey) r.steps[i] = r.steps[i] === 2 ? 1 : 2;
      else r.steps[i] = r.steps[i] ? 0 : 1;
      render();
      return;
    }
    const m = e.target.closest('[data-pp-mute]');
    if (m) { const r = rows[Number(m.dataset.ppMute)]; r.muted = !r.muted; render(); return; }
    const d = e.target.closest('[data-pp-del]');
    if (d) { rows.splice(Number(d.dataset.ppDel), 1); render(); return; }
    const p = e.target.closest('[data-pp-prev]');
    if (p) {
      await engine.init(); await engine.resume();
      const r = rows[Number(p.dataset.ppPrev)];
      const src = engine.ctx.createBufferSource();
      src.buffer = renderNote(engine.ctx, r.inst, { midi: r.midi, durSec: 0.6 });
      const g = engine.ctx.createGain(); g.gain.value = r.vol;
      src.connect(g); g.connect(engine.masterGain); src.start();
    }
  });
  rack.addEventListener('input', (e) => {
    const v = e.target.closest('[data-pp-vol]');
    if (v) rows[Number(v.dataset.ppVol)].vol = Number(v.value);
  });
  rack.addEventListener('change', (e) => {
    const p = e.target.closest('[data-pp-pitch]');
    if (p) rows[Number(p.dataset.ppPitch)].midi = Number(p.value);
  });

  playBtn.addEventListener('click', toggle);
  root.querySelector('[data-pp-kit]').addEventListener('change', (e) => {
    if (!e.target.value) return;
    armKit(e.target.value);
    e.target.value = '';
  });
  root.querySelector('[data-pp-add]').addEventListener('change', (e) => {
    if (!e.target.value) return;
    armInstrument(e.target.value);
    e.target.value = '';
  });
  root.querySelector('[data-pp-dice]').addEventListener('click', () => {
    if (onDice) onDice();
    else toast('Dice Forge lives in the Godmode tab', 'warn');
  });
  root.querySelector('[data-pp-clear]').addEventListener('click', () => {
    rows.forEach((r) => r.steps.fill(0));
    render();
    toast('Pattern steps cleared');
  });

  function snapshotMeta(bars) {
    return {
      kind: 'pattern',
      bars,
      rows: rows.map((r) => ({ inst: r.inst, midi: r.midi, vol: r.vol, muted: r.muted, steps: [...r.steps], nudge: r.nudge || 0 })),
    };
  }

  root.querySelector('[data-pp-place]').addEventListener('click', async () => {
    await engine.init();
    const trackId = trackSel.value || getSelectedTrackId?.() || engine.tracks[0]?.id;
    if (!trackId) { toast('No track', 'warn'); return; }
    const hits = rows.reduce((n, r) => n + (r.muted ? 0 : r.steps.filter(Boolean).length), 0);
    if (!hits) { toast('Pattern is empty — click some steps first', 'warn'); return; }
    const bars = Number(root.querySelector('[data-pp-bars]').value) || 1;
    const startBar = Math.max(1, Number(root.querySelector('[data-pp-bar]').value) || 1);
    const meta = snapshotMeta(bars);
    const buffer = renderPatternBuffer(engine.ctx, meta, engine.secondsPerBeat);
    patternCount += 1;
    const clip = engine.addClip(trackId, {
      name: `Pattern ${patternCount}`,
      startBeat: (startBar - 1) * 4,
      durationBeats: bars * 4,
      color: '#F5C518',
      buffer,
      meta,
    });
    const t = engine.tracks.find((x) => x.id === trackId);
    toast(`Pattern ${patternCount} → ${t?.name || 'track'} @ bar ${startBar} (${bars} bar${bars > 1 ? 's' : ''}, ${engine.bpm} BPM)`);
    onPlaced?.(trackId, clip?.id);
  });

  root.querySelector('[data-pp-hits]').addEventListener('click', async () => {
    await engine.init();
    const trackId = trackSel.value || getSelectedTrackId?.() || engine.tracks[0]?.id;
    if (!trackId) { toast('No track', 'warn'); return; }
    const bars = Number(root.querySelector('[data-pp-bars]').value) || 1;
    const startBeat = (Math.max(1, Number(root.querySelector('[data-pp-bar]').value) || 1) - 1) * 4;
    let count = 0;
    rows.forEach((r) => {
      if (r.muted) return;
      const inst = getInstrument(r.inst);
      const buffer = renderNote(engine.ctx, r.inst, { midi: r.midi, durSec: inst.kind === 'drum' ? inst.dur : Math.min(inst.dur, engine.secondsPerBeat) });
      for (let b = 0; b < bars; b++) {
        r.steps.forEach((v, i) => {
          if (!v) return;
          engine.addClip(trackId, {
            name: inst.short,
            startBeat: startBeat + b * 4 + i * 0.25,
            durationBeats: 0.25,
            color: inst.color,
            buffer,
          });
          count++;
        });
      }
    });
    toast(count ? `Wrote ${count} hits` : 'Pattern is empty', count ? 'info' : 'warn');
  });

  function armInstrument(instId) {
    const inst = getInstrument(instId);
    if (!inst) return;
    rows.push(rowFrom(inst.id, inst.kind === 'drum' ? [] : [0, 8]));
    render();
    toast(`${inst.name} armed as Pattern row ${rows.length}`);
  }

  function armKit(kitId) {
    const kit = getKit(kitId);
    if (!kit) return;
    rows = kit.rows.map((r) => rowFrom(r.inst, r.steps, r));
    render();
    toast(`${kit.name} armed in Pattern (${kit.rows.length} rows)`);
  }

  engine.on('tracks', refreshTracks);
  engine.on('bpm', (bpm) => { bpmEl.textContent = `${bpm} BPM · engine`; });
  refreshTracks();
  render();

  return {
    toggle,
    stop() { if (player.playing) { player.stop(); syncPlay(); } },
    armInstrument,
    armKit,
    /** Load a pattern clip's editable meta back into the rack */
    loadMeta(meta, { trackId, startBeat } = {}) {
      if (!meta?.rows) return false;
      rows = meta.rows.map((r) => ({ ...r, steps: [...r.steps] }));
      if (meta.bars) root.querySelector('[data-pp-bars]').value = String(meta.bars);
      if (trackId) { refreshTracks(); trackSel.value = trackId; }
      if (startBeat != null) root.querySelector('[data-pp-bar]').value = String(Math.round(startBeat / 4) + 1);
      render();
      return true;
    },
    refreshTracks,
    /** Current rack state as clip meta (used by Song-view Pattern picker) */
    snapshot(bars = 1) { return snapshotMeta(bars); },
    hitCount() { return rows.reduce((n, r) => n + (r.muted ? 0 : r.steps.filter(Boolean).length), 0); },
    setTrack(id) { if (id) { refreshTracks(); trackSel.value = id; } },
    setStartBar(bar) { root.querySelector('[data-pp-bar]').value = String(Math.max(1, Math.round(bar))); },
  };
}
