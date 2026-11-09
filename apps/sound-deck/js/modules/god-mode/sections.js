/**
 * Song structure helpers shared by Song-view loop chrome and God Mode Wave 2/3.
 * Section detection is a local heuristic over clip layout (no ML):
 *   1. clip names / meta.section (intro, verse, chorus, hook, drop, bridge, break, outro)
 *   2. per-bar activity runs (distinct active tracks + clip density)
 *   3. proportional fallback (Intro 0–25% · Verse 25–50% · Drop 50–85% · Outro 85–100%)
 */
export const PX_PER_BEAT = 40; // keep in sync with js/ui/timeline.js
export const HEADER_W = 200;

const NAMED = /\b(intro|verse|chorus|hook|pre-?chorus|drop|bridge|break(?:down)?|build|outro)\b/i;

const r4 = (x) => Math.round(x * 4) / 4;

export function songEndBeat(engine) {
  let end = 0;
  (engine?.tracks || []).forEach((t) => (t.clips || []).forEach((c) => {
    end = Math.max(end, (Number(c.startBeat) || 0) + (Number(c.durationBeats) || 0));
  }));
  return end;
}

/** Song length in bars (fractional bars kept to 0.25). */
export function songEndBar(engine) {
  return r4(songEndBeat(engine) / 4);
}

export function songBars(engine, min = 0) {
  return Math.max(min, Math.ceil(songEndBeat(engine) / 4));
}

/** Per-bar activity: { tracks, hits, score } for bars [0, nBars). */
export function barActivity(engine, nBars = songBars(engine)) {
  const out = Array.from({ length: nBars }, () => ({ tracks: new Set(), hits: 0, score: 0 }));
  (engine?.tracks || []).forEach((t) => {
    if (t.muted) return;
    (t.clips || []).forEach((c) => {
      const s = Number(c.startBeat) || 0;
      const e = s + (Number(c.durationBeats) || 0);
      for (let b = Math.floor(s / 4); b < Math.min(nBars, Math.ceil(e / 4)); b++) {
        if (b < 0) continue;
        out[b].tracks.add(t.id);
        out[b].hits += c.notes?.length ? Math.min(16, c.notes.length / Math.max(1, (e - s) / 4)) : 1;
      }
    });
  });
  out.forEach((a) => { a.score = a.tracks.size + Math.min(4, a.hits) * 0.25; });
  return out;
}

function proportional(lengthBars) {
  const L = Math.max(4, lengthBars);
  const cut = [0, r4(L * 0.25), r4(L * 0.5), r4(L * 0.85), L];
  const labels = ['Intro', 'Verse', 'Drop', 'Outro'];
  return labels.map((label, i) => ({
    id: label.toLowerCase(), label, startBar: cut[i], endBar: Math.max(cut[i] + 0.25, cut[i + 1]), source: 'proportional',
  }));
}

function fromNames(engine) {
  const spans = new Map();
  (engine?.tracks || []).forEach((t) => (t.clips || []).forEach((c) => {
    const raw = c.meta?.section || (String(c.name || '').match(NAMED) || [])[1];
    if (!raw) return;
    let label = String(raw).toLowerCase();
    if (label === 'hook' || label === 'chorus') label = 'drop';
    if (label.startsWith('break')) label = 'break';
    if (label.startsWith('pre')) label = 'build';
    const s = (Number(c.startBeat) || 0) / 4;
    const e = s + (Number(c.durationBeats) || 0) / 4;
    const cur = spans.get(label);
    if (!cur) spans.set(label, { s, e });
    else { cur.s = Math.min(cur.s, s); cur.e = Math.max(cur.e, e); }
  }));
  if (spans.size < 2) return null;
  return [...spans.entries()]
    .sort((a, b) => a[1].s - b[1].s)
    .map(([id, v]) => ({
      id, label: id[0].toUpperCase() + id.slice(1), startBar: r4(v.s), endBar: r4(Math.max(v.s + 0.25, v.e)), source: 'names',
    }));
}

/**
 * @returns {Array<{id,label,startBar,endBar,source}>}
 */
export function detectSections(engine) {
  const named = fromNames(engine);
  if (named) return named;
  const bars = songBars(engine);
  if (bars < 8) return proportional(Math.max(bars, songEndBar(engine)));

  const act = barActivity(engine, bars);
  const max = Math.max(...act.map((a) => a.score), 0.0001);
  const level = act.map((a) => {
    const r = a.score / max;
    if (a.score === 0) return 0;
    return r >= 0.85 ? 3 : r >= 0.5 ? 2 : 1;
  });
  // runs
  let runs = [];
  level.forEach((lv, i) => {
    const last = runs[runs.length - 1];
    if (last && last.level === lv) last.end = i + 1;
    else runs.push({ level: lv, start: i, end: i + 1 });
  });
  // merge runs shorter than 2 bars into the previous (or next) run
  for (let pass = 0; pass < 3; pass++) {
    const merged = [];
    runs.forEach((r) => {
      const prev = merged[merged.length - 1];
      if (prev && (r.end - r.start < 2 || prev.level === r.level)) { prev.end = r.end; prev.level = Math.max(prev.level, r.level); }
      else merged.push({ ...r });
    });
    if (merged.length > 1 && merged[0].end - merged[0].start < 2) {
      merged[1].start = merged[0].start;
      merged.shift();
    }
    runs = merged;
  }
  if (runs.length < 2 || runs.length > 10) return proportional(bars);

  const top = Math.max(...runs.map((r) => r.level));
  let drops = 0;
  let verses = 0;
  const out = runs.map((r, i) => {
    let label;
    if (r.level === top) { drops += 1; label = 'Drop'; }
    else if (i === 0) label = 'Intro';
    else if (i === runs.length - 1) label = 'Outro';
    else if (r.level <= 1) label = 'Break';
    else { verses += 1; label = 'Verse'; }
    return { label, startBar: r.start, endBar: r.end, source: 'activity' };
  });
  // Number repeated labels: Drop 1, Drop 2…
  const seen = {};
  const totals = out.reduce((m, s) => { m[s.label] = (m[s.label] || 0) + 1; return m; }, {});
  out.forEach((s) => {
    seen[s.label] = (seen[s.label] || 0) + 1;
    s.id = `${s.label.toLowerCase()}${totals[s.label] > 1 ? `-${seen[s.label]}` : ''}`;
    if (totals[s.label] > 1) s.label = `${s.label} ${seen[s.label]}`;
  });
  void drops; void verses;
  return out;
}

/** Find a section by loose name ("drop", "intro", "outro", "verse 2"). */
export function findSection(engine, name) {
  const q = String(name || '').toLowerCase().trim();
  const secs = detectSections(engine);
  if (!q) return null;
  if (q === 'end' || q === 'last') return secs[secs.length - 1] || null;
  return secs.find((s) => s.id === q || s.label.toLowerCase() === q)
    || secs.find((s) => s.id.startsWith(q) || s.label.toLowerCase().startsWith(q))
    || null;
}

/** Loop the last N bars ending at song end (falls back to bars 0..N). */
export function endLoopRange(engine, nBars = 4) {
  const end = Math.max(nBars, Math.ceil(songEndBeat(engine) / 4 * 4) / 4);
  const e = r4(end);
  return { startBar: Math.max(0, r4(e - nBars)), endBar: e };
}

export function setLoop(engine, startBar, endBar, looping = true) {
  engine.setLoopRegion(startBar, endBar, looping);
  return { startBar: engine.loopStart, endBar: engine.loopEnd };
}

export function playheadBeat(engine) {
  return engine.isPlaying ? engine.currentBeat : (engine.pauseOffset / engine.secondsPerBeat || 0);
}

export function timelineRoot() {
  return typeof document !== 'undefined' ? document.querySelector('[data-timeline]') : null;
}

export function scrollTimelineToBeat(beat, { align = 0.6, smooth = true } = {}) {
  const root = timelineRoot();
  if (!root) return;
  const x = HEADER_W + beat * PX_PER_BEAT;
  const left = Math.max(0, x - root.clientWidth * align);
  try { root.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' }); } catch (_) { root.scrollLeft = left; }
}

export function seekBar(engine, bar, { scroll = true } = {}) {
  const beat = Math.max(0, Number(bar) || 0) * 4;
  engine.seekToBeat(beat);
  if (scroll) scrollTimelineToBeat(beat, { align: 0.35 });
}

/** Shared energy heat (0..1 per bar) — Drop Finder / Energy Predictor publish, Song chrome draws. */
let lastEnergy = null;
export function publishEnergy(bars) {
  lastEnergy = Array.isArray(bars) ? bars.slice() : null;
  try { window.dispatchEvent(new CustomEvent('sx-god:energy', { detail: { bars: lastEnergy } })); } catch (_) {}
}
export function getEnergy() { return lastEnergy; }
