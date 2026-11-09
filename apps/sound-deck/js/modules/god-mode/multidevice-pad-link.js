/**
 * Multi-Device Pad Link — pair phone pads / phone mic with this deck.
 * Uses the multidevice-host bar (Online room relay · LAN hub · same-device tab).
 */
import { registerFeature } from './registry.js';
import { godApply } from './apply.js';

function md() { return window.__sxMultidevice || null; }
function readBar() { return document.querySelector('.sx-multidevice-bar'); }

registerFeature({
  id: 'multidevice-pad-link',
  title: 'Multi-Device Pad Link',
  blurb: 'Pair a phone as MPC pads or a mic over the internet (room code / QR), a LAN hub, or another tab on this computer.',
  badge: 'LIVE',
  mount(cardEl, ctx) {
    cardEl.innerHTML = `
      <p class="fineprint" data-md-live>Checking link…</p>
      <p class="fineprint">Room <b data-md-cardroom style="font-family:ui-monospace,monospace;letter-spacing:2px;color:#f5c518">—</b></p>
      <div class="btn-row">
        <button type="button" class="btn primary sm" data-md-connect>Connect</button>
        <button type="button" class="btn sm ghost" data-md-pair>Pair phone (QR)</button>
        <a class="btn sm ghost" data-md-ctrl href="controller/" target="_blank" rel="noopener">Controller</a>
        <a class="btn sm ghost" data-md-mic href="mic/" target="_blank" rel="noopener">Mic</a>
      </div>
      <p class="fineprint" data-md-status>Online room = public wss relay on api.mensmercatus.online (messages only, nothing stored).</p>
    `;
    const live = cardEl.querySelector('[data-md-live]');
    const status = cardEl.querySelector('[data-md-status]');

    function refresh() {
      const m = md();
      const bar = readBar();
      if (!m || !bar) { live.textContent = '○ Multi-device bar not mounted yet'; return; }
      const s = m.state();
      const text = bar.querySelector('[data-md-status]')?.textContent || '';
      const on = s.ws === 'open' || s.bcOthers > 0;
      live.textContent = `${on ? '●' : '○'} ${text}`;
      live.style.color = s.devices ? '#3dd68c' : on ? '#f5c518' : '#c9b87a';
      cardEl.querySelector('[data-md-cardroom]').textContent = m.room();
      cardEl.querySelector('[data-md-ctrl]').href = m.controllerUrl();
      cardEl.querySelector('[data-md-mic]').href = m.micUrl();
    }
    refresh();
    const poll = setInterval(() => {
      if (!document.body.contains(cardEl)) { clearInterval(poll); return; }
      refresh();
    }, 1500);

    cardEl.querySelector('[data-md-pair]').addEventListener('click', () => {
      const bar = readBar();
      if (!bar) { ctx.toast?.('Multi-device bar not mounted', 'warn'); return; }
      bar.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      const pop = bar.querySelector('[data-md-pop]');
      if (pop?.hidden) bar.querySelector('[data-md-qr]')?.click();
    });

    cardEl.querySelector('[data-md-connect]').addEventListener('click', async () => {
      await godApply(ctx, 'Multi-Device Connect', async () => {
        const m = md();
        if (m) {
          m.connect();
          status.textContent = `Connecting room ${m.room()} — scan the QR on your phone.`;
        } else if (ctx.multidevice?.connect) {
          ctx.multidevice.connect();
        } else {
          status.textContent = 'Multi-device bar missing — reload SoundX.';
          ctx.toast?.('Multi-device bar not mounted', 'warn');
        }
        setTimeout(refresh, 600);
      });
    });
  },
});
