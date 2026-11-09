/**
 * Shared helpers for God Mode feature modules (DEMO Web Audio paths).
 */

export function ensureNamedTrack(engine, pred, name, type = 'audio') {
  while (engine.tracks.length < 4) {
    engine.addTrack(engine.tracks.length >= 2 ? 'midi' : 'audio');
  }
  let t = engine.tracks.find(pred);
  if (!t) t = engine.addTrack(type, name);
  else if (name && /^Track\s/i.test(t.name)) t.name = name;
  return t;
}

export function selectedTrack(ctx) {
  const engine = ctx?.engine;
  if (!engine) return null;
  const id = ctx.getSelectedTrackId?.();
  return (id && engine.tracks.find((t) => t.id === id)) || engine.tracks[0] || null;
}

export function lastClipOnTrack(track) {
  if (!track?.clips?.length) return null;
  return [...track.clips].sort(
    (a, b) => ((a.startBeat || 0) + (a.durationBeats || 0)) - ((b.startBeat || 0) + (b.durationBeats || 0)),
  ).pop();
}

export function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export function chipRow(items, { name = 'chip', multi = false } = {}) {
  return `<div class="sx-god-chips" role="group" data-chip-group="${name}">${items.map((it, i) => {
    const id = typeof it === 'string' ? it : it.id;
    const label = typeof it === 'string' ? it : it.label;
    return `<button type="button" class="btn sm ghost sx-god-chip${i === 0 ? ' active' : ''}" data-chip="${id}" aria-pressed="${i === 0 ? 'true' : 'false'}">${label}</button>`;
  }).join('')}</div>`;
}

export function bindChips(root, groupSel, onChange) {
  const group = root.querySelector(groupSel);
  if (!group) return () => null;
  let value = group.querySelector('.sx-god-chip.active')?.dataset.chip || null;
  group.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-chip]');
    if (!btn) return;
    group.querySelectorAll('[data-chip]').forEach((b) => {
      const on = b === btn;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    value = btn.dataset.chip;
    onChange?.(value);
  });
  return () => value;
}

export function cloneNotes(notes, mutator) {
  if (!notes?.length) return null;
  return notes.map((n, i) => {
    const c = { ...n };
    mutator?.(c, i);
    return c;
  });
}
