/* LUXGEX desk — live quotes, replay, multi-chart, order flow, macro, COT, astro, history, quant library, sign-in. */

(function () {
  const HC = window.Highcharts;
  const $ = (id) => document.getElementById(id);
  const S = () => window.LX_STATE;
  const toast = (m) => window.LX_TOAST?.(m);
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const fmt = (x, d) => (x == null || Number.isNaN(x) ? "—" : Number(x).toLocaleString(undefined, { maximumFractionDigits: d ?? 2, minimumFractionDigits: d ?? 0 }));
  const dec = (p) => (p > 1000 ? 1 : p > 50 ? 2 : 4);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const post = (p, b) => fetch(p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.json());
  const get = (p) => fetch(p).then((r) => r.json());
  const when = (t, opts) => new Date(t * 1000).toLocaleString(undefined, opts || { weekday: "short", hour: "2-digit", minute: "2-digit" });
  const day = (t) => new Date(t * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const body = () => ({ symbol: S().symbol, n: S().bars, tf: S().tf, seed: S().seed, live: S().live, csv: S().csv || "" });

  /* ================================================================ live mode + ticker */
  let liveTimer = 0, lastLiveBarT = 0;
  let WATCH = ["SPX", "NQ", "DJI", "XAU", "XAG", "EURUSD", "GBPUSD", "USDJPY", "BTC", "ETH"];

  function setLive(on, silent) {
    const st = S();
    st.live = !!on;
    st.source = on ? "live" : "synthetic";
    const b = $("live-toggle");
    b.setAttribute("aria-pressed", String(!!on));
    b.querySelector(".live-txt").textContent = on ? "Live" : "Synthetic";
    b.classList.toggle("on", !!on);
    $("regen").disabled = !!on;
    $("ticker").classList.toggle("show", !!on);
    document.body.classList.toggle("is-live", !!on);
    if ($("csv-status") && !S().csv) $("csv-status").textContent = on ? "live" : "synthetic";
    clearInterval(liveTimer);
    if (on) { tick(); liveTimer = setInterval(tick, 5000); }
    if (!silent) window.runAll?.();
    savePrefs({ live: !!on });
  }

  async function tick() {
    const st = S();
    let q;
    try {
      const want = [...new Set([...WATCH, st.symbol])].join(",");
      q = await get(`/api/quote?symbols=${want}`);
    } catch { return; }
    if (!q.ok) return;
    paintTicker(q.quotes);
    const me = q.quotes.find((x) => x.symbol === st.symbol);
    if (!me || !st.analysis || !window.LXChart?.chart) return;
    // Intrabar update: fold the latest print into the current bar; roll to a fresh bar when the period changes.
    const bars = st.analysis.bars;
    const step = bars.length > 1 ? bars[1].t - bars[0].t : 900;
    const last = bars[bars.length - 1];
    const now = Math.floor(me.t / step) * step;
    if (!["yahoo", "binance", "kraken"].includes(me.source)) return;
    if (now > last.t) {
      const nb = { t: now, o: me.last, h: me.last, l: me.last, c: me.last, v: 0 };
      bars.push(nb); lastLiveBarT = now;
      LXChart.pushBar(nb, true);
      // A new bar closed — refresh the analytics quietly every period.
      window.runAll?.({ silent: true });
    } else {
      last.c = me.last; last.h = Math.max(last.h, me.last); last.l = Math.min(last.l, me.last);
      LXChart.pushBar(last, false);
    }
    const el = $("kpi-last");
    if (el) { el.textContent = fmt(me.last, dec(me.last)); el.classList.remove("flash-up", "flash-dn"); void el.offsetWidth; el.classList.add(me.change >= 0 ? "flash-up" : "flash-dn"); }
  }

  function paintTicker(quotes) {
    const items = quotes.map((q) => `<span class="tk ${q.change_pct >= 0 ? "up" : "dn"}" data-sym="${q.symbol}"><b>${q.symbol}</b> ${fmt(q.last, dec(q.last))} <i>${q.change_pct >= 0 ? "+" : ""}${Number(q.change_pct || 0).toFixed(2)}%</i>${["yahoo", "binance", "kraken"].includes(q.source) ? ` <small>${q.source}</small>` : " <small>synthetic</small>"}</span>`).join("");
    $("ticker-track").innerHTML = items + items; // duplicate for a seamless marquee loop
    $("ticker-track").querySelectorAll(".tk").forEach((el) => el.addEventListener("click", () => selectSymbol(el.dataset.sym)));
  }

  function selectSymbol(sym) {
    const sel = $("symbol");
    if (![...sel.options].some((o) => o.value === sym)) sel.add(new Option(`${sym} · live`, sym));
    sel.value = sym; S().symbol = sym; S().seed = null;
    window.runAll?.();
  }

  function paintSourcePill() {
    const st = S();
    const pill = $("source-pill");
    if (!pill) return;
    const a = st.analysis;
    const src = a?.source || (st.live ? "live" : "synthetic");
    const m = a?.meta || {};
    pill.textContent = src === "live" ? `LIVE · ${m.exchange || m.vendor_symbol || "yahoo"}${m.currency ? " · " + m.currency : ""}` : src === "synthetic-fallback" ? "offline → synthetic" : src;
    pill.className = `source-pill ${src === "live" ? "live" : ""}`;
    $("hero-spark") && (S().sourceLabel = src === "live" ? "live tape" : "synthetic tape");
  }

  /* ================================================================ bar replay animation */
  const replay = { on: false, timer: 0, i: 0, full: null };
  function replayToggle() {
    if (replay.on) return replayStop(true);
    const st = S();
    if (!st.analysis) return;
    replay.full = st.analysis;
    const n = replay.full.bars.length;
    replay.i = Math.max(40, Math.floor(n * 0.35));
    // Build the chart on the first third, then animate bars in one by one.
    const sliced = sliceAnalysis(replay.full, replay.i);
    st.analysis = sliced;
    window.drawChart?.();
    st.analysis = replay.full;
    replay.on = true;
    $("rp-toggle").textContent = "⏸ Stop";
    $("rp-toggle").classList.add("on");
    document.body.classList.add("is-replay");
    step();
    function step() {
      if (!replay.on) return;
      if (replay.i >= n) return replayStop(false);
      const b = replay.full.bars[replay.i];
      // Animate the candle forming: open → intrabar path → close.
      const frames = 4;
      let f = 0;
      const form = () => {
        if (!replay.on) return;
        f++;
        const k = f / frames;
        const path = b.o + (b.c - b.o) * k;
        const part = { t: b.t, o: b.o, h: Math.max(b.o, path, k > 0.5 ? b.h : path), l: Math.min(b.o, path, k > 0.5 ? b.l : path), c: path, v: b.v * k };
        LXChart.pushBar(f === frames ? b : part, f === 1);
        const el = $("kpi-last"); if (el) el.textContent = fmt(path, dec(path));
        $("rp-status").textContent = `${replay.i + 1} / ${n} · ${when(b.t)}`;
        if (f < frames) replay.timer = setTimeout(form, Math.max(12, +$("rp-speed").value / frames));
        else { replay.i++; replay.timer = setTimeout(step, +$("rp-speed").value * 0.25); }
      };
      form();
    }
  }
  function replayStop(rebuild) {
    replay.on = false;
    clearTimeout(replay.timer);
    $("rp-toggle").textContent = "▶ Replay";
    $("rp-toggle").classList.remove("on");
    document.body.classList.remove("is-replay");
    $("rp-status").textContent = rebuild ? "" : "replay complete";
    if (replay.full) { S().analysis = replay.full; window.drawChart?.(); }
  }
  function sliceAnalysis(a, k) {
    const cut = (arr) => (Array.isArray(arr) ? arr.slice(0, k) : arr);
    return {
      ...a, bars: a.bars.slice(0, k), n: k,
      neo_cloud: { fast: cut(a.neo_cloud.fast), slow: cut(a.neo_cloud.slow) },
      smart_trail: { line: cut(a.smart_trail.line), trend: cut(a.smart_trail.trend) },
      oscillators: Object.fromEntries(Object.entries(a.oscillators).map(([kk, v]) => [kk, kk === "reversals" ? v.filter((r) => r.i < k) : cut(v)])),
      signals: a.signals.filter((s) => s.i < k),
      structure: { ...a.structure, events: a.structure.events.filter((e) => e.i < k), order_blocks: a.structure.order_blocks.filter((z) => z.i < k), fvg: a.structure.fvg.filter((z) => z.i < k) },
    };
  }

  /* ================================================================ view controls */
  function bindViewControls() {
    $("vc-zoom-in").addEventListener("click", () => LXChart.zoomIn());
    $("vc-zoom-out").addEventListener("click", () => LXChart.zoomOut());
    $("vc-reset").addEventListener("click", () => LXChart.resetZoom());
    $("vc-end").addEventListener("click", () => LXChart.scrollToEnd());
    $("vc-box").addEventListener("click", (e) => { const on = e.currentTarget.getAttribute("aria-pressed") !== "true"; e.currentTarget.setAttribute("aria-pressed", String(on)); LXChart.setBoxZoom(on); toast(on ? "Box zoom: drag a range" : "Pan mode"); });
    $("vc-style").addEventListener("change", (e) => LXChart.setCandleStyle(e.target.value));
    const h = $("vc-height");
    h.addEventListener("input", (e) => { $("vc-height-out").textContent = `${e.target.value}px`; LXChart.setHeight(+e.target.value); });
    $("rp-toggle").addEventListener("click", replayToggle);
    // Keyboard: + / - / 0 / End, like TradingView.
    document.addEventListener("keydown", (e) => {
      if (e.target.matches("input, textarea, select") || e.metaKey || e.ctrlKey) return;
      if (e.key === "+" || e.key === "=") LXChart.zoomIn();
      else if (e.key === "-") LXChart.zoomOut();
      else if (e.key === "0") LXChart.resetZoom();
      else if (e.key === "End") LXChart.scrollToEnd();
    });
  }

  /* ================================================================ multi-chart */
  const multi = { layout: 2, panes: [] };
  const TF_BARS = { "1m": 390, "5m": 300, "15m": 240, "1h": 200 };
  function paneDefaults(i) {
    const syms = ["EURUSD", "XAU", "BTC", "ETH"];
    return { symbol: syms[i % syms.length], tf: S().tf, type: "candlestick" };
  }
  function setLayout(n, silent) {
    multi.layout = n;
    document.querySelectorAll("#layout-switch button[data-layout]").forEach((b) => b.classList.toggle("is-on", +b.dataset.layout === n));
    const grid = $("multi-grid");
    grid.className = `multi-grid cols-${n}`;
    while (multi.panes.length < n) multi.panes.push(paneDefaults(multi.panes.length));
    multi.panes.length = n;
    grid.innerHTML = multi.panes.map((p, i) => `
      <div class="pane" data-i="${i}">
        <div class="pane-head">
          <select class="pane-sym" data-i="${i}">${[...$("symbol").options].map((o) => `<option value="${o.value}" ${o.value === p.symbol ? "selected" : ""}>${o.value}</option>`).join("")}</select>
          <div class="tf-switch mini">${["1m", "5m", "15m", "1h"].map((t) => `<button data-i="${i}" data-tf="${t}" class="${t === p.tf ? "is-on" : ""}">${t}</button>`).join("")}</div>
          <select class="pane-type" data-i="${i}"><option value="candlestick" ${p.type === "candlestick" ? "selected" : ""}>Candles</option><option value="hollowcandlestick" ${p.type === "hollowcandlestick" ? "selected" : ""}>Hollow</option><option value="heikinashi" ${p.type === "heikinashi" ? "selected" : ""}>Heikin</option><option value="ohlc" ${p.type === "ohlc" ? "selected" : ""}>OHLC</option><option value="line" ${p.type === "line" ? "selected" : ""}>Line</option></select>
          <span class="pane-last" id="pane-last-${i}">—</span>
          <button class="pane-pop" data-i="${i}" title="Open in main chart">⤢</button>
        </div>
        <div class="pane-hc" id="pane-hc-${i}"></div>
      </div>`).join("");
    grid.querySelectorAll(".pane-sym").forEach((s) => s.addEventListener("change", (e) => { multi.panes[+e.target.dataset.i].symbol = e.target.value; loadPane(+e.target.dataset.i); }));
    grid.querySelectorAll(".pane-type").forEach((s) => s.addEventListener("change", (e) => { multi.panes[+e.target.dataset.i].type = e.target.value; loadPane(+e.target.dataset.i); }));
    grid.querySelectorAll(".tf-switch.mini button").forEach((b) => b.addEventListener("click", (e) => { const i = +e.target.dataset.i; multi.panes[i].tf = e.target.dataset.tf; e.target.parentElement.querySelectorAll("button").forEach((x) => x.classList.toggle("is-on", x === e.target)); loadPane(i); }));
    grid.querySelectorAll(".pane-pop").forEach((b) => b.addEventListener("click", (e) => { const p = multi.panes[+e.target.dataset.i]; S().tf = p.tf; S().bars = TF_BARS[p.tf] || 240; document.querySelectorAll("#tf-switch button").forEach((x) => x.classList.toggle("is-on", x.dataset.tf === p.tf)); selectSymbol(p.symbol); location.hash = "#chart"; }));
    multi.panes.forEach((_, i) => loadPane(i));
    if (!silent) savePrefs({ layout: n, panes: multi.panes });
  }
  async function loadPane(i) {
    const p = multi.panes[i];
    const el = $(`pane-hc-${i}`);
    if (!el) return;
    el.classList.add("loading");
    try {
      const a = await post("/api/analyze", { symbol: p.symbol, tf: p.tf, n: TF_BARS[p.tf] || 240, live: S().live, seed: S().seed });
      const h = multi.layout === 1 ? 520 : multi.layout === 2 ? 400 : 330;
      LXChart.buildPane(`pane-hc-${i}`, a, { height: h, symbol: p.symbol, type: p.type });
      const last = a.bars[a.bars.length - 1].c, first = a.bars[0].o;
      const chg = (last / first - 1) * 100;
      const pl = $(`pane-last-${i}`);
      const venue = a.meta?.exchange || a.source || "synth";
      pl.innerHTML = `${fmt(last, dec(last))} <i class="${chg >= 0 ? "up" : "dn"}">${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%</i> <small>${esc(String(venue))} · ${a.structure.bias}</small>`;
      if ($("multi-sync").checked) LXChart.syncPanes();
    } catch (err) { console.error("pane", err); }
    el.classList.remove("loading");
  }
  function bindMulti() {
    document.querySelectorAll("#layout-switch button[data-layout]").forEach((b) => b.addEventListener("click", () => setLayout(+b.dataset.layout)));
    $("multi-sync").addEventListener("change", (e) => { if (e.target.checked) LXChart.syncPanes(); });
    $("multi-refresh")?.addEventListener("click", () => multi.panes.forEach((_, i) => loadPane(i)));
    $("multi-preset")?.addEventListener("change", (e) => {
      const map = {
        live: ["EURUSD", "XAU", "BTC", "ETH"],
        us: ["SPX", "NQ", "ES", "VIX"],
        metals: ["XAU", "XAG", "DXY", "EURUSD"],
      };
      const syms = map[e.target.value] || map.live;
      multi.panes = syms.slice(0, Math.max(multi.layout, 2)).map((symbol, i) => ({ ...(multi.panes[i] || paneDefaults(i)), symbol }));
      setLayout(Math.max(multi.layout, 2), true);
    });
  }

  /* ================================================================ order flow */
  let flowChart = null;
  const FLOW_TOOLS = [
    { k: "footprint", n: "Footprint", d: "Bid × ask volume at every price inside each bar. Reads where trades actually happened, not just OHLC.", src: "Market Delta / Sierra numbers bars" },
    { k: "delta", n: "Delta", d: "Ask volume minus bid volume per bar. Positive = aggressive buyers dominated the tape.", src: "Jigsaw, ATAS" },
    { k: "cvd", n: "Cumulative delta", d: "Running sum of delta. Diverging from price flags absorption by passive orders.", src: "Bookmap, Exocharts" },
    { k: "profile", n: "Volume profile", d: "Volume by price with POC, value-area high/low. Price accepts inside VA, rejects outside.", src: "Market Profile (Steidlmayer)" },
    { k: "imbalance", n: "Stacked imbalances", d: "Diagonal ≥3:1 ask-vs-bid stacks — aggressive initiative that often becomes support/resistance.", src: "Orderflows, ATAS" },
    { k: "absorption", n: "Absorption & traps", d: "Big delta with no price progress = passive absorption; price against delta = trapped traders.", src: "Jigsaw Daytradr" },
    { k: "liquidity", n: "Liquidation heatmap", d: "Where leveraged positions get forced out — magnets for price. See the Liquidity panel.", src: "Coinglass, Hyblock" },
    { k: "tape", n: "Time & sales (BTC live)", d: "Real Binance aggregated trades feed the BTC footprint when Live is on; everything else is reconstructed from OHLCV.", src: "Binance public REST" },
  ];
  async function paintFlow() {
    const st = S();
    const pill = $("flow-pill");
    pill.textContent = "loading…";
    let r;
    try { r = await post("/api/orderflow", { ...body(), n_bars: 28 }); } catch { pill.textContent = "error"; return; }
    const isLiveTrades = Boolean(r.source && r.source.includes("trades"));
    const srcName = isLiveTrades ? r.source.replace("-trades", "").toUpperCase() : "";
    pill.textContent = isLiveTrades ? `LIVE · ${srcName} trades` : "reconstructed from OHLCV";
    pill.className = `pill ${isLiveTrades ? "bull" : ""}`;
    const d = dec(r.poc);
    $("fl-poc").textContent = fmt(r.poc, d);
    $("fl-va").textContent = `${fmt(r.val, d)} – ${fmt(r.vah, d)}`;
    $("fl-delta").textContent = `${r.last_delta >= 0 ? "+" : ""}${fmt(r.last_delta, 0)}`;
    $("fl-delta").className = r.last_delta >= 0 ? "up" : "dn";
    $("fl-bias").textContent = `5-bar bias: ${r.delta_bias}`;
    if ($("fl-cvd")) {
      $("fl-cvd").textContent = `${r.last_cvd >= 0 ? "+" : ""}${fmt(r.last_cvd, 0)}`;
      $("fl-cvd").className = r.last_cvd >= 0 ? "up" : "dn";
      $("fl-cvd-slope").textContent = `slope ${r.cvd_slope >= 0 ? "+" : ""}${fmt(r.cvd_slope, 1)} / bar`;
    }
    $("flow-signals").innerHTML = (r.signals.slice().reverse().map((s) => `<li class="${/bull|sellers absorbed/.test(s.side) ? "bull" : "bear"}"><span>${esc(s.kind)}</span><b>${esc(s.side)}</b><em>${fmt(s.price, d)} · Δ ${s.delta_pct}%</em></li>`).join("")) || `<li><span>no absorption/trap signatures in the last 20 bars</span></li>`;
    S().deltaBias = r.delta_bias;
    $("flow-note").textContent = r.note + (r.fallback_reason ? ` (${r.fallback_reason})` : "");
    // Heatmap: x = bar, y = price level, value = delta; label shows bid×ask.
    const data = [];
    let vmax = 1;
    r.cells.forEach((cell, i) => cell.forEach(([bid, ask], j) => { const v = ask + bid; if (v > 0) { data.push({ x: i, y: j, value: ask - bid, bid, ask, tot: v }); vmax = Math.max(vmax, Math.abs(ask - bid)); } }));
    const lvl = r.levels;
    const idx = (p) => lvl.reduce((best, v, k) => (Math.abs(v - p) < Math.abs(lvl[best] - p) ? k : best), 0);
    const cats = r.bars.map((b) => when(b.t, { hour: "2-digit", minute: "2-digit" }));
    // Preserve user drawings across refresh
    const keepDraw = flowChart ? flowChart.annotations.filter((a) => String(a.options.id || "").startsWith("flow-")).map((a) => a.userOptions) : [];
    if (flowChart) flowChart.destroy();
    flowChart = HC.chart("flow-hc", {
      chart: {
        type: "heatmap", height: 500, spacing: [12, 12, 12, 12], marginLeft: 56, marginRight: 80, marginTop: 28,
        className: "highcharts-light",
        // TradingView-style navigate: wheel zoom, drag pan, shift+drag box zoom
        panning: { enabled: true, type: "xy" },
        panKey: undefined,
        zooming: {
          type: undefined,
          mouseWheel: { enabled: true, type: "xy", sensitivity: 1.2 },
          resetButton: { theme: { fill: "#fff", stroke: "rgba(11,16,32,0.12)", r: 8, style: { fontFamily: "Sora, sans-serif", fontSize: "11px" } }, position: { align: "right", x: -8, y: 4 } },
        },
        events: {
          selection(e) {
            if (flowMode === "box" && e.xAxis && e.yAxis) {
              e.xAxis[0].axis.setExtremes(e.xAxis[0].min, e.xAxis[0].max, false);
              e.yAxis[0].axis.setExtremes(e.yAxis[0].min, e.yAxis[0].max, true);
              return false;
            }
          },
        },
      },
      title: { text: "" }, legend: { enabled: false }, credits: { enabled: false },
      stockTools: { gui: { enabled: false } },
      navigation: {
        bindingsClassName: "lx-bindings",
        annotationsOptions: {
          shapeOptions: { fill: "rgba(79,70,229,0.12)", stroke: "#4f46e5", strokeWidth: 1.6 },
          labelOptions: { backgroundColor: "#4f46e5", borderWidth: 0, borderRadius: 6, style: { color: "#fff", fontFamily: "JetBrains Mono, monospace", fontSize: "10px" } },
        },
      },
      xAxis: {
        categories: cats, labels: { step: Math.ceil(cats.length / 10) }, tickLength: 0, minPadding: 0.02, maxPadding: 0.02,
        crosshair: { color: "rgba(79,70,229,0.35)", dashStyle: "Dash", zIndex: 10 },
        minRange: 2,
        plotBands: cats.length ? [{ from: cats.length - 1.5, to: cats.length - 0.5, color: "rgba(79,70,229,0.06)" }] : [],
      },
      yAxis: {
        opposite: true, title: { text: "" }, categories: lvl.map((v) => fmt(v, d)),
        labels: { align: "left", x: 6, step: Math.ceil(lvl.length / 12) }, gridLineWidth: 0, reversed: false, minRange: 2,
        crosshair: { color: "rgba(79,70,229,0.35)", dashStyle: "Dash", label: { enabled: true, backgroundColor: "#4f46e5", borderRadius: 6, style: { fontFamily: "JetBrains Mono, monospace", fontSize: "10px", color: "#fff" } } },
        plotLines: [
          { value: idx(r.poc), color: css("--indigo"), width: 2, zIndex: 6, label: { text: "POC", align: "left", style: { color: css("--indigo"), fontFamily: "JetBrains Mono, monospace", fontSize: "9px", fontWeight: 700 } } },
          { value: idx(r.vah), color: "rgba(11,16,32,0.35)", width: 1, dashStyle: "Dash", zIndex: 6, label: { text: "VAH", align: "left", style: { color: "#4a5170", fontSize: "9px", fontFamily: "JetBrains Mono, monospace" } } },
          { value: idx(r.val), color: "rgba(11,16,32,0.35)", width: 1, dashStyle: "Dash", zIndex: 6, label: { text: "VAL", align: "left", y: 12, style: { color: "#4a5170", fontSize: "9px", fontFamily: "JetBrains Mono, monospace" } } },
        ],
      },
      colorAxis: { min: -vmax, max: vmax, stops: [[0, "rgba(225,29,72,0.85)"], [0.5, "rgba(245,246,251,1)"], [1, "rgba(5,150,105,0.85)"]] },
      tooltip: { useHTML: true, backgroundColor: "rgba(255,255,255,0.97)", borderColor: "rgba(11,16,32,0.08)", borderRadius: 10, style: { fontFamily: "JetBrains Mono, monospace", fontSize: "11px" }, formatter() { return `<b>${cats[this.point.x]}</b> @ ${fmt(lvl[this.point.y], d)}<br/>bid <span style="color:#e11d48">${fmt(this.point.bid, r.source === "binance-trades" ? 3 : 0)}</span> × ask <span style="color:#059669">${fmt(this.point.ask, r.source === "binance-trades" ? 3 : 0)}</span><br/>Δ ${this.point.value >= 0 ? "+" : ""}${fmt(this.point.value, r.source === "binance-trades" ? 3 : 0)}`; } },
      plotOptions: { heatmap: { borderWidth: 0.5, borderColor: "rgba(255,255,255,0.85)", turboThreshold: 0, dataLabels: { enabled: false } } },
      series: [
        { data, name: "Footprint", id: "footprint" },
        { type: "scatter", name: "Imbalance", data: r.imbalances.map((m) => ({ x: m.i, y: idx(m.price), marker: { symbol: m.side === "buy" ? "triangle" : "triangle-down", radius: 4, fillColor: m.side === "buy" ? css("--bull") : css("--bear"), lineColor: "#fff", lineWidth: 1 }, ratio: m.ratio })), tooltip: { pointFormat: "stacked imbalance {point.ratio}:1" }, zIndex: 8, colorAxis: false },
      ],
      annotations: keepDraw,
    });
    bindFlowToolbar();
    $("flow-tools").innerHTML = FLOW_TOOLS.map((t) => `<div class="tool-card"><b>${t.n}</b><p>${t.d}</p><small>${t.src}</small></div>`).join("");
    if ($("fl-cvd-hc") && HC && r.cvd) {
      if (window._lxCvd) window._lxCvd.destroy();
      window._lxCvd = HC.chart("fl-cvd-hc", {
        chart: { height: 110, spacing: [6, 6, 6, 6], className: "highcharts-light" },
        title: { text: "" }, credits: { enabled: false }, legend: { enabled: false },
        xAxis: { visible: false },
        yAxis: { title: { text: "" }, opposite: true, labels: { style: { fontSize: "9px", fontFamily: "ui-monospace, monospace" } } },
        tooltip: { backgroundColor: "rgba(255,255,255,0.96)", borderRadius: 8 },
        series: [{ name: "CVD", data: r.cvd.map((v, i) => [i, v]), color: "#4f46e5", lineWidth: 1.6, marker: { enabled: false } }],
      });
    }
  }

  let flowMode = "pan";
  let flowToolbarBound = false;
  function setFlowMode(mode) {
    flowMode = mode;
    document.querySelectorAll("#flow-toolbar [data-flow]").forEach((b) => b.classList.toggle("is-on", b.dataset.flow === mode || (mode === "pan" && b.dataset.flow === "pan")));
    if (!flowChart) return;
    const box = mode === "box";
    flowChart.update({
      chart: {
        panning: { enabled: mode === "pan", type: "xy" },
        zooming: { type: box ? "xy" : undefined, mouseWheel: { enabled: true, type: "xy", sensitivity: 1.2 } },
      },
    }, false);
    flowChart.container.style.cursor = mode === "box" ? "crosshair" : mode === "pan" ? "grab" : "crosshair";
    flowChart.redraw(false);
  }
  function flowZoom(factor) {
    if (!flowChart) return;
    ["xAxis", "yAxis"].forEach((axName) => {
      const ax = flowChart[axName][0];
      const min = ax.min, max = ax.max, mid = (min + max) / 2, half = ((max - min) / 2) * factor;
      const dMin = ax.dataMin ?? ax.categories?.length ? 0 : ax.min;
      const dMax = ax.dataMax ?? (ax.categories ? ax.categories.length - 1 : ax.max);
      ax.setExtremes(Math.max(dMin, mid - half), Math.min(dMax, mid + half), false);
    });
    flowChart.redraw(true);
  }
  function flowReset() {
    if (!flowChart) return;
    flowChart.xAxis[0].setExtremes(null, null, false);
    flowChart.yAxis[0].setExtremes(null, null, true);
  }
  function flowClear() {
    if (!flowChart) return;
    [...flowChart.annotations].filter((a) => String(a.options.id || "").startsWith("flow-")).forEach((a) => flowChart.removeAnnotation(a));
    toast("Flow drawings cleared");
  }
  function startFlowBind(name) {
    if (!flowChart?.navigationBindings) { toast("Drawing module not ready"); return; }
    const nb = flowChart.navigationBindings;
    const btn = document.querySelector(`#flow-toolbar [data-flow="${name}"]`);
    // Map to Highcharts binding class names and fire selectButton
    const map = { segment: "highcharts-segment", hline: "highcharts-horizontal-line", vline: "highcharts-vertical-line", ray: "highcharts-infinity-line", rect: "highcharts-rectangle", fib: "highcharts-fibonacci", text: "highcharts-label", measure: "highcharts-measure-xy" };
    const cls = map[name];
    if (!cls) return;
    // Prefer native binding if present
    const bindings = nb.boundClassNames || nb.options?.bindings || {};
    const key = Object.keys(bindings).find((k) => k.includes(cls.replace("highcharts-", "")) || bindings[k]?.className === cls);
    try {
      if (typeof nb.selectButton === "function" && btn) {
        // Fake a toolbar button the bindings understand
        btn.classList.add(cls);
        nb.selectButton(btn);
      } else {
        // Fallback: one-shot annotation helpers
        flowDrawFallback(name);
      }
    } catch {
      flowDrawFallback(name);
    }
    toast(`Tool: ${name} — click on the footprint`);
  }
  function flowDrawFallback(name) {
    if (!flowChart) return;
    const xa = flowChart.xAxis[0], ya = flowChart.yAxis[0];
    const x0 = (xa.min + xa.max) / 2, y0 = (ya.min + ya.max) / 2;
    const id = `flow-${name}-${Date.now()}`;
    if (name === "hline") {
      flowChart.addAnnotation({ id, draggable: "y", shapes: [{ type: "path", stroke: "#4f46e5", strokeWidth: 1.5, points: [{ x: xa.min, y: y0, xAxis: 0, yAxis: 0 }, { x: xa.max, y: y0, xAxis: 0, yAxis: 0 }] }], labels: [{ point: { x: xa.min, y: y0, xAxis: 0, yAxis: 0 }, text: "H", backgroundColor: "#4f46e5", borderWidth: 0, style: { color: "#fff", fontSize: "9px" } }] });
    } else if (name === "vline") {
      flowChart.addAnnotation({ id, draggable: "x", shapes: [{ type: "path", stroke: "#8b5cf6", strokeWidth: 1.5, points: [{ x: x0, y: ya.min, xAxis: 0, yAxis: 0 }, { x: x0, y: ya.max, xAxis: 0, yAxis: 0 }] }] });
    } else if (name === "segment" || name === "ray") {
      flowChart.addAnnotation({ id, draggable: "xy", shapes: [{ type: "path", stroke: "#4f46e5", strokeWidth: 1.8, points: [{ x: x0 - 3, y: y0 - 2, xAxis: 0, yAxis: 0 }, { x: x0 + 4, y: y0 + 2, xAxis: 0, yAxis: 0 }] }] });
    } else if (name === "rect") {
      flowChart.addAnnotation({ id, draggable: "xy", shapes: [{ type: "rect", fill: "rgba(79,70,229,0.12)", stroke: "#4f46e5", strokeWidth: 1.2, points: [{ x: x0 - 2, y: y0 + 2, xAxis: 0, yAxis: 0 }, { x: x0 + 3, y: y0 - 2, xAxis: 0, yAxis: 0 }] }] });
    } else if (name === "text") {
      const t = prompt("Note", "Absorption?");
      if (t) flowChart.addAnnotation({ id, draggable: "xy", labels: [{ point: { x: x0, y: y0, xAxis: 0, yAxis: 0 }, text: t, backgroundColor: "#0b1020", borderRadius: 8, padding: 6, style: { color: "#fff", fontSize: "11px" } }] });
    } else if (name === "fib") {
      flowChart.addAnnotation({ id, type: "fibonacci", typeOptions: { points: [{ x: x0 - 4, y: y0 - 3 }, { x: x0 + 4, y: y0 + 3 }], xAxis: 0, yAxis: 0, lineColor: "rgba(79,70,229,0.5)" }, labelOptions: { style: { color: "#4a5170", fontSize: "9px", fontFamily: "JetBrains Mono, monospace" } } });
    } else if (name === "measure") {
      flowChart.addAnnotation({ id, type: "measure", typeOptions: { point: { x: x0 - 2, y: y0 + 2, xAxis: 0, yAxis: 0 }, background: { width: 5, height: 4, fill: "rgba(79,70,229,0.08)", strokeWidth: 0 }, crosshairX: { enabled: true, stroke: "#4f46e5" }, crosshairY: { enabled: true, stroke: "#4f46e5" }, label: { enabled: true } } });
    }
  }
  function bindFlowToolbar() {
    if (flowToolbarBound) return;
    const bar = $("flow-toolbar");
    if (!bar) return;
    flowToolbarBound = true;
    bar.addEventListener("click", (e) => {
      const b = e.target.closest("[data-flow]");
      if (!b) return;
      const act = b.dataset.flow;
      if (act === "pan" || act === "box") setFlowMode(act);
      else if (act === "zoom-in") flowZoom(0.7);
      else if (act === "zoom-out") flowZoom(1 / 0.7);
      else if (act === "reset") flowReset();
      else if (act === "clear") flowClear();
      else if (act === "full") flowChart?.fullscreen?.toggle?.() || document.getElementById("flow-hc")?.requestFullscreen?.();
      else { setFlowMode(act); startFlowBind(act); }
    });
  }

  /* ================================================================ macro: calendar + news */
  async function paintMacro() {
    const week = $("cal-week").value, imp = $("cal-impact").value;
    const [cal, news] = await Promise.all([get(`/api/calendar?week=${week}`), get(`/api/news?symbol=${S().symbol}`)]);
    const now = Date.now() / 1000;
    const evs = cal.events.filter((e) => imp === "all" || (imp === "highonly" ? e.impact === "high" : e.impact === "high" || e.impact === "medium"));
    const nxt = evs.find((e) => e.t > now);
    $("cal-next").innerHTML = cal.ok ? (nxt ? `<span class="kicker">Next ${nxt.impact} impact</span><strong>${esc(nxt.title)}</strong><em>${esc(nxt.country)} · ${when(nxt.t)} · in ${fmtDur(nxt.t - now)}</em>${nxt.forecast ? `<small>forecast ${esc(nxt.forecast)} · prev ${esc(nxt.previous)}</small>` : ""}` : `<span class="kicker">Calendar</span><strong>No more ${imp === "all" ? "" : "high-impact "}events this week</strong>`) : `<span class="kicker">Calendar</span><strong>Offline</strong><em>${esc(cal.error || "")}</em>`;
    let lastDay = "";
    $("cal-list").innerHTML = evs.map((e) => {
      const d = day(e.t);
      const head = d !== lastDay ? `<li class="cal-day">${d}</li>` : "";
      lastDay = d;
      return head + `<li class="cal-ev ${e.impact} ${e.t < now ? "past" : ""}"><span class="cal-time">${when(e.t, { hour: "2-digit", minute: "2-digit" })}</span><span class="cal-cty">${esc(e.country)}</span><span class="cal-title">${esc(e.title)}</span><span class="cal-nums">${e.actual ? `<b>${esc(e.actual)}</b>` : ""}${e.forecast ? `<i>f ${esc(e.forecast)}</i>` : ""}${e.previous ? `<i>p ${esc(e.previous)}</i>` : ""}</span></li>`;
    }).join("") || `<li class="cal-ev">No events match the filter.</li>`;
    const sp = $("news-sent");
    sp.textContent = news.ok ? `sentiment ${news.sentiment >= 0 ? "+" : ""}${news.sentiment.toFixed(2)}` : "offline";
    sp.className = `pill ${news.sentiment > 0.1 ? "bull" : news.sentiment < -0.1 ? "bear" : ""}`;
    $("news-list").innerHTML = news.items.map((n) => `<li class="${n.sentiment > 0.2 ? "pos" : n.sentiment < -0.2 ? "neg" : ""}"><a href="${esc(n.link)}" target="_blank" rel="noopener">${esc(n.title)}</a><span>${when(n.t, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>${n.summary ? `<p>${esc(n.summary)}</p>` : ""}</li>`).join("") || `<li>No headlines (${esc(news.error || "empty feed")})</li>`;
  }
  const fmtDur = (s) => (s < 3600 ? `${Math.round(s / 60)}m` : s < 86400 ? `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m` : `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`);

  /* ================================================================ COT */
  let cotChart = null;
  async function paintCot() {
    const r = await get(`/api/cot?symbol=${S().symbol}&weeks=104`);
    const pill = $("cot-pill");
    if (!r.ok) { pill.textContent = r.error || "unavailable"; pill.className = "pill"; $("cot-note").textContent = r.market ? `CFTC market: ${r.market}` : "No CFTC futures market maps to this symbol."; if (cotChart) { cotChart.destroy(); cotChart = null; } return; }
    S().cotRead = r.read;
    pill.textContent = `${r.read} · ${r.latest.date}`;
    pill.className = `pill ${/long/.test(r.read) ? "bull" : /short/.test(r.read) ? "bear" : ""}`;
    $("cot-spec").textContent = `${r.latest.spec_net >= 0 ? "+" : ""}${fmt(r.latest.spec_net, 0)}`;
    $("cot-spec").className = r.latest.spec_net >= 0 ? "up" : "dn";
    $("cot-spec-chg").textContent = `w/w ${r.week_change >= 0 ? "+" : ""}${fmt(r.week_change, 0)} · z ${r.spec_z >= 0 ? "+" : ""}${r.spec_z}`;
    $("cot-idx").textContent = `${r.spec_index}`;
    $("cot-comm").textContent = `${r.latest.comm_net >= 0 ? "+" : ""}${fmt(r.latest.comm_net, 0)}`;
    $("cot-oi").textContent = fmt(r.latest.oi, 0);
    $("cot-oi-chg").textContent = `Δ ${r.latest.oi_change >= 0 ? "+" : ""}${fmt(r.latest.oi_change, 0)}`;
    $("cot-note").textContent = `${r.note} Source: CFTC Legacy Futures-Only, ${r.market}.`;
    const x = (row) => Date.parse(row.date + "T00:00:00Z");
    if (cotChart) cotChart.destroy();
    cotChart = HC.chart("cot-hc", {
      chart: { height: 320, spacing: [10, 10, 10, 10], marginRight: 70, className: "highcharts-light", zooming: { type: "x" } },
      title: { text: "" }, credits: { enabled: false },
      legend: { enabled: true, align: "left", verticalAlign: "top", itemStyle: { fontSize: "10px", fontWeight: 600, color: "#4a5170" } },
      xAxis: { type: "datetime", crosshair: true },
      yAxis: [{ title: { text: "" }, opposite: true, labels: { align: "left", x: 6, format: "{value:,.0f}" }, plotLines: [{ value: 0, color: "rgba(11,16,32,0.2)", width: 1 }] }, { title: { text: "" }, opposite: false, labels: { format: "{value:,.0f}", style: { color: "#8b91ab" } }, gridLineWidth: 0 }],
      tooltip: { shared: true, xDateFormat: "%e %b %Y", backgroundColor: "rgba(255,255,255,0.97)", borderColor: "rgba(11,16,32,0.08)", borderRadius: 10, style: { fontFamily: "JetBrains Mono, monospace", fontSize: "11px" } },
      plotOptions: { column: { borderWidth: 0, groupPadding: 0.08, pointPadding: 0.02 }, series: { animation: { duration: 500 } } },
      series: [
        { type: "column", name: "Large speculators net", data: r.rows.map((w) => [x(w), w.spec_net]), color: css("--indigo"), negativeColor: css("--bear") },
        { type: "line", name: "Commercials net", data: r.rows.map((w) => [x(w), w.comm_net]), color: css("--amber"), lineWidth: 1.6, marker: { enabled: false } },
        { type: "line", name: "Small traders net", data: r.rows.map((w) => [x(w), w.small_net]), color: "#94a3b8", lineWidth: 1, dashStyle: "Dash", marker: { enabled: false } },
        { type: "area", name: "Open interest", data: r.rows.map((w) => [x(w), w.oi]), yAxis: 1, color: "rgba(79,70,229,0.25)", fillOpacity: 0.08, lineWidth: 1, marker: { enabled: false } },
      ],
    });
  }

  /* ================================================================ astro */
  const GLYPH = { Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀", Mars: "♂", Jupiter: "♃", Saturn: "♄", Uranus: "♅", Neptune: "♆" };
  const SIGN_GLYPH = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];
  let astroChart = null, astroData = null, astroAnim = 0;
  async function paintAstro() {
    const r = await post("/api/astro", body());
    if (!r.ok) return;
    astroData = r;
    S().astroScore = r.score;
    const tone = $("astro-tone");
    tone.textContent = `${r.tone} · score ${r.score >= 0 ? "+" : ""}${r.score}`;
    tone.className = `pill ${r.tone === "constructive" ? "bull" : r.tone === "stressed" ? "bear" : ""}`;
    drawWheel(0);
    const m = r.moon;
    $("moon-card").innerHTML = `<div class="moon-ico" style="--ill:${m.illumination};--ang:${m.angle}deg"><i></i></div><div><b>${m.name}</b><span>${Math.round(m.illumination * 100)}% lit · ${m.age_days}d · full in ${m.days_to_full}d · new in ${m.days_to_new}d</span></div>`;
    $("aspect-list").innerHTML = r.aspects.slice(0, 9).map((a) => `<li class="${a.weight > 0 ? "soft" : "hard"} ${a.exact ? "exact" : ""}"><span>${GLYPH[a.a]} ${a.a}</span><b>${a.aspect}</b><span>${GLYPH[a.b]} ${a.b}</span><em>orb ${a.orb}°</em></li>`).join("") || "<li>No aspects within orb</li>";
    const le = r.lunar_edge;
    $("lunar-edge").innerHTML = le.ok ? `<div class="le-row"><span>After new moon (${le.n_new})</span><b class="${le.mean_after_new_pct >= 0 ? "up" : "dn"}">${le.mean_after_new_pct >= 0 ? "+" : ""}${le.mean_after_new_pct}%</b></div><div class="le-row"><span>After full moon (${le.n_full})</span><b class="${le.mean_after_full_pct >= 0 ? "up" : "dn"}">${le.mean_after_full_pct >= 0 ? "+" : ""}${le.mean_after_full_pct}%</b></div><div class="le-row"><span>All ${le.horizon_bars}-bar windows</span><b>${le.mean_all_pct >= 0 ? "+" : ""}${le.mean_all_pct}%</b></div><p class="le-verdict">${esc(le.verdict)}</p>` : `<p>${esc(le.reason || "")}</p>`;
    $("astro-events").innerHTML = r.upcoming.slice(0, 10).map((e) => `<li class="${e.impact} ${e.kind}"><span>${when(e.t, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span><b>${esc(e.label)}</b></li>`).join("");
    $("astro-note").textContent = `${r.note} ${r.disclaimer}`;
    if (astroChart) astroChart.destroy();
    astroChart = HC.chart("astro-hc", {
      chart: { type: "areaspline", height: 190, spacing: [8, 8, 8, 8], marginRight: 46, className: "highcharts-light" },
      title: { text: "" }, credits: { enabled: false }, legend: { enabled: false },
      xAxis: { type: "datetime", plotLines: [{ value: r.t * 1000, color: css("--indigo"), width: 1.5, dashStyle: "Dash", label: { text: "now", style: { color: css("--indigo"), fontSize: "9px" } } }] },
      yAxis: { title: { text: "" }, opposite: true, labels: { align: "left", x: 4 }, plotLines: [{ value: 0, color: "rgba(11,16,32,0.2)", width: 1 }] },
      tooltip: { xDateFormat: "%e %b", pointFormat: "Bradley <b>{point.y:+.1f}</b>", backgroundColor: "rgba(255,255,255,0.97)", borderColor: "rgba(11,16,32,0.08)", borderRadius: 10, style: { fontFamily: "JetBrains Mono, monospace", fontSize: "11px" } },
      series: [{ data: r.bradley_series.map((p) => [p.t * 1000, p.v]), color: css("--violet"), lineWidth: 2, marker: { enabled: false }, threshold: 0, negativeColor: css("--bear"), fillColor: { linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 }, stops: [[0, "rgba(139,92,246,0.3)"], [1, "rgba(139,92,246,0)"]] }, negativeFillColor: "rgba(225,29,72,0.12)" }],
    });
  }
  function drawWheel(k) {
    const r = astroData; if (!r) return;
    const cv = $("astro-wheel"), ctx = cv.getContext("2d");
    const W = cv.width, H = cv.height, cx = W / 2, cy = H / 2, R = W / 2 - 8;
    ctx.clearRect(0, 0, W, H);
    // zodiac ring
    for (let i = 0; i < 12; i++) {
      const a0 = -Math.PI + (i * 30) * Math.PI / 180, a1 = a0 + Math.PI / 6;
      ctx.beginPath(); ctx.arc(cx, cy, R, -a0, -a1, true); ctx.arc(cx, cy, R - 26, -a1, -a0, false); ctx.closePath();
      ctx.fillStyle = i % 2 ? "rgba(79,70,229,0.06)" : "rgba(139,92,246,0.06)"; ctx.fill();
      ctx.strokeStyle = "rgba(11,16,32,0.08)"; ctx.stroke();
      const am = (a0 + a1) / 2;
      ctx.fillStyle = "#4a5170"; ctx.font = "14px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(SIGN_GLYPH[i], cx + Math.cos(-am) * (R - 13), cy + Math.sin(-am) * (R - 13));
    }
    ctx.beginPath(); ctx.arc(cx, cy, R - 26, 0, Math.PI * 2); ctx.strokeStyle = "rgba(11,16,32,0.1)"; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R - 70, 0, Math.PI * 2); ctx.strokeStyle = "rgba(11,16,32,0.06)"; ctx.stroke();
    // aspects (lines between bodies)
    const pos = (lon, rr) => { const a = -Math.PI + lon * Math.PI / 180; return [cx + Math.cos(-a) * rr, cy + Math.sin(-a) * rr]; };
    const L = Object.fromEntries(r.positions.map((p) => [p.body, p.longitude]));
    r.aspects.slice(0, 12).forEach((a) => {
      const [x1, y1] = pos(L[a.a], R - 74), [x2, y2] = pos(L[a.b], R - 74);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.strokeStyle = a.weight > 0 ? `rgba(5,150,105,${0.25 + Math.abs(a.weight) * 0.5})` : `rgba(225,29,72,${0.25 + Math.abs(a.weight) * 0.5})`;
      ctx.lineWidth = a.exact ? 1.8 : 1; ctx.setLineDash(a.aspect === "opposition" ? [4, 3] : []); ctx.stroke(); ctx.setLineDash([]);
    });
    // planets with a slow orbital shimmer
    r.positions.forEach((p, i) => {
      const jitter = Math.sin(k / 900 + i) * 2;
      const [x, y] = pos(p.longitude, R - 48 + jitter);
      ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2);
      ctx.fillStyle = p.body === "Sun" ? "#f59e0b" : p.body === "Moon" ? "#94a3b8" : p.retrograde ? "#e11d48" : css("--indigo"); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "12px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(GLYPH[p.body], x, y + 0.5);
      if (p.retrograde) { ctx.fillStyle = "#e11d48"; ctx.font = "700 8px JetBrains Mono, monospace"; ctx.fillText("R", x + 11, y - 9); }
    });
    // centre
    ctx.fillStyle = "#0b1020"; ctx.font = "700 11px JetBrains Mono, monospace"; ctx.textAlign = "center";
    ctx.fillText(`Bradley ${r.bradley >= 0 ? "+" : ""}${r.bradley}`, cx, cy - 6);
    ctx.fillStyle = "#8b91ab"; ctx.font = "600 9px JetBrains Mono, monospace";
    ctx.fillText(new Date(r.t * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }), cx, cy + 9);
    cancelAnimationFrame(astroAnim);
    if (!document.hidden) astroAnim = requestAnimationFrame((t) => { if (isVisible(cv)) drawWheel(t); else setTimeout(() => drawWheel(t), 500); });
  }
  const isVisible = (el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; };

  /* ================================================================ history */
  let histChart = null;
  async function paintHistory() {
    const sym = S().symbol, iv = $("hist-interval").value, rg = $("hist-range").value;
    $("hist-stats").innerHTML = `<div class="stat-block"><span>Loading</span><strong>…</strong></div>`;
    const r = await get(`/api/history?symbol=${sym}&interval=${iv}&range=${rg}`);
    if (!r.ok) { $("hist-stats").innerHTML = `<div class="stat-block"><span>History</span><strong>offline</strong><em>${esc(r.error || "")}</em></div>`; return; }
    const csvRows = (r.rows || []).map((w) => [w.t, w.o, w.h, w.l, w.c, w.v].join(","));
    const blob = new Blob([["t,o,h,l,c,v"].concat(csvRows).join("\n")], { type: "text/csv" });
    if ($("hist-csv")._u) URL.revokeObjectURL($("hist-csv")._u);
    $("hist-csv")._u = URL.createObjectURL(blob);
    $("hist-csv").href = $("hist-csv")._u;
    $("hist-csv").download = `${sym}_${iv}_${rg}.csv`;
    const st = r.stats;
    const d = dec(r.rows[r.rows.length - 1].c);
    $("hist-stats").innerHTML = [
      ["Rows", fmt(st.rows, 0), `${day(st.first)} → ${day(st.last)}`], ["Total return", `${st.total_return_pct >= 0 ? "+" : ""}${st.total_return_pct}%`, "over range"],
      ["Ann. volatility", `${st.ann_vol_pct}%`, "close-to-close"], ["Max drawdown", `${st.max_drawdown_pct}%`, "peak to trough"],
      ["Best / worst", `${st.best_pct}% / ${st.worst_pct}%`, "single period"], ["Up periods", `${st.up_days_pct}%`, "hit rate"],
    ].map(([a, b, c]) => `<div class="stat-block"><span>${a}</span><strong>${b}</strong><em>${c}</em></div>`).join("");
    if (histChart) histChart.destroy();
    histChart = HC.stockChart("hist-hc", {
      chart: { height: 360, spacing: [10, 10, 10, 10], marginRight: 70, className: "highcharts-light", zooming: { mouseWheel: { enabled: true, type: "x" } }, panning: { enabled: true, type: "x" } },
      stockTools: { gui: { enabled: false } }, navigation: { bindingsClassName: "lx-no-bindings" },
      rangeSelector: { enabled: true, selected: 5, buttons: [{ type: "month", count: 1, text: "1m" }, { type: "month", count: 3, text: "3m" }, { type: "month", count: 6, text: "6m" }, { type: "ytd", text: "YTD" }, { type: "year", count: 1, text: "1y" }, { type: "all", text: "All" }] },
      navigator: { enabled: true, height: 30 }, scrollbar: { enabled: false },
      yAxis: [{ opposite: true, labels: { align: "left", x: 6 }, title: { text: "" }, height: "72%" }, { top: "76%", height: "24%", offset: 0, labels: { enabled: false }, title: { text: "" }, gridLineWidth: 0 }],
      tooltip: { split: false, shared: true, valueDecimals: d, backgroundColor: "rgba(255,255,255,0.97)", borderColor: "rgba(11,16,32,0.08)", borderRadius: 10, style: { fontFamily: "JetBrains Mono, monospace", fontSize: "11px" } },
      series: [
        { type: "candlestick", name: sym, data: r.rows.map((w) => [w.t * 1000, w.o, w.h, w.l, w.c]), color: css("--bear"), upColor: css("--bull"), lineColor: css("--bear"), upLineColor: css("--bull"), dataGrouping: { enabled: true } },
        { type: "column", name: "Volume", data: r.rows.map((w) => [w.t * 1000, w.v]), yAxis: 1, color: "rgba(79,70,229,0.25)", borderWidth: 0 },
      ],
    });
    const rows = r.rows.slice(-80).reverse();
    $("hist-body").innerHTML = rows.map((w, i) => { const prev = rows[i + 1]; const ch = prev ? (w.c / prev.c - 1) * 100 : 0; return `<tr><td>${new Date(w.t * 1000).toLocaleDateString(undefined, iv === "60m" ? { month: "short", day: "numeric", hour: "2-digit" } : { year: "2-digit", month: "short", day: "numeric" })}</td><td>${fmt(w.o, d)}</td><td>${fmt(w.h, d)}</td><td>${fmt(w.l, d)}</td><td>${fmt(w.c, d)}</td><td>${fmt(w.v, 0)}</td><td class="${ch >= 0 ? "pos" : "neg"}">${ch >= 0 ? "+" : ""}${ch.toFixed(2)}%</td></tr>`; }).join("");
  }

  /* ================================================================ quant academy */
  let quantLib = null;
  let quantOpenId = null;
  let quantTab = "guide";

  function loadStrategyScript(s) {
    if (!s?.script) return toast("No lxScript for this strategy");
    $("script-src").value = s.script;
    location.hash = "#editor";
    setTimeout(() => $("script-run")?.click(), 150);
    toast(`Loaded “${s.name}” into the editor`);
  }

  function renderDossierPane(s) {
    const pane = $("qd-pane");
    if (!pane || !s) return;
    const list = (arr, cls = "") => `<ol class="qd-steps ${cls}">${(arr || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ol>`;
    const pills = (arr, tone) => `<div class="qd-pills">${(arr || []).map((x) => `<span class="qd-pill ${tone || ""}">${esc(x)}</span>`).join("")}</div>`;
    if (quantTab === "guide") {
      pane.innerHTML = `<p class="qd-int">${esc(s.intuition || "")}</p>${list(s.steps)}`;
    } else if (quantTab === "rules") {
      pane.innerHTML = list(s.rules, "rules");
    } else if (quantTab === "fit") {
      pane.innerHTML = `<h4>Best for</h4>${pills(s.best_for, "ok")}<h4>Avoid when</h4>${pills(s.avoid_when, "bad")}<h4>Pre-flight checklist</h4>${list(s.checklist, "check")}`;
    } else if (quantTab === "risk") {
      pane.innerHTML = list(s.risks, "risk");
    } else if (quantTab === "params") {
      pane.innerHTML = `<table class="qd-params"><thead><tr><th>Param</th><th>Default</th><th>Hint</th></tr></thead><tbody>${(s.params || []).map((p) => `<tr><td>${esc(p.name)}</td><td>${esc(p.default)}</td><td>${esc(p.hint)}</td></tr>`).join("")}</tbody></table>`;
    }
  }

  function openDossier(id) {
    const s = quantLib?.strategies?.find((x) => x.id === id);
    if (!s) return;
    quantOpenId = id;
    quantTab = "guide";
    $("quant-grid").hidden = true;
    $("quant-dossier").hidden = false;
    $("qd-fam").textContent = s.family;
    $("qd-title").textContent = s.name;
    $("qd-thesis").textContent = s.thesis;
    $("qd-schematic").innerHTML = s.schematic || "";
    $("qd-origin").textContent = s.origin || "";
    $("quant-dossier").querySelectorAll(".qd-tabs button").forEach((b) => b.classList.toggle("is-on", b.dataset.tab === quantTab));
    renderDossierPane(s);
    $("quant-dossier").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeDossier() {
    quantOpenId = null;
    $("quant-dossier").hidden = true;
    $("quant-grid").hidden = false;
  }

  function paintFitQuiz() {
    const quiz = quantLib?.fit_quiz || [];
    $("fit-quiz").innerHTML = quiz.map((q) => `
      <fieldset class="fit-q" data-id="${esc(q.id)}">
        <legend>${esc(q.q)}</legend>
        ${q.options.map((o, i) => `<label class="fit-opt"><input type="radio" name="fit-${esc(q.id)}" value="${esc(o.label)}" ${i === 0 ? "checked" : ""}/> <span>${esc(o.label)}</span></label>`).join("")}
      </fieldset>`).join("") + `<button class="btn primary" type="button" id="fit-run">Recommend strategies</button>`;
    $("fit-run").onclick = async () => {
      const answers = {};
      quiz.forEach((q) => {
        const el = document.querySelector(`input[name="fit-${q.id}"]:checked`);
        if (el) answers[q.id] = el.value;
      });
      const r = await post("/api/strategies/fit", { answers });
      const box = $("fit-results");
      box.hidden = false;
      if (!r.recommendations?.length) {
        box.innerHTML = `<p class="note">No strong match — browse the library and open a dossier.</p>`;
        return;
      }
      box.innerHTML = `<p class="kicker">Top fits for you</p>` + r.recommendations.map((rec, i) => `
        <div class="fit-card">
          <div class="fit-rank">#${i + 1}</div>
          <div>
            <b>${esc(rec.name)}</b>
            <span class="q-fam">${esc(rec.family)}</span>
            <p>${esc(rec.why)}</p>
          </div>
          <button class="btn primary small fit-open" data-id="${esc(rec.id)}" type="button">Open guide</button>
        </div>`).join("");
      box.querySelectorAll(".fit-open").forEach((b) => b.addEventListener("click", () => {
        $("fit-box").hidden = true;
        openDossier(b.dataset.id);
      }));
    };
  }

  async function paintQuant() {
    quantLib = await get("/api/strategies");
    if ($("quant-disc") && quantLib.disclaimer) $("quant-disc").textContent = quantLib.disclaimer;
    const fam = $("quant-family");
    if (fam && fam.options.length === 1) quantLib.families.forEach((f) => fam.add(new Option(f, f)));
    const pick = fam?.value || "all";
    const list = quantLib.strategies.filter((s) => pick === "all" || s.family === pick);
    $("quant-grid").innerHTML = list.map((s) => `
      <div class="q-card" data-id="${s.id}" tabindex="0" role="button">
        <div class="q-head"><span class="q-fam">${esc(s.family)}</span><span class="q-cx" title="complexity">${"●".repeat(s.complexity)}${"○".repeat(Math.max(0, 3 - s.complexity))}</span></div>
        <h3>${esc(s.name)}</h3>
        <p>${esc(s.thesis)}</p>
        <div class="q-meta"><span>${esc(s.assets)}</span><span>${esc(s.horizon)}</span></div>
        <div class="q-actions">
          <button class="btn primary small q-study" data-id="${s.id}" type="button">Study guide</button>
          <button class="btn ghost small q-load" data-id="${s.id}" type="button">Load &amp; backtest</button>
        </div>
      </div>`).join("");
    $("quant-grid").querySelectorAll(".q-study").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); openDossier(b.dataset.id); }));
    $("quant-grid").querySelectorAll(".q-load").forEach((b) => b.addEventListener("click", (e) => {
      e.stopPropagation();
      loadStrategyScript(quantLib.strategies.find((x) => x.id === b.dataset.id));
    }));
    $("quant-grid").querySelectorAll(".q-card").forEach((card) => {
      card.addEventListener("click", () => openDossier(card.dataset.id));
      card.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDossier(card.dataset.id); } });
    });
    $("resource-row").innerHTML = (quantLib.resources || []).map((r) => `
      <div class="res"><span class="res-kind">${esc(r.kind)}</span><b>${esc(r.name)}</b><small>${esc(r.use)}</small></div>`).join("");
    if (quantOpenId) openDossier(quantOpenId);
  }

  function bindQuant() {
    $("quant-family")?.addEventListener("change", () => { closeDossier(); paintQuant(); });
    $("qd-back")?.addEventListener("click", closeDossier);
    $("qd-load")?.addEventListener("click", () => {
      const s = quantLib?.strategies?.find((x) => x.id === quantOpenId);
      loadStrategyScript(s);
    });
    $("qd-checklist")?.addEventListener("click", () => {
      quantTab = "fit";
      $("quant-dossier").querySelectorAll(".qd-tabs button").forEach((b) => b.classList.toggle("is-on", b.dataset.tab === "fit"));
      const s = quantLib?.strategies?.find((x) => x.id === quantOpenId);
      renderDossierPane(s);
      toast("Review the pre-flight checklist before you size up");
    });
    $("quant-dossier")?.querySelectorAll(".qd-tabs button").forEach((b) => b.addEventListener("click", () => {
      quantTab = b.dataset.tab;
      $("quant-dossier").querySelectorAll(".qd-tabs button").forEach((x) => x.classList.toggle("is-on", x === b));
      renderDossierPane(quantLib?.strategies?.find((x) => x.id === quantOpenId));
    }));
    $("quant-fit-open")?.addEventListener("click", () => {
      $("fit-box").hidden = false;
      $("fit-results").hidden = true;
      paintFitQuiz();
      $("fit-box").scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    $("fit-close")?.addEventListener("click", () => { $("fit-box").hidden = true; });
    $("qmodels-run")?.addEventListener("click", () => paintModels());
  }

  function paintModels() {
    const grid = $("qmodels-grid");
    if (!grid) return Promise.resolve();
    grid.innerHTML = `<p class="quant-disc">Running 20 models…</p>`;
    return post("/api/models/run", body()).then((r) => {
      if (!r?.ok) { grid.textContent = r?.error || "models failed"; return; }
      const cross = $("qmodels-cross");
      if (cross && r.crosscheck) {
        const bench = r.benchmark_symbol ? `<span class="bench"><b>vs</b> ${esc(r.benchmark_symbol)}${r.benchmark_supplied ? "" : " · proxy"}</span>` : "";
        cross.innerHTML = bench + Object.entries(r.crosscheck).map(([k, v]) => `<span><b>${esc(k)}</b> ${v.call}${v.vs_bs != null ? ` · ${v.vs_bs}× BS` : ""}</span>`).join("");
      }
      grid.innerHTML = (r.results || []).map((m) => {
        const outs = m.outputs || {};
        const bits = Object.entries(outs).filter(([k]) => !["note"].includes(k)).slice(0, 3)
          .map(([k, v]) => `${k} ${typeof v === "number" ? v : v}`).join(" · ");
        const head = m.headline ? `<p class="out">${esc(m.headline)}${m.proxy ? " · proxy" : ""}</p>` : "";
        return `<article><span class="fam">${esc(m.family || "")}</span><h4>${esc(m.name || m.id)}</h4>${head}<p>${m.ok ? esc(bits || "ok") : esc(m.error || "failed")}</p></article>`;
      }).join("");
    }).catch(() => { grid.textContent = "models unreachable"; });
  }

  /* ================================================================ whales + guide */
  async function paintWhales() {
    if (!$("whale-table")) return;
    const pack = await get(`/api/whales?symbol=${encodeURIComponent(S().symbol)}`);
    const levels = pack.levels || {};
    const guide = pack.guide || {};
    $("whale-steps").innerHTML = (guide.steps || []).map((s) => `<li>${esc(s)}</li>`).join("");
    $("whale-schematic").innerHTML = guide.schematic || "";
    const rows = [...(levels.whales || []), ...(levels.big_trades || [])].sort((a, b) => a.strike - b.strike);
    $("whale-table").querySelector("tbody").innerHTML = rows.map((r) => `
      <tr class="${r.kind === "whale" ? "is-whale" : ""}">
        <td>${fmt(r.strike, dec(r.strike))}</td>
        <td>${fmt(r.notional_bn, 2)} bn ${esc(r.ccy || "")}</td>
        <td>${esc((r.kind || "").toUpperCase())}</td>
      </tr>`).join("") || `<tr><td colspan="3">No board for ${esc(levels.pair || S().symbol)} today</td></tr>`;
    $("whale-meta").textContent = `· ${levels.date || "—"} · ${levels.cut || "NY cut"} · ${levels.source || ""}`;
    $("whale-note").textContent = pack.disclaimer || levels.note || "";
    $("whale-pill").textContent = pack.today?.live ? "live feed" : (levels.source || "archive");
    $("whale-pill").classList.toggle("live", !!pack.today?.live);
    const recent = pack.history_summary?.recent || [];
    $("whale-hist-list").innerHTML = recent.slice().reverse().map((d) => `
      <li><span>${esc(d.date)}</span><span>${d.whale_count} whales · max ${fmt(d.max_bn, 1)}bn</span><span>${esc(d.source || "")}</span></li>`).join("");
    if (levels.ok !== false) S().whales = levels;
  }

  function paintGuide() {
    const grid = $("tool-grade-grid");
    if (!grid || grid.dataset.ready) return;
    const tools = [
      { grade: "A", name: "Chart overlays", blurb: "Trail, cloud, BOS/CHoCH, GEX walls — core read of structure. Example: long only above trail + above gamma flip." },
      { grade: "A", name: "Whales / Big Trades", blurb: "NY-cut option magnets. Example: EURUSD spot 1.1480 with whale at 1.1500 → expect pin into 10:00 NY if within 20 pips." },
      { grade: "A", name: "Quant Academy", blurb: "In-app dossiers with schematics + lxScript. Example: RSI(2) pullback only above SMA200." },
      { grade: "B+", name: "Goldbach study (2024.02)", blurb: "PO3 dealing ranges + Goldbach wireframe (3-6-9). Overlap mean threshold with a whale strike for containment days." },
      { grade: "A−", name: "Order flow", blurb: "Footprint / CVD / profile. Example: absorption at VWAP + whale strike = higher-confidence fade." },
      { grade: "B+", name: "AGI stack", blurb: "Regime, swarm, twin, anomaly. Example: skip mean-reversion fades when Regime = high_vol." },
      { grade: "B+", name: "Journal + Replay", blurb: "Closes the loop. Example: tag whale-pin trades; replay down-weights mood=revenge." },
      { grade: "B", name: "Macro / COT / Astro", blurb: "Context layers. Example: high-impact CPI day → cut whale pin size in half." },
      { grade: "B", name: "Paper bot", blurb: "Transparent execution. Example: enable GEX filter so bot fades into put floor." },
      { grade: "B−", name: "AI desk note", blurb: "Narrative only. Example: ask for regime note after Run all — never size from prose alone." },
    ];
    grid.innerHTML = tools.map((t) => `<article class="tool-grade"><span class="grade">${esc(t.grade)}</span><h3>${esc(t.name)}</h3><p>${esc(t.blurb)}</p></article>`).join("");
    grid.dataset.ready = "1";
  }

  async function paintStudy() {
    if (!$("study-assess")) return;
    const pack = await get("/api/study");
    const g = pack.goldbach || {};
    const il = pack.investinglive_sep18 || {};
    const lit = pack.litter_study || {};
    $("study-assess").innerHTML = `
      <span class="grade-pill">Grade ${esc(g.grade)} · desk synthesis</span>
      <h3>PO3 dealing ranges × wireframe overlaps</h3>
      <p><b>Literature brief</b> · paper desk · no embedded PDF</p>
      <p>${esc(g.verdict || "Map dealing ranges, wireframe internals, then time with AMD cycles — overlap with expiry magnets for containment days.")}</p>
      <p class="kicker">Core framework</p>
      <ol>${(g.core_framework || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ol>
      <p class="kicker">FMC bridge</p>
      <ul>${(g.fmc_bridge || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
    $("study-litter").innerHTML = `
      <h3>${esc(lit.title || "Literature study")}</h3>
      <p>${esc(lit.subtitle || "")}</p>
      <p class="kicker">~${esc(String(lit.reading_time_min || 12))} min desk pass</p>
      ${(lit.sections || []).map((s) => `
        <div>
          <p class="kicker">${esc(s.heading)}</p>
          <p>${esc(s.body || "")}</p>
          ${s.quote ? `<blockquote>${esc(s.quote)}</blockquote>` : ""}
          <ul>${(s.bullets || []).map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
        </div>`).join("")}`;
    $("study-ilive").innerHTML = `
      <h3>${esc(il.title || "investingLive board")}</h3>
      <p>${esc(il.author || "")} · ${esc(il.published || "")}</p>
      <p>${esc(il.thesis || "")}</p>
      <ul>${(il.levels_called_out || []).map((x) => `<li><b>${esc(x.pair)}</b> ${esc((x.strikes || []).join(", "))} — ${esc(x.note)}</li>`).join("")}</ul>
      <blockquote>${esc(il.quote || "")}</blockquote>
      <a href="${esc(il.url || "#")}" target="_blank" rel="noopener">Source article ↗</a>
      <p class="kicker">How to use</p>
      <ol>${(il.how_to_use || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ol>`;
  }

  function bindTabsMenu() {
    const btn = $("tabs-menu-btn");
    const drawer = $("tabs-drawer");
    if (!btn || !drawer) return;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = drawer.hidden;
      drawer.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
    });
    drawer.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => { drawer.hidden = true; btn.setAttribute("aria-expanded", "false"); }));
    document.addEventListener("click", () => { drawer.hidden = true; btn.setAttribute("aria-expanded", "false"); });
    $("whale-refresh")?.addEventListener("click", async () => {
      await get("/api/whales?refresh=1");
      await paintWhales();
      toast("Whale board refreshed");
    });
    $("whale-plot")?.addEventListener("click", async () => {
      await paintWhales();
      S().layers.whales = true; S().layers.big = true;
      document.querySelectorAll('#overlay-toggles input[data-layer="whales"], #overlay-toggles input[data-layer="big"]').forEach((i) => { i.checked = true; });
      location.hash = "#chart";
      window.runAll?.({ silent: true });
      toast("Whales + Big Trades plotted on chart");
    });
  }

  /* ================================================================ auth */
  let authMode = "login";
  async function refreshAuth() {
    const me = await get("/api/auth/me").catch(() => ({}));
    const u = me.user;
    S().user = u || null;
    $("avatar-txt").textContent = u ? (u.name || u.email).slice(0, 14) : "Sign in";
    $("auth-open").classList.toggle("signed", !!u);
    $("auth-open").title = u ? `${u.email} · click to sign out` : "Sign in";
    return u;
  }
  function openAuth() { $("auth-layer").hidden = false; requestAnimationFrame(() => $("auth-layer").classList.add("show")); $("auth-email").focus(); }
  function closeAuth() { $("auth-layer").classList.remove("show"); setTimeout(() => ($("auth-layer").hidden = true), 220); }
  function bindAuth() {
    $("auth-open").addEventListener("click", async () => {
      if (S().user) { if (confirm(`Sign out ${S().user.email}?`)) { await post("/api/auth/logout", {}); await refreshAuth(); toast("Signed out"); } return; }
      openAuth();
    });
    $("auth-close").addEventListener("click", closeAuth);
    $("auth-layer").addEventListener("click", (e) => { if (e.target === $("auth-layer")) closeAuth(); });
    document.querySelectorAll(".auth-tabs button").forEach((b) => b.addEventListener("click", () => {
      authMode = b.dataset.mode;
      document.querySelectorAll(".auth-tabs button").forEach((x) => x.classList.toggle("is-on", x === b));
      $("auth-name-wrap").hidden = authMode !== "register";
      $("auth-submit").textContent = authMode === "register" ? "Create account" : "Sign in";
      $("auth-pass").autocomplete = authMode === "register" ? "new-password" : "current-password";
    }));
    $("auth-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = $("auth-error"); err.hidden = true;
      $("auth-submit").disabled = true;
      const r = await post(`/api/auth/${authMode}`, { email: $("auth-email").value, password: $("auth-pass").value, name: $("auth-name").value }).catch(() => ({ ok: false, error: "network error" }));
      $("auth-submit").disabled = false;
      if (!r.ok) { err.textContent = r.error || "failed"; err.hidden = false; $("auth-card")?.classList.add("shake"); return; }
      closeAuth();
      const u = await refreshAuth();
      toast(`Welcome, ${u.name || u.email}`);
      applyPrefs(u.prefs);
    });
  }
  function applyPrefs(p) {
    if (!p) return;
    if (p.tf && p.tf !== S().tf) { S().tf = p.tf; S().bars = TF_BARS[p.tf] || 240; document.querySelectorAll("#tf-switch button").forEach((x) => x.classList.toggle("is-on", x.dataset.tf === p.tf)); }
    if (p.symbol) { S().symbol = p.symbol; $("symbol").value = p.symbol; }
    if (Array.isArray(p.panes) && p.panes.length) multi.panes = p.panes;
    if (p.layout) setLayout(p.layout, true);
    if (typeof p.live === "boolean") {
      if (p.live !== S().live) setLive(p.live);
      else { if (p.live && !liveTimer) setLive(true, true); window.runAll?.(); }
    } else window.runAll?.();
  }
  let prefT = 0;
  function savePrefs(patch) {
    clearTimeout(prefT);
    prefT = setTimeout(() => {
      const prefs = { tf: S().tf, symbol: S().symbol, live: S().live, ...patch };
      post("/api/session", { prefs }).catch(() => {});
      if (S().user) post("/api/auth/prefs", { prefs }).catch(() => {});
    }, 400);
  }

  /* ================================================================ wiring */
  function bind() {
    $("live-toggle").addEventListener("click", () => setLive(!S().live));
    bindViewControls(); bindMulti(); bindAuth(); bindQuant(); bindTabsMenu();
    $("flow-refresh").addEventListener("click", paintFlow);
    $("macro-refresh").addEventListener("click", paintMacro);
    $("cal-week").addEventListener("change", paintMacro);
    $("cal-impact").addEventListener("change", paintMacro);
    $("hist-load").addEventListener("click", paintHistory);
    paintGuide();
    paintWhales().catch(() => {});
    paintQuant().catch(() => {});
    paintStudy().catch(() => {});
    document.addEventListener("visibilitychange", () => { if (!document.hidden && astroData) drawWheel(0); });
    // Add the live-only symbols to the market picker.
    get("/api/symbols").then((d) => {
      if (Array.isArray(d.watch) && d.watch.length) WATCH = d.watch;
      const sel = $("symbol");
      Object.entries(d.live_only || {}).forEach(([k, v]) => {
        if (![...sel.options].some((o) => o.value === k)) sel.add(new Option(`${k} · ${v.name} (live)`, k));
      });
    });
  }

  // Called by app.runAll after analysis lands. Lazy panels refresh only when the symbol/tf/source changed.
  let lastKey = "";
  function afterRun() {
    paintSourcePill();
    const key = `${S().symbol}|${S().tf}|${S().live}`;
    const changed = key !== lastKey; lastKey = key;
    paintFlow();
    paintAstro();
    paintHistory();
    paintWhales().catch(() => {});
    if (changed) { paintCot(); paintMacro(); paintModels(); }
    if (!$("multi-grid").children.length) setLayout(multi.layout, true); else if (changed) multi.panes.forEach((_, i) => loadPane(i));
  }

  window.LXDesk = { bind, afterRun, setLive, setLayout, paintFlow, paintMacro, paintCot, paintAstro, paintHistory, paintQuant, paintWhales, paintGuide, paintStudy, refreshAuth, applyPrefs, savePrefs, replayToggle, selectSymbol, get replaying() { return replay.on; } };
})();
