/**
 * SoundX MPC pad controller — pairs with the deck via Online room (wss relay), LAN hub, or same-device tab.
 */
const PADS = [
  { id: 0, inst: 'kick808', label: 'Kick', midi: 36 },
  { id: 1, inst: 'snare', label: 'Snare', midi: 38 },
  { id: 2, inst: 'clap', label: 'Clap', midi: 39 },
  { id: 3, inst: 'hatC', label: 'Hat', midi: 42 },
  { id: 4, inst: 'hatO', label: 'Open', midi: 46 },
  { id: 5, inst: 'rim', label: 'Rim', midi: 37 },
  { id: 6, inst: 'tom', label: 'Tom', midi: 45 },
  { id: 7, inst: 'shaker', label: 'Shaker', midi: 70 },
  { id: 8, inst: 'bass808', label: '808', midi: 36 },
  { id: 9, inst: 'sub', label: 'Sub', midi: 36 },
  { id: 10, inst: 'keys', label: 'Keys', midi: 60 },
  { id: 11, inst: 'pluck', label: 'Pluck', midi: 57 },
  { id: 12, inst: 'bell', label: 'Bell', midi: 72 },
  { id: 13, inst: 'pad', label: 'Pad', midi: 57 },
  { id: 14, inst: 'lead', label: 'Lead', midi: 69 },
  { id: 15, inst: 'kick', label: 'Punch', midi: 36 },
];

import { mountPhoneLink } from '../js/link/phone-link-ui.js?v=sxa1';

const qs = (s) => document.querySelector(s);
const velInput = qs('[data-vel]');
const velOut = qs('[data-vel-out]');
const padsRoot = qs('[data-pads]');
const deckState = qs('[data-deckstate]');

velInput.addEventListener('input', () => { velOut.textContent = Number(velInput.value).toFixed(2); });

const phone = mountPhoneLink({
  role: 'controller',
  name: /Android/i.test(navigator.userAgent) ? 'Android MPC' : /iPhone|iPad/i.test(navigator.userAgent) ? 'iPhone MPC' : 'Pad controller',
  onMessage: (msg) => {
    if (msg.type === 'host_state') {
      deckState.hidden = false;
      deckState.textContent = `Deck: ${msg.playing ? '▶ playing' : '■ stopped'} · ${msg.bpm || '?'} BPM`;
      document.querySelectorAll('[data-transport]').forEach((b) => b.classList.toggle('active', (b.dataset.transport === 'play') === !!msg.playing && b.dataset.transport !== 'pause'));
    }
    if (msg.type === 'host_say' && msg.text) qs('[data-hint]').textContent = `Deck: ${msg.text}`;
  },
});
const send = (obj) => phone.send(obj);

PADS.forEach((p) => {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'pad';
  el.dataset.pad = String(p.id);
  el.innerHTML = `<span>${p.label}</span><small>${p.inst}</small>`;
  const fire = (e) => {
    e.preventDefault();
    el.classList.add('hit');
    setTimeout(() => el.classList.remove('hit'), 90);
    send({ type: 'pad', pad: p.id, inst: p.inst, midi: p.midi, velocity: Number(velInput.value), t: Date.now() });
  };
  el.addEventListener('pointerdown', fire);
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') fire(e); });
  padsRoot.appendChild(el);
});

document.querySelector('.patterns').addEventListener('click', (e) => {
  const chip = e.target.closest('[data-pattern]');
  if (!chip) return;
  document.querySelectorAll('[data-pattern]').forEach((c) => c.classList.toggle('active', c === chip));
  const v = chip.dataset.pattern;
  if (v.startsWith('scene:')) send({ type: 'scene', scene: Number(v.split(':')[1]), t: Date.now() });
  else send({ type: 'pattern', patternId: v, t: Date.now() });
});

document.querySelector('.transport').addEventListener('click', (e) => {
  const b = e.target.closest('[data-transport]');
  if (!b) return;
  send({ type: 'transport', action: b.dataset.transport, t: Date.now() });
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js?v=sxa1').catch(() => {});
}
window.__sxPhone = phone;
