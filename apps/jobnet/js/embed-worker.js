/* JobNet Application — MiniLM sentence embeddings off the main thread (module worker).
   Same self-hosted model and runtime as /ai/ (all-MiniLM-L6-v2, q8, wasm). No third-party calls. */
let ex = null;
self.onmessage = async ({ data }) => {
  const { id, cmd } = data;
  try {
    if (cmd === 'init') {
      const c = data.cfg; const T = await import(c.transformers);
      T.env.allowRemoteModels = false; T.env.allowLocalModels = true; T.env.localModelPath = c.modelPath; T.env.useBrowserCache = true;
      const w = T.env.backends.onnx.wasm; w.wasmPaths = c.wasm; w.numThreads = 1; w.proxy = false;
      ex = await T.pipeline('feature-extraction', c.modelId, { dtype: 'q8', device: 'wasm' });
      self.postMessage({ id, ok: true }); return;
    }
    const t = await ex(data.texts, { pooling: 'mean', normalize: true });
    const buf = t.data instanceof Float32Array ? t.data : Float32Array.from(t.data);
    self.postMessage({ id, ok: true, dim: t.dims[t.dims.length - 1], data: buf }, [buf.buffer]);
  } catch (e) { self.postMessage({ id, error: String(e && e.message || e) }); }
};
