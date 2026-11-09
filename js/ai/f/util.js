/* Option F shared helpers */
import { esc, reduce } from '../core.js';
export { esc, reduce };
export const FCFG = () => (window.MM_AI_CONFIG && window.MM_AI_CONFIG.f) || {};
export const API = () => (FCFG().apiBase || '/leads');
export function viewed() {
  try {
    const v = JSON.parse(sessionStorage.getItem('mm-f-viewed') || '[]');
    const p = location.pathname.replace(/index\.html$/, '') || '/';
    if (!v.includes(p)) { v.push(p); sessionStorage.setItem('mm-f-viewed', JSON.stringify(v.slice(-20))); }
    return v;
  } catch (e) { return [location.pathname]; }
}
export function gpc() {
  return !!(navigator.globalPrivacyControl || (typeof navigator.doNotTrack === 'string' && navigator.doNotTrack === '1'));
}
export function el(tag, cls, html, attrs) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}
export function toast(msg) {
  let t = document.querySelector('.mm-f-toast');
  if (!t) { t = el('div', 'mm-f-toast'); document.body.appendChild(t); }
  t.textContent = msg; t.hidden = false;
  clearTimeout(t._t); t._t = setTimeout(() => { t.hidden = true; }, 3200);
}
export const loadingHTML = '<p class="mm-f-loading" role="status"><i></i><i></i><i></i><span>Working…</span></p>';
export function emptyHTML(msg) { return `<p class="mm-f-state empty">${esc(msg)}</p>`; }
export function errHTML(msg) { return `<p class="mm-f-state err" role="alert">${esc(msg)}</p>`; }

const QUEUE_KEY = 'mm-f-leads-queue';
export function queueLead(payload) {
  try {
    const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    q.push({ ...payload, queued_at: Date.now() });
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-20)));
    return true;
  } catch (e) { return false; }
}
export async function flushLeadQueue() {
  let q;
  try { q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return; }
  if (!q.length) return;
  const left = [];
  for (const item of q) {
    try {
      const r = await fetch(API() + '/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) left.push(item);
    } catch { left.push(item); }
  }
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(left)); } catch {}
}
