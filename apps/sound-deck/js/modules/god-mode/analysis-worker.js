/** Module worker — heavy God Mode analysis off the UI / audio threads. */
import { runKind } from './analysis-core.js';

self.onmessage = (e) => {
  const { id, kind, payload } = e.data || {};
  try {
    const result = runKind(kind, payload);
    const transfer = result?.data instanceof Float32Array ? [result.data.buffer] : [];
    self.postMessage({ id, ok: true, result }, transfer);
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err?.message || err) });
  }
};
