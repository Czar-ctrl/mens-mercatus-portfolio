/**
 * Hook Forge — 4 mutated hook variants with mute-solo A/B (DEMO).
 */
import { registerFeature } from './registry.js';
import { godApply } from './apply.js';
import { selectedTrack, lastClipOnTrack, cloneNotes } from './util.js';
import { mulberry32, seedFrom } from '../../audio/generator.js';

function pickSourceClip(ctx, engine) {
  const track = selectedTrack(ctx);
  if (track) {
    const last = lastClipOnTrack(track);
    if (last) return { track, clip: last };
  }
  // Fall back: any clip ≤ 8 beats (1–2 bars-ish)
  for (const t of engine.tracks) {
    for (const c of t.clips) {
      if ((c.durationBeats || 4) <= 8 && (c.notes?.length || c.buffer || c.recipe)) {
        return { track: t, clip: c };
      }
    }
  }
  return null;
}

function mutateVariant(clip, index, bars, rng) {
  const durationBeats = Math.min(clip.durationBeats || bars * 4, bars * 4);
  const notes = cloneNotes(clip.notes, (n, i) => {
    const jitter = (rng() - 0.5) * 0.08 * (index + 1);
    if (n.freq) {
      const semis = index === 0 ? 0 : index === 1 ? 2 : index === 2 ? -3 : 5;
      n.freq *= Math.pow(2, semis / 12) * (1 + jitter * 0.02);
    }
    n.vel = Math.max(0.3, Math.min(1, (n.vel ?? 0.85) * (0.75 + rng() * 0.4)));
    n.beat = ((n.beat || 0) + (index === 3 ? 0.5 : 0)) % Math.max(0.25, durationBeats);
    if (index === 2 && i % 2 === 1) n.dur = (n.dur || 0.5) * 0.6;
  });
  return {
    name: `Hook ${String.fromCharCode(65 + index)}`,
    startBeat: 0,
    durationBeats,
    color: ['#F5C518', '#E8A838', '#C9A227', '#DAA520'][index],
    buffer: index === 0 ? clip.buffer : (clip.buffer && index === 1 ? clip.buffer : null),
    recipe: clip.recipe && index < 2 ? { ...clip.recipe } : null,
    notes: notes || (clip.notes ? clip.notes.map((n) => ({ ...n })) : null),
    meta: { kind: 'god-hook', variant: index, fromClipId: clip.id },
  };
}

registerFeature({
  id: 'hook-forge',
  title: 'Hook Forge',
  blurb: 'Forge 4 hook candidates from a 1–2 bar source clip — A/B via mute-solo on a Hook track bank.',
  badge: 'DEMO',
  mount(cardEl, ctx) {
    cardEl.innerHTML = `
      <div class="btn-row">
        <button type="button" class="btn primary sm" data-hf-go>Forge 4 hooks</button>
      </div>
      <div class="sx-god-hook-pads" data-hf-pads></div>
      <p class="fineprint" data-hf-status>Uses selected / last short clip · DEMO</p>
    `;
    const padsEl = cardEl.querySelector('[data-hf-pads]');
    const status = cardEl.querySelector('[data-hf-status]');

    function renderPads(hookTracks) {
      if (!hookTracks?.length) {
        padsEl.innerHTML = '';
        return;
      }
      padsEl.innerHTML = hookTracks.map((t, i) => `
        <div class="sx-god-hook-pad">
          <strong>${t.name}</strong>
          <button type="button" class="btn sm ghost ${t.muted ? 'active' : ''}" data-hf-mute="${t.id}">Mute</button>
          <button type="button" class="btn sm ghost ${t.solo ? 'active' : ''}" data-hf-solo="${t.id}">Solo</button>
        </div>
      `).join('');
    }

    padsEl.addEventListener('click', (e) => {
      const engine = ctx.engine;
      if (!engine) return;
      const mute = e.target.closest('[data-hf-mute]');
      const solo = e.target.closest('[data-hf-solo]');
      if (mute) {
        const t = engine.tracks.find((x) => x.id === mute.dataset.hfMute);
        if (t) {
          t.muted = !t.muted;
          engine._updateSoloState?.();
          engine._emit?.('tracks', engine.tracks);
          renderPads(engine.tracks.filter((x) => /hook\s*[a-d]/i.test(x.name)));
        }
      }
      if (solo) {
        const t = engine.tracks.find((x) => x.id === solo.dataset.hfSolo);
        if (t) {
          // exclusive solo among hook pads
          engine.tracks.filter((x) => /hook\s*[a-d]/i.test(x.name)).forEach((x) => {
            x.solo = x.id === t.id ? !t.solo : false;
          });
          engine._updateSoloState?.();
          engine._emit?.('tracks', engine.tracks);
          renderPads(engine.tracks.filter((x) => /hook\s*[a-d]/i.test(x.name)));
        }
      }
    });

    cardEl.querySelector('[data-hf-go]').addEventListener('click', async () => {
      const engine = ctx.engine;
      if (!engine) return;
      const src = pickSourceClip(ctx, engine);
      if (!src) {
        ctx.toast?.('Select a clip first (or generate an arrangement)', 'warn');
        status.textContent = 'No source clip';
        return;
      }

      await godApply(ctx, 'Hook Forge', async () => {
        await engine.init();
        const bars = Math.max(1, Math.min(2, Math.ceil((src.clip.durationBeats || 4) / 4)));
        const rng = mulberry32(seedFrom(`hook|${src.clip.id}|${engine.bpm}`));

        // Remove prior Hook A–D tracks (keep other lanes)
        [...engine.tracks].forEach((t) => {
          if (/^Hook [A-D]$/i.test(t.name)) engine.removeTrack(t.id);
        });

        const created = [];
        for (let i = 0; i < 4; i++) {
          const t = engine.addTrack(src.clip.notes ? 'midi' : 'audio', `Hook ${String.fromCharCode(65 + i)}`);
          const variant = mutateVariant(src.clip, i, bars, rng);
          // If no notes and no buffer after mutate, copy buffer from source
          if (!variant.notes && !variant.buffer && !variant.recipe && src.clip.buffer) {
            variant.buffer = src.clip.buffer;
          }
          if (!variant.notes && !variant.buffer && !variant.recipe) {
            // synthesize a short lead blip so pad is audible
            variant.notes = [
              { beat: 0, dur: 0.8, freq: 440 * Math.pow(2, i / 12), wave: 'sine', vel: 0.8 },
              { beat: 1, dur: 0.6, freq: 554 * Math.pow(2, i / 12), wave: 'sine', vel: 0.7 },
              { beat: 2, dur: 1.0, freq: 659 * Math.pow(2, i / 12), wave: 'triangle', vel: 0.75 },
            ];
            variant.durationBeats = bars * 4;
          }
          engine.addClip(t.id, variant);
          t.muted = i !== 0; // A audible; B/C/D muted for A/B
          t.solo = false;
          created.push(t);
        }
        engine._emit?.('tracks', engine.tracks);
        renderPads(created);
        status.textContent = `4 hooks from “${src.clip.name}” · ${bars} bar(s) · unmute to A/B`;
      });
    });
  },
});
