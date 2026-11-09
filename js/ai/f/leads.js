/* Leave-your-details card. Never emails the visitor. Queues locally if the API is down. */
import { esc, API, viewed, el, toast, gpc, queueLead, flushLeadQueue } from './util.js';

const NOTICE = `I agree that Katlego Mokoto may use these details to email me about roles or projects. Details go only to him, are not sold, and I can ask for deletion at katlego.mokoto.km@gmail.com. <a href="/privacy/">Privacy notice</a>.`;

export function cardHTML(opts = {}) {
  const src = esc(opts.source || 'leads-card');
  const title = esc(opts.title || 'Want a tailored CV? Leave your details');
  const blurb = esc(opts.blurb || 'Katlego gets your details and a short follow-up note he can send himself. You will not be emailed automatically.');
  return `<form class="mm-f-leads" data-mm-leads novalidate>
    <p class="mm-kick">Follow-up</p>
    <h3 style="margin:.35rem 0 .5rem;font:600 1.25rem/1.25 var(--mm-disp)">${title}</h3>
    <p class="mm-note">${blurb}</p>
    <div class="mm-f-grid">
      <label>Name *<input name="name" required autocomplete="name" maxlength="80"></label>
      <label>Work email *<input name="email" type="email" required autocomplete="email" maxlength="120"></label>
      <label>Company<input name="company" autocomplete="organization" maxlength="80"></label>
      <label>Role / opening<input name="role" maxlength="80" placeholder="e.g. AI Engineer"></label>
      <label>Phone (optional)<input name="phone" type="tel" autocomplete="tel" maxlength="32"></label>
    </div>
    <label class="mm-f-hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>
    <label class="mm-f-consent"><input type="checkbox" name="consent" required> <span>${NOTICE}</span></label>
    <input type="hidden" name="source" value="${src}">
    <input type="hidden" name="t0" value="${Date.now()}">
    <div class="mm-row" style="margin-top:14px">
      <button type="submit" class="mm-btn pri">Send details to Katlego</button>
      <span class="mm-note" data-st role="status"></span>
    </div>
    <p class="mm-note" style="margin-top:10px"><span class="mm-badge">Your choice · POPIA</span> ${gpc() ? 'Your browser asked us not to track visits — this form still works because you fill it in yourself.' : 'No ads cookies. Details go only to Katlego.'}</p>
  </form>`;
}

export function bind(root) {
  const form = root.querySelector('[data-mm-leads]');
  if (!form || form.__bound) return;
  form.__bound = true;
  flushLeadQueue();
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const st = form.querySelector('[data-st]');
    const btn = form.querySelector('[type=submit]');
    const fd = new FormData(form);
    if (fd.get('website')) { st.textContent = 'Thanks.'; return; }
    if (!fd.get('consent')) { st.textContent = 'Please tick the consent box.'; return; }
    const t0 = +fd.get('t0') || 0;
    if (Date.now() - t0 < 2500) { st.textContent = 'Please take a moment to read the notice.'; return; }
    const payload = {
      name: String(fd.get('name') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      company: String(fd.get('company') || '').trim(),
      role: String(fd.get('role') || '').trim(),
      phone: String(fd.get('phone') || '').trim(),
      source: String(fd.get('source') || 'leads-card'),
      consent: true,
      viewed: viewed(),
      gpc: gpc()
    };
    if (payload.name.length < 2) { st.textContent = 'Please enter your name.'; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) { st.textContent = 'Please enter a valid work email.'; return; }
    st.textContent = 'Sending…';
    btn.disabled = true;
    try {
      const r = await fetch(API() + '/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error || String(r.status));
      st.textContent = 'Sent. Katlego has your details and a draft follow-up — you were not emailed.';
      toast('Details sent to Katlego');
    } catch (err) {
      const saved = queueLead(payload);
      if (saved) {
        st.textContent = 'We could not reach the server, so your details are saved in this browser. We will retry when you are back online — or email katlego.mokoto.km@gmail.com.';
        toast('Saved on this device — will retry');
      } else {
        st.textContent = 'Could not send. Please email katlego.mokoto.km@gmail.com directly.';
        btn.disabled = false;
      }
    }
  });
  addEventListener('online', () => flushLeadQueue());
}

export function mount(host, opts) {
  host.innerHTML = cardHTML(opts || {});
  bind(host);
}

export function openAfterCv(res) {
  let wrap = document.querySelector('.mm-f-leads-modal');
  if (!wrap) {
    wrap = el('div', 'mm-f-leads-modal mm-ai', '', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Leave your details' });
    document.body.appendChild(wrap);
  }
  wrap.hidden = false;
  document.body.style.overflow = 'hidden';
  const role = (res && res.title) || '';
  wrap.innerHTML = `<div class="mm-f-leads-panel"><button type="button" class="mm-btn" data-x style="float:right;min-height:44px">Close</button>
    ${cardHTML({ source: 'recruiter-match-cv', title: 'Want this CV?', blurb: 'Katlego gets your details and a follow-up note for ' + (role || 'this role') + '. You are not emailed automatically.' })}
    </div>`;
  if (role) wrap.querySelector('[name=role]').value = role;
  bind(wrap);
  const close = () => { wrap.hidden = true; document.body.style.overflow = ''; };
  wrap.querySelector('[data-x]').onclick = close;
  wrap.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  wrap.querySelector('[data-x]').focus();
}
