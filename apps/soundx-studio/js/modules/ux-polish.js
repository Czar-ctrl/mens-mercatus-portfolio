/**
 * High-end cursor polish + hover tooltips.
 * Cursor glow overlay on desktop (no root/app transforms); tooltips persist in localStorage.
 * Coarse pointers: long-press tooltips or skip.
 */
import { mountThemeSwitcher } from './themes.js?v=20261007l-sxs20261020b';

const TIP_LS = 'mm-sound-deck-tooltips';
const POLISH_LS = 'mm-sound-deck-ux-polish';

const DEFAULT_TIPS = [
  { sel: '[data-action="play"]', tip: 'Play / Pause the arrangement (Space)' },
  { sel: '[data-action="stop"]', tip: 'Stop and return playhead to start (S)' },
  { sel: '[data-action="demo"]', tip: 'Load the built-in drums · bass · keys · pad demo' },
  { sel: '[data-action="save"]', tip: 'Save project JSON to this browser (localStorage)' },
  { sel: '[data-action="load"]', tip: 'Load the last project saved in this browser' },
  { sel: '[data-action="export"]', tip: 'Export menu — project JSON or audio (WAV / FLAC / MP3 / Ogg)' },
  { sel: '[data-action="undo"]', tip: 'Undo last layout or mix change (Ctrl+Z)' },
  { sel: '[data-action="focus"]', tip: 'Focus mode — hide side panels for arranging' },
  { sel: '[data-field="bpm"]', tip: 'Session tempo in beats per minute' },
  { sel: '[data-field="metro"]', tip: 'Metronome click on each beat' },
  { sel: '[data-field="loop"]', tip: 'Loop the gold region on the timeline ruler' },
  { sel: '[data-tab="aiproducer"]', tip: 'Local rule-based AI Producer chat' },
  { sel: '[data-tab="stems"]', tip: 'Stem Split + Stem DNA analysis' },
  { sel: '[data-tab="loops"]', tip: 'Live Loops-style clip grid' },
  { sel: '[data-tab="drummer"]', tip: 'Virtual Drummer — DEMO AI patterns' },
  { sel: '[data-tab="pedals"]', tip: 'Pedalboard FX chain on master / tracks' },
  { sel: '[data-tab="voice"]', tip: 'Voice Assist · Mercatus Bot' },
  { sel: '[data-ghost-panel]', tip: 'Ghost layer — 30s tape-echo style buffer' },
  { sel: '[data-versions-panel]', tip: 'Session version snapshots — roll back changes' },
  { sel: '[data-copro-chip]', tip: 'AI co-producer suggestion — dismiss or apply hint' },
];

function readBool(key, fallback = true) {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return v === '1' || v === 'true';
  } catch (_) {
    return fallback;
  }
}

function writeBool(key, on) {
  try { localStorage.setItem(key, on ? '1' : '0'); } catch (_) {}
}

export function mountUxPolish(deck, toast) {
  let tipsOn = readBool(TIP_LS, true);
  let polishOn = readBool(POLISH_LS, true);
  const coarse = window.matchMedia('(pointer: coarse)').matches
    || window.matchMedia('(hover: none)').matches;

  // Cursor glow layer
  let glow = document.querySelector('[data-cursor-glow]');
  if (!glow) {
    glow = document.createElement('div');
    glow.className = 'sx-cursor-glow';
    glow.setAttribute('data-cursor-glow', '');
    glow.setAttribute('aria-hidden', 'true');
    document.body.appendChild(glow);
  }

  function syncPolish() {
    document.documentElement.classList.toggle('sx-polish-off', !polishOn);
    document.documentElement.classList.toggle('sx-polish-on', polishOn && !coarse);
    glow.hidden = !polishOn || coarse;
  }
  syncPolish();

  // Glow only: never set transforms / CSS vars on .app or body (that caused whole-UI shake on tap).
  // Coalesce pointermove to one rAF; update the fixed overlay via translate3d vars.
  if (!coarse) {
    let raf = 0;
    let mx = 0;
    let my = 0;
    // Clear any leftover parallax vars from older builds
    deck?.style.removeProperty('--sx-parallax-x');
    deck?.style.removeProperty('--sx-parallax-y');
    document.documentElement.style.removeProperty('--sx-parallax-x');
    document.documentElement.style.removeProperty('--sx-parallax-y');
    window.addEventListener('pointermove', (e) => {
      if (!polishOn) return;
      mx = e.clientX;
      my = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        glow.style.setProperty('--sx-mx', `${mx}px`);
        glow.style.setProperty('--sx-my', `${my}px`);
      });
    }, { passive: true });
  }

  // Tooltip host
  let tipEl = document.querySelector('[data-sx-tooltip]');
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.className = 'sx-tooltip';
    tipEl.setAttribute('data-sx-tooltip', '');
    tipEl.setAttribute('role', 'tooltip');
    tipEl.hidden = true;
    document.body.appendChild(tipEl);
  }

  function hideTip() {
    tipEl.hidden = true;
    tipEl.classList.remove('show');
  }

  function showTip(text, x, y) {
    if (!tipsOn || !text) return;
    tipEl.textContent = text;
    tipEl.hidden = false;
    tipEl.classList.add('show');
    const pad = 12;
    const tw = tipEl.offsetWidth || 180;
    const th = tipEl.offsetHeight || 36;
    let left = x + 14;
    let top = y + 16;
    if (left + tw > window.innerWidth - pad) left = x - tw - 10;
    if (top + th > window.innerHeight - pad) top = y - th - 10;
    tipEl.style.left = `${Math.max(pad, left)}px`;
    tipEl.style.top = `${Math.max(pad, top)}px`;
  }

  function tipFor(el) {
    if (!el) return '';
    const custom = el.getAttribute('data-sx-tip') || el.closest?.('[data-sx-tip]')?.getAttribute('data-sx-tip');
    if (custom) return custom;
    const titled = el.closest?.('[title]');
    if (titled?.title && titled.title.length > 2 && titled.title.length < 160) return titled.title;
    return '';
  }

  // Seed data-sx-tip on known controls (non-destructive)
  DEFAULT_TIPS.forEach(({ sel, tip }) => {
    document.querySelectorAll(sel).forEach((el) => {
      if (!el.getAttribute('data-sx-tip')) el.setAttribute('data-sx-tip', tip);
    });
  });

  let longPressTimer = null;
  document.addEventListener('pointerover', (e) => {
    if (coarse || !tipsOn) return;
    const el = e.target.closest?.('[data-sx-tip], button, .btn, [title], label.toggle, [data-action], [data-tab]');
    const text = tipFor(el);
    if (text) showTip(text, e.clientX, e.clientY);
  });
  document.addEventListener('pointermove', (e) => {
    if (coarse || tipEl.hidden) return;
    if (!tipEl.hidden) {
      const tw = tipEl.offsetWidth;
      const th = tipEl.offsetHeight;
      let left = e.clientX + 14;
      let top = e.clientY + 16;
      if (left + tw > window.innerWidth - 8) left = e.clientX - tw - 10;
      if (top + th > window.innerHeight - 8) top = e.clientY - th - 10;
      tipEl.style.left = `${left}px`;
      tipEl.style.top = `${top}px`;
    }
  }, { passive: true });
  document.addEventListener('pointerout', (e) => {
    if (!e.relatedTarget || !tipEl.contains(e.relatedTarget)) hideTip();
  });
  document.addEventListener('click', hideTip);

  if (coarse) {
    document.addEventListener('pointerdown', (e) => {
      if (!tipsOn) return;
      const el = e.target.closest?.('[data-sx-tip], button, .btn, [title]');
      const text = tipFor(el);
      if (!text) return;
      clearTimeout(longPressTimer);
      longPressTimer = setTimeout(() => showTip(text, e.clientX, e.clientY), 480);
    });
    document.addEventListener('pointerup', () => { clearTimeout(longPressTimer); hideTip(); });
    document.addEventListener('pointercancel', () => { clearTimeout(longPressTimer); hideTip(); });
  }

  // Settings strip in status / or inject near transport
  let settings = document.querySelector('[data-sx-settings]');
  if (!settings) {
    const actions = document.querySelector('.transport-actions');
    settings = document.createElement('div');
    settings.className = 'sx-settings';
    settings.setAttribute('data-sx-settings', '');
    settings.innerHTML = `
      <label class="toggle" data-sx-tip="Show hover tooltips on controls (saved in this browser)">
        <input type="checkbox" data-sx-tips ${tipsOn ? 'checked' : ''} />
        <span>Tips</span>
      </label>
      <label class="toggle" data-sx-tip="Cursor glow overlay (desktop; no page parallax)">
        <input type="checkbox" data-sx-polish ${polishOn ? 'checked' : ''} />
        <span>Glow</span>
      </label>
    `;
    if (actions) actions.prepend(settings);
    else deck?.appendChild(settings);
  }

  settings.querySelector('[data-sx-tips]')?.addEventListener('change', (e) => {
    tipsOn = e.target.checked;
    writeBool(TIP_LS, tipsOn);
    if (!tipsOn) hideTip();
    toast?.(tipsOn ? 'Tooltips on' : 'Tooltips off');
  });
  settings.querySelector('[data-sx-polish]')?.addEventListener('change', (e) => {
    polishOn = e.target.checked;
    writeBool(POLISH_LS, polishOn);
    syncPolish();
    toast?.(polishOn ? 'UX polish on' : 'UX polish off');
  });

  let themesApi = null;
  try {
    themesApi = mountThemeSwitcher(deck, toast);
  } catch (err) {
    console.warn('[Sound Deck] themes', err);
  }

  return {
    themes: themesApi,
    setTips(on) { tipsOn = !!on; writeBool(TIP_LS, tipsOn); },
    setPolish(on) { polishOn = !!on; writeBool(POLISH_LS, polishOn); syncPolish(); },
    refreshTips() {
      DEFAULT_TIPS.forEach(({ sel, tip }) => {
        document.querySelectorAll(sel).forEach((el) => {
          if (!el.getAttribute('data-sx-tip')) el.setAttribute('data-sx-tip', tip);
        });
      });
    },
  };
}
