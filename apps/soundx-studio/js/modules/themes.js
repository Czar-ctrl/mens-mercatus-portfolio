/**
 * SoundX theme system — Blink · Night Shift · Ableton dark · light · high-contrast.
 * Persists to localStorage; applies CSS vars on <html data-sx-theme>.
 */
const THEME_KEY = 'mm-sound-deck-theme';
const ACCENT_KEY = 'mm-sound-deck-accent';

export const THEMES = [
  {
    id: 'blink',
    label: 'Blink',
    tip: 'Blue / black / white furniture shell — Blink-grade polish',
  },
  {
    id: 'night-shift',
    label: 'Night Shift',
    tip: 'Brutalist black / lemon yellow / white — Blink Night Shift label',
  },
  {
    id: 'flower-house',
    label: 'A house built on one flower',
    tip: 'G&CO / Flower House haven — cream, stone, soft botanical accents',
  },
  {
    id: 'ableton-dark',
    label: 'Ableton Dark',
    tip: 'Flat near-black panels, gold accent — Ableton-inspired',
  },
  {
    id: 'light',
    label: 'Light',
    tip: 'Cool off-white / daylight surfaces with dark ink',
  },
  {
    id: 'high-contrast',
    label: 'High contrast',
    tip: 'Max contrast for readability — white on black, bright accent',
  },
];

const DEFAULT_THEME = 'blink';
const DEFAULT_ACCENT = '#2563EB';
const THEME_DEFAULT_ACCENTS = {
  blink: '#2563EB',
  'night-shift': '#F2E000',
  'flower-house': '#2563EB',
  'ableton-dark': '#F5C518',
  light: '#2563EB',
  'high-contrast': '#FFFF00',
};

const PRESET_ACCENTS = [
  { id: 'blue', hex: '#2563EB', label: 'Blue' },
  { id: 'sky', hex: '#0070F3', label: 'Sky' },
  { id: 'gold', hex: '#F5C518', label: 'Gold' },
  { id: 'amber', hex: '#F59E0B', label: 'Amber' },
  { id: 'sage', hex: '#7C9A7A', label: 'Sage' },
  { id: 'blush', hex: '#D4A5A5', label: 'Blush' },
  { id: 'teal', hex: '#2EC4B6', label: 'Teal' },
  { id: 'violet', hex: '#9B5DE5', label: 'Violet' },
  { id: 'rose', hex: '#F15BB5', label: 'Rose' },
  { id: 'lime', hex: '#B5E48C', label: 'Lime' },
  { id: 'red', hex: '#E63946', label: 'Red' },
];

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null || v === '' ? fallback : v;
  } catch (_) {
    return fallback;
  }
}

function write(key, val) {
  try { localStorage.setItem(key, val); } catch (_) {}
}

function normalizeHex(hex) {
  const s = String(hex || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toUpperCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    const r = s[1], g = s[2], b = s[3];
    return (`#${r}${r}${g}${g}${b}${b}`).toUpperCase();
  }
  return DEFAULT_ACCENT;
}

function hexToRgb(hex) {
  const h = normalizeHex(hex).slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function accentDerived(hex) {
  const { r, g, b } = hexToRgb(hex);
  const soft = `rgba(${r}, ${g}, ${b}, 0.15)`;
  const border = `rgba(${r}, ${g}, ${b}, 0.22)`;
  const dimR = Math.round(r * 0.72 + 20);
  const dimG = Math.round(g * 0.72 + 16);
  const dimB = Math.round(b * 0.55 + 10);
  const dim = `#${[dimR, dimG, dimB].map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  const skipR = Math.min(255, Math.round(r * 0.55 + 110));
  const skipG = Math.min(255, Math.round(g * 0.7 + 80));
  const skipB = Math.min(255, Math.round(b * 0.35 + 40));
  const skip = `#${[skipR, skipG, skipB].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  const skipGlow = `rgba(${skipR}, ${skipG}, ${skipB}, 0.75)`;
  return { soft, border, dim, skip, skipGlow };
}

export function getTheme() {
  const id = read(THEME_KEY, DEFAULT_THEME);
  // migrate legacy default storage emptiness already handled; unknown → blink
  return THEMES.some((t) => t.id === id) ? id : DEFAULT_THEME;
}

export function getAccent() {
  const stored = read(ACCENT_KEY, '');
  if (stored) return normalizeHex(stored);
  return THEME_DEFAULT_ACCENTS[getTheme()] || DEFAULT_ACCENT;
}

/** Apply theme + accent CSS vars to <html>. */
export function applyTheme(themeId = getTheme(), accentHex = getAccent()) {
  const id = THEMES.some((t) => t.id === themeId) ? themeId : DEFAULT_THEME;
  let accent = normalizeHex(accentHex || THEME_DEFAULT_ACCENTS[id] || DEFAULT_ACCENT);
  if (id === 'high-contrast' && (accent === DEFAULT_ACCENT || accent === '#F5C518')) accent = '#FFFF00';
  if (id === 'night-shift' && !read(ACCENT_KEY, '')) accent = THEME_DEFAULT_ACCENTS['night-shift'];
  const d = accentDerived(accent);
  const root = document.documentElement;
  root.setAttribute('data-sx-theme', id);
  root.style.setProperty('--gold', accent);
  root.style.setProperty('--gold-dim', d.dim);
  root.style.setProperty('--gold-soft', d.soft);
  root.style.setProperty('--border', d.border);
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--skip-line', d.skip);
  root.style.setProperty('--skip-line-glow', d.skipGlow);
  root.style.setProperty('--skip-line-ink', '#1a1608');
  if (id === 'high-contrast') {
    root.style.setProperty('--skip-line', '#FFFF00');
    root.style.setProperty('--skip-line-glow', 'rgba(255, 255, 0, 0.9)');
    root.style.setProperty('--skip-line-ink', '#000000');
  }
  if (id === 'night-shift') {
    root.style.setProperty('--skip-line', '#FFE600');
    root.style.setProperty('--skip-line-glow', 'rgba(255, 230, 0, 0.85)');
    root.style.setProperty('--skip-line-ink', '#141414');
  }
  return { theme: id, accent };
}

export function setTheme(themeId, toast) {
  const id = THEMES.some((t) => t.id === themeId) ? themeId : DEFAULT_THEME;
  write(THEME_KEY, id);
  // If user never set a custom accent, adopt theme default
  const accent = read(ACCENT_KEY, '') ? getAccent() : (THEME_DEFAULT_ACCENTS[id] || DEFAULT_ACCENT);
  const state = applyTheme(id, accent);
  const label = THEMES.find((t) => t.id === id)?.label || id;
  toast?.(`Theme · ${label}`);
  window.dispatchEvent(new CustomEvent('sx-theme-change', { detail: state }));
  return state;
}

export function setAccent(hex, toast) {
  const accent = normalizeHex(hex);
  write(ACCENT_KEY, accent);
  const state = applyTheme(getTheme(), accent);
  toast?.(`Accent · ${accent}`);
  window.dispatchEvent(new CustomEvent('sx-theme-change', { detail: state }));
  return state;
}

/** Resolve voice / chip phrases → theme id or accent hex. */
export function resolveThemePhrase(text) {
  const t = String(text || '').toLowerCase();
  if (/\bnight[- ]?shift|nightshift|warm night\b/.test(t)) return { theme: 'night-shift' };
  if (/\bblink\b/.test(t)) return { theme: 'blink' };
  if (/\bflower[- ]?house|botanical|sage|house built on one flower\b/.test(t)) return { theme: 'flower-house' };
  if (/\b(ableton|dark)\b/.test(t) && !/\blight\b/.test(t) && !/\bnight\b/.test(t)) return { theme: 'ableton-dark' };
  if (/\bhigh[- ]?contrast|hi[- ]?contrast|a11y|accessible\b/.test(t)) return { theme: 'high-contrast' };
  if (/\blight\b|\bday\b|\bcream\b/.test(t)) return { theme: 'light' };
  for (const p of PRESET_ACCENTS) {
    if (t.includes(p.id) || t.includes(p.label.toLowerCase())) return { accent: p.hex };
  }
  const hexM = t.match(/#([0-9a-f]{6}|[0-9a-f]{3})\b/i);
  if (hexM) return { accent: `#${hexM[1]}` };
  return null;
}

/**
 * Mount theme switcher into the existing .sx-settings strip (or create one).
 */
export function mountThemeSwitcher(deck, toast) {
  applyTheme();

  let settings = document.querySelector('[data-sx-settings]');
  if (!settings) {
    const actions = document.querySelector('.transport-actions');
    settings = document.createElement('div');
    settings.className = 'sx-settings';
    settings.setAttribute('data-sx-settings', '');
    if (actions) actions.prepend(settings);
    else deck?.appendChild(settings);
  }

  let wrap = settings.querySelector('[data-sx-theme-ui]');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'sx-theme-ui';
    wrap.setAttribute('data-sx-theme-ui', '');
    wrap.innerHTML = `
      <label class="sx-theme-field" data-sx-tip="UI theme — Blink, Night Shift, Ableton Dark, Light, High contrast">
        <span class="sx-theme-label">Theme</span>
        <select data-sx-theme-select aria-label="SoundX theme">
          ${THEMES.map((t) => `<option value="${t.id}">${t.label}</option>`).join('')}
        </select>
      </label>
      <label class="sx-theme-field" data-sx-tip="Custom accent — also tints the Live Loops skip line">
        <span class="sx-theme-label">Accent</span>
        <input type="color" data-sx-accent-color value="${DEFAULT_ACCENT}" aria-label="Accent color" />
      </label>
      <div class="sx-accent-presets" role="group" aria-label="Accent presets">
        ${PRESET_ACCENTS.map((p) =>
          `<button type="button" class="sx-accent-swatch" data-sx-accent="${p.hex}" title="${p.label}" style="--swatch:${p.hex}" aria-label="${p.label} accent"></button>`
        ).join('')}
      </div>
    `;
    settings.appendChild(wrap);
  } else {
    // Refresh options if an older build mounted fewer themes
    const select = wrap.querySelector('[data-sx-theme-select]');
    if (select && select.options.length !== THEMES.length) {
      select.innerHTML = THEMES.map((t) => `<option value="${t.id}">${t.label}</option>`).join('');
    }
  }

  const select = wrap.querySelector('[data-sx-theme-select]');
  const color = wrap.querySelector('[data-sx-accent-color]');
  const syncUi = () => {
    if (select) select.value = getTheme();
    if (color) color.value = getAccent();
    wrap.querySelectorAll('[data-sx-accent]').forEach((btn) => {
      btn.classList.toggle('active', normalizeHex(btn.dataset.sxAccent) === getAccent());
    });
  };
  syncUi();

  select?.addEventListener('change', () => setTheme(select.value, toast));
  color?.addEventListener('input', () => setAccent(color.value, toast));
  wrap.querySelector('.sx-accent-presets')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-sx-accent]');
    if (!btn) return;
    setAccent(btn.dataset.sxAccent, toast);
    syncUi();
  });
  window.addEventListener('sx-theme-change', syncUi);

  return {
    setTheme: (id) => setTheme(id, toast),
    setAccent: (hex) => setAccent(hex, toast),
    getTheme,
    getAccent,
    applyTheme,
  };
}
