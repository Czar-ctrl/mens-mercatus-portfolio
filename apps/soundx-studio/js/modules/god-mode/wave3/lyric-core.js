/**
 * Shared lyric helpers for Lyric → Melody Sketch and Melody → Lyric Slots.
 * English-ish syllabifier (vowel groups + consonant-cluster split) — approximate by design.
 */
const V = 'aeiouy';
const isV = (ch) => V.includes(ch);

/** Split one word into syllables (keeps original letters). */
export function syllabify(word) {
  const raw = String(word || '');
  const w = raw.toLowerCase().replace(/[^a-z']/g, '');
  if (!w) return [];
  if (w.length <= 3) return [raw.replace(/[^A-Za-z']/g, '')];
  const groups = [];
  let i = 0;
  while (i < w.length) {
    let j = i;
    while (j < w.length && !isV(w[j])) j++;
    let k = j;
    while (k < w.length && isV(w[k])) k++;
    groups.push({ cons: w.slice(i, j), vow: w.slice(j, k), at: i });
    i = k;
  }
  // trailing consonants belong to the last vowel group
  let parts = [];
  groups.forEach((g) => {
    if (!g.vow) { if (parts.length) parts[parts.length - 1] += g.cons; else parts.push(g.cons); return; }
    if (!parts.length) { parts.push(g.cons + g.vow); return; }
    const c = g.cons;
    if (c.length >= 2) { parts[parts.length - 1] += c.slice(0, Math.floor(c.length / 2)); parts.push(c.slice(Math.floor(c.length / 2)) + g.vow); }
    else parts.push(c + g.vow);
  });
  // silent final "e" (make, love) and "-es"/"-ed" merge when the last part is just consonant+e
  if (parts.length > 1 && /^[^aeiouy]*e[sd]?$/.test(parts[parts.length - 1]) && !/le$/.test(w)) {
    const last = parts.pop();
    parts[parts.length - 1] += last;
  }
  // map back to the original casing
  const letters = raw.replace(/[^A-Za-z']/g, '');
  let p = 0;
  parts = parts.map((s) => { const out = letters.slice(p, p + s.length); p += s.length; return out; });
  return parts.filter(Boolean);
}

/** Line → [{syl, word, stress, end}] — stress on first syllable of multi-syllable words and on long words. */
export function lineSyllables(line) {
  const words = String(line || '').split(/\s+/).filter((x) => /[A-Za-z]/.test(x));
  const out = [];
  words.forEach((wd, wi) => {
    const syls = syllabify(wd);
    syls.forEach((s, si) => out.push({ syl: s, word: wd, stress: syls.length > 1 ? si === 0 : wd.replace(/[^A-Za-z]/g, '').length > 3, end: wi === words.length - 1 && si === syls.length - 1 }));
  });
  return out;
}

export function countSyllables(line) { return lineSyllables(line).length; }

/** Group sorted notes into phrases (gap ≥ 1 beat, or a 16-note cap). */
export function phrasesFromNotes(notes) {
  const sorted = notes.map((n, idx) => ({ ...n, idx })).sort((a, b) => a.beat - b.beat);
  const phrases = [];
  let cur = null;
  sorted.forEach((n) => {
    const prevEnd = cur ? cur.notes[cur.notes.length - 1].beat + (cur.notes[cur.notes.length - 1].dur || 0.25) : -99;
    if (!cur || n.beat - prevEnd >= 1 || cur.notes.length >= 16) { cur = { notes: [] }; phrases.push(cur); }
    cur.notes.push(n);
  });
  return phrases.map((p, i) => ({ id: i, startBeat: p.notes[0].beat, notes: p.notes, slots: p.notes.length, strong: p.notes.map((n) => Math.abs(n.beat - Math.round(n.beat)) < 1e-6) }));
}
