/**
 * SoundXCommandBatch — one structured command format for every God Mode agent
 * (Intent Co-Pilot, AGI Desk, Session Autopilot, Link Pull, Genre Morph, Genre Graph Router,
 * Co-Pilot Checklist …). Adapted from the DAW-agent architecture notes in the spec:
 * validate everything first, apply all-or-nothing, reject (never silently clamp) bad values.
 */
import { FX_TYPES } from '../../audio/fx-inserts.js';
import { PATTERN_STYLES } from './genre-maps.js';
import { songBars } from './sections.js';

export const PROTOCOL_VERSION = '1.0.0';
export const ACTIONS = ['set_parameter', 'set_track_state', 'insert_fx', 'remove_fx', 'set_loop_region', 'set_bpm', 'add_clip'];
export const PARAMS = ['amount', 'volume', 'pan', 'eq_low', 'eq_mid', 'eq_high'];
export const MAX_CHAIN = 6;
export const MAX_BARS = 160;
const PRESETS = { light: 0.3, medium: 0.55, heavy: 0.8 };

function uuid() {
  try { return crypto.randomUUID(); } catch (_) {
    return 'tx-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }
}

export function makeBatch(description, commands = []) {
  return {
    protocol_version: PROTOCOL_VERSION,
    transaction_id: uuid(),
    timestamp: new Date().toISOString(),
    description: String(description || 'Agent batch').slice(0, 128),
    commands,
  };
}

/** Resolve a track reference: 'master' | id | 0-based index | name (exact, then prefix, then contains). */
export function resolveTrack(engine, ref) {
  if (ref == null || ref === '') return null;
  if (ref === 'master' || ref === 'Master') return { id: 'master', name: 'Master', master: true };
  const tracks = engine?.tracks || [];
  if (typeof ref === 'number') return Number.isInteger(ref) ? tracks[ref] || null : null;
  const s = String(ref);
  const byId = tracks.find((t) => t.id === s);
  if (byId) return byId;
  const q = s.toLowerCase().trim();
  return tracks.find((t) => t.name.toLowerCase() === q)
    || tracks.find((t) => t.name.toLowerCase().startsWith(q))
    || tracks.find((t) => t.name.toLowerCase().includes(q))
    || null;
}

export function presetAmount(p) {
  if (p == null) return 0.5;
  if (typeof p === 'number') return p;
  return PRESETS[String(p).toLowerCase()] ?? NaN;
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isBool = (v) => typeof v === 'boolean';
const isInt = (v) => Number.isInteger(v);

/**
 * @param {object} batch
 * @param {{engine, inserts, bufferRefs?: Map}} env
 * @returns {{ok: boolean, errors: Array<{command_index:number, code:string, message:string}>}}
 */
export function validateBatch(batch, env = {}) {
  const errors = [];
  const err = (i, code, message) => errors.push({ command_index: i, code, message });
  const engine = env.engine;
  if (!batch || typeof batch !== 'object') { err(-1, 'BAD_BATCH', 'batch must be an object'); return { ok: false, errors }; }
  if (batch.protocol_version !== PROTOCOL_VERSION) err(-1, 'BAD_BATCH', `protocol_version must be "${PROTOCOL_VERSION}"`);
  if (!batch.transaction_id || typeof batch.transaction_id !== 'string') err(-1, 'BAD_BATCH', 'transaction_id required');
  if (typeof batch.description !== 'string' || !batch.description.trim()) err(-1, 'BAD_BATCH', 'description required');
  else if (batch.description.length > 128) err(-1, 'OUT_OF_RANGE', 'description max 128 chars');
  const cmds = batch.commands;
  if (!Array.isArray(cmds) || cmds.length < 1 || cmds.length > 64) {
    err(-1, 'OUT_OF_RANGE', 'commands must hold 1–64 items');
    return { ok: false, errors };
  }
  if (!engine) { err(-1, 'NOT_SUPPORTED', 'engine unavailable'); return { ok: false, errors }; }

  // Simulated state so later commands see earlier ones (chain sizes, created tracks).
  const chainLen = new Map();
  const lenOf = (id) => {
    if (!chainLen.has(id)) chainLen.set(id, env.inserts?.list ? env.inserts.list(id).length : 0);
    return chainLen.get(id);
  };
  const created = new Set();
  // Song length as it will be after this batch (add_clip can extend it before a later set_loop_region).
  const songLen = cmds.reduce((m, c) => {
    if (c?.action !== 'add_clip' || !isNum(c.bar)) return m;
    const src = c.source || {};
    const beats = src.type === 'pattern' ? (Number(src.bars) || 0) * 4 : (Number(src.duration_beats) || 4);
    return Math.max(m, Math.ceil(c.bar + beats / 4));
  }, Math.max(16, songBars(engine)));

  const trackOf = (i, ref, { allowMaster = true, allowCreate = false } = {}) => {
    if (ref == null || ref === '') { err(i, 'BAD_TYPE', 'track required'); return null; }
    const t = resolveTrack(engine, ref);
    if (t) {
      if (t.master && !allowMaster) { err(i, 'NOT_SUPPORTED', 'master not allowed for this action'); return null; }
      return t;
    }
    const key = String(ref).toLowerCase();
    if (created.has(key)) return { id: `new:${key}`, name: String(ref), pending: true };
    if (allowCreate && typeof ref === 'string') { created.add(key); return { id: `new:${key}`, name: ref, pending: true }; }
    err(i, 'TRACK_NOT_FOUND', `track "${ref}" not found`);
    return null;
  };
  const range = (i, field, v, lo, hi, { optional = false, int = false } = {}) => {
    if (v === undefined && optional) return true;
    if (!isNum(v) || (int && !isInt(v))) { err(i, 'BAD_TYPE', `${field} must be ${int ? 'an integer' : 'a number'}`); return false; }
    if (v < lo || v > hi) { err(i, 'OUT_OF_RANGE', `${field} ${v} outside ${lo}–${hi}`); return false; }
    return true;
  };

  cmds.forEach((c, i) => {
    if (!c || typeof c !== 'object') { err(i, 'BAD_TYPE', 'command must be an object'); return; }
    if (!ACTIONS.includes(c.action)) { err(i, 'UNKNOWN_ACTION', `unknown action "${c.action}"`); return; }
    switch (c.action) {
      case 'set_parameter': {
        const t = trackOf(i, c.track);
        if (!PARAMS.includes(c.param)) { err(i, 'NOT_SUPPORTED', `param "${c.param}" not supported (${PARAMS.join(', ')})`); return; }
        range(i, 'value', c.value, 0, 1);
        range(i, 'ramp_ms', c.ramp_ms, 0, 5000, { optional: true });
        if (c.param === 'amount') {
          if (!isInt(c.insert_slot)) { err(i, 'BAD_TYPE', 'insert_slot (integer) required for amount'); return; }
          if (t && !t.pending && (c.insert_slot < 0 || c.insert_slot >= lenOf(t.id))) err(i, 'SLOT_NOT_FOUND', `insert slot ${c.insert_slot} empty on ${t.name}`);
        } else if (c.insert_slot != null) err(i, 'NOT_SUPPORTED', `${c.param} is a channel param — omit insert_slot`);
        if (t?.master && (c.param === 'pan' || c.param === 'volume')) err(i, 'NOT_SUPPORTED', 'use set_track_state volume_db for master');
        break;
      }
      case 'set_track_state': {
        const t = trackOf(i, c.track);
        const has = ['volume_db', 'pan', 'mute', 'solo'].some((k) => c[k] !== undefined);
        if (!has) err(i, 'BAD_TYPE', 'set at least one of volume_db, pan, mute, solo');
        range(i, 'volume_db', c.volume_db, -96, 12, { optional: true });
        range(i, 'pan', c.pan, -1, 1, { optional: true });
        range(i, 'ramp_ms', c.ramp_ms, 0, 5000, { optional: true });
        if (c.mute !== undefined && !isBool(c.mute)) err(i, 'BAD_TYPE', 'mute must be boolean');
        if (c.solo !== undefined && !isBool(c.solo)) err(i, 'BAD_TYPE', 'solo must be boolean');
        if (t?.master && (c.pan !== undefined || c.mute !== undefined || c.solo !== undefined)) err(i, 'NOT_SUPPORTED', 'master supports volume_db only');
        break;
      }
      case 'insert_fx': {
        const t = trackOf(i, c.track);
        if (!FX_TYPES[c.fx_id]) { err(i, 'FX_NOT_FOUND', `fx "${c.fx_id}" not installed (${Object.keys(FX_TYPES).join(', ')})`); }
        const amt = presetAmount(c.preset);
        if (!isNum(amt)) err(i, 'BAD_TYPE', 'preset must be 0–1 or light|medium|heavy');
        else if (amt < 0 || amt > 1) err(i, 'OUT_OF_RANGE', `preset ${amt} outside 0–1`);
        if (c.slot !== undefined) range(i, 'slot', c.slot, 0, MAX_CHAIN - 1, { int: true });
        if (t) {
          const n = t.pending ? (chainLen.get(t.id) || 0) : lenOf(t.id);
          if (n >= MAX_CHAIN) err(i, 'OUT_OF_RANGE', `insert chain on ${t.name} is full (${MAX_CHAIN})`);
          chainLen.set(t.id, n + 1);
        }
        break;
      }
      case 'remove_fx': {
        const t = trackOf(i, c.track);
        if (!isInt(c.slot)) { err(i, 'BAD_TYPE', 'slot (integer) required'); return; }
        if (t && !t.pending) {
          const n = lenOf(t.id);
          if (c.slot < 0 || c.slot >= n) err(i, 'SLOT_NOT_FOUND', `no insert in slot ${c.slot} on ${t.name}`);
          else chainLen.set(t.id, n - 1);
        }
        break;
      }
      case 'set_loop_region': {
        const okS = range(i, 'start_bar', c.start_bar, 0, MAX_BARS);
        const okE = range(i, 'end_bar', c.end_bar, 0, MAX_BARS);
        if (okS && okE) {
          if (!(c.start_bar < c.end_bar)) err(i, 'OUT_OF_RANGE', 'start_bar must be < end_bar');
          if (c.end_bar > songLen) err(i, 'OUT_OF_RANGE', `end_bar ${c.end_bar} beyond song length (${songLen} bars)`);
        }
        if (c.looping !== undefined && !isBool(c.looping)) err(i, 'BAD_TYPE', 'looping must be boolean');
        break;
      }
      case 'set_bpm': {
        range(i, 'bpm', c.bpm, 40, 220);
        range(i, 'ramp_bars', c.ramp_bars, 1, 64, { optional: true, int: true });
        break;
      }
      case 'add_clip': {
        const t = trackOf(i, c.track, { allowMaster: false, allowCreate: !!c.create_track });
        void t;
        range(i, 'bar', c.bar, 0, MAX_BARS);
        const src = c.source;
        if (!src || typeof src !== 'object') { err(i, 'BAD_TYPE', 'source required'); return; }
        if (src.type === 'buffer-ref') {
          if (!env.bufferRefs?.has?.(src.ref)) err(i, 'NOT_FOUND', `buffer-ref "${src.ref}" not found`);
          range(i, 'duration_beats', src.duration_beats, 0.25, MAX_BARS * 4, { optional: true });
        } else if (src.type === 'pattern') {
          if (!PATTERN_STYLES.includes(src.style)) err(i, 'NOT_SUPPORTED', `pattern style "${src.style}" unknown (${PATTERN_STYLES.join(', ')})`);
          range(i, 'bars', src.bars, 1, 32, { int: true });
          range(i, 'swing', src.swing, 0.5, 0.75, { optional: true });
        } else if (src.type === 'notes') {
          if (!Array.isArray(src.notes) || !src.notes.length || src.notes.length > 1024) err(i, 'OUT_OF_RANGE', 'notes must hold 1–1024 items');
          else if (src.notes.some((n) => !isNum(n?.beat) || !isNum(n?.freq) || n.freq < 20 || n.freq > 20000)) err(i, 'BAD_TYPE', 'each note needs numeric beat + freq 20–20000');
          range(i, 'duration_beats', src.duration_beats, 0.25, MAX_BARS * 4, { optional: true });
        } else err(i, 'NOT_SUPPORTED', 'source.type must be buffer-ref | pattern | notes');
        break;
      }
      default: break;
    }
  });
  return { ok: errors.length === 0, errors };
}

/** Human summary of one command (for previews / AGI Desk). */
export function describeCommand(c) {
  switch (c?.action) {
    case 'set_parameter': return `${c.track}: ${c.param}${c.insert_slot != null ? `[${c.insert_slot}]` : ''} → ${c.value} (${c.ramp_ms ?? 20} ms ramp)`;
    case 'set_track_state': return `${c.track}: ${['volume_db', 'pan', 'mute', 'solo'].filter((k) => c[k] !== undefined).map((k) => `${k}=${c[k]}`).join(' ')}`;
    case 'insert_fx': return `${c.track}: + ${c.fx_id}${c.preset != null ? ` @${c.preset}` : ''}`;
    case 'remove_fx': return `${c.track}: − insert slot ${c.slot}`;
    case 'set_loop_region': return `loop bars ${c.start_bar + 1}–${c.end_bar}${c.looping === false ? ' (off)' : ''}`;
    case 'set_bpm': return `BPM → ${c.bpm}${c.ramp_bars ? ` over ${c.ramp_bars} bars` : ''}`;
    case 'add_clip': return `${c.track}${c.create_track ? ' (new)' : ''}: + ${c.source?.type === 'pattern' ? `${c.source.style} ${c.source.bars}-bar pattern` : c.source?.type || 'clip'} @ bar ${c.bar + 1}`;
    default: return JSON.stringify(c);
  }
}
