/* D14) Smart booking — SAST + visitor TZ, agenda draft. No sending. */
import { esc } from '../core.js';

function pad(n){ return String(n).padStart(2,'0'); }
function sastSlots(days = 5) {
  const out = [];
  const now = new Date();
  // Build next weekdays 09:00–16:00 SAST (UTC+2)
  for (let d = 1; d <= 14 && out.length < days * 3; d++) {
    const dt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + d, 7, 0)); // 09:00 SAST = 07:00 UTC
    const wd = dt.getUTCDay();
    if (wd === 0 || wd === 6) continue;
    for (const h of [9, 11, 14]) {
      const utc = Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate(), h - 2, 0);
      out.push(new Date(utc));
    }
  }
  return out.slice(0, 12);
}

export function mount(host, opts = {}) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const role = opts.role || '';
  const slots = sastSlots();
  host.innerHTML = `<div class="mm-f-book">
    <p class="mm-kick">Suggest a call time</p>
    <p class="mm-note">Times shown in <b>SAST (UTC+2)</b> and your zone (<b>${esc(tz)}</b>). Copy the agenda and email Katlego yourself — this form does not send.</p>
    <div class="mm-f-slots">${slots.map((d,i) => {
      const sast = new Intl.DateTimeFormat('en-ZA', { timeZone: 'Africa/Johannesburg', weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }).format(d);
      const local = new Intl.DateTimeFormat(undefined, { timeZone: tz, weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }).format(d);
      return `<button type="button" class="mm-btn sm" data-i="${i}"><span>${esc(sast)} SAST</span><span class="mm-note">${esc(local)} local</span></button>`;
    }).join('')}</div>
    <label style="display:block;margin-top:12px">Agenda notes<textarea class="mm-ta" data-ag style="min-height:80px" placeholder="What you want to cover"></textarea></label>
    <pre class="mm-f-agenda" data-out style="margin-top:12px"></pre>
    <p class="mm-note">Copy and email to katlego.mokoto.km@gmail.com — this form does not send.</p>
  </div>`;
  let sel = 0;
  const draw = () => {
    const d = slots[sel];
    const sast = new Intl.DateTimeFormat('en-ZA', { timeZone: 'Africa/Johannesburg', dateStyle:'full', timeStyle:'short' }).format(d);
    const local = new Intl.DateTimeFormat(undefined, { timeZone: tz, dateStyle:'full', timeStyle:'short' }).format(d);
    const ag = host.querySelector('[data-ag]').value || 'Introductions, role fit, next steps.';
    host.querySelector('[data-out]').textContent = `Subject: Call with Katlego Mokoto${role ? ' — ' + role : ''}

Hi Katlego,

I would like to book a 20-minute call.

Proposed time: ${sast} (SAST)
That is ${local} in my time zone (${tz}).

Agenda:
${ag}

Pages I viewed: ${(sessionStorage.getItem('mm-f-viewed') || '[]')}

Thanks`;
  };
  host.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { sel = +b.dataset.i; draw(); });
  host.querySelector('[data-ag]').oninput = draw; draw();
}
