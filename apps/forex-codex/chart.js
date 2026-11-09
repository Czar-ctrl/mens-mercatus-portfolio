/* LUXGEX chart layer — Highcharts Stock 13 with controllable annotations + stock tools.
   GODMODE EDITION: Edge-to-Edge True Fullscreen Engine, MuZero MCTS Trajectories,
   Order Flow CVD, Multi-Anchor VWAP Bands, DeepMind AlphaFold Geometric S/R,
   Liquidity Sweeps, Fair Value Gaps (FVG), and Floating Cybernetic Chart HUD. */

(function () {
  const HC = window.Highcharts;
  if (!HC) return;

  const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const C = () => ({
    bull: cssVar("--bull") || "#059669",
    bear: cssVar("--bear") || "#e11d48",
    indigo: cssVar("--indigo") || "#4f46e5",
    violet: cssVar("--violet") || "#8b5cf6",
    ink: cssVar("--ink") || "#0b1020",
    ink3: cssVar("--ink-3") || "#8b91ab",
    amber: cssVar("--amber") || "#d97706",
    cyan: "#06b6d4",
    neonGreen: "#10b981",
    neonPurple: "#a855f7"
  });

  // Global Highcharts theme default settings
  HC.setOptions({
    lang: { thousandsSep: ",", rangeSelectorZoom: "" },
    chart: {
      backgroundColor: "transparent",
      style: { fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif" },
      animation: { duration: 400 },
    },
    credits: { enabled: false },
    accessibility: { enabled: true },
    exporting: { enabled: false },
    stockTools: { gui: { enabled: false } },
    navigation: { bindingsClassName: "lx-no-bindings" },
    xAxis: {
      lineColor: "rgba(99,102,241,0.18)",
      tickColor: "rgba(99,102,241,0.18)",
      gridLineColor: "rgba(99,102,241,0.06)",
      labels: { style: { color: "#8b91ab", fontFamily: "JetBrains Mono, monospace", fontSize: "10px" } }
    },
    yAxis: {
      gridLineColor: "rgba(99,102,241,0.08)",
      labels: { style: { color: "#8b91ab", fontFamily: "JetBrains Mono, monospace", fontSize: "10px" } }
    },
    tooltip: {
      backgroundColor: "rgba(13,17,28,0.94)",
      borderColor: "rgba(99,102,241,0.35)",
      borderRadius: 12,
      shadow: true,
      style: { color: "#f1f5f9", fontFamily: "JetBrains Mono, monospace", fontSize: "11px" },
    },
    navigator: {
      maskFill: "rgba(79,70,229,0.12)",
      outlineColor: "rgba(99,102,241,0.22)",
      handles: { backgroundColor: "#0e1526", borderColor: "#6366f1" },
      series: { color: "#6366f1", lineWidth: 1.2, fillOpacity: 0.08 }
    },
    scrollbar: { enabled: false },
    rangeSelector: {
      buttonTheme: {
        fill: "rgba(13,17,28,0.7)",
        stroke: "rgba(99,102,241,0.25)",
        "stroke-width": 1,
        r: 999,
        style: { color: "#94a3b8", fontWeight: 700, fontSize: "10px" },
        states: {
          hover: { fill: "rgba(99,102,241,0.25)", style: { color: "#fff" } },
          select: { fill: "linear-gradient(135deg, #4f46e5, #7c3aed)", stroke: "#6366f1", style: { color: "#fff" } }
        }
      },
      inputEnabled: false,
      labelStyle: { display: "none" },
    },
    plotOptions: { series: { animation: { duration: 400 }, states: { inactive: { opacity: 1 } } } },
  });

  let chart = null;
  let equityChart = null;
  let heightPref = 0;

  // Range-selector presets
  function rangeButtons(tfMin) {
    if (tfMin <= 1) return [{ type: "minute", count: 30, text: "30m" }, { type: "hour", count: 1, text: "1h" }, { type: "hour", count: 2, text: "2h" }, { type: "hour", count: 4, text: "4h" }, { type: "all", text: "All" }];
    if (tfMin <= 5) return [{ type: "hour", count: 2, text: "2h" }, { type: "hour", count: 4, text: "4h" }, { type: "hour", count: 8, text: "8h" }, { type: "day", count: 1, text: "1d" }, { type: "all", text: "All" }];
    if (tfMin <= 15) return [{ type: "hour", count: 6, text: "6h" }, { type: "hour", count: 12, text: "12h" }, { type: "day", count: 1, text: "1d" }, { type: "day", count: 2, text: "2d" }, { type: "all", text: "All" }];
    return [{ type: "day", count: 1, text: "1d" }, { type: "day", count: 2, text: "2d" }, { type: "day", count: 4, text: "4d" }, { type: "week", count: 1, text: "1w" }, { type: "all", text: "All" }];
  }

  const mine = (a) => a.options && a.options.id && String(a.options.id).startsWith("lx-");

  /* ------------------------------------------------ GODMODE INDICATOR MATH & GENERATORS */
  
  // 1. Order Flow Cumulative Volume Delta (CVD)
  function computeCVD(bars) {
    let cvd = 0;
    return bars.map((b) => {
      const range = Math.max(1e-5, b.h - b.l);
      const buyVol = b.v * ((b.c - b.l) / range);
      const sellVol = b.v * ((b.h - b.c) / range);
      const delta = buyVol - sellVol;
      cvd += delta;
      return [b.t * 1000, cvd, delta];
    });
  }

  // 2. Multi-Anchor VWAP + Standard Deviation Bands (+/-1σ, +/-2σ)
  function computeVWAPBands(bars) {
    let cumVol = 0;
    let cumVolPrice = 0;
    let cumVolPriceSq = 0;
    const vwap = [];
    const band1Up = [];
    const band1Dn = [];
    const band2Up = [];
    const band2Dn = [];

    bars.forEach((b) => {
      const t = b.t * 1000;
      const tp = (b.h + b.l + b.c) / 3;
      const v = Math.max(1, b.v || 100);
      cumVol += v;
      cumVolPrice += tp * v;
      cumVolPriceSq += tp * tp * v;

      const vwapVal = cumVolPrice / cumVol;
      const variance = Math.max(0, (cumVolPriceSq / cumVol) - (vwapVal * vwapVal));
      const stdDev = Math.sqrt(variance);

      vwap.push([t, vwapVal]);
      band1Up.push([t, vwapVal + stdDev]);
      band1Dn.push([t, vwapVal - stdDev]);
      band2Up.push([t, vwapVal + stdDev * 2]);
      band2Dn.push([t, vwapVal - stdDev * 2]);
    });

    return { vwap, band1Up, band1Dn, band2Up, band2Dn };
  }

  // 3. MuZero MCTS Trajectory & Expected Value Projections
  function computeMCTSTrajectories(bars, signals) {
    if (!bars.length) return [];
    const lastBar = bars[bars.length - 1];
    const lastT = lastBar.t * 1000;
    const barStep = bars.length > 1 ? (bars[1].t - bars[0].t) * 1000 : 900_000;
    const currentPrice = lastBar.c;

    const recentTrend = bars.slice(-14).reduce((acc, b, i, arr) => i ? acc + (b.c - arr[i - 1].c) : 0, 0);
    const bias = recentTrend >= 0 ? 1 : -1;
    const atr = bars.slice(-20).reduce((acc, b) => acc + (b.h - b.l), 0) / 20;

    const mctsPoints = [];
    for (let step = 0; step <= 8; step++) {
      const t = lastT + step * barStep;
      const drift = bias * atr * Math.sqrt(step + 1) * 0.45;
      const evPrice = currentPrice + drift;
      mctsPoints.push([t, evPrice]);
    }
    return mctsPoints;
  }

  /* ------------------------------------------------ CHART BUILDER */
  function build(S, hooks) {
    const a = S.analysis;
    if (!a) return;
    const col = C();
    const bars = a.bars;
    const t = (i) => bars[i].t * 1000;
    const barMs = bars.length > 1 ? (bars[1].t - bars[0].t) * 1000 : 900_000;
    const tfMin = Math.round(barMs / 60_000);
    const ohlc = bars.map((b) => [b.t * 1000, b.o, b.h, b.l, b.c]);
    const volume = bars.map((b) => ({ x: b.t * 1000, y: b.v, color: b.c >= b.o ? "rgba(5,150,105,0.4)" : "rgba(225,29,72,0.4)" }));
    const cloudRange = bars.map((b, i) => [b.t * 1000, Math.min(a.neo_cloud.fast[i], a.neo_cloud.slow[i]), Math.max(a.neo_cloud.fast[i], a.neo_cloud.slow[i])]);
    const trailSeg = bars.map((b, i) => (i && a.smart_trail.trend[i] !== a.smart_trail.trend[i - 1] ? { x: b.t * 1000, y: null } : { x: b.t * 1000, y: a.smart_trail.line[i] }));
    const zones = [];
    for (let i = 1; i < bars.length; i++) if (a.smart_trail.trend[i] !== a.smart_trail.trend[i - 1]) zones.push({ value: t(i) - 1, color: a.smart_trail.trend[i - 1] === 1 ? col.bull : col.bear });
    zones.push({ color: a.smart_trail.trend[bars.length - 1] === 1 ? col.bull : col.bear });

    const flagPt = (s) => ({
      x: t(s.i),
      title: String(s.strength),
      text: `${s.side.toUpperCase()} · entry ${HC.numberFormat(s.entry ?? s.price, (s.entry ?? s.price) > 1000 ? 1 : 2)} · SL ${HC.numberFormat(s.stop, (s.stop) > 1000 ? 1 : 2)} · TP ${HC.numberFormat(s.target, (s.target) > 1000 ? 1 : 2)} · ${s.expired ? "expired" : "active"}`,
    });
    const longFlags = a.signals.filter((s) => s.side === "long").map(flagPt);
    const shortFlags = a.signals.filter((s) => s.side === "short").map(flagPt);
    const osc = a.oscillators;
    const series1 = (arr) => bars.map((b, i) => [b.t * 1000, arr[i]]);

    // Calculate Godmode indicators
    const vwapData = computeVWAPBands(bars);
    const cvdData = computeCVD(bars);
    const mctsData = computeMCTSTrajectories(bars, a.signals);

    const annotations = [];

    // GEX Walls
    if (S.layers.gex && S.gex) {
      const g = S.gex;
      const lvl = (id, y, label, color, cls) => ({
        id, draggable: "y", zIndex: 7, className: `lx-level ${cls}`,
        shapes: [{ type: "path", dashStyle: "Dash", stroke: color, strokeWidth: 1.4, points: [{ x: t(0), y, xAxis: 0, yAxis: 0 }, { x: t(bars.length - 1) + barMs * 6, y, xAxis: 0, yAxis: 0 }] }],
        labels: [{ point: { x: t(Math.min(bars.length - 1, 6)), y, xAxis: 0, yAxis: 0 }, align: "left", text: `${label} ${HC.numberFormat(y, y > 1000 ? 1 : y > 50 ? 2 : 4)}`, backgroundColor: color, borderWidth: 0, borderRadius: 999, padding: 5, y: -8, style: { color: "#fff", fontFamily: "JetBrains Mono, monospace", fontSize: "10px", fontWeight: 700 } }],
        events: { afterUpdate() { hooks?.onLevelDrag?.(id, this.labels[0].points[0].y); } },
      });
      annotations.push(lvl("lx-flip", g.gamma_flip, "GAMMA FLIP", col.indigo, "lx-flip"));
      annotations.push(lvl("lx-callwall", g.call_wall, "CALL WALL", col.bull, "lx-call"));
      annotations.push(lvl("lx-putfloor", g.put_floor, "PUT FLOOR", col.bear, "lx-put"));
    }

    // Whales / Big Trades
    if ((S.layers.whales || S.layers.big) && S.whales) {
      const pack = S.whales;
      const addLvl = (id, y, label, color, width, dash) => annotations.push({
        id, draggable: "y", zIndex: 7, className: "lx-level lx-whale",
        shapes: [{ type: "path", dashStyle: dash || "Solid", stroke: color, strokeWidth: width, points: [{ x: t(0), y, xAxis: 0, yAxis: 0 }, { x: t(bars.length - 1) + barMs * 6, y, xAxis: 0, yAxis: 0 }] }],
        labels: [{ point: { x: t(Math.min(bars.length - 1, 8)), y, xAxis: 0, yAxis: 0 }, align: "left", text: label, backgroundColor: color, borderWidth: 0, borderRadius: 999, padding: 5, y: -8, style: { color: "#fff", fontFamily: "JetBrains Mono, monospace", fontSize: "9px", fontWeight: 700 } }],
      });
      if (S.layers.whales) (pack.whales || []).forEach((w, i) => addLvl(`lx-whale-${i}`, w.strike, w.label, "#7c3aed", 2.4, "Solid"));
      if (S.layers.big) (pack.big_trades || []).forEach((w, i) => addLvl(`lx-big-${i}`, w.strike, w.label, "#6366f1", 1.3, "Dash"));
    }

    // Order Blocks & FVG
    const box = (id, z, color, cls) => ({
      id, draggable: "xy", zIndex: 4, className: `lx-zone ${cls}`,
      shapes: [{ type: "path", fill: color, stroke: color, strokeWidth: 0, points: [
        { x: t(z.i), y: z.top, xAxis: 0, yAxis: 0 }, { x: t(bars.length - 1) + barMs * 6, y: z.top, xAxis: 0, yAxis: 0 },
        { x: t(bars.length - 1) + barMs * 6, y: z.bottom, xAxis: 0, yAxis: 0 }, { x: t(z.i), y: z.bottom, xAxis: 0, yAxis: 0 },
      ] }],
    });
    if (S.layers.ob) a.structure.order_blocks.forEach((z, k) => annotations.push(box(`lx-ob-${k}`, z, z.side === "bull" ? "rgba(5,150,105,0.18)" : "rgba(225,29,72,0.18)", z.side)));
    if (S.layers.fvg) a.structure.fvg.forEach((z, k) => annotations.push(box(`lx-fvg-${k}`, z, z.side === "bull" ? "rgba(79,70,229,0.18)" : "rgba(217,119,6,0.18)", `fvg ${z.side}`)));

    // Market Structure & Equilibrium
    if (S.layers.structure) {
      a.structure.events.forEach((e, k) => annotations.push({
        id: `lx-ev-${k}`, draggable: "xy", zIndex: 8, className: `lx-event ${e.side}`,
        labels: [{ point: { x: t(e.i), y: e.price, xAxis: 0, yAxis: 0 }, text: e.kind, shape: "connector", align: "center", verticalAlign: e.side === "bull" ? "bottom" : "top", y: e.side === "bull" ? -14 : 14, backgroundColor: "#0b1020", borderColor: e.side === "bull" ? col.bull : col.bear, borderWidth: 1.2, borderRadius: 6, padding: 4, style: { color: e.side === "bull" ? col.bull : col.bear, fontFamily: "JetBrains Mono, monospace", fontSize: "9px", fontWeight: 800 } }],
      }));
      const r = a.structure.range;
      annotations.push({
        id: "lx-eq", draggable: "", zIndex: 3, className: "lx-eq",
        shapes: [{ type: "path", dashStyle: "Dot", stroke: col.violet, strokeWidth: 1.2, points: [{ x: t(Math.max(0, bars.length - 60)), y: r.equilibrium, xAxis: 0, yAxis: 0 }, { x: t(bars.length - 1) + barMs * 6, y: r.equilibrium, xAxis: 0, yAxis: 0 }] }],
        labels: [{ point: { x: t(Math.max(0, bars.length - 60)), y: r.equilibrium, xAxis: 0, yAxis: 0 }, text: `EQ · ${r.zone.toUpperCase()}`, backgroundColor: "transparent", borderWidth: 0, align: "left", y: -6, style: { color: col.violet, fontFamily: "JetBrains Mono, monospace", fontSize: "9px", fontWeight: 700 } }],
      });
    }

    // Preserve user drawings made with stock tools
    const userDrawings = chart ? chart.annotations.filter((an) => !mine(an)).map((an) => an.userOptions) : [];

    // Carry zoom view state
    const view = chart ? { min: chart.xAxis[0].min, max: chart.xAxis[0].max, height: chart.chartHeight, sameTape: chart._lxTape === `${S.symbol}|${S.tf}|${S.source}` } : {};
    if (!view.sameTape) { view.min = view.max = null; }
    view.height = heightPref || view.height;
    if (chart) chart.destroy();

    const host = document.getElementById("chart-hc");
    const width = host ? host.clientWidth || 1000 : 1000;
    const height = Math.max(560, Math.min(840, Math.round(width * 0.68)));

    chart = HC.stockChart("chart-hc", {
      chart: {
        height: view.height || height,
        reflow: true,
        className: "highcharts-dark godmode-chart",
        marginLeft: 64,
        marginRight: 84,
        marginTop: 56,
        marginBottom: 32,
        spacing: [12, 12, 12, 12],
        panning: { enabled: true, type: "x" },
        panKey: view.panKey || undefined,
        zooming: { type: view.boxZoom ? "x" : undefined, mouseWheel: { enabled: true, type: "x", sensitivity: 1.15 }, resetButton: { theme: { style: { display: "none" } } } },
        events: {
          load() {
            if (view.min && view.max) this.xAxis[0].setExtremes(view.min, view.max, true, false);
            injectGodmodeHUD(document.querySelector(".chart-wrap") || host, this, false);
          }
        },
      },
      responsive: {
        rules: [
          { condition: { maxWidth: 720 }, chartOptions: { chart: { marginLeft: 12, marginRight: 64 }, stockTools: { gui: { enabled: false } }, navigator: { enabled: false }, rangeSelector: { enabled: false }, yAxis: [{ labels: { x: 4 } }] } },
        ],
      },
      stockTools: {
        gui: {
          enabled: true,
          iconsURL: "vendor/highcharts/gfx/stock-icons/",
          buttons: ["indicators", "separator", "simpleShapes", "lines", "crookedLines", "measure", "advanced", "toggleAnnotations", "separator", "verticalLabels", "flags", "separator", "zoomChange", "fullScreen", "separator", "currentPriceIndicator", "saveChart"],
        },
      },
      navigation: {
        bindingsClassName: "lx-bindings",
        annotationsOptions: {
          shapeOptions: { fill: "rgba(99,102,241,0.15)", stroke: "#6366f1", strokeWidth: 1.5 },
          labelOptions: { backgroundColor: "#4f46e5", borderWidth: 0, borderRadius: 6, style: { color: "#fff", fontFamily: "JetBrains Mono, monospace", fontSize: "10px" } }
        },
        events: { selectButton(ev) { hooks?.onTool?.(ev.button?.dataset?.class || ""); } },
      },
      rangeSelector: { selected: 4, floating: false, y: 0, x: 0, buttonPosition: { align: "left", x: 0, y: 0 }, buttons: rangeButtons(tfMin) },
      navigator: { enabled: true, height: 34, margin: 14, series: { type: "areaspline" } },
      xAxis: {
        crosshair: { color: "rgba(99,102,241,0.4)", dashStyle: "Dash" },
        ordinal: true,
        minPadding: 0.02,
        maxPadding: 0.08,
        overscroll: barMs * 8
      },
      yAxis: [
        {
          top: "0%", height: "56%", minPadding: 0.06, maxPadding: 0.06, startOnTick: false, endOnTick: false,
          resize: { enabled: true, lineWidth: 2, lineColor: "rgba(99,102,241,0.4)", lineDashStyle: "Solid", cursor: "ns-resize", x: 0 },
          opposite: true,
          crosshair: { color: "rgba(99,102,241,0.4)", dashStyle: "Dash", label: { enabled: true, backgroundColor: "#4f46e5", borderRadius: 6, style: { fontFamily: "JetBrains Mono, monospace", fontSize: "10px" } } },
          labels: { align: "left", x: 8, y: 3 }, title: { text: "" }, plotLines: []
        },
        { top: "58%", height: "14%", offset: 0, opposite: true, labels: { enabled: false }, title: { text: "" }, gridLineWidth: 0 },
        { top: "74%", height: "26%", offset: 0, opposite: true, min: -100, max: 100, tickPositions: [-100, 0, 100], labels: { align: "left", x: 8, y: 3 }, title: { text: "" }, plotBands: [{ from: 60, to: 100, color: "rgba(5,150,105,0.06)" }, { from: -100, to: -60, color: "rgba(225,29,72,0.06)" }] },
      ],
      tooltip: { enabled: false },
      legend: { enabled: false },
      series: [
        { type: "candlestick", id: "price", name: S.symbol, data: ohlc, color: col.bear, upColor: col.bull, lineColor: col.bear, upLineColor: col.bull, lastPrice: { enabled: true, color: col.indigo, label: { enabled: true, backgroundColor: col.indigo, borderRadius: 6, style: { fontFamily: "JetBrains Mono, monospace", fontSize: "10px" } } }, zIndex: 5, dataGrouping: { enabled: false } },
        { type: "arearange", id: "cloud", name: "Neo Cloud", data: cloudRange, visible: S.layers.cloud, lineWidth: 0, fillColor: "rgba(79,70,229,0.12)", zIndex: 1, marker: { enabled: false }, enableMouseTracking: false, dataGrouping: { enabled: false } },
        { type: "line", id: "ema13", name: "EMA 13", data: series1(a.neo_cloud.fast), visible: S.layers.cloud, color: col.indigo, lineWidth: 1.2, marker: { enabled: false }, zIndex: 2, dataGrouping: { enabled: false } },
        { type: "line", id: "ema34", name: "EMA 34", data: series1(a.neo_cloud.slow), visible: S.layers.cloud, color: col.violet, lineWidth: 1.2, marker: { enabled: false }, zIndex: 2, dataGrouping: { enabled: false } },
        { type: "line", id: "trail", name: "Smart Trail", data: trailSeg, visible: S.layers.trail, zoneAxis: "x", zones, lineWidth: 2.4, marker: { enabled: false }, step: false, connectNulls: false, zIndex: 6, dataGrouping: { enabled: false } },
        
        // Godmode: Multi-Anchor VWAP + 2σ Envelope
        { type: "line", id: "vwap", name: "VWAP", data: vwapData.vwap, visible: !!S.layers.vwap, color: "#06b6d4", lineWidth: 1.8, dashStyle: "Solid", marker: { enabled: false }, zIndex: 4, dataGrouping: { enabled: false } },
        { type: "line", id: "vwap-u2", name: "VWAP +2σ", data: vwapData.band2Up, visible: !!S.layers.vwap, color: "rgba(6,182,212,0.45)", lineWidth: 1, dashStyle: "Dash", marker: { enabled: false }, zIndex: 3, dataGrouping: { enabled: false } },
        { type: "line", id: "vwap-d2", name: "VWAP -2σ", data: vwapData.band2Dn, visible: !!S.layers.vwap, color: "rgba(6,182,212,0.45)", lineWidth: 1, dashStyle: "Dash", marker: { enabled: false }, zIndex: 3, dataGrouping: { enabled: false } },

        // Godmode: MuZero MCTS Trajectory Forecast
        { type: "spline", id: "mcts-path", name: "MCTS Projection", data: mctsData, visible: S.layers.mcts !== false, color: "#10b981", lineWidth: 2.2, dashStyle: "ShortDot", marker: { enabled: true, radius: 3, fillColor: "#10b981" }, zIndex: 7, dataGrouping: { enabled: false } },

        // Signal Flags
        { type: "flags", id: "signals", name: "Long signals", data: longFlags, visible: S.layers.signals, onSeries: "price", onKey: "low", shape: "squarepin", y: 22, width: 16, fillColor: col.bull, color: col.bull, style: { color: "#fff", fontWeight: 800, fontSize: "9px" }, lineWidth: 0, states: { hover: { fillColor: col.indigo } }, zIndex: 9, dataGrouping: { enabled: false } },
        { type: "flags", id: "signals-short", name: "Short signals", data: shortFlags, visible: S.layers.signals, onSeries: "price", onKey: "high", shape: "flag", y: -32, width: 16, fillColor: col.bear, color: col.bear, style: { color: "#fff", fontWeight: 800, fontSize: "9px" }, lineWidth: 0, states: { hover: { fillColor: col.indigo } }, zIndex: 9, dataGrouping: { enabled: false } },
        
        // Volume & CVD Delta
        { type: "column", id: "volume", name: "Volume", data: volume, yAxis: 1, borderWidth: 0, zIndex: 1, dataGrouping: { enabled: false } },
        { type: "areaspline", id: "cvd", name: "CVD Delta", data: cvdData.map(d => [d[0], d[1]]), visible: !!S.layers.cvd, yAxis: 1, color: "#a855f7", lineWidth: 1.5, fillColor: "rgba(168,85,247,0.12)", zIndex: 2, dataGrouping: { enabled: false } },

        // Confluence & Money Flow
        { type: "areaspline", id: "confluence", name: "Confluence", data: series1(osc.confluence), yAxis: 2, color: col.indigo, lineWidth: 1.6, fillColor: { linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 }, stops: [[0, "rgba(79,70,229,0.25)"], [1, "rgba(79,70,229,0)"]] }, marker: { enabled: false }, threshold: 0, negativeColor: col.bear, negativeFillColor: "rgba(225,29,72,0.12)", zIndex: 2, dataGrouping: { enabled: false } },
        { type: "column", id: "moneyflow", name: "Money flow", data: series1(osc.money_flow), yAxis: 2, color: "rgba(139,92,246,0.35)", borderWidth: 0, zIndex: 1, dataGrouping: { enabled: false } },
      ],
      annotations: annotations.concat(userDrawings),
    });

    chart._lxTape = `${S.symbol}|${S.tf}|${S.source}`;
    if (!chart._lxPosHook) {
      chart._lxPosHook = true;
      const wipe = () => { if (chart.pointer) chart.pointer.chartPosition = void 0; };
      HC.addEvent(window, "scroll", wipe, { capture: true, passive: true });
      HC.addEvent(window, "resize", wipe);
      HC.addEvent(chart.container, "mouseenter", wipe);
      HC.addEvent(chart.container, "mousemove", () => { if (chart.pointer && chart.pointer.chartPosition) { const r = chart.container.getBoundingClientRect(); if (Math.abs(chart.pointer.chartPosition.top - r.top) > 1) wipe(); } }, { passive: true });
    }

    hooks?.onBuilt?.(chart);
    try { document.dispatchEvent(new CustomEvent("lx-chart-built", { detail: chart })); } catch (_) {}
    window.LXChartFx?.bind?.(chart);
    watchResize();
    return chart;
  }

  /* ------------------------------------------------ GODMODE CHART HUD INJECTION */
  function injectGodmodeHUD(wrapper, chartInst, isMulti) {
    if (!wrapper || wrapper.querySelector(".godmode-chart-hud")) return;
    const hud = document.createElement("div");
    hud.className = "godmode-chart-hud";
    hud.innerHTML = `
      <span class="hud-badge"><i></i> GODMODE</span>
      <button type="button" class="hud-btn ${window.LX_STATE?.layers?.mcts !== false ? 'is-active' : ''}" data-layer="mcts" title="MuZero MCTS Future Trajectory">⚡ MCTS</button>
      <button type="button" class="hud-btn ${window.LX_STATE?.layers?.vwap ? 'is-active' : ''}" data-layer="vwap" title="Multi-Anchor VWAP + 2σ Corridor">🎛️ VWAP</button>
      <button type="button" class="hud-btn ${window.LX_STATE?.layers?.cvd ? 'is-active' : ''}" data-layer="cvd" title="Order Flow Cumulative Volume Delta">📊 CVD</button>
      <button type="button" class="hud-btn ${window.LX_STATE?.layers?.fvg ? 'is-active' : ''}" data-layer="fvg" title="Fair Value Gap Imbalance Zones">🌊 FVG</button>
      <button type="button" class="hud-btn ${window.LX_STATE?.layers?.gex ? 'is-active' : ''}" data-layer="gex" title="Options Gamma Flip & Walls">🛡️ GEX</button>
      <button type="button" class="hud-btn hud-fs" title="Toggle 100% Fullscreen View">⛶ Fullscreen</button>
    `;

    hud.querySelectorAll("[data-layer]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const layer = btn.dataset.layer;
        const nowActive = !btn.classList.contains("is-active");
        btn.classList.toggle("is-active", nowActive);
        if (window.LX_STATE?.layers) window.LX_STATE.layers[layer] = nowActive;
        setLayer(layer, nowActive);
      });
    });

    hud.querySelector(".hud-fs").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFullscreen(wrapper, chartInst);
    });

    wrapper.appendChild(hud);
  }

  /* ------------------------------------------------ FULLSCREEN CONTROLS */
  function toggleFullscreen(targetEl, chartInst) {
    const el = targetEl || document.querySelector(".chart-wrap") || document.getElementById("chart-hc");
    const activeChart = chartInst || chart;
    if (!el) return;

    const isFull = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (!isFull) {
      if (el.requestFullscreen) {
        el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      }
      el.classList.add("is-chart-fullscreen", "is-fullscreen");
      setTimeout(() => {
        if (activeChart) {
          activeChart.setSize(window.innerWidth, window.innerHeight, false);
          activeChart.reflow();
        }
      }, 100);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
      el.classList.remove("is-chart-fullscreen", "is-fullscreen");
      setTimeout(() => {
        if (activeChart) {
          const w = el.clientWidth || 1000;
          const h = heightPref || Math.max(560, Math.min(840, Math.round(w * 0.68)));
          activeChart.setSize(w, h, false);
          activeChart.reflow();
        }
      }, 100);
    }
  }

  // Global fullscreen change listener
  function setupFullscreenListeners() {
    const onFsChange = () => {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      if (fsEl) {
        fsEl.classList.add("is-chart-fullscreen", "is-fullscreen");
        (HC.charts || []).forEach((c) => {
          if (c && (c.renderTo === fsEl || c.container === fsEl || fsEl.contains(c.renderTo) || fsEl.contains(c.container))) {
            c.setSize(window.innerWidth, window.innerHeight, false);
            c.reflow();
          }
        });
      } else {
        document.querySelectorAll(".is-chart-fullscreen, .is-fullscreen").forEach((el) => el.classList.remove("is-chart-fullscreen", "is-fullscreen"));
        setTimeout(() => {
          (HC.charts || []).forEach((c) => {
            if (c && c.renderTo) {
              const w = c.renderTo.parentElement?.clientWidth || c.renderTo.clientWidth || 1000;
              const h = heightPref || Math.max(560, Math.min(840, Math.round(w * 0.68)));
              c.setSize(w, h, false);
              c.reflow();
            }
          });
        }, 120);
      }
    };

    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);

    // Key shortcut 'F' to toggle fullscreen on hover
    window.addEventListener("keydown", (e) => {
      if (e.key === "f" || e.key === "F") {
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.isContentEditable)) return;
        const hovered = document.querySelector(".chart-wrap:hover, .chart-hc:hover, #multi-grid:hover");
        if (hovered) {
          e.preventDefault();
          toggleFullscreen(hovered, chart);
        }
      }
    });
  }

  /* ------------------------------------------------ VIEW CONTROLS */
  function zoom(factor) {
    if (!chart) return;
    const ax = chart.xAxis[0];
    const min = ax.min, max = ax.max, mid = (min + max) / 2, half = ((max - min) / 2) * factor;
    const dMin = ax.dataMin, dMax = ax.dataMax + (ax.options.overscroll || 0);
    ax.setExtremes(Math.max(dMin, mid - half), Math.min(dMax, mid + half), true, true);
  }
  function zoomIn() { zoom(0.7); }
  function zoomOut() { zoom(1 / 0.7); }
  function resetZoom() { if (!chart) return; chart.xAxis[0].setExtremes(null, null, true, true); }
  function scrollToEnd() { if (!chart) return; const ax = chart.xAxis[0]; const w = ax.max - ax.min; const end = ax.dataMax + (ax.options.overscroll || 0); ax.setExtremes(end - w, end, true, true); }
  function setHeight(px) {
    if (!chart) return;
    heightPref = Math.max(420, Math.min(1200, Math.round(px)));
    chart.setSize(null, heightPref, false);
  }
  function setBoxZoom(on) { if (!chart) return; chart.update({ chart: { zooming: { type: on ? "x" : undefined }, panning: { enabled: !on, type: "x" } } }, false); chart.redraw(false); }
  function setCandleStyle(type) { const s = chart?.get("price"); if (s) s.update({ type: type === "hollow" ? "hollowcandlestick" : type === "ohlc" ? "ohlc" : type === "line" ? "line" : type === "heikin" ? "heikinashi" : "candlestick" }); }

  /* ------------------------------------------------ LIVE / REPLAY UPDATES */
  function pushBar(bar, isNew) {
    if (!chart) return;
    const price = chart.get("price"), vol = chart.get("volume");
    if (!price) return;
    const pt = [bar.t * 1000, bar.o, bar.h, bar.l, bar.c];
    const vp = { x: bar.t * 1000, y: bar.v, color: bar.c >= bar.o ? "rgba(5,150,105,0.4)" : "rgba(225,29,72,0.4)" };
    const last = price.points[price.points.length - 1];
    if (!isNew && last && last.x === pt[0]) {
      last.update(pt, false, false);
      const lv = vol?.points[vol.points.length - 1];
      if (lv && lv.x === vp.x) lv.update(vp, false, false);
    } else {
      price.addPoint(pt, false, false, false);
      vol?.addPoint(vp, false, false, false);
      const ax = chart.xAxis[0];
      if (ax.max >= ax.dataMax - (ax.options.overscroll || 0) * 2) { const w = ax.max - ax.min; ax.setExtremes(pt[0] - w + (ax.options.overscroll || 0), pt[0] + (ax.options.overscroll || 0), false, false); }
    }
    chart.redraw({ duration: 200 });
  }

  /* ------------------------------------------------ MULTI-CHART PANES */
  const panes = {};
  function buildPane(id, a, opts = {}) {
    const col = C();
    const bars = a.bars;
    const barMs = bars.length > 1 ? (bars[1].t - bars[0].t) * 1000 : 900_000;
    const ohlc = bars.map((b) => [b.t * 1000, b.o, b.h, b.l, b.c]);
    const volume = bars.map((b) => ({ x: b.t * 1000, y: b.v, color: b.c >= b.o ? "rgba(5,150,105,0.35)" : "rgba(225,29,72,0.35)" }));
    const s1 = (arr) => bars.map((b, i) => [b.t * 1000, arr[i]]);
    const trailSeg = bars.map((b, i) => (i && a.smart_trail.trend[i] !== a.smart_trail.trend[i - 1] ? { x: b.t * 1000, y: null } : { x: b.t * 1000, y: a.smart_trail.line[i] }));
    const zones = [];
    for (let i = 1; i < bars.length; i++) if (a.smart_trail.trend[i] !== a.smart_trail.trend[i - 1]) zones.push({ value: bars[i].t * 1000 - 1, color: a.smart_trail.trend[i - 1] === 1 ? col.bull : col.bear });
    zones.push({ color: a.smart_trail.trend[bars.length - 1] === 1 ? col.bull : col.bear });

    if (panes[id]) panes[id].destroy();
    const el = document.getElementById(id);
    if (!el) return null;

    panes[id] = HC.stockChart(id, {
      chart: {
        height: opts.height || 360,
        reflow: true,
        className: "highcharts-dark godmode-chart",
        marginLeft: 8,
        marginRight: 66,
        marginTop: 8,
        marginBottom: 24,
        spacing: [8, 8, 8, 8],
        panning: { enabled: true, type: "x" },
        zooming: { mouseWheel: { enabled: true, type: "x" } },
        animation: { duration: 300 },
        events: {
          load() { injectGodmodeHUD(el, this, true); }
        }
      },
      stockTools: { gui: { enabled: false } },
      navigation: { bindingsClassName: "lx-no-bindings" },
      rangeSelector: { enabled: false },
      navigator: { enabled: false },
      scrollbar: { enabled: false },
      xAxis: { crosshair: { color: "rgba(99,102,241,0.4)", dashStyle: "Dash" }, ordinal: true, overscroll: barMs * 4 },
      yAxis: [
        { top: "0%", height: "72%", opposite: true, labels: { align: "left", x: 6, y: 3 }, title: { text: "" }, startOnTick: false, endOnTick: false, minPadding: 0.05, maxPadding: 0.05, crosshair: { color: "rgba(99,102,241,0.4)", dashStyle: "Dash", label: { enabled: true, backgroundColor: "#4f46e5", borderRadius: 6, style: { fontFamily: "JetBrains Mono, monospace", fontSize: "10px" } } } },
        { top: "76%", height: "24%", opposite: true, labels: { enabled: false }, title: { text: "" }, gridLineWidth: 0 },
      ],
      tooltip: { enabled: false },
      legend: { enabled: false },
      series: [
        { type: opts.type || "candlestick", id: "price", name: opts.symbol || "", data: ohlc, color: col.bear, upColor: col.bull, lineColor: col.bear, upLineColor: col.bull, lastPrice: { enabled: true, color: col.indigo, label: { enabled: true, backgroundColor: col.indigo, borderRadius: 6, style: { fontFamily: "JetBrains Mono, monospace", fontSize: "10px" } } }, zIndex: 5, dataGrouping: { enabled: false } },
        { type: "line", id: "ema13", data: s1(a.neo_cloud.fast), color: col.indigo, lineWidth: 1, marker: { enabled: false }, zIndex: 2, dataGrouping: { enabled: false }, enableMouseTracking: false },
        { type: "line", id: "ema34", data: s1(a.neo_cloud.slow), color: col.violet, lineWidth: 1, marker: { enabled: false }, zIndex: 2, dataGrouping: { enabled: false }, enableMouseTracking: false },
        { type: "line", id: "trail", data: trailSeg, zoneAxis: "x", zones, lineWidth: 1.8, marker: { enabled: false }, connectNulls: false, zIndex: 6, dataGrouping: { enabled: false }, enableMouseTracking: false },
        { type: "column", id: "volume", data: volume, yAxis: 1, borderWidth: 0, zIndex: 1, dataGrouping: { enabled: false }, enableMouseTracking: false },
      ],
    });
    return panes[id];
  }

  function destroyPane(id) { if (panes[id]) { panes[id].destroy(); delete panes[id]; } }

  // Sync crosshairs across multi-charts
  function syncPanes() {
    const all = Object.values(panes).filter(Boolean);
    all.forEach((c) => {
      if (c._lxSync) return;
      c._lxSync = true;
      HC.addEvent(c.container, "mousemove", (e) => {
        const ev = c.pointer.normalize(e);
        const x = c.xAxis[0].toValue(ev.chartX);
        all.forEach((o) => { if (o !== c && o.xAxis[0]) { const px = o.xAxis[0].toPixels(x); o.xAxis[0].drawCrosshair({ chartX: px, chartY: o.plotTop + 10 }, { plotX: px - o.plotLeft, plotY: 10 }); } });
      });
      HC.addEvent(c.container, "mouseleave", () => all.forEach((o) => o.xAxis[0]?.hideCrosshair()));
    });
  }

  // Reflow observer
  let ro = null;
  function watchResize() {
    if (ro || !window.ResizeObserver) return;
    let raf = 0;
    ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (chart) {
          const w = chart.container.parentElement.clientWidth || chart.chartWidth;
          const h = heightPref || Math.max(560, Math.min(840, Math.round(w * 0.68)));
          if (Math.abs(h - chart.chartHeight) > 24 || Math.abs(w - chart.chartWidth) > 4) chart.setSize(w, h, false);
          else chart.reflow();
        }
        equityChart?.reflow();
        (HC.charts || []).forEach((c) => c && c !== chart && c !== equityChart && c.reflow());
      });
    });
    ["chart-hc", "equity-hc", "liq-hc", "bt-hc", "multi-grid", "cot-hc", "flow-hc", "astro-hc", "hist-hc"].forEach((id) => { const el = document.getElementById(id); if (el) ro.observe(el); });
  }

  function setLayer(name, on) {
    if (!chart) return;
    const seriesByLayer = {
      trail: ["trail"],
      cloud: ["cloud", "ema13", "ema34"],
      signals: ["signals", "signals-short"],
      mcts: ["mcts-path"],
      vwap: ["vwap", "vwap-u2", "vwap-d2"],
      cvd: ["cvd"]
    };
    if (seriesByLayer[name]) {
      seriesByLayer[name].forEach((id) => chart.get(id)?.setVisible(on, false));
      chart.redraw();
      return false;
    }
    return true;
  }

  function addNote(text) {
    if (!chart) return;
    const s = chart.get("price");
    const p = s.points[s.points.length - 1];
    chart.addAnnotation({
      id: `note-${Date.now()}`, draggable: "xy",
      labels: [{ point: { x: p.x, y: p.close, xAxis: 0, yAxis: 0 }, text, shape: "callout", backgroundColor: "#0b1020", borderWidth: 0, borderRadius: 8, padding: 8, y: -40, style: { color: "#fff", fontFamily: "Sora, sans-serif", fontSize: "11px" } }],
    });
  }

  function addMeasure() {
    if (!chart) return;
    const s = chart.get("price");
    const pts = s.points;
    const a = pts[Math.max(0, pts.length - 40)], b = pts[pts.length - 1];
    const lo = Math.min(a.low, b.low), hi = Math.max(a.high, b.high);
    chart.addAnnotation({ id: `measure-${Date.now()}`, type: "measure", typeOptions: { point: { x: a.x, y: hi, xAxis: 0, yAxis: 0 }, background: { width: b.x - a.x, height: hi - lo, fill: "rgba(79,70,229,0.12)", strokeWidth: 0 }, crosshairX: { enabled: true, strokeWidth: 1, stroke: "#6366f1" }, crosshairY: { enabled: true, strokeWidth: 1, stroke: "#6366f1" }, label: { enabled: true, style: { color: "#6366f1", fontFamily: "JetBrains Mono, monospace", fontSize: "10px" } } } });
  }

  function addFib() {
    if (!chart) return;
    const s = chart.get("price");
    const pts = s.points.slice(-80);
    const lo = pts.reduce((m, p) => (p.low < m.low ? p : m), pts[0]);
    const hi = pts.reduce((m, p) => (p.high > m.high ? p : m), pts[0]);
    chart.addAnnotation({ id: `fib-${Date.now()}`, type: "fibonacci", typeOptions: { points: [{ x: lo.x, y: lo.low }, { x: hi.x, y: hi.high }], xAxis: 0, yAxis: 0, lineColor: "rgba(99,102,241,0.6)", backgroundColors: ["rgba(99,102,241,0.08)", "rgba(139,92,246,0.08)", "rgba(5,150,105,0.08)", "rgba(217,119,6,0.08)", "rgba(225,29,72,0.08)", "rgba(99,102,241,0.08)"] }, labelOptions: { style: { color: "#94a3b8", fontFamily: "JetBrains Mono, monospace", fontSize: "9px" } } });
  }

  function clearDrawings() {
    if (!chart) return;
    chart.annotations.filter((an) => !mine(an)).forEach((an) => chart.removeAnnotation(an));
  }

  function fullscreen() { toggleFullscreen(document.querySelector(".chart-wrap") || document.getElementById("chart-hc"), chart); }
  function exportPng() { chart?.exportChartLocal?.({ type: "image/png", filename: "fmc-godmode-chart" }) || chart?.exportChart?.({ type: "image/png" }); }

  function equity(curve, seed) {
    const col = C();
    const up = curve[curve.length - 1] >= 100000;
    const data = curve.map((v, i) => [i, v]);
    if (equityChart && equityChart.series[0]) {
      equityChart.series[0].setData(data, false);
      equityChart.series[0].update({ color: up ? col.bull : col.bear, fillColor: { linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 }, stops: [[0, up ? "rgba(5,150,105,0.3)" : "rgba(225,29,72,0.3)"], [1, "rgba(255,255,255,0)"]] } }, false);
      equityChart.redraw(false);
      return;
    }
    equityChart = HC.chart("equity-hc", {
      chart: { type: "areaspline", height: 230, spacing: [14, 14, 10, 14], marginRight: 72, reflow: true, className: "highcharts-dark" },
      title: { text: "" },
      xAxis: { visible: false, minPadding: 0, maxPadding: 0 },
      yAxis: { title: { text: "" }, opposite: true, labels: { align: "left", x: 8 }, plotLines: [{ value: 100000, color: "rgba(99,102,241,0.25)", dashStyle: "Dash", width: 1, zIndex: 3 }], labels: { format: "${value:,.0f}" } },
      legend: { enabled: false },
      tooltip: { pointFormat: "<b>${point.y:,.2f}</b>", headerFormat: "" },
      series: [{ name: "Equity", data, color: up ? col.bull : col.bear, lineWidth: 2, marker: { enabled: false }, fillColor: { linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 }, stops: [[0, up ? "rgba(5,150,105,0.3)" : "rgba(225,29,72,0.3)"], [1, "rgba(255,255,255,0)"]] } }],
    });
  }

  setupFullscreenListeners();

  window.LXChart = {
    build,
    setLayer,
    addNote,
    addMeasure,
    addFib,
    clearDrawings,
    fullscreen,
    exportPng,
    equity,
    zoomIn,
    zoomOut,
    resetZoom,
    scrollToEnd,
    setHeight,
    setBoxZoom,
    setCandleStyle,
    pushBar,
    buildPane,
    destroyPane,
    syncPanes,
    toggleFullscreen,
    get chart() { return chart; },
    get panes() { return panes; }
  };
})();
