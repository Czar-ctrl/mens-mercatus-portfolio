/**
 * Night Shift mini-app surface — main-window visual mode inspired by
 * Blink Night Shift record-label aesthetic (kinetic type, warm night cast).
 * Purely visual; does not touch the audio graph.
 */
const LS = 'mm-sound-deck-ns-surface';

function readOpen() {
  try {
    const v = localStorage.getItem(LS);
    if (v === null) return true;
    return v === '1' || v === 'true';
  } catch (_) {
    return true;
  }
}
function writeOpen(on) {
  try { localStorage.setItem(LS, on ? '1' : '0'); } catch (_) {}
}

const NAV = [
  { id: 'label', label: 'Label' },
  { id: 'roster', label: 'Roster' },
  { id: 'releases', label: 'Releases' },
  { id: 'sessions', label: 'Sessions' },
];

const PANES = {
  label: {
    kicker: 'Night Shift · SoundX',
    title: 'SOUNDS AFTER <span>DARK</span>',
    cards: [
      { h: 'Signal yellow', p: 'Lemon #F2E000 on near-black — the only accent. Soft depth, no hard strokes.', w: '72%' },
      { h: 'B / Y / W', p: 'Black · lemon yellow · white only — Blink Night Shift record-label lock.', w: '48%' },
      { h: 'Tactile cards', p: 'Pillowy panels sit in space — shadow separation instead of borders.', w: '61%' },
    ],
  },
  roster: {
    kicker: 'Artists',
    title: 'ROSTER ON <span>ROTATION</span>',
    cards: [
      { h: 'Live Loops', p: 'Clip grid scenes — launch without leaving the night shell.', w: '55%' },
      { h: 'AI Producer', p: 'Chat-side ideas with the same warm furniture chrome.', w: '40%' },
      { h: 'Ghost layer', p: 'Tape-echo buffer as a soft secondary surface.', w: '66%' },
    ],
  },
  releases: {
    kicker: 'Catalog',
    title: 'CUT · MASTER · <span>SHIP</span>',
    cards: [
      { h: 'Arrange', p: 'Song view timeline with soft clip pillows.', w: '58%' },
      { h: 'Mixer', p: 'Collapse dock still works — blue wash hit targets only.', w: '44%' },
      { h: 'Export', p: 'WAV / FLAC / MP3 / Ogg — unchanged audio path.', w: '70%' },
    ],
  },
  sessions: {
    kicker: 'Studio',
    title: 'SESSION <span>VERSIONS</span>',
    cards: [
      { h: 'Snapshots', p: 'Roll back arrangements without leaving Night Shift.', w: '52%' },
      { h: 'Stem DNA', p: 'Analysis cards reuse the same soft radius language.', w: '63%' },
      { h: 'Co-producer', p: 'Suggestion chips as furniture pills, not outlined boxes.', w: '37%' },
    ],
  },
};

export function mountNightShiftSurface(deck, toast) {
  if (!deck) return null;
  let open = readOpen();
  let pane = 'label';

  let surface = deck.querySelector('[data-sx-ns-surface]');
  let reopen = deck.querySelector('[data-sx-ns-reopen]');

  if (!surface) {
    surface = document.createElement('section');
    surface.className = 'sx-ns-surface';
    surface.setAttribute('data-sx-ns-surface', '');
    surface.setAttribute('aria-label', 'Night Shift app surface');
    surface.innerHTML = `
      <aside class="sx-ns-side">
        <p class="sx-ns-mark">NS <em>SHIFT</em></p>
        <nav class="sx-ns-nav" data-sx-ns-nav role="tablist" aria-label="Night Shift sections"></nav>
      </aside>
      <div class="sx-ns-main">
        <div class="sx-ns-top">
          <div>
            <p class="sx-ns-kicker" data-sx-ns-kicker></p>
            <h2 class="sx-ns-title" data-sx-ns-title></h2>
          </div>
          <div class="sx-ns-actions">
            <button type="button" class="btn primary sm" data-sx-ns-apply>USE NIGHT SHIFT</button>
            <button type="button" class="sx-ns-dismiss" data-sx-ns-dismiss title="Hide Night Shift surface">Hide</button>
          </div>
        </div>
        <div class="sx-ns-cards" data-sx-ns-cards></div>
      </div>
    `;
    const transport = deck.querySelector('[data-transport]') || deck.querySelector('header');
    const workspace = deck.querySelector('[data-workspace]');
    if (transport && transport.parentNode) {
      transport.insertAdjacentElement('afterend', surface);
    } else if (workspace) {
      workspace.insertAdjacentElement('beforebegin', surface);
    } else {
      deck.prepend(surface);
    }
  }

  if (!reopen) {
    reopen = document.createElement('button');
    reopen.type = 'button';
    reopen.className = 'sx-ns-reopen';
    reopen.setAttribute('data-sx-ns-reopen', '');
    reopen.textContent = 'Show Night Shift';
    reopen.hidden = open;
    surface.insertAdjacentElement('afterend', reopen);
  }

  const nav = surface.querySelector('[data-sx-ns-nav]');
  if (nav && !nav.children.length) {
    nav.innerHTML = NAV.map((n) =>
      `<button type="button" role="tab" data-sx-ns-pane="${n.id}" aria-selected="false">${n.label}</button>`
    ).join('');
  }

  function render() {
    const data = PANES[pane] || PANES.label;
    const k = surface.querySelector('[data-sx-ns-kicker]');
    const title = surface.querySelector('[data-sx-ns-title]');
    const cards = surface.querySelector('[data-sx-ns-cards]');
    if (k) k.textContent = data.kicker;
    if (title) title.innerHTML = data.title;
    if (cards) {
      cards.innerHTML = data.cards.map((c) => `
        <article class="sx-ns-card">
          <h4>${c.h}</h4>
          <p>${c.p}</p>
          <div class="sx-ns-bar"><i style="--w:${c.w}"></i></div>
        </article>
      `).join('');
    }
    nav?.querySelectorAll('[data-sx-ns-pane]').forEach((btn) => {
      const on = btn.dataset.sxNsPane === pane;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    surface.hidden = !open;
    surface.classList.toggle('is-collapsed', !open);
    reopen.hidden = open;
  }

  function setOpen(next, announce) {
    open = !!next;
    writeOpen(open);
    render();
    if (announce) toast?.(open ? 'Night Shift surface · on' : 'Night Shift surface · hidden');
  }

  nav?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-sx-ns-pane]');
    if (!btn) return;
    pane = btn.dataset.sxNsPane;
    render();
  });
  surface.querySelector('[data-sx-ns-dismiss]')?.addEventListener('click', () => setOpen(false, true));
  reopen.addEventListener('click', () => setOpen(true, true));
  surface.querySelector('[data-sx-ns-apply]')?.addEventListener('click', async () => {
    try {
      const { setTheme } = await import('./themes.js?v=20261007l-sxs20261020b');
      setTheme('night-shift', toast);
      setOpen(true, false);
    } catch (err) {
      console.warn('[Sound Deck] night-shift theme', err);
    }
  });

  // Transport quick toggle (once)
  const actions = document.querySelector('.transport-actions');
  if (actions && !actions.querySelector('[data-sx-ns-toggle]')) {
    const tog = document.createElement('button');
    tog.type = 'button';
    tog.className = 'btn ghost sm';
    tog.setAttribute('data-sx-ns-toggle', '');
    tog.setAttribute('data-sx-tip', 'Toggle Night Shift mini-app surface under transport');
    tog.textContent = 'Night Shift';
    actions.prepend(tog);
    tog.addEventListener('click', () => setOpen(!open, true));
  }

  render();
  return { setOpen, isOpen: () => open };
}
