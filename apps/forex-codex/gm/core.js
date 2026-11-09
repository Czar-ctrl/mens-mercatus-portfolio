/*! Forex Mercatus Codex · God Mode core (indicators, backtester, on-device ML, patterns, risk).
 * Pure functions, no DOM. Works in the browser (window.FXCore) and in Node (require) for unit tests.
 * EDUCATIONAL / PAPER-TRADING RESEARCH ONLY. Not financial advice. Nothing here can place an order. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FXCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var NaNv = NaN;
  /* ------------------------------------------------------------ utils */
  function rng(seed) { var s = (seed >>> 0) || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function mean(a) { var s = 0, n = 0; for (var i = 0; i < a.length; i++) if (isFinite(a[i])) { s += a[i]; n++; } return n ? s / n : NaNv; }
  function std(a) { var m = mean(a), s = 0, n = 0; for (var i = 0; i < a.length; i++) if (isFinite(a[i])) { s += (a[i] - m) * (a[i] - m); n++; } return n > 1 ? Math.sqrt(s / (n - 1)) : NaNv; }
  function median(a) { var b = a.filter(isFinite).slice().sort(function (x, y) { return x - y; }); if (!b.length) return NaNv; var m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; }
  function quantile(a, q) { var b = a.filter(isFinite).slice().sort(function (x, y) { return x - y; }); if (!b.length) return NaNv; var p = (b.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p); return b[lo] + (b[hi] - b[lo]) * (p - lo); }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function cols(rows) { var n = rows.length, t = new Array(n), o = new Float64Array(n), h = new Float64Array(n), l = new Float64Array(n), c = new Float64Array(n), v = new Float64Array(n); for (var i = 0; i < n; i++) { var r = rows[i]; t[i] = r[0]; o[i] = r[1]; h[i] = r[2]; l[i] = r[3]; c[i] = r[4]; v[i] = r[5] || 0; } return { t: t, o: o, h: h, l: l, c: c, v: v, n: n }; }
  /* ------------------------------------------------------------ indicators (value at i uses data <= i only) */
  function sma(a, n) { var out = new Float64Array(a.length).fill(NaNv), s = 0; for (var i = 0; i < a.length; i++) { s += a[i]; if (i >= n) s -= a[i - n]; if (i >= n - 1) out[i] = s / n; } return out; }
  function ema(a, n) { var out = new Float64Array(a.length).fill(NaNv), k = 2 / (n + 1), e = NaNv, s = 0; for (var i = 0; i < a.length; i++) { if (i < n) { s += a[i]; if (i === n - 1) { e = s / n; out[i] = e; } continue; } e = a[i] * k + e * (1 - k); out[i] = e; } return out; }
  function rsi(c, n) { n = n || 14; var out = new Float64Array(c.length).fill(NaNv), g = 0, l = 0; for (var i = 1; i < c.length; i++) { var d = c[i] - c[i - 1], up = d > 0 ? d : 0, dn = d < 0 ? -d : 0; if (i <= n) { g += up; l += dn; if (i === n) { g /= n; l /= n; out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); } continue; } g = (g * (n - 1) + up) / n; l = (l * (n - 1) + dn) / n; out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); } return out; }
  function trueRange(d) { var tr = new Float64Array(d.n); for (var i = 0; i < d.n; i++) { var pc = i ? d.c[i - 1] : d.o[i]; tr[i] = Math.max(d.h[i] - d.l[i], Math.abs(d.h[i] - pc), Math.abs(d.l[i] - pc)); } return tr; }
  function atr(d, n) { n = n || 14; var tr = trueRange(d), out = new Float64Array(d.n).fill(NaNv), a = 0; for (var i = 0; i < d.n; i++) { if (i < n) { a += tr[i]; if (i === n - 1) { a /= n; out[i] = a; } continue; } a = (a * (n - 1) + tr[i]) / n; out[i] = a; } return out; }
  function rollingStd(a, n) { var out = new Float64Array(a.length).fill(NaNv); for (var i = n - 1; i < a.length; i++) { var s = 0, s2 = 0; for (var j = i - n + 1; j <= i; j++) { s += a[j]; s2 += a[j] * a[j]; } var m = s / n; out[i] = Math.sqrt(Math.max(0, s2 / n - m * m)); } return out; }
  function bollinger(c, n, k) { n = n || 20; k = k || 2; var m = sma(c, n), sd = rollingStd(c, n), up = new Float64Array(c.length), lo = new Float64Array(c.length), bw = new Float64Array(c.length), pb = new Float64Array(c.length); for (var i = 0; i < c.length; i++) { up[i] = m[i] + k * sd[i]; lo[i] = m[i] - k * sd[i]; bw[i] = (up[i] - lo[i]) / m[i]; pb[i] = (c[i] - lo[i]) / ((up[i] - lo[i]) || NaNv); } return { mid: m, up: up, lo: lo, bw: bw, pb: pb }; }
  function macd(c, f, s, sig) { var a = ema(c, f || 12), b = ema(c, s || 26), line = new Float64Array(c.length).fill(NaNv); for (var i = 0; i < c.length; i++) line[i] = a[i] - b[i]; var first = 0; while (first < c.length && !isFinite(line[first])) first++; var sl = new Float64Array(c.length).fill(NaNv), sub = ema(Array.prototype.slice.call(line, first), sig || 9); for (var j = 0; j < sub.length; j++) sl[first + j] = sub[j]; var hist = new Float64Array(c.length); for (var i2 = 0; i2 < c.length; i2++) hist[i2] = line[i2] - sl[i2]; return { line: line, signal: sl, hist: hist }; }
  function donchian(d, n) { var up = new Float64Array(d.n).fill(NaNv), lo = new Float64Array(d.n).fill(NaNv); for (var i = n - 1; i < d.n; i++) { var hh = -Infinity, ll = Infinity; for (var j = i - n + 1; j <= i; j++) { if (d.h[j] > hh) hh = d.h[j]; if (d.l[j] < ll) ll = d.l[j]; } up[i] = hh; lo[i] = ll; } return { up: up, lo: lo }; }
  function adx(d, n) { n = n || 14; var out = new Float64Array(d.n).fill(NaNv), tr = trueRange(d), pdm = 0, mdm = 0, trs = 0, dx = [], a = NaNv; for (var i = 1; i < d.n; i++) { var up = d.h[i] - d.h[i - 1], dn = d.l[i - 1] - d.l[i], p = up > dn && up > 0 ? up : 0, m = dn > up && dn > 0 ? dn : 0; if (i <= n) { pdm += p; mdm += m; trs += tr[i]; if (i < n) continue; } else { pdm = pdm - pdm / n + p; mdm = mdm - mdm / n + m; trs = trs - trs / n + tr[i]; } var pdi = trs ? 100 * pdm / trs : 0, mdi = trs ? 100 * mdm / trs : 0, x = (pdi + mdi) ? 100 * Math.abs(pdi - mdi) / (pdi + mdi) : 0; if (!isFinite(a)) { dx.push(x); if (dx.length === n) { a = mean(dx); out[i] = a; } } else { a = (a * (n - 1) + x) / n; out[i] = a; } } return out; }
  function efficiency(c, n) { var out = new Float64Array(c.length).fill(NaNv); for (var i = n; i < c.length; i++) { var p = 0; for (var j = i - n + 1; j <= i; j++) p += Math.abs(c[j] - c[j - 1]); out[i] = p ? (c[i] - c[i - n]) / p : 0; } return out; }
  function vwapDaily(d) { var out = new Float64Array(d.n), pv = 0, vv = 0, day = -1; for (var i = 0; i < d.n; i++) { var dd = Math.floor(d.t[i] / 86400); if (dd !== day) { day = dd; pv = 0; vv = 0; } var tp = (d.h[i] + d.l[i] + d.c[i]) / 3, v = d.v[i] || 1; pv += tp * v; vv += v; out[i] = pv / vv; } return out; }
  function pctRank(a, n) { var out = new Float64Array(a.length).fill(NaNv); for (var i = n - 1; i < a.length; i++) { if (!isFinite(a[i])) continue; var b = 0, k = 0; for (var j = i - n + 1; j <= i; j++) if (isFinite(a[j])) { k++; if (a[j] <= a[i]) b++; } out[i] = k ? b / k : NaNv; } return out; }
  function logRet(c) { var r = new Float64Array(c.length); for (var i = 1; i < c.length; i++) r[i] = Math.log(c[i] / c[i - 1]); return r; }

  /* ------------------------------------------------------------ swing points & patterns */
  function swings(d, k) { k = k || 3; var hi = [], lo = []; for (var i = k; i < d.n - k; i++) { var isH = true, isL = true; for (var j = 1; j <= k; j++) { if (d.h[i] < d.h[i - j] || d.h[i] <= d.h[i + j]) isH = false; if (d.l[i] > d.l[i - j] || d.l[i] >= d.l[i + j]) isL = false; } if (isH) hi.push(i); if (isL) lo.push(i); } return { hi: hi, lo: lo }; }
  var PATTERNS = {
    bull_engulf: { name: 'Bullish engulfing', dir: 1 }, bear_engulf: { name: 'Bearish engulfing', dir: -1 },
    hammer: { name: 'Hammer / bullish pin', dir: 1 }, shooting: { name: 'Shooting star / bearish pin', dir: -1 },
    inside: { name: 'Inside bar', dir: 0 }, doji: { name: 'Doji', dir: 0 }, nr7: { name: 'NR7 (narrowest of 7)', dir: 0 },
    don_up: { name: 'Donchian-20 breakout up', dir: 1 }, don_dn: { name: 'Donchian-20 breakdown', dir: -1 },
    golden: { name: 'EMA20 crosses above EMA50', dir: 1 }, death: { name: 'EMA20 crosses below EMA50', dir: -1 },
    squeeze: { name: 'Bollinger squeeze (bandwidth 10th pct)', dir: 0 },
    rsi_os: { name: 'RSI < 30 (oversold)', dir: 1 }, rsi_ob: { name: 'RSI > 70 (overbought)', dir: -1 },
    dbl_top: { name: 'Double top (swing highs within 0.5 ATR)', dir: -1 }, dbl_bot: { name: 'Double bottom (swing lows within 0.5 ATR)', dir: 1 }
  };
  function detectPatterns(d, ctx) {
    ctx = ctx || {}; var A = ctx.atr || atr(d, 14), e20 = ctx.e20 || ema(d.c, 20), e50 = ctx.e50 || ema(d.c, 50), R = ctx.rsi || rsi(d.c, 14), dc = donchian(d, 20), bb = ctx.bb || bollinger(d.c, 20, 2), bwr = pctRank(bb.bw, 120);
    var hits = [], closeOnly = !!ctx.closeOnly;
    for (var i = 7; i < d.n; i++) {
      var o = d.o[i], h = d.h[i], l = d.l[i], c = d.c[i], po = d.o[i - 1], pc = d.c[i - 1], rng_ = h - l, body = Math.abs(c - o);
      if (!closeOnly) {
        if (c > o && pc < po && c >= po && o <= pc && body > A[i] * 0.3) hits.push([i, 'bull_engulf']);
        if (c < o && pc > po && o >= pc && c <= po && body > A[i] * 0.3) hits.push([i, 'bear_engulf']);
        if (rng_ > A[i] * 0.8) { var lw = Math.min(o, c) - l, uw = h - Math.max(o, c); if (lw > 2 * body && lw > 0.6 * rng_) hits.push([i, 'hammer']); if (uw > 2 * body && uw > 0.6 * rng_) hits.push([i, 'shooting']); }
        if (h < d.h[i - 1] && l > d.l[i - 1]) hits.push([i, 'inside']);
        if (rng_ > 0 && body < 0.08 * rng_ && rng_ > A[i] * 0.5) hits.push([i, 'doji']);
        var nr = true; for (var j = 1; j < 7; j++) if (d.h[i - j] - d.l[i - j] <= rng_) { nr = false; break; } if (nr && rng_ > 0) hits.push([i, 'nr7']);
      }
      if (isFinite(dc.up[i - 1]) && c > dc.up[i - 1]) hits.push([i, 'don_up']);
      if (isFinite(dc.lo[i - 1]) && c < dc.lo[i - 1]) hits.push([i, 'don_dn']);
      if (e20[i] > e50[i] && e20[i - 1] <= e50[i - 1]) hits.push([i, 'golden']);
      if (e20[i] < e50[i] && e20[i - 1] >= e50[i - 1]) hits.push([i, 'death']);
      if (bwr[i] <= 0.1 && !(bwr[i - 1] <= 0.1)) hits.push([i, 'squeeze']);
      if (R[i] < 30 && R[i - 1] >= 30) hits.push([i, 'rsi_os']);
      if (R[i] > 70 && R[i - 1] <= 70) hits.push([i, 'rsi_ob']);
    }
    var sw = swings(d, 3);
    for (var a = 1; a < sw.hi.length; a++) { var i1 = sw.hi[a - 1], i2 = sw.hi[a]; if (i2 - i1 >= 5 && i2 - i1 <= 60 && Math.abs(d.h[i1] - d.h[i2]) < 0.5 * A[i2]) hits.push([Math.min(i2 + 3, d.n - 1), 'dbl_top']); }
    for (var b = 1; b < sw.lo.length; b++) { var j1 = sw.lo[b - 1], j2 = sw.lo[b]; if (j2 - j1 >= 5 && j2 - j1 <= 60 && Math.abs(d.l[j1] - d.l[j2]) < 0.5 * A[j2]) hits.push([Math.min(j2 + 3, d.n - 1), 'dbl_bot']); }
    hits.sort(function (x, y) { return x[0] - y[0]; });
    return hits.map(function (x) { return { i: x[0], id: x[1], name: PATTERNS[x[1]].name, dir: PATTERNS[x[1]].dir }; });
  }
  /* historical base rate: after pattern, how often did price move in the pattern's direction within h bars (close-to-close)? */
  function patternStats(d, hits, h) {
    var by = {}; hits.forEach(function (p) { if (p.i + h >= d.n) return; var r = Math.log(d.c[p.i + h] / d.c[p.i]); var s = by[p.id] || (by[p.id] = { id: p.id, name: p.name, dir: p.dir, n: 0, up: 0, rets: [] }); s.n++; if (r > 0) s.up++; s.rets.push(r); });
    var up = 0, tot = 0; for (var i = 0; i + h < d.n; i += 1) { tot++; if (d.c[i + h] > d.c[i]) up++; }
    var base = tot ? up / tot : 0.5;
    Object.keys(by).forEach(function (k) { var s = by[k]; s.upRate = s.up / s.n; s.medRet = median(s.rets); s.hit = s.dir === 0 ? NaNv : (s.dir > 0 ? s.upRate : 1 - s.upRate); s.baseHit = s.dir === 0 ? NaNv : (s.dir > 0 ? base : 1 - base); delete s.rets; });
    return { base: base, by: by };
  }

  /* ------------------------------------------------------------ backtester (signal at close i, fill at open i+1) */
  var STRATS = {
    ema_cross: { name: 'EMA trend cross', grid: [{ f: 10, s: 30 }, { f: 20, s: 50 }, { f: 20, s: 100 }, { f: 50, s: 200 }], def: { f: 20, s: 50 },
      signals: function (d, p) { var a = ema(d.c, p.f), b = ema(d.c, p.s), out = new Int8Array(d.n); for (var i = 1; i < d.n; i++) { if (a[i] > b[i] && a[i - 1] <= b[i - 1]) out[i] = 1; else if (a[i] < b[i] && a[i - 1] >= b[i - 1]) out[i] = -1; } return out; } },
    donchian: { name: 'Donchian breakout', grid: [{ n: 20 }, { n: 40 }, { n: 55 }], def: { n: 20 },
      signals: function (d, p) { var dc = donchian(d, p.n), out = new Int8Array(d.n); for (var i = 1; i < d.n; i++) { if (d.c[i] > dc.up[i - 1]) out[i] = 1; else if (d.c[i] < dc.lo[i - 1]) out[i] = -1; } return out; } },
    rsi_revert: { name: 'RSI mean reversion (with 200 EMA filter)', grid: [{ lo: 25, hi: 75 }, { lo: 30, hi: 70 }, { lo: 35, hi: 65 }], def: { lo: 30, hi: 70 },
      signals: function (d, p) { var r = rsi(d.c, 14), e = ema(d.c, 200), out = new Int8Array(d.n); for (var i = 1; i < d.n; i++) { if (r[i] < p.lo && r[i - 1] >= p.lo && d.c[i] > e[i]) out[i] = 1; else if (r[i] > p.hi && r[i - 1] <= p.hi && d.c[i] < e[i]) out[i] = -1; } return out; } },
    bb_revert: { name: 'Bollinger band fade', grid: [{ n: 20, k: 2 }, { n: 20, k: 2.5 }, { n: 50, k: 2 }], def: { n: 20, k: 2 },
      signals: function (d, p) { var b = bollinger(d.c, p.n, p.k), out = new Int8Array(d.n); for (var i = 1; i < d.n; i++) { if (d.c[i - 1] < b.lo[i - 1] && d.c[i] > b.lo[i]) out[i] = 1; else if (d.c[i - 1] > b.up[i - 1] && d.c[i] < b.up[i]) out[i] = -1; } return out; } }
  };
  /* opts: {riskPct, rr, atrMult, costR (fixed cost per trade in price units), start, end, maxBars, signals (Int8Array) } */
  function backtest(d, sig, opts) {
    opts = opts || {}; var riskPct = (opts.riskPct || 0.75) / 100, rr = opts.rr || 2, am = opts.atrMult || 2, A = opts.atr || atr(d, 14), cost = opts.cost || 0, start = Math.max(opts.start || 0, 15), end = Math.min(opts.end || d.n, d.n), maxBars = opts.maxBars || 0;
    var eq = opts.equity || 10000, eq0 = eq, trades = [], curve = [], pos = null, peak = eq, maxDD = 0;
    for (var i = start; i < end; i++) {
      if (pos) {
        var exit = null, px = 0;
        if (pos.dir > 0) { if (d.l[i] <= pos.stop) { exit = 'stop'; px = Math.min(pos.stop, d.o[i]); } else if (d.h[i] >= pos.tp) { exit = 'target'; px = Math.max(pos.tp, d.o[i]); } }
        else { if (d.h[i] >= pos.stop) { exit = 'stop'; px = Math.max(pos.stop, d.o[i]); } else if (d.l[i] <= pos.tp) { exit = 'target'; px = Math.min(pos.tp, d.o[i]); } }
        if (!exit && (sig[i - 1] === -pos.dir)) { exit = 'reverse'; px = d.o[i]; }
        if (!exit && maxBars && i - pos.i >= maxBars) { exit = 'time'; px = d.o[i]; }
        if (!exit && i === end - 1) { exit = 'end'; px = d.c[i]; }
        if (exit) { var R = (pos.dir * (px - pos.entry) - cost) / pos.risk; var pnl = R * pos.riskCash; eq += pnl; trades.push({ dir: pos.dir, ei: pos.i, xi: i, et: d.t[pos.i], xt: d.t[i], entry: pos.entry, exit: px, stop: pos.stop0, tp: pos.tp, R: R, pnl: pnl, why: exit, bars: i - pos.i }); pos = null; }
      }
      if (!pos && i < end - 1 && sig[i - 1] && isFinite(A[i - 1]) && A[i - 1] > 0) {
        var dir = sig[i - 1], entry = d.o[i], risk = am * A[i - 1];
        pos = { dir: dir, i: i, entry: entry, risk: risk, stop: entry - dir * risk, stop0: entry - dir * risk, tp: entry + dir * risk * rr, riskCash: eq * riskPct };
        // same-bar stop/target check (conservative: stop first)
        if (dir > 0 ? d.l[i] <= pos.stop : d.h[i] >= pos.stop) { var R1 = (-risk - cost) / risk; eq += R1 * pos.riskCash; trades.push({ dir: dir, ei: i, xi: i, et: d.t[i], xt: d.t[i], entry: entry, exit: pos.stop, stop: pos.stop, tp: pos.tp, R: R1, pnl: R1 * pos.riskCash, why: 'stop', bars: 0 }); pos = null; }
      }
      var mark = eq; if (pos) mark += pos.riskCash * (pos.dir * (d.c[i] - pos.entry)) / pos.risk;
      if (mark > peak) peak = mark; var dd = (peak - mark) / peak; if (dd > maxDD) maxDD = dd;
      curve.push([d.t[i], mark]);
    }
    var st = tradeStats(trades); st.maxDD = maxDD; st.ret = eq / eq0 - 1; st.equity = eq;
    return { trades: trades, curve: curve, stats: st };
  }
  function tradeStats(tr) {
    var n = tr.length, w = tr.filter(function (x) { return x.R > 0; }), l = tr.filter(function (x) { return x.R <= 0; });
    var sw = w.reduce(function (a, x) { return a + x.R; }, 0), sl = -l.reduce(function (a, x) { return a + x.R; }, 0), Rs = tr.map(function (x) { return x.R; });
    var cl = 0, maxCL = 0; tr.forEach(function (x) { if (x.R <= 0) { cl++; maxCL = Math.max(maxCL, cl); } else cl = 0; });
    var sR = std(Rs);
    return { n: n, wins: w.length, winRate: n ? w.length / n : NaNv, avgWinR: w.length ? sw / w.length : NaNv, avgLossR: l.length ? -sl / l.length : NaNv, expectancy: n ? (sw - sl) / n : NaNv, pf: sl ? sw / sl : (sw ? Infinity : NaNv), totalR: sw - sl, maxConsecLoss: maxCL, sqn: n > 1 && sR ? Math.sqrt(Math.min(n, 100)) * ((sw - sl) / n) / sR : NaNv };
  }
  /* walk-forward: optimise params on each in-sample window by total R (min trades), test on following OOS window */
  function walkForward(d, key, opts) {
    opts = opts || {}; var S = STRATS[key], folds = opts.folds || 5, isFrac = opts.isFrac || 0.5, A = atr(d, 14);
    var isLen = Math.floor(d.n * isFrac), oosLen = Math.floor((d.n - isLen) / folds), allOOS = [], foldsOut = [], eq = opts.equity || 10000;
    var sigCache = S.grid.map(function (p) { return S.signals(d, p); });
    for (var f = 0; f < folds; f++) {
      var isStart = f * oosLen, isEnd = isStart + isLen, oEnd = f === folds - 1 ? d.n : isEnd + oosLen, best = -1, bestScore = -Infinity, isStats = null;
      for (var g = 0; g < S.grid.length; g++) { var r = backtest(d, sigCache[g], { riskPct: opts.riskPct, rr: opts.rr, atrMult: opts.atrMult, atr: A, cost: opts.cost, start: isStart, end: isEnd }); var sc = r.stats.n >= 5 ? r.stats.totalR : -1e9 + r.stats.n; if (sc > bestScore) { bestScore = sc; best = g; isStats = r.stats; } }
      var o = backtest(d, sigCache[best], { riskPct: opts.riskPct, rr: opts.rr, atrMult: opts.atrMult, atr: A, cost: opts.cost, start: isEnd, end: oEnd, equity: eq });
      eq = o.stats.equity; allOOS = allOOS.concat(o.trades);
      foldsOut.push({ fold: f + 1, params: S.grid[best], isFrom: d.t[isStart], isTo: d.t[isEnd - 1], oosFrom: d.t[isEnd], oosTo: d.t[oEnd - 1], is: isStats, oos: o.stats, curve: o.curve });
    }
    var curve = []; foldsOut.forEach(function (x) { curve = curve.concat(x.curve); });
    var peak = -Infinity, mdd = 0; curve.forEach(function (p) { if (p[1] > peak) peak = p[1]; mdd = Math.max(mdd, (peak - p[1]) / peak); });
    var st = tradeStats(allOOS); st.maxDD = mdd; st.ret = eq / (opts.equity || 10000) - 1;
    var isAgg = foldsOut.map(function (x) { return x.is ? x.is.expectancy : NaNv; });
    return { folds: foldsOut, trades: allOOS, curve: curve, stats: st, isExpectancy: mean(isAgg) };
  }
  function monteCarlo(Rs, opts) {
    opts = opts || {}; var runs = opts.runs || 1000, risk = (opts.riskPct || 0.75) / 100, r = rng(opts.seed || 7), n = Rs.length, finals = [], dds = [], ruin = 0, ruinDD = opts.ruinDD || 0.2;
    if (!n) return null;
    for (var k = 0; k < runs; k++) { var eq = 1, peak = 1, mdd = 0; for (var i = 0; i < n; i++) { eq *= 1 + Rs[Math.floor(r() * n)] * risk; if (eq > peak) peak = eq; var dd = (peak - eq) / peak; if (dd > mdd) mdd = dd; } finals.push(eq - 1); dds.push(mdd); if (mdd >= ruinDD) ruin++; }
    return { runs: runs, n: n, ret: { p5: quantile(finals, .05), p50: quantile(finals, .5), p95: quantile(finals, .95) }, dd: { p50: quantile(dds, .5), p95: quantile(dds, .95), max: Math.max.apply(null, dds) }, pRuin: ruin / runs, ruinDD: ruinDD, pLoss: finals.filter(function (x) { return x < 0; }).length / runs, finals: finals };
  }

  /* ------------------------------------------------------------ features for ML (only past data at i) */
  var FEAT_NAMES = ['ret_1 (vol-scaled)', 'ret_5 (vol-scaled)', 'ret_20 (vol-scaled)', 'RSI-14', 'Dist to EMA20 (ATR)', 'Dist to EMA50 (ATR)', 'ATR percentile', 'Bollinger %b', 'MACD hist (ATR)', 'Efficiency ratio 20', 'Hour sin', 'Hour cos'];
  function features(d, ctx) {
    ctx = ctx || {}; var A = ctx.atr || atr(d, 14), e20 = ctx.e20 || ema(d.c, 20), e50 = ctx.e50 || ema(d.c, 50), R = ctx.rsi || rsi(d.c, 14), bb = ctx.bb || bollinger(d.c, 20, 2), m = macd(d.c), er = efficiency(d.c, 20), lr = logRet(d.c), vol = rollingStd(lr, 20), ap = pctRank(A, 200), intraday = (d.t[1] - d.t[0]) < 86400;
    var X = new Array(d.n), ok = new Uint8Array(d.n);
    for (var i = 0; i < d.n; i++) {
      if (i < 60) { X[i] = null; continue; }
      var v = vol[i] || 1e-9, hr = intraday ? ((d.t[i] % 86400) / 3600) : 0;
      var f = [lr[i] / v, Math.log(d.c[i] / d.c[i - 5]) / (v * Math.sqrt(5)), Math.log(d.c[i] / d.c[i - 20]) / (v * Math.sqrt(20)), (R[i] - 50) / 50, (d.c[i] - e20[i]) / A[i], (d.c[i] - e50[i]) / A[i], isFinite(ap[i]) ? ap[i] : 0.5, isFinite(bb.pb[i]) ? bb.pb[i] - 0.5 : 0, m.hist[i] / A[i], er[i], intraday ? Math.sin(2 * Math.PI * hr / 24) : 0, intraday ? Math.cos(2 * Math.PI * hr / 24) : 0];
      var good = true; for (var j = 0; j < f.length; j++) if (!isFinite(f[j])) { good = false; break; }
      X[i] = good ? f : null; ok[i] = good ? 1 : 0;
    }
    return { X: X, ok: ok, names: FEAT_NAMES };
  }
  function labels(d, h) { var y = new Int8Array(d.n).fill(-1); for (var i = 0; i + h < d.n; i++) y[i] = d.c[i + h] > d.c[i] ? 1 : 0; return y; }
  function standardizer(rows) { var k = rows[0].length, mu = new Array(k).fill(0), sd = new Array(k).fill(0); rows.forEach(function (r) { for (var j = 0; j < k; j++) mu[j] += r[j]; }); for (var j = 0; j < k; j++) mu[j] /= rows.length; rows.forEach(function (r) { for (var j = 0; j < k; j++) sd[j] += (r[j] - mu[j]) * (r[j] - mu[j]); }); for (var j2 = 0; j2 < k; j2++) sd[j2] = Math.sqrt(sd[j2] / rows.length) || 1; return { mu: mu, sd: sd, f: function (r) { return r.map(function (x, j) { return clamp((x - mu[j]) / sd[j], -6, 6); }); } }; }
  function sigmoid(z) { return 1 / (1 + Math.exp(-z)); }
  function trainLogistic(X, y, opt) {
    opt = opt || {}; var lam = opt.l2 == null ? 0.01 : opt.l2, it = opt.iters || 250, lr = opt.lr || 0.5, n = X.length, k = X[0].length, w = new Array(k).fill(0), b = 0;
    for (var t = 0; t < it; t++) { var gw = new Array(k).fill(0), gb = 0; for (var i = 0; i < n; i++) { var z = b; for (var j = 0; j < k; j++) z += w[j] * X[i][j]; var e = sigmoid(z) - y[i]; gb += e; for (var j2 = 0; j2 < k; j2++) gw[j2] += e * X[i][j2]; } b -= lr * gb / n; for (var j3 = 0; j3 < k; j3++) w[j3] -= lr * (gw[j3] / n + lam * w[j3]); }
    return { kind: 'logistic', w: w, b: b, predict: function (x) { var z = b; for (var j = 0; j < k; j++) z += w[j] * x[j]; return sigmoid(z); } };
  }
  /* histogram-based gradient-boosted stumps (logistic loss) */
  function trainGBM(X, y, opt) {
    opt = opt || {}; var rounds = opt.rounds || 60, lr = opt.lr || 0.1, nb = opt.bins || 16, n = X.length, k = X[0].length, minLeaf = Math.max(20, Math.floor(n * 0.02));
    var edges = [], B = []; for (var j = 0; j < k; j++) { var col = X.map(function (r) { return r[j]; }), e = []; for (var q = 1; q < nb; q++) e.push(quantile(col, q / nb)); edges.push(e); }
    for (var i = 0; i < n; i++) { var bi = new Uint8Array(k); for (var j1 = 0; j1 < k; j1++) { var e1 = edges[j1], bb_ = 0; while (bb_ < e1.length && X[i][j1] > e1[bb_]) bb_++; bi[j1] = bb_; } B.push(bi); }
    var p0 = mean(Array.prototype.slice.call(y)), f0 = Math.log(clamp(p0, 1e-3, 1 - 1e-3) / (1 - clamp(p0, 1e-3, 1 - 1e-3))), F = new Float64Array(n).fill(f0), trees = [], imp = new Array(k).fill(0);
    for (var r = 0; r < rounds; r++) {
      var g = new Float64Array(n), hh = new Float64Array(n); for (var i2 = 0; i2 < n; i2++) { var p = sigmoid(F[i2]); g[i2] = y[i2] - p; hh[i2] = Math.max(p * (1 - p), 1e-6); }
      var G = 0, H = 0; for (var i3 = 0; i3 < n; i3++) { G += g[i3]; H += hh[i3]; }
      var best = null; for (var j2 = 0; j2 < k; j2++) { var gs = new Float64Array(nb), hs = new Float64Array(nb), cs = new Int32Array(nb); for (var i4 = 0; i4 < n; i4++) { var b4 = B[i4][j2]; gs[b4] += g[i4]; hs[b4] += hh[i4]; cs[b4]++; } var gl = 0, hl = 0, cl = 0; for (var s = 0; s < nb - 1; s++) { gl += gs[s]; hl += hs[s]; cl += cs[s]; var gr = G - gl, hr = H - hl; if (cl < minLeaf || n - cl < minLeaf) continue; var gain = gl * gl / (hl + 1) + gr * gr / (hr + 1) - G * G / (H + 1); if (!best || gain > best.gain) best = { gain: gain, j: j2, s: s, lv: gl / (hl + 1), rv: gr / (hr + 1) }; } }
      if (!best) break; trees.push(best); imp[best.j] += best.gain;
      for (var i5 = 0; i5 < n; i5++) F[i5] += lr * (B[i5][best.j] <= best.s ? best.lv : best.rv);
    }
    function binOf(x, j) { var e = edges[j], b = 0; while (b < e.length && x > e[b]) b++; return b; }
    var tot = imp.reduce(function (a, b) { return a + b; }, 0) || 1;
    return { kind: 'gbm', trees: trees.length, importance: imp.map(function (v) { return v / tot; }), predict: function (x) { var f = f0; for (var t = 0; t < trees.length; t++) { var tr = trees[t]; f += lr * (binOf(x[tr.j], tr.j) <= tr.s ? tr.lv : tr.rv); } return sigmoid(f); } };
  }
  function auc(p, y) { var idx = p.map(function (v, i) { return i; }).sort(function (a, b) { return p[a] - p[b]; }), pos = 0, neg = 0, rank = 0; for (var r = 0; r < idx.length; r++) { if (y[idx[r]]) { pos++; rank += r + 1; } else neg++; } return pos && neg ? (rank - pos * (pos + 1) / 2) / (pos * neg) : NaNv; }
  /* walk-forward direction model: expanding train window, purge gap = h bars, honest OOS metrics vs baselines */
  function walkForwardModel(d, opt) {
    opt = opt || {}; var h = opt.horizon || 6, folds = opt.folds || 5, kind = opt.model || 'gbm', fe = opt.features || features(d), y = labels(d, h);
    var idx = []; for (var i = 0; i < d.n; i++) if (fe.ok[i] && y[i] >= 0) idx.push(i);
    var trainMin = Math.floor(idx.length * (opt.trainFrac || 0.5)), seg = Math.floor((idx.length - trainMin) / folds), P = [], Y = [], T = [], foldStats = [];
    for (var f = 0; f < folds; f++) {
      var teS = trainMin + f * seg, teE = f === folds - 1 ? idx.length : teS + seg, trE = teS - h; if (trE < 100) continue;
      var tr = idx.slice(0, trE), te = idx.slice(teS, teE), Xtr = tr.map(function (i) { return fe.X[i]; }), ytr = tr.map(function (i) { return y[i]; });
      var sc = standardizer(Xtr), Xs = Xtr.map(sc.f), m = kind === 'logistic' ? trainLogistic(Xs, ytr, opt) : trainGBM(Xs, ytr, opt);
      var trUp = mean(ytr), pf = [], yf = [];
      te.forEach(function (i) { var p = m.predict(sc.f(fe.X[i])); P.push(p); Y.push(y[i]); T.push(i); pf.push(p); yf.push(y[i]); });
      var acc = mean(pf.map(function (p, k) { return (p > 0.5 ? 1 : 0) === yf[k] ? 1 : 0; })), teUp = mean(yf), base = Math.max(teUp, 1 - teUp); // strict baseline: best constant guess in hindsight for this test window
      foldStats.push({ fold: f + 1, from: d.t[te[0]], to: d.t[te[te.length - 1]], n: te.length, acc: acc, baseline: base, auc: auc(pf, yf) });
    }
    var n = P.length, acc = mean(P.map(function (p, k) { return (p > 0.5 ? 1 : 0) === Y[k] ? 1 : 0; })), upRate = mean(Y);
    var majAcc = mean(foldStats.map(function (f) { return f.baseline * f.n; })) * foldStats.length / (n || 1);
    var brier = mean(P.map(function (p, k) { return (p - Y[k]) * (p - Y[k]); })), brierBase = upRate * (1 - upRate);
    var se = Math.sqrt(majAcc * (1 - majAcc) / (n || 1)), z = (acc - majAcc) / (se || 1), effN = n / h, zEff = (acc - majAcc) / (Math.sqrt(majAcc * (1 - majAcc) / (effN || 1)) || 1);
    var conf = P.map(function (p, k) { return [p, Y[k]]; }).filter(function (x) { return x[0] > 0.6 || x[0] < 0.4; }), confAcc = conf.length ? mean(conf.map(function (x) { return (x[0] > 0.5 ? 1 : 0) === x[1] ? 1 : 0; })) : NaNv;
    var cal = []; for (var b = 0; b < 5; b++) { var lo = 0.3 + b * 0.08, hi = lo + 0.08, sel = P.map(function (p, k) { return [p, Y[k]]; }).filter(function (x) { return x[0] >= (b === 0 ? 0 : lo) && x[0] < (b === 4 ? 1 : hi); }); cal.push({ lo: b === 0 ? 0 : lo, hi: b === 4 ? 1 : hi, n: sel.length, pred: mean(sel.map(function (x) { return x[0]; })), actual: mean(sel.map(function (x) { return x[1]; })) }); }
    // final model on all labelled data (still only past data) -> prediction for latest bar
    var all = idx, Xa = all.map(function (i) { return fe.X[i]; }), ya = all.map(function (i) { return y[i]; }), sca = standardizer(Xa), mAll = kind === 'logistic' ? trainLogistic(Xa.map(sca.f), ya, opt) : trainGBM(Xa.map(sca.f), ya, opt);
    var last = d.n - 1; while (last > 0 && !fe.ok[last]) last--;
    var pNow = mAll.predict(sca.f(fe.X[last]));
    var imp = mAll.importance || (mAll.w ? (function () { var a = mAll.w.map(Math.abs), s = a.reduce(function (x, y2) { return x + y2; }, 0) || 1; return a.map(function (v) { return v / s; }); })() : null);
    var aucAll = auc(P, Y), edge = acc - majAcc, verdict = n < 200 ? 'insufficient' : (zEff > 2 && edge > 0.01 && aucAll > 0.52 ? 'edge' : (edge > 0 ? 'weak' : 'none'));
    return { model: kind, horizon: h, n: n, acc: acc, baseline: majAcc, upRate: upRate, edge: edge, z: z, zEff: zEff, auc: aucAll, brier: brier, brierBase: brierBase, confAcc: confAcc, confN: conf.length, calibration: cal, folds: foldStats, pNow: pNow, lastIdx: last, importance: imp, names: fe.names, oos: { p: P, y: Y, i: T }, verdict: verdict };
  }

  /* ------------------------------------------------------------ regimes: k-means (features) + 2-state Gaussian HMM (returns) */
  function kmeans(rows, k, seed, iters) {
    var r = rng(seed || 11), n = rows.length, dim = rows[0].length, C = [rows[Math.floor(r() * n)].slice()];
    function d2(a, b) { var s = 0; for (var j = 0; j < dim; j++) s += (a[j] - b[j]) * (a[j] - b[j]); return s; }
    while (C.length < k) { var D = rows.map(function (x) { return Math.min.apply(null, C.map(function (c) { return d2(x, c); })); }), tot = D.reduce(function (a, b) { return a + b; }, 0), u = r() * tot, acc = 0, pick = 0; for (var i = 0; i < n; i++) { acc += D[i]; if (acc >= u) { pick = i; break; } } C.push(rows[pick].slice()); }
    var lab = new Int32Array(n);
    for (var t = 0; t < (iters || 40); t++) { var moved = 0; for (var i2 = 0; i2 < n; i2++) { var best = 0, bd = Infinity; for (var c = 0; c < k; c++) { var dd = d2(rows[i2], C[c]); if (dd < bd) { bd = dd; best = c; } } if (lab[i2] !== best) { lab[i2] = best; moved++; } } var S = C.map(function () { return new Array(dim).fill(0); }), N = new Array(k).fill(0); for (var i3 = 0; i3 < n; i3++) { N[lab[i3]]++; for (var j = 0; j < dim; j++) S[lab[i3]][j] += rows[i3][j]; } for (var c2 = 0; c2 < k; c2++) if (N[c2]) for (var j2 = 0; j2 < dim; j2++) C[c2][j2] = S[c2][j2] / N[c2]; if (!moved && t) break; }
    return { C: C, labels: lab };
  }
  function regimes(d, opt) {
    opt = opt || {}; var k = opt.k || 4, lr = logRet(d.c), vol = rollingStd(lr, 20), er = efficiency(d.c, 20), ad = adx(d, 14), rows = [], at = [];
    for (var i = 40; i < d.n; i++) { var r20 = Math.log(d.c[i] / d.c[i - 20]); if (!isFinite(vol[i]) || !isFinite(er[i]) || !isFinite(ad[i])) continue; rows.push([r20 / (vol[i] * Math.sqrt(20) || 1e-9), Math.log(vol[i] + 1e-12), er[i], ad[i] / 50]); at.push(i); }
    if (rows.length < 50) return null;
    var sc = standardizer(rows), Z = rows.map(sc.f), km = kmeans(Z, k, opt.seed || 11);
    // name clusters from their (unstandardised) centroids
    var cent = km.C.map(function (c) { return c.map(function (z, j) { return z * sc.sd[j] + sc.mu[j]; }); }), volRank = cent.map(function (c, i) { return [c[1], i]; }).sort(function (a, b) { return a[0] - b[0]; }).map(function (x) { return x[1]; });
    var names = cent.map(function (c, ci) { var hiVol = volRank.indexOf(ci) === k - 1, loVol = volRank.indexOf(ci) === 0; if (c[2] > 0.18 && c[0] > 0.6) return hiVol ? 'Bull trend · high vol' : 'Bull trend'; if (c[2] < -0.18 && c[0] < -0.6) return hiVol ? 'Bear trend · high vol' : 'Bear trend'; if (hiVol) return 'Volatile chop'; if (loVol) return 'Quiet range'; return 'Range / rotation'; });
    var seen = {}; names = names.map(function (n0) { seen[n0] = (seen[n0] || 0) + 1; return seen[n0] > 1 ? n0 + ' ' + seen[n0] : n0; });
    var lab = new Int32Array(d.n).fill(-1); at.forEach(function (i, j) { lab[i] = km.labels[j]; });
    // causal smoothing: majority label over the last 5 bars (reduces flicker; uses no future data)
    var sm = new Int32Array(d.n).fill(-1); for (var q = 0; q < d.n; q++) { if (lab[q] < 0) continue; var cnt = {}, best = lab[q], bc = 0; for (var r = Math.max(0, q - 4); r <= q; r++) if (lab[r] >= 0) { cnt[lab[r]] = (cnt[lab[r]] || 0) + 1; if (cnt[lab[r]] > bc || (cnt[lab[r]] === bc && lab[r] === lab[q])) { bc = cnt[lab[r]]; best = lab[r]; } } sm[q] = best; } lab = sm;
    // forward stats per regime (what tended to happen next 10 bars) — descriptive, in-sample
    var stats = cent.map(function (c, ci) { var rr = [], cnt = 0; at.forEach(function (i, j) { if (km.labels[j] === ci) { cnt++; if (i + 10 < d.n) rr.push(Math.log(d.c[i + 10] / d.c[i])); } }); return { id: ci, name: names[ci], share: cnt / at.length, fwdMed: median(rr), fwdUp: rr.length ? rr.filter(function (x) { return x > 0; }).length / rr.length : NaNv, vol: Math.exp(c[1]), er: c[2], trendZ: c[0] }; });
    var cur = lab[d.n - 1], run = 0; for (var i2 = d.n - 1; i2 >= 0 && lab[i2] === cur; i2--) run++;
    return { k: k, labels: lab, names: names, stats: stats, current: cur, currentName: names[cur], runBars: run };
  }
  function hmm2(ret, opt) {
    opt = opt || {}; var x = Array.prototype.filter.call(ret, function (v, i) { return i > 0 && isFinite(v); }), n = x.length; if (n < 100) return null;
    var sd = std(x), mu = [mean(x), mean(x)], sg = [sd * 0.6, sd * 1.6], A = [[0.97, 0.03], [0.05, 0.95]], pi = [0.5, 0.5], al, be, c, ll = -Infinity;
    function em(v, s) { return Math.exp(-0.5 * ((v - mu[s]) / sg[s]) * ((v - mu[s]) / sg[s])) / (sg[s] * 2.5066282746) + 1e-300; }
    for (var it = 0; it < (opt.iters || 30); it++) {
      al = new Float64Array(n * 2); be = new Float64Array(n * 2); c = new Float64Array(n);
      for (var s = 0; s < 2; s++) al[s] = pi[s] * em(x[0], s); c[0] = al[0] + al[1]; al[0] /= c[0]; al[1] /= c[0];
      for (var t = 1; t < n; t++) { for (var j = 0; j < 2; j++) al[t * 2 + j] = (al[(t - 1) * 2] * A[0][j] + al[(t - 1) * 2 + 1] * A[1][j]) * em(x[t], j); c[t] = al[t * 2] + al[t * 2 + 1]; al[t * 2] /= c[t]; al[t * 2 + 1] /= c[t]; }
      be[(n - 1) * 2] = 1; be[(n - 1) * 2 + 1] = 1;
      for (var t2 = n - 2; t2 >= 0; t2--) for (var i = 0; i < 2; i++) be[t2 * 2 + i] = (A[i][0] * em(x[t2 + 1], 0) * be[(t2 + 1) * 2] + A[i][1] * em(x[t2 + 1], 1) * be[(t2 + 1) * 2 + 1]) / c[t2 + 1];
      var nll = 0; for (var t3 = 0; t3 < n; t3++) nll += Math.log(c[t3]);
      var gsum = [0, 0], xs = [[0, 0], [0, 0]], wsum = [0, 0], wx = [0, 0], wx2 = [0, 0];
      for (var t4 = 0; t4 < n; t4++) { for (var k2 = 0; k2 < 2; k2++) { var g = al[t4 * 2 + k2] * be[t4 * 2 + k2]; wsum[k2] += g; wx[k2] += g * x[t4]; if (t4 < n - 1) gsum[k2] += g; } if (t4 < n - 1) for (var a = 0; a < 2; a++) for (var b = 0; b < 2; b++) xs[a][b] += al[t4 * 2 + a] * A[a][b] * em(x[t4 + 1], b) * be[(t4 + 1) * 2 + b] / c[t4 + 1]; }
      for (var k3 = 0; k3 < 2; k3++) { mu[k3] = wx[k3] / wsum[k3]; for (var t5 = 0; t5 < n; t5++) { var g2 = al[t5 * 2 + k3] * be[t5 * 2 + k3]; wx2[k3] += g2 * (x[t5] - mu[k3]) * (x[t5] - mu[k3]); } sg[k3] = Math.max(Math.sqrt(wx2[k3] / wsum[k3]), sd * 0.05); for (var b2 = 0; b2 < 2; b2++) A[k3][b2] = xs[k3][b2] / gsum[k3]; pi[k3] = al[k3] * be[k3]; }
      if (Math.abs(nll - ll) < 1e-6) break; ll = nll;
    }
    var calm = sg[0] <= sg[1] ? 0 : 1, turb = 1 - calm, post = new Float64Array(ret.length).fill(NaNv), off = ret.length - n;
    for (var t6 = 0; t6 < n; t6++) post[off + t6] = al[t6 * 2 + turb]; // filtered (causal) probability of turbulent state
    return { pTurbulent: post, sigma: { calm: sg[calm], turbulent: sg[turb] }, persist: { calm: A[calm][calm], turbulent: A[turb][turb] }, current: al[(n - 1) * 2 + turb], logLik: ll };
  }

  /* ------------------------------------------------------------ anomalies (volatility) */
  function anomalies(d, opt) {
    opt = opt || {}; var w = opt.window || 100, thr = opt.z || 3.5, tr = trueRange(d), lr = logRet(d.c), out = [], score = new Float64Array(d.n).fill(NaNv);
    for (var i = w; i < d.n; i++) { var a = [], b = []; for (var j = i - w; j < i; j++) { a.push(Math.log(tr[j] + 1e-12)); b.push(Math.abs(lr[j])); } var ma = median(a), mada = median(a.map(function (v) { return Math.abs(v - ma); })) * 1.4826 || 1e-9, mb = median(b), madb = median(b.map(function (v) { return Math.abs(v - mb); })) * 1.4826 || 1e-9; var z1 = (Math.log(tr[i] + 1e-12) - ma) / mada, z2 = (Math.abs(lr[i]) - mb) / madb, z = Math.max(z1, z2 / 2); score[i] = z; if (z > thr && tr[i] > 0) out.push({ i: i, t: d.t[i], z: z, dir: d.c[i] >= d.o[i] ? 1 : -1, range: tr[i] }); }
    return { list: out, score: score, thr: thr };
  }

  /* ------------------------------------------------------------ similarity search: "past setups like now" */
  function similar(d, opt) {
    opt = opt || {}; var W = opt.window || 24, h = opt.horizon || 12, k = opt.k || 12, lr = logRet(d.c), vol = rollingStd(lr, 50), R = rsi(d.c, 14), volAvg = sma(Array.prototype.map.call(vol, function (x) { return isFinite(x) ? x : 0; }), 200);
    function vec(i) { var v = []; var base = d.c[i - W]; for (var j = i - W + 1; j <= i; j++) v.push(Math.log(d.c[j] / base) / ((vol[i] || 1e-9) * Math.sqrt(W))); v.push((R[i] - 50) / 25); v.push(isFinite(volAvg[i]) && volAvg[i] > 0 ? Math.log((vol[i] || 1e-9) / volAvg[i]) : 0); return v; }
    var now = d.n - 1; if (now < W + 60) return null; var q = vec(now), cands = [];
    for (var i = W + 55; i + h < now - W; i++) { if (!isFinite(vol[i]) || !isFinite(R[i])) continue; var v = vec(i), s = 0; for (var j = 0; j < v.length; j++) s += (v[j] - q[j]) * (v[j] - q[j]); cands.push([Math.sqrt(s), i]); }
    cands.sort(function (a, b) { return a[0] - b[0]; });
    var picks = []; for (var c = 0; c < cands.length && picks.length < k; c++) { var ii = cands[c][1]; if (picks.some(function (p) { return Math.abs(p.i - ii) < W; })) continue; var fwd = Math.log(d.c[ii + h] / d.c[ii]), mfe = 0, mae = 0; for (var t = ii + 1; t <= ii + h; t++) { mfe = Math.max(mfe, Math.log(d.h[t] / d.c[ii])); mae = Math.min(mae, Math.log(d.l[t] / d.c[ii])); } picks.push({ i: ii, t: d.t[ii], dist: cands[c][0], fwd: fwd, mfe: mfe, mae: mae, path: Array.prototype.slice.call(d.c, ii - W, ii + h + 1) }); }
    var up = picks.filter(function (p) { return p.fwd > 0; }).length, baseUp = 0, bn = 0; for (var b = 0; b + h < d.n; b++) { bn++; if (d.c[b + h] > d.c[b]) baseUp++; }
    return { window: W, horizon: h, matches: picks, upShare: picks.length ? up / picks.length : NaNv, medFwd: median(picks.map(function (p) { return p.fwd; })), baseUp: baseUp / bn, nowPath: Array.prototype.slice.call(d.c, now - W, now + 1) };
  }

  /* ------------------------------------------------------------ risk */
  var SPEC = { XAUUSD: { contract: 100, quoteUSD: true, pip: 0.1, spread: 0.3 }, EURUSD: { contract: 100000, quoteUSD: true, pip: 0.0001, spread: 0.0001 }, GBPUSD: { contract: 100000, quoteUSD: true, pip: 0.0001 }, AUDUSD: { contract: 100000, quoteUSD: true, pip: 0.0001 }, NZDUSD: { contract: 100000, quoteUSD: true, pip: 0.0001 }, USDJPY: { contract: 100000, quoteUSD: false, pip: 0.01, spread: 0.012 }, USDCHF: { contract: 100000, quoteUSD: false, pip: 0.0001 }, USDCAD: { contract: 100000, quoteUSD: false, pip: 0.0001 }, USDZAR: { contract: 100000, quoteUSD: false, pip: 0.0001, spread: 0.008 } };
  var RULES = { maxRiskPct: 1.0, defaultRiskPct: 0.75, maxDailyLossPct: 2.0, maxOpenRiskPct: 3.0, maxConcurrent: 3 };
  function positionSize(p) {
    var s = SPEC[p.symbol] || SPEC.EURUSD, dist = Math.abs(p.entry - p.stop); if (!(dist > 0) || !(p.account > 0)) return { ok: false, why: 'Entry and stop must differ and account must be positive.' };
    var riskPct = Math.min(p.riskPct, RULES.maxRiskPct), riskCash = p.account * riskPct / 100, perUnit = s.quoteUSD ? dist : dist / p.entry, units = riskCash / perUnit, lots = units / s.contract;
    var rr = p.target ? Math.abs(p.target - p.entry) / dist : NaNv, dir = p.entry > p.stop ? 1 : -1, tgtOk = p.target ? (dir > 0 ? p.target > p.entry : p.target < p.entry) : true;
    var dayLeft = p.account * RULES.maxDailyLossPct / 100 - Math.max(0, p.dayLoss || 0), blocked = riskCash > dayLeft + 1e-9;
    return { ok: true, dir: dir, riskPct: riskPct, capped: p.riskPct > RULES.maxRiskPct, riskCash: riskCash, units: units, lots: lots, pips: dist / s.pip, rr: rr, targetOk: tgtOk, breakevenWin: isFinite(rr) ? 1 / (1 + rr) : NaNv, rewardCash: isFinite(rr) ? riskCash * rr : NaNv, dayLeft: dayLeft, blocked: blocked, notionalUSD: s.quoteUSD ? units * p.entry : units };
  }
  /* ML sizing: fractional Kelly from OOS-calibrated probability, never above the base risk or the hard cap, cut in turbulent regimes */
  function mlSize(p) {
    var base = Math.min(p.baseRiskPct || RULES.defaultRiskPct, RULES.maxRiskPct), rr = p.rr || 2, prob = p.prob, reasons = [];
    if (!p.modelOk) { reasons.push('Model has no out-of-sample edge over the baseline, so it gets no say: risk is halved to stay conservative.'); return { riskPct: base * 0.5, kelly: NaNv, reasons: reasons, mult: 0.5 }; }
    var kelly = prob - (1 - prob) / rr, mult = clamp(kelly / 0.2, 0.25, 1); // edge score: full base risk only when full-Kelly >= 20%; never more
    reasons.push('Calibrated p=' + prob.toFixed(2) + ' at ' + rr.toFixed(1) + 'R gives a Kelly edge score of ' + (kelly * 100).toFixed(1) + '%, mapped to ' + mult.toFixed(2) + 'x of base risk (floor 0.25x, ceiling 1x).');
    if (p.turbulent > 0.6) { mult *= 0.6; reasons.push('Turbulent volatility state (HMM p=' + p.turbulent.toFixed(2) + '): size cut 40%.'); }
    if (p.anomaly) { mult *= 0.5; reasons.push('Volatility anomaly on the latest bars: size halved.'); }
    var risk = base * clamp(mult, 0, 1); if (p.dayLeftPct != null && risk > p.dayLeftPct) { risk = Math.max(0, p.dayLeftPct); reasons.push('Capped by remaining daily-loss budget.'); }
    reasons.push('Never above base ' + base.toFixed(2) + '% or the ' + RULES.maxRiskPct + '% hard cap.');
    return { riskPct: risk, kelly: kelly, reasons: reasons, mult: mult };
  }

  /* ------------------------------------------------------------ sessions & kill zones (DST-aware via Intl) */
  function tzOffsetMin(tz, date) { var f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }); var p = {}; f.formatToParts(date).forEach(function (x) { p[x.type] = x.value; }); var asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second); return Math.round((asUTC - date.getTime()) / 60000); }
  var SESSIONS = [{ id: 'syd', name: 'Sydney', tz: 'Australia/Sydney', open: 7, close: 16 }, { id: 'tok', name: 'Tokyo', tz: 'Asia/Tokyo', open: 9, close: 18 }, { id: 'lon', name: 'London', tz: 'Europe/London', open: 8, close: 17 }, { id: 'ny', name: 'New York', tz: 'America/New_York', open: 8, close: 17 }];
  var KILLZONES = [{ id: 'kz-asia', name: 'Asian range', tz: 'America/New_York', open: 20, close: 24 }, { id: 'kz-lon', name: 'London open KZ', tz: 'America/New_York', open: 2, close: 5 }, { id: 'kz-ny', name: 'New York AM KZ', tz: 'America/New_York', open: 7, close: 10 }, { id: 'kz-lc', name: 'London close KZ', tz: 'America/New_York', open: 10, close: 12 }];
  /* returns windows as [startMin,endMin) in the target tz (default SAST) for the given date */
  function sessionWindows(now, targetTz) {
    targetTz = targetTz || 'Africa/Johannesburg'; var tOff = tzOffsetMin(targetTz, now);
    function conv(s) { var off = tzOffsetMin(s.tz, now), a = ((s.open * 60 - off + tOff) % 1440 + 1440) % 1440, b = ((s.close * 60 - off + tOff) % 1440 + 1440) % 1440; return { id: s.id, name: s.name, tz: s.tz, start: a, end: b }; }
    var nowMin = (Math.floor(now.getTime() / 60000) + tOff) % 1440; nowMin = (nowMin + 1440) % 1440;
    function active(w) { return w.start < w.end ? nowMin >= w.start && nowMin < w.end : nowMin >= w.start || nowMin < w.end; }
    function until(w) { var x = (w.start - nowMin + 1440) % 1440; return x; }
    var ses = SESSIONS.map(conv), kz = KILLZONES.map(conv); ses.concat(kz).forEach(function (w) { w.active = active(w); w.untilOpen = until(w); w.untilClose = (w.end - nowMin + 1440) % 1440; });
    var dow = new Date(now.getTime() + tOff * 60000).getUTCDay(), weekend = dow === 6 || (dow === 0 && nowMin < 23 * 60);
    return { nowMin: nowMin, sessions: ses, killzones: kz, weekend: weekend, tz: targetTz };
  }

  return { rng: rng, mean: mean, std: std, median: median, quantile: quantile, clamp: clamp, cols: cols, sma: sma, ema: ema, rsi: rsi, atr: atr, trueRange: trueRange, bollinger: bollinger, macd: macd, donchian: donchian, adx: adx, efficiency: efficiency, vwapDaily: vwapDaily, pctRank: pctRank, logRet: logRet, rollingStd: rollingStd,
    swings: swings, PATTERNS: PATTERNS, detectPatterns: detectPatterns, patternStats: patternStats, STRATS: STRATS, backtest: backtest, tradeStats: tradeStats, walkForward: walkForward, monteCarlo: monteCarlo,
    features: features, labels: labels, trainLogistic: trainLogistic, trainGBM: trainGBM, auc: auc, walkForwardModel: walkForwardModel, kmeans: kmeans, regimes: regimes, hmm2: hmm2, anomalies: anomalies, similar: similar,
    SPEC: SPEC, RULES: RULES, positionSize: positionSize, mlSize: mlSize, SESSIONS: SESSIONS, KILLZONES: KILLZONES, sessionWindows: sessionWindows, tzOffsetMin: tzOffsetMin };
});
