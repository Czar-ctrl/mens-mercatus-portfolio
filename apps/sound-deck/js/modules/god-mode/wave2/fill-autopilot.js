/**
 * W2 #8 Fill Autopilot — find section boundaries (and the song end) and write a percussion fill
 * into the gap just before each one. Fills are hit-list clips (re-render after save / Restore).
 */
import { registerFeature } from '../registry.js';
import { godApply } from '../apply.js';
import { addHitsClip } from '../command-exec.js';
import { detectSections, songEndBeat } from '../sections.js';
import { findRoleTrack } from '../roles.js';
import { mulberry32, seedFrom } from '../../../audio/generator.js';
import { setStatus } from '../w23-ui.js';

const STYLES = {
  conga: (n, rng) => Array.from({ length: n }, (_, i) => ({ step: i, voice: i % 3 === 2 ? 'conga_lo' : 'conga_hi', vel: 0.5 + (i / n) * 0.5 + rng() * 0.05 })),
  snare: (n) => Array.from({ length: n * 2 }, (_, i) => ({ step: i / 2, voice: 'snare', vel: 0.3 + (i / (n * 2)) * 0.7 })),
  tom: (n) => Array.from({ length: n }, (_, i) => ({ step: i, voice: i < n / 2 ? 'conga_hi' : 'tom', vel: 0.55 + (i / n) * 0.45 })),
  clap: (n, rng) => Array.from({ length: n }, (_, i) => ({ step: i, voice: rng() > 0.5 ? 'clap' : 'rim', vel: 0.5 + (i / n) * 0.4 })),
};

export function fillHits(style, lengthBeats, density = 1, seed = 1) {
  const rng = mulberry32(seedFrom(`fill|${style}|${lengthBeats}|${seed}`));
  const steps = Math.round(lengthBeats * 4);
  const raw = (STYLES[style] || STYLES.conga)(steps, rng);
  return raw.filter((h, i) => i >= steps - 2 || rng() < density).map((h) => ({ beat: h.step / 4, voice: h.voice, vel: Math.min(1.1, h.vel) }));
}

function stripFills(engine) {
  let n = 0;
  engine.tracks.forEach((t) => { const k = t.clips.length; t.clips = t.clips.filter((c) => c.meta?.tag !== 'fill-autopilot'); n += k - t.clips.length; });
  return n;
}

/** Insert fills before every section boundary (one godApply). Returns fill count. */
export async function runFillAutopilot(ctx, { style = 'conga', len = 2, density = 0.8, includeEnd = true } = {}) {
  const engine = ctx.engine;
  let count = 0;
  await godApply(ctx, 'Fill Autopilot', async () => {
    await engine.init();
    const secs = detectSections(engine);
    const bounds = new Set(secs.slice(1).map((s) => s.startBar * 4));
    const end = songEndBeat(engine);
    if (includeEnd && end > len) bounds.add(end);
    if (!bounds.size) throw new Error('No section boundaries found — add clips first');
    stripFills(engine);
    const track = findRoleTrack(engine, 'drums') || engine.tracks.find((t) => t.name === 'Fills') || engine.addTrack('audio', 'Fills');
    [...bounds].sort((a, b) => a - b).forEach((b, i) => {
      addHitsClip(engine, track.id, { name: `Fill → bar ${b / 4 + 1}`, startBeat: Math.max(0, b - len), lengthBeats: len, hits: fillHits(style, len, density, i + 1), color: '#FC8181', tag: 'fill-autopilot' });
      count += 1;
    });
    engine._emit('tracks', engine.tracks);
  });
  return count;
}

registerFeature({
  id: 'fill-autopilot',
  title: 'Fill Autopilot',
  blurb: 'Writes a percussion fill into the gap before every section change (Intro→Verse→Drop…) and before the song end.',
  badge: 'DEMO',
  wave: 2,
  mount(card, ctx) {
    card.innerHTML = `
      <div class="sx-god-row">
        <label class="field"><span>Style</span><select data-fa-style><option value="conga">Conga roll</option><option value="snare">Snare roll</option><option value="tom">Tom cascade</option><option value="clap">Clap / rim</option></select></label>
        <label class="field"><span>Length</span><select data-fa-len><option value="1">1 beat</option><option value="2" selected>2 beats</option><option value="4">1 bar</option></select></label>
      </div>
      <label class="field sx-god-field"><span>Density <em data-fa-dv>0.8</em></span><input type="range" min="0.3" max="1" step="0.05" value="0.8" data-fa-den /></label>
      <label class="toggle"><input type="checkbox" data-fa-end checked /> <span>Also before song end</span></label>
      <div class="btn-row"><button type="button" class="btn primary sm" data-fa-go>Insert fills</button><button type="button" class="btn sm ghost" data-fa-clear>Remove fills</button></div>
      <p class="fineprint" data-fa-status>Targets the Drums track (or creates “Fills”) · replaces earlier autopilot fills · DEMO</p>
    `;
    const engine = ctx.engine;
    const status = card.querySelector('[data-fa-status]');
    const den = card.querySelector('[data-fa-den]');
    den.addEventListener('input', () => { card.querySelector('[data-fa-dv]').textContent = den.value; });
    const strip = () => stripFills(engine);
    card.querySelector('[data-fa-clear]').addEventListener('click', async () => {
      let n = 0;
      await godApply(ctx, 'Remove autopilot fills', async () => { n = strip(); engine._emit('tracks', engine.tracks); });
      setStatus(status, `Removed ${n} fills`);
    });
    card.querySelector('[data-fa-go]').addEventListener('click', async () => {
      const style = card.querySelector('[data-fa-style]').value;
      const len = Number(card.querySelector('[data-fa-len]').value) || 2;
      try {
        const count = await runFillAutopilot(ctx, { style, len, density: Number(den.value) || 0.8, includeEnd: card.querySelector('[data-fa-end]').checked });
        setStatus(status, `${count} ${style} fills inserted (${len} beat${len > 1 ? 's' : ''} each) · undo via Restore`);
      } catch (e) { setStatus(status, `✗ ${e.message}`); }
    });
  },
});
