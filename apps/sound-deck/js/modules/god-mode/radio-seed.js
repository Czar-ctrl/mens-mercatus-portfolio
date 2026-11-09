/**
 * Radio Seed — endless generative radio from mood seed at session BPM (DEMO).
 */
import { registerFeature } from './registry.js';
import { godApply } from './apply.js';
import { chipRow, bindChips, ensureNamedTrack } from './util.js';
import { mulberry32, seedFrom } from '../../audio/generator.js';

const MOODS = [
  { id: 'coastal', label: 'Coastal' },
  { id: 'night-drill', label: 'Night Drill' },
  { id: 'glow', label: 'Glow' },
  { id: 'warm-house', label: 'Warm House' },
];

/** Module-level scheduler so Stop works across card remounts */
const radioState = {
  timer: null,
  trackId: null,
  mood: null,
};

function stopRadio(engine, toast) {
  if (radioState.timer) {
    clearInterval(radioState.timer);
    radioState.timer = null;
  }
  if (engine && radioState.trackId) {
    const t = engine.tracks.find((x) => x.id === radioState.trackId);
    if (t) {
      // Keep recent clips but stop spawning; optional: leave track
      t.meta = { ...(t.meta || {}), radioActive: false };
    }
  }
  radioState.mood = null;
  toast?.('Radio stopped', 'ok');
}

function scheduleHit(engine, track, mood, barBeat) {
  const rng = mulberry32(seedFrom(`${mood}|${barBeat}|${Date.now()}`));
  const kick = engine.createBufferFromRecipe({ type: 'kick', duration: 0.36 });
  const hat = engine.createBufferFromRecipe({ type: 'hat', duration: 0.08 });
  const snare = engine.createBufferFromRecipe({ type: 'snare', duration: 0.22 });

  const dens = mood === 'night-drill' ? 0.85 : mood === 'glow' ? 0.55 : 0.7;
  engine.addClip(track.id, {
    name: 'Radio Kick',
    startBeat: barBeat,
    durationBeats: 0.4,
    color: '#F5C518',
    buffer: kick,
    meta: { kind: 'god-radio', mood },
  });
  if (rng() < dens) {
    engine.addClip(track.id, {
      name: 'Radio Hat',
      startBeat: barBeat + 0.5,
      durationBeats: 0.2,
      color: '#C9A227',
      buffer: hat,
      meta: { kind: 'god-radio', mood },
    });
  }
  if (rng() > 0.45) {
    engine.addClip(track.id, {
      name: 'Radio Snare',
      startBeat: barBeat + 2,
      durationBeats: 0.3,
      color: '#E8A838',
      buffer: snare,
      meta: { kind: 'god-radio', mood },
    });
  }
  // Trim old radio clips so timeline doesn't explode
  const keepFrom = Math.max(0, barBeat - 32);
  track.clips = track.clips.filter((c) => {
    if (c.meta?.kind !== 'god-radio') return true;
    return (c.startBeat || 0) >= keepFrom;
  });
  engine._emit?.('tracks', engine.tracks);
}

registerFeature({
  id: 'radio-seed',
  title: 'Radio Seed',
  blurb: 'Endless generative radio from a mood seed — procedural kicks/hats at session BPM. Start / Stop clears the scheduler.',
  badge: 'DEMO',
  mount(cardEl, ctx) {
    cardEl.innerHTML = `
      ${chipRow(MOODS, { name: 'rs-mood' })}
      <div class="btn-row">
        <button type="button" class="btn primary sm" data-rs-start>Start radio</button>
        <button type="button" class="btn sm ghost" data-rs-stop>Stop</button>
      </div>
      <p class="fineprint" data-rs-status>${radioState.timer ? `On air · ${radioState.mood}` : 'Idle · DEMO'}</p>
    `;
    const getMood = bindChips(cardEl, '[data-chip-group="rs-mood"]');
    const status = cardEl.querySelector('[data-rs-status]');

    cardEl.querySelector('[data-rs-stop]').addEventListener('click', () => {
      stopRadio(ctx.engine, ctx.toast);
      status.textContent = 'Stopped · DEMO';
    });

    cardEl.querySelector('[data-rs-start]').addEventListener('click', async () => {
      const engine = ctx.engine;
      if (!engine) return;
      const mood = getMood() || 'coastal';

      await godApply(ctx, `Radio Seed · ${mood}`, async () => {
        await engine.init();
        stopRadio(engine, null); // clear prior without toast
        const track = ensureNamedTrack(engine, (t) => /radio/i.test(t.name), 'Radio', 'audio');
        track.meta = { ...(track.meta || {}), radioActive: true, mood };
        radioState.trackId = track.id;
        radioState.mood = mood;

        // Seed first bar immediately
        const startBar = Math.floor((engine.currentBeat || 0) / 4) * 4;
        scheduleHit(engine, track, mood, startBar);

        const msPerBar = (4 * 60 * 1000) / (engine.bpm || 120);
        let nextBeat = startBar + 4;
        radioState.timer = setInterval(() => {
          const t = engine.tracks.find((x) => x.id === radioState.trackId);
          if (!t || !radioState.timer) return;
          scheduleHit(engine, t, mood, nextBeat);
          nextBeat += 4;
        }, Math.max(800, msPerBar));

        status.textContent = `On air · ${mood} · ${engine.bpm} BPM · DEMO`;
      });
    });
  },
});
