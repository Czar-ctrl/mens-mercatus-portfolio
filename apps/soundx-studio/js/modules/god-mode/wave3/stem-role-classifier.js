/**
 * W3 #4 Stem Role Classifier — renders each track solo (offline), extracts an 8-feature
 * descriptor (crest, band ratios, zero-crossings, onset rate, sustain) in the analysis worker
 * and scores roles with transparent rules. Tags persist on clip meta (role) → Restore-safe.
 */
import { registerFeature } from '../registry.js';
import { godApply } from '../apply.js';
import { renderRegion, toMono } from '../audio-kit.js';
import { analyze, analysisMode } from '../analysis.js';
import { songBars } from '../sections.js';
import { ROLES, ROLE_RX, ROLE_COLORS, roleOfTrack } from '../roles.js';
import { setStatus, busy, esc } from '../w23-ui.js';

export async function classifyTracks(engine, { maxBars = 16, onProgress = null } = {}) {
  await engine.init();
  const bars = Math.max(1, Math.min(maxBars, songBars(engine)));
  const out = [];
  const tracks = engine.tracks.filter((t) => t.clips.length);
  for (let i = 0; i < tracks.length; i++) {
    const t = tracks[i];
    onProgress?.(i, tracks.length, t);
    const buf = await renderRegion(engine, 0, bars * 4, { trackIds: [t.id], channels: 1, tailSec: 0 });
    const r = await analyze('stemStats', { data: toMono(buf), sr: buf.sampleRate });
    out.push({ trackId: t.id, name: t.name, before: roleOfTrack(t), ...r });
  }
  return out;
}

registerFeature({
  id: 'stem-role-classifier',
  title: 'Stem Role Classifier',
  blurb: 'Listens to each track (offline render) and tags it drums / bass / vox / keys / fx from audio stats — with the reasons shown.',
  badge: 'DEMO',
  wave: 3,
  mount(card, ctx) {
    card.innerHTML = `
      <ul class="sx-god-list" data-rc-list></ul>
      <div class="sx-god-checks"><label><input type="checkbox" data-rc-rename /> Append role to track names</label><label><input type="checkbox" data-rc-color checked /> Tint clips</label></div>
      <div class="btn-row"><button type="button" class="btn primary sm" data-rc-go>Classify tracks</button><button type="button" class="btn sm" data-rc-apply disabled>Apply tags</button></div>
      <p class="fineprint" data-rc-status>Rule-based over 8 audio features (worker) — a heuristic, not a neural net · DEMO</p>
    `;
    const engine = ctx.engine;
    const list = card.querySelector('[data-rc-list]');
    const status = card.querySelector('[data-rc-status]');
    const applyBtn = card.querySelector('[data-rc-apply]');
    let results = [];
    const render = () => {
      list.innerHTML = results.map((r, i) => {
        const role = r.role.role;
        const opts = [...ROLES, 'empty'].map((x) => `<option value="${x}"${x === role ? ' selected' : ''}>${x}</option>`).join('');
        return `<li title="${esc(JSON.stringify(r.stats))}"><span style="width:10px;height:10px;border-radius:3px;background:${ROLE_COLORS[role] || ROLE_COLORS.other}"></span><span class="grow">${esc(r.name)} <em class="fineprint">${Math.round(r.role.confidence * 100)}% · ${esc(r.role.reasons.join(', '))}</em></span><select data-rc-role="${i}">${opts}</select></li>`;
      }).join('');
    };
    list.addEventListener('change', (e) => {
      const s = e.target.closest('[data-rc-role]');
      if (s) results[Number(s.dataset.rcRole)].role.role = s.value;
    });
    card.querySelector('[data-rc-go]').addEventListener('click', async (e) => {
      busy(e.target, true, 'Listening…');
      try {
        results = await classifyTracks(engine, { onProgress: (i, n, t) => setStatus(status, `Rendering ${t.name} (${i + 1}/${n})…`) });
        render();
        applyBtn.disabled = !results.length;
        const changed = results.filter((r) => r.role.role !== r.before && r.role.role !== 'empty').length;
        setStatus(status, results.length ? `${results.length} tracks analysed (${analysisMode()}) · ${changed} differ from name-based roles · edit, then Apply tags` : 'No tracks with clips');
      } catch (err) { setStatus(status, `✗ ${err.message}`); }
      busy(e.target, false);
    });
    applyBtn.addEventListener('click', async () => {
      const rename = card.querySelector('[data-rc-rename]').checked;
      const tint = card.querySelector('[data-rc-color]').checked;
      let n = 0;
      try {
        await godApply(ctx, 'Stem Role Classifier tags', async () => {
          results.forEach((r) => {
            const t = engine.tracks.find((x) => x.id === r.trackId);
            const role = r.role.role;
            if (!t || role === 'empty') return;
            t.role = role;
            t.clips.forEach((c) => { c.meta = { ...(c.meta || {}), role }; if (tint) c.color = ROLE_COLORS[role]; });
            if (rename && !ROLE_RX[role].test(t.name)) t.name = `${t.name} · ${role}`;
            n += 1;
          });
          engine._emit?.('tracks', engine.tracks);
        });
        setStatus(status, `✓ ${n} tracks tagged · Stem Colorist / Auto-Mix / Critic now use these roles · undo via Restore`);
      } catch (err) { setStatus(status, `✗ ${err.message}`); }
    });
  },
});
