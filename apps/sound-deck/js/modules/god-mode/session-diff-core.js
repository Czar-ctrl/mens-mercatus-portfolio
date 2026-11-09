/**
 * Snapshot diff (project JSON from engine.toJSON / session-versions.get) — shared by
 * Session Diff (Wave 2) and Diff Explain (Wave 3). Clips match by id, then by name + length
 * on the same track (Restore re-issues clip ids).
 */
const r = (x, d = 2) => Math.round((Number(x) || 0) * 10 ** d) / 10 ** d;
const db = (lin) => (lin <= 0.00001 ? -96 : r(20 * Math.log10(lin), 1));

export function diffSessions(a, b) {
  const out = [];
  if (!a || !b) return out;
  if (r(a.bpm, 1) !== r(b.bpm, 1)) out.push({ kind: 'bpm', label: `Tempo ${r(a.bpm, 1)} → ${r(b.bpm, 1)} BPM`, a: a.bpm, b: b.bpm });
  if (r(a.loopStart) !== r(b.loopStart) || r(a.loopEnd) !== r(b.loopEnd) || !!a.isLooping !== !!b.isLooping) {
    out.push({ kind: 'loop', label: `Loop bars ${r(a.loopStart) + 1}–${r(a.loopEnd)} ${a.isLooping ? 'on' : 'off'} → ${r(b.loopStart) + 1}–${r(b.loopEnd)} ${b.isLooping ? 'on' : 'off'}`, a: { s: a.loopStart, e: a.loopEnd, on: a.isLooping }, b: { s: b.loopStart, e: b.loopEnd, on: b.isLooping } });
  }
  const ta = new Map((a.tracks || []).map((t) => [t.id, t]));
  const tb = new Map((b.tracks || []).map((t) => [t.id, t]));
  ta.forEach((t, id) => { if (!tb.has(id)) out.push({ kind: 'track-removed', label: `Track “${t.name}” removed (${t.clips?.length || 0} clips)`, track: t }); });
  tb.forEach((t, id) => { if (!ta.has(id)) out.push({ kind: 'track-added', label: `Track “${t.name}” added (${t.clips?.length || 0} clips)`, track: t }); });
  tb.forEach((t2, id) => {
    const t1 = ta.get(id);
    if (!t1) return;
    if (t1.name !== t2.name) out.push({ kind: 'track-field', trackId: id, field: 'name', label: `Renamed “${t1.name}” → “${t2.name}”`, a: t1.name, b: t2.name });
    if (r(t1.volume, 3) !== r(t2.volume, 3)) out.push({ kind: 'track-field', trackId: id, field: 'volume', label: `${t2.name} volume ${db(t1.volume)} → ${db(t2.volume)} dB`, a: t1.volume, b: t2.volume });
    if (r(t1.pan) !== r(t2.pan)) out.push({ kind: 'track-field', trackId: id, field: 'pan', label: `${t2.name} pan ${r(t1.pan)} → ${r(t2.pan)}`, a: t1.pan, b: t2.pan });
    if (!!t1.muted !== !!t2.muted) out.push({ kind: 'track-field', trackId: id, field: 'muted', label: `${t2.name} ${t2.muted ? 'muted' : 'unmuted'}`, a: !!t1.muted, b: !!t2.muted });
    if (!!t1.solo !== !!t2.solo) out.push({ kind: 'track-field', trackId: id, field: 'solo', label: `${t2.name} ${t2.solo ? 'soloed' : 'unsoloed'}`, a: !!t1.solo, b: !!t2.solo });
    ['low', 'mid', 'high'].forEach((band) => {
      if (r(t1.eq?.[band], 1) !== r(t2.eq?.[band], 1)) out.push({ kind: 'track-eq', trackId: id, band, label: `${t2.name} EQ ${band} ${r(t1.eq?.[band], 1)} → ${r(t2.eq?.[band], 1)} dB`, a: t1.eq?.[band] || 0, b: t2.eq?.[band] || 0 });
    });
    const ca = [...(t1.clips || [])];
    const cb = [...(t2.clips || [])];
    const pairs = [];
    cb.forEach((c2) => {
      let i = ca.findIndex((c1) => c1.id === c2.id);
      if (i < 0) i = ca.findIndex((c1) => c1.name === c2.name && r(c1.durationBeats) === r(c2.durationBeats) && r(c1.startBeat) === r(c2.startBeat));
      if (i < 0) i = ca.findIndex((c1) => c1.name === c2.name && r(c1.durationBeats) === r(c2.durationBeats));
      if (i >= 0) { pairs.push([ca[i], c2]); ca.splice(i, 1); } else out.push({ kind: 'clip-added', trackId: id, label: `${t2.name}: + “${c2.name}” @ bar ${r(c2.startBeat / 4 + 1)}`, clip: c2 });
    });
    ca.forEach((c1) => out.push({ kind: 'clip-removed', trackId: id, label: `${t2.name}: − “${c1.name}” @ bar ${r(c1.startBeat / 4 + 1)}`, clip: c1 }));
    pairs.forEach(([c1, c2]) => {
      if (r(c1.startBeat) !== r(c2.startBeat)) out.push({ kind: 'clip-moved', trackId: id, clipName: c2.name, label: `${t2.name}: “${c2.name}” moved bar ${r(c1.startBeat / 4 + 1)} → ${r(c2.startBeat / 4 + 1)}`, a: c1, b: c2 });
    });
  });
  return out;
}

/** Apply one delta so the live engine takes side `side` ('a' | 'b') of the diff. */
export function applyDelta(engine, d, side = 'a') {
  const pick = side === 'a' ? d.a : d.b;
  switch (d.kind) {
    case 'bpm': engine.setBpm(pick); break;
    case 'loop': engine.setLoopRegion(pick.s, pick.e, pick.on); break;
    case 'track-field': {
      const t = engine.tracks.find((x) => x.id === d.trackId);
      if (t) { t[d.field] = pick; engine._applyTrackGain?.(t); engine._updateSoloState?.(); }
      break;
    }
    case 'track-eq': {
      const t = engine.tracks.find((x) => x.id === d.trackId);
      if (t) engine.setTrackEq(t.id, d.band, pick);
      break;
    }
    case 'track-added': case 'track-removed': {
      const exists = engine.tracks.find((x) => x.id === d.track.id);
      const want = (d.kind === 'track-added') === (side === 'b');
      if (want && !exists) {
        const t = engine.addTrack(d.track.type, d.track.name);
        t.id = d.track.id;
        Object.assign(t, { volume: d.track.volume ?? 0.8, pan: d.track.pan ?? 0, muted: !!d.track.muted, solo: !!d.track.solo });
        (d.track.clips || []).forEach((c) => engine.addClip(t.id, withBuffer(engine, c)));
      } else if (!want && exists) engine.removeTrack(exists.id);
      break;
    }
    case 'clip-added': case 'clip-removed': {
      const t = engine.tracks.find((x) => x.id === d.trackId);
      if (!t) break;
      const want = (d.kind === 'clip-added') === (side === 'b');
      const live = t.clips.find((c) => c.id === d.clip.id) || t.clips.find((c) => c.name === d.clip.name && r(c.startBeat) === r(d.clip.startBeat));
      if (want && !live) engine.addClip(t.id, withBuffer(engine, d.clip));
      else if (!want && live) engine.removeClip(t.id, live.id);
      break;
    }
    case 'clip-moved': {
      const t = engine.tracks.find((x) => x.id === d.trackId);
      const other = side === 'a' ? d.b : d.a;
      const live = t?.clips.find((c) => c.id === other.id) || t?.clips.find((c) => c.name === d.clipName && r(c.startBeat) === r(other.startBeat));
      if (live) live.startBeat = pick.startBeat;
      break;
    }
    default: break;
  }
}

function withBuffer(engine, c) {
  const buf = engine._bufCache?.get(c.id);
  return buf && !c.recipe && !c.notes?.length ? { ...c, buffer: buf } : { ...c };
}

/** Plain-language summary. */
export function explainDiff(deltas, { aLabel = 'A', bLabel = 'B' } = {}) {
  if (!deltas.length) return `No differences between ${aLabel} and ${bLabel}.`;
  const by = (k) => deltas.filter((d) => d.kind === k);
  const parts = [];
  const bpm = by('bpm')[0];
  if (bpm) parts.push(`the tempo went ${bpm.b > bpm.a ? 'up' : 'down'} from ${r(bpm.a, 1)} to ${r(bpm.b, 1)} BPM`);
  const loop = by('loop')[0];
  if (loop) parts.push(`the loop moved to bars ${r(loop.b.s) + 1}–${r(loop.b.e)}${loop.b.on ? '' : ' (looping off)'}`);
  const ta = by('track-added');
  const tr = by('track-removed');
  if (ta.length) parts.push(`${ta.length} track${ta.length > 1 ? 's were' : ' was'} added (${ta.map((d) => d.track.name).join(', ')})`);
  if (tr.length) parts.push(`${tr.length} track${tr.length > 1 ? 's were' : ' was'} removed (${tr.map((d) => d.track.name).join(', ')})`);
  const ca = by('clip-added');
  const cr = by('clip-removed');
  const cm = by('clip-moved');
  if (ca.length) parts.push(`${ca.length} clip${ca.length > 1 ? 's' : ''} appeared${summTracks(ca)}`);
  if (cr.length) parts.push(`${cr.length} clip${cr.length > 1 ? 's' : ''} disappeared${summTracks(cr)}`);
  if (cm.length) parts.push(`${cm.length} clip${cm.length > 1 ? 's' : ''} moved`);
  const vol = by('track-field').filter((d) => d.field === 'volume');
  if (vol.length) parts.push(`levels changed on ${vol.map((d) => `${d.label.split(' volume')[0]} (${db(d.b) - db(d.a) > 0 ? '+' : ''}${r(db(d.b) - db(d.a), 1)} dB)`).join(', ')}`);
  const ms = by('track-field').filter((d) => d.field === 'muted' || d.field === 'solo');
  if (ms.length) parts.push(ms.map((d) => d.label).join(', '));
  const eq = by('track-eq');
  if (eq.length) parts.push(`EQ was reshaped on ${[...new Set(eq.map((d) => d.label.split(' EQ')[0]))].join(', ')}`);
  const nm = by('track-field').filter((d) => d.field === 'name');
  if (nm.length) parts.push(nm.map((d) => d.label.toLowerCase()).join(', '));
  return `From ${aLabel} to ${bLabel}: ${parts.join('; ')}.`;
}

function summTracks(ds) {
  const m = {};
  ds.forEach((d) => { const n = d.label.split(':')[0]; m[n] = (m[n] || 0) + 1; });
  return ` (${Object.entries(m).map(([k, v]) => `${v} on ${k}`).join(', ')})`;
}
