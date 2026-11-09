/**
 * One-time first-fit for short laptop screens (e.g. 1280×800): give the arrange view / God Mode
 * room by starting the bottom docks small. Runs before layout.js reads its saved sizes.
 * Everything stays reachable: drag the blue splitters, or the Night Shift button, to reopen.
 */
const FLAG = 'mm-sx-fit-v1';
const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch {} };

export function fitShortViewportOnce({ maxH = 960, mixerH = 150 } = {}) {
  try {
    if (localStorage.getItem(FLAG)) return false;
    write(FLAG, String(Date.now()));
    if (window.innerHeight > maxH || window.innerWidth < 861) return false;
    const m = read('mm-sound-deck-mixer') || { collapsed: false, height: 340 };
    if (!m.collapsed) m.height = Math.min(Number(m.height) || 340, mixerH);
    write('mm-sound-deck-mixer', m);
    const l = read('mm-sound-deck-layout');
    if (l && typeof l.mixer === 'number') { l.mixer = Math.min(l.mixer, mixerH); write('mm-sound-deck-layout', l); }
    const d = read('mm-sound-deck-feature-dock') || { collapsed: false, height: 180 };
    d.collapsed = true;
    write('mm-sound-deck-feature-dock', d);
    write('mm-sound-deck-ns-surface', '0');
    document.documentElement.dataset.sxFit = 'short';
    return true;
  } catch {
    return false;
  }
}
