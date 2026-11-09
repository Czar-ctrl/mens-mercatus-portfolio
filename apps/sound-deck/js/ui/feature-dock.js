/**
 * SoundX feature dock — Ghost + Session versions.
 * Horizontal blue-on-hover splitter: resize height, collapse to 0, reopen.
 * Persists in localStorage. Does not touch layout.js mixer/lib/ai mins.
 */
const KEY = 'mm-sound-deck-feature-dock';
const DEFAULT_H = 180;
const MIN_H = 56; // open floor — continuous partial sizes above collapse threshold
const MAX_H = 360;
const COLLAPSE_THRESHOLD = 48;

function clamp(n, min, max) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, Math.round(v)));
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw || typeof raw !== 'object') return { collapsed: false, height: DEFAULT_H };
    return {
      collapsed: !!raw.collapsed,
      height: clamp(raw.height ?? DEFAULT_H, MIN_H, MAX_H),
    };
  } catch (_) {
    return { collapsed: false, height: DEFAULT_H };
  }
}

function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      collapsed: !!state.collapsed,
      height: clamp(state.height, MIN_H, MAX_H),
    }));
  } catch (_) {}
}

/**
 * @param {HTMLElement} wrap — .sx-feature-dock-wrap
 * @param {{ toast?: (msg: string) => void }} [opts]
 */
export function mountFeatureDockCollapse(wrap, opts = {}) {
  if (!wrap) return null;
  const body = wrap.querySelector('[data-sx-feature-dock], .sx-feature-dock');
  const split = wrap.querySelector('[data-split="feature-dock"]');
  const reopen = wrap.querySelector('[data-sx-dock-reopen]');
  if (!body || !split) return null;

  let state = load();
  let dragMoved = false;
  let lastReopenAt = 0;

  function apply(persist = true) {
    wrap.classList.toggle('is-collapsed', state.collapsed);
    body.hidden = state.collapsed;
    if (reopen) reopen.hidden = !state.collapsed;
    split.setAttribute('aria-expanded', state.collapsed ? 'false' : 'true');
    split.setAttribute(
      'aria-label',
      state.collapsed
        ? 'Show Ghost and Session versions'
        : 'Resize or collapse Ghost and Session versions'
    );
    if (state.collapsed) {
      wrap.style.removeProperty('--sx-dock-h');
      body.style.height = '';
      body.style.maxHeight = '';
    } else {
      const h = clamp(state.height, MIN_H, MAX_H);
      wrap.style.setProperty('--sx-dock-h', h + 'px');
      body.style.height = h + 'px';
      body.style.maxHeight = h + 'px';
    }
    if (persist) save(state);
  }

  function setCollapsed(collapsed, note) {
    if (collapsed === state.collapsed) return;
    state = { ...state, collapsed: !!collapsed };
    apply(true);
    if (note && opts.toast) opts.toast(note);
  }

  function toggle() {
    const willCollapse = !state.collapsed;
    setCollapsed(
      willCollapse,
      willCollapse ? 'Ghost · Versions hidden' : 'Ghost · Versions shown'
    );
  }

  apply(false);

  split.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (e.target !== split && !split.contains(e.target)) return;
    e.preventDefault();
    dragMoved = false;

    if (state.collapsed) {
      // Click collapsed bar → reopen (pointerup if little movement)
      const startY = e.clientY;
      split.classList.add('is-dragging');
      function move(ev) {
        if (Math.abs(ev.clientY - startY) > 4) dragMoved = true;
      }
      function up(ev) {
        split.classList.remove('is-dragging');
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        const dy = (ev?.clientY ?? startY) - startY;
        // Click (no drag) or drag upward → reopen
        if (!dragMoved || dy < -12) {
          lastReopenAt = Date.now();
          setCollapsed(false, 'Ghost · Versions shown');
        }
      }
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      return;
    }

    const startY = e.clientY;
    const startH = clamp(state.height, MIN_H, MAX_H);
    split.classList.add('is-dragging');
    try { split.setPointerCapture?.(e.pointerId); } catch (_) {}

    function move(ev) {
      const dy = ev.clientY - startY;
      if (Math.abs(dy) > 3) dragMoved = true;
      // Continuous resize while open; below threshold → collapse preview
      const nextH = startH - dy;
      if (nextH < COLLAPSE_THRESHOLD) {
        body.style.height = Math.max(0, nextH) + 'px';
        body.style.maxHeight = Math.max(0, nextH) + 'px';
        wrap.style.setProperty('--sx-dock-h', Math.max(0, nextH) + 'px');
        return;
      }
      const h = clamp(nextH, MIN_H, MAX_H);
      state = { ...state, height: h, collapsed: false };
      wrap.style.setProperty('--sx-dock-h', h + 'px');
      body.style.height = h + 'px';
      body.style.maxHeight = h + 'px';
    }

    function up(ev) {
      split.classList.remove('is-dragging');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      try { split.releasePointerCapture?.(e.pointerId); } catch (_) {}
      const dy = (ev?.clientY ?? startY) - startY;
      const nextH = startH - dy;
      if (nextH < COLLAPSE_THRESHOLD) {
        // Keep last open height so reopen restores prior size
        state = { ...state, height: startH };
        setCollapsed(true, 'Ghost · Versions collapsed');
        return;
      }
      state = { ...state, height: clamp(nextH, MIN_H, MAX_H), collapsed: false };
      apply(true);
    }

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });

  split.addEventListener('dblclick', (e) => {
    e.preventDefault();
    e.stopPropagation();
    // First click of the double-click already reopened a collapsed dock — keep it open
    if (Date.now() - lastReopenAt < 600) return;
    toggle();
  });

  split.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
      return;
    }
    if (state.collapsed) return;
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    e.stopPropagation();
    const delta = e.key === 'ArrowUp' ? 16 : -16;
    const next = clamp(state.height + delta, MIN_H, MAX_H);
    if (e.key === 'ArrowDown' && state.height + delta < COLLAPSE_THRESHOLD) {
      setCollapsed(true, 'Ghost · Versions collapsed');
      return;
    }
    state = { ...state, height: next };
    apply(true);
  });

  reopen?.addEventListener('click', (e) => {
    e.preventDefault();
    lastReopenAt = Date.now();
    setCollapsed(false, 'Ghost · Versions shown');
  });

  return {
    getState: () => ({ ...state }),
    setCollapsed,
    toggle,
  };
}

/**
 * Build wrap + splitter + dock body and insert before `beforeEl` (mixer).
 * Returns { wrap, dock } for mounting ghost/versions into dock.
 */
export function createFeatureDock(beforeEl, parentFallback) {
  const wrap = document.createElement('div');
  wrap.className = 'sx-feature-dock-wrap';
  wrap.setAttribute('data-sx-feature-dock-wrap', '');

  const split = document.createElement('div');
  split.className = 'splitter splitter-row sx-feature-dock-split';
  split.setAttribute('data-split', 'feature-dock');
  split.setAttribute('role', 'separator');
  split.setAttribute('aria-orientation', 'horizontal');
  split.setAttribute('aria-label', 'Resize or collapse Ghost and Session versions');
  split.setAttribute('aria-expanded', 'true');
  split.setAttribute('tabindex', '0');
  split.title = 'Drag to resize · double-click to collapse/expand Ghost · Versions';

  const dock = document.createElement('aside');
  dock.className = 'sx-feature-dock';
  dock.setAttribute('data-sx-feature-dock', '');
  dock.setAttribute('aria-label', 'SoundX feature dock');
  dock.innerHTML = '<div data-sx-dock-ghost></div><div data-sx-dock-versions></div>';

  const reopen = document.createElement('button');
  reopen.type = 'button';
  reopen.className = 'sx-feature-dock-reopen';
  reopen.setAttribute('data-sx-dock-reopen', '');
  reopen.hidden = true;
  reopen.textContent = 'Show Ghost · Versions';

  wrap.appendChild(split);
  wrap.appendChild(dock);
  wrap.appendChild(reopen);

  if (beforeEl?.parentNode) beforeEl.parentNode.insertBefore(wrap, beforeEl);
  else parentFallback?.appendChild(wrap);

  return { wrap, dock, split, reopen };
}
