/**
 * Resizable workspace, fullscreen targets, focus mode.
 * Lib / AI / timeline never collapse to 0.
 * Mixer MAY collapse to 0 via its blue horizontal strip control.
 */
const KEY = 'mm-sound-deck-layout';
const MIXER_KEY = 'mm-sound-deck-mixer';
const MIN = { lib: 180, ai: 260, timeline: 360, mixer: 300 }; // lib/ai/timeline never 0
const MIXER_OPEN_MIN = 56; // continuous partial mixer heights (collapse below threshold)
const MIXER_COLLAPSE_THRESHOLD = 48;
const MIXER_DEFAULT_H = 340;

export function toggleFullscreen(el) {
  if (!el) return false;
  const fs = document.fullscreenElement || document.webkitFullscreenElement;
  if (fs === el) {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (exit) exit.call(document);
    return true;
  }
  const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
  if (!req) return false;
  const result = req.call(el);
  if (result && typeof result.catch === 'function') result.catch(() => {});
  return true;
}

function clamp(n, min, max) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, Math.round(v)));
}

function loadMixerCollapse() {
  try {
    const raw = JSON.parse(localStorage.getItem(MIXER_KEY) || 'null');
    if (raw && typeof raw === 'object') {
      return {
        collapsed: !!raw.collapsed,
        height: clamp(raw.height ?? MIXER_DEFAULT_H, MIXER_OPEN_MIN, 900),
      };
    }
  } catch (_) {}
  // Migrate height from layout blob if present
  try {
    const layout = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (layout && typeof layout.mixer === 'number') {
      return { collapsed: false, height: clamp(layout.mixer, MIXER_OPEN_MIN, 900) };
    }
  } catch (_) {}
  return { collapsed: false, height: MIXER_DEFAULT_H };
}

function saveMixerCollapse(state) {
  try {
    localStorage.setItem(MIXER_KEY, JSON.stringify({
      collapsed: !!state.collapsed,
      height: clamp(state.height, MIXER_OPEN_MIN, 900),
    }));
  } catch (_) {}
}

/** Wrap mixer splitter + mixer into one collapsible strip unit. */
function ensureMixerWrap(app, mixer, split) {
  if (!mixer || !split) return { wrap: null, reopen: null };
  let wrap = mixer.closest('.sx-mixer-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'sx-mixer-wrap';
    wrap.setAttribute('data-sx-mixer-wrap', '');
    const parent = mixer.parentNode;
    parent.insertBefore(wrap, split);
    wrap.appendChild(split);
    wrap.appendChild(mixer);
  }
  let reopen = wrap.querySelector('[data-sx-mixer-reopen]');
  if (!reopen) {
    reopen = document.createElement('button');
    reopen.type = 'button';
    reopen.className = 'sx-mixer-reopen';
    reopen.setAttribute('data-sx-mixer-reopen', '');
    reopen.hidden = true;
    reopen.textContent = 'Show Mixer';
    wrap.appendChild(reopen);
  }
  split.classList.add('sx-mixer-split');
  split.title = 'Drag to resize · double-click to collapse/expand Mixer';
  return { wrap, reopen };
}

export function mountLayout({ app, workspace, lib, ai, mixer, history, toast }) {
  const splits = {
    lib: workspace.querySelector('[data-split="lib"]'),
    ai: workspace.querySelector('[data-split="ai"]'),
    mixer: app.querySelector('[data-split="mixer"]'),
  };

  const { wrap: mixerWrap, reopen: mixerReopen } = ensureMixerWrap(app, mixer, splits.mixer);
  let mixerState = loadMixerCollapse();
  let lastMixerReopenAt = 0;

  function narrow() {
    return window.matchMedia('(max-width: 860px)').matches;
  }

  function read() {
    return {
      lib: Math.round(lib.getBoundingClientRect().width),
      ai: Math.round(ai.getBoundingClientRect().width),
      mixer: mixerState.collapsed
        ? mixerState.height
        : Math.round(mixer.getBoundingClientRect().height) || mixerState.height,
    };
  }

  function clampLayout(layout) {
    const ws = workspace.getBoundingClientRect().width || app.clientWidth || window.innerWidth;
    const maxLib = Math.max(MIN.lib, Math.round(ws * 0.40));
    const maxAi = Math.max(MIN.ai, Math.round(ws * 0.75));
    let libW = clamp(layout.lib, MIN.lib, maxLib);
    let aiW = clamp(layout.ai, MIN.ai, maxAi);
    const maxMixer = Math.max(MIXER_OPEN_MIN, Math.round(app.clientHeight * 0.55));
    let mixerH = clamp(Math.max(layout.mixer || 0, MIXER_OPEN_MIN), MIXER_OPEN_MIN, maxMixer);
    if (!narrow()) {
      const splitW = 12;
      let timeline = ws - libW - aiW - splitW;
      if (timeline < MIN.timeline) {
        let overflow = MIN.timeline - timeline;
        const libRoom = libW - MIN.lib;
        const aiRoom = aiW - MIN.ai;
        const takeLib = Math.min(libRoom, overflow);
        libW -= takeLib;
        overflow -= takeLib;
        const takeAi = Math.min(aiRoom, overflow);
        aiW -= takeAi;
      }
    }
    return { lib: libW, ai: aiW, mixer: mixerH };
  }

  function applyMixerVisual() {
    if (!mixerWrap || !splits.mixer) return;
    mixerWrap.classList.toggle('is-collapsed', mixerState.collapsed);
    mixer.hidden = mixerState.collapsed;
    if (mixerReopen) mixerReopen.hidden = !mixerState.collapsed;
    splits.mixer.setAttribute('aria-expanded', mixerState.collapsed ? 'false' : 'true');
    splits.mixer.setAttribute(
      'aria-label',
      mixerState.collapsed ? 'Show mixer' : 'Resize or collapse mixer'
    );
    const root = document.documentElement;
    // Legacy CSS pins .mixer height with !important — beat it via inline !important + local --mixer-h
    if (mixerState.collapsed) {
      root.style.setProperty('--mixer-h', '0px');
      mixer.style.setProperty('--mixer-h', '0px');
      mixer.style.setProperty('height', '0px', 'important');
      mixer.style.setProperty('flex-basis', '0px', 'important');
      mixer.style.setProperty('flex', '0 0 0px', 'important');
      mixer.style.setProperty('min-height', '0px', 'important');
      mixer.style.setProperty('max-height', '0px', 'important');
    } else {
      const h = clamp(mixerState.height, MIXER_OPEN_MIN, Math.max(MIXER_OPEN_MIN, Math.round(app.clientHeight * 0.55)));
      root.style.setProperty('--mixer-h', h + 'px');
      mixer.style.setProperty('--mixer-h', h + 'px');
      mixer.style.setProperty('height', h + 'px', 'important');
      mixer.style.setProperty('flex-basis', h + 'px', 'important');
      mixer.style.setProperty('flex', '0 0 ' + h + 'px', 'important');
      mixer.style.setProperty('min-height', '0px', 'important');
      mixer.style.setProperty('max-height', 'none', 'important');
    }
  }

  function apply(layout, persist = true) {
    const next = clampLayout(layout);
    const root = document.documentElement;
    lib.style.width = '';
    lib.style.flexBasis = '';
    ai.style.width = '';
    ai.style.flexBasis = '';
    if (!narrow()) {
      root.style.setProperty('--lib-w', next.lib + 'px');
      root.style.setProperty('--ai-w', next.ai + 'px');
    }
    if (!mixerState.collapsed) {
      mixerState = { ...mixerState, height: next.mixer };
      applyMixerVisual();
    } else {
      // Keep saved expanded height updated if layout still carries a mixer value
      if (typeof layout.mixer === 'number' && layout.mixer >= MIXER_OPEN_MIN) {
        mixerState = { ...mixerState, height: clamp(layout.mixer, MIXER_OPEN_MIN, 900) };
      }
      applyMixerVisual();
    }
    if (persist) {
      try {
        localStorage.setItem(KEY, JSON.stringify({
          lib: next.lib,
          ai: next.ai,
          mixer: mixerState.height,
        }));
      } catch (_) {}
      saveMixerCollapse(mixerState);
    }
    return { ...next, mixer: mixerState.height };
  }

  function setMixerCollapsed(collapsed, note, toast) {
    if (!!collapsed === mixerState.collapsed) return;
    mixerState = { ...mixerState, collapsed: !!collapsed };
    applyMixerVisual();
    saveMixerCollapse(mixerState);
    try {
      const layout = JSON.parse(localStorage.getItem(KEY) || '{}');
      layout.mixer = mixerState.height;
      localStorage.setItem(KEY, JSON.stringify(layout));
    } catch (_) {}
    if (note && typeof toast === 'function') toast(note);
  }

  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && typeof saved.lib === 'number') {
      if (typeof saved.mixer === 'number') {
        mixerState = { ...mixerState, height: clamp(saved.mixer, MIXER_OPEN_MIN, 900) };
      }
      apply(saved, false);
    } else {
      applyMixerVisual();
    }
  } catch (_) {
    applyMixerVisual();
  }
  // Re-apply collapse flag after initial layout apply
  applyMixerVisual();
  saveMixerCollapse(mixerState);

  function commitGesture(before, after) {
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    history.push({
      label: 'Undid panel layout',
      undo: () => apply(before, true),
    });
    try { localStorage.setItem(KEY, JSON.stringify(after)); } catch (_) {}
  }

  function bindDrag(el, which) {
    if (!el) return;
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || narrow()) return;
      if (e.target !== el && !el.contains(e.target)) return;
      e.preventDefault();
      const before = read();
      const startX = e.clientX;
      const startY = e.clientY;
      const start = which === 'mixer' ? before.mixer : before[which];
      el.classList.add('is-dragging');
      function move(ev) {
        const next = { ...read() };
        if (which === 'lib') next.lib = start + (ev.clientX - startX);
        else if (which === 'ai') next.ai = start - (ev.clientX - startX);
        else next.mixer = start - (ev.clientY - startY);
        apply(next, false);
      }
      function up() {
        el.classList.remove('is-dragging');
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        commitGesture(before, read());
      }
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });

    el.addEventListener('keydown', (e) => {
      const horizontal = which !== 'mixer';
      const keys = horizontal ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
      if (!keys.includes(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      const before = read();
      const sign = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : -1;
      const delta = 16 * sign;
      const next = { ...before };
      if (which === 'lib') next.lib += delta;
      else if (which === 'ai') next.ai -= delta;
      else next.mixer -= delta;
      const applied = apply(next, true);
      commitGesture(before, applied);
    });
  }

  bindDrag(splits.lib, 'lib');
  bindDrag(splits.ai, 'ai');
  // Mixer uses dedicated collapse-aware handlers below (not bindDrag)

  function bindMixerCollapse(toast) {
    const el = splits.mixer;
    if (!el || !mixerWrap) return;

    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (e.target !== el && !el.contains(e.target)) return;
      // Allow on narrow too — collapse/reopen is useful on mobile
      e.preventDefault();
      let dragMoved = false;
      const startY = e.clientY;
      const startH = mixerState.height;
      el.classList.add('is-dragging');

      if (mixerState.collapsed) {
        function move(ev) {
          if (Math.abs(ev.clientY - startY) > 4) dragMoved = true;
        }
        function up(ev) {
          el.classList.remove('is-dragging');
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          const dy = (ev?.clientY ?? startY) - startY;
          if (!dragMoved || dy < -12) {
            lastMixerReopenAt = Date.now();
            setMixerCollapsed(false, 'Mixer shown', toast);
          }
        }
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        return;
      }

      const before = read();
      function move(ev) {
        const dy = ev.clientY - startY;
        if (Math.abs(dy) > 3) dragMoved = true;
        const nextH = startH - dy;
        const maxMixer = Math.max(MIXER_OPEN_MIN, Math.round(app.clientHeight * 0.55));
        // Below open-floor: live-squish toward collapse (continuous partial → closed)
        if (nextH < MIXER_OPEN_MIN) {
          const nh = Math.max(0, nextH);
          mixer.style.setProperty('--mixer-h', nh + 'px');
          mixer.style.setProperty('height', nh + 'px', 'important');
          mixer.style.setProperty('flex-basis', nh + 'px', 'important');
          mixer.style.setProperty('flex', '0 0 ' + nh + 'px', 'important');
          mixer.style.setProperty('min-height', '0px', 'important');
          mixer.style.setProperty('max-height', 'none', 'important');
          document.documentElement.style.setProperty('--mixer-h', nh + 'px');
          return;
        }
        const h = clamp(nextH, MIXER_OPEN_MIN, maxMixer);
        mixerState = { ...mixerState, height: h, collapsed: false };
        applyMixerVisual();
      }
      function up(ev) {
        el.classList.remove('is-dragging');
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        const dy = (ev?.clientY ?? startY) - startY;
        const nextH = startH - dy;
        if (nextH < MIXER_COLLAPSE_THRESHOLD) {
          // Keep last open height so reopen restores prior size
          mixerState = { ...mixerState, height: startH };
          setMixerCollapsed(true, 'Mixer collapsed', toast);
          return;
        }
        const maxMixer = Math.max(MIXER_OPEN_MIN, Math.round(app.clientHeight * 0.55));
        mixerState = { ...mixerState, height: clamp(nextH, MIXER_OPEN_MIN, maxMixer), collapsed: false };
        applyMixerVisual();
        saveMixerCollapse(mixerState);
        commitGesture(before, read());
        try {
          const layout = JSON.parse(localStorage.getItem(KEY) || '{}');
          layout.mixer = mixerState.height;
          localStorage.setItem(KEY, JSON.stringify(layout));
        } catch (_) {}
      }
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });

    el.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (Date.now() - lastMixerReopenAt < 600) return;
      const willCollapse = !mixerState.collapsed;
      setMixerCollapsed(
        willCollapse,
        willCollapse ? 'Mixer collapsed' : 'Mixer shown',
        toast
      );
    });

    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const willCollapse = !mixerState.collapsed;
        setMixerCollapsed(
          willCollapse,
          willCollapse ? 'Mixer collapsed' : 'Mixer shown',
          toast
        );
        return;
      }
      if (mixerState.collapsed) return;
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      e.stopPropagation();
      const before = read();
      const delta = e.key === 'ArrowUp' ? 16 : -16;
      if (e.key === 'ArrowDown' && mixerState.height + delta < MIXER_COLLAPSE_THRESHOLD) {
        setMixerCollapsed(true, 'Mixer collapsed', toast);
        return;
      }
      const maxMixer = Math.max(MIXER_OPEN_MIN, Math.round(app.clientHeight * 0.55));
      mixerState = {
        ...mixerState,
        height: clamp(mixerState.height + delta, MIXER_OPEN_MIN, maxMixer),
      };
      applyMixerVisual();
      saveMixerCollapse(mixerState);
      commitGesture(before, read());
    });

    mixerReopen?.addEventListener('click', (e) => {
      e.preventDefault();
      lastMixerReopenAt = Date.now();
      setMixerCollapsed(false, 'Mixer shown', toast);
    });
  }

  bindMixerCollapse(toast);

  window.addEventListener('resize', () => {
    if (narrow()) return;
    if (mixerState.collapsed) {
      const cur = read();
      apply({ ...cur, mixer: mixerState.height }, false);
      return;
    }
    apply(read(), false);
  });

  return {
    apply,
    read,
    setMixerCollapsed: (c, note) => setMixerCollapsed(c, note, toast),
    getMixerState: () => ({ ...mixerState }),
  };
}
