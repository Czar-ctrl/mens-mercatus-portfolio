/**
 * Vault Export Suite — stems + master + session JSON + DNA card (DEMO).
 * No JSZip in project — sequential downloads with honest toast. Never blocks transport.
 */
import { registerFeature } from './registry.js';
import { renderMixdown, encodeWav } from '../../audio/export-audio.js';
import { downloadBlob } from './util.js';

async function renderTrackSolo(engine, track, { maxBars = 32 } = {}) {
  const prev = engine.tracks.map((t) => ({ id: t.id, muted: t.muted, solo: t.solo }));
  try {
    engine.tracks.forEach((t) => {
      t.solo = t.id === track.id;
      t.muted = t.id !== track.id;
    });
    return await renderMixdown(engine, { maxBars });
  } finally {
    prev.forEach((p) => {
      const t = engine.tracks.find((x) => x.id === p.id);
      if (t) { t.muted = p.muted; t.solo = p.solo; }
    });
  }
}

function dnaCard(ctx, engine) {
  const dna = ctx.stemDna?.lastAnalysis || null;
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem('mm-sound-deck-stem-dna') || 'null');
  } catch (_) {}
  return {
    app: 'Mens Mercatus SoundX',
    kind: 'session-dna-card',
    demo: true,
    at: new Date().toISOString(),
    bpm: engine.bpm,
    tracks: engine.tracks.map((t) => ({
      id: t.id,
      name: t.name,
      type: t.type,
      clips: t.clips.length,
      muted: !!t.muted,
      persona: t.personaId || t.meta?.personaId || null,
    })),
    stemDna: dna
      ? {
          key: dna.key?.label || dna.key,
          bpm: dna.tempo?.bpm,
          mood: dna.mood?.mood || dna.mood,
          tags: dna.tags,
        }
      : stored,
  };
}

registerFeature({
  id: 'vault-export',
  title: 'Vault Export Suite',
  blurb: 'Export master WAV + optional stems + session JSON + DNA card. Sequential downloads (no JSZip) — honest DEMO.',
  badge: 'DEMO',
  mount(cardEl, ctx) {
    cardEl.innerHTML = `
      <div class="sx-god-checks">
        <label><input type="checkbox" data-ve="master" checked /> Master WAV</label>
        <label><input type="checkbox" data-ve="stems" /> Stem WAVs</label>
        <label><input type="checkbox" data-ve="json" checked /> Session JSON</label>
        <label><input type="checkbox" data-ve="dna" checked /> DNA card</label>
      </div>
      <div class="btn-row">
        <button type="button" class="btn primary sm" data-ve-go>Export vault</button>
      </div>
      <p class="fineprint" data-ve-status>OfflineAudioContext bounce · transport stays free · DEMO</p>
    `;
    const status = cardEl.querySelector('[data-ve-status]');

    cardEl.querySelector('[data-ve-go]').addEventListener('click', async () => {
      const engine = ctx.engine;
      if (!engine) return;
      const want = {
        master: !!cardEl.querySelector('[data-ve="master"]')?.checked,
        stems: !!cardEl.querySelector('[data-ve="stems"]')?.checked,
        json: !!cardEl.querySelector('[data-ve="json"]')?.checked,
        dna: !!cardEl.querySelector('[data-ve="dna"]')?.checked,
      };
      if (!want.master && !want.stems && !want.json && !want.dna) {
        ctx.toast?.('Pick at least one vault item', 'warn');
        return;
      }

      const btn = cardEl.querySelector('[data-ve-go]');
      btn.disabled = true;
      const stamp = Date.now();
      let files = 0;

      // Do NOT use godApply — export is non-destructive; snapshots would be noise
      try {
        status.textContent = 'Preparing vault…';
        ctx.toast?.('Vault export started (transport stays free)', 'ok');

        // Yield so playhead keeps ticking
        await new Promise((r) => setTimeout(r, 0));

        if (want.master) {
          status.textContent = 'Rendering master…';
          const buf = await renderMixdown(engine);
          downloadBlob(encodeWav(buf), `mm-soundx-vault-${stamp}-master.wav`);
          files++;
          await new Promise((r) => setTimeout(r, 120));
        }

        if (want.stems) {
          const tracks = engine.tracks.filter((t) => t.clips?.length);
          for (let i = 0; i < tracks.length; i++) {
            const t = tracks[i];
            status.textContent = `Stem ${i + 1}/${tracks.length}: ${t.name}…`;
            await new Promise((r) => setTimeout(r, 0));
            try {
              const buf = await renderTrackSolo(engine, t);
              const safe = String(t.name || `track-${i}`).replace(/[^\w.-]+/g, '_').slice(0, 40);
              downloadBlob(encodeWav(buf), `mm-soundx-vault-${stamp}-stem-${safe}.wav`);
              files++;
            } catch (err) {
              console.warn('[Vault] stem fail', t.name, err);
            }
            await new Promise((r) => setTimeout(r, 120));
          }
        }

        if (want.json) {
          status.textContent = 'Session JSON…';
          const blob = new Blob([JSON.stringify(engine.toJSON(), null, 2)], { type: 'application/json' });
          downloadBlob(blob, `mm-soundx-vault-${stamp}-session.json`);
          files++;
          await new Promise((r) => setTimeout(r, 80));
        }

        if (want.dna) {
          status.textContent = 'DNA card…';
          const blob = new Blob([JSON.stringify(dnaCard(ctx, engine), null, 2)], { type: 'application/json' });
          downloadBlob(blob, `mm-soundx-vault-${stamp}-dna.json`);
          files++;
        }

        status.textContent = `Exported ${files} file(s) · sequential downloads (no ZIP in build) · DEMO`;
        ctx.toast?.(
          `Vault: ${files} download(s). No JSZip — files arrive separately (honest DEMO).`,
          'ok',
        );
      } catch (err) {
        console.error('[Vault]', err);
        status.textContent = `Export failed: ${err.message || err}`;
        ctx.toast?.(err?.message || 'Vault export failed', 'error');
      } finally {
        btn.disabled = false;
      }
    });
  },
});
