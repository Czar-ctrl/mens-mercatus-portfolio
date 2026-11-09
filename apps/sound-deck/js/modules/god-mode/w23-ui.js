/**
 * Small UI helpers shared by Wave 2 / Wave 3 cards.
 */
import { roleOfTrack } from './roles.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmtBar = (b) => String(Math.round(b * 100) / 100);
export const q = (root, sel) => root.querySelector(sel);

/** Subscribe to an engine event for as long as the card element stays in the DOM. */
export function onEngine(engine, evt, fn, el) {
  if (!engine?.on) return () => {};
  const h = (d) => {
    if (el && !el.isConnected) { engine.off?.(evt, h); return; }
    fn(d);
  };
  engine.on(evt, h);
  return () => engine.off?.(evt, h);
}

export function onWindow(evt, fn, el) {
  const h = (e) => {
    if (el && !el.isConnected) { window.removeEventListener(evt, h); return; }
    fn(e);
  };
  window.addEventListener(evt, h);
}

/** <option>s for a track picker. */
export function trackOptions(engine, { selectedId = null, master = false, blank = null, roles = true } = {}) {
  const opts = [];
  if (blank) opts.push(`<option value="">${esc(blank)}</option>`);
  if (master) opts.push('<option value="master">Master</option>');
  (engine?.tracks || []).forEach((t) => {
    const r = roles ? roleOfTrack(t) : '';
    opts.push(`<option value="${esc(t.id)}"${t.id === selectedId ? ' selected' : ''}>${esc(t.name)}${r && r !== 'other' ? ` · ${r}` : ''}</option>`);
  });
  return opts.join('');
}

/** Keep a <select> of tracks fresh while the card is mounted. */
export function bindTrackSelect(sel, ctx, opts = {}) {
  const fill = () => {
    const keep = sel.value;
    sel.innerHTML = trackOptions(ctx.engine, { ...opts, selectedId: keep || ctx.getSelectedTrackId?.() });
    if (keep && [...sel.options].some((o) => o.value === keep)) sel.value = keep;
  };
  fill();
  onEngine(ctx.engine, 'tracks', () => { if (document.activeElement !== sel) fill(); }, sel);
  return fill;
}

/** Drop zone + hidden file input. */
export function fileDrop(zone, input, onFile) {
  zone.addEventListener('click', () => input.click());
  zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('is-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('is-over');
    const f = e.dataTransfer?.files?.[0];
    if (f) onFile(f);
  });
  input.addEventListener('change', () => {
    const f = input.files?.[0];
    if (f) onFile(f);
    input.value = '';
  });
}

/** Bar chart on a canvas (values 0..1); highlight = Set of indices. */
export function drawBars(canvas, values, { highlight = new Set(), color = 'rgba(245,197,24,0.55)', hi = '#F87171', line = null } = {}) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 260;
  const h = canvas.clientHeight || 46;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const n = values.length || 1;
  const bw = w / n;
  values.forEach((v, i) => {
    g.fillStyle = highlight.has(i) ? hi : color;
    const bh = Math.max(1, v * (h - 4));
    g.fillRect(i * bw + 0.5, h - bh, Math.max(1, bw - 1), bh);
  });
  if (line?.length) {
    g.strokeStyle = 'rgba(129,140,248,0.9)';
    g.lineWidth = 1.5;
    g.beginPath();
    line.forEach((v, i) => {
      const x = i * bw + bw / 2;
      const y = h - v * (h - 4);
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    });
    g.stroke();
  }
}

export function setStatus(el, text, kind = '') {
  if (!el) return;
  el.textContent = text;
  el.dataset.kind = kind;
}

export function busy(btn, on, label) {
  if (!btn) return;
  if (on) { btn.dataset.label = btn.textContent; btn.textContent = label || 'Working…'; btn.disabled = true; }
  else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; }
}

/** Open another God Mode card. */
export function focusCard(id) {
  document.dispatchEvent(new CustomEvent('sx-god:focus', { detail: { id } }));
}

export function load(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v ?? fallback; } catch (_) { return fallback; }
}
export function save(key, v) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch (_) {}
}

/** Blueprint Assist state as shown on the hub pill (LIVE only when /health answered ok). */
export function assistLive() {
  try { return window.__sxGodHub?.getAssistMode?.() === 'LIVE'; } catch (_) { return false; }
}

/** Render a command-plan preview (list of describeCommand lines + validation verdict). */
export function planHtml(lines, verdict) {
  return `<ol class="sx-god-list sx-god-plan">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ol>${verdict ? `<p class="fineprint">${esc(verdict)}</p>` : ''}`;
}
