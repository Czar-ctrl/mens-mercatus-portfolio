/* preview wave 3 AI — voice navigation (Web Speech API where supported) + typed fallback. The mic is only requested on click. */
import { exec, HELP } from './commands.js';
const d = document, SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let pop = null, rec = null, listening = false, btnRef = null;
function build() {
  pop = d.createElement('div'); pop.className = 'mm-voice mm-ai'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-labelledby', 'mm-voice-h'); pop.hidden = true;
  pop.innerHTML = `<h3 id="mm-voice-h">Voice navigation</h3><p class="mm-note">${SR ? 'Speak a command. Speech is handled by your browser’s speech service.' : 'Voice isn’t supported in this browser — type a command instead.'}</p>
    <div class="heard" aria-live="assertive"></div><ul>${HELP.slice(0, 6).map(h => '<li>' + h + '</li>').join('')}</ul>
    <form><label class="mm-sr" for="mm-voice-in">Type a command</label><input id="mm-voice-in" class="mm-input" autocomplete="off" placeholder="Type a command, e.g. go to contact"><button class="mm-btn sm pri">Run</button></form>`;
  d.body.appendChild(pop);
  pop.querySelector('form').addEventListener('submit', e => { e.preventDefault(); const i = pop.querySelector('input'); if (i.value.trim()) { say(i.value.trim()); i.value = ''; } });
  pop.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}
function say(text) { const r = exec(text); pop.querySelector('.heard').innerHTML = '“' + text.replace(/[<>&]/g, '') + '” → ' + r.msg.replace(/[<>&]/g, ''); return r; }
function start() {
  if (!SR) return; if (!rec) {
    rec = new SR(); rec.lang = 'en-ZA'; rec.interimResults = true; rec.maxAlternatives = 1; rec.continuous = false;
    rec.onresult = e => { const r = e.results[e.results.length - 1]; const t = r[0].transcript; if (r.isFinal) say(t); else pop.querySelector('.heard').textContent = '“' + t + '”…'; };
    rec.onend = () => { listening = false; if (btnRef) btnRef.classList.remove('on'); };
    rec.onerror = e => { pop.querySelector('.heard').textContent = e.error === 'not-allowed' ? 'Microphone permission was declined — you can type a command instead.' : 'Didn’t hear that (' + e.error + '). Try again or type it.'; };
  }
  try { rec.start(); listening = true; if (btnRef) btnRef.classList.add('on'); pop.querySelector('.heard').textContent = 'Listening…'; } catch (e) {}
}
export function open(btn) { if (!pop) build(); btnRef = btn || btnRef; pop.hidden = false; if (SR) start(); else pop.querySelector('input').focus(); }
export function close() { if (!pop) return; pop.hidden = true; if (rec && listening) rec.stop(); if (btnRef) { btnRef.classList.remove('on'); btnRef.focus(); } }
export function toggle(btn) { if (pop && !pop.hidden) close(); else open(btn); }
export function typed(text) { if (!pop) build(); pop.hidden = false; return say(text); }
export const supported = !!SR;
