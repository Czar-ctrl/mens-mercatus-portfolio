/**
 * Genre groove tables for Genre Morph Agent (Wave 2) and Genre Graph Router (Wave 3).
 * Hand-written rhythm maps — heuristic, not a trained model.
 * Grid: 16 steps per bar (step / 4 = beat).
 */
import { mulberry32, seedFrom } from '../../audio/generator.js';

export const GENRES = {
  hiphop: { label: 'Hip-Hop', bpm: [86, 98], target: 92, swing: 0.56, style: 'hiphop' },
  boombap: { label: 'Boom-Bap', bpm: [84, 95], target: 90, swing: 0.6, style: 'hiphop' },
  trap: { label: 'Trap', bpm: [130, 150], target: 140, swing: 0.5, style: 'trap' },
  amapiano: { label: 'Amapiano', bpm: [110, 115], target: 113, swing: 0.58, style: 'amapiano' },
  afrotech: { label: 'Afro Tech', bpm: [122, 126], target: 124, swing: 0.56, style: 'afrotech' },
  afrohouse: { label: 'Afro House', bpm: [118, 124], target: 122, swing: 0.55, style: 'afrohouse' },
  gqom: { label: 'Gqom', bpm: [120, 128], target: 126, swing: 0.52, style: 'gqom' },
  house: { label: 'House', bpm: [120, 128], target: 124, swing: 0.54, style: 'house' },
};

/** Voice layers per style: role → { voice, steps (0..15), vel, prob } */
const STYLE_LAYERS = {
  afrotech: [
    { layer: 'kick', voice: 'kick', steps: [0, 4, 8, 12], vel: 1 },
    { layer: 'clap', voice: 'clap', steps: [4, 12], vel: 0.8 },
    { layer: 'shaker', voice: 'shaker', steps: [...Array(16).keys()], vel: 0.55, accent: [2, 6, 10, 14] },
    { layer: 'conga', voice: 'conga_hi', steps: [3, 6, 10, 11, 14], vel: 0.7, prob: 0.9 },
    { layer: 'conga', voice: 'conga_lo', steps: [7, 15], vel: 0.75 },
    { layer: 'hat', voice: 'ohat', steps: [2, 6, 10, 14], vel: 0.45 },
    { layer: 'rim', voice: 'rim', steps: [3, 11], vel: 0.5, prob: 0.7 },
  ],
  afrohouse: [
    { layer: 'kick', voice: 'kick', steps: [0, 4, 8, 12], vel: 1 },
    { layer: 'clap', voice: 'clap', steps: [4, 12], vel: 0.75 },
    { layer: 'shaker', voice: 'shaker', steps: [...Array(16).keys()], vel: 0.5, accent: [2, 6, 10, 14] },
    { layer: 'conga', voice: 'conga_hi', steps: [2, 5, 8, 10, 13], vel: 0.7 },
    { layer: 'conga', voice: 'conga_lo', steps: [0, 7, 11], vel: 0.7 },
    { layer: 'tom', voice: 'tom', steps: [14], vel: 0.6, prob: 0.6 },
  ],
  amapiano: [
    { layer: 'kick', voice: 'kick', steps: [0, 8], vel: 0.9 },
    { layer: 'logdrum', voice: 'logdrum', steps: [3, 6, 10, 13], vel: 0.85, prob: 0.9 },
    { layer: 'shaker', voice: 'shaker', steps: [...Array(16).keys()], vel: 0.48, accent: [2, 6, 10, 14] },
    { layer: 'rim', voice: 'rim', steps: [4, 12], vel: 0.6 },
    { layer: 'clap', voice: 'clap', steps: [12], vel: 0.6 },
    { layer: 'hat', voice: 'hat', steps: [2, 6, 10, 14], vel: 0.4 },
  ],
  gqom: [
    { layer: 'kick', voice: 'kick', steps: [0, 3, 6, 10], vel: 1 },
    { layer: 'tom', voice: 'tom', steps: [7, 11, 14], vel: 0.75 },
    { layer: 'clap', voice: 'clap', steps: [4, 12], vel: 0.7 },
    { layer: 'shaker', voice: 'shaker', steps: [2, 6, 10, 14], vel: 0.5 },
    { layer: 'rim', voice: 'rim', steps: [9, 15], vel: 0.5, prob: 0.8 },
  ],
  house: [
    { layer: 'kick', voice: 'kick', steps: [0, 4, 8, 12], vel: 1 },
    { layer: 'clap', voice: 'clap', steps: [4, 12], vel: 0.8 },
    { layer: 'hat', voice: 'ohat', steps: [2, 6, 10, 14], vel: 0.5 },
    { layer: 'hat', voice: 'hat', steps: [...Array(16).keys()], vel: 0.25, prob: 0.8 },
  ],
  hiphop: [
    { layer: 'kick', voice: 'kick', steps: [0, 7, 10], vel: 1 },
    { layer: 'snare', voice: 'snare', steps: [4, 12], vel: 0.9 },
    { layer: 'hat', voice: 'hat', steps: [0, 2, 4, 6, 8, 10, 12, 14], vel: 0.45 },
  ],
  trap: [
    { layer: 'kick', voice: 'kick', steps: [0, 7, 11], vel: 1 },
    { layer: 'snare', voice: 'clap', steps: [8], vel: 0.9 },
    { layer: 'hat', voice: 'hat', steps: [...Array(16).keys()], vel: 0.4, prob: 0.85 },
  ],
};

export const PATTERN_STYLES = Object.keys(STYLE_LAYERS);

export function styleLayers(style) {
  return [...new Set((STYLE_LAYERS[style] || []).map((l) => l.layer))];
}

/** Swing in 0.5 (straight) … 0.75: odd 16ths shift later by (swing − 0.5) beats. */
export function swingOffset(step, swing = 0.5) {
  return step % 2 === 1 ? Math.max(0, Math.min(0.25, (swing - 0.5))) : 0;
}

/**
 * Deterministic hits for a style.
 * @returns [{beat, voice, vel, layer}]
 */
export function patternHits(style, bars = 4, { swing = 0.5, seed = 1, layers = null, fillLastBar = false } = {}) {
  const table = STYLE_LAYERS[style] || STYLE_LAYERS.house;
  const rng = mulberry32(seedFrom(`${style}|${bars}|${seed}`));
  const hits = [];
  for (let bar = 0; bar < bars; bar++) {
    table.forEach((l) => {
      if (layers && !layers.includes(l.layer)) return;
      l.steps.forEach((st) => {
        if (l.prob != null && rng() > l.prob) return;
        const acc = l.accent?.includes(st) ? 1.35 : 1;
        const human = 0.92 + rng() * 0.12;
        hits.push({ beat: bar * 4 + st / 4 + swingOffset(st, swing), voice: l.voice, vel: Math.min(1.1, l.vel * acc * human), layer: l.layer });
      });
    });
    if (fillLastBar && bar === bars - 1) {
      [10, 11, 12, 13, 14, 15].forEach((st, i) => hits.push({ beat: bar * 4 + st / 4, voice: i < 3 ? 'conga_hi' : 'tom', vel: 0.55 + i * 0.07, layer: 'fill' }));
    }
  }
  return hits.sort((a, b) => a.beat - b.beat);
}

/** Morph maps: source → target with extra notes for the agent plan. */
export const MORPH_TARGETS = ['afrotech', 'amapiano', 'afrohouse', 'gqom', 'house'];
export const MORPH_SOURCES = ['hiphop', 'boombap', 'trap', 'amapiano', 'house'];

const FX_PLAN = {
  afrotech: [
    { track: '@drums', fx_id: 'comp', preset: 0.55, why: 'tight four-on-floor glue' },
    { track: '@perc', fx_id: 'delay', preset: 0.22, why: 'dotted-8th perc echo' },
    { track: '@perc', fx_id: 'eqlow', preset: 0.35, why: 'clean low end under the kick' },
  ],
  afrohouse: [
    { track: '@drums', fx_id: 'comp', preset: 0.45, why: 'groove glue' },
    { track: '@perc', fx_id: 'space', preset: 0.25, why: 'open room on congas' },
  ],
  amapiano: [
    { track: '@perc', fx_id: 'space', preset: 0.2, why: 'airy shakers' },
    { track: '@perc', fx_id: 'drive', preset: 0.25, why: 'log-drum grit' },
  ],
  gqom: [
    { track: '@drums', fx_id: 'drive', preset: 0.35, why: 'raw broken kick' },
    { track: '@perc', fx_id: 'space', preset: 0.3, why: 'dark tom space' },
  ],
  house: [
    { track: '@drums', fx_id: 'comp', preset: 0.5, why: 'pumping glue' },
  ],
};

/**
 * Build a SoundXCommandBatch command list for a genre morph.
 * Track refs '@drums' / '@perc' are resolved by the caller (resolveRoleTrack).
 */
export function morphCommands(fromId, toId, {
  startBar = 0, bars = 8, bpmRampBars = 0, muteSource = true, sourceDrumTrack = null,
  drumsTrack = 'Morph Drums', percTrack = 'Morph Perc', seed = 1, withFx = true,
} = {}) {
  const to = GENRES[toId];
  const from = GENRES[fromId];
  if (!to || !from) return [];
  const cmds = [];
  cmds.push({ action: 'set_bpm', bpm: to.target, ...(bpmRampBars > 0 ? { ramp_bars: bpmRampBars } : {}) });
  if (muteSource && sourceDrumTrack) cmds.push({ action: 'set_track_state', track: sourceDrumTrack, mute: true });
  const layers = styleLayers(to.style);
  const drumLayers = layers.filter((l) => ['kick', 'clap', 'snare'].includes(l));
  const percLayers = layers.filter((l) => !drumLayers.includes(l));
  cmds.push({
    action: 'add_clip', track: drumsTrack, create_track: true, bar: startBar,
    name: `${to.label} kick+clap`,
    source: { type: 'pattern', style: to.style, bars, swing: to.swing, layers: drumLayers, seed },
  });
  if (percLayers.length) {
    cmds.push({
      action: 'add_clip', track: percTrack, create_track: true, bar: startBar,
      name: `${to.label} perc`,
      source: { type: 'pattern', style: to.style, bars, swing: to.swing, layers: percLayers, seed: seed + 1, fill_last_bar: true },
    });
  }
  if (withFx) {
    (FX_PLAN[toId] || []).forEach((f) => {
      cmds.push({ action: 'insert_fx', track: f.track === '@drums' ? drumsTrack : percTrack, fx_id: f.fx_id, preset: f.preset, _why: f.why });
    });
  }
  return cmds;
}

export function describeMorph(fromId, toId) {
  const to = GENRES[toId];
  const from = GENRES[fromId];
  if (!to || !from) return '';
  const layers = styleLayers(to.style).join(' · ');
  return `${from.label} (${from.bpm[0]}–${from.bpm[1]} BPM) → ${to.label} ${to.target} BPM · swing ${Math.round(to.swing * 100)}% · layers: ${layers}`
    + `${(FX_PLAN[toId] || []).length ? ` · FX: ${(FX_PLAN[toId] || []).map((f) => f.fx_id).join(', ')}` : ''}`;
}

/* —— Genre graph (Wave 3 Genre Graph Router) —— */
export const GENRE_EDGES = [
  ['hiphop', 'amapiano'], ['hiphop', 'house'], ['hiphop', 'trap'], ['hiphop', 'boombap'],
  ['boombap', 'amapiano'], ['trap', 'gqom'], ['amapiano', 'afrotech'], ['amapiano', 'afrohouse'],
  ['house', 'afrohouse'], ['house', 'afrotech'], ['afrohouse', 'afrotech'], ['gqom', 'afrotech'],
];

export function genrePath(from, to) {
  if (from === to) return [from];
  const adj = {};
  GENRE_EDGES.forEach(([a, b]) => { (adj[a] ||= []).push(b); (adj[b] ||= []).push(a); });
  const prev = { [from]: null };
  const q = [from];
  while (q.length) {
    const cur = q.shift();
    for (const nx of adj[cur] || []) {
      if (nx in prev) continue;
      prev[nx] = cur;
      if (nx === to) {
        const path = [to];
        let p = cur;
        while (p) { path.unshift(p); p = prev[p]; }
        return path;
      }
      q.push(nx);
    }
  }
  return null;
}

/** Guess a source genre from session BPM. */
export function guessGenre(bpm) {
  if (bpm >= 130) return 'trap';
  if (bpm < 100) return 'hiphop';
  if (bpm < 117) return 'amapiano';
  return 'house';
}
