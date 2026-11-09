/**
 * Session DNA Share — download portable DNA card JSON (DEMO).
 */
import { registerFeature } from './registry.js';
import { godApply } from './apply.js';
import { downloadBlob } from './util.js';

function buildDnaCard(ctx, engine) {
  const dna = ctx.stemDna?.lastAnalysis || null;
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem('mm-sound-deck-stem-dna') || 'null'); } catch (_) {}
  let lyrics = null;
  try { lyrics = JSON.parse(localStorage.getItem('mm-sound-deck-lyric-lattice') || 'null'); } catch (_) {}
  return {
    app: 'Mens Mercatus SoundX',
    kind: 'session-dna-card',
    version: 1,
    demo: true,
    at: new Date().toISOString(),
    bpm: engine.bpm,
    loop: engine.loop || null,
    meta: {
      contrastArc: engine.meta?.contrastArc || null,
      lyricLattice: engine.meta?.lyricLattice || lyrics,
    },
    tracks: (engine.tracks || []).map((t) => ({
      id: t.id,
      name: t.name,
      type: t.type,
      volume: t.volume,
      muted: !!t.muted,
      solo: !!t.solo,
      clips: (t.clips || []).map((c) => ({
        id: c.id,
        name: c.name,
        startBeat: c.startBeat,
        durationBeats: c.durationBeats,
        hasBuffer: !!c.buffer,
        noteCount: c.notes?.length || 0,
        meta: c.meta || null,
      })),
      persona: t.personaId || t.meta?.personaId || null,
    })),
    patterns: {
      clipCount: (engine.tracks || []).reduce((n, t) => n + (t.clips?.length || 0), 0),
    },
    stemDna: dna
      ? {
          key: dna.key?.label || dna.key,
          bpm: dna.tempo?.bpm,
          mood: dna.mood?.mood || dna.mood,
          tags: dna.tags,
          compat: dna.compat || null,
        }
      : stored,
  };
}

registerFeature({
  id: 'session-dna-share',
  title: 'Session DNA Share',
  blurb: 'Export a portable DNA card (BPM, key, mood, pattern snapshot) as JSON — shareable session fingerprint.',
  badge: 'DEMO',
  mount(cardEl, ctx) {
    cardEl.innerHTML = `
      <div class="btn-row">
        <button type="button" class="btn primary sm" data-sd-go>Download DNA card</button>
        <button type="button" class="btn sm ghost" data-sd-copy>Copy JSON</button>
      </div>
      <pre class="sx-god-dna-preview fineprint" data-sd-preview hidden></pre>
      <p class="fineprint" data-sd-status>Local JSON only · no cloud · DEMO</p>
    `;
    const status = cardEl.querySelector('[data-sd-status]');
    const preview = cardEl.querySelector('[data-sd-preview]');

    cardEl.querySelector('[data-sd-go]').addEventListener('click', async () => {
      const engine = ctx.engine;
      if (!engine) return;
      await godApply(ctx, 'Session DNA Share', async () => {
        const card = buildDnaCard(ctx, engine);
        const blob = new Blob([JSON.stringify(card, null, 2)], { type: 'application/json' });
        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        downloadBlob(blob, `soundx-dna-${stamp}.json`);
        preview.hidden = false;
        preview.textContent = JSON.stringify({
          bpm: card.bpm,
          stemDna: card.stemDna,
          tracks: card.tracks.length,
          clips: card.patterns.clipCount,
        }, null, 2);
        status.textContent = `DNA card downloaded · ${card.tracks.length} tracks · DEMO`;
      });
    });

    cardEl.querySelector('[data-sd-copy]').addEventListener('click', async () => {
      const engine = ctx.engine;
      if (!engine) return;
      const card = buildDnaCard(ctx, engine);
      const text = JSON.stringify(card, null, 2);
      try {
        await navigator.clipboard.writeText(text);
        ctx.toast?.('DNA JSON copied', 'ok');
        status.textContent = 'Copied to clipboard · DEMO';
      } catch (_) {
        preview.hidden = false;
        preview.textContent = text.slice(0, 800);
        ctx.toast?.('Clipboard blocked — preview shown', 'warn');
      }
    });
  },
});
