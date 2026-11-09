/**
 * W3 #2 Arrangement Critic — local rule set over sections, bar activity, levels and transitions.
 * Scores 0–100 and offers a concrete fix per finding (batch, Wave 2 helper, or the right card).
 * Rules, not a trained model.
 */
import { registerFeature } from '../registry.js';
import { makeBatch } from '../command-schema.js';
import { executeBatch, resultLine, linToDb } from '../command-exec.js';
import { detectSections, barActivity, songBars, findSection } from '../sections.js';
import { roleOfTrack, findRoleTrack } from '../roles.js';
import { GENRES, guessGenre } from '../genre-maps.js';
import { runTransitionGlue } from '../wave2/transition-glue.js?v=20261008md-sxs20261020b';
import { runFillAutopilot } from '../wave2/fill-autopilot.js?v=20261008md-sxs20261020b';
import { setStatus, focusCard, esc } from '../w23-ui.js';

/** @returns {{score:number, findings:Array<{id,sev,text,fix?:{kind,label,arg?}}>, sections}} */
export function critique(engine) {
  const findings = [];
  const add = (id, sev, text, fix) => findings.push({ id, sev, text, fix });
  const bars = songBars(engine);
  const secs = detectSections(engine);
  const act = barActivity(engine, bars);
  const tracks = engine.tracks.filter((t) => t.clips.length);
  if (!tracks.length) return { score: 0, findings: [{ id: 'empty', sev: 3, text: 'The session is empty — nothing to critique yet.', fix: { kind: 'card', label: 'Prompt → Arrangement', arg: 'prompt-arrangement' } }], sections: [] };

  if (bars < 16) add('short', 3, `Only ${bars} bars long — most club/radio songs run 48–96 bars.`, { kind: 'card', label: 'Arrangement Scale', arg: 'arrangement-scale' });
  else if (bars < 32) add('shortish', 1, `${bars} bars — fine for a loop or sketch, short for a full song.`, { kind: 'card', label: 'Arrangement Scale', arg: 'arrangement-scale' });

  const counts = act.map((a) => a.tracks.size);
  const distinct = new Set(counts).size;
  if (bars >= 8 && distinct <= 1) add('flat', 3, 'Every bar has the same number of active tracks — no build, no break, no drop.', { kind: 'card', label: 'Mute/Solo Storyboard', arg: 'mute-solo-storyboard' });
  if (secs[0]?.source === 'proportional' && bars >= 8) add('no-structure', 2, 'No audible section changes — sections are only a proportional guess.', { kind: 'card', label: 'Mute/Solo Storyboard', arg: 'mute-solo-storyboard' });
  else if (secs.length < 3 && bars >= 16) add('few-sections', 2, `Only ${secs.length} section${secs.length === 1 ? '' : 's'} detected — add a break or a second drop.`, { kind: 'card', label: 'Contrast Automator', arg: 'contrast-automator' });

  const max = Math.max(...counts, 1);
  if (counts[0] === max && bars >= 8) add('cold-open', 1, 'The song starts at full density — a 4–8 bar intro gives DJs and listeners a run-up.', { kind: 'loop', label: 'Loop intro bars 1–4', arg: [0, 4] });
  if (counts[counts.length - 1] === max && bars >= 8) add('hard-stop', 1, 'The last bar is at full density — the song stops abruptly.', { kind: 'fills', label: 'Fill before the end' });

  const hasTransitions = engine.tracks.some((t) => t.clips.some((c) => c.meta?.tag === 'transition-glue'));
  if (secs.length > 1 && !hasTransitions) add('no-transitions', 2, `${secs.length - 1} section change${secs.length > 2 ? 's' : ''} with no riser/impact.`, { kind: 'glue', label: 'Glue transitions' });
  const hasFills = engine.tracks.some((t) => t.clips.some((c) => /fill/.test(c.meta?.tag || '') || /fill/i.test(c.name || '')));
  if (secs.length > 1 && !hasFills) add('no-fills', 1, 'No drum fills into new sections.', { kind: 'fills', label: 'Insert fills' });

  const drums = findRoleTrack(engine, 'drums');
  const others = engine.tracks.filter((t) => t !== drums && !t.muted && t.clips.length);
  if (drums && others.length) {
    const dDb = linToDb(drums.volume ?? 0.8);
    const loud = others.filter((t) => linToDb(t.volume ?? 0.8) > dDb + 1.5 && roleOfTrack(t) !== 'vox');
    if (loud.length) add('levels', 2, `${loud.map((t) => t.name).join(', ')} sit${loud.length === 1 ? 's' : ''} above the drums on the fader.`, { kind: 'batch', label: 'Pull them 3 dB under drums', arg: loud.map((t) => ({ action: 'set_track_state', track: t.id, volume_db: Math.max(-40, Math.round((dDb - 3) * 10) / 10), ramp_ms: 60 })) });
  }
  if (!engine.tracks.some((t) => roleOfTrack(t) === 'bass' && t.clips.length)) add('no-bass', 1, 'No bass role found — low end may feel thin (or run Stem Role Classifier).', { kind: 'card', label: 'Stem Role Classifier', arg: 'stem-role-classifier' });
  const g = GENRES[guessGenre(engine.bpm)];
  if (g && (engine.bpm < g.bpm[0] - 4 || engine.bpm > g.bpm[1] + 4)) add('tempo', 0, `${engine.bpm} BPM sits between genre pockets (nearest: ${g.label} ${g.bpm[0]}–${g.bpm[1]}).`, null);
  if (engine.tracks.filter((t) => t.muted).length >= Math.max(2, engine.tracks.length / 2)) add('muted', 1, 'Half the tracks are muted — clean up or bounce.', null);
  const drop = findSection(engine, 'drop');
  if (!drop && bars >= 16) add('no-drop', 2, 'No clear drop / peak section.', { kind: 'card', label: 'Energy Predictor', arg: 'energy-predictor' });

  const penalty = findings.reduce((m, f) => m + [3, 6, 12, 20][f.sev], 0);
  return { score: Math.max(0, 100 - penalty), findings: findings.sort((a, b) => b.sev - a.sev), sections: secs };
}

registerFeature({
  id: 'arrangement-critic',
  title: 'Arrangement Critic',
  blurb: 'Scores your structure (length, contrast, intro/outro, transitions, levels) with local rules and gives a one-click fix per issue.',
  badge: 'DEMO',
  wave: 3,
  mount(card, ctx) {
    card.innerHTML = `
      <div class="sx-god-row"><span class="sx-god-score" data-ac-score>—</span><span class="fineprint" data-ac-secs></span></div>
      <ul class="sx-god-list" data-ac-list></ul>
      <div class="btn-row"><button type="button" class="btn primary sm" data-ac-go>Critique arrangement</button></div>
      <p class="fineprint" data-ac-status>${'12 local rules · no cloud model · each fix = Restore point'}</p>
    `;
    const engine = ctx.engine;
    const list = card.querySelector('[data-ac-list]');
    const status = card.querySelector('[data-ac-status]');
    let last = null;
    const SEV = ['info', 'minor', 'major', 'critical'];
    const run = () => {
      last = critique(engine);
      card.querySelector('[data-ac-score]').textContent = `${last.score}/100`;
      card.querySelector('[data-ac-secs]').textContent = last.sections.map((s) => s.label).join(' → ') + (last.sections[0]?.source === 'proportional' ? ' (guessed)' : '');
      list.innerHTML = last.findings.length
        ? last.findings.map((f, i) => `<li><span class="grow" title="${esc(f.text)}">${SEV[f.sev]} · ${esc(f.text)}</span>${f.fix ? `<button type="button" class="btn sm ghost" data-ac-fix="${i}">${esc(f.fix.label)}</button>` : ''}</li>`).join('')
        : '<li>No issues found by the rule set.</li>';
      setStatus(status, `${last.findings.length} finding${last.findings.length === 1 ? '' : 's'} · rules only, use your ears`);
    };
    card.querySelector('[data-ac-go]').addEventListener('click', run);
    list.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-ac-fix]');
      if (!b || !last) return;
      const f = last.findings[Number(b.dataset.acFix)];
      try {
        if (f.fix.kind === 'card') { focusCard(f.fix.arg); return; }
        if (f.fix.kind === 'glue') setStatus(status, `✓ ${await runTransitionGlue(ctx)} transition clips added · undo via Restore`);
        else if (f.fix.kind === 'fills') setStatus(status, `✓ ${await runFillAutopilot(ctx)} fills added · undo via Restore`);
        else if (f.fix.kind === 'loop') setStatus(status, resultLine(await executeBatch(ctx, makeBatch('Critic: loop intro', [{ action: 'set_loop_region', start_bar: f.fix.arg[0], end_bar: f.fix.arg[1], looping: true }]))));
        else if (f.fix.kind === 'batch') setStatus(status, resultLine(await executeBatch(ctx, makeBatch(`Critic: ${f.fix.label}`.slice(0, 120), f.fix.arg))));
      } catch (err) { setStatus(status, `✗ ${err.message}`); }
    });
  },
});
