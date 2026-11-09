/* Forex Mercatus Codex — compute worker (keeps training/backtests off the UI thread). */
importScripts('core.js?v=gm1');
var C = self.FXCore;
function strip(o) { return JSON.parse(JSON.stringify(o, function (k, v) { if (typeof v === 'function') return undefined; if (ArrayBuffer.isView(v)) return Array.prototype.slice.call(v); if (typeof v === 'number' && !isFinite(v)) return v > 0 ? 1e308 : (v < 0 ? -1e308 : null); return v; })); }
self.onmessage = function (e) {
  var m = e.data, d = C.cols(m.rows), out;
  try {
    if (m.op === 'model') out = C.walkForwardModel(d, m.opts);
    else if (m.op === 'wf') { out = C.walkForward(d, m.opts.strat, m.opts); out.mc = C.monteCarlo(out.trades.map(function (t) { return t.R; }), m.opts); }
    else if (m.op === 'bt') { var S = C.STRATS[m.opts.strat], sg = m.opts.signals ? Int8Array.from(m.opts.signals) : S.signals(d, m.opts.params || S.def); out = C.backtest(d, sg, m.opts); out.mc = C.monteCarlo(out.trades.map(function (t) { return t.R; }), m.opts); }
    else if (m.op === 'ai') { var lr = C.logRet(d.c); out = { regimes: C.regimes(d, m.opts), hmm: C.hmm2(lr), anom: C.anomalies(d, m.opts), sim: C.similar(d, m.opts) }; }
    self.postMessage({ id: m.id, ok: true, res: strip(out) });
  } catch (err) { self.postMessage({ id: m.id, ok: false, err: String(err && err.message || err) }); }
};
