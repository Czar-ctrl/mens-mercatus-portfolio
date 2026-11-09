/**
 * Analysis client: posts transferred Float32Array copies to analysis-worker.js (module worker).
 * Falls back to the same pure functions on the main thread if workers are unavailable.
 */
import { runKind } from './analysis-core.js';

let worker = null;
let workerBroken = false;
let seq = 0;
const pending = new Map();

function getWorker() {
  if (workerBroken || typeof Worker === 'undefined') return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./analysis-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const { id, ok, result, error } = e.data || {};
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      clearTimeout(p.timer);
      if (ok) p.resolve(result); else p.reject(new Error(error));
    };
    worker.onerror = () => {
      workerBroken = true;
      pending.forEach((p) => { clearTimeout(p.timer); p.fallback(); });
      pending.clear();
    };
  } catch (_) {
    workerBroken = true;
    worker = null;
  }
  return worker;
}

export function analysisMode() { return workerBroken ? 'main-thread' : 'worker'; }

/**
 * @param {string} kind  barEnergy | onsets | stemStats | refProfile | hookWindows | shapeTransients | peak
 * @param {object} payload  { data: Float32Array (copied before transfer), sr, … }
 */
export function analyze(kind, payload, { timeoutMs = 15000 } = {}) {
  const w = getWorker();
  const local = () => runKind(kind, payload);
  if (!w) return Promise.resolve().then(local);
  return new Promise((resolve, reject) => {
    const id = ++seq;
    const sent = { ...payload };
    const transfer = [];
    if (payload?.data instanceof Float32Array) {
      sent.data = payload.data.slice();
      transfer.push(sent.data.buffer);
    }
    const fallback = () => { try { resolve(local()); } catch (e) { reject(e); } };
    const timer = setTimeout(() => { pending.delete(id); fallback(); }, timeoutMs);
    pending.set(id, { resolve, reject, timer, fallback });
    try { w.postMessage({ id, kind, payload: sent }, transfer); } catch (_) { clearTimeout(timer); pending.delete(id); fallback(); }
  });
}
