/**
 * Track role helpers (drums / bass / vox / keys / fx) — names, clip meta, or the
 * Stem Role Classifier tag (track.role). Heuristic, local.
 */
export const ROLE_RX = {
  drums: /drum|beat|perc|kick|snare|hat|shaker|conga|groove|break|response/i,
  bass: /bass|808|sub|log ?drum/i,
  vox: /vox|vocal|voice|sing|rap|acapella|choir|persona/i,
  keys: /key|piano|chord|pad|synth|lead|melod|harmon|arp|string|guitar/i,
  fx: /fx|riser|sweep|transition|noise|impact|ambient/i,
};
export const ROLES = ['drums', 'bass', 'vox', 'keys', 'fx'];
export const ROLE_COLORS = { drums: '#F5C518', bass: '#B794F4', vox: '#F687B3', keys: '#63B3ED', fx: '#68D391', other: '#A0AEC0' };

export function roleOfTrack(track) {
  if (!track) return 'other';
  if (track.role && ROLES.includes(track.role)) return track.role;
  for (const r of ROLES) if (ROLE_RX[r].test(track.name || '')) return r;
  const metaRole = (track.clips || []).map((c) => c.meta?.role).find(Boolean);
  if (metaRole) {
    if (ROLES.includes(metaRole)) return metaRole;
    if (/kick|snare|hat|drum|perc/.test(metaRole)) return 'drums';
    if (/bass/.test(metaRole)) return 'bass';
    if (/lead|chord|key/.test(metaRole)) return 'keys';
  }
  return 'other';
}

export function findRoleTrack(engine, role) {
  return (engine?.tracks || []).find((t) => roleOfTrack(t) === role) || null;
}

export function tracksByRole(engine, role) {
  return (engine?.tracks || []).filter((t) => roleOfTrack(t) === role);
}

/** Word in user text → role. */
export function roleFromWord(w) {
  const s = String(w || '').toLowerCase();
  if (/drum|beat|kick|snare|hat|perc/.test(s)) return 'drums';
  if (/bass|808|sub/.test(s)) return 'bass';
  if (/vox|vocal|voice|singer|rap/.test(s)) return 'vox';
  if (/key|piano|chord|pad|synth|lead|melod/.test(s)) return 'keys';
  if (/fx|riser|sweep/.test(s)) return 'fx';
  return null;
}
