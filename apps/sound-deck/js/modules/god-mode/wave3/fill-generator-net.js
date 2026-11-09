/**
 * W3 #14 Fill Generator Net — reads the bar before a boundary (pattern / hit / note clips, or audio
 * onsets), extracts density, syncopation, voices, velocity and swing, then generates fill
 * candidates that continue that groove (crescendo, voice palette, density ramp). Pick one → hit clip.
 * Conditioned procedural generator — honest: no trained network.
 */
import { registerFeature } from '../registry.js';
import { godApply } from '../apply.js';
import { addHitsClip } from '../command-exec.js';
import { patternHits, swingOffset } from '../genre-maps.js';
import { detectSections, songEndBeat } from '../sections.js';
import { tracksByRole } from '../roles.js';
import { renderRegion, toMono } from '../audio-kit.js';
import { analyze } from '../analysis.js';
import { mulberry32, seedFrom } from '../../../audio/generator.js';
import { setStatus, busy, esc } from '../w23-ui.js';

const TAG = 'fill-generator-net';

/** Hits (beats relative to region start) inside [s, e) from drum-role clips. */
export async function contextHits(engine, s, e) {
  const hits = [];
  const drums = tracksByRole(engine, 'drums').filter((t) => !t.muted);
  let audioOnly = [];
  drums.forEach((t) => t.clips.forEach((c) => {
    if (c.meta?.tag === TAG) return;
    const cs = c.startBeat; const ce = cs + c.durationBeats;
    if (ce <= s || cs >= e) return;
    let list = null;
    if (c.meta?.kind === 'god-pattern') list = patternHits(c.meta.style, c.meta.bars, { swing: c.meta.swing, seed: c.meta.seed, layers: c.meta.layers, fillLastBar: c.meta.fillLastBar });
    else if (c.meta?.kind === 'god-hits') list = c.meta.hits;
    else if (c.notes?.length) list = c.notes.map((n) => ({ beat: n.beat, voice: n.freq < 120 ? 'kick' : n.freq < 400 ? 'snare' : 'hat', vel: n.vel ?? 0.8 }));
    if (list) list.forEach((h) => { const b = cs + h.beat; if (b >= s && b < e) hits.push({ beat: b - s, voice: h.voice, vel: h.vel ?? 0.8 }); });
    else audioOnly.push(t.id);
  }));
  audioOnly = [...new Set(audioOnly)];
  if (audioOnly.length) {
    const buf = await renderRegion(engine, s, e, { trackIds: audioOnly, channels: 1, tailSec: 0 });
    const ons = await analyze('onsets', { data: toMono(buf), sr: buf.sampleRate });
    ons.forEach((t) => hits.push({ beat: t / engine.secondsPerBeat, voice: 'conga_hi', vel: 0.8 }));
  }
  return hits.sort((a, b) => a.beat - b.beat);
}

export function grooveFeatures(hits, beats = 4) {
  const n = hits.length;
  const off = hits.filter((h) => { const st = Math.round(h.beat * 4); return st % 2 === 1; }).length;
  const voices = [...new Set(hits.map((h) => h.voice))];
  const vel = n ? hits.reduce((m, h) => m + (h.vel ?? 0.8), 0) / n : 0.8;
  const late = hits.filter((h) => { const st = h.beat * 4; return Math.round(st) % 2 === 1 && st - Math.round(st) > 0.05; }).map((h) => h.beat * 4 - Math.round(h.beat * 4));
  const swing = late.length ? Math.min(0.72, 0.5 + late.reduce((a, b) => a + b, 0) / late.length / 4) : 0.5;
  return { density: n / beats, sync: n ? off / n : 0, voices, vel, swing };
}

function palette(voices) {
  if (voices.some((v) => /conga/.test(v))) return ['conga_hi', 'conga_lo', 'conga_hi', 'tom'];
  if (voices.includes('logdrum')) return ['logdrum', 'tom', 'rim', 'logdrum'];
  if (voices.includes('snare')) return ['snare', 'tom', 'snare', 'clap'];
  return ['tom', 'snare', 'rim', 'clap'];
}

/** Generate one fill candidate of `len` beats. */
export function generateFill(feat, len = 2, seed = 1) {
  const rng = mulberry32(seedFrom(`fgn|${len}|${seed}|${feat.density.toFixed(2)}|${feat.sync.toFixed(2)}`));
  const pal = palette(feat.voices);
  const steps = Math.round(len * 4);
  const base = Math.max(0.3, Math.min(0.8, feat.density / 6));
  const hits = [];
  for (let st = 0; st < steps; st++) {
    const t = st / Math.max(1, steps - 1);
    const offBeat = st % 2 === 1;
    let p = base + t * 0.45;
    if (offBeat) p *= 0.6 + feat.sync * 0.9;
    if (st >= steps - 2 || rng() < p) {
      const voice = pal[Math.floor((t * 0.999 + rng() * 0.25) * pal.length) % pal.length];
      hits.push({ beat: st / 4 + swingOffset(st, feat.swing), voice, vel: Math.min(1.1, (0.45 + 0.6 * t) * (0.7 + feat.vel * 0.4) * (offBeat ? 0.85 : 1)) });
    }
  }
  return hits;
}

const grid = (hits, len) => {
  const steps = Math.round(len * 4);
  return Array.from({ length: steps }, (_, i) => (hits.some((h) => Math.round(h.beat * 4) === i) ? '●' : '·')).join('');
};

registerFeature({
  id: 'fill-generator-net',
  title: 'Fill Generator Net',
  blurb: 'Reads the groove in the bar before each boundary (density, syncopation, voices, swing) and generates matching fill candidates — pick one per boundary.',
  badge: 'DEMO',
  wave: 3,
  mount(card, ctx) {
    card.innerHTML = `
      <div class="sx-god-row">
        <label class="field"><span>Where</span><select data-fg-where><option value="sections">Every section change</option><option value="loop">Loop end</option><option value="end">Song end</option></select></label>
        <label class="field"><span>Length</span><select data-fg-len><option value="1">1 beat</option><option value="2" selected>2 beats</option><option value="4">1 bar</option></select></label>
      </div>
      <ul class="sx-god-list" data-fg-cands></ul>
      <div class="btn-row"><button type="button" class="btn sm" data-fg-gen>Generate candidates</button><button type="button" class="btn primary sm" data-fg-go disabled>Write chosen fill</button><button type="button" class="btn sm ghost" data-fg-clear>Remove generated fills</button></div>
      <p class="fineprint" data-fg-status>Conditioned on the previous bar · procedural, not a trained net · DEMO</p>
    `;
    const engine = ctx.engine;
    const status = card.querySelector('[data-fg-status]');
    const list = card.querySelector('[data-fg-cands]');
    let cands = []; let chosen = 0; let targets = []; let feat = null;
    const len = () => Number(card.querySelector('[data-fg-len]').value);
    const boundaries = () => {
      const w = card.querySelector('[data-fg-where]').value;
      if (w === 'loop') return [engine.loopEnd * 4];
      if (w === 'end') return [songEndBeat(engine)];
      return detectSections(engine).slice(1).map((s) => s.startBar * 4).filter((b) => b >= 4);
    };
    card.querySelector('[data-fg-gen]').addEventListener('click', async (e) => {
      targets = boundaries();
      if (!targets.length) { setStatus(status, 'No boundaries found'); return; }
      busy(e.target, true, 'Listening…');
      try {
        const b = targets[0];
        const ctxHits = await contextHits(engine, Math.max(0, b - 4 - len()), b - len());
        feat = grooveFeatures(ctxHits, 4);
        cands = [1, 2, 3].map((s) => generateFill(feat, len(), s));
        chosen = 0;
        list.innerHTML = cands.map((h, i) => `<li><label class="grow"><input type="radio" name="fg-pick" value="${i}"${i === 0 ? ' checked' : ''} /> <code>${grid(h, len())}</code> ${esc([...new Set(h.map((x) => x.voice))].join('/'))}</label></li>`).join('');
        card.querySelector('[data-fg-go]').disabled = false;
        setStatus(status, `Context bar: ${ctxHits.length} hits · density ${feat.density.toFixed(1)}/beat · syncopation ${Math.round(feat.sync * 100)}% · swing ${Math.round(feat.swing * 100)}% · ${targets.length} boundar${targets.length === 1 ? 'y' : 'ies'}`);
      } catch (err) { setStatus(status, `✗ ${err.message}`); }
      busy(e.target, false);
    });
    list.addEventListener('change', (e) => { if (e.target.name === 'fg-pick') chosen = Number(e.target.value); });
    card.querySelector('[data-fg-go]').addEventListener('click', async () => {
      if (!cands.length) return;
      let n = 0;
      try {
        await godApply(ctx, 'Fill Generator Net', async () => {
          await engine.init();
          const t = engine.tracks.find((x) => x.name === 'Fills') || engine.addTrack('audio', 'Fills');
          t.clips = t.clips.filter((c) => c.meta?.tag !== TAG);
          for (let i = 0; i < targets.length; i++) {
            const b = targets[i];
            const L = len();
            const hits = i === 0 ? cands[chosen] : generateFill(i === 0 ? feat : grooveFeatures(await contextHits(engine, Math.max(0, b - 4 - L), b - L), 4), L, chosen + 1 + i * 7);
            addHitsClip(engine, t.id, { name: `Gen fill → bar ${b / 4 + 1}`, startBeat: Math.max(0, b - L), lengthBeats: L, hits, color: '#F6AD55', tag: TAG });
            n += 1;
          }
          engine._emit?.('tracks', engine.tracks);
        });
        setStatus(status, `✓ ${n} conditioned fill${n === 1 ? '' : 's'} on “Fills” · undo via Restore`);
      } catch (err) { setStatus(status, `✗ ${err.message}`); }
    });
    card.querySelector('[data-fg-clear]').addEventListener('click', async () => {
      await godApply(ctx, 'Remove generated fills', async () => { engine.tracks.forEach((t) => { t.clips = t.clips.filter((c) => c.meta?.tag !== TAG); }); engine._emit?.('tracks', engine.tracks); });
      setStatus(status, 'Generated fills removed · undo via Restore');
    });
  },
});
