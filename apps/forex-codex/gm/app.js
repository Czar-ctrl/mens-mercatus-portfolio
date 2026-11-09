/*! Forex Mercatus Codex · God Mode UI (preview 2026-10-20). Educational / paper trading only — not financial advice.
 * No broker connection exists in this code. All analytics run on-device over real historical data shipped in gm/data/. */
(function () {
  'use strict';
  var C = window.FXCore, LW = window.LightweightCharts;
  var BASE = (document.currentScript && document.currentScript.src) ? new URL('.', document.currentScript.src).href : 'gm/';
  var DESK = 'https://api.mensmercatus.online/forex/', HEALTH = DESK + 'api/health', QUOTE_API = 'https://open.er-api.com/v6/latest/USD';
  var REAL_ORIGIN = /(^|\.)mensmercatus\.online$/.test(location.hostname);
  var SAST = 'Africa/Johannesburg', SHIFT = 7200; // chart axis shows SAST (UTC+2, no DST)
  var TFS = ['5m', '15m', '1h', '4h', '1d'], HORIZON = { '5m': 12, '15m': 8, '1h': 6, '4h': 3, '1d': 5 };
  var TABS = [['chart', 'Chart'], ['brief', 'AI brief'], ['ai', 'AI Lab'], ['lab', 'Strategy Lab'], ['risk', 'Risk'], ['scan', 'Scanner'], ['sess', 'Sessions'], ['journal', 'Journal'], ['sim', 'Paper sim'], ['cal', 'Calendar'], ['desk', 'Live desk']];
  var S = { sym: 'XAUUSD', tf: '1h', tab: 'chart', man: null, cache: {}, ai: {}, model: {}, charts: {}, ind: { e20: true, e50: true, e200: false, bb: false, vwap: false, don: false, reg: true, anom: true, pat: false }, osc: 'rsi' };
  var $ = function (s, r) { return (r || document).querySelector(s); }, $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function h(tag, attrs, html) { var e = document.createElement(tag); if (attrs) Object.keys(attrs).forEach(function (k) { if (k === 'class') e.className = attrs[k]; else e.setAttribute(k, attrs[k]); }); if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function dec(sym) { var m = S.man && S.man.symbols[sym]; return m ? m.decimals : 5; }
  function px(sym, x) { return isFinite(x) ? Number(x).toLocaleString('en-US', { minimumFractionDigits: dec(sym), maximumFractionDigits: dec(sym) }) : '—'; }
  function f(x, d) { return isFinite(x) ? Number(x).toFixed(d == null ? 2 : d) : '—'; }
  function pct(x, d) { return isFinite(x) ? (x * 100).toFixed(d == null ? 1 : d) + '%' : '—'; }
  function sgn(x, d) { return isFinite(x) ? (x > 0 ? '+' : '') + Number(x).toFixed(d == null ? 2 : d) : '—'; }
  function cls(x) { return x > 0 ? 'up' : x < 0 ? 'dn' : 'mute'; }
  var dtf = new Intl.DateTimeFormat('en-ZA', { timeZone: SAST, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  var dtfd = new Intl.DateTimeFormat('en-ZA', { timeZone: SAST, day: '2-digit', month: 'short', year: 'numeric' });
  function T(t, dayOnly) { return (dayOnly ? dtfd : dtf).format(new Date(t * 1000)) + (dayOnly ? '' : ' SAST'); }
  function css(v) { return getComputedStyle($('#fxg')).getPropertyValue(v).trim(); }
  function isLight() { return document.documentElement.classList.contains('mm-light'); }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } return v; }

  /* ------------------------------------------------------------ worker */
  var W = null, wid = 0, wq = {};
  try { W = new Worker(BASE + 'worker.js?v=gm1'); W.onmessage = function (e) { var p = wq[e.data.id]; if (!p) return; delete wq[e.data.id]; e.data.ok ? p.res(e.data.res) : p.rej(new Error(e.data.err)); }; W.onerror = function () { W = null; }; } catch (e) { W = null; }
  function compute(op, rows, opts) {
    if (W) return new Promise(function (res, rej) { var id = ++wid; wq[id] = { res: res, rej: rej }; W.postMessage({ id: id, op: op, rows: rows, opts: opts }); });
    return new Promise(function (res) { setTimeout(function () { var d = C.cols(rows), o; if (op === 'model') o = C.walkForwardModel(d, opts); else if (op === 'wf') { o = C.walkForward(d, opts.strat, opts); o.mc = C.monteCarlo(o.trades.map(function (t) { return t.R; }), opts); } else if (op === 'bt') { var St = C.STRATS[opts.strat]; o = C.backtest(d, opts.signals ? Int8Array.from(opts.signals) : St.signals(d, opts.params || St.def), opts); o.mc = C.monteCarlo(o.trades.map(function (t) { return t.R; }), opts); } else { o = { regimes: C.regimes(d, opts), hmm: C.hmm2(C.logRet(d.c)), anom: C.anomalies(d, opts), sim: C.similar(d, opts) }; } res(JSON.parse(JSON.stringify(o, function (k, v) { return typeof v === 'function' ? undefined : (ArrayBuffer.isView(v) ? Array.prototype.slice.call(v) : v); }))); }, 30); });
  }

  /* ------------------------------------------------------------ data */
  function key(sym, tf) { return sym + '_' + tf; }
  function tfsOf(sym) { var m = S.man.symbols[sym]; return TFS.filter(function (t) { return m.tfs[t]; }); }
  function load(sym, tf) {
    var k = key(sym, tf); if (S.cache[k]) return Promise.resolve(S.cache[k]);
    var m = S.man.symbols[sym].tfs[tf]; if (!m) return Promise.reject(new Error('no ' + k));
    return fetch(BASE + 'data/' + m.file).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (j) {
      var d = C.cols(j.rows); var o = { sym: sym, tf: tf, rows: j.rows, d: d, closeOnly: !!j.close_only, A: C.atr(d, 14), e20: C.ema(d.c, 20), e50: C.ema(d.c, 50), e200: C.ema(d.c, 200), rsi: C.rsi(d.c, 14) };
      o.bb = C.bollinger(d.c, 20, 2); S.cache[k] = o; return o;
    });
  }
  function cur() { return load(S.sym, S.tf); }

  /* ------------------------------------------------------------ chart helpers */
  function chartOpts(extra) {
    var ink = css('--mute') || '#aaa', line = css('--line') || 'rgba(255,255,255,.08)';
    var o = { autoSize: true, layout: { background: { type: 'solid', color: 'transparent' }, textColor: ink, fontFamily: 'Inter, system-ui, sans-serif', fontSize: 11 }, grid: { vertLines: { color: line }, horzLines: { color: line } }, rightPriceScale: { borderColor: line }, timeScale: { borderColor: line, timeVisible: S.tf !== '1d', secondsVisible: false, rightOffset: 4 }, crosshair: { mode: 0 } };
    if (extra) Object.keys(extra).forEach(function (k) { o[k] = Object.assign({}, o[k] || {}, extra[k]); });
    return o;
  }
  function mk(el, extra) { var c = LW.createChart(el, chartOpts(extra)); (S.allCharts = S.allCharts || []).push(c); return c; }
  function bars(o, from) { var d = o.d, out = []; for (var i = from || 0; i < d.n; i++) out.push({ time: d.t[i] + SHIFT, open: d.o[i], high: d.h[i], low: d.l[i], close: d.c[i] }); return out; }
  function line(o, arr, from) { var d = o.d, out = []; for (var i = from || 0; i < d.n; i++) if (isFinite(arr[i])) out.push({ time: d.t[i] + SHIFT, value: arr[i] }); return out; }
  function candleOpts() { return { upColor: css('--up'), downColor: css('--dn'), borderUpColor: css('--up'), borderDownColor: css('--dn'), wickUpColor: css('--up'), wickDownColor: css('--dn') }; }
  var REG_COL = ['rgba(45,212,191,.08)', 'rgba(226,71,90,.08)', 'rgba(167,139,250,.09)', 'rgba(232,196,106,.08)', 'rgba(120,160,255,.08)'];
  function rethemeAll() { (S.allCharts || []).forEach(function (c) { var o = chartOpts(); c.applyOptions({ layout: o.layout, grid: o.grid, rightPriceScale: o.rightPriceScale, timeScale: { borderColor: o.timeScale.borderColor } }); }); if (S.main) S.main.candles.applyOptions(candleOpts()); drawSessions(); drawSparks(); }

  /* ------------------------------------------------------------ shell: toolbar, tabs, panels, watchlist */
  var PANELS = {
    chart: '<div class="fxg-toggles" id="fxg-ind"></div><div class="fxg-chartwrap"><div class="fxg-legend" id="fxg-legend"></div><div id="fxg-main" style="position:absolute;inset:0"></div></div>' +
      '<div class="fxg-toggles" style="margin:.4rem 0 0"><div class="fxg-seg" id="fxg-oscsel" role="group" aria-label="Oscillator"><button type="button" data-o="rsi" aria-pressed="true">RSI 14</button><button type="button" data-o="macd" aria-pressed="false">MACD 12/26/9</button></div><span class="fxg-status" id="fxg-chart-status" style="align-self:center"></span></div>' +
      '<div class="fxg-osc"><div id="fxg-oscc" style="position:absolute;inset:0"></div></div>' +
      '<h3 style="font-size:.95rem;margin:.9rem 0 0">Multi-timeframe stack <span class="dim" style="font:500 .7rem var(--mono)">EMA20 vs EMA50 bias per timeframe</span></h3><div class="fxg-mtf" id="fxg-mtf"></div>',
    brief: '<div class="fxg-row" style="margin-top:0"><div class="fxg-box" style="grid-column:1/-1;min-height:420px"><h3>AI market brief <small id="fxg-brief-meta">on-device · rule-based + ML</small></h3><div class="fxg-brief" id="fxg-brief"><div class="fxg-empty">Preparing the brief…</div></div><p style="margin-top:.8rem"><button class="fxg-btn" id="fxg-brief-re" type="button">Rebuild brief</button></p></div></div>',
    ai: '<div class="fxg-form" style="margin-bottom:.6rem"><label>Model<select id="fxg-m-kind"><option value="gbm">Gradient-boosted stumps</option><option value="logistic">Logistic regression (L2)</option></select></label><label>Horizon (bars)<input id="fxg-m-h" type="number" min="1" max="48" value="6"></label><label>Walk-forward folds<input id="fxg-m-folds" type="number" min="2" max="10" value="5"></label><button class="fxg-btn pri" id="fxg-m-run" type="button">Train &amp; validate</button></div><p class="fxg-status" id="fxg-m-status"></p>' +
      '<div class="fxg-row" style="margin-top:.2rem"><div class="fxg-box" style="min-height:300px"><h3>Direction model · out-of-sample <small id="fxg-m-verdict"></small></h3><div class="fxg-kpis" id="fxg-m-kpis"></div><p id="fxg-m-text" style="min-height:4.5em"></p></div>' +
      '<div class="fxg-box" style="min-height:300px"><h3>Probability now <small>next <span id="fxg-m-hz">6</span> bars</small></h3><div id="fxg-m-now" style="min-height:110px"></div><h3 style="margin-top:.7rem">Per-fold accuracy vs baseline <small>OOS</small></h3><canvas class="fxg-canvas" id="fxg-m-folds-c" style="height:120px"></canvas></div></div>' +
      '<div class="fxg-row"><div class="fxg-box" style="min-height:260px"><h3>Calibration <small>predicted vs actual up-rate</small></h3><div id="fxg-m-cal"></div></div><div class="fxg-box" style="min-height:260px"><h3>Feature importance <small id="fxg-m-impk"></small></h3><div class="fxg-bars" id="fxg-m-imp"></div></div></div>' +
      '<div class="fxg-row"><div class="fxg-box" style="min-height:280px"><h3>Regime classifier <small>k-means · k=4</small></h3><div id="fxg-reg"></div></div><div class="fxg-box" style="min-height:280px"><h3>Volatility state <small>2-state Gaussian HMM</small></h3><div id="fxg-hmm"></div><canvas class="fxg-canvas" id="fxg-hmm-c" style="height:90px"></canvas></div></div>' +
      '<div class="fxg-row"><div class="fxg-box" style="min-height:250px"><h3>Volatility anomalies <small>robust z · median/MAD</small></h3><div id="fxg-anom"></div></div><div class="fxg-box" style="min-height:250px"><h3>ML position-size suggestion <small>bounded by risk rules</small></h3><div id="fxg-mls"></div></div></div>' +
      '<div class="fxg-box" style="margin-top:.7rem;min-height:300px"><h3>Past setups like now <small>k-nearest-neighbour similarity search</small></h3><div id="fxg-sim-sum" style="min-height:3em"></div><div class="fxg-sims" id="fxg-sims"></div></div>',
    lab: '<div class="fxg-form"><label>Strategy<select id="fxg-s-strat"></select></label><label>Reward:risk (R)<input id="fxg-s-rr" type="number" step="0.1" min="0.5" max="6" value="2"></label><label>Stop (× ATR14)<input id="fxg-s-am" type="number" step="0.1" min="0.5" max="6" value="2"></label><label>Risk per trade %<input id="fxg-s-risk" type="number" step="0.05" min="0.05" max="1" value="0.75"></label><label>Cost / trade (price)<input id="fxg-s-cost" type="number" step="any" min="0" value="0.3"></label><label>WF folds<input id="fxg-s-folds" type="number" min="2" max="10" value="5"></label></div>' +
      '<p class="btn-row" style="display:flex;gap:.5rem;flex-wrap:wrap;margin:.6rem 0"><button class="fxg-btn" id="fxg-s-bt" type="button">Backtest (default params)</button><button class="fxg-btn pri" id="fxg-s-wf" type="button">Walk-forward + Monte Carlo</button></p><p class="fxg-status" id="fxg-s-status">Signals are taken at a bar close and filled at the next bar open. If a bar touches both stop and target, the stop is assumed first.</p>' +
      '<div class="fxg-kpis" id="fxg-s-kpis" style="min-height:136px"></div><div class="fxg-eq" style="margin-top:.6rem"><div id="fxg-s-eq" style="position:absolute;inset:0"></div></div><div class="fxg-dd"><div id="fxg-s-dd" style="position:absolute;inset:0"></div></div>' +
      '<div class="fxg-row"><div class="fxg-box" style="min-height:240px"><h3>Monte Carlo <small>1,000 trade-order reshuffles</small></h3><canvas class="fxg-canvas" id="fxg-s-mc" style="height:130px"></canvas><div id="fxg-s-mck"></div></div><div class="fxg-box" style="min-height:240px"><h3>Walk-forward folds <small>optimised in-sample → tested out-of-sample</small></h3><div class="fxg-scroll" style="max-height:220px"><table class="fxg-tbl" id="fxg-s-foldtbl"></table></div></div></div>' +
      '<div class="fxg-box" style="margin-top:.7rem"><h3>Trades <small>latest 80 · click to view on chart</small></h3><div class="fxg-scroll"><table class="fxg-tbl" id="fxg-s-trades"></table></div></div>',
    risk: '<div class="fxg-row" style="margin-top:0"><div class="fxg-box"><h3>Position size &amp; R calculator <small id="fxg-r-sym"></small></h3><div class="fxg-form"><label>Account (USD)<input id="fxg-r-acc" type="number" value="10000" min="0"></label><label>Risk %<input id="fxg-r-risk" type="number" step="0.05" value="0.75" min="0"></label><label>Entry<input id="fxg-r-entry" type="number" step="any"></label><label>Stop<input id="fxg-r-stop" type="number" step="any"></label><label>Target<input id="fxg-r-tgt" type="number" step="any"></label><label>Realised loss today (USD)<input id="fxg-r-day" type="number" step="any" value="0" min="0"></label></div><p style="margin:.5rem 0 0"><button class="fxg-btn" id="fxg-r-fill" type="button">Fill from last bar (±1.5 ATR, 2R)</button></p></div>' +
      '<div class="fxg-box"><h3>Result <small id="fxg-r-state"></small></h3><div class="fxg-kpis" id="fxg-r-out" style="min-height:200px"></div></div></div>' +
      '<div class="fxg-row"><div class="fxg-box"><h3>R-multiple ladder</h3><div class="fxg-scroll" style="max-height:260px"><table class="fxg-tbl" id="fxg-r-ladder"></table></div></div><div class="fxg-box"><h3>House risk rules <small>enforced by sim &amp; calculator</small></h3><ul id="fxg-r-rules" style="margin:.2rem 0 0;padding-left:1.1rem;color:var(--mute)"></ul><div id="fxg-r-ml" style="margin-top:.6rem"></div></div></div>',
    scan: '<div class="fxg-form"><label>Direction<select id="fxg-p-dir"><option value="all">All</option><option value="1">Bullish</option><option value="-1">Bearish</option><option value="0">Neutral</option></select></label><label>Lookback (bars)<input id="fxg-p-lb" type="number" value="3" min="1" max="30"></label><button class="fxg-btn pri" id="fxg-p-run" type="button">Scan every symbol &amp; timeframe</button></div><p class="fxg-status" id="fxg-p-status">Each hit shows how often price moved the pattern\u2019s way over the next few bars in this data set, against the plain base rate, so you can see which patterns actually mean anything here.</p><div class="fxg-scroll" style="max-height:520px"><table class="fxg-tbl" id="fxg-p-tbl"></table></div>',
    sess: '<div class="fxg-box" style="min-height:300px"><h3>Sessions &amp; kill zones <small id="fxg-ss-now">SAST</small></h3><svg class="fxg-sess" id="fxg-ss-svg" role="img" aria-label="24-hour session timeline in SAST"></svg></div><div class="fxg-row"><div class="fxg-box" style="min-height:260px"><h3>Status <small>daylight-saving aware</small></h3><div id="fxg-ss-list"></div></div><div class="fxg-box" style="min-height:260px"><h3>When does <span id="fxg-ss-sym">gold</span> move? <small>avg 1h range by SAST hour</small></h3><canvas class="fxg-canvas" id="fxg-ss-hr" style="height:170px"></canvas><p class="dim" id="fxg-ss-hrn" style="font-size:.74rem"></p></div></div>',
    journal: '<div class="fxg-box"><h3>Log a trade <small>stored only in this browser</small></h3><div class="fxg-form"><label>Time<input id="fxg-j-t" type="datetime-local"></label><label>Symbol<select id="fxg-j-sym"></select></label><label>Side<select id="fxg-j-side"><option value="1">Long</option><option value="-1">Short</option></select></label><label>Entry<input id="fxg-j-entry" type="number" step="any"></label><label>Stop<input id="fxg-j-stop" type="number" step="any"></label><label>Exit<input id="fxg-j-exit" type="number" step="any"></label><label>Lots<input id="fxg-j-lots" type="number" step="0.01" value="0.10"></label><label>Setup<select id="fxg-j-setup"><option>Breakout</option><option>Pullback</option><option>Reversal</option><option>Range</option><option>News</option><option>Sim</option><option>Other</option></select></label><label>Mindset<select id="fxg-j-mood"><option>Calm</option><option>Confident</option><option>FOMO</option><option>Fear</option><option>Revenge</option><option>Tired</option></select></label></div><label class="sr" for="fxg-j-notes">Notes</label><textarea id="fxg-j-notes" placeholder="What did you see? What would you repeat or avoid?" style="margin-top:.5rem"></textarea><p style="display:flex;gap:.5rem;flex-wrap:wrap;margin:.5rem 0 0"><button class="fxg-btn pri" id="fxg-j-add" type="button">Add to journal</button><button class="fxg-btn" id="fxg-j-csv" type="button">Export CSV</button><button class="fxg-btn" id="fxg-j-json" type="button">Export JSON</button><label class="fxg-btn" for="fxg-j-imp" style="cursor:pointer">Import JSON</label><input type="file" id="fxg-j-imp" accept="application/json" hidden><button class="fxg-btn" id="fxg-j-clear" type="button">Clear all</button></p><p class="fxg-status" id="fxg-j-status"></p></div>' +
      '<div class="fxg-kpis" id="fxg-j-kpis" style="margin-top:.7rem;min-height:136px"></div><div class="fxg-row"><div class="fxg-box" style="min-height:220px"><h3>Equity in R</h3><canvas class="fxg-canvas" id="fxg-j-eq" style="height:170px"></canvas></div><div class="fxg-box" style="min-height:220px"><h3>By setup &amp; mindset</h3><div class="fxg-scroll" style="max-height:180px"><table class="fxg-tbl" id="fxg-j-by"></table></div></div></div><div class="fxg-box" style="margin-top:.7rem"><h3>Entries</h3><div class="fxg-scroll"><table class="fxg-tbl" id="fxg-j-tbl"></table></div></div>',
    sim: '<div class="fxg-form"><label>Start bar<input id="fxg-x-start" type="range" min="200" max="1000" value="500"></label><label>Speed<select id="fxg-x-speed"><option value="1">1 bar/s</option><option value="3" selected>3 bars/s</option><option value="8">8 bars/s</option><option value="20">20 bars/s</option></select></label><button class="fxg-btn" id="fxg-x-reset" type="button">Reset at start bar</button><button class="fxg-btn pri" id="fxg-x-play" type="button">▶ Play</button><button class="fxg-btn" id="fxg-x-step" type="button">Step +1</button></div>' +
      '<p class="fxg-status" id="fxg-x-status">Bar replay over real history. The future stays hidden until you step forward. Orders fill at the next bar\u2019s open. Paper only.</p><div class="fxg-chartwrap" style="height:380px"><div class="fxg-legend" id="fxg-x-legend"></div><div id="fxg-x-chart" style="position:absolute;inset:0"></div></div>' +
      '<div class="fxg-row"><div class="fxg-box"><h3>Order ticket <small>paper</small></h3><div class="fxg-form"><label>Risk %<input id="fxg-x-risk" type="number" step="0.05" min="0.05" max="1" value="0.5"></label><label>Stop (× ATR)<input id="fxg-x-am" type="number" step="0.1" min="0.3" value="1.5"></label><label>Target (R)<input id="fxg-x-rr" type="number" step="0.1" min="0.5" value="2"></label></div><p style="display:flex;gap:.5rem;flex-wrap:wrap;margin:.6rem 0 0"><button class="fxg-btn buy" id="fxg-x-buy" type="button">Buy (paper)</button><button class="fxg-btn sell" id="fxg-x-sell" type="button">Sell (paper)</button><button class="fxg-btn" id="fxg-x-close" type="button">Close at last close</button></p><p class="fxg-status" id="fxg-x-guard"></p></div><div class="fxg-box"><h3>Paper account</h3><div class="fxg-kpis" id="fxg-x-kpis" style="min-height:136px"></div></div></div><div class="fxg-box" style="margin-top:.7rem"><h3>Simulator fills <small>closed trades are copied to the journal</small></h3><div class="fxg-scroll" style="max-height:240px"><table class="fxg-tbl" id="fxg-x-hist"></table></div></div>',
    cal: '<div class="fxg-box" style="min-height:300px"><h3>Economic calendar <small id="fxg-c-src"></small></h3><div id="fxg-c-body"></div></div>',
    desk: '<div class="fxg-box"><h3>Classic VPS desk <small>Python FMC engine · paper only</small></h3><p>The original Forex Mercatus Codex desk (paper bot, GEX, order flow, regime models) runs on the Mens Mercatus VPS. It is embedded below on first open. Sign-in and journal edits stay disabled there, and it cannot place an order.</p><p class="mm-demo-note" id="fmc-facts" style="min-height:1.5em"></p><p class="btn-row" style="display:flex;flex-wrap:wrap;gap:.5rem"><a class="fxg-btn pri" href="https://api.mensmercatus.online/forex/" target="_blank" rel="noopener">Open live desk ↗</a><a class="fxg-btn" href="https://api.mensmercatus.online/forex/api/health" target="_blank" rel="noopener">Desk health (JSON)</a><a class="fxg-btn" href="../fmc-screenshots/">Desk screenshots</a><a class="fxg-btn" href="../../vault/ForexMercatusCodex_Skeleton_Architecture_Brief.pdf" target="_blank" rel="noopener">Architecture PDF</a><a class="fxg-btn" href="godmode.html">1080p suite</a><a class="fxg-btn" href="../index.html">← Apps hub</a></p><div id="fmc-frame-wrap" style="min-height:560px;margin-top:.6rem"><div class="fxg-empty" id="fmc-frame-msg">The desk loads when this tab opens.</div></div></div>'
  };
  function buildShell() {
    var tabs = $('#fxg-tabs'), panels = $('#fxg-panels');
    TABS.forEach(function (t, i) {
      var b = h('button', { class: 'fxg-tab', role: 'tab', id: 'fxg-tab-' + t[0], 'aria-controls': 'fxg-p-' + t[0], 'aria-selected': 'false', tabindex: '-1', type: 'button', 'data-tab': t[0] }, t[1]); tabs.appendChild(b);
      var p = h('section', { class: 'fxg-panel', role: 'tabpanel', id: 'fxg-p-' + t[0], 'aria-labelledby': 'fxg-tab-' + t[0] }, PANELS[t[0]]); panels.appendChild(p);
    });
    tabs.addEventListener('click', function (e) { var b = e.target.closest('[data-tab]'); if (b) setTab(b.getAttribute('data-tab'), true); });
    tabs.addEventListener('keydown', function (e) { if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return; var i = TABS.findIndex(function (t) { return t[0] === S.tab; }); i = (i + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length; setTab(TABS[i][0], true); $('#fxg-tab-' + TABS[i][0]).focus(); });
    var sel = $('#fxg-sym'); Object.keys(S.man.symbols).forEach(function (s) { sel.appendChild(h('option', { value: s }, esc(S.man.symbols[s].label))); });
    sel.addEventListener('change', function () { setSym(sel.value); });
    var seg = $('#fxg-tf'); if (!seg.children.length) TFS.forEach(function (t) { seg.appendChild(h('button', { type: 'button', 'data-tf': t, 'aria-pressed': 'false' }, t.toUpperCase())); });
    seg.addEventListener('click', function (e) { var b = e.target.closest('[data-tf]'); if (b && !b.disabled) setTf(b.getAttribute('data-tf')); });
  }
  function syncBar() {
    $('#fxg-sym').value = S.sym; var av = tfsOf(S.sym);
    $$('#fxg-tf button').forEach(function (b) { var t = b.getAttribute('data-tf'); b.disabled = av.indexOf(t) < 0; b.setAttribute('aria-pressed', String(t === S.tf)); b.title = b.disabled ? 'Not available for this symbol (ECB daily fix only)' : ''; });
    var m = S.man.symbols[S.sym], tf = m.tfs[S.tf];
    $('#fxg-src').textContent = m.source + ' · ' + tf.bars + ' bars · ' + T(tf.from, true) + ' → ' + T(tf.to, true) + (m.close_only ? ' · close only' : '');
    $$('#fxg-wl button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-sym') === S.sym)); });
  }
  function setHash() { try { history.replaceState(null, '', '#' + 'tab=' + S.tab + '&sym=' + S.sym + '&tf=' + S.tf); } catch (e) {} }
  function setSym(sym) { if (!S.man.symbols[sym]) return; S.sym = sym; var av = tfsOf(sym); if (av.indexOf(S.tf) < 0) S.tf = av.indexOf('1h') >= 0 ? '1h' : av[av.length - 1]; syncBar(); setHash(); refresh(); }
  function setTf(tf) { S.tf = tf; syncBar(); setHash(); refresh(); }
  var opened = {};
  function setTab(t, user) {
    S.tab = t; $$('.fxg-tab').forEach(function (b) { var on = b.getAttribute('data-tab') === t; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    $$('.fxg-panel').forEach(function (p) { p.classList.toggle('is-on', p.id === 'fxg-p-' + t); });
    if (user) setHash(); if (!opened[t]) { opened[t] = true; (INIT[t] || function () {})(); } (SHOW[t] || function () {})();
  }
  function refresh() { (SHOW[S.tab] || function () {})(); Object.keys(opened).forEach(function (t) { if (t !== S.tab && STALE[t]) STALE[t](); }); }
  var INIT = {}, SHOW = {}, STALE = {};

  /* ------------------------------------------------------------ CHART */
  var IND = [['e20', 'EMA 20', '#ff8f80'], ['e50', 'EMA 50', '#a78bfa'], ['e200', 'EMA 200', '#e8c46a'], ['bb', 'Bollinger 20/2', '#2dd4bf'], ['vwap', 'VWAP (daily)', '#7aa2ff'], ['don', 'Donchian 20', '#94a3b8'], ['reg', 'Regime shading', '#a78bfa'], ['anom', 'Vol anomalies', '#f5b84b'], ['pat', 'Patterns (last 150 bars)', '#2fd68d']];
  INIT.chart = function () {
    var box = $('#fxg-ind'); IND.forEach(function (x) { var l = h('label', { class: 'fxg-chip', style: '--c:' + x[2] }); l.innerHTML = '<input type="checkbox" data-ind="' + x[0] + '"' + (S.ind[x[0]] ? ' checked' : '') + '>' + x[1]; box.appendChild(l); });
    box.addEventListener('change', function (e) { var k = e.target.getAttribute('data-ind'); if (k) { S.ind[k] = e.target.checked; drawMain(true); } });
    $('#fxg-oscsel').addEventListener('click', function (e) { var b = e.target.closest('[data-o]'); if (!b) return; S.osc = b.getAttribute('data-o'); $$('#fxg-oscsel button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); drawOsc(); });
    var mc = mk($('#fxg-main')), oc = mk($('#fxg-oscc'), { timeScale: { visible: true } });
    var M = S.main = { chart: mc, osc: oc, candles: mc.addCandlestickSeries(candleOpts()), line: mc.addLineSeries({ color: css('--ink'), lineWidth: 2, visible: false, priceLineVisible: false }), ov: {}, reg: mc.addHistogramSeries({ priceScaleId: 'reg', priceLineVisible: false, lastValueVisible: false }) };
    mc.priceScale('reg').applyOptions({ scaleMargins: { top: 0, bottom: 0 }, visible: false });
    [['e20', '#ff8f80'], ['e50', '#a78bfa'], ['e200', '#e8c46a'], ['bbu', '#2dd4bf'], ['bbm', 'rgba(45,212,191,.5)'], ['bbl', '#2dd4bf'], ['vwap', '#7aa2ff'], ['donu', '#94a3b8'], ['donl', '#94a3b8']].forEach(function (x) { M.ov[x[0]] = mc.addLineSeries({ color: x[1], lineWidth: x[0].indexOf('bb') === 0 || x[0].indexOf('don') === 0 ? 1 : 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }); });
    var sync = false; mc.timeScale().subscribeVisibleLogicalRangeChange(function (r) { if (sync || !r) return; sync = true; oc.timeScale().setVisibleLogicalRange(r); sync = false; });
    oc.timeScale().subscribeVisibleLogicalRangeChange(function (r) { if (sync || !r) return; sync = true; mc.timeScale().setVisibleLogicalRange(r); sync = false; });
    mc.subscribeCrosshairMove(function (p) { legend(p); });
  };
  function legend(p) {
    var o = S.mainData; if (!o) return; var d = o.d, i = d.n - 1;
    if (p && p.time != null) { var t = p.time - SHIFT; var lo = 0, hi = d.n - 1; while (lo < hi) { var mid = (lo + hi) >> 1; if (d.t[mid] < t) lo = mid + 1; else hi = mid; } i = lo; }
    var ch = i ? d.c[i] / d.c[i - 1] - 1 : 0, reg = S.ai[key(S.sym, S.tf)];
    $('#fxg-legend').innerHTML = '<b>' + S.sym + ' · ' + S.tf.toUpperCase() + '</b> ' + T(d.t[i]) + (o.closeOnly ? ' · C <b>' + px(S.sym, d.c[i]) + '</b>' : ' · O ' + px(S.sym, d.o[i]) + ' H ' + px(S.sym, d.h[i]) + ' L ' + px(S.sym, d.l[i]) + ' C <b>' + px(S.sym, d.c[i]) + '</b>') + ' <span class="' + cls(ch) + '">' + sgn(ch * 100, 2) + '%</span><br>ATR14 ' + px(S.sym, o.A[i]) + ' · RSI ' + f(o.rsi[i], 1) + (reg && reg.regimes && reg.regimes.labels[i] >= 0 ? ' · regime <b>' + esc(reg.regimes.names[reg.regimes.labels[i]]) + '</b>' : '');
  }
  function drawMain(keepRange) {
    var M = S.main; if (!M) return;
    cur().then(function (o) {
      S.mainData = o; var range = keepRange ? M.chart.timeScale().getVisibleLogicalRange() : null, intr = S.tf !== '1d';
      M.chart.applyOptions({ timeScale: { timeVisible: intr } }); M.osc.applyOptions({ timeScale: { timeVisible: intr } });
      if (o.closeOnly) { M.candles.setData([]); M.line.applyOptions({ visible: true, color: css('--ink') }); M.line.setData(line(o, o.d.c)); }
      else { M.line.applyOptions({ visible: false }); M.line.setData([]); M.candles.setData(bars(o)); }
      var I = S.ind; M.ov.e20.setData(I.e20 ? line(o, o.e20) : []); M.ov.e50.setData(I.e50 ? line(o, o.e50) : []); M.ov.e200.setData(I.e200 ? line(o, o.e200) : []);
      M.ov.bbu.setData(I.bb ? line(o, o.bb.up) : []); M.ov.bbm.setData(I.bb ? line(o, o.bb.mid) : []); M.ov.bbl.setData(I.bb ? line(o, o.bb.lo) : []);
      M.ov.vwap.setData(I.vwap && intr && !o.closeOnly ? line(o, C.vwapDaily(o.d)) : []);
      var dn = I.don ? C.donchian(o.d, 20) : null; M.ov.donu.setData(dn ? line(o, dn.up) : []); M.ov.donl.setData(dn ? line(o, dn.lo) : []);
      $('#fxg-chart-status').textContent = [o.closeOnly ? 'ECB daily reference fix: close-only line chart.' : '', (I.vwap && (!intr || o.closeOnly)) ? 'VWAP needs intraday OHLCV, so it is hidden here.' : ''].filter(Boolean).join(' ');
      decorate(o); drawOsc();
      if (range) M.chart.timeScale().setVisibleLogicalRange(range); else { var n = o.d.n; M.chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - 160), to: n + 3 }); }
      legend(null); ensureAI(S.sym, S.tf).then(function () { if (S.mainData === o) { decorate(o); legend(null); } });
    }).catch(fail('chart'));
  }
  function decorate(o) {
    var M = S.main, a = S.ai[key(o.sym, o.tf)], I = S.ind, d = o.d, mk_ = [];
    if (I.reg && a && a.regimes) { var lab = a.regimes.labels, data = []; for (var i = 0; i < d.n; i++) data.push({ time: d.t[i] + SHIFT, value: lab[i] >= 0 ? 1 : 0, color: lab[i] >= 0 ? REG_COL[lab[i] % REG_COL.length] : 'rgba(0,0,0,0)' }); M.reg.setData(data); } else M.reg.setData([]);
    if (I.anom && a && a.anom) a.anom.list.forEach(function (x) { mk_.push({ time: x.t + SHIFT, position: x.dir > 0 ? 'belowBar' : 'aboveBar', color: '#f5b84b', shape: 'circle', text: 'σ' + x.z.toFixed(1) }); });
    if (I.pat) C.detectPatterns(d, { atr: o.A, e20: o.e20, e50: o.e50, rsi: o.rsi, bb: o.bb, closeOnly: o.closeOnly }).filter(function (p) { return p.i > d.n - 150 && p.dir !== 0; }).forEach(function (p) { mk_.push({ time: d.t[p.i] + SHIFT, position: p.dir > 0 ? 'belowBar' : 'aboveBar', color: p.dir > 0 ? css('--up') : css('--dn'), shape: p.dir > 0 ? 'arrowUp' : 'arrowDown', text: p.id.replace('_', ' ') }); });
    mk_.sort(function (x, y) { return x.time - y.time; }); (o.closeOnly ? M.candles : M.line).setMarkers([]); (o.closeOnly ? M.line : M.candles).setMarkers(mk_);
  }
  function drawOsc() {
    var M = S.main, o = S.mainData; if (!M || !o) return; (M.oscSeries || []).forEach(function (s) { M.osc.removeSeries(s); }); M.oscSeries = [];
    if (S.osc === 'rsi') { var s = M.osc.addLineSeries({ color: '#a78bfa', lineWidth: 2, priceLineVisible: false }); s.setData(line(o, o.rsi)); [30, 50, 70].forEach(function (v) { s.createPriceLine({ price: v, color: v === 50 ? 'rgba(148,163,184,.35)' : 'rgba(226,71,90,.45)', lineWidth: 1, lineStyle: 2, axisLabelVisible: false }); }); M.oscSeries.push(s); }
    else { var m = C.macd(o.d.c), hs = M.osc.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false }), ln = M.osc.addLineSeries({ color: '#ff8f80', lineWidth: 1, priceLineVisible: false }), sg_ = M.osc.addLineSeries({ color: '#2dd4bf', lineWidth: 1, priceLineVisible: false }); var hd = []; for (var i = 0; i < o.d.n; i++) if (isFinite(m.hist[i])) hd.push({ time: o.d.t[i] + SHIFT, value: m.hist[i], color: m.hist[i] >= 0 ? 'rgba(47,214,141,.55)' : 'rgba(255,93,108,.55)' }); hs.setData(hd); ln.setData(line(o, m.line)); sg_.setData(line(o, m.signal)); M.oscSeries.push(hs, ln, sg_); }
    var r = M.chart.timeScale().getVisibleLogicalRange(); if (r) M.osc.timeScale().setVisibleLogicalRange(r);
  }
  function bias(o) { var i = o.d.n - 1, a = o.e20[i], b = o.e50[i], c = o.d.c[i]; if (!isFinite(a) || !isFinite(b)) return 0; if (a > b && c > a) return 1; if (a < b && c < a) return -1; return 0; }
  var BIAS = { '1': ['Bullish', 'up'], '-1': ['Bearish', 'dn'], '0': ['Mixed', 'mute'] };
  function resampleWeekly(o) { var rows = [], cur_ = null; o.rows.forEach(function (r) { var wk = Math.floor((r[0] / 86400 + 3) / 7); if (!cur_ || cur_.wk !== wk) { if (cur_) rows.push(cur_.r); cur_ = { wk: wk, r: r.slice() }; } else { cur_.r[2] = Math.max(cur_.r[2], r[2]); cur_.r[3] = Math.min(cur_.r[3], r[3]); cur_.r[4] = r[4]; } }); if (cur_) rows.push(cur_.r); var d = C.cols(rows); return { sym: o.sym, tf: '1w', rows: rows, d: d, closeOnly: o.closeOnly, e20: C.ema(d.c, 20), e50: C.ema(d.c, 50) }; }
  function drawMTF() {
    var box = $('#fxg-mtf'), av = tfsOf(S.sym), list = av.length > 1 ? ['1d', '4h', '1h', '15m'] : ['1w', '1d', '4h', '1h'];
    (S.minis || []).forEach(function (c) { c.remove(); S.allCharts.splice(S.allCharts.indexOf(c), 1); }); S.minis = []; box.innerHTML = '';
    list.forEach(function (tf) {
      var cell = h('div', { class: 'fxg-mini' }, '<div class="h"><span>' + tf.toUpperCase() + '</span><span class="b">…</span></div><div class="cv"></div>'); box.appendChild(cell);
      var p = tf === '1w' ? load(S.sym, '1d').then(resampleWeekly) : (av.indexOf(tf) >= 0 ? load(S.sym, tf) : null);
      if (!p) { cell.querySelector('.cv').remove(); cell.appendChild(h('div', { class: 'na' }, 'No ' + tf + ' data: this pair has only the ECB daily fix.')); cell.querySelector('.b').textContent = 'n/a'; return; }
      p.then(function (o) {
        var c = mk(cell.querySelector('.cv'), { handleScroll: false, handleScale: false, rightPriceScale: { visible: false }, timeScale: { visible: false }, crosshair: { mode: 2 } }); S.minis.push(c);
        var from = Math.max(0, o.d.n - 120); if (o.closeOnly) c.addLineSeries({ color: css('--ink'), lineWidth: 1, priceLineVisible: false, lastValueVisible: false }).setData(line(o, o.d.c, from)); else c.addCandlestickSeries(Object.assign(candleOpts(), { priceLineVisible: false, lastValueVisible: false })).setData(bars(o, from));
        c.addLineSeries({ color: '#ff8f80', lineWidth: 1, priceLineVisible: false, lastValueVisible: false }).setData(line(o, o.e20, from)); c.addLineSeries({ color: '#a78bfa', lineWidth: 1, priceLineVisible: false, lastValueVisible: false }).setData(line(o, o.e50, from)); c.timeScale().fitContent();
        var b = BIAS[String(bias(o))], el = cell.querySelector('.b'); el.textContent = b[0]; el.className = 'b ' + b[1];
      });
    });
  }
  SHOW.chart = function () { var k = key(S.sym, S.tf); if (S.chartKey !== k) { S.chartKey = k; drawMain(false); drawMTF(); } };

  /* ------------------------------------------------------------ watchlist */
  function drawSparks() {
    $$('#fxg-wl canvas').forEach(function (cv) { var o = S.cache[key(cv.getAttribute('data-sym'), '1d')]; if (!o) return; spark(cv, Array.prototype.slice.call(o.d.c, -60)); });
  }
  function spark(cv, arr, col) { var r = window.devicePixelRatio || 1, w = cv.clientWidth || 64, hh = cv.clientHeight || 34; cv.width = w * r; cv.height = hh * r; var g = cv.getContext('2d'); g.scale(r, r); g.clearRect(0, 0, w, hh); var mn = Math.min.apply(null, arr), mx = Math.max.apply(null, arr); g.strokeStyle = col || (arr[arr.length - 1] >= arr[0] ? css('--up') : css('--dn')); g.lineWidth = 1.4; g.beginPath(); arr.forEach(function (v, i) { var x = i / (arr.length - 1) * (w - 2) + 1, y = hh - 2 - (v - mn) / ((mx - mn) || 1) * (hh - 4); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); }
  function buildWatchlist() {
    var ul = $('#fxg-wl'); Object.keys(S.man.symbols).forEach(function (s) { var li = h('li'); li.innerHTML = '<button type="button" data-sym="' + s + '" aria-pressed="false"><span class="s">' + s + '</span><canvas data-sym="' + s + '" aria-hidden="true"></canvas><span><span class="p num">…</span> <span class="c num">…</span></span></button>'; ul.appendChild(li); });
    ul.addEventListener('click', function (e) { var b = e.target.closest('[data-sym]'); if (b) setSym(b.getAttribute('data-sym')); });
    Object.keys(S.man.symbols).forEach(function (s) { load(s, '1d').then(function (o) { var n = o.d.n, c = o.d.c[n - 1], ch = c / o.d.c[n - 2] - 1, b = $('#fxg-wl button[data-sym="' + s + '"]'); b.querySelector('.p').textContent = px(s, c); var ce = b.querySelector('.c'); ce.textContent = sgn(ch * 100, 2) + '% d/d'; ce.className = 'c num ' + cls(ch); spark(b.querySelector('canvas'), Array.prototype.slice.call(o.d.c, -60)); }).catch(function () {}); });
  }

  /* ------------------------------------------------------------ AI (worker-backed, cached per symbol/timeframe) */
  var aiP = {}, modelP = {};
  function ensureAI(sym, tf) { var k = key(sym, tf); if (S.ai[k]) return Promise.resolve(S.ai[k]); if (aiP[k]) return aiP[k]; aiP[k] = load(sym, tf).then(function (o) { return compute('ai', o.rows, { horizon: HORIZON[tf], window: tf === '1d' ? 20 : 24 }); }).then(function (r) { S.ai[k] = r; return r; }); aiP[k].catch(function () { delete aiP[k]; }); return aiP[k]; }
  function ensureModel(sym, tf, opts) { opts = opts || { model: 'gbm', horizon: HORIZON[tf], folds: 5 }; var k = key(sym, tf) + '|' + opts.model + '|' + opts.horizon + '|' + opts.folds; if (S.model[k]) return Promise.resolve(S.model[k]); if (modelP[k]) return modelP[k]; modelP[k] = load(sym, tf).then(function (o) { return compute('model', o.rows, opts); }).then(function (r) { S.model[k] = r; S.lastModel = S.lastModel || {}; S.lastModel[key(sym, tf)] = r; return r; }); modelP[k].catch(function () { delete modelP[k]; }); return modelP[k]; }
  function calibrated(m) { var b = m.calibration.filter(function (c) { return m.pNow >= c.lo && m.pNow < c.hi; })[0]; if (b && b.n >= 40 && isFinite(b.actual)) return { p: b.actual, n: b.n, how: 'OOS bucket ' + f(b.lo, 2) + '–' + f(b.hi, 2) + ' (n=' + b.n + ')' }; var w = 0.5; return { p: w * m.pNow + (1 - w) * m.upRate, n: 0, how: 'raw score shrunk 50% toward the base rate' }; }
  var VERDICT = { edge: ['Edge vs baseline', 'up', 'Beats the baseline out of sample by a statistically meaningful margin (z > 2 after adjusting for overlapping labels, AUC above 0.52). Still small; treat as a tilt, not a signal.'], weak: ['Weak / not significant', 'warn', 'Slightly above the baseline, but not by enough to rule out luck. Treat as noise.'], none: ['No edge', 'dn', 'Does not beat the simple baseline out of sample. The model has no reliable predictive power here, and saying so is the point.'], insufficient: ['Too little data', 'warn', 'Too few out-of-sample predictions for a verdict.'] };
  INIT.ai = function () { $('#fxg-m-run').addEventListener('click', function () { runModel(true); }); };
  SHOW.ai = function () { $('#fxg-m-h').value = $('#fxg-m-h').dataset.k === key(S.sym, S.tf) ? $('#fxg-m-h').value : HORIZON[S.tf]; $('#fxg-m-h').dataset.k = key(S.sym, S.tf); runModel(false); renderAI(); };
  function runModel(user) {
    var opts = { model: $('#fxg-m-kind').value, horizon: Math.max(1, Math.min(48, +$('#fxg-m-h').value || HORIZON[S.tf])), folds: Math.max(2, Math.min(10, +$('#fxg-m-folds').value || 5)) }, k = key(S.sym, S.tf), t0 = performance.now(), st = $('#fxg-m-status');
    st.textContent = 'Training ' + (opts.model === 'gbm' ? 'gradient-boosted stumps' : 'logistic regression') + ' with ' + opts.folds + '-fold expanding walk-forward on ' + S.sym + ' ' + S.tf + '…';
    $('#fxg-m-run').disabled = true;
    ensureModel(S.sym, S.tf, opts).then(function (m) { if (key(S.sym, S.tf) !== k) return; $('#fxg-m-run').disabled = false; var ms = Math.round(performance.now() - t0); st.textContent = (ms < 20 ? 'Done (already trained this session, cached). ' : 'Done in ' + ms + ' ms on this device. ') + m.n.toLocaleString() + ' out-of-sample predictions; features use only data available at each bar; a ' + m.horizon + '-bar purge gap separates training from testing.'; renderModel(m); renderMLSize(); }).catch(function (e) { $('#fxg-m-run').disabled = false; st.textContent = 'Model failed: ' + e.message; });
  }
  function renderModel(m) {
    var v = VERDICT[m.verdict]; $('#fxg-m-verdict').innerHTML = '<span class="fxg-badge ' + v[1] + '">' + v[0] + '</span>'; $('#fxg-m-hz').textContent = m.horizon;
    $('#fxg-m-kpis').innerHTML = [['OOS accuracy', pct(m.acc), cls(m.edge)], ['Baseline (best constant)', pct(m.baseline), ''], ['Edge', sgn(m.edge * 100, 1) + ' pp', cls(m.edge)], ['AUC', f(m.auc, 3), m.auc > 0.52 ? 'up' : 'mute'], ['Brier / base', f(m.brier, 4) + ' / ' + f(m.brierBase, 4), m.brier < m.brierBase ? 'up' : 'dn'], ['z (overlap-adj.)', f(m.zEff, 2), ''], ['Confident calls', m.confN ? pct(m.confAcc) + ' of ' + m.confN : 'none', ''], ['OOS predictions', m.n.toLocaleString(), '']].map(function (x) { return '<div class="kpi"><span>' + x[0] + '</span><b class="' + x[2] + '">' + x[1] + '</b></div>'; }).join('');
    $('#fxg-m-text').textContent = v[2] + ' Base rate of up-moves in the test periods: ' + pct(m.upRate) + '.';
    var cal = calibrated(m), p = cal.p; $('#fxg-m-now').innerHTML = '<div class="kpi" style="margin-bottom:.5rem"><span>P(close higher in ' + m.horizon + ' bars)</span><b class="' + cls(p - 0.5) + '">' + pct(p) + '</b></div><div class="fxg-meter" aria-hidden="true"><i style="width:' + (p * 100).toFixed(1) + '%"></i><u style="left:50%"></u></div><p class="dim" style="font-size:.74rem">Raw model score ' + pct(m.pNow) + ', calibrated via ' + esc(cal.how) + '. ' + (m.verdict === 'edge' ? 'Small measured edge; outcomes can still go either way.' : 'The model has no proven edge, so read this as roughly a coin flip.') + ' Not a forecast or advice.</p>';
    bars2($('#fxg-m-folds-c'), m.folds.map(function (x) { return ['F' + x.fold, x.acc, x.baseline]; }));
    $('#fxg-m-cal').innerHTML = '<table class="fxg-tbl"><tr><th>Score bucket</th><th>n</th><th>Avg score</th><th>Actual up</th></tr>' + m.calibration.map(function (c) { return '<tr><td>' + f(c.lo, 2) + '–' + f(c.hi, 2) + '</td><td>' + c.n + '</td><td>' + pct(c.pred) + '</td><td>' + pct(c.actual) + '</td></tr>'; }).join('') + '</table><p class="dim" style="font-size:.74rem">A well-calibrated model has “Actual up” close to “Avg score” in each row.</p>';
    $('#fxg-m-impk').textContent = m.model === 'gbm' ? 'split gain' : '|weight| (standardised)';
    var imp = (m.importance || []).map(function (v, i) { return [m.names[i], v]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 8), mx = imp.length ? imp[0][1] || 1 : 1;
    $('#fxg-m-imp').innerHTML = imp.map(function (x) { return '<div><span>' + esc(x[0]) + '</span><s style="width:' + (x[1] / mx * 100).toFixed(1) + '%"></s><span class="num">' + pct(x[1], 0) + '</span></div>'; }).join('');
  }
  function bars2(cv, rows) { var r = window.devicePixelRatio || 1, w = cv.clientWidth || 300, hh = cv.clientHeight || 120; cv.width = w * r; cv.height = hh * r; var g = cv.getContext('2d'); g.scale(r, r); g.clearRect(0, 0, w, hh); if (!rows.length) return; var lo = 0.35, hi = 0.7, bw = (w - 20) / rows.length; g.font = '10px Inter, sans-serif'; g.fillStyle = css('--dim'); rows.forEach(function (x, i) { var X = 10 + i * bw, y = function (v) { return hh - 16 - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * (hh - 26); }; g.fillStyle = 'rgba(148,163,184,.35)'; g.fillRect(X + bw * 0.15, y(x[2]), bw * 0.3, hh - 16 - y(x[2])); g.fillStyle = x[1] >= x[2] ? css('--up') : css('--dn'); g.fillRect(X + bw * 0.5, y(x[1]), bw * 0.3, hh - 16 - y(x[1])); g.fillStyle = css('--dim'); g.fillText(x[0], X + bw * 0.35, hh - 3); }); g.fillText('grey = baseline · colour = model', 10, 10); }
  function renderAI() {
    var k = key(S.sym, S.tf); ['#fxg-reg', '#fxg-hmm', '#fxg-anom', '#fxg-sim-sum'].forEach(function (s) { if (!$(s).dataset.k || $(s).dataset.k !== k) $(s).innerHTML = '<p class="fxg-status">Computing on-device…</p>'; });
    ensureAI(S.sym, S.tf).then(function (a) {
      if (key(S.sym, S.tf) !== k) return; var o = S.cache[k];
      var R = a.regimes; $('#fxg-reg').dataset.k = k;
      $('#fxg-reg').innerHTML = R ? '<p>Now: <b>' + esc(R.currentName) + '</b> for the last ' + R.runBars + ' bars.</p><table class="fxg-tbl"><tr><th>Regime</th><th>Share</th><th>Next 10 bars up</th><th>Median move</th></tr>' + R.stats.map(function (x) { return '<tr' + (x.id === R.current ? ' style="font-weight:700"' : '') + '><td><span style="display:inline-block;width:9px;height:9px;border-radius:3px;background:' + REG_COL[x.id].replace(/,\.0\d\)$/, ',.85)') + '"></span> ' + esc(x.name) + '</td><td>' + pct(x.share, 0) + '</td><td>' + pct(x.fwdUp, 0) + '</td><td class="' + cls(x.fwdMed) + '">' + sgn(x.fwdMed * 100, 2) + '%</td></tr>'; }).join('') + '</table><p class="dim" style="font-size:.74rem">Clusters on 20-bar trend (vol-scaled), log volatility, efficiency ratio and ADX. Forward stats are descriptive and in-sample, so don\u2019t read them as a forecast.</p>' : '<p class="fxg-empty">Not enough data.</p>';
      var H = a.hmm; $('#fxg-hmm').dataset.k = k;
      $('#fxg-hmm').innerHTML = H ? '<div class="fxg-kpis"><div class="kpi"><span>P(turbulent) now</span><b class="' + (H.current > 0.6 ? 'dn' : H.current < 0.3 ? 'up' : 'warn') + '">' + pct(H.current, 0) + '</b></div><div class="kpi"><span>σ calm / turbulent</span><b>' + f(H.sigma.calm * 100, 3) + '% / ' + f(H.sigma.turbulent * 100, 3) + '%</b></div><div class="kpi"><span>Stay-probability</span><b>' + pct(H.persist.calm, 0) + ' / ' + pct(H.persist.turbulent, 0) + '</b></div></div><p class="dim" style="font-size:.74rem">Baum–Welch fit on log returns; the line shows the causal (filtered) probability of the turbulent state over the last 300 bars.</p>' : '<p class="fxg-empty">Not enough data.</p>';
      if (H) spark($('#fxg-hmm-c'), H.pTurbulent.slice(-300).map(function (x) { return x == null ? 0 : x; }), '#f5b84b');
      var An = a.anom, last = An.list.slice(-8).reverse(); $('#fxg-anom').dataset.k = k;
      $('#fxg-anom').innerHTML = '<p>' + An.list.length + ' bars flagged (z > ' + An.thr + ') in ' + o.d.n.toLocaleString() + '. ' + (An.list.length && An.list[An.list.length - 1].i > o.d.n - 6 ? '<b class="warn">Anomaly in the last 5 bars.</b>' : 'None in the last 5 bars.') + '</p>' + (last.length ? '<div class="fxg-scroll" style="max-height:170px"><table class="fxg-tbl"><tr><th>Time</th><th>z</th><th>Bar</th><th>Range</th></tr>' + last.map(function (x) { return '<tr class="click" data-goto="' + x.t + '"><td>' + T(x.t) + '</td><td>' + f(x.z, 1) + '</td><td class="' + (x.dir > 0 ? 'up' : 'dn') + '">' + (x.dir > 0 ? 'up' : 'down') + '</td><td>' + px(S.sym, x.range) + '</td></tr>'; }).join('') + '</table></div>' : '');
      var Sm = a.sim, box = $('#fxg-sims'); $('#fxg-sim-sum').dataset.k = k; box.innerHTML = '';
      if (!Sm || !Sm.matches.length) { $('#fxg-sim-sum').innerHTML = '<p class="fxg-empty">Not enough history for a similarity search.</p>'; return; }
      $('#fxg-sim-sum').innerHTML = '<p>The <b>' + Sm.matches.length + '</b> past windows most like the last ' + Sm.window + ' bars went up over the next ' + Sm.horizon + ' bars <b class="' + cls(Sm.upShare - Sm.baseUp) + '">' + pct(Sm.upShare, 0) + '</b> of the time, against a base rate of ' + pct(Sm.baseUp, 0) + '. Median move: <span class="' + cls(Sm.medFwd) + '">' + sgn(Sm.medFwd * 100, 2) + '%</span>. ' + (Math.abs(Sm.upShare - Sm.baseUp) < 0.15 ? 'That is within normal noise for a sample this small.' : 'With only ' + Sm.matches.length + ' matches, read this as context, not a forecast.') + '</p>';
      Sm.matches.forEach(function (m) { var b = h('button', { type: 'button', 'data-goto': m.t, title: 'Show on chart' }); b.innerHTML = '<canvas></canvas>' + T(m.t, true) + ' · <span class="' + cls(m.fwd) + '">' + sgn(m.fwd * 100, 2) + '%</span>'; box.appendChild(b); var cv = b.querySelector('canvas'); requestAnimationFrame(function () { sparkSplit(cv, m.path, Sm.window); }); });
    }).catch(fail('ai'));
  }
  function sparkSplit(cv, arr, cut) { var r = window.devicePixelRatio || 1, w = cv.clientWidth || 140, hh = cv.clientHeight || 46; cv.width = w * r; cv.height = hh * r; var g = cv.getContext('2d'); g.scale(r, r); var mn = Math.min.apply(null, arr), mx = Math.max.apply(null, arr), X = function (i) { return i / (arr.length - 1) * (w - 2) + 1; }, Y = function (v) { return hh - 2 - (v - mn) / ((mx - mn) || 1) * (hh - 4); }; g.lineWidth = 1.3; g.strokeStyle = css('--mute'); g.beginPath(); for (var i = 0; i <= cut; i++) i ? g.lineTo(X(i), Y(arr[i])) : g.moveTo(X(i), Y(arr[i])); g.stroke(); g.strokeStyle = arr[arr.length - 1] >= arr[cut] ? css('--up') : css('--dn'); g.beginPath(); g.moveTo(X(cut), Y(arr[cut])); for (var j = cut; j < arr.length; j++) g.lineTo(X(j), Y(arr[j])); g.stroke(); g.strokeStyle = 'rgba(148,163,184,.4)'; g.setLineDash([2, 2]); g.beginPath(); g.moveTo(X(cut), 0); g.lineTo(X(cut), hh); g.stroke(); g.setLineDash([]); }
  function renderMLSize() {
    var el = $('#fxg-mls'), el2 = $('#fxg-r-ml'), m = (S.lastModel || {})[key(S.sym, S.tf)], a = S.ai[key(S.sym, S.tf)];
    if (!m) { var msg = '<p class="fxg-status">Run the direction model in AI Lab to get a sizing suggestion.</p>'; if (el) el.innerHTML = msg; if (el2) el2.innerHTML = msg; return; }
    var base = +(($('#fxg-r-risk') || {}).value || C.RULES.defaultRiskPct), acc = +(($('#fxg-r-acc') || {}).value || 10000), dayLoss = +(($('#fxg-r-day') || {}).value || 0), cal = calibrated(m), prob = cal.p, dir = prob >= 0.5 ? 1 : -1, pDir = dir > 0 ? prob : 1 - prob;
    var anomNow = a && a.anom && a.anom.list.length && a.anom.list[a.anom.list.length - 1].i > S.cache[key(S.sym, S.tf)].d.n - 6;
    var r = C.mlSize({ baseRiskPct: base, rr: 2, prob: pDir, modelOk: m.verdict === 'edge', turbulent: a && a.hmm ? a.hmm.current : 0, anomaly: !!anomNow, dayLeftPct: Math.max(0, (acc * C.RULES.maxDailyLossPct / 100 - dayLoss) / acc * 100) });
    var html = '<div class="fxg-kpis"><div class="kpi"><span>Suggested risk</span><b>' + f(r.riskPct, 2) + '%</b></div><div class="kpi"><span>Base / cap</span><b>' + f(Math.min(base, C.RULES.maxRiskPct), 2) + '% / ' + C.RULES.maxRiskPct + '%</b></div><div class="kpi"><span>Model lean</span><b class="' + (m.verdict === 'edge' ? cls(dir) : 'mute') + '">' + (m.verdict === 'edge' ? (dir > 0 ? 'Long ' : 'Short ') + pct(pDir, 0) : 'None') + '</b></div></div><ul style="margin:.5rem 0 0;padding-left:1.1rem;color:var(--mute);font-size:.8rem">' + r.reasons.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul><p class="dim" style="font-size:.72rem">The ML can only shrink risk below your base, never raise it above the base or the hard cap.</p>';
    if (el) el.innerHTML = html; if (el2) el2.innerHTML = '<h3 style="font-size:.95rem">ML sizing (from AI Lab, ' + S.sym + ' ' + S.tf + ')</h3>' + html;
  }

  /* ------------------------------------------------------------ AI BRIEF (rule-based narration of measured numbers; never invents prices) */
  INIT.brief = function () { $('#fxg-brief-re').addEventListener('click', function () { S.briefKey = null; SHOW.brief(); }); };
  SHOW.brief = function () {
    var k = key(S.sym, S.tf); if (S.briefKey === k) return; S.briefKey = k; var box = $('#fxg-brief'); box.innerHTML = '<div class="fxg-empty">Reading ' + S.sym + ' ' + S.tf + ' data, fitting regimes and training the direction model on this device…</div>';
    var sym = S.sym, tf = S.tf, av = tfsOf(sym);
    Promise.all([load(sym, tf), ensureAI(sym, tf), ensureModel(sym, tf), Promise.all(['1d', '4h', '1h'].filter(function (t) { return av.indexOf(t) >= 0; }).map(function (t) { return load(sym, t); }))]).then(function (r) {
      if (key(S.sym, S.tf) !== k) return; var o = r[0], a = r[1], m = r[2], stack = r[3], d = o.d, n = d.n, i = n - 1, label = S.man.symbols[sym].label;
      var perDay = { '5m': 288, '15m': 96, '1h': 24, '4h': 6, '1d': 1 }[tf], back = Math.min(i, perDay * (tf === '1d' ? 5 : 1)), ch = d.c[i] / d.c[i - back] - 1;
      var biases = stack.map(function (x) { return [x.tf, bias(x)]; }), agree = biases.reduce(function (s, b) { return s + b[1]; }, 0), trendWord = Math.abs(agree) === biases.length && biases.length > 1 ? (agree > 0 ? 'aligned bullish' : 'aligned bearish') : (agree > 0 ? 'leaning bullish but not aligned' : agree < 0 ? 'leaning bearish but not aligned' : 'mixed');
      var ap = C.pctRank(o.A, 200)[i], hmm = a.hmm, reg = a.regimes, an = a.anom, recentAn = an.list.filter(function (x) { return x.i > n - 21; }).length;
      var dc = C.donchian(d, 20), sw = C.swings(d, 3), above = sw.hi.filter(function (j) { return d.h[j] > d.c[i]; }).slice(-1)[0], below = sw.lo.filter(function (j) { return d.l[j] < d.c[i]; }).slice(-1)[0];
      var day = S.cache[key(sym, '1d')], pdh = day && day.d.n > 1 ? day.d.h[day.d.n - 2] : NaN, pdl = day && day.d.n > 1 ? day.d.l[day.d.n - 2] : NaN;
      var pats = C.detectPatterns(d, { atr: o.A, e20: o.e20, e50: o.e50, rsi: o.rsi, bb: o.bb, closeOnly: o.closeOnly }).filter(function (p) { return p.i >= n - 3; });
      var cal = calibrated(m), v = VERDICT[m.verdict], sim = a.sim;
      var score = (Math.abs(agree) === biases.length && biases.length > 1 ? 1 : 0) + (m.verdict === 'edge' ? 1 : 0) + (sim && Math.abs(sim.upShare - sim.baseUp) >= 0.2 ? 1 : 0) - (hmm && hmm.current > 0.6 ? 1 : 0), conf = score >= 2 ? ['Moderate', 'warn'] : ['Low', 'dn'];
      var sw_ = C.sessionWindows(new Date()), act = sw_.sessions.filter(function (x) { return x.active; }).map(function (x) { return x.name; });
      var html = '<p class="lead">' + esc(label) + ' last closed at <b>' + px(sym, d.c[i]) + '</b> on ' + T(d.t[i]) + ' (' + '<span class="' + cls(ch) + '">' + sgn(ch * 100, 2) + '%</span> over the previous ' + (tf === '1d' ? '5 sessions' : '24 hours') + '). Trend structure is <b>' + trendWord + '</b>' + (biases.length ? ' (' + biases.map(function (b) { return b[0].toUpperCase() + ' ' + BIAS[String(b[1])][0].toLowerCase(); }).join(', ') + ')' : '') + '.</p>';
      html += '<div class="fxg-row" style="margin-top:0"><div class="fxg-box"><h3>Market state</h3><ul>' +
        (reg ? '<li>Regime (k-means): <b>' + esc(reg.currentName) + '</b> for ' + reg.runBars + ' bars.</li>' : '') +
        '<li>Volatility: ATR14 ' + px(sym, o.A[i]) + ', higher than ' + pct(ap, 0) + ' of the last 200 bars' + (hmm ? '; HMM puts the turbulent state at ' + pct(hmm.current, 0) : '') + '.</li>' +
        '<li>' + (recentAn ? '<b class="warn">' + recentAn + ' volatility anomal' + (recentAn > 1 ? 'ies' : 'y') + '</b> in the last 20 bars: expect wider swings.' : 'No volatility anomalies in the last 20 bars.') + '</li>' +
        '<li>RSI14 ' + f(o.rsi[i], 1) + (o.rsi[i] > 70 ? ' (overbought)' : o.rsi[i] < 30 ? ' (oversold)' : '') + '; price is ' + f((d.c[i] - o.e50[i]) / o.A[i], 1) + ' ATR from the EMA50.</li>' +
        (pats.length ? '<li>Fresh patterns: ' + pats.map(function (p) { return esc(p.name); }).join(', ') + '.</li>' : '') + '</ul></div>' +
        '<div class="fxg-box"><h3>Levels from the data</h3><ul>' +
        (isFinite(pdh) ? '<li>Prior day high / low: ' + px(sym, pdh) + ' / ' + px(sym, pdl) + '</li>' : '') +
        '<li>20-bar range: ' + px(sym, dc.lo[i]) + ' – ' + px(sym, dc.up[i]) + '</li>' +
        (above != null ? '<li>Nearest swing high above: ' + px(sym, d.h[above]) + ' (' + T(d.t[above]) + ')</li>' : '<li>No swing high above price in this window.</li>') +
        (below != null ? '<li>Nearest swing low below: ' + px(sym, d.l[below]) + ' (' + T(d.t[below]) + ')</li>' : '<li>No swing low below price in this window.</li>') + '</ul></div></div>';
      html += '<div class="fxg-row" style="margin-top:0"><div class="fxg-box"><h3>What the models say <small><span class="fxg-badge ' + v[1] + '">' + v[0] + '</span></small></h3><ul>' +
        '<li>The gradient-boosted model puts the chance of a higher close in ' + m.horizon + ' bars at <b>' + pct(cal.p) + '</b>.</li>' +
        '<li>Out of sample it was right <b>' + pct(m.acc) + '</b> of the time against <b>' + pct(m.baseline) + '</b> for the best constant guess, always up or always down picked in hindsight (' + m.n.toLocaleString() + ' predictions, AUC ' + f(m.auc, 3) + '). ' + esc(v[2]) + '</li>' +
        (sim ? '<li>The ' + sim.matches.length + ' most similar past setups rose ' + pct(sim.upShare, 0) + ' of the time (base rate ' + pct(sim.baseUp, 0) + ').</li>' : '') + '</ul></div>' +
        '<div class="fxg-box"><h3>Confidence &amp; caveats <small><span class="fxg-badge ' + conf[1] + '">' + conf[0] + ' confidence</span></small></h3><ul>' +
        '<li>Overall confidence is ' + conf[0].toLowerCase() + ', because ' + (score >= 2 ? 'several independent reads agree' : 'the signals disagree or have no proven edge') + '.</li>' +
        '<li>Data ends ' + T(d.t[i], true) + ' and is not live. ' + (S.man.symbols[sym].close_only ? 'ECB daily fixes carry no intraday highs or lows.' : 'It is a crypto-exchange proxy (' + esc(S.man.symbols[sym].vendor_symbol) + '), not spot or futures.') + '</li>' +
        '<li>Sessions open right now (real clock, SAST): ' + (act.length ? act.join(', ') : 'none') + (sw_.weekend ? ' · weekend: FX is closed' : '') + '.</li>' +
        '<li>Probabilities describe past behaviour and are not guarantees. Educational and paper trading only, not financial advice.</li></ul></div></div>';
      box.innerHTML = html; $('#fxg-brief-meta').textContent = 'generated ' + dtf.format(new Date()) + ' SAST · ' + sym + ' ' + tf;
    }).catch(function (e) { S.briefKey = null; box.innerHTML = '<div class="fxg-empty">Could not build the brief: ' + esc(e.message) + '</div>'; });
  };

  /* ------------------------------------------------------------ STRATEGY LAB */
  INIT.lab = function () {
    var sel = $('#fxg-s-strat'); Object.keys(C.STRATS).forEach(function (k) { sel.appendChild(h('option', { value: k }, esc(C.STRATS[k].name))); }); sel.appendChild(h('option', { value: 'ml' }, 'ML direction filter (OOS predictions only)'));
    var eq = mk($('#fxg-s-eq')), dd = mk($('#fxg-s-dd'), { timeScale: { visible: false } }); S.lab = { eq: eq, dd: dd, eqS: eq.addAreaSeries({ lineColor: '#a78bfa', topColor: 'rgba(167,139,250,.35)', bottomColor: 'rgba(167,139,250,0)', lineWidth: 2, priceLineVisible: false }), ddS: dd.addHistogramSeries({ color: 'rgba(255,93,108,.6)', priceLineVisible: false, lastValueVisible: false }) };
    $('#fxg-s-bt').addEventListener('click', function () { runLab('bt'); }); $('#fxg-s-wf').addEventListener('click', function () { runLab('wf'); });
    $('#fxg-s-trades').addEventListener('click', gotoRow);
  };
  SHOW.lab = function () { var sp = C.SPEC[S.sym]; if ($('#fxg-s-cost').dataset.sym !== S.sym) { $('#fxg-s-cost').value = sp && sp.spread != null ? sp.spread : (S.sym.indexOf('JPY') >= 0 ? 0.012 : 0.0001); $('#fxg-s-cost').dataset.sym = S.sym; } if (S.labKey !== key(S.sym, S.tf)) runLab('wf'); };
  function runLab(op) {
    var k = key(S.sym, S.tf), strat = $('#fxg-s-strat').value, st = $('#fxg-s-status'); S.labKey = k;
    var opts = { strat: strat, rr: +$('#fxg-s-rr').value || 2, atrMult: +$('#fxg-s-am').value || 2, riskPct: Math.min(1, +$('#fxg-s-risk').value || 0.75), cost: Math.max(0, +$('#fxg-s-cost').value || 0), folds: +$('#fxg-s-folds').value || 5, runs: 1000 };
    st.textContent = (op === 'wf' ? 'Walk-forward: optimising each in-sample window, then testing the next unseen window…' : 'Backtesting with default parameters on all data (in-sample)…');
    var pre = Promise.resolve();
    if (strat === 'ml') { op = 'bt'; pre = ensureModel(S.sym, S.tf).then(function (m) { var o = S.cache[k], sig = new Array(o.d.n).fill(0), prev = 0; m.oos.i.forEach(function (ix, j) { var p = m.oos.p[j], s = p > 0.56 ? 1 : p < 0.44 ? -1 : 0; if (s && s !== prev) sig[ix] = s; prev = s; }); opts.signals = sig; opts.start = m.oos.i[0]; }); }
    pre.then(function () { return load(S.sym, S.tf); }).then(function (o) { return compute(op, o.rows, opts).then(function (r) { return [o, r]; }); }).then(function (x) {
      if (key(S.sym, S.tf) !== k) return; var o = x[0], r = x[1], s = r.stats;
      st.textContent = (op === 'wf' ? 'Out-of-sample results only: ' + r.folds.length + ' folds, each optimised on its preceding window. In-sample expectancy ' + sgn(r.isExpectancy, 2) + 'R vs out-of-sample ' + sgn(s.expectancy, 2) + 'R' + (r.isExpectancy > s.expectancy + 0.1 ? ', so expect this kind of decay in live use.' : '.') : (strat === 'ml' ? 'ML filter: trades only where the walk-forward model made genuine out-of-sample calls (p > 0.56 long, p < 0.44 short).' : 'In-sample backtest (default parameters). Run walk-forward for an honest out-of-sample read.')) + ' Costs: ' + opts.cost + ' per trade in price.';
      $('#fxg-s-kpis').innerHTML = [['Trades', s.n, ''], ['Win rate', pct(s.winRate), ''], ['Expectancy', sgn(s.expectancy, 2) + 'R', cls(s.expectancy)], ['Profit factor', s.pf > 1e6 ? '∞' : f(s.pf, 2), cls(s.pf - 1)], ['Total', sgn(s.totalR, 1) + 'R', cls(s.totalR)], ['Return', pct(s.ret), cls(s.ret)], ['Max drawdown', pct(s.maxDD), 'dn'], ['Avg win / loss', f(s.avgWinR, 2) + ' / ' + f(s.avgLossR, 2) + 'R', ''], ['Max losing streak', s.maxConsecLoss, ''], ['SQN', f(s.sqn, 2), '']].map(function (q) { return '<div class="kpi"><span>' + q[0] + '</span><b class="' + q[2] + '">' + q[1] + '</b></div>'; }).join('');
      var peak = -Infinity; S.lab.eqS.setData(r.curve.map(function (p) { return { time: p[0] + SHIFT, value: p[1] }; })); S.lab.ddS.setData(r.curve.map(function (p) { peak = Math.max(peak, p[1]); return { time: p[0] + SHIFT, value: -(peak - p[1]) / peak * 100 }; })); S.lab.eq.timeScale().fitContent(); S.lab.dd.timeScale().fitContent();
      var mc = r.mc; if (mc) { hist($('#fxg-s-mc'), mc.finals); $('#fxg-s-mck').innerHTML = '<div class="fxg-kpis"><div class="kpi"><span>Return p5 / p50 / p95</span><b>' + pct(mc.ret.p5, 0) + ' / ' + pct(mc.ret.p50, 0) + ' / ' + pct(mc.ret.p95, 0) + '</b></div><div class="kpi"><span>Drawdown p50 / p95</span><b>' + pct(mc.dd.p50, 0) + ' / ' + pct(mc.dd.p95, 0) + '</b></div><div class="kpi"><span>P(≥20% drawdown)</span><b class="' + (mc.pRuin > 0.05 ? 'dn' : 'up') + '">' + pct(mc.pRuin) + '</b></div><div class="kpi"><span>P(losing run)</span><b>' + pct(mc.pLoss, 0) + '</b></div></div>'; } else { $('#fxg-s-mck').innerHTML = '<p class="fxg-empty">No trades to resample.</p>'; hist($('#fxg-s-mc'), []); }
      $('#fxg-s-foldtbl').innerHTML = r.folds ? '<tr><th>Fold</th><th>Params (chosen in-sample)</th><th>OOS window</th><th>IS exp.</th><th>OOS trades</th><th>OOS exp.</th></tr>' + r.folds.map(function (fo) { return '<tr><td>' + fo.fold + '</td><td>' + esc(JSON.stringify(fo.params).replace(/[{}"]/g, '')) + '</td><td>' + T(fo.oosFrom, true) + ' → ' + T(fo.oosTo, true) + '</td><td>' + sgn(fo.is && fo.is.expectancy, 2) + '</td><td>' + fo.oos.n + '</td><td class="' + cls(fo.oos.expectancy) + '">' + sgn(fo.oos.expectancy, 2) + '</td></tr>'; }).join('') : '<tr><td class="dim">Walk-forward not run (single backtest).</td></tr>';
      $('#fxg-s-trades').innerHTML = '<tr><th>Entry (SAST)</th><th>Side</th><th>Entry</th><th>Exit</th><th>Why</th><th>Bars</th><th>R</th></tr>' + r.trades.slice(-80).reverse().map(function (t) { return '<tr class="click" data-goto="' + t.et + '"><td>' + T(t.et) + '</td><td class="' + (t.dir > 0 ? 'up' : 'dn') + '">' + (t.dir > 0 ? 'Long' : 'Short') + '</td><td>' + px(S.sym, t.entry) + '</td><td>' + px(S.sym, t.exit) + '</td><td>' + t.why + '</td><td>' + t.bars + '</td><td class="' + cls(t.R) + '">' + sgn(t.R, 2) + '</td></tr>'; }).join('');
    }).catch(function (e) { st.textContent = 'Backtest failed: ' + e.message; });
  }
  function hist(cv, arr) { var r = window.devicePixelRatio || 1, w = cv.clientWidth || 300, hh = cv.clientHeight || 130; cv.width = w * r; cv.height = hh * r; var g = cv.getContext('2d'); g.scale(r, r); g.clearRect(0, 0, w, hh); if (!arr.length) return; var lo = C.quantile(arr, 0.005), hi = C.quantile(arr, 0.995), nb = 40, b = new Array(nb).fill(0); arr.forEach(function (v) { var k = Math.floor((v - lo) / ((hi - lo) || 1) * nb); b[Math.max(0, Math.min(nb - 1, k))]++; }); var mx = Math.max.apply(null, b), bw = w / nb; b.forEach(function (c, i) { var x0 = lo + (hi - lo) * i / nb; g.fillStyle = x0 < 0 ? 'rgba(255,93,108,.7)' : 'rgba(47,214,141,.7)'; var bh = c / mx * (hh - 18); g.fillRect(i * bw + 1, hh - 14 - bh, bw - 2, bh); }); g.fillStyle = css('--dim'); g.font = '10px Inter, sans-serif'; g.fillText(pct(lo, 0), 2, hh - 2); var t = pct(hi, 0); g.fillText(t, w - g.measureText(t).width - 2, hh - 2); }
  function gotoRow(e) { var tr = e.target.closest('[data-goto]'); if (!tr) return; var t = +tr.getAttribute('data-goto'); setTab('chart', true); cur().then(function () { return new Promise(function (r) { setTimeout(r, 60); }); }).then(function () { var o = S.mainData; if (!o) return; var d = o.d, lo = 0, hi = d.n - 1; while (lo < hi) { var mid = (lo + hi) >> 1; if (d.t[mid] < t) lo = mid + 1; else hi = mid; } S.main.chart.timeScale().setVisibleLogicalRange({ from: lo - 60, to: lo + 60 }); $('#fxg-term').scrollIntoView({ behavior: 'smooth', block: 'start' }); }); }

  /* ------------------------------------------------------------ RISK */
  INIT.risk = function () {
    $('#fxg-r-rules').innerHTML = ['Risk per trade defaults to ' + C.RULES.defaultRiskPct + '%, with a hard cap of ' + C.RULES.maxRiskPct + '%.', 'Daily loss guard: new paper trades stop after a ' + C.RULES.maxDailyLossPct + '% realised loss in a day.', 'Open risk across positions stays at or below ' + C.RULES.maxOpenRiskPct + '%, with at most ' + C.RULES.maxConcurrent + ' at once.', 'Stops are ATR-based and set before entry. Targets are set in R.', 'Auto-trading does not exist here, and no broker can be connected.'].map(function (x) { return '<li>' + x + '</li>'; }).join('');
    ['#fxg-r-acc', '#fxg-r-risk', '#fxg-r-entry', '#fxg-r-stop', '#fxg-r-tgt', '#fxg-r-day'].forEach(function (s) { $(s).addEventListener('input', calcRisk); });
    $('#fxg-r-fill').addEventListener('click', function () { fillRisk(true); });
  };
  function todayLoss() { var day = new Date().toISOString().slice(0, 10), j = (store('fxg-journal-v1') || []).filter(function (e) { return (e.closedAt || e.time || '').slice(0, 10) === day && e.pnl < 0; }); return -j.reduce(function (s, e) { return s + e.pnl; }, 0); }
  function fillRisk(force) { cur().then(function (o) { if (!force && $('#fxg-r-entry').dataset.k === key(S.sym, S.tf)) return calcRisk(); var i = o.d.n - 1, c = o.d.c[i], a = o.A[i] * 1.5, dp = dec(S.sym); $('#fxg-r-entry').value = c.toFixed(dp); $('#fxg-r-stop').value = (c - a).toFixed(dp); $('#fxg-r-tgt').value = (c + 2 * a).toFixed(dp); $('#fxg-r-day').value = todayLoss().toFixed(2); $('#fxg-r-entry').dataset.k = key(S.sym, S.tf); calcRisk(); }); }
  SHOW.risk = function () { $('#fxg-r-sym').textContent = S.sym + ' · prices from data, not live'; fillRisk(false); renderMLSize(); };
  function calcRisk() {
    var p = { symbol: S.sym, account: +$('#fxg-r-acc').value, riskPct: +$('#fxg-r-risk').value, entry: +$('#fxg-r-entry').value, stop: +$('#fxg-r-stop').value, target: +$('#fxg-r-tgt').value || 0, dayLoss: +$('#fxg-r-day').value || 0 }, r = C.positionSize(p), st = $('#fxg-r-state');
    if (!r.ok) { $('#fxg-r-out').innerHTML = '<p class="fxg-empty">' + esc(r.why) + '</p>'; st.textContent = ''; return; }
    st.innerHTML = r.blocked ? '<span class="fxg-badge dn">Blocked · daily loss guard</span>' : r.capped ? '<span class="fxg-badge warn">Risk capped at ' + C.RULES.maxRiskPct + '%</span>' : !r.targetOk ? '<span class="fxg-badge warn">Target on wrong side</span>' : '<span class="fxg-badge up">Within rules</span>';
    var sp = C.SPEC[S.sym] || C.SPEC.EURUSD;
    $('#fxg-r-out').innerHTML = [['Direction', r.dir > 0 ? 'Long' : 'Short', r.dir > 0 ? 'up' : 'dn'], ['Risk', '$' + f(r.riskCash, 2) + ' (' + f(r.riskPct, 2) + '%)', ''], ['Size', f(r.lots, 2) + ' lots', ''], ['Units', Math.round(r.units).toLocaleString() + (S.sym === 'XAUUSD' ? ' oz' : ''), ''], ['Stop distance', f(r.pips, 1) + ' pips', ''], ['Reward:risk', isFinite(r.rr) ? f(r.rr, 2) + 'R' : '—', r.rr >= 1.5 ? 'up' : 'warn'], ['Reward', isFinite(r.rewardCash) ? '$' + f(r.rewardCash, 2) : '—', 'up'], ['Break-even win rate', pct(r.breakevenWin), ''], ['Notional', '$' + Math.round(r.notionalUSD).toLocaleString(), ''], ['Daily budget left', '$' + f(r.dayLeft, 2), r.blocked ? 'dn' : '']].map(function (q) { return '<div class="kpi"><span>' + q[0] + '</span><b class="' + q[2] + '">' + q[1] + '</b></div>'; }).join('') + '<p class="dim" style="grid-column:1/-1;font-size:.72rem">1 lot = ' + sp.contract.toLocaleString() + ' units' + (sp.quoteUSD ? '' : '; P&amp;L converted to USD at the entry price') + '. Broker contract specs differ, so check yours.</p>';
    var rows = [-1, -0.5, 0, 1, 2, 3].map(function (m) { var price = p.entry + r.dir * m * Math.abs(p.entry - p.stop); return '<tr><td class="' + cls(m) + '">' + sgn(m, 1) + 'R</td><td>' + px(S.sym, price) + '</td><td class="' + cls(m) + '">' + (m < 0 ? '-$' : '$') + f(Math.abs(m * r.riskCash), 2) + '</td><td>' + pct(m * r.riskCash / p.account, 2) + '</td></tr>'; });
    $('#fxg-r-ladder').innerHTML = '<tr><th>Multiple</th><th>Price</th><th>P&amp;L</th><th>Account</th></tr>' + rows.join('');
    renderMLSize();
  }

  /* ------------------------------------------------------------ SCANNER */
  INIT.scan = function () { $('#fxg-p-run').addEventListener('click', runScan); $('#fxg-p-tbl').addEventListener('click', function (e) { var tr = e.target.closest('[data-sym]'); if (!tr) return; S.sym = tr.getAttribute('data-sym'); S.tf = tr.getAttribute('data-tf'); syncBar(); gotoRow(e); }); runScan(); };
  function runScan() {
    var dirF = $('#fxg-p-dir').value, lb = Math.max(1, +$('#fxg-p-lb').value || 3), jobs = []; $('#fxg-p-status').textContent = 'Scanning…';
    Object.keys(S.man.symbols).forEach(function (s) { tfsOf(s).forEach(function (tf) { jobs.push(load(s, tf)); }); });
    Promise.all(jobs).then(function (os) {
      var rows = [];
      os.forEach(function (o) { var hz = HORIZON[o.tf], hits = C.detectPatterns(o.d, { atr: o.A, e20: o.e20, e50: o.e50, rsi: o.rsi, bb: o.bb, closeOnly: o.closeOnly }), st = C.patternStats(o.d, hits, hz); hits.filter(function (p) { return p.i >= o.d.n - lb && (dirF === 'all' || String(p.dir) === dirF); }).forEach(function (p) { var s = st.by[p.id]; rows.push({ o: o, p: p, s: s, hz: hz }); }); });
      rows.sort(function (a, b) { return b.o.d.t[b.p.i] - a.o.d.t[a.p.i]; });
      $('#fxg-p-tbl').innerHTML = '<tr><th>Symbol</th><th>TF</th><th>Pattern</th><th>Bias</th><th>Bar (SAST)</th><th>Close</th><th>Hist. hit rate</th><th>Base rate</th><th>n</th></tr>' + (rows.length ? rows.map(function (r) { var s = r.s, edge = s && isFinite(s.hit) ? s.hit - s.baseHit : NaN; return '<tr class="click" data-sym="' + r.o.sym + '" data-tf="' + r.o.tf + '" data-goto="' + r.o.d.t[r.p.i] + '"><td>' + r.o.sym + '</td><td>' + r.o.tf + '</td><td>' + esc(r.p.name) + '</td><td class="' + cls(r.p.dir) + '">' + (r.p.dir > 0 ? 'Bull' : r.p.dir < 0 ? 'Bear' : 'Neutral') + '</td><td>' + T(r.o.d.t[r.p.i]) + '</td><td>' + px(r.o.sym, r.o.d.c[r.p.i]) + '</td><td class="' + (isFinite(edge) ? (edge > 0.03 ? 'up' : edge < -0.03 ? 'dn' : 'mute') : 'dim') + '">' + (s && isFinite(s.hit) ? pct(s.hit, 0) + ' in ' + r.hz + ' bars' : (s ? 'up ' + pct(s.upRate, 0) : '—')) + '</td><td>' + (s && isFinite(s.baseHit) ? pct(s.baseHit, 0) : '—') + '</td><td>' + (s ? s.n : 0) + '</td></tr>'; }).join('') : '<tr><td colspan="9" class="dim">No patterns on the last ' + lb + ' bars with this filter.</td></tr>');
      $('#fxg-p-status').textContent = rows.length + ' hits across ' + os.length + ' symbol/timeframe sets (latest bar of each data set). Hit rate = how often price moved the pattern\u2019s way over the horizon in this history; compare it with the base rate before trusting a pattern.';
    }).catch(fail('scan'));
  }

  /* ------------------------------------------------------------ SESSIONS (SAST) */
  INIT.sess = function () { setInterval(function () { if (S.tab === 'sess') drawSessions(); sideClock(); }, 30000); };
  SHOW.sess = function () { drawSessions(); hourProfile(); };
  function hm(m) { return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
  function drawSessions() {
    var svg = $('#fxg-ss-svg'); if (!svg || !svg.clientWidth) return; var w = svg.clientWidth, H = svg.clientHeight, sw = C.sessionWindows(new Date()), rows = sw.sessions.concat(sw.killzones), L = w < 500 ? 92 : 128, rh = (H - 28) / rows.length, X = function (m) { return L + (w - L - 8) * m / 1440; };
    var cols = { syd: '#7aa2ff', tok: '#e8c46a', lon: '#a78bfa', ny: '#e2475a' }, out = '';
    for (var hr = 0; hr <= 24; hr += 3) out += '<line x1="' + X(hr * 60) + '" x2="' + X(hr * 60) + '" y1="0" y2="' + (H - 20) + '" stroke="' + css('--line') + '"/><text x="' + X(hr * 60) + '" y="' + (H - 6) + '" font-size="10" text-anchor="middle" fill="' + css('--dim') + '">' + String(hr).padStart(2, '0') + '</text>';
    rows.forEach(function (r, i) { var y = 4 + i * rh, c = cols[r.id] || (r.id.indexOf('kz') === 0 ? '#2dd4bf' : '#999'), seg = r.start < r.end ? [[r.start, r.end]] : [[r.start, 1440], [0, r.end]]; out += '<text x="4" y="' + (y + rh * 0.62) + '" font-size="11" fill="' + (r.active ? css('--ink') : css('--mute')) + '" font-weight="' + (r.active ? 700 : 500) + '">' + esc(r.name) + '</text>'; seg.forEach(function (s) { out += '<rect x="' + X(s[0]) + '" y="' + (y + rh * 0.18) + '" width="' + Math.max(1, X(s[1]) - X(s[0])) + '" height="' + rh * 0.64 + '" rx="5" fill="' + c + '" fill-opacity="' + (r.active ? 0.9 : 0.35) + '"/>'; }); });
    out += '<line x1="' + X(sw.nowMin) + '" x2="' + X(sw.nowMin) + '" y1="0" y2="' + (H - 20) + '" stroke="' + css('--ink') + '" stroke-width="2"/><text x="' + Math.min(X(sw.nowMin) + 4, w - 70) + '" y="12" font-size="10" fill="' + css('--ink') + '">now ' + hm(sw.nowMin) + '</text>';
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + H); svg.innerHTML = out;
    $('#fxg-ss-now').textContent = 'SAST · now ' + hm(sw.nowMin) + (sw.weekend ? ' · weekend (FX closed)' : '');
    $('#fxg-ss-list').innerHTML = '<table class="fxg-tbl"><tr><th>Window</th><th>SAST</th><th>Status</th></tr>' + rows.map(function (r) { return '<tr><td>' + esc(r.name) + '</td><td>' + hm(r.start) + '–' + hm(r.end % 1440) + '</td><td class="' + (r.active ? 'up' : 'mute') + '">' + (r.active ? 'Open · closes in ' + hm(r.untilClose) : 'Opens in ' + hm(r.untilOpen)) + '</td></tr>'; }).join('') + '</table><p class="dim" style="font-size:.72rem">Sessions use local business hours in Sydney, Tokyo, London and New York, converted with each city\u2019s daylight-saving rules. Kill zones follow the common ICT New York-time windows. These are conventions, not guarantees of activity.</p>';
  }
  function sideClock() { var el = $('#fxg-side-clock'); if (!el) return; var sw = C.sessionWindows(new Date()), act = sw.sessions.filter(function (x) { return x.active; }).map(function (x) { return x.name; }), kz = sw.killzones.filter(function (x) { return x.active; }).map(function (x) { return x.name; }); el.innerHTML = '<b>' + hm(sw.nowMin) + '</b> · ' + (sw.weekend ? 'Weekend, FX closed' : (act.length ? act.join(' + ') : 'Between sessions')) + (kz.length ? '<br><span class="warn">' + esc(kz.join(', ')) + '</span>' : ''); }
  function hourProfile() {
    var sym = tfsOf(S.sym).indexOf('1h') >= 0 ? S.sym : 'XAUUSD'; $('#fxg-ss-sym').textContent = sym;
    load(sym, '1h').then(function (o) { var s = new Array(24).fill(0), n = new Array(24).fill(0), tr = C.trueRange(o.d); for (var i = 1; i < o.d.n; i++) { var hr = Math.floor(((o.d.t[i] + SHIFT) % 86400) / 3600); s[hr] += tr[i] / o.d.c[i] * 100; n[hr]++; } var avg = s.map(function (v, i) { return n[i] ? v / n[i] : 0; }); var cv = $('#fxg-ss-hr'), r = window.devicePixelRatio || 1, w = cv.clientWidth || 300, hh = cv.clientHeight || 170; cv.width = w * r; cv.height = hh * r; var g = cv.getContext('2d'); g.scale(r, r); var mx = Math.max.apply(null, avg), bw = (w - 4) / 24; g.font = '9px Inter, sans-serif'; avg.forEach(function (v, i) { var bh = v / mx * (hh - 18); var grd = g.createLinearGradient(0, hh - 14 - bh, 0, hh - 14); grd.addColorStop(0, '#e2475a'); grd.addColorStop(1, '#a78bfa'); g.fillStyle = grd; g.fillRect(2 + i * bw + 1, hh - 14 - bh, bw - 2, bh); if (i % 3 === 0) { g.fillStyle = css('--dim'); g.fillText(String(i).padStart(2, '0'), 2 + i * bw, hh - 2); } }); var top = avg.map(function (v, i) { return [v, i]; }).sort(function (a, b) { return b[0] - a[0]; }).slice(0, 3).map(function (x) { return String(x[1]).padStart(2, '0') + ':00'; }); $('#fxg-ss-hrn').textContent = 'From ' + o.d.n.toLocaleString() + ' hourly bars (' + S.man.symbols[sym].source + '). Busiest SAST hours: ' + top.join(', ') + '.'; });
  }

  /* ------------------------------------------------------------ JOURNAL (localStorage) */
  var JK = 'fxg-journal-v1';
  function jAll() { return store(JK) || []; }
  function jSave(a) { store(JK, a); }
  function jR(e) { var risk = Math.abs(e.entry - e.stop); return risk > 0 ? e.side * (e.exit - e.entry) / risk : 0; }
  function jPnl(e) { var sp = C.SPEC[e.sym] || C.SPEC.EURUSD, units = (e.lots || 0) * sp.contract, diff = e.side * (e.exit - e.entry); return sp.quoteUSD ? units * diff : units * diff / e.exit; }
  INIT.journal = function () {
    var sel = $('#fxg-j-sym'); Object.keys(S.man.symbols).forEach(function (s) { sel.appendChild(h('option', { value: s }, s)); });
    $('#fxg-j-add').addEventListener('click', function () {
      var e = { id: Date.now().toString(36), time: $('#fxg-j-t').value || new Date().toISOString().slice(0, 16), sym: sel.value, side: +$('#fxg-j-side').value, entry: +$('#fxg-j-entry').value, stop: +$('#fxg-j-stop').value, exit: +$('#fxg-j-exit').value, lots: +$('#fxg-j-lots').value || 0, setup: $('#fxg-j-setup').value, mood: $('#fxg-j-mood').value, notes: $('#fxg-j-notes').value.slice(0, 2000) };
      if (!(e.entry > 0 && e.stop > 0 && e.exit > 0) || e.entry === e.stop) { $('#fxg-j-status').textContent = 'Enter entry, stop and exit prices; the stop must differ from the entry.'; return; }
      if (e.side > 0 ? e.stop > e.entry : e.stop < e.entry) { $('#fxg-j-status').textContent = 'The stop is on the wrong side of the entry for this direction.'; return; }
      e.R = jR(e); e.pnl = jPnl(e); e.closedAt = new Date().toISOString(); var a = jAll(); a.push(e); jSave(a); $('#fxg-j-status').textContent = 'Saved: ' + sgn(e.R, 2) + 'R.'; $('#fxg-j-notes').value = ''; renderJournal();
    });
    $('#fxg-j-csv').addEventListener('click', function () { var a = jAll(), head = ['time', 'sym', 'side', 'entry', 'stop', 'exit', 'lots', 'R', 'pnl', 'setup', 'mood', 'notes']; dl('forex-codex-journal.csv', 'text/csv', [head.join(',')].concat(a.map(function (e) { return head.map(function (k) { var v = e[k] == null ? '' : String(e[k]); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); })).join('\n')); });
    $('#fxg-j-json').addEventListener('click', function () { dl('forex-codex-journal.json', 'application/json', JSON.stringify(jAll(), null, 1)); });
    $('#fxg-j-imp').addEventListener('change', function (ev) { var fl = ev.target.files[0]; if (!fl) return; fl.text().then(function (t) { var a = JSON.parse(t); if (!Array.isArray(a)) throw new Error('expected a list'); var clean = a.filter(function (e) { return e && e.sym && isFinite(e.entry) && isFinite(e.stop) && isFinite(e.exit); }).map(function (e) { e.R = jR(e); e.pnl = jPnl(e); return e; }); jSave(jAll().concat(clean)); $('#fxg-j-status').textContent = 'Imported ' + clean.length + ' entries.'; renderJournal(); }).catch(function (er) { $('#fxg-j-status').textContent = 'Import failed: ' + er.message; }); ev.target.value = ''; });
    $('#fxg-j-clear').addEventListener('click', function () { if (confirm('Delete every journal entry stored in this browser?')) { jSave([]); renderJournal(); } });
    $('#fxg-j-tbl').addEventListener('click', function (ev) { var b = ev.target.closest('[data-del]'); if (!b) return; jSave(jAll().filter(function (e) { return e.id !== b.getAttribute('data-del'); })); renderJournal(); });
  };
  SHOW.journal = function () { $('#fxg-j-sym').value = S.sym; var o = S.cache[key(S.sym, S.tf)]; if (o && !$('#fxg-j-entry').value) { var c = o.d.c[o.d.n - 1], a = o.A[o.d.n - 1], dp = dec(S.sym); $('#fxg-j-entry').placeholder = c.toFixed(dp); $('#fxg-j-stop').placeholder = (c - 1.5 * a).toFixed(dp); } renderJournal(); };
  function dl(name, type, text) { var u = URL.createObjectURL(new Blob([text], { type: type })), a = h('a', { href: u, download: name }); document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 1000); }
  function renderJournal() {
    var a = jAll(), st = C.tradeStats(a.map(function (e) { return { R: e.R }; })), pnl = a.reduce(function (s, e) { return s + (e.pnl || 0); }, 0);
    $('#fxg-j-kpis').innerHTML = [['Trades', st.n, ''], ['Win rate', pct(st.winRate), ''], ['Expectancy', sgn(st.expectancy, 2) + 'R', cls(st.expectancy)], ['Profit factor', st.pf > 1e6 ? '∞' : f(st.pf, 2), cls(st.pf - 1)], ['Total', sgn(st.totalR, 1) + 'R', cls(st.totalR)], ['P&amp;L (USD)', sgn(pnl, 2), cls(pnl)], ['Avg win / loss', f(st.avgWinR, 2) + ' / ' + f(st.avgLossR, 2), ''], ['Max losing streak', st.maxConsecLoss, '']].map(function (q) { return '<div class="kpi"><span>' + q[0] + '</span><b class="' + q[2] + '">' + q[1] + '</b></div>'; }).join('');
    var eq = [0]; a.forEach(function (e) { eq.push(eq[eq.length - 1] + e.R); }); var cv = $('#fxg-j-eq'); if (a.length) spark(cv, eq); else { var g = cv.getContext('2d'); cv.width = cv.clientWidth; cv.height = cv.clientHeight; g.fillStyle = css('--dim'); g.font = '12px Inter, sans-serif'; g.fillText('No trades yet. Log one above, or close a paper-sim trade.', 10, 24); }
    var grp = function (k) { var m = {}; a.forEach(function (e) { (m[e[k]] = m[e[k]] || []).push(e.R); }); return Object.keys(m).map(function (x) { var r = m[x], w = r.filter(function (v) { return v > 0; }).length; return '<tr><td>' + esc(x) + '</td><td>' + r.length + '</td><td>' + pct(w / r.length, 0) + '</td><td class="' + cls(C.mean(r)) + '">' + sgn(C.mean(r), 2) + 'R</td></tr>'; }).join(''); };
    $('#fxg-j-by').innerHTML = '<tr><th>Setup</th><th>n</th><th>Win</th><th>Avg</th></tr>' + grp('setup') + '<tr><th>Mindset</th><th>n</th><th>Win</th><th>Avg</th></tr>' + grp('mood');
    $('#fxg-j-tbl').innerHTML = '<tr><th>Time</th><th>Symbol</th><th>Side</th><th>Entry</th><th>Stop</th><th>Exit</th><th>R</th><th>P&amp;L</th><th>Setup</th><th>Mindset</th><th>Notes</th><th></th></tr>' + (a.length ? a.slice().reverse().map(function (e) { return '<tr><td>' + esc(String(e.time).replace('T', ' ')) + '</td><td>' + esc(e.sym) + '</td><td class="' + (e.side > 0 ? 'up' : 'dn') + '">' + (e.side > 0 ? 'Long' : 'Short') + '</td><td>' + px(e.sym, e.entry) + '</td><td>' + px(e.sym, e.stop) + '</td><td>' + px(e.sym, e.exit) + '</td><td class="' + cls(e.R) + '">' + sgn(e.R, 2) + '</td><td class="' + cls(e.pnl) + '">' + sgn(e.pnl, 2) + '</td><td>' + esc(e.setup) + '</td><td>' + esc(e.mood) + '</td><td style="max-width:220px;overflow:hidden;text-overflow:ellipsis" title="' + esc(e.notes) + '">' + esc(e.notes) + '</td><td><button class="fxg-btn" style="height:26px;padding:0 .5rem" data-del="' + esc(e.id) + '" aria-label="Delete entry">✕</button></td></tr>'; }).join('') : '<tr><td colspan="12" class="dim">Nothing logged yet.</td></tr>');
  }

  /* ------------------------------------------------------------ PAPER SIM (bar replay over real history) */
  var X = { timer: null };
  INIT.sim = function () {
    var c = mk($('#fxg-x-chart')); X.chart = c; X.cs = c.addCandlestickSeries(candleOpts()); X.ln = c.addLineSeries({ color: css('--ink'), lineWidth: 2, visible: false, priceLineVisible: false });
    $('#fxg-x-reset').addEventListener('click', function () { simReset(); }); $('#fxg-x-step').addEventListener('click', function () { simStep(1); });
    $('#fxg-x-play').addEventListener('click', function () { if (X.timer) simPause(); else simPlay(); });
    $('#fxg-x-speed').addEventListener('change', function () { if (X.timer) { simPause(); simPlay(); } });
    $('#fxg-x-buy').addEventListener('click', function () { simOrder(1); }); $('#fxg-x-sell').addEventListener('click', function () { simOrder(-1); }); $('#fxg-x-close').addEventListener('click', function () { simClose('manual', X.o.d.c[X.i]); simDraw(); });
    $('#fxg-x-start').addEventListener('change', function () { simReset(); });
  };
  SHOW.sim = function () { if (X.k !== key(S.sym, S.tf)) cur().then(function (o) { X.o = o; X.k = key(S.sym, S.tf); var r = $('#fxg-x-start'); r.max = o.d.n - 20; r.min = Math.min(200, o.d.n - 40); r.value = Math.max(+r.min, o.d.n - 400); simReset(); }); };
  function simReset() { simPause(); var o = X.o; X.i = +$('#fxg-x-start').value; X.eq = 10000; X.dayStartEq = 10000; X.day = Math.floor(o.d.t[X.i] / 86400); X.dayLoss = 0; X.pos = null; X.pending = null; X.hist = []; X.lines = []; X.cs.setMarkers([]); X.ln.setMarkers([]); if (o.closeOnly) { X.cs.setData([]); X.ln.applyOptions({ visible: true }); } else { X.ln.applyOptions({ visible: false }); X.ln.setData([]); } simDraw(true); }
  function simPlay() { var sp = +$('#fxg-x-speed').value || 3; X.timer = setInterval(function () { if (!simStep(1)) simPause(); }, 1000 / sp); $('#fxg-x-play').textContent = '❚❚ Pause'; }
  function simPause() { if (X.timer) clearInterval(X.timer); X.timer = null; var b = $('#fxg-x-play'); if (b) b.textContent = '▶ Play'; }
  function simStep(n) {
    var o = X.o, d = o.d; for (var k = 0; k < n; k++) {
      if (X.i >= d.n - 1) { $('#fxg-x-status').textContent = 'End of data reached (' + T(d.t[d.n - 1]) + ').'; return false; }
      X.i++; var i = X.i, day = Math.floor(d.t[i] / 86400); if (day !== X.day) { X.day = day; X.dayStartEq = X.eq; X.dayLoss = 0; }
      if (X.pending) { var pd = X.pending, a = o.A[i - 1] * pd.am, entry = d.o[i]; X.pos = { dir: pd.dir, entry: entry, stop: entry - pd.dir * a, tp: entry + pd.dir * a * pd.rr, units: pd.riskCash / a, riskCash: pd.riskCash, t: d.t[i], i: i }; X.pending = null; }
      var p = X.pos; if (p) { if (p.dir > 0 ? d.l[i] <= p.stop : d.h[i] >= p.stop) simClose('stop', p.dir > 0 ? Math.min(p.stop, d.o[i]) : Math.max(p.stop, d.o[i])); else if (p.dir > 0 ? d.h[i] >= p.tp : d.l[i] <= p.tp) simClose('target', p.dir > 0 ? Math.max(p.tp, d.o[i]) : Math.min(p.tp, d.o[i])); }
    }
    simDraw(); return true;
  }
  function simOrder(dir) {
    if (X.pos || X.pending) { $('#fxg-x-guard').textContent = 'One position at a time in the simulator. Close it first.'; return; }
    var lim = X.dayStartEq * C.RULES.maxDailyLossPct / 100; if (X.dayLoss >= lim - 1e-9) { $('#fxg-x-guard').innerHTML = '<span class="dn">Daily loss guard: ' + C.RULES.maxDailyLossPct + '% realised loss reached for this replay day. New orders are blocked until the next day.</span>'; return; }
    var risk = Math.min(C.RULES.maxRiskPct, Math.max(0.05, +$('#fxg-x-risk').value || 0.5)), riskCash = Math.min(X.eq * risk / 100, lim - X.dayLoss);
    X.pending = { dir: dir, am: Math.max(0.3, +$('#fxg-x-am').value || 1.5), rr: Math.max(0.5, +$('#fxg-x-rr').value || 2), riskCash: riskCash };
    $('#fxg-x-guard').textContent = (dir > 0 ? 'Buy' : 'Sell') + ' queued: fills at the next bar open, risking $' + f(riskCash, 2) + ' (' + f(risk, 2) + '%).'; simStep(1);
  }
  function simClose(why, price) {
    var p = X.pos; if (!p) return; var o = X.o, pnl = p.dir * (price - p.entry) * p.units, R = pnl / p.riskCash; X.eq += pnl; if (pnl < 0) X.dayLoss += -pnl;
    var tr = { dir: p.dir, et: p.t, xt: o.d.t[X.i], entry: p.entry, exit: price, stop: p.stop, R: R, pnl: pnl, why: why }; X.hist.push(tr); X.pos = null;
    var sp = C.SPEC[o.sym] || C.SPEC.EURUSD, a = jAll(); a.push({ id: 'sim' + Date.now().toString(36) + X.hist.length, time: new Date(p.t * 1000 + SHIFT * 1000).toISOString().slice(0, 16), sym: o.sym, side: p.dir, entry: +p.entry.toFixed(dec(o.sym)), stop: +p.stop.toFixed(dec(o.sym)), exit: +price.toFixed(dec(o.sym)), lots: +(p.units / sp.contract).toFixed(4), setup: 'Sim', mood: 'Calm', notes: 'Paper sim · ' + o.tf + ' replay · ' + why, R: R, pnl: pnl, closedAt: 'sim-' + new Date(o.d.t[X.i] * 1000).toISOString() }); jSave(a);
  }
  function simDraw(full) {
    var o = X.o, d = o.d, i = X.i, from = Math.max(0, i - 400);
    if (o.closeOnly) X.ln.setData(line(o, d.c, from).filter(function (b) { return b.time <= d.t[i] + SHIFT; })); else X.cs.setData(bars(o, from).slice(0, i - from + 1));
    var ser = o.closeOnly ? X.ln : X.cs; (X.lines || []).forEach(function (l) { ser.removePriceLine(l); }); X.lines = [];
    if (X.pos) { [['Entry', X.pos.entry, css('--mute')], ['Stop', X.pos.stop, css('--dn')], ['Target', X.pos.tp, css('--up')]].forEach(function (q) { X.lines.push(ser.createPriceLine({ price: q[1], color: q[2], lineWidth: 1, lineStyle: 2, title: q[0] })); }); }
    ser.setMarkers(X.hist.filter(function (t) { return t.et >= d.t[from]; }).map(function (t) { return { time: t.et + SHIFT, position: t.dir > 0 ? 'belowBar' : 'aboveBar', color: t.dir > 0 ? css('--up') : css('--dn'), shape: t.dir > 0 ? 'arrowUp' : 'arrowDown', text: sgn(t.R, 1) + 'R' }; }));
    if (full) X.chart.timeScale().setVisibleLogicalRange({ from: i - from - 120, to: i - from + 8 }); else X.chart.timeScale().scrollToRealTime();
    var unreal = X.pos ? X.pos.dir * (d.c[i] - X.pos.entry) * X.pos.units : 0, st = C.tradeStats(X.hist);
    $('#fxg-x-legend').innerHTML = '<b>' + o.sym + ' · ' + o.tf.toUpperCase() + ' replay</b> ' + T(d.t[i]) + ' · C <b>' + px(o.sym, d.c[i]) + '</b> · bar ' + (i - +$('#fxg-x-start').value) + ' of replay';
    $('#fxg-x-kpis').innerHTML = [['Equity', '$' + f(X.eq + unreal, 2), cls(X.eq + unreal - 10000)], ['Open P&amp;L', X.pos ? sgn(unreal, 2) : '—', cls(unreal)], ['Position', X.pos ? (X.pos.dir > 0 ? 'Long ' : 'Short ') + px(o.sym, X.pos.entry) : (X.pending ? 'Pending' : 'Flat'), X.pos ? cls(X.pos.dir) : ''], ['Closed trades', st.n, ''], ['Win rate', pct(st.winRate, 0), ''], ['Expectancy', sgn(st.expectancy, 2) + 'R', cls(st.expectancy)], ['Day loss used', pct(X.dayLoss / X.dayStartEq, 2) + ' of ' + C.RULES.maxDailyLossPct + '%', X.dayLoss / X.dayStartEq > 0.015 ? 'dn' : '']].map(function (q) { return '<div class="kpi"><span>' + q[0] + '</span><b class="' + q[2] + '">' + q[1] + '</b></div>'; }).join('');
    $('#fxg-x-hist').innerHTML = '<tr><th>Entry (SAST)</th><th>Side</th><th>Entry</th><th>Exit</th><th>Why</th><th>R</th><th>P&amp;L</th></tr>' + (X.hist.length ? X.hist.slice().reverse().map(function (t) { return '<tr><td>' + T(t.et) + '</td><td class="' + (t.dir > 0 ? 'up' : 'dn') + '">' + (t.dir > 0 ? 'Long' : 'Short') + '</td><td>' + px(o.sym, t.entry) + '</td><td>' + px(o.sym, t.exit) + '</td><td>' + t.why + '</td><td class="' + cls(t.R) + '">' + sgn(t.R, 2) + '</td><td class="' + cls(t.pnl) + '">' + sgn(t.pnl, 2) + '</td></tr>'; }).join('') : '<tr><td colspan="7" class="dim">No fills yet. Press Play, then Buy or Sell.</td></tr>');
  }

  /* ------------------------------------------------------------ CALENDAR (honest: live only via the FMC desk on the real origin) */
  INIT.cal = function () {
    var body = $('#fxg-c-body'), src = $('#fxg-c-src');
    function render(j, label, stale) { var ev = (j.events || []).slice().sort(function (a, b) { return a.t - b.t; }); src.textContent = label; body.innerHTML = (stale ? '<p class="fxg-notice" role="note" style="margin:0 0 .6rem"><span aria-hidden="true">⚠</span><span><b>Archived snapshot, not current.</b> These events are from the week of 28 Sep 2026 and are shown only to demonstrate the layout. Do not plan around them.</span></p>' : '') + '<div class="fxg-form" style="margin-bottom:.5rem"><label>Impact<select id="fxg-c-imp"><option value="all">All</option><option value="high">High only</option><option value="medium">Medium +</option></select></label></div><div class="fxg-scroll" style="max-height:480px"><table class="fxg-tbl" id="fxg-c-tbl"></table></div>'; var draw = function () { var lv = $('#fxg-c-imp').value; $('#fxg-c-tbl').innerHTML = '<tr><th>Time (SAST)</th><th>Ccy</th><th>Impact</th><th>Event</th><th>Forecast</th><th>Previous</th><th>Actual</th></tr>' + ev.filter(function (e) { return lv === 'all' || e.impact === 'high' || (lv === 'medium' && e.impact === 'medium'); }).map(function (e) { return '<tr><td>' + T(e.t) + '</td><td>' + esc(e.country) + '</td><td class="' + (e.impact === 'high' ? 'dn' : e.impact === 'medium' ? 'warn' : 'dim') + '">' + esc(e.impact) + '</td><td>' + esc(e.title) + '</td><td>' + esc(e.forecast) + '</td><td>' + esc(e.previous) + '</td><td>' + esc(e.actual) + '</td></tr>'; }).join(''); }; $('#fxg-c-imp').addEventListener('change', draw); draw(); }
    function placeholder(reason) { src.textContent = 'no live feed'; body.innerHTML = '<div class="fxg-empty" style="min-height:200px"><div><p><b>No live economic-calendar feed is connected here.</b></p><p class="dim">' + esc(reason) + ' Rather than invent events, this panel stays empty. Check an official calendar before high-impact news.</p><p><button class="fxg-btn" id="fxg-c-arch" type="button">Show archived snapshot (week of 28 Sep 2026)</button></p></div></div>'; $('#fxg-c-arch').addEventListener('click', function () { fetch('fixtures/get/calendar__week-this.json').then(function (r) { return r.json(); }).then(function (j) { render(j, 'archived · ForexFactory via FMC · stale', true); }).catch(function () { body.innerHTML = '<p class="fxg-empty">Snapshot unavailable.</p>'; }); }); }
    if (!REAL_ORIGIN) return placeholder('The FMC desk only serves the calendar to mensmercatus.online, and this page is running somewhere else.');
    body.innerHTML = '<p class="fxg-status">Fetching this week from the FMC desk…</p>';
    fetch(DESK + 'api/calendar?week=this', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (j) { if (!j || !j.ok || !(j.events || []).length) throw new Error('empty'); render(j, 'live via FMC desk · ' + (j.source || 'feed'), false); }).catch(function () { placeholder('The FMC desk calendar did not respond.'); });
  };

  /* ------------------------------------------------------------ LIVE DESK + desk health + reference quotes (existing endpoints) */
  INIT.desk = function () { var wrap = $('#fmc-frame-wrap'); if (!REAL_ORIGIN) { wrap.innerHTML = '<div class="fxg-empty" id="fmc-frame-msg" style="min-height:240px"><div><p><b>The classic desk only allows embedding on mensmercatus.online.</b></p><p class="dim">On this origin, open it in its own tab with “Open live desk ↗”.</p></div></div>'; return; } wrap.innerHTML = '<iframe id="fmc-frame" class="fxg-iframe" src="' + DESK + '" title="Forex Mercatus Codex: classic paper desk (embedded)" referrerpolicy="no-referrer"></iframe>'; };
  function health() {
    var pill = $('#fxg-desk-pill'); if (!REAL_ORIGIN) { pill.className = 'fxg-pill warn'; pill.lastElementChild.textContent = 'VPS desk · checked on mensmercatus.online only'; var fx = $('#fmc-facts'); if (fx) fx.textContent = 'Desk health is only checked on mensmercatus.online (its API allows that origin only).'; return; }
    fetch(HEALTH, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (hh) {
      var n = hh && hh.paper_sessions && hh.paper_sessions.sessions; pill.className = 'fxg-pill ok'; pill.lastElementChild.textContent = 'VPS desk online · paper' + (n != null ? ' · ' + n + ' sessions' : '');
      var facts = $('#fmc-facts'); if (facts) facts.textContent = 'From desk health: paper_only=' + (hh.paper_only ? 'true' : 'false') + ((hh.symbols || []).length ? ' · symbols ' + hh.symbols.join(' · ') : '') + ((hh.data || []).length ? ' · data ' + hh.data.join(' · ') : '');
    }).catch(function () { pill.className = 'fxg-pill off'; pill.lastElementChild.textContent = 'VPS desk unreachable · terminal works offline'; var facts = $('#fmc-facts'); if (facts) facts.textContent = 'Desk health unavailable from this origin. The God Mode terminal above does not need it.'; });
  }
  var QUOTE_PAIRS = [['EURUSD', 'EUR', 1], ['GBPUSD', 'GBP', 1], ['USDJPY', 'JPY', 0], ['USDCHF', 'CHF', 0], ['AUDUSD', 'AUD', 1], ['USDCAD', 'CAD', 0], ['USDZAR', 'ZAR', 0], ['NZDUSD', 'NZD', 1]], lastQ = {};
  function quotes() {
    var grid = $('#fx-quotes-grid'), meta = $('#fx-quotes-meta'); if (!grid.children.length) grid.innerHTML = QUOTE_PAIRS.map(function (p) { return '<li><span class="fx-q-pair">' + p[0] + '</span><span class="fx-q-px" data-q="' + p[0] + '">—</span></li>'; }).join('');
    fetch(QUOTE_API, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (j) { if (!j || j.result !== 'success' || !j.rates) throw new Error('bad'); QUOTE_PAIRS.forEach(function (p) { var raw = j.rates[p[1]]; if (raw == null) return; var v = p[2] ? 1 / raw : raw, el = grid.querySelector('[data-q="' + p[0] + '"]'), pr = lastQ[p[0]]; el.textContent = v.toFixed(p[0].indexOf('JPY') >= 0 ? 3 : 5); el.className = 'fx-q-px' + (pr != null ? (v > pr ? ' is-up' : v < pr ? ' is-down' : '') : ''); lastQ[p[0]] = v; }); meta.textContent = 'USD base · updated ' + (j.time_last_update_unix ? T(j.time_last_update_unix) : '—'); })
      .catch(function () { meta.textContent = 'Reference feed unreachable · terminal unaffected'; });
  }

  /* ------------------------------------------------------------ boot */
  function fail(where) { return function (e) { var el = $('#fxg-chart-status'); if (el) el.textContent = 'Could not load ' + where + ': ' + (e && e.message || e); if (window.console) console.warn('[fxg]', where, e); }; }
  function boot() {
    if (!C || !LW) { $('#fxg-term').innerHTML = '<div class="fxg-empty">The terminal scripts did not load. Refresh the page or use the Live desk link.</div>'; return; }
    quotes(); setInterval(function () { if (!document.hidden) quotes(); }, 60000); health(); sideClock(); setInterval(sideClock, 30000);
    fetch(BASE + 'data/manifest.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (man) {
      S.man = man; var pill = $('#fxg-data-pill'); pill.className = 'fxg-pill ok'; pill.lastElementChild.textContent = 'Real history · ' + Object.keys(man.symbols).length + ' symbols · data ends ' + T(man.symbols.XAUUSD.tfs['5m'].to, true) + ' · offline-ready';
      $('#fxg-sources').innerHTML = Object.keys(man.symbols).filter(function (s, i, a) { return s === 'XAUUSD' || s === 'EURUSD' || s === 'GBPUSD'; }).map(function (s) { var m = man.symbols[s]; return '<li><b>' + (s === 'GBPUSD' ? 'GBPUSD, USDJPY, USDCHF, AUDUSD, USDCAD, NZDUSD, USDZAR' : s) + '</b>: ' + esc(m.source) + '. ' + esc(m.licence) + '</li>'; }).join('') + '<li>' + esc(man.notes) + '</li><li>Reference quotes strip: open.er-api.com (Exchange Rate API free tier, attribution required). Archived calendar snapshot: ForexFactory via the FMC desk, stale and labelled.</li>';
      var hp = {}; location.hash.replace(/^#/, '').split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) hp[p[0]] = decodeURIComponent(p[1] || ''); });
      if (hp.sym && man.symbols[hp.sym]) S.sym = hp.sym; if (hp.tf && man.symbols[S.sym].tfs[hp.tf]) S.tf = hp.tf; else if (!man.symbols[S.sym].tfs[S.tf]) S.tf = '1d';
      buildShell(); buildWatchlist(); syncBar(); setTab(TABS.some(function (t) { return t[0] === hp.tab; }) ? hp.tab : 'chart', false);
      ['#fxg-p-ai', '#fxg-p-lab', '#fxg-p-scan', '#fxg-p-sim'].forEach(function (s) { $(s).addEventListener('click', function (e) { if (e.target.closest('[data-goto]') && !e.target.closest('#fxg-p-scan') && !e.target.closest('#fxg-p-lab')) gotoRow(e); }); });
      new MutationObserver(rethemeAll).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      window.__fxg = { S: S, setTab: setTab, setSym: setSym, setTf: setTf, ensureAI: ensureAI, ensureModel: ensureModel, simStep: simStep };
    }).catch(function (e) { $('#fxg-data-pill').className = 'fxg-pill off'; $('#fxg-data-pill').lastElementChild.textContent = 'Data bundle failed to load'; $('#fxg-term').innerHTML = '<div class="fxg-empty">Could not load the data bundle (' + esc(e.message) + '). Use the Live desk link below.</div>'; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
