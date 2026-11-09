/**
 * Local intent router for Intent Co-Pilot + AGI Desk (+ Assist parse when LIVE).
 * Text → { kind: 'commands' | 'route' | 'refuse' | 'unknown', commands?, route?, say }.
 * Commands are SoundXCommandBatch items — always validated before anything changes.
 * Never claims cloud full-song generation; refuses streaming rips, voice clones, Suno/Udio.
 */
import { resolveTrack, makeBatch, validateBatch } from './command-schema.js';
import { findSection, songBars, endLoopRange } from './sections.js';
import { findRoleTrack, roleFromWord } from './roles.js';
import { morphCommands, GENRES, guessGenre } from './genre-maps.js';
import { linToDb } from './command-exec.js';

const FX_WORDS = [
  [/reverb|space|room|hall/, 'space'], [/delay|echo/, 'delay'], [/chorus|wide|widen/, 'chorus'],
  [/compress|glue|punch/, 'comp'], [/distort|drive|satur|grit|dirt/, 'drive'], [/crush|lo-?fi|bitcrush/, 'crush'],
  [/filter|muffle/, 'filter'], [/limit/, 'limiter'], [/low ?cut|high ?pass|hpf/, 'eqlow'],
];

const GENRE_WORDS = [
  [/afro ?tech/, 'afrotech'], [/afro ?house/, 'afrohouse'], [/amapiano|piano ?piano|yanos/, 'amapiano'],
  [/gqom/, 'gqom'], [/\bhouse\b/, 'house'],
];
const SOURCE_WORDS = [[/hip ?hop|hiphop/, 'hiphop'], [/boom ?bap/, 'boombap'], [/trap/, 'trap'], [/amapiano/, 'amapiano'], [/\bhouse\b/, 'house']];

export const ROUTES = [
  [/link|url|http|import (a )?(song|track|audio)/, 'link-pull-agent', 'Link Pull Agent imports audio from a direct file link (or a dropped file).'],
  [/export|bounce|wav/, 'export-loop-clip', 'Export Loop Clip bounces the loop region to WAV.'],
  [/hook/, 'hook-likelihood-scout', 'Hook Likelihood Scout ranks 2–8 bar windows.'],
  [/fill/, 'fill-generator-net', 'Fill Generator Net writes a percussion fill from your last bar.'],
  [/clip(ping)?|distorting|too loud|peak/, 'safety-fader', 'Safety Fader guards peaks before export.'],
  [/balance|mix (it|this)|level/, 'auto-mix-balancer', 'Auto-Mix Balancer trims gains by role.'],
  [/lyric|words|syllable/, 'lyric-melody-sketch', 'Lyric → Melody Sketch turns lyrics into a MIDI sketch.'],
  [/reference|sound like (this|my ref)/, 'reference-embed-match', 'Reference Embed Match compares your mix to a reference clip.'],
  [/chord|harmony|progression/, 'harmony-suggest-net', 'Harmony Suggest Net proposes next chords in key.'],
  [/critic|review|feedback|what.*wrong|score/, 'arrangement-critic', 'Arrangement Critic scores structure and suggests fixes.'],
  [/energy|where.*drop|find.*drop/, 'energy-predictor', 'Energy Predictor charts bar energy and snaps loops to peaks.'],
  [/role|classif|which track is/, 'stem-role-classifier', 'Stem Role Classifier tags tracks from audio stats.'],
  [/swing|groove|shuffle/, 'swing-dial-ai', 'Swing Dial AI applies groove templates.'],
  [/transition|riser|sweep/, 'transition-glue', 'Transition Glue adds risers / impacts at section changes.'],
  [/duck|sidechain/, 'vocal-duck-conductor', 'Vocal Duck Conductor ducks music under vocals.'],
  [/diff|what changed/, 'diff-explain', 'Diff Explain describes what changed between snapshots.'],
  [/checklist|finish (the|my) song|what next/, 'copilot-checklist', 'Co-Pilot Checklist walks finish-the-song steps.'],
  [/arrange|skeleton|start a (song|beat)/, 'prompt-arrangement', 'Prompt → Arrangement builds a local Drums/Bass/Chords/Lead skeleton.'],
];

const REFUSE_RX = [
  /\b(suno|udio)\b/,
  /\b(rip|download|grab|steal)\b.*\b(youtube|spotify|apple music|soundcloud|tiktok|deezer)\b/,
  /\bclone\b.*\bvoice\b|\bvoice of\b|\bsound(s)? exactly like\b/,
  /\b(generate|make|create|write|produce|compose)\b.*\b(full|entire|whole|complete|finished|radio[- ]ready)\b.*\b(song|track|album|record)\b/,
  /\b(generate|make|create)\b.*\bsong\b.*\bwith (ai )?vocals\b/,
  /\bcloud\b.*\bgenerat/, /\bagi\b.*\b(write|make|generate)\b.*\bsong\b/,
];

export const REFUSAL = 'Honest answer: SoundX runs local Web Audio tools — it cannot generate a finished song with vocals, call cloud music models (Suno/Udio), clone voices, or rip streaming links. '
  + 'Closest local tools: Prompt → Arrangement (skeleton), Genre Morph Agent, Lyric → Melody Sketch, Link Pull Agent (direct audio files you own).';

function trackFromText(engine, s) {
  const named = [...(engine?.tracks || [])].sort((a, b) => b.name.length - a.name.length)
    .find((t) => t.name.length > 1 && s.includes(t.name.toLowerCase()));
  if (named) return named;
  const words = s.split(/[^a-z0-9]+/);
  for (const w of words) {
    const role = roleFromWord(w);
    if (role) { const t = findRoleTrack(engine, role); if (t) return t; }
  }
  return null;
}

function curDb(t) { return Math.round(linToDb(t.volume ?? 0.8) * 10) / 10; }

export function routeIntent(text, { engine, inserts } = {}) {
  const s = ` ${String(text || '').toLowerCase().trim()} `;
  if (!s.trim()) return { kind: 'unknown', say: 'Say what you want — e.g. “make the drop harder”, “loop the last 8 bars”, “turn this hip hop into afro tech”.' };
  if (REFUSE_RX.some((rx) => rx.test(s))) return { kind: 'refuse', say: REFUSAL, route: 'prompt-arrangement' };

  const cmds = [];
  const notes = [];
  const t = trackFromText(engine, s);

  // Genre morph
  const to = GENRE_WORDS.find(([rx]) => rx.test(s));
  if (to && /(turn|make|convert|morph|into|to |switch|flip|remix)/.test(s)) {
    const fromMatch = SOURCE_WORDS.find(([rx, id]) => rx.test(s) && id !== to[1]);
    const from = fromMatch ? fromMatch[1] : guessGenre(engine?.bpm || 120);
    const drums = findRoleTrack(engine, 'drums');
    const bars = Math.max(4, Math.min(16, songBars(engine) || 8));
    cmds.push(...morphCommands(from, to[1], { bars, sourceDrumTrack: drums?.name || null, muteSource: !!drums }));
    notes.push(`${GENRES[from].label} → ${GENRES[to[1]].label} at ${GENRES[to[1]].target} BPM over ${bars} bars`);
  }

  // Tempo
  const bpmM = s.match(/(?:bpm|tempo)\D{0,12}(\d{2,3})|(\d{2,3})\s*bpm/);
  if (bpmM && !to) {
    const bpm = Number(bpmM[1] || bpmM[2]);
    const ramp = s.match(/over (\d{1,2}) bars?/);
    cmds.push({ action: 'set_bpm', bpm, ...(ramp ? { ramp_bars: Number(ramp[1]) } : {}) });
  } else if (/\b(faster|speed (it )?up)\b/.test(s)) cmds.push({ action: 'set_bpm', bpm: Math.round((engine?.bpm || 120) + 5) });
  else if (/\b(slower|slow (it )?down)\b/.test(s)) cmds.push({ action: 'set_bpm', bpm: Math.round((engine?.bpm || 120) - 5) });

  // Loop
  if (/\bloop\b/.test(s)) {
    if (/\b(stop|off|disable|no)\b.*loop|loop.*\boff\b/.test(s)) {
      cmds.push({ action: 'set_loop_region', start_bar: engine.loopStart, end_bar: Math.max(engine.loopStart + 0.25, engine.loopEnd), looping: false });
    } else {
      const lastN = s.match(/last (\d{1,2}) bars?/);
      const range = s.match(/bars? (\d{1,3}) (?:to|-|–|through) (\d{1,3})/);
      const sec = s.match(/\b(intro|verse|drop|chorus|hook|break|bridge|outro|end)\b/);
      if (range) cmds.push({ action: 'set_loop_region', start_bar: Number(range[1]) - 1, end_bar: Number(range[2]), looping: true });
      else if (lastN || /\bend\b/.test(s)) {
        const r = endLoopRange(engine, lastN ? Number(lastN[1]) : 4);
        cmds.push({ action: 'set_loop_region', start_bar: r.startBar, end_bar: r.endBar, looping: true });
      } else if (sec) {
        const found = findSection(engine, sec[1] === 'chorus' || sec[1] === 'hook' ? 'drop' : sec[1]);
        if (found) cmds.push({ action: 'set_loop_region', start_bar: found.startBar, end_bar: found.endBar, looping: true });
      }
    }
  }

  // Drop harder / punchier
  if (/\b(harder|punch(ier)?|hit harder|more energy|bigger|slap)\b/.test(s)) {
    const drums = findRoleTrack(engine, 'drums') || engine?.tracks?.[0];
    const bass = findRoleTrack(engine, 'bass');
    const drop = findSection(engine, 'drop');
    if (drop && !cmds.some((c) => c.action === 'set_loop_region')) cmds.push({ action: 'set_loop_region', start_bar: drop.startBar, end_bar: drop.endBar, looping: true });
    if (drums) {
      cmds.push({ action: 'set_track_state', track: drums.name, volume_db: Math.min(0, curDb(drums) + 2), ramp_ms: 40 });
      if ((inserts?.list?.(drums.id)?.length || 0) < 6) cmds.push({ action: 'insert_fx', track: drums.name, fx_id: 'comp', preset: 'heavy' });
    }
    if (bass) cmds.push({ action: 'set_parameter', track: bass.name, param: 'eq_low', value: 0.6, ramp_ms: 40 });
    cmds.push({ action: 'set_parameter', track: 'master', param: 'eq_high', value: 0.56, ramp_ms: 40 });
    notes.push('drop: drums +2 dB, heavy comp, bass low shelf +2.4 dB, master air +1.4 dB');
  }

  // Volume
  const louder = /\b(louder|turn up|boost|raise|bring up)\b/.test(s);
  const quieter = /\b(quieter|softer|turn down|lower|bring down|reduce)\b/.test(s);
  if ((louder || quieter) && t && !/harder|punch/.test(s)) {
    const delta = louder ? 3 : -3;
    cmds.push({ action: 'set_track_state', track: t.name, volume_db: Math.max(-60, Math.min(0, curDb(t) + delta)), ramp_ms: 40 });
  }
  // Mute / solo
  if (/\bunmute\b/.test(s) && t) cmds.push({ action: 'set_track_state', track: t.name, mute: false });
  else if (/\bmute\b/.test(s) && t) cmds.push({ action: 'set_track_state', track: t.name, mute: true });
  if (/\bunsolo\b/.test(s) && t) cmds.push({ action: 'set_track_state', track: t.name, solo: false });
  else if (/\bsolo\b/.test(s) && t) cmds.push({ action: 'set_track_state', track: t.name, solo: true });
  // Pan
  const pan = s.match(/pan\b.*\b(left|right|center|centre)/);
  if (pan && t) cmds.push({ action: 'set_track_state', track: t.name, pan: pan[1] === 'left' ? -0.6 : pan[1] === 'right' ? 0.6 : 0, ramp_ms: 60 });
  // FX
  if (/\b(add|put|give|insert|more)\b/.test(s)) {
    FX_WORDS.forEach(([rx, fx]) => {
      if (!rx.test(s)) return;
      if (fx === 'comp' && /harder|punch/.test(s)) return;
      const target = t ? t.name : 'master';
      const id = t ? t.id : 'master';
      if ((inserts?.list?.(id)?.length || 0) < 6) cmds.push({ action: 'insert_fx', track: target, fx_id: fx, preset: /\b(lot|heavy|loads|much)\b/.test(s) ? 'heavy' : /\b(bit|touch|little|subtle)\b/.test(s) ? 'light' : 'medium' });
    });
  }
  if (/\b(remove|clear|strip)\b.*\b(fx|effects|inserts|plugins)\b/.test(s)) {
    const id = t ? t.id : 'master';
    const n = inserts?.list?.(id)?.length || 0;
    for (let i = n - 1; i >= 0; i--) cmds.push({ action: 'remove_fx', track: t ? t.name : 'master', slot: i });
  }
  // Tone
  if (/\b(brighter|more air|crisp)\b/.test(s)) cmds.push({ action: 'set_parameter', track: t ? t.name : 'master', param: 'eq_high', value: 0.62, ramp_ms: 60 });
  if (/\b(darker|warmer|less harsh)\b/.test(s)) cmds.push({ action: 'set_parameter', track: t ? t.name : 'master', param: 'eq_high', value: 0.38, ramp_ms: 60 });
  if (/\bmore (bass|low end|bottom)\b/.test(s)) cmds.push({ action: 'set_parameter', track: 'master', param: 'eq_low', value: 0.62, ramp_ms: 60 });
  if (/\bless (bass|low end|mud)\b|\bmuddy\b/.test(s)) cmds.push({ action: 'set_parameter', track: 'master', param: 'eq_low', value: 0.4, ramp_ms: 60 });

  if (cmds.length) {
    const say = `Plan: ${cmds.length} command${cmds.length === 1 ? '' : 's'}${notes.length ? ` — ${notes.join('; ')}` : ''}. Review, then Apply (one Restore point).`;
    return { kind: 'commands', commands: cmds.slice(0, 64), say, description: String(text).trim().slice(0, 120) };
  }
  const route = ROUTES.find(([rx]) => rx.test(s));
  if (route) return { kind: 'route', route: route[1], say: `${route[2]} Opening that card.` };
  void resolveTrack;
  return { kind: 'unknown', say: 'No matching local tool. Try: “loop the drop”, “make the drop harder”, “bpm 124 over 8 bars”, “add delay to keys”, “turn this into afro tech”, “find the hook”.' };
}

/**
 * Assist LIVE parse (only when /health ok). Output is still validated; on any failure → local router.
 */
export async function assistIntent(text, { engine, inserts, timeoutMs = 9000 } = {}) {
  const tracks = (engine?.tracks || []).map((t) => t.name).join(', ');
  const prompt = [
    'You are the SoundX command planner. Reply with ONLY JSON: {"commands":[...],"say":"..."}.',
    'Allowed actions: set_parameter{track,param(amount|volume|pan|eq_low|eq_mid|eq_high),value 0-1,insert_slot?,ramp_ms?},',
    'set_track_state{track,volume_db -96..12,pan -1..1,mute,solo}, insert_fx{track,fx_id(comp|eqlow|filter|drive|crush|delay|chorus|space|limiter),preset 0-1},',
    'remove_fx{track,slot}, set_loop_region{start_bar,end_bar,looping}, set_bpm{bpm 40-220,ramp_bars?}.',
    `Tracks: ${tracks}. Song bars: ${songBars(engine)}. BPM: ${engine?.bpm}.`,
    'Never claim to generate full songs, vocals or use cloud music models.',
    `User: ${text}`,
  ].join('\n');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch('/api/cartel/index.php?path=/api/mercatus-cartel/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ message: prompt, history: [] }), signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`assist ${r.status}`);
    const data = await r.json();
    const reply = String(data.reply || data.message || data.content || '');
    const m = reply.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('no json');
    const parsed = JSON.parse(m[0]);
    const commands = Array.isArray(parsed.commands) ? parsed.commands.slice(0, 64) : [];
    if (!commands.length) throw new Error('no commands');
    const v = validateBatch(makeBatch(text.slice(0, 120), commands), { engine, inserts, bufferRefs: new Map() });
    return { kind: 'commands', commands, say: `${parsed.say || 'Assist plan'} · Assist LIVE`, source: 'assist', validation: v };
  } finally {
    clearTimeout(timer);
  }
}
