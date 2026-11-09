/**
 * All-or-nothing executor for SoundXCommandBatch.
 *   validate → one godApply (one snapshot / Restore point) → apply every command in order.
 * Gain / pan / EQ moves are AudioParam ramps (default 20 ms) — never hard `.value` jumps.
 * Insert amounts interpolate in small steps because FX setters in fx-inserts.js are value-based.
 */
import { godApply } from './apply.js';
import { validateBatch, resolveTrack, presetAmount, PROTOCOL_VERSION } from './command-schema.js';
import { patternHits } from './genre-maps.js';
import { bounceHits } from './audio-kit.js';

export const BUFFER_REFS = new Map(); // ref -> { buffer, name }
export const TX_LOG = []; // newest last, max 40

const COLORS = { kick: '#F5C518', clap: '#E8A838', snare: '#E8A838', shaker: '#9AE6B4', conga: '#F6AD55', hat: '#C9A227', rim: '#FBD38D', logdrum: '#B794F4', tom: '#FC8181', fill: '#FC8181' };

export function registerBufferRef(buffer, name = 'Imported audio') {
  const ref = `buf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  BUFFER_REFS.set(ref, { buffer, name });
  while (BUFFER_REFS.size > 24) BUFFER_REFS.delete(BUFFER_REFS.keys().next().value);
  return ref;
}

/** meta.kind 'god-pattern' re-renders on project load / Restore (deterministic seed). */
export function installRenderers(engine) {
  if (!engine?.metaRenderers || engine.metaRenderers.has('god-pattern')) return;
  engine.metaRenderers.set('god-pattern', (meta, eng) => {
    const hits = patternHits(meta.style, meta.bars, { swing: meta.swing, seed: meta.seed, layers: meta.layers, fillLastBar: meta.fillLastBar });
    return bounceHits(eng, hits, meta.bars * 4, meta.bpm || eng.bpm);
  });
  // Explicit hit lists (fills, slices of synthesized kits) — small JSON, re-rendered on load / Restore.
  engine.metaRenderers.set('god-hits', (meta, eng) => bounceHits(eng, meta.hits || [], meta.lengthBeats || 4, meta.bpm || eng.bpm));
}

/** Add a clip whose audio is rendered from a hit list (persists through save / Restore). */
export function addHitsClip(engine, trackId, { name, startBeat, lengthBeats, hits, color = '#FC8181', tag = 'god', extra = {} }) {
  installRenderers(engine);
  return engine.addClip(trackId, {
    name, startBeat, durationBeats: lengthBeats, color,
    meta: { kind: 'god-hits', tag, hits: hits.map((h) => ({ beat: +h.beat.toFixed(4), voice: h.voice, vel: +(h.vel ?? 1).toFixed(3) })), lengthBeats, bpm: engine.bpm, ...extra },
  });
}

export const dbToLin = (db) => Math.pow(10, db / 20);
export const linToDb = (lin) => (lin <= 0.000001 ? -96 : 20 * Math.log10(lin));

export function rampParam(engine, param, target, ms = 20) {
  if (!param) return;
  const ctx = engine.ctx;
  if (!ctx) { param.value = target; return; }
  const now = ctx.currentTime;
  const t = Math.max(0.005, (Number(ms) || 0) / 1000);
  try {
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(target, now + t);
  } catch (_) {
    param.value = target;
  }
}

/** Ramp every track's gain to its mute/solo/volume target (click-free mute & solo). */
export function rampAllTrackGains(engine, ms = 20) {
  engine._soloActive = engine.tracks.some((t) => t.solo);
  engine.tracks.forEach((t) => {
    const silent = t.muted || (engine._soloActive && !t.solo);
    rampParam(engine, t.gainNode?.gain, silent ? 0 : t.volume, ms);
  });
}

function stepAmount(inserts, chanId, it, target, ms) {
  const from = Number(it.amount) || 0;
  it.amount = target;
  if (!ms || ms <= 5) { it.fx.set(target); return; }
  const steps = Math.max(2, Math.min(40, Math.round(ms / 8)));
  let k = 0;
  const tick = () => {
    k += 1;
    const v = from + (target - from) * (k / steps);
    try { it.fx.set(v); } catch (_) {}
    if (k < steps) setTimeout(tick, ms / steps);
  };
  tick();
  void inserts; void chanId;
}

/* —— Tempo: re-anchor transport without cutting audio; bar-quantized ride —— */
export function retimeBpm(engine, bpm) {
  if (!engine.isPlaying || !engine.ctx) {
    const beat = engine.pauseOffset / engine.secondsPerBeat || 0;
    engine.setBpm(bpm);
    engine.pauseOffset = beat * engine.secondsPerBeat;
    engine.currentBeat = beat;
    return;
  }
  const beat = engine.currentTime / engine.secondsPerBeat;
  const oldStart = engine.startTime;
  engine.setBpm(bpm);
  engine.pauseOffset = beat * engine.secondsPerBeat;
  engine.startTime = engine.ctx.currentTime;
  engine.currentBeat = beat;
  engine.tracks.forEach((t) => t.clips.forEach((c) => { if (c._scheduledFor === oldStart) c._scheduledFor = engine.startTime; }));
}

export function armTempoRide(engine, toBpm, bars, onDone) {
  const ride = { from: engine.bpm, to: toBpm, bars, step: 0, lastBar: null, onDone };
  engine._godTempoRide = ride;
  if (!engine._godTempoRideBound) {
    engine._godTempoRideBound = true;
    engine.on('tick', ({ bar }) => {
      const r = engine._godTempoRide;
      if (!r || !engine.isPlaying) return;
      const b = Math.floor(bar);
      if (r.lastBar === null) { r.lastBar = b; return; }
      if (b === r.lastBar) return;
      r.lastBar = b;
      r.step += 1;
      const p = Math.min(1, r.step / r.bars);
      retimeBpm(engine, Math.round((r.from + (r.to - r.from) * p) * 10) / 10);
      if (p >= 1) { engine._godTempoRide = null; r.onDone?.(); }
    });
  }
  return ride;
}

function ensureTrack(engine, name, type = 'audio') {
  return resolveTrack(engine, name) || engine.addTrack(type, name);
}

async function applyCommand(ctx, c, warnings, added = []) {
  const engine = ctx.engine;
  const inserts = ctx.inserts || engine.inserts;
  const ms = c.ramp_ms ?? 20;
  switch (c.action) {
    case 'set_parameter': {
      const t = resolveTrack(engine, c.track);
      const chan = t.master ? 'master' : t.id;
      if (c.param === 'amount') {
        const it = inserts.list(chan)[c.insert_slot];
        stepAmount(inserts, chan, it, c.value, ms);
      } else if (c.param.startsWith('eq_')) {
        const band = c.param.slice(3);
        const db = Math.round((c.value * 24 - 12) * 10) / 10;
        if (t.master) {
          engine.masterEq[band] = db;
          const node = { low: engine.masterEqLow, mid: engine.masterEqMid, high: engine.masterEqHigh }[band];
          rampParam(engine, node?.gain, db, ms);
        } else {
          t.eq[band] = db;
          const node = { low: t.eqLow, mid: t.eqMid, high: t.eqHigh }[band];
          rampParam(engine, node?.gain, db, ms);
        }
      } else if (c.param === 'volume') {
        t.volume = c.value;
        rampAllTrackGains(engine, ms);
      } else if (c.param === 'pan') {
        t.pan = c.value * 2 - 1;
        rampParam(engine, t.panNode?.pan, t.pan, ms);
      }
      break;
    }
    case 'set_track_state': {
      const t = resolveTrack(engine, c.track);
      if (t.master) {
        let lin = dbToLin(c.volume_db);
        if (lin > 1) { warnings.push('master volume above 0 dB held at unity (engine fader max)'); lin = 1; }
        engine._masterVol = lin;
        rampParam(engine, engine.masterGain?.gain, lin, ms);
        break;
      }
      if (c.volume_db !== undefined) {
        let lin = dbToLin(c.volume_db);
        if (lin > 1) { warnings.push(`${t.name}: ${c.volume_db} dB held at unity (engine fader max 0 dB)`); lin = 1; }
        t.volume = lin;
      }
      if (c.mute !== undefined) t.muted = c.mute;
      if (c.solo !== undefined) t.solo = c.solo;
      if (c.pan !== undefined) { t.pan = c.pan; rampParam(engine, t.panNode?.pan, c.pan, ms); }
      rampAllTrackGains(engine, ms);
      break;
    }
    case 'insert_fx': {
      const t = resolveTrack(engine, c.track) || ensureTrack(engine, c.track);
      const chan = t.master ? 'master' : t.id;
      const it = inserts.add(chan, c.fx_id, presetAmount(c.preset));
      if (!it) throw new Error(`could not insert ${c.fx_id} on ${t.name}`);
      it._god = true;
      added.push({ chan, uid: it.uid });
      break;
    }
    case 'remove_fx': {
      const t = resolveTrack(engine, c.track);
      const chan = t.master ? 'master' : t.id;
      const it = inserts.list(chan)[c.slot];
      if (it) inserts.remove(chan, it.uid);
      break;
    }
    case 'set_loop_region':
      engine.setLoopRegion(c.start_bar, c.end_bar, c.looping ?? true);
      break;
    case 'set_bpm':
      if (c.ramp_bars) {
        armTempoRide(engine, c.bpm, c.ramp_bars);
        if (!engine.isPlaying) warnings.push(`tempo ride armed: ${engine.bpm}→${c.bpm} BPM over ${c.ramp_bars} bars once you press Play`);
      } else retimeBpm(engine, c.bpm);
      break;
    case 'add_clip': {
      const t = c.create_track ? ensureTrack(engine, c.track) : resolveTrack(engine, c.track);
      const src = c.source;
      const startBeat = c.bar * 4;
      if (src.type === 'buffer-ref') {
        const ref = BUFFER_REFS.get(src.ref);
        const dur = src.duration_beats ?? Math.max(0.25, Math.round((ref.buffer.duration / engine.secondsPerBeat) * 4) / 4);
        engine.addClip(t.id, { name: c.name || ref.name, startBeat, durationBeats: dur, color: c.color || '#63B3ED', buffer: ref.buffer, meta: { kind: 'god-buffer', source: ref.name } });
      } else if (src.type === 'pattern') {
        installRenderers(engine);
        const meta = {
          kind: 'god-pattern', style: src.style, bars: src.bars, swing: src.swing ?? 0.5, seed: src.seed ?? 1,
          layers: src.layers || null, fillLastBar: !!src.fill_last_bar, bpm: engine._godTempoRide?.to || engine.bpm,
        };
        const layer = (src.layers || [])[0] || 'kick';
        engine.addClip(t.id, { name: c.name || `${src.style} ${src.bars} bars`, startBeat, durationBeats: src.bars * 4, color: c.color || COLORS[layer] || '#F5C518', meta });
      } else if (src.type === 'notes') {
        const end = src.notes.reduce((m, n) => Math.max(m, n.beat + (n.dur || 0.25)), 0);
        engine.addClip(t.id, { name: c.name || 'Agent notes', startBeat, durationBeats: src.duration_beats ?? Math.max(1, Math.ceil(end)), color: c.color || '#90CDF4', notes: src.notes.map((n) => ({ ...n })) });
      }
      break;
    }
    default:
      throw new Error(`unsupported action ${c.action}`);
  }
}

/**
 * @param {object} ctx  God Mode ctx (engine, inserts, sessionVersions, toast …)
 * @param {object} batch SoundXCommandBatch
 * @param {{extra?: () => (void|Promise<void>), quiet?: boolean}} opts
 */
export async function executeBatch(ctx, batch, { extra = null, quiet = false } = {}) {
  const engine = ctx?.engine;
  const env = { engine, inserts: ctx?.inserts || engine?.inserts, bufferRefs: BUFFER_REFS };
  const v = validateBatch(batch, env);
  const txId = batch?.transaction_id || null;
  if (!v.ok) {
    const res = { status: 'error', transaction_id: txId, applied_commands: 0, errors: v.errors };
    if (!quiet) ctx?.toast?.(`Agent batch rejected · ${v.errors[0].code}: ${v.errors[0].message}`, 'warn');
    logTx(batch, res);
    return res;
  }
  let applied = 0;
  const warnings = [];
  const added = [];
  try {
    await engine.init();
    installRenderers(engine);
    await godApply(ctx, batch.description, async () => {
      for (const c of batch.commands) {
        await applyCommand(ctx, c, warnings, added);
        applied += 1;
      }
      if (extra) await extra();
      engine._emit?.('tracks', engine.tracks);
    });
  } catch (e) {
    // Insert chains are not part of project JSON, so roll back FX this batch added by hand.
    added.forEach(({ chan, uid }) => { try { env.inserts?.remove(chan, uid); } catch (_) {} });
    const res = {
      status: 'error', transaction_id: txId, applied_commands: 0,
      errors: [{ command_index: applied, code: 'APPLY_FAILED', message: e?.message || String(e) }], restored: true,
    };
    logTx(batch, res);
    return res;
  }
  const res = { status: 'success', transaction_id: txId, applied_commands: applied, warnings };
  if (warnings.length && !quiet) ctx?.toast?.(warnings[0], 'warn');
  logTx(batch, res);
  return res;
}

function logTx(batch, res) {
  TX_LOG.push({ at: Date.now(), description: batch?.description, commands: batch?.commands?.length || 0, result: res, protocol: PROTOCOL_VERSION });
  while (TX_LOG.length > 40) TX_LOG.shift();
  try { window.dispatchEvent(new CustomEvent('sx-god:tx', { detail: { batch, result: res } })); } catch (_) {}
}

/** Short status line for cards. */
export function resultLine(res) {
  if (!res) return '';
  if (res.status === 'success') return `✓ ${res.applied_commands} command${res.applied_commands === 1 ? '' : 's'} applied · one Restore point${res.warnings?.length ? ` · ${res.warnings.join('; ')}` : ''}`;
  return `✗ nothing applied · ${res.errors.map((e) => `#${e.command_index} ${e.code} ${e.message}`).join(' | ')}`;
}

/** Remove every insert an agent batch added (inserts are not in snapshots, so Restore keeps them). */
export function clearAgentFx(ctx) {
  const engine = ctx?.engine;
  const inserts = ctx?.inserts || engine?.inserts;
  if (!engine || !inserts?.list) return 0;
  let n = 0;
  ['master', ...engine.tracks.map((t) => t.id)].forEach((chan) => {
    [...inserts.list(chan)].forEach((it) => { if (it._god) { inserts.remove(chan, it.uid); n += 1; } });
  });
  return n;
}
