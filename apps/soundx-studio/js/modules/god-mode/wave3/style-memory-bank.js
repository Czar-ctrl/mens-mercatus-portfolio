/**
 * W3 #10 Style Memory Bank — save the current session's “style DNA” (tempo, groove styles + swing,
 * per-role levels / pan / EQ / insert chains, master tone) as a named pack in localStorage, and
 * replay any pack onto another session as one validated command batch. Export/import as JSON.
 */
import { registerFeature } from '../registry.js';
import { makeBatch, describeCommand } from '../command-schema.js';
import { executeBatch, resultLine, linToDb } from '../command-exec.js';
import { PATTERN_STYLES } from '../genre-maps.js';
import { ROLES, roleOfTrack, findRoleTrack } from '../roles.js';
import { downloadBlob } from '../util.js';
import { load, save, setStatus, planHtml, fileDrop, esc } from '../w23-ui.js';

const KEY = 'sx-god-style-bank';
const r1 = (v) => Math.round(v * 10) / 10;
const eqVal = (db) => +((Math.max(-12, Math.min(12, db || 0)) + 12) / 24).toFixed(4);

export function captureDna(ctx, name) {
  const engine = ctx.engine;
  const inserts = ctx.inserts || engine.inserts;
  const fxOf = (id) => (inserts?.list?.(id) || []).filter((it) => !it.bypass).map((it) => ({ fx_id: it.type, amount: +(+it.amount).toFixed(2) }));
  const roles = {};
  ROLES.forEach((role) => {
    const t = findRoleTrack(engine, role);
    if (!t) return;
    roles[role] = { volume_db: r1(linToDb(t.volume ?? 0.8)), pan: +(t.pan || 0).toFixed(2), eq: { ...(t.eq || { low: 0, mid: 0, high: 0 }) }, fx: fxOf(t.id).slice(0, 6) };
  });
  const grooves = [];
  engine.tracks.forEach((t) => t.clips.forEach((c) => {
    if (c.meta?.kind !== 'god-pattern') return;
    const key = `${c.meta.style}|${(c.meta.layers || []).join(',')}`;
    if (!grooves.some((g) => g.key === key)) grooves.push({ key, style: c.meta.style, layers: c.meta.layers || null, swing: c.meta.swing ?? 0.5, role: roleOfTrack(t) });
  }));
  return {
    name: String(name || 'My style').slice(0, 60), at: Date.now(), bpm: engine.bpm,
    grooves: grooves.slice(0, 6).map(({ key, ...g }) => g), roles,
    master: { eq: { ...(engine.masterEq || {}) }, fx: fxOf('master').slice(0, 6) },
  };
}

export function replayCommands(ctx, dna, { tempo = true, mix = true, fx = true, grooves = true, bars = 4, startBar = 0 } = {}) {
  const engine = ctx.engine;
  const inserts = ctx.inserts || engine.inserts;
  const cmds = [];
  if (tempo && dna.bpm >= 40 && dna.bpm <= 220) cmds.push({ action: 'set_bpm', bpm: Math.round(dna.bpm * 10) / 10 });
  Object.entries(dna.roles || {}).forEach(([role, st]) => {
    const t = findRoleTrack(engine, role);
    if (!t) return;
    if (mix) {
      cmds.push({ action: 'set_track_state', track: t.id, volume_db: Math.max(-96, Math.min(0, st.volume_db)), pan: Math.max(-1, Math.min(1, st.pan || 0)), ramp_ms: 60 });
      ['low', 'mid', 'high'].forEach((b) => cmds.push({ action: 'set_parameter', track: t.id, param: `eq_${b}`, value: eqVal(st.eq?.[b]), ramp_ms: 60 }));
    }
    if (fx) {
      const have = (inserts?.list?.(t.id) || []).map((it) => it.type);
      (st.fx || []).filter((f) => !have.includes(f.fx_id)).slice(0, Math.max(0, 6 - have.length)).forEach((f) => cmds.push({ action: 'insert_fx', track: t.id, fx_id: f.fx_id, preset: f.amount }));
    }
  });
  if (mix && dna.master?.eq) ['low', 'mid', 'high'].forEach((b) => cmds.push({ action: 'set_parameter', track: 'master', param: `eq_${b}`, value: eqVal(dna.master.eq[b]), ramp_ms: 80 }));
  if (fx) {
    const have = (inserts?.list?.('master') || []).map((it) => it.type);
    (dna.master?.fx || []).filter((f) => !have.includes(f.fx_id)).slice(0, Math.max(0, 6 - have.length)).forEach((f) => cmds.push({ action: 'insert_fx', track: 'master', fx_id: f.fx_id, preset: f.amount }));
  }
  if (grooves) {
    (dna.grooves || []).filter((g) => PATTERN_STYLES.includes(g.style)).forEach((g, i) => cmds.push({
      action: 'add_clip', track: `${dna.name} ${g.role === 'other' ? 'groove' : g.role}`.slice(0, 40), create_track: true, bar: startBar, name: `${g.style} (${dna.name})`.slice(0, 60),
      source: { type: 'pattern', style: g.style, bars, swing: Math.max(0.5, Math.min(0.75, g.swing || 0.5)), ...(g.layers ? { layers: g.layers } : {}), seed: i + 1 },
    }));
  }
  return cmds.slice(0, 64);
}

registerFeature({
  id: 'style-memory-bank',
  title: 'Style Memory Bank',
  blurb: 'Save “my afro-tech kit” as a DNA pack (tempo, grooves, per-role mix, FX chains, master tone) and replay it on any session in one undoable Apply.',
  badge: 'DEMO',
  wave: 3,
  mount(card, ctx) {
    card.innerHTML = `
      <div class="sx-god-row"><label class="field"><span>Pack name</span><input type="text" data-sm-name placeholder="My afro-tech kit" maxlength="60" /></label><button type="button" class="btn sm" data-sm-save>Save current</button></div>
      <ul class="sx-god-list" data-sm-list></ul>
      <div class="sx-god-checks"><label><input type="checkbox" data-sm-o="tempo" checked /> Tempo</label><label><input type="checkbox" data-sm-o="mix" checked /> Levels/EQ</label><label><input type="checkbox" data-sm-o="fx" checked /> FX chains</label><label><input type="checkbox" data-sm-o="grooves" checked /> Grooves</label></div>
      <div data-sm-plan></div>
      <div class="sx-god-drop" tabindex="0" role="button" data-sm-drop>Import a pack (.json)</div><input type="file" accept="application/json,.json" hidden data-sm-file />
      <p class="fineprint" data-sm-status>Packs live in this browser (localStorage) · replay = one validated batch · DEMO</p>
    `;
    const status = card.querySelector('[data-sm-status]');
    const list = card.querySelector('[data-sm-list]');
    const opts = () => Object.fromEntries([...card.querySelectorAll('[data-sm-o]')].map((x) => [x.dataset.smO, x.checked]));
    const render = () => {
      const packs = load(KEY, []);
      list.innerHTML = packs.length ? packs.map((p, i) => `<li><span class="grow">${esc(p.name)} · ${p.bpm} BPM · ${Object.keys(p.roles || {}).join('/') || 'no roles'} · ${(p.grooves || []).length} grooves</span><button type="button" class="btn sm ghost" data-sm-prev="${i}">Preview</button><button type="button" class="btn sm primary" data-sm-play="${i}">Replay</button><button type="button" class="btn sm ghost" data-sm-dl="${i}" title="Export JSON">⇩</button><button type="button" class="btn sm ghost" data-sm-del="${i}" title="Delete pack">✕</button></li>`).join('') : '<li>No packs yet — save the current session.</li>';
    };
    render();
    card.querySelector('[data-sm-save]').addEventListener('click', () => {
      const name = card.querySelector('[data-sm-name]').value.trim() || `Style ${new Date().toLocaleTimeString()}`;
      const packs = load(KEY, []).filter((p) => p.name !== name);
      packs.unshift(captureDna(ctx, name));
      save(KEY, packs.slice(0, 24));
      render();
      setStatus(status, `Saved “${name}”`);
    });
    list.addEventListener('click', async (e) => {
      const packs = load(KEY, []);
      const b = e.target.closest('button');
      if (!b) return;
      const i = Number(b.dataset.smPrev ?? b.dataset.smPlay ?? b.dataset.smDl ?? b.dataset.smDel);
      const p = packs[i];
      if (!p) return;
      if (b.dataset.smDel != null) { packs.splice(i, 1); save(KEY, packs); render(); setStatus(status, `Deleted “${p.name}”`); return; }
      if (b.dataset.smDl != null) { downloadBlob(new Blob([JSON.stringify({ soundx_style_pack: 1, ...p }, null, 2)], { type: 'application/json' }), `${p.name.replace(/[^a-z0-9-]+/gi, '-')}.soundx-style.json`); return; }
      const cmds = replayCommands(ctx, p, opts());
      if (b.dataset.smPrev != null) { card.querySelector('[data-sm-plan]').innerHTML = planHtml(cmds.map(describeCommand), `${cmds.length} commands`); return; }
      if (!cmds.length) { setStatus(status, 'Nothing to replay with those options (no matching role tracks?)'); return; }
      setStatus(status, resultLine(await executeBatch(ctx, makeBatch(`Style replay: ${p.name}`.slice(0, 120), cmds))));
    });
    fileDrop(card.querySelector('[data-sm-drop]'), card.querySelector('[data-sm-file]'), async (file) => {
      try {
        const p = JSON.parse(await file.text());
        if (!p || typeof p !== 'object' || !p.name || !(p.roles || p.grooves)) throw new Error('not a SoundX style pack');
        const clean = { name: String(p.name).slice(0, 60), at: Date.now(), bpm: Number(p.bpm) || 120, grooves: Array.isArray(p.grooves) ? p.grooves.slice(0, 6) : [], roles: p.roles && typeof p.roles === 'object' ? p.roles : {}, master: p.master || {} };
        save(KEY, [clean, ...load(KEY, []).filter((x) => x.name !== clean.name)].slice(0, 24));
        render();
        setStatus(status, `Imported “${clean.name}” (validated again on replay)`);
      } catch (err) { setStatus(status, `✗ ${err.message}`); }
    });
  },
});
