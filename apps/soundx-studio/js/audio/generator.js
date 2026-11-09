/**
 * Shared phrase / scale / drum-pattern helpers for in-house Generate.
 * Local Web Audio synthesis only — not a cloud foundation model.
 */
export const NOTE_HZ = {
  C: 261.63, 'C#': 277.18, Db: 277.18, D: 293.66, 'D#': 311.13, Eb: 311.13,
  E: 329.63, F: 349.23, 'F#': 369.99, Gb: 369.99, G: 392.0, 'G#': 415.3,
  Ab: 415.3, A: 440.0, 'A#': 466.16, Bb: 466.16, B: 493.88,
};

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  blues: [0, 3, 5, 6, 7, 10],
};

export const GENRES = {
  house: { scale: 'minor', drum: 'four', bass: 'pulse', mood: 'groovy', defaultBpm: 124 },
  hiphop: { scale: 'minor', drum: 'boom', bass: 'root', mood: 'chill', defaultBpm: 90 },
  techno: { scale: 'minor', drum: 'four', bass: 'pulse', mood: 'dark', defaultBpm: 128 },
  ambient: { scale: 'pentatonic', drum: 'sparse', bass: 'drone', mood: 'warm', defaultBpm: 80 },
  pop: { scale: 'major', drum: 'straight', bass: 'root-fifth', mood: 'bright', defaultBpm: 110 },
  trap: { scale: 'minor', drum: 'trap', bass: '808', mood: 'dark', defaultBpm: 140 },
  lofi: { scale: 'dorian', drum: 'boom', bass: 'root', mood: 'chill', defaultBpm: 85 },
  jazz: { scale: 'dorian', drum: 'swing', bass: 'walking', mood: 'warm', defaultBpm: 100 },
};

export const MOODS = {
  chill: { velocity: 0.7, hatDensity: 0.5, leadSparse: true },
  energetic: { velocity: 1, hatDensity: 1, leadSparse: false },
  dark: { velocity: 0.85, hatDensity: 0.75, leadSparse: false, rootShift: -12 },
  bright: { velocity: 0.9, hatDensity: 0.85, leadSparse: false, rootShift: 0 },
  warm: { velocity: 0.75, hatDensity: 0.4, leadSparse: true },
  groovy: { velocity: 0.9, hatDensity: 0.9, leadSparse: false },
};

export const COLORS = {
  kick: '#F5C518',
  snare: '#E8A838',
  hat: '#C9A227',
  bass: '#D4A017',
  pad: '#B8860B',
  lead: '#F5C518',
  fx: '#8a7a40',
  drums: '#F5C518',
  melody: '#DAA520',
};

export function parseRoot(text) {
  const m = String(text || '').match(/\b([A-G](?:#|b)?)\b/i);
  if (!m) return { name: 'A', hz: 220 };
  const raw = m[1];
  const key = raw.length > 1 ? raw[0].toUpperCase() + raw.slice(1) : raw.toUpperCase();
  const hz = NOTE_HZ[key] || NOTE_HZ[key[0]] || 220;
  return { name: key, hz };
}

export function matchScale(text, fallback = 'minor') {
  const t = String(text || '').toLowerCase();
  if (/\bblues\b/.test(t)) return 'blues';
  if (/\bpenta/.test(t)) return 'pentatonic';
  if (/\bdorian\b/.test(t)) return 'dorian';
  if (/\bmajor\b|\bionian\b/.test(t)) return 'major';
  if (/\bminor\b|\baeolian\b/.test(t)) return 'minor';
  return fallback;
}

export function matchGenre(text) {
  const t = String(text || '').toLowerCase();
  for (const key of Object.keys(GENRES)) {
    if (t.includes(key) || (key === 'hiphop' && /hip[- ]?hop|boom bap/.test(t))) return key;
  }
  if (/house|club|four.?on/.test(t)) return 'house';
  if (/techno|rave/.test(t)) return 'techno';
  if (/ambient|drone|atmos/.test(t)) return 'ambient';
  if (/trap|808/.test(t)) return 'trap';
  if (/lo[- ]?fi|chillhop/.test(t)) return 'lofi';
  if (/jazz|swing/.test(t)) return 'jazz';
  if (/pop|radio/.test(t)) return 'pop';
  return 'pop';
}

export function matchMood(text, genreMood) {
  const t = String(text || '').toLowerCase();
  for (const key of Object.keys(MOODS)) {
    if (t.includes(key)) return key;
  }
  if (/sad|melanch|noir/.test(t)) return 'dark';
  if (/happy|uplift|sunny/.test(t)) return 'bright';
  if (/relax|soft|mellow/.test(t)) return 'chill';
  if (/hype|party|pump/.test(t)) return 'energetic';
  return genreMood || 'chill';
}

export function degToHz(rootHz, degree, octave = 0) {
  return rootHz * Math.pow(2, (degree + octave * 12) / 12);
}

/** Deterministic-ish hash for variety without Math.random chaos across regenerations of same prompt */
export function seedFrom(str) {
  let h = 2166136261;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Drum hit schedule for N bars (16th-note grid as beat offsets).
 * Returns { kick: number[], snare: number[], hat: number[], perc: number[] }
 */
export function drumPattern(style, bars, rng = Math.random) {
  const beats = bars * 4;
  const kick = [];
  const snare = [];
  const hat = [];
  const perc = [];

  for (let b = 0; b < beats; b++) {
    const pos = b % 4;
    if (style === 'four') {
      kick.push(b);
      if (pos === 1 || pos === 3) snare.push(b);
      hat.push(b, b + 0.5);
    } else if (style === 'boom') {
      if (pos === 0 || (pos === 2 && rng() > 0.4)) kick.push(b);
      if (pos === 1 || pos === 3) snare.push(b);
      if (pos % 2 === 0) hat.push(b + 0.5);
      if (rng() > 0.85) perc.push(b + 0.75);
    } else if (style === 'trap') {
      if (b % 8 === 0) kick.push(b);
      if (b % 8 === 3) kick.push(b + 0.5);
      if (b % 8 === 6) kick.push(b + 0.75);
      if (pos === 1 || pos === 3) snare.push(b);
      for (let s = 0; s < 4; s++) {
        if (rng() > 0.3) hat.push(b + s * 0.25);
      }
    } else if (style === 'sparse') {
      if (pos === 0) kick.push(b);
      if (pos === 2 && rng() > 0.5) snare.push(b);
      if (pos === 0) hat.push(b + 0.5);
    } else if (style === 'swing') {
      if (pos === 0 || pos === 2) kick.push(b);
      if (pos === 1 || pos === 3) snare.push(b);
      hat.push(b, b + 0.66);
    } else {
      // straight
      if (pos === 0 || pos === 2) kick.push(b);
      if (pos === 1 || pos === 3) snare.push(b);
      hat.push(b, b + 0.5);
    }
  }

  // de-dupe
  const uniq = (arr) => [...new Set(arr.map((x) => Math.round(x * 100) / 100))].sort((a, b) => a - b);
  return { kick: uniq(kick), snare: uniq(snare), hat: uniq(hat), perc: uniq(perc) };
}

/** Melodic contour degrees into scale for N quarter-note steps */
export function melodyContour(scaleDegrees, steps, rng, sparse = false) {
  const notes = [];
  const contour = [0, 2, 4, 3, 5, 4, 2, 0, 4, 5, 7, 5, 4, 2, 0, 2];
  for (let i = 0; i < steps; i++) {
    if (sparse && i % 2 === 1 && rng() > 0.4) continue;
    const idx = contour[i % contour.length] % scaleDegrees.length;
    const deg = scaleDegrees[idx];
    const octave = i > steps * 0.6 && rng() > 0.6 ? 1 : 0;
    notes.push({
      beat: i + (rng() > 0.85 ? 0.5 : 0),
      dur: sparse ? 1.1 : i % 4 === 3 ? 1.25 : 0.7,
      degree: deg,
      octave,
    });
  }
  return notes;
}

/** Chord/pad voicing as freqs for a bar root */
export function chordFreqs(rootHz, scaleDegrees, quality = 'triad') {
  const thirds = quality === 'seventh'
    ? [0, 2, 4, 6].map((i) => scaleDegrees[i % scaleDegrees.length])
    : [0, 2, 4].map((i) => scaleDegrees[i % scaleDegrees.length]);
  return thirds.map((d) => degToHz(rootHz, d));
}

export function bassNotes(rootHz, bars, pattern, scaleDegrees, rng) {
  const notes = [];
  const steps = bars * 4;
  const bassRoot = rootHz / 2;
  for (let i = 0; i < steps; i++) {
    let freq = bassRoot;
    let dur = 0.85;
    if (pattern === 'pulse') {
      freq = bassRoot;
      dur = 0.45;
      notes.push({ beat: i, dur, freq, wave: 'sawtooth' });
      continue;
    }
    if (pattern === '808') {
      if (i % 4 === 0 || i % 8 === 5) {
        notes.push({ beat: i, dur: 1.5, freq: bassRoot * (i % 8 === 5 ? 0.75 : 1), wave: 'sine' });
      }
      continue;
    }
    if (pattern === 'drone') {
      if (i === 0) notes.push({ beat: 0, dur: steps, freq: bassRoot, wave: 'sine' });
      continue;
    }
    if (pattern === 'walking') {
      const deg = scaleDegrees[i % scaleDegrees.length];
      freq = degToHz(bassRoot, deg);
    } else if (pattern === 'root-fifth') {
      freq = i % 4 === 2 ? bassRoot * 1.5 : bassRoot;
    } else {
      // root
      if (i % 2 === 1 && rng() > 0.5) continue;
      freq = bassRoot;
    }
    notes.push({ beat: i, dur, freq, wave: 'sawtooth' });
  }
  return notes;
}

export function lastClipEndBeat(engine) {
  let max = 0;
  for (const t of engine.tracks) {
    for (const c of t.clips) {
      const end = (c.startBeat || 0) + (c.durationBeats || 0);
      if (end > max) max = end;
    }
  }
  return max;
}

export function inferHarmonyFromProject(engine) {
  // Peek at first notes-bearing clip for a root hint
  for (const t of engine.tracks) {
    for (const c of t.clips) {
      if (c.notes?.length) {
        const f = c.notes[0].freq;
        if (f) {
          // map to nearest named pitch in mid register
          let best = { name: 'A', hz: 220, dist: Infinity };
          for (const [name, hz] of Object.entries(NOTE_HZ)) {
            const dist = Math.abs(Math.log2(f / (hz / 2)));
            if (dist < best.dist) best = { name, hz: hz / 2, dist };
          }
          return best;
        }
      }
    }
  }
  return { name: 'A', hz: 110 };
}
