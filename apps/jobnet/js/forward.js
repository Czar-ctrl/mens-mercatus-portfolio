/* JobNet Application — "Forward by email". Pure helpers (no DOM, no network) so they can be unit-tested in Node.
   Public site: builds a mailto: link for the visitor's OWN mail app. Nothing is sent or stored by this site. */
export const MAILTO_MAX = 1900;            // conservative: some mail clients / OSes cut mailto URLs around 2,000 chars
export const TRUNC_NOTE = '\n\n[Shortened to fit your mail app. Use "Copy email" on the page for the full text.]';
const EMAIL = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
/* One to five addresses, comma or semicolon separated. Rejects line breaks (header injection) and anything mailto-unsafe. */
export function parseRecipients(raw) {
  const s = String(raw == null ? '' : raw);
  if (/[\r\n\0<>"()\[\]\\]/.test(s)) return { ok: false, error: 'Remove line breaks and brackets from the address.' };
  const list = s.split(/[;,]/).map(x => x.trim()).filter(Boolean);
  if (!list.length) return { ok: false, error: 'Enter an email address.' };
  if (list.length > 5) return { ok: false, error: 'Up to five addresses.' };
  const bad = list.filter(a => a.length > 254 || !EMAIL.test(a));
  if (bad.length) return { ok: false, error: `Not a valid email address: ${bad[0]}` };
  return { ok: true, list };
}
const clean = s => String(s == null ? '' : s).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
const oneLine = s => clean(s).replace(/\s+/g, ' ');
export function roleSubject(job) { const c = oneLine(job.company).replace(/\s*\(sample\)$/i, ''); return `JobNet: ${oneLine(job.title) || 'Role'}${c && !/^pasted/i.test(c) ? ' at ' + c : ''}`; }
export function draftSubject(job) { return `AI Hawk draft: ${oneLine(job && job.title) || 'Role'}`; }
export function roleBody(job, fit) {
  const L = [`${oneLine(job.title)}${job.company ? ' · ' + oneLine(job.company) : ''}`, `${oneLine(job.location) || 'Location not stated'}${job.source ? ' · ' + oneLine(job.source) : ''}`];
  if (fit && typeof fit.fit === 'number') L.push(`JobNet fit: ${fit.fit}% (${fit.mode === 'semantic' ? 'semantic, MiniLM on-device' : 'keyword, BM25'})`);
  if (job.url) L.push(`Posting: ${job.url}`);
  if (job.text) L.push('', 'Why it was shortlisted:', clean(job.text));
  L.push('', '—', 'Forwarded from JobNet Application (mensmercatus.online/apps/jobnet/). Draft-only: nothing was applied for or sent automatically.');
  return L.join('\n');
}
export function draftBody(job, draftText) {
  const L = [clean(draftText)];
  if (job && job.url) L.push('', `Vacancy: ${job.url}`);
  L.push('', '—', 'AI Hawk draft from JobNet Application. Review and edit before using it. Nothing was sent automatically.');
  return L.join('\n');
}
const cut = (s, n) => (n > 0 && /[\uD800-\uDBFF]/.test(s[n - 1]) ? s.slice(0, n - 1) : s.slice(0, n)); // never split a surrogate pair
const enc = s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
/* mailto per RFC 6068: addresses comma-joined, subject/body percent-encoded, line breaks as %0D%0A. */
export function mailtoHref({ to = [], subject = '', body = '' }, max = MAILTO_MAX) {
  const nl = t => clean(t).replace(/\n/g, '\r\n');
  const head = 'mailto:' + to.map(a => enc(a).replace(/%40/g, '@')).join(',') + '?subject=' + enc(oneLine(subject)) + '&body=';
  const full = clean(body);
  let href = head + enc(nl(full)), truncated = false;
  if (href.length > max) {
    truncated = true; const note = enc('\r\n\r\n' + TRUNC_NOTE.trim()); let lo = 0, hi = full.length;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if ((head + enc(nl(cut(full, mid))) + note).length <= max) lo = mid; else hi = mid - 1; }
    let c = cut(full, lo); const nlAt = c.lastIndexOf('\n'); if (nlAt > lo * 0.6) c = c.slice(0, nlAt); else { const sp = c.lastIndexOf(' '); if (sp > lo * 0.6) c = c.slice(0, sp); }
    href = head + enc(nl(c.trimEnd())) + note;
  }
  return { href, truncated, length: href.length, text: `To: ${to.join(', ')}\nSubject: ${oneLine(subject)}\n\n${full}` };
}
