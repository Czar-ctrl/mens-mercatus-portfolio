/**
 * Stem Remix Desk — mute/solo/gain pads for audio clips; drop remix tracks (DEMO).
 */
import { registerFeature } from './registry.js';
import { godApply } from './apply.js';

function collectStemPads(engine) {
  const pads = [];
  for (const track of engine.tracks || []) {
    for (const clip of track.clips || []) {
      if (clip.buffer || clip.recipe || (clip.notes && clip.notes.length)) {
        pads.push({
          id: `${track.id}::${clip.id}`,
          trackId: track.id,
          clipId: clip.id,
          name: clip.name || track.name || 'Stem',
          trackName: track.name,
          hasBuffer: !!clip.buffer,
          muted: !!track.muted,
          solo: !!track.solo,
          volume: track.volume ?? 0.8,
          clip,
          track,
        });
      }
    }
  }
  return pads;
}

function autoGainNormalize(track) {
  // Simple peak-proxy: if many clips, lower volume slightly
  const n = track.clips?.length || 0;
  track.volume = Math.max(0.35, Math.min(0.95, 0.85 - Math.min(0.4, n * 0.02)));
}

registerFeature({
  id: 'stem-remix-desk',
  title: 'Stem Remix Desk',
  blurb: 'List timeline audio/note clips as pads — mute, solo, gain — then drop armed stems onto Remix tracks with auto-gain.',
  badge: 'DEMO',
  mount(cardEl, ctx) {
    cardEl.innerHTML = `
      <div class="sx-god-remix-list" data-srd-list></div>
      <div class="btn-row">
        <button type="button" class="btn sm ghost" data-srd-refresh>Refresh</button>
        <button type="button" class="btn primary sm" data-srd-drop>Drop to timeline</button>
      </div>
      <p class="fineprint" data-srd-status>Scan tracks for clips · DEMO</p>
    `;
    const listEl = cardEl.querySelector('[data-srd-list]');
    const status = cardEl.querySelector('[data-srd-status]');
    const armed = new Set();

    function render() {
      const engine = ctx.engine;
      if (!engine) {
        listEl.innerHTML = '<p class="fineprint">No engine</p>';
        return;
      }
      const pads = collectStemPads(engine);
      if (!pads.length) {
        listEl.innerHTML = '<p class="sx-god-empty">No stems yet — generate an arrangement or load clips first.</p>';
        status.textContent = 'Empty · honest DEMO';
        return;
      }
      listEl.innerHTML = pads.map((p) => `
        <div class="sx-god-remix-pad" data-pad="${p.id}">
          <label class="sx-god-remix-arm">
            <input type="checkbox" data-arm="${p.id}" ${armed.has(p.id) ? 'checked' : ''} />
            <span class="sx-god-remix-name" title="${p.trackName}">${p.name}</span>
          </label>
          <div class="sx-god-remix-ctrls">
            <button type="button" class="btn sm ghost ${p.muted ? 'active' : ''}" data-mute="${p.trackId}" title="Mute track">M</button>
            <button type="button" class="btn sm ghost ${p.solo ? 'active' : ''}" data-solo="${p.trackId}" title="Solo track">S</button>
            <input type="range" min="0" max="1" step="0.05" value="${p.volume}" data-gain="${p.trackId}" title="Gain" />
          </div>
        </div>
      `).join('');
      status.textContent = `${pads.length} pad(s) · ${armed.size} armed · DEMO`;
    }

    listEl.addEventListener('change', (e) => {
      const arm = e.target.closest('[data-arm]');
      if (arm) {
        if (arm.checked) armed.add(arm.dataset.arm);
        else armed.delete(arm.dataset.arm);
        status.textContent = `${armed.size} armed · DEMO`;
        return;
      }
      const gain = e.target.closest('[data-gain]');
      if (gain && ctx.engine) {
        const t = ctx.engine.tracks.find((x) => x.id === gain.dataset.gain);
        if (t) {
          t.volume = Number(gain.value);
          if (typeof ctx.engine.setTrackVolume === 'function') {
            ctx.engine.setTrackVolume(t.id, t.volume);
          } else if (t.gainNode) {
            t.gainNode.gain.value = t.volume;
          }
          ctx.engine._emit?.('tracks', ctx.engine.tracks);
        }
      }
    });

    listEl.addEventListener('click', (e) => {
      const mute = e.target.closest('[data-mute]');
      const solo = e.target.closest('[data-solo]');
      const engine = ctx.engine;
      if (!engine) return;
      if (mute) {
        const t = engine.tracks.find((x) => x.id === mute.dataset.mute);
        if (t) {
          t.muted = !t.muted;
          engine._updateSoloState?.();
          engine._emit?.('tracks', engine.tracks);
          render();
        }
      }
      if (solo) {
        const t = engine.tracks.find((x) => x.id === solo.dataset.solo);
        if (t) {
          t.solo = !t.solo;
          engine._updateSoloState?.();
          engine._emit?.('tracks', engine.tracks);
          render();
        }
      }
    });

    cardEl.querySelector('[data-srd-refresh]').addEventListener('click', render);

    cardEl.querySelector('[data-srd-drop]').addEventListener('click', async () => {
      const engine = ctx.engine;
      if (!engine) return;
      if (!armed.size) {
        ctx.toast?.('Arm at least one pad first', 'warn');
        return;
      }
      const pads = collectStemPads(engine).filter((p) => armed.has(p.id));

      await godApply(ctx, 'Stem Remix Drop', async () => {
        await engine.init();
        let startBeat = Math.floor((engine.currentBeat || 0) / 4) * 4;
        pads.forEach((p, i) => {
          const remix = engine.addTrack('audio', `Remix ${i + 1}`);
          const src = p.clip;
          engine.addClip(remix.id, {
            name: `${src.name || 'Stem'} Remix`,
            startBeat,
            durationBeats: src.durationBeats || 4,
            color: src.color || '#DAA520',
            buffer: src.buffer || null,
            recipe: src.recipe ? { ...src.recipe } : null,
            notes: src.notes ? src.notes.map((n) => ({ ...n })) : null,
            meta: { kind: 'god-remix', from: p.id },
          });
          autoGainNormalize(remix);
        });
        engine._emit?.('tracks', engine.tracks);
        status.textContent = `Dropped ${pads.length} remix track(s) @ beat ${startBeat}`;
      });
    });

    render();
  },
});
