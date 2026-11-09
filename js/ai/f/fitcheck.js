/* D9) Fit-check chatbot: 3 questions → tailored CV + book-a-call + leads card. */
import { analyse } from '../match.js';
import { esc } from '../core.js';
import { mount as mountLeads, openAfterCv } from './leads.js';
import { mount as mountBook } from './booking.js';

const Q = [
  { id: 'role', ask: 'What role are you hiring for (title is enough)?', placeholder: 'e.g. AI Engineer (.NET)' },
  { id: 'must', ask: 'Name 3 must-have skills, comma-separated.', placeholder: 'C#, ASP.NET Core, RAG' },
  { id: 'where', ask: 'Where / how do you work? (city or remote/hybrid)', placeholder: 'Johannesburg, hybrid' }
];

export function mount(host) {
  host.innerHTML = `<div class="mm-f-fit"><div data-chat class="mm-f-chat"></div>
    <form class="mm-row" data-form style="margin-top:10px"><input class="mm-inp" name="a" style="flex:1" autocomplete="off">
      <button class="mm-btn pri" type="submit">Send</button></form>
    <div data-done style="margin-top:16px"></div></div>`;
  const chat = host.querySelector('[data-chat]');
  const answers = {};
  let i = 0;
  const say = (who, html) => { const d = document.createElement('div'); d.className = 'mm-f-bubble ' + who; d.innerHTML = html; chat.appendChild(d); chat.scrollTop = chat.scrollHeight; };
  const ask = () => {
    if (i >= Q.length) return finish();
    say('bot', esc(Q[i].ask));
    host.querySelector('[name=a]').placeholder = Q[i].placeholder;
  };
  const finish = async () => {
    host.querySelector('[data-form]').hidden = true;
    say('bot', 'Thanks — scoring against Katlego’s real profile…');
    const jd = `${answers.role}\nRequirements:\n- ${answers.must.split(',').map(s => s.trim()).filter(Boolean).join('\n- ')}\nLocation: ${answers.where}`;
    const res = await analyse(jd);
    const done = host.querySelector('[data-done]');
    done.innerHTML = `<div class="mm-score"><div class="mm-ring" style="--p:${res.overall}"><b>${res.overall}<small>%</small></b></div>
      <div><h3>Fit for ${esc(res.title)}</h3>
      <p class="mm-note">${res.rows.filter(r=>r.status==='strong').length} strong · ${res.gaps.length} gaps · on device</p>
      <div class="mm-row"><button type="button" class="mm-btn pri" data-cv>Tailored CV + leave details</button></div></div></div>
      <div data-book style="margin-top:16px"></div><div data-leads style="margin-top:16px"></div>`;
    done.querySelector('[data-cv]').onclick = () => openAfterCv(res);
    mountBook(done.querySelector('[data-book]'), { role: answers.role });
    mountLeads(done.querySelector('[data-leads]'), { source: 'fit-check', title: 'Leave your details', blurb: 'Katlego gets a follow-up draft for this fit-check. You are not emailed automatically.' });
  };
  host.querySelector('[data-form]').onsubmit = e => {
    e.preventDefault();
    const v = String(new FormData(e.target).get('a') || '').trim();
    if (!v) return;
    say('me', esc(v));
    answers[Q[i].id] = v;
    e.target.reset();
    i++;
    ask();
  };
  say('bot', 'Three quick questions. Private to this tab until you choose to leave details.');
  ask();
}
