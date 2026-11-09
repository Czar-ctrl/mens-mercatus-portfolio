/* LUXGEX terminal systems — Super Search, Object Tree, Indicator marketplace,
   lxScript editor (Web Worker + backtest + Live Lens), Liquidation heatmap, Monitor mode.
   Shape borrowed from the Openmarket/Kiyotaka terminal; every engine here is local. */

(function () {
  const $ = (id) => document.getElementById(id);
  const HC = window.Highcharts;
  const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const fmtP = (x) => Number(x).toLocaleString(undefined, { maximumFractionDigits: x > 1000 ? 1 : x > 50 ? 2 : 4 });
  const post = (p, b) => fetch(p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.json());
  const get = (p) => fetch(p).then((r) => r.json());
  const T = { catalog: [], templates: [], worker: null, lastScript: null, btChart: null, liqChart: null, monitors: [] };
  const ctx = () => window.LX_STATE || {};
  const toast = (m) => window.LX_TOAST?.(m);

  /* ------------------------------------------------------- super search */
  function openSearch() { $("search-layer").hidden = false; setTimeout(() => $("search-input").focus(), 20); }
  function closeSearch() { $("search-layer").hidden = true; }
  let searchTimer = 0;
  async function runSearch(q) {
    const S = ctx();
    if (!q.trim()) { $("search-results").innerHTML = ""; return; }
    $("search-results").innerHTML = `<div class="search-loading">Scanning engines…</div>`;
    const out = await post("/api/search", { query: q, symbol: S.symbol, seed: S.seed, n: S.bars, tf: S.tf, gex: S.gex, ml: S.ml });
    $("search-results").innerHTML = (out.cards || []).map((c, i) => `
      <button class="search-card" data-target="${c.target || ""}" style="animation-delay:${i * 40}ms">
        <span class="rank">${i + 1}</span>
        <span class="body"><strong>${c.title}</strong><span>${c.body}</span><em>${c.source}</em></span>
        <span class="go">↵</span>
      </button>`).join("") || `<div class="search-loading">No matching engine.</div>`;
    $("search-results").querySelectorAll(".search-card").forEach((b) => b.addEventListener("click", () => { closeSearch(); const t = b.dataset.target; if (t) document.querySelector(t)?.scrollIntoView({ behavior: "smooth", block: "start" }); }));
  }
  function bindSearch() {
    $("search-open").addEventListener("click", openSearch);
    $("search-layer").addEventListener("click", (e) => { if (e.target === $("search-layer")) closeSearch(); });
    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); $("search-layer").hidden ? openSearch() : closeSearch(); }
      if (e.key === "Escape") closeSearch();
    });
    $("search-input").addEventListener("input", (e) => { clearTimeout(searchTimer); searchTimer = setTimeout(() => runSearch(e.target.value), 260); });
    $("search-input").addEventListener("keydown", (e) => { if (e.key === "Enter") { const first = $("search-results").querySelector(".search-card"); first?.click(); } });
    document.querySelectorAll(".search-chips button").forEach((b) => b.addEventListener("click", () => { $("search-input").value = b.dataset.q; runSearch(b.dataset.q); }));
  }

  /* -------------------------------------------------------- object tree */
  function refreshTree() {
    const chart = window.LXChart?.chart;
    const list = $("tree-list");
    if (!chart) { list.innerHTML = ""; return; }
    const items = [];
    chart.series.filter((s) => !s.options.isInternal && s.options.id !== "navigator" && !s.baseSeries?.options?.id?.includes("navigator")).forEach((s) => {
      if (s.options.className === "highcharts-navigator-series" || /^Navigator/.test(s.name || "")) return;
      items.push({ kind: s.options.type === "candlestick" ? "price" : s.options.type === "flags" ? "signals" : "series", label: s.name, id: s.options.id || s.index, visible: s.visible, ref: s, type: "series" });
    });
    chart.annotations.forEach((an) => {
      const id = String(an.options.id || "");
      const label = an.options.labels?.[0]?.text?.replace(/<[^>]+>/g, "") || an.options.type || (id.startsWith("lx-ob") ? "Order block" : id.startsWith("lx-fvg") ? "FVG" : id.startsWith("lx-ev") ? "Structure" : "Drawing");
      items.push({ kind: id.startsWith("lx-") ? "auto" : "drawing", label: `${label}`.slice(0, 26), id, visible: an.options.visible !== false, ref: an, type: "annotation" });
    });
    $("tree-count").textContent = `${items.length} objects`;
    list.innerHTML = items.map((it, i) => `
      <li class="tree-item ${it.visible ? "" : "off"} k-${it.kind}" data-i="${i}">
        <span class="dot"></span>
        <span class="lbl" title="${it.id}">${it.label}</span>
        <span class="acts">
          <button data-act="eye" title="Toggle visibility">${it.visible ? "◉" : "◌"}</button>
          ${it.type === "annotation" ? `<button data-act="up" title="Bring forward">↑</button><button data-act="del" title="Remove">✕</button>` : ""}
        </span>
      </li>`).join("");
    list.querySelectorAll(".tree-item button").forEach((b) => b.addEventListener("click", () => {
      const it = items[+b.closest(".tree-item").dataset.i];
      const act = b.dataset.act;
      if (act === "eye") {
        if (it.type === "series") it.ref.setVisible(!it.ref.visible);
        else it.ref.update({ visible: it.ref.options.visible === false });
      } else if (act === "del") chart.removeAnnotation(it.ref);
      else if (act === "up") it.ref.update({ zIndex: (it.ref.options.zIndex || 6) + 1 });
      refreshTree();
    }));
  }

  /* ------------------------------------------------ indicator marketplace */
  function paintMarket(filter = "") {
    const q = filter.toLowerCase();
    const rows = T.catalog.filter((c) => !q || c.name.toLowerCase().includes(q) || c.tags.some((t) => t.includes(q)) || c.type.includes(q)).sort((a, b) => b.score - a.score);
    $("ind-list").innerHTML = rows.map((c) => `
      <li class="ind-item"><span class="ind-name">${c.name}<em>${c.tags.join(" · ")}</em></span><span class="ind-score">★ ${c.score.toFixed(1)}</span><button class="btn small primary" data-type="${c.type}">Add</button></li>`).join("");
    $("ind-list").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => addIndicator(b.dataset.type)));
  }
  let paneCount = 0;
  function addIndicator(type) {
    const chart = window.LXChart?.chart;
    const meta = T.catalog.find((c) => c.type === type);
    if (!chart || !meta) return;
    const col = [cssVar("--indigo"), cssVar("--violet"), cssVar("--amber"), "#0ea5e9", "#db2777"][paneCount % 5];
    const opts = { type, linkedTo: "price", id: `ind-${type}-${Date.now()}`, name: meta.name, params: meta.params, color: col, lineWidth: 1.4, marker: { enabled: false }, dataGrouping: { enabled: false }, zIndex: 3 };
    if (meta.pane) {
      // Add a fresh pane and shrink the price pane to fit (Highcharts drag-panes handles resize).
      const axes = chart.yAxis.filter((a) => !a.options.isInternal && a.options.id !== "navigator-y-axis");
      const n = axes.length;
      const paneH = 14;
      const priceH = Math.max(30, 58 - paneH * (n - 2));
      chart.yAxis[0].update({ height: `${priceH}%` }, false);
      let top = priceH + 2;
      for (let i = 1; i < n; i++) { const h = parseFloat(axes[i].options.height) || paneH; axes[i].update({ top: `${top}%`, height: `${h}%` }, false); top += h + 2; }
      const axisId = `pane-${Date.now()}`;
      chart.addAxis({ id: axisId, top: `${top}%`, height: `${paneH}%`, offset: 0, opposite: true, labels: { align: "left", x: 6 }, title: { text: meta.name, align: "high", rotation: 0, y: -4, x: -40, style: { fontSize: "9px", color: col, fontFamily: "JetBrains Mono, monospace" } } }, false, false);
      opts.yAxis = axisId;
      if (type === "macd") Object.assign(opts, { macdLine: { styles: { lineColor: col } }, signalLine: { styles: { lineColor: cssVar("--bear") } } });
      chart.update({ chart: { height: chart.chartHeight + 110 } }, false);
    } else if (type === "vbp") {
      Object.assign(opts, { zoneLines: { enabled: false }, volumeDivision: { styles: { positiveColor: "rgba(5,150,105,0.35)", negativeColor: "rgba(225,29,72,0.35)" } } });
    }
    chart.addSeries(opts, false);
    chart.redraw();
    paneCount += 1;
    toast(`${meta.name} added`);
    refreshTree();
  }

  /* ------------------------------------------------------ lxScript editor */
  const WORKER_SRC = `
    const ta = {
      sma:(a,n)=>a.map((_,i)=>{ if(i<n-1) return null; let s=0; for(let k=i-n+1;k<=i;k++) s+=a[k]; return s/n; }),
      ema:(a,n)=>{ const k=2/(n+1); const o=[]; a.forEach((v,i)=>o.push(i?o[i-1]+k*(v-o[i-1]):v)); return o; },
      stdev:(a,n)=>a.map((_,i)=>{ if(i<n-1) return null; let m=0; for(let k=i-n+1;k<=i;k++) m+=a[k]; m/=n; let v=0; for(let k=i-n+1;k<=i;k++) v+=(a[k]-m)**2; return Math.sqrt(v/n); }),
      rsi:(a,n=14)=>{ const g=[0],l=[0]; for(let i=1;i<a.length;i++){const d=a[i]-a[i-1]; g.push(Math.max(d,0)); l.push(Math.max(-d,0));} const eg=ta.ema(g,n), el=ta.ema(l,n); return eg.map((x,i)=>100-100/(1+(el[i]?x/el[i]:99))); },
      atr:(b,n=14)=>{ const tr=b.map((x,i)=>i?Math.max(x.h-x.l,Math.abs(x.h-b[i-1].c),Math.abs(x.l-b[i-1].c)):x.h-x.l); return ta.ema(tr,n); },
      vwap:(b)=>{ let pv=0,vv=0; return b.map(x=>{ const tp=(x.h+x.l+x.c)/3; pv+=tp*x.v; vv+=x.v; return vv?pv/vv:tp; }); },
      highest:(a,n)=>a.map((_,i)=>i<n-1?null:Math.max(...a.slice(i-n+1,i+1))),
      lowest:(a,n)=>a.map((_,i)=>i<n-1?null:Math.min(...a.slice(i-n+1,i+1))),
      cross:(a,b)=>a.map((v,i)=>i&&a[i-1]!=null&&b[i-1]!=null&&v!=null&&b[i]!=null?((a[i-1]<=b[i-1]&&v>b[i])?1:(a[i-1]>=b[i-1]&&v<b[i])?-1:0):0),
    };
    self.onmessage = (e) => {
      const { code, bars } = e.data;
      const logs = [];
      const console = { log: (...a) => logs.push(a.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(' ')) };
      const close = bars.map(b=>b.c), open = bars.map(b=>b.o), high = bars.map(b=>b.h), low = bars.map(b=>b.l), volume = bars.map(b=>b.v);
      const t0 = performance.now();
      try {
        const fn = new Function('bars','close','open','high','low','volume','ta','console', code);
        const out = fn(bars, close, open, high, low, volume, ta, console) || {};
        self.postMessage({ ok: true, out, logs, ms: performance.now() - t0 });
      } catch (err) { self.postMessage({ ok: false, error: String(err && err.stack || err), logs }); }
    };`;
  function getWorker() {
    if (T.worker) T.worker.terminate();
    T.worker = new Worker(URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" })));
    return T.worker;
  }
  function log(msg, cls = "") { const c = $("script-console"); c.innerHTML += `\n<span class="${cls}">${msg}</span>`; c.scrollTop = c.scrollHeight; }
  async function runScript() {
    const S = ctx();
    if (!S.analysis) return;
    const code = $("script-src").value;
    $("script-console").innerHTML = `<span class="muted">▶ running…</span>`;
    const w = getWorker();
    const timeout = setTimeout(() => { w.terminate(); log("timeout after 3s", "err"); }, 3000);
    w.onmessage = async (e) => {
      clearTimeout(timeout);
      const r = e.data;
      (r.logs || []).forEach((l) => log(l, "muted"));
      if (!r.ok) { log(r.error, "err"); return; }
      log(`ok in ${r.ms.toFixed(1)} ms · ${Object.keys(r.out.plots || {}).length} plots${r.out.positions ? " · strategy" : ""}`, "ok");
      plotScript(r.out);
      lens(r.out);
      if (r.out.positions) await runBacktest(r.out.positions);
      else { $("bt-stats").innerHTML = ""; if (T.btChart) { T.btChart.destroy(); T.btChart = null; } }
      refreshTree();
    };
    w.postMessage({ code, bars: S.analysis.bars });
  }
  function plotScript(out) {
    const chart = window.LXChart?.chart;
    const S = ctx();
    if (!chart || !out.plots) return;
    chart.series.filter((s) => String(s.options.id || "").startsWith("lx-script-")).forEach((s) => s.remove(false));
    const palette = ["#0ea5e9", "#db2777", cssVar("--amber"), cssVar("--violet"), "#14b8a6", cssVar("--indigo")];
    const lower = out.pane === "lower";
    let axisId = 0;
    if (lower) {
      if (!chart.get("lx-script-axis")) {
        chart.yAxis[0].update({ height: "44%" }, false);
        chart.yAxis[1].update({ top: "46%", height: "10%" }, false);
        chart.yAxis[2].update({ top: "58%", height: "18%" }, false);
        chart.addAxis({ id: "lx-script-axis", top: "78%", height: "22%", offset: 0, opposite: true, labels: { align: "left", x: 6 }, title: { text: "" } }, false, false);
      }
      axisId = "lx-script-axis";
    }
    Object.entries(out.plots).forEach(([name, arr], k) => {
      const data = S.analysis.bars.map((b, i) => [b.t * 1000, Number.isFinite(arr[i]) ? arr[i] : null]);
      chart.addSeries({ id: `lx-script-${k}`, name, data, type: "line", yAxis: axisId, color: palette[k % palette.length], lineWidth: 1.5, marker: { enabled: false }, dataGrouping: { enabled: false }, zIndex: 4 }, false);
    });
    chart.redraw();
  }
  function lens(out) {
    const rows = Object.entries(out.plots || {}).map(([n, a]) => { const v = [...a].reverse().find((x) => Number.isFinite(x)); return `<div><span>${n}</span><strong>${v == null ? "—" : fmtP(v)}</strong></div>`; });
    if (out.positions) { const p = out.positions[out.positions.length - 2]; rows.push(`<div><span>position</span><strong class="${p > 0 ? "up" : p < 0 ? "dn" : ""}">${p > 0 ? "LONG" : p < 0 ? "SHORT" : "FLAT"}</strong></div>`); }
    $("lens-vals").innerHTML = rows.join("") || "No plots returned.";
  }
  async function runBacktest(positions) {
    const S = ctx();
    const r = await post("/api/backtest", { symbol: S.symbol, seed: S.seed, n: S.bars, tf: S.tf, positions });
    if (!r.ok) { log(r.error, "err"); return; }
    const cls = (v) => (v >= 0 ? "up" : "dn");
    $("bt-stats").innerHTML = `
      <div class="stat"><span>Return</span><strong class="${cls(r.return_pct)}">${r.return_pct >= 0 ? "+" : ""}${r.return_pct.toFixed(2)}%</strong></div>
      <div class="stat"><span>Sharpe</span><strong class="${cls(r.sharpe)}">${r.sharpe.toFixed(2)}</strong></div>
      <div class="stat"><span>Max DD</span><strong class="dn">${r.max_drawdown_pct.toFixed(2)}%</strong></div>
      <div class="stat"><span>Trades</span><strong>${r.trades}</strong></div>
      <div class="stat"><span>Exposure</span><strong>${Math.round(r.exposure * 100)}%</strong></div>`;
    const up = r.equity[r.equity.length - 1] >= 1;
    const color = up ? cssVar("--bull") : cssVar("--bear");
    const data = r.equity.map((v, i) => [i, (v - 1) * 100]);
    if (T.btChart) T.btChart.destroy();
    T.btChart = HC.chart("bt-hc", {
      chart: { type: "area", height: 200, spacing: [14, 14, 10, 14], marginRight: 64, reflow: true }, title: { text: "" }, legend: { enabled: false },
      xAxis: { visible: false, minPadding: 0, maxPadding: 0 }, yAxis: { title: { text: "" }, opposite: true, labels: { format: "{value:.1f}%", align: "left", x: 8 }, plotLines: [{ value: 0, color: "rgba(11,16,32,0.18)", width: 1 }] },
      tooltip: { headerFormat: "", pointFormat: "<b>{point.y:.2f}%</b>" },
      series: [{ data, color, lineWidth: 1.8, marker: { enabled: false }, threshold: 0, negativeColor: cssVar("--bear"), fillOpacity: 0.15 }],
    });
    log(`backtest: ${r.return_pct >= 0 ? "+" : ""}${r.return_pct}% · sharpe ${r.sharpe} · ${r.note}`, "muted");
  }
  async function kata() {
    const d = prompt("Describe the indicator or strategy in plain language", "Plot a 50 EMA and go long when RSI crosses above 30, short when it crosses below 70");
    if (!d) return;
    $("script-console").innerHTML = `<span class="muted">Kata is writing lxScript with the local model…</span>`;
    const r = await post("/api/kata", { description: d });
    $("script-src").value = r.code;
    log(`source · ${r.source}${r.host_error ? " · " + r.host_error : ""}`, r.source === "template" ? "err" : "ok");
    if (r.source !== "template") runScript();
  }
  function bindEditor() {
    const sel = $("script-template");
    sel.innerHTML = T.templates.map((t) => `<option value="${t.id}">${t.kind === "strategy" ? "⚡" : "〰"} ${t.name}</option>`).join("");
    const load = () => { const t = T.templates.find((x) => x.id === sel.value); if (t) $("script-src").value = t.source; };
    sel.addEventListener("change", load);
    load();
    $("script-run").addEventListener("click", runScript);
    $("script-ai").addEventListener("click", kata);
    $("script-src").addEventListener("keydown", (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") runScript(); });
  }

  /* -------------------------------------------------- liquidation heatmap */
  async function paintLiquidations() {
    const S = ctx();
    const r = await post("/api/liquidations", { symbol: S.symbol, seed: S.seed, n: S.bars, tf: S.tf });
    if (!r.ok) return;
    const li = (arr) => arr.map((m) => `<li><span>${fmtP(m.price)}</span><i style="width:${Math.min(100, m.weight * 6)}%"></i><em>${m.weight.toFixed(1)}</em></li>`).join("") || "<li>—</li>";
    $("liq-above").innerHTML = li(r.magnets_above);
    $("liq-below").innerHTML = li(r.magnets_below);
    $("liq-note").textContent = r.note;
    const spotRow = r.prices.reduce((bi, p, i) => (Math.abs(p - r.spot) < Math.abs(r.prices[bi] - r.spot) ? i : bi), 0);
    if (T.liqChart) T.liqChart.destroy();
    T.liqChart = HC.chart("liq-hc", {
      chart: { type: "heatmap", height: 380, spacing: [14, 14, 10, 14], marginRight: 84, marginBottom: 36, reflow: true }, title: { text: "" }, legend: { enabled: false },
      xAxis: { categories: r.times.map((t) => HC.dateFormat("%H:%M", t * 1000)), labels: { step: 8, y: 18 }, lineWidth: 0, tickWidth: 0 },
      yAxis: { categories: r.prices.map((p) => fmtP(p)), title: { text: "" }, opposite: true, labels: { step: 6, align: "left", x: 8 }, gridLineWidth: 0, plotLines: [{ value: spotRow, color: cssVar("--indigo"), width: 1.5, dashStyle: "Dash", zIndex: 5, label: { text: "spot", align: "left", style: { color: cssVar("--indigo"), fontSize: "9px", fontFamily: "JetBrains Mono, monospace" } } }] },
      colorAxis: { min: 0, max: 1, stops: [[0, "rgba(255,255,255,0)"], [0.25, "rgba(79,70,229,0.25)"], [0.55, "rgba(139,92,246,0.7)"], [0.8, "rgba(217,119,6,0.9)"], [1, "#e11d48"]] },
      tooltip: { formatter() { return `<b>${r.prices[this.point.y] ? fmtP(r.prices[this.point.y]) : ""}</b> · density ${(this.point.value * 100).toFixed(0)}%`; } },
      series: [{ data: r.points, borderWidth: 0, colsize: 1, rowsize: 1, turboThreshold: 0 }],
    });
  }

  /* --------------------------------------------------------- monitor mode */
  async function paintMonitor() {
    const r = await get(`/api/monitor?tf=${encodeURIComponent(ctx().tf || "15m")}&live=${ctx().live ? 1 : 0}`);
    if (!r.ok) return;
    const grid = $("monitor-grid");
    T.monitors.forEach((c) => c.destroy());
    T.monitors = [];
    grid.innerHTML = r.tiles.map((t, i) => `
      <button class="tile ${t.change_pct >= 0 ? "up" : "dn"}" data-sym="${t.symbol}" style="animation-delay:${i * 60}ms">
        <header><strong>${t.symbol}</strong><span>${t.name}</span></header>
        <div class="tile-num">${fmtP(t.last)}<em>${t.change_pct >= 0 ? "+" : ""}${t.change_pct.toFixed(2)}%</em></div>
        <div class="tile-chart" id="tile-${t.symbol}"></div>
        <footer><span class="pill ${t.bias === "bullish" ? "bull" : t.bias === "bearish" ? "bear" : ""}">${t.bias}</span><span>conf ${t.confluence >= 0 ? "+" : ""}${Math.round(t.confluence)}</span><span>${t.trend === 1 ? "trail ▲" : "trail ▼"}</span></footer>
      </button>`).join("");
    r.tiles.forEach((t) => {
      const up = t.change_pct >= 0;
      const color = up ? cssVar("--bull") : cssVar("--bear");
      const soft = up ? "rgba(5,150,105,0.22)" : "rgba(225,29,72,0.22)";
      T.monitors.push(HC.chart(`tile-${t.symbol}`, {
        chart: { type: "areaspline", height: 72, margin: [6, 4, 6, 4], spacing: [0, 0, 0, 0], backgroundColor: "transparent", reflow: true }, title: { text: "" }, legend: { enabled: false }, credits: { enabled: false },
        xAxis: { visible: false, minPadding: 0, maxPadding: 0 }, yAxis: { visible: false, minPadding: 0.1, maxPadding: 0.1 }, tooltip: { enabled: false },
        series: [{ data: t.closes, color, lineWidth: 1.5, marker: { enabled: false }, enableMouseTracking: false, fillColor: { linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 }, stops: [[0, soft], [1, "rgba(255,255,255,0)"]] } }],
      }));
    });
    grid.querySelectorAll(".tile").forEach((b) => b.addEventListener("click", () => { const sel = $("symbol"); sel.value = b.dataset.sym; sel.dispatchEvent(new Event("change")); document.querySelector("#chart").scrollIntoView({ behavior: "smooth" }); }));
    $("monitor-refresh").addEventListener("click", paintMonitor, { once: true });
  }

  async function init() {
    const [cat, tpl] = await Promise.all([get("/api/indicators"), get("/api/scripts")]);
    T.catalog = cat.indicators || [];
    T.templates = tpl.templates || [];
    bindSearch();
    paintMarket();
    $("ind-search").addEventListener("input", (e) => paintMarket(e.target.value));
    bindEditor();
    paintMonitor();
  }

  window.LXTerminal = { init, refreshTree, paintLiquidations, paintMonitor, runScript };
})();
