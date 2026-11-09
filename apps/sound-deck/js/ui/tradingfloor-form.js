/**
 * Tradingfloor Form — arrangement template inspired by the MENS MERCATUS TRADINGFLOOR
 * playlist (SA deep / afro-tech house):
 *   8 bars groove → 16 pads/bass → ride-in → hook ≈1:30 → dub breakdown →
 *   rebuild hats/perc → late vocal / filter climax → long tail.
 *
 * Apply writes onto the Song timeline:
 *   · a “TF · Form” marker lane with one labeled clip per section (silent, meta.kind 'section')
 *   · TF lanes (Drums, Hats/Perc, Bass, Chords, Hook, Vox/FX) filled per the editable mute map with
 *     real, editable pattern / piano clips built from the current Dice Forge material
 *   · DEMO bits are labeled: baked filter sweep (no live automation lane), noise riser,
 *     and a silent vocal placeholder for you to record (Mic tab) or drop a stem on.
 */
import { renderPatternBuffer } from '../modules/pattern-rack.js?v=20261006w';
import { renderPianoBuffer } from '../modules/piano-roll.js?v=20261006w';
import { ensureDice, getDiceState, onDiceChange, getKey } from '../modules/dice-forge.js?v=20261006w';

export const TF_LANES = [
  { id: 'drums', name: 'TF · Drums', short: 'Drums', abbr: 'Drm', color: '#F5C518' },
  { id: 'hats', name: 'TF · Hats/Perc', short: 'Hats/Perc', abbr: 'Hat', color: '#C9A227' },
  { id: 'bass', name: 'TF · Bass', short: 'Bass', abbr: 'Bass', color: '#C79A1E' },
  { id: 'chords', name: 'TF · Chords', short: 'Chords', abbr: 'Chd', color: '#B8860B' },
  { id: 'hook', name: 'TF · Hook', short: 'Hook', abbr: 'Hook', color: '#FFD447' },
  { id: 'vox', name: 'TF · Vox/FX', short: 'Vox/FX', abbr: 'Vox', color: '#c8102e' },
];
const FORM_TRACK = 'TF · Form';
const DRUM_INST = ['kick', 'kick808', 'clap', 'snare'];

const BASE_SECTIONS = [
  { id: 'groove', label: 'Groove', bars: 8, color: '#5c4a12', lanes: ['drums', 'hats'], note: 'kick + hats/perc only — DJ-friendly intro' },
  { id: 'padsbass', label: 'Pads & Bass', bars: 16, color: '#7a5d10', lanes: ['drums', 'hats', 'bass', 'chords'], note: 'sub enters, lush chords bed' },
  { id: 'ride', label: 'Ride-in', bars: 20, color: '#8a6a12', lanes: ['drums', 'hats', 'bass', 'chords'], note: 'locked pocket — length auto-fits so the hook lands ≈1:30' },
  { id: 'hook', label: 'Hook', bars: 16, color: '#F5C518', lanes: ['drums', 'hats', 'bass', 'chords', 'hook'], note: 'melody hook over full groove' },
  { id: 'dub', label: 'Dub Breakdown', bars: 16, color: '#7d0a1e', lanes: ['chords', 'hook'], note: 'drums out · held pads · dub-echo hook' },
  { id: 'rebuild', label: 'Rebuild', bars: 8, color: '#a3122f', lanes: ['hats', 'vox'], note: 'rolling hats/perc + noise riser' },
  { id: 'climax', label: 'Vocal / Filter Climax', bars: 16, color: '#c8102e', lanes: ['drums', 'hats', 'bass', 'chords', 'hook', 'vox'], note: 'filter-swept chords (baked DEMO) + vocal placeholder' },
  { id: 'tail', label: 'Long Tail', bars: 16, color: '#3d3110', lanes: ['drums', 'hats'], note: 'groove-only outro for the mix-out' },
];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

/** Sections with start bars; Ride-in stretches so Hook starts nearest ≈1:30 on a 4-bar grid. */
export function buildForm(bpm, map) {
  const barSec = 240 / bpm;
  const hookStart = Math.max(28, Math.round(90 / barSec / 4) * 4); // bars before hook
  let bar = 1;
  return BASE_SECTIONS.map((s) => {
    const bars = s.id === 'ride' ? hookStart - 24 : s.bars;
    const out = { ...s, bars, start: bar, startSec: (bar - 1) * barSec, lanes: map?.[s.id] || s.lanes };
    bar += bars;
    return out;
  }).filter((s) => s.bars > 0);
}

function defaultMap() { return Object.fromEntries(BASE_SECTIONS.map((s) => [s.id, [...s.lanes]])); }

/* —— DSP helpers (baked, offline) —— */
function lpfSweep(ctx, buf, f0 = 280, f1 = 14000, holdFrac = 0.75) {
  const sr = buf.sampleRate;
  const out = ctx.createBuffer(1, buf.length, sr);
  const x = buf.getChannelData(0), y = out.getChannelData(0);
  let z = 0;
  const n = buf.length;
  for (let i = 0; i < n; i++) {
    const t = Math.min(1, i / (n * holdFrac));
    const fc = f0 * Math.pow(f1 / f0, t * t);
    const a = 1 - Math.exp(-2 * Math.PI * fc / sr);
    z += a * (x[i] - z);
    y[i] = z;
  }
  return out;
}
function noiseRiser(ctx, sec) {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * sec);
  const out = ctx.createBuffer(1, len, sr);
  const y = out.getChannelData(0);
  let z = 0, z2 = 0;
  for (let i = 0; i < len; i++) {
    const t = i / len;
    const fc = 200 * Math.pow(60, t);
    const a = 1 - Math.exp(-2 * Math.PI * fc / sr);
    z += a * ((Math.random() * 2 - 1) - z);
    z2 += a * (z - z2);
    y[i] = (z - z2 * 0.5) * (0.05 + 0.5 * t * t) * Math.min(1, (len - i) / (sr * 0.02));
  }
  return out;
}

export function mountTradingfloorForm(timelineRoot, godmodeEl, engine, toast, deps = {}) {
  let map = defaultMap();
  let bpmChoice = 'keep';
  let muteOthers = true;
  let lastApplied = null;

  /* —— Song-view strip —— */
  const header = timelineRoot.querySelector('.timeline-header');
  const strip = document.createElement('div');
  strip.className = 'tf-strip';
  strip.setAttribute('aria-label', 'Tradingfloor Form — arrangement template');
  const ruler = header?.querySelector('[data-ruler]');
  if (header) header.insertBefore(strip, ruler || null);

  /* —— Godmode panel —— */
  if (godmodeEl) godmodeEl.classList.add('tf-panel');

  function bpm() { return bpmChoice === 'keep' ? engine.bpm : Number(bpmChoice); }
  function form() { return buildForm(bpm(), map); }

  function materialLine() {
    const d = ensureDice();
    return `Material: Dice Forge · ${esc(getKey(d.key).label)} · ${esc(d.chords.names.join(' → '))} · seed ${d.seed}`;
  }

  function renderStrip() {
    const f = form();
    const total = f.reduce((n, s) => n + s.bars, 0);
    const hook = f.find((s) => s.id === 'hook');
    strip.innerHTML = `
      <span class="tf-label" title="Arrangement template inspired by the MENS MERCATUS TRADINGFLOOR playlist (SA deep / afro-tech house)">Tradingfloor Form</span>
      <div class="tf-sections" role="list">${f.map((s) => `
        <button type="button" class="tf-sec ${lastApplied ? 'applied' : ''}" role="listitem" data-tf-seek="${s.start}" style="--c:${s.color};flex-grow:${s.bars}"
          title="${esc(s.label)} · bars ${s.start}–${s.start + s.bars - 1} · ${fmt(s.startSec)} · ${esc(s.note)}${lastApplied ? ' · click to jump' : ''}">
          <span>${esc(s.label)}</span><small>${s.bars}b · ${fmt(s.startSec)}</small></button>`).join('')}</div>
      <div class="tf-actions">
        <span class="tf-meta" title="Hook start targets ≈1:30 at this BPM">${bpm()} BPM · ${total} bars · ${fmt(total * 240 / bpm())} · hook ${hook ? fmt(hook.startSec) : '—'}</span>
        <button type="button" class="btn sm primary" data-tf-apply title="Write the form onto the Song: section markers + TF lanes from the mute map">Apply Form</button>
        <button type="button" class="btn sm ghost" data-tf-open title="Edit the mute map, BPM and material in Godmode">Map…</button>
      </div>`;
  }

  function renderPanel() {
    if (!godmodeEl) return;
    const f = form();
    godmodeEl.innerHTML = `
      <div class="panel-head">
        <h2>Tradingfloor Form</h2>
        <span class="badge">Live</span><span class="badge warn" title="Filter sweep is baked into audio; vocal is a silent placeholder">Part DEMO</span>
      </div>
      <p class="panel-desc">Arrangement template from the <strong>MENS MERCATUS TRADINGFLOOR</strong> playlist (SA deep / afro-tech house): 8 bars groove → 16 pads/bass → hook ≈1:30 → dub breakdown → rebuild hats/perc → late vocal/filter climax → long tail. Toggle the mute map, then <strong>Apply</strong>.</p>
      <div class="tf-controls">
        <label class="field"><span>BPM</span>
          <select data-tf-bpm>
            <option value="keep">Keep (${engine.bpm})</option>
            ${[118, 120, 122, 124, 126].map((b) => `<option value="${b}">${b}</option>`).join('')}
          </select></label>
        <label class="toggle" title="Mute non-TF tracks on apply so you hear the form clean (undo restores)"><input type="checkbox" data-tf-muteothers ${muteOthers ? 'checked' : ''} /><span>Mute other tracks</span></label>
        <button type="button" class="btn sm ghost" data-tf-reset title="Restore the default mute map">Reset map</button>
      </div>
      <div class="tf-map" role="grid" aria-label="Mute map — sections × lanes">
        <div class="tf-map-row tf-map-head" role="row"><span>Section</span>${TF_LANES.map((l) => `<span title="${esc(l.name)}">${esc(l.abbr)}</span>`).join('')}</div>
        ${f.map((s) => `
          <div class="tf-map-row" role="row" style="--c:${s.color}">
            <span class="tf-map-sec" title="${esc(s.note)}"><b>${esc(s.label)}</b><small>${s.start}–${s.start + s.bars - 1} · ${fmt(s.startSec)}</small></span>
            ${TF_LANES.map((l) => { const on = s.lanes.includes(l.id); return `<button type="button" role="gridcell" class="tf-cell ${on ? 'on' : ''}" data-tf-cell="${s.id}:${l.id}" aria-pressed="${on}" title="${esc(s.label)} · ${esc(l.short)}: ${on ? 'plays' : 'muted'}"></button>`; }).join('')}
          </div>`).join('')}
      </div>
      <div class="tf-material"><span data-tf-material>${materialLine()}</span>
        <button type="button" class="btn sm" data-tf-reroll title="Roll new Dice Forge material (beats + melody + chords)">🎲 Re-roll material</button></div>
      <div class="btn-row"><button type="button" class="btn primary" data-tf-apply>Apply Tradingfloor Form</button>
        <button type="button" class="btn ghost" data-tf-clear title="Remove all TF lanes' clips">Clear form</button></div>
      <p class="fineprint">Real: section markers, mute map, editable pattern / piano clips (double-click in Song). DEMO: baked low-pass sweep on climax chords (no automation lane yet), noise riser, silent vocal placeholder. Ctrl/⌘+Z undoes an Apply.</p>`;
    godmodeEl.querySelector('[data-tf-bpm]').value = bpmChoice;
  }

  function renderAll() { renderStrip(); renderPanel(); }

  /* —— content builders —— */
  function laneContent(lane, sec, d, spb) {
    const rowsDrums = d.beats.rows.filter((r) => DRUM_INST.includes(r.inst));
    const rowsHats = d.beats.rows.filter((r) => !DRUM_INST.includes(r.inst));
    const loopNotes = (meta, bars, xf) => {
      const out = [];
      for (let o = 0; o < bars * 4; o += meta.bars * 4) meta.notes.forEach((n) => { const m = xf ? xf(n) : [n]; m.forEach((k) => { if (k.start + o < bars * 4) out.push({ ...k, start: k.start + o }); }); });
      return out;
    };
    if (lane === 'drums') {
      const rows = sec.id === 'groove' ? rowsDrums.filter((r) => r.inst.startsWith('kick')) : rowsDrums;
      return { type: 'pattern', variant: sec.id === 'groove' ? 'kick' : 'full', rows };
    }
    if (lane === 'hats') {
      if (sec.id === 'rebuild') {
        const rows = rowsHats.map((r) => (r.inst === 'hatC' ? { ...r, steps: r.steps.map((v, i) => v || (i % 2 ? 1 : 0)) } : r));
        return { type: 'pattern', variant: 'rolling', rows, name: 'Rolling hats/perc' };
      }
      return { type: 'pattern', variant: 'full', rows: rowsHats };
    }
    if (lane === 'bass') return { type: 'piano', variant: 'bass', inst: d.chords.bass.inst, src: d.chords.bass, loopNotes };
    if (lane === 'chords') {
      if (sec.id === 'dub') {
        // dub: one held pad per bar from the chord tones
        const held = { bars: d.chords.bars, notes: [] };
        const seen = new Set();
        d.chords.notes.forEach((n) => { const k = `${Math.floor(n.start / 4)}:${n.midi}`; if (!seen.has(k)) { seen.add(k); held.notes.push({ midi: n.midi, start: Math.floor(n.start / 4) * 4, len: 3.9, vel: 0.55 }); } });
        return { type: 'piano', variant: 'dub', inst: 'pad', src: held, loopNotes, name: 'Dub pads' };
      }
      return { type: 'piano', variant: sec.id === 'climax' ? 'sweep' : 'full', inst: d.chords.inst, src: d.chords, loopNotes, sweep: sec.id === 'climax' };
    }
    if (lane === 'hook') {
      if (sec.id === 'dub') {
        const echo = (n) => [{ ...n, vel: n.vel * 0.6 }, { ...n, start: n.start + 0.75, vel: n.vel * 0.32 }, { ...n, start: n.start + 1.5, vel: n.vel * 0.16 }];
        return { type: 'piano', variant: 'echo', inst: 'bell', src: d.melody, loopNotes, xf: echo, name: 'Hook · dub echo' };
      }
      return { type: 'piano', variant: 'full', inst: d.melody.inst, src: d.melody, loopNotes };
    }
    return { type: 'vox' };
  }

  async function apply() {
    await engine.init();
    const d = ensureDice();
    if (bpmChoice !== 'keep' && Number(bpmChoice) !== engine.bpm) engine.setBpm(Number(bpmChoice));
    const spb = engine.secondsPerBeat;
    const f = buildForm(engine.bpm, map);
    engine.stop?.();

    // snapshot for undo
    const before = engine.tracks.map((t) => ({ id: t.id, muted: !!t.muted, clips: [...t.clips] }));
    const createdIds = [];
    const ensure = (name) => {
      let t = engine.tracks.find((x) => x.name === name);
      if (!t) { t = engine.addTrack('audio', name); createdIds.push(t.id); }
      return t;
    };
    const formTrack = ensure(FORM_TRACK);
    const lanes = Object.fromEntries(TF_LANES.map((l) => [l.id, ensure(l.name)]));
    const tfIds = new Set([formTrack.id, ...Object.values(lanes).map((t) => t.id)]);
    tfIds.forEach((id) => { engine.tracks.find((t) => t.id === id).clips = []; });

    const cache = new Map();
    let n = 0;
    const push = (track, clip) => {
      track.clips.push({ id: `clip-${Date.now()}-${(n++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`, name: clip.name || 'Clip', startBeat: clip.startBeat, durationBeats: clip.durationBeats, color: clip.color, buffer: clip.buffer || null, recipe: null, notes: null, meta: clip.meta || null });
    };

    f.forEach((sec) => {
      const secBeat = (sec.start - 1) * 4;
      push(formTrack, { name: `${sec.label} · ${sec.start}–${sec.start + sec.bars - 1} · ${fmt(sec.startSec)}`, startBeat: secBeat, durationBeats: sec.bars * 4, color: sec.color, meta: { kind: 'section', form: 'tradingfloor', id: sec.id, label: sec.label, bars: sec.bars } });
      TF_LANES.forEach((laneDef) => {
        if (!sec.lanes.includes(laneDef.id)) return;
        const track = lanes[laneDef.id];
        const c = laneContent(laneDef.id, sec, d, spb);
        if (c.type === 'vox') {
          if (sec.id === 'rebuild' || sec.id === 'dub') {
            const rb = Math.min(4, sec.bars);
            const key = `riser:${rb}`;
            if (!cache.has(key)) cache.set(key, noiseRiser(engine.ctx, rb * 4 * spb));
            push(track, { name: 'Noise riser · DEMO', startBeat: secBeat + (sec.bars - rb) * 4, durationBeats: rb * 4, color: laneDef.color, buffer: cache.get(key), meta: { kind: 'fx', fx: 'riser', demo: true } });
          } else {
            push(track, { name: `Vocal ${sec.id === 'climax' ? 'hook (late)' : 'idea'} · placeholder — record in Mic or drop a stem`, startBeat: secBeat, durationBeats: sec.bars * 4, color: '#5a0a16', meta: { kind: 'placeholder', role: 'vocal', demo: true } });
            if (sec.id === 'climax') {
              const key = 'riser:2';
              if (!cache.has(key)) cache.set(key, noiseRiser(engine.ctx, 8 * spb));
              push(track, { name: 'Lift · DEMO', startBeat: secBeat + (sec.bars - 2) * 4, durationBeats: 8, color: laneDef.color, buffer: cache.get(key), meta: { kind: 'fx', fx: 'riser', demo: true } });
            }
          }
          return;
        }
        if (!c.rows?.length && c.type === 'pattern') return;
        if (c.sweep) {
          // one long clip so the sweep spans the whole climax
          const meta = { kind: 'piano', inst: c.inst, bars: sec.bars, notes: c.loopNotes(c.src, sec.bars), source: 'tradingfloor', fx: 'lpf-sweep (baked DEMO)' };
          const buf = lpfSweep(engine.ctx, renderPianoBuffer(engine.ctx, meta, spb));
          push(track, { name: 'Chords · filter climax (baked DEMO)', startBeat: secBeat, durationBeats: sec.bars * 4, color: '#c8102e', buffer: buf, meta });
          return;
        }
        for (let off = 0; off < sec.bars; off += 8) {
          const bars = Math.min(8, sec.bars - off);
          const key = `${laneDef.id}:${c.variant}:${bars}`;
          let entry = cache.get(key);
          if (!entry) {
            let meta, buffer;
            if (c.type === 'pattern') {
              meta = { kind: 'pattern', bars, rows: c.rows.map((r) => ({ ...r, steps: [...r.steps] })), source: 'tradingfloor' };
              buffer = renderPatternBuffer(engine.ctx, meta, spb);
            } else {
              meta = { kind: 'piano', inst: c.inst, bars, notes: c.loopNotes(c.src, bars, c.xf), source: 'tradingfloor' };
              buffer = renderPianoBuffer(engine.ctx, meta, spb);
            }
            entry = { meta, buffer };
            cache.set(key, entry);
          }
          push(track, { name: `${c.name || laneDef.short} · ${sec.label}`, startBeat: secBeat + off * 4, durationBeats: bars * 4, color: laneDef.color, buffer: entry.buffer, meta: entry.meta });
        }
      });
    });

    if (muteOthers) engine.tracks.forEach((t) => { if (!tfIds.has(t.id) && !t.muted) engine.setTrackMute(t.id, true); });
    engine._emit?.('tracks', engine.tracks);
    deps.history?.push?.({
      label: 'Undid Tradingfloor Form',
      undo: () => {
        before.forEach((b) => { const t = engine.tracks.find((x) => x.id === b.id); if (t) { t.clips = b.clips; if (!!t.muted !== b.muted) engine.setTrackMute(t.id, b.muted); } });
        createdIds.forEach((id) => engine.removeTrack(id));
        lastApplied = null;
        engine._emit?.('tracks', engine.tracks);
        renderAll();
      },
    });
    lastApplied = { at: Date.now(), bpm: engine.bpm };
    deps.views?.setMode?.('song');
    engine.seekToBeat?.(0);
    renderAll();
    const total = f.reduce((s, x) => s + x.bars, 0);
    const hook = f.find((s) => s.id === 'hook');
    const clipCount = [...tfIds].reduce((s, id) => s + (engine.tracks.find((t) => t.id === id)?.clips.length || 0), 0);
    toast(`Tradingfloor Form applied · ${f.length} sections · ${total} bars (${fmt(total * 240 / engine.bpm)}) · hook @ ${fmt(hook.startSec)} · ${clipCount} clips · Space to play, Ctrl+Z to undo`);
  }

  function clearForm() {
    const ids = [FORM_TRACK, ...TF_LANES.map((l) => l.name)];
    const before = [];
    engine.tracks.forEach((t) => { if (ids.includes(t.name) && t.clips.length) { before.push([t, t.clips]); t.clips = []; } });
    if (!before.length) { toast('No Tradingfloor clips to clear', 'warn'); return; }
    deps.history?.push?.({ label: 'Restored Tradingfloor clips', undo: () => { before.forEach(([t, c]) => { t.clips = c; }); engine._emit?.('tracks', engine.tracks); } });
    engine._emit?.('tracks', engine.tracks);
    lastApplied = null;
    renderAll();
    toast('Tradingfloor lanes cleared (tracks kept) · Ctrl+Z restores');
  }

  function onClick(e) {
    if (e.target.closest('[data-tf-apply]')) { apply().catch((err) => { console.error(err); toast('Tradingfloor Form failed — see console', 'warn'); }); return; }
    if (e.target.closest('[data-tf-clear]')) { clearForm(); return; }
    if (e.target.closest('[data-tf-open]')) { deps.openPanel?.(); return; }
    if (e.target.closest('[data-tf-reset]')) { map = defaultMap(); renderAll(); toast('Mute map reset'); return; }
    if (e.target.closest('[data-tf-reroll]')) { deps.rollDice?.('all'); return; }
    const cell = e.target.closest('[data-tf-cell]');
    if (cell) {
      const [sid, lid] = cell.dataset.tfCell.split(':');
      const arr = map[sid];
      const i = arr.indexOf(lid);
      if (i >= 0) arr.splice(i, 1); else arr.push(lid);
      renderAll();
      return;
    }
    const seek = e.target.closest('[data-tf-seek]');
    if (seek) {
      const beat = (Number(seek.dataset.tfSeek) - 1) * 4;
      if (engine.seekToBeat) engine.seekToBeat(beat);
      const wrap = timelineRoot.closest('.timeline-wrap') || timelineRoot;
      wrap.scrollLeft = Math.max(0, beat * 40 - 40);
    }
  }
  strip.addEventListener('click', onClick);
  godmodeEl?.addEventListener('click', onClick);
  godmodeEl?.addEventListener('change', (e) => {
    if (e.target.matches('[data-tf-bpm]')) { bpmChoice = e.target.value; renderAll(); }
    if (e.target.matches('[data-tf-muteothers]')) muteOthers = e.target.checked;
  });
  engine.on('bpm', () => renderAll());
  onDiceChange(() => { const m = godmodeEl?.querySelector('[data-tf-material]'); if (m) m.innerHTML = materialLine(); });
  renderAll();
  return { apply, clear: clearForm, form, render: renderAll, getDice: getDiceState };
}
