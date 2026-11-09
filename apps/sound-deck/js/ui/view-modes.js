/**
 * View modes — Pattern | Piano | Song switch inside the timeline area.
 * Song = existing arrangement timeline (default). Pattern / Piano panes overlay the
 * timeline-wrap content; the arrangement DOM stays mounted so switching back is instant.
 */
export const VIEW_MODES = [
  { id: 'pattern', label: 'Pattern', title: 'Channel rack — instrument rows × 16 steps' },
  { id: 'piano', label: 'Piano', title: 'Piano roll — notes × beats for the selected / a new clip' },
  { id: 'song', label: 'Song', title: 'Arrangement timeline' },
];

export function mountViewModes(root, { onChange, bar: staticBar } = {}) {
  let mode = 'song';
  // Prefer the static bar from index.html (detached before the timeline mounted); else build one.
  const bar = staticBar || document.createElement('div');
  bar.className = 'view-modes';
  bar.setAttribute('role', 'tablist');
  bar.setAttribute('aria-label', 'View mode');
  if (!staticBar || !bar.querySelector('[data-view-hint]')) bar.innerHTML = `
    <div class="view-seg">
      ${VIEW_MODES.map((m) => `<button type="button" role="tab" data-view-mode="${m.id}" title="${m.title}" aria-selected="${m.id === mode}" class="${m.id === mode ? 'active' : ''}">${m.label}</button>`).join('')}
    </div>
    <span class="view-modes-hint" data-view-hint>Song · arrange clips on tracks</span>
  `;
  root.prepend(bar);
  root.classList.add('has-view-modes');
  root.dataset.view = mode;

  const panes = {};
  ['pattern', 'piano'].forEach((id) => {
    const el = document.createElement('section');
    el.className = `view-pane view-pane--${id}`;
    el.dataset.viewPane = id;
    el.setAttribute('aria-label', id === 'pattern' ? 'Pattern channel rack' : 'Piano roll');
    el.hidden = true;
    root.appendChild(el);
    panes[id] = el;
  });

  const hints = {
    song: 'Song · Pattern picker → Place Pattern (or drag a chip onto a lane) · double-click a pattern clip to edit',
    pattern: 'Pattern · build a 1-bar groove, then Place as clip',
    piano: 'Piano · click to add notes, then Write to track',
  };

  function setMode(next) {
    if (!VIEW_MODES.some((m) => m.id === next) || next === mode) return mode;
    const prev = mode;
    mode = next;
    root.dataset.view = mode;
    bar.querySelectorAll('[data-view-mode]').forEach((b) => {
      const on = b.dataset.viewMode === mode;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    Object.entries(panes).forEach(([id, el]) => { el.hidden = id !== mode; });
    bar.querySelector('[data-view-hint]').textContent = hints[mode];
    root.scrollTop = 0;
    onChange?.(mode, prev);
    return mode;
  }

  bar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-view-mode]');
    if (b) setMode(b.dataset.viewMode);
  });

  return { setMode, getMode: () => mode, panes };
}
