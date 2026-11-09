/**
 * God Mode hub — searchable card grid over the feature registry.
 * Honest DEMO / LIVE badges. Wave 1–3 (60 features) register via features.js.
 * Wave filter: Wave 1 | Wave 2 | Wave 3 | All (persisted).
 * No Suno API. Shared engine ctx — no second audio graph.
 */
import { listFeatures } from './registry.js';
import { checkAssistHealth } from './assist.js';
import { installRenderers } from './command-exec.js';
import './features.js?v=20261008md-sxs20261020b'; // side-effect: register Wave 1 + 2 + 3 (60)

const WAVES = [
  { id: '1', label: 'Wave 1' },
  { id: '2', label: 'Wave 2' },
  { id: '3', label: 'Wave 3' },
  { id: 'all', label: 'All' },
];
const WAVE_KEY = 'sx-god-wave';

export function resolveWave(def) {
  const w = Number(def?.wave);
  return w === 2 || w === 3 ? w : 1;
}

function resolveBadge(def, assistMode) {
  const raw = String(def.badge || 'DEMO').toUpperCase();
  if (raw === 'AUTO') return assistMode === 'LIVE' ? 'LIVE' : 'DEMO';
  if (raw === 'LIVE') return 'LIVE';
  return 'DEMO';
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c]);
}

/**
 * @param {HTMLElement} root
 * @param {object} ctx — engine, toast, inserts, stemDna, sessionVersions, liveLoops, beats, getSelectedTrackId, …
 */
export function mountGodModeHub(root, ctx = {}) {
  if (!root) return null;
  try { installRenderers(ctx.engine); } catch (_) {}

  root.innerHTML = `
    <div class="sx-god-hub">
      <div class="panel-head">
        <h2>God Mode</h2>
        <span class="badge" data-god-assist-pill title="LIVE = Blueprint Assist healthy · DEMO = local Web Audio / heuristics">DEMO</span>
      </div>
      <p class="panel-desc">
        Wave 1 creative tools · Wave 2 workflow agents · Wave 3 honest AI/ML desk — Web Audio &amp; local heuristics.
        Every card shows an honest <strong>DEMO</strong> or <strong>LIVE</strong> badge (no cloud full-song generation).
        Apply always snapshots first — undo via Restore.
      </p>
      <div class="sx-god-hub__toolbar">
        <div class="view-seg sx-god-waves" role="tablist" aria-label="God Mode waves" data-god-waves>
          ${WAVES.map((w) => `<button type="button" role="tab" class="sx-god-wave" data-god-wave="${w.id}" aria-selected="false">${w.label} <em data-god-wave-count="${w.id}"></em></button>`).join('')}
        </div>
        <label class="sx-god-hub__search">
          <span class="sr-only">Search features</span>
          <input type="search" data-god-search placeholder="Search God Mode features…" autocomplete="off" />
        </label>
        <span class="fineprint" data-god-count></span>
      </div>
      <div class="sx-god-hub__grid" data-god-grid></div>
      <div class="sx-god-hub__empty" data-god-empty hidden>
        <strong>God Mode hub online</strong>
        <span>Register features to populate God Mode. Labs (Dice Forge · Tradingfloor Form) stay above.</span>
      </div>
      <p class="fineprint">Mens Mercatus SoundX · no Suno API · confirm-before-write on Apply</p>
    </div>
  `;

  const grid = root.querySelector('[data-god-grid]');
  const empty = root.querySelector('[data-god-empty]');
  const search = root.querySelector('[data-god-search]');
  const countEl = root.querySelector('[data-god-count]');
  const pill = root.querySelector('[data-god-assist-pill]');

  const wavesEl = root.querySelector('[data-god-waves]');
  let savedWave = 'all';
  try { savedWave = localStorage.getItem(WAVE_KEY) || 'all'; } catch (_) {}
  if (!WAVES.some((w) => w.id === savedWave)) savedWave = 'all';
  const state = { assistMode: 'DEMO', filter: '', wave: savedWave };

  function syncWaveButtons(all) {
    const counts = { 1: 0, 2: 0, 3: 0 };
    all.forEach((f) => { counts[resolveWave(f)] += 1; });
    wavesEl.querySelectorAll('[data-god-wave]').forEach((b) => {
      const on = b.dataset.godWave === state.wave;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      const id = b.dataset.godWave;
      const n = id === 'all' ? all.length : counts[id];
      const em = b.querySelector('[data-god-wave-count]');
      if (em) em.textContent = `${n}`;
    });
    return counts;
  }

  function renderCards() {
    const all = listFeatures();
    const counts = syncWaveButtons(all);
    const inWave = state.wave === 'all' ? all : all.filter((f) => String(resolveWave(f)) === state.wave);
    const q = state.filter.trim().toLowerCase();
    const filtered = q
      ? inWave.filter((f) => {
          const hay = `${f.title} ${f.blurb || ''} ${f.id}`.toLowerCase();
          return hay.includes(q);
        })
      : inWave;

    grid.innerHTML = '';
    empty.hidden = filtered.length > 0;
    countEl.textContent = all.length
      ? `${filtered.length} / ${inWave.length} shown · W1 ${counts[1]}/20 · W2 ${counts[2]}/20 · W3 ${counts[3]}/20`
      : '0 features registered';
    countEl.dataset.w1 = String(counts[1]);
    countEl.dataset.w2 = String(counts[2]);
    countEl.dataset.w3 = String(counts[3]);

    filtered.forEach((def) => {
      const badge = resolveBadge(def, state.assistMode);
      const card = document.createElement('article');
      card.className = 'sx-god-card';
      card.dataset.featureId = def.id;
      card.dataset.godFeature = def.id;
      card.dataset.badge = badge;
      const wave = resolveWave(def);
      card.dataset.godWave = String(wave);
      card.innerHTML = `
        <header class="sx-god-card__head">
          <h3 class="sx-god-card__title">${escapeHtml(def.title)}</h3>
          ${wave > 1 ? `<span class="sx-god-wave-tag" title="God Mode Wave ${wave}">W${wave}</span>` : ''}
          <span class="sx-god-badge sx-god-badge--${badge.toLowerCase()}" data-god-badge>${badge}</span>
        </header>
        <p class="sx-god-card__blurb">${escapeHtml(def.blurb || '')}</p>
        <div class="sx-god-card__body" data-god-body></div>
      `;
      grid.appendChild(card);
      const body = card.querySelector('[data-god-body]');
      try {
        def.mount?.(body, ctx);
      } catch (err) {
        console.warn('[God Mode] mount failed', def.id, err);
        body.innerHTML = `<p class="fineprint">Mount error — see console</p>`;
      }
    });
  }

  wavesEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-god-wave]');
    if (!b) return;
    setWave(b.dataset.godWave);
  });

  function setWave(id) {
    if (!WAVES.some((w) => w.id === id) || id === state.wave) return;
    state.wave = id;
    try { localStorage.setItem(WAVE_KEY, id); } catch (_) {}
    renderCards();
  }

  search.addEventListener('input', () => {
    state.filter = search.value || '';
    renderCards();
  });

  function setAssistPill(mode) {
    state.assistMode = mode === 'LIVE' ? 'LIVE' : 'DEMO';
    pill.textContent = state.assistMode;
    pill.classList.toggle('live', state.assistMode === 'LIVE');
    pill.classList.toggle('warn', state.assistMode !== 'LIVE');
    pill.title = state.assistMode === 'LIVE'
      ? 'LIVE = Blueprint Assist /health ok'
      : 'DEMO = local Web Audio / heuristics (Blueprint unreachable or unused)';
    ctx.assistMode = state.assistMode;
  }

  setAssistPill('DEMO');
  renderCards();

  checkAssistHealth().then((mode) => {
    setAssistPill(mode);
    // Re-resolve AUTO badges after health settles
    renderCards();
  }).catch(() => {
    setAssistPill('DEMO');
  });

  const api = {
    refresh: renderCards,
    getAssistMode: () => state.assistMode,
    getWave: () => state.wave,
    /** Shared God Mode ctx (engine, inserts, sessionVersions …) — used by smoke tests + agents. */
    getCtx: () => ctx,
    setWave,
    /** Make sure a feature's card is in the rendered set (switch wave / clear search). */
    reveal(id) {
      const def = listFeatures().find((f) => f.id === id);
      if (!def) return false;
      const w = String(resolveWave(def));
      let dirty = false;
      if (state.wave !== 'all' && state.wave !== w) { state.wave = w; dirty = true; }
      if (state.filter) { state.filter = ''; search.value = ''; dirty = true; }
      if (dirty) {
        try { localStorage.setItem(WAVE_KEY, state.wave); } catch (_) {}
        renderCards();
      }
      return true;
    },
  };
  root.__sxGodHub = api;
  if (typeof window !== 'undefined') window.__sxGodHub = api;
  return api;
}

/**
 * Open God Mode tab → Ideas/hub subsection → scroll + highlight card.
 * Also handles document event `sx-god:focus` with detail `{ id }`.
 * @param {string} id — feature id (e.g. prompt-arrangement)
 */
export function focusGodFeature(id) {
  const fid = String(id || '').trim();
  if (!fid) return;

  document.querySelector('[data-tab="godmode"]')?.click();
  document.querySelector('[data-gm-sub="ideas"]')?.click();
  try { window.__sxGodHub?.reveal?.(fid); } catch (_) {}

  const tryFocus = () => {
    const esc = (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(fid) : fid.replace(/"/g, '\\"');
    const card = document.querySelector(`[data-god-feature="${esc}"]`);
    if (!card) return false;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('sx-god-card--focus');
    if (card._godFocusTimer) clearTimeout(card._godFocusTimer);
    card._godFocusTimer = setTimeout(() => card.classList.remove('sx-god-card--focus'), 1800);
    return true;
  };

  if (!tryFocus()) {
    requestAnimationFrame(() => {
      if (!tryFocus()) setTimeout(tryFocus, 60);
    });
  }
}

if (typeof document !== 'undefined' && !document.__sxGodFocusBound) {
  document.__sxGodFocusBound = true;
  document.addEventListener('sx-god:focus', (e) => {
    focusGodFeature(e.detail?.id);
  });
}
