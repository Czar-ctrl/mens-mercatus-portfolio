/* FX MERCATUS CODEX (FMC) front-end — vanilla, canvas-driven, no build step. */

const S = {
  symbol: "SPX",
  tf: "15m",
  bars: 240,
  seed: null,
  live: true,
  csv: "",
  source: "synthetic",
  user: null,
  analysis: null,
  gex: null,
  ml: null,
  bot: null,
  layers: { trail: true, cloud: true, signals: true, ob: true, fvg: false, structure: true, gex: true, whales: true, big: true },
  whales: null,
  botTimer: 0,
  bellMuted: localStorage.getItem("fmc_bell_mute") === "1",
  lastBellKey: "",
  lastStrikeKey: "",
};

const $ = (id) => document.getElementById(id);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const fmt = (x, d) => (x == null || Number.isNaN(x) ? "—" : Number(x).toLocaleString(undefined, { maximumFractionDigits: d ?? 2, minimumFractionDigits: d ?? 0 }));

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 1800);
}

async function api(path, body) {
  const r = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
  return r.json();
}

function countUp(el, to, digits, prefix = "", suffix = "") {
  const from = parseFloat((el.dataset.v || "0").replace(/[^0-9.-]/g, "")) || 0;
  const t0 = performance.now();
  const dur = 650;
  const tick = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    const v = from + (to - from) * e;
    el.textContent = prefix + fmt(v, digits) + suffix;
    if (k < 1) requestAnimationFrame(tick);
    else el.dataset.v = String(to);
  };
  requestAnimationFrame(tick);
}

function decimals(price) {
  return price > 1000 ? 1 : price > 50 ? 2 : 4;
}

/* ---------------------------------------------------------------- chart */

function drawChart() {
  if (!S.analysis || !window.LXChart) return;
  LXChart.build(S, {
    onLevelDrag(id, y) {
      const map = { "lx-flip": "gx-flip", "lx-callwall": "gx-call", "lx-putfloor": "gx-put" };
      const el = $(map[id]);
      if (el) { el.textContent = fmt(y, decimals(y)) + " ✎"; toast("Level moved (view only, GEX math unchanged)"); }
    },
    onTool(cls) { if (cls) toast(cls.replace("highcharts-", "").replace(/-/g, " ")); },
    onBuilt(chart) {
      window.LXTerminal?.refreshTree();
      HighchartsTreeHook(chart);
    },
  });
}

function HighchartsTreeHook(chart) {
  // Keep the object tree live as the user draws with the stock-tools GUI.
  const H = window.Highcharts;
  if (!H || chart._lxHooked) return;
  chart._lxHooked = true;
  ["afterAddAnnotation", "afterRemoveAnnotation"].forEach((ev) => H.addEvent(chart, ev, () => setTimeout(() => window.LXTerminal?.refreshTree(), 50)));
}

function drawHeroSpark() {
  const a = S.analysis;
  if (!a) return;
  const cv = $("hero-spark"), ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  const c = a.bars.map((b) => b.c);
  const lo = Math.min(...c), hi = Math.max(...c);
  const x = (i) => 16 + (i / (c.length - 1)) * (W - 32);
  const y = (p) => 20 + (1 - (p - lo) / (hi - lo || 1)) * (H - 50);
  const up = c[c.length - 1] >= c[0];
  const col = up ? css("--bull") : css("--bear");
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, up ? "rgba(5,150,105,0.28)" : "rgba(225,29,72,0.28)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.beginPath(); c.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))));
  ctx.lineTo(x(c.length - 1), H); ctx.lineTo(x(0), H); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 2.2;
  ctx.beginPath(); c.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v)))); ctx.stroke();
  ctx.fillStyle = css("--ink-3"); ctx.font = "600 11px JetBrains Mono, monospace";
  ctx.fillText(`${S.symbol} · ${c.length} × ${S.tf} · ${a.source === "live" ? "live tape" : "synthetic tape"}`, 16, H - 12);
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x(c.length - 1), y(c[c.length - 1]), 4, 0, Math.PI * 2); ctx.fill();
}

/* ---------------------------------------------------------------- panels */

function signalStatusLabel(s) {
  if (s.status === "active") return s.is_latest_bar ? "live entry" : "active";
  if (s.status === "stopped") return "expired · stop hit";
  if (s.status === "target_hit") return "expired · target hit";
  if (s.expired_reason === "time") return "expired · timed out";
  if (s.expired_reason === "invalidation") return "expired · trail flip";
  return "expired";
}

function ringEntryBell() {
  const btn = $("signal-bell");
  btn?.classList.add("is-ringing");
  setTimeout(() => btn?.classList.remove("is-ringing"), 1200);
  if (S.bellMuted || !window.AudioContext) return;
  try {
    const ctx = new AudioContext();
    const playTone = (freq, t0, dur) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + dur);
    };
    const t = ctx.currentTime;
    playTone(880, t, 0.16);
    playTone(1174, t + 0.18, 0.22);
    setTimeout(() => ctx.close(), 600);
  } catch (_) { /* audio optional */ }
}

function paintSignalBell() {
  const a = S.analysis;
  const list = $("signal-bell-list");
  const badge = $("signal-bell-badge");
  if (!list || !a) return;
  const d = decimals(a.bars[a.bars.length - 1].c);
  const active = a.signals.filter((s) => !s.expired);
  const recent = a.signals.slice(-6).reverse();
  badge.hidden = !active.length;
  badge.textContent = String(active.length);
  list.innerHTML = recent.map((s) => `
    <article class="signal-bell-item ${s.side} ${s.expired ? "is-expired" : ""}">
      <div class="row">
        <span class="side">${s.side} · bar ${s.i} · s${s.strength}/4</span>
        <span class="status-pill ${s.status}">${signalStatusLabel(s)}</span>
      </div>
      <div class="signal-bell-levels">
        <span>Entry<strong>${fmt(s.entry, d)}</strong></span>
        <span class="sl">SL<strong>${fmt(s.stop, d)}</strong></span>
        <span class="tp">TP<strong>${fmt(s.target, d)}</strong></span>
      </div>
    </article>`).join("") || `<p class="signal-bell-foot">No confirmation flips in this window.</p>`;

  const fresh = a.signals.find((s) => s.is_latest_bar && !s.expired);
  const key = fresh ? `${S.symbol}:${S.tf}:${fresh.i}:${fresh.side}:${fresh.entry}` : "";
  if (fresh && key !== S.lastBellKey) {
    S.lastBellKey = key;
    ringEntryBell();
    toast(`${fresh.side.toUpperCase()} entry · SL ${fmt(fresh.stop, d)} · TP ${fmt(fresh.target, d)}`);
  }
}

function paintSignals() {
  const a = S.analysis;
  const strip = $("signal-strip");
  const sigs = a.signals.slice(-12).reverse();
  strip.innerHTML = sigs.map((s, k) => `
    <div class="sig ${s.side} ${s.expired ? "is-expired" : "is-active"}" style="animation-delay:${k * 40}ms">
      <span class="side">${s.side} · bar ${s.i}</span>
      <span class="px">${fmt(s.entry ?? s.price, decimals(s.entry ?? s.price))}</span>
      <span class="dots">${[1, 2, 3, 4].map((d) => `<i class="${d <= s.strength ? "on" : ""}"></i>`).join("")}</span>
      <span class="sig-levels">
        <span><em>SL</em><span class="sl">${fmt(s.stop, decimals(s.stop))}</span></span>
        <span><em>TP</em><span class="tp">${fmt(s.target, decimals(s.target))}</span></span>
      </span>
      <span class="sig-status">${signalStatusLabel(s)}</span>
    </div>`).join("") || `<div class="sig"><span class="side">no flips in window</span></div>`;
  paintSignalBell();
}

function paintStructure() {
  const st = S.analysis.structure;
  const pill = $("structure-bias");
  pill.textContent = st.bias;
  pill.className = `pill ${st.bias === "bullish" ? "bull" : st.bias === "bearish" ? "bear" : ""}`;
  $("st-zone").textContent = st.range.zone;
  $("st-range").textContent = `EQ ${fmt(st.range.equilibrium, decimals(st.range.equilibrium))} · ${fmt(st.range.low, decimals(st.range.low))}–${fmt(st.range.high, decimals(st.range.high))}`;
  $("st-ob").textContent = st.order_blocks.length;
  $("st-fvg").textContent = st.fvg.length;
  $("event-list").innerHTML = st.events.slice().reverse().map((e) => `
    <li class="${e.side}"><span class="tag">${e.kind}</span><span>${e.side === "bull" ? "Bullish break" : "Bearish break"} at bar ${e.i}</span><span class="px">${fmt(e.price, decimals(e.price))}</span></li>`).join("") || `<li><span class="tag">—</span><span>No structural breaks detected</span><span></span></li>`;
}

function drawMeter(value) {
  const cv = $("meter"), ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  const cx = W / 2, cy = H - 14, r = 105;
  ctx.lineWidth = 16; ctx.lineCap = "round";
  const seg = (a0, a1, color) => { ctx.strokeStyle = color; ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke(); };
  seg(Math.PI, Math.PI * 1.33, "rgba(225,29,72,0.25)");
  seg(Math.PI * 1.33, Math.PI * 1.67, "rgba(139,92,246,0.25)");
  seg(Math.PI * 1.67, Math.PI * 2, "rgba(5,150,105,0.25)");
  const ang = Math.PI + ((value + 100) / 200) * Math.PI;
  ctx.strokeStyle = value > 20 ? css("--bull") : value < -20 ? css("--bear") : css("--violet");
  ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, ang); ctx.stroke();
  ctx.fillStyle = css("--ink");
  ctx.beginPath(); ctx.arc(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, 7, 0, Math.PI * 2); ctx.fill();
}

function drawOsc() {
  const o = S.analysis.oscillators;
  const cv = $("osc-canvas"), ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  const n = o.rsi.length;
  const x = (i) => 8 + (i / (n - 1)) * (W - 16);
  const y100 = (v) => 10 + (1 - v / 100) * (H - 20);
  const yc = (v) => 10 + (1 - (v + 100) / 200) * (H - 20);
  ctx.strokeStyle = "rgba(11,16,32,0.06)";
  [20, 50, 80].forEach((g) => { ctx.beginPath(); ctx.moveTo(8, y100(g)); ctx.lineTo(W - 8, y100(g)); ctx.stroke(); });
  // money flow area
  for (let i = 1; i < n; i++) {
    const v = o.money_flow[i];
    ctx.fillStyle = v >= 0 ? "rgba(79,70,229,0.28)" : "rgba(79,70,229,0.14)";
    ctx.fillRect(x(i) - (W / n) * 0.35, Math.min(yc(v), yc(0)), (W / n) * 0.7, Math.abs(yc(v) - yc(0)));
  }
  const line = (arr, color, yf, w) => { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); arr.forEach((v, i) => (i ? ctx.lineTo(x(i), yf(v)) : ctx.moveTo(x(i), yf(v)))); ctx.stroke(); };
  line(o.hyper_wave, css("--violet"), y100, 2);
  line(o.rsi, "#94a3b8", y100, 1.3);
  o.reversals.forEach((r) => {
    ctx.fillStyle = r.side === "long" ? css("--bull") : css("--bear");
    ctx.beginPath(); ctx.arc(x(r.i), y100(o.hyper_wave[r.i]), 4.5, 0, Math.PI * 2); ctx.fill();
  });
  $("reversal-list").innerHTML = o.reversals.slice(-6).map((r) => `<li class="${r.side}">${r.side} reversal · bar ${r.i}</li>`).join("");
}

function paintGex() {
  const g = S.gex;
  if (!g) return;
  const reg = $("gex-regime");
  reg.textContent = `${g.regime} gamma · ${g.above_flip ? "above" : "below"} flip`;
  reg.className = `gex-regime ${g.regime}`;
  const d = decimals(g.spot);
  $("gx-flip").textContent = fmt(g.gamma_flip, d);
  $("gx-call").textContent = fmt(g.call_wall, d);
  $("gx-put").textContent = fmt(g.put_floor, d);
  $("gx-net").textContent = `${g.total_gex_bn >= 0 ? "+" : ""}${fmt(g.total_gex_bn, 2)} bn`;
  $("gex-note").textContent = `${g.regime_note} Chain: ${g.chain_source} (${g.chain_rows} strikes). Units: ${g.unit}.`;
  const spotRow = g.profile.reduce((best, r) => (Math.abs(r.strike - g.spot) < Math.abs(best.strike - g.spot) ? r : best), g.profile[0]);
  const flipRow = g.profile.reduce((best, r) => (Math.abs(r.strike - g.gamma_flip) < Math.abs(best.strike - g.gamma_flip) ? r : best), g.profile[0]);
  $("gex-bars").innerHTML = g.profile.slice().reverse().map((r, k) => {
    const w = Math.min(50, Math.abs(r.weight) * 50);
    const cls = r.net >= 0 ? "pos" : "neg";
    return `<div class="gex-row ${r === spotRow ? "spot" : ""} ${r === flipRow ? "flip" : ""}">
      <span class="strike">${fmt(r.strike, d)}</span>
      <span class="track"><span class="fill ${cls}" style="width:${w}%;animation-delay:${k * 18}ms"></span></span>
      <span class="val">${r.net >= 0 ? "+" : ""}${fmt(r.net, 1)}m</span>
    </div>`;
  }).join("");
}

function paintMl() {
  const m = S.ml;
  const cv = $("ml-canvas"), ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  if (!m || !m.ok) {
    $("ml-oos").textContent = m?.error || "—";
    return;
  }
  const p = m.p_up;
  ctx.lineWidth = 14; ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(11,16,32,0.06)"; ctx.beginPath(); ctx.arc(W / 2, H / 2, 70, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = p >= 0.5 ? css("--bull") : css("--bear");
  ctx.beginPath(); ctx.arc(W / 2, H / 2, 70, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); ctx.stroke();
  ctx.fillStyle = css("--ink"); ctx.font = "800 26px JetBrains Mono, monospace"; ctx.textAlign = "center";
  ctx.fillText(`${Math.round(p * 100)}%`, W / 2, H / 2 + 6);
  ctx.font = "600 10px JetBrains Mono, monospace"; ctx.fillStyle = css("--ink-3");
  ctx.fillText("P(UP NEXT BAR)", W / 2, H / 2 + 26);
  ctx.textAlign = "left";
  $("ml-oos").textContent = `${(m.oos_hit_rate * 100).toFixed(1)}%`;
  $("ml-base").textContent = `${(m.baseline * 100).toFixed(1)}%`;
  $("ml-n").textContent = `${m.train_n} / ${m.test_n}`;
  $("ml-weights").innerHTML = Object.entries(m.weights).filter(([k]) => k !== "bias").map(([k, v]) => `<span class="${v < 0 ? "neg" : ""}">${k} ${v >= 0 ? "+" : ""}${v.toFixed(2)}</span>`).join("");
}

function paintBot() {
  const b = S.bot;
  if (!b) return;
  const eq = $("bt-eq"); countUp(eq, b.equity, 0, "$");
  const ret = $("bt-ret"); ret.textContent = `${b.stats.return_pct >= 0 ? "+" : ""}${b.stats.return_pct.toFixed(2)}%`; ret.className = b.stats.return_pct >= 0 ? "up" : "dn";
  $("bt-win").textContent = b.stats.trades ? `${Math.round(b.stats.win_rate * 100)}%` : "—";
  $("bt-pf").textContent = b.stats.trades ? fmt(b.stats.profit_factor, 2) : "—";
  $("bt-dd").textContent = `${(b.stats.max_drawdown * 100).toFixed(2)}%`;
  $("bt-bar").textContent = `${b.cursor}/${b.total}${b.tf ? " · " + b.tf : ""}`;
  $("bot-toggle").textContent = b.running ? "Pause" : "Start";
  $("bot-toggle").classList.toggle("primary", !b.running);
  const pos = $("bt-pos");
  if (b.position) {
    const p = b.position;
    pos.textContent = `${p.side.toUpperCase()} ×${p.qty} @ ${fmt(p.entry, decimals(p.entry))} · stop ${fmt(p.stop, decimals(p.stop))} · tgt ${fmt(p.target, decimals(p.target))}`;
    pos.className = `position ${p.side}`;
  } else { pos.textContent = "Flat"; pos.className = "position"; }
  $("blotter-body").innerHTML = b.trades.slice().reverse().map((t) => `<tr><td>${t.side}</td><td>${fmt(t.entry, decimals(t.entry))}</td><td>${fmt(t.exit, decimals(t.exit))}</td><td>${t.qty}</td><td class="${t.pnl >= 0 ? "pos" : "neg"}">${t.pnl >= 0 ? "+" : ""}${fmt(t.pnl, 2)}</td><td>${t.bars}</td><td>${t.reason}</td></tr>`).join("") || `<tr><td colspan="7">No closed trades yet</td></tr>`;
  $("bot-log").textContent = b.log.join("\n");
  $("risk").value = b.risk_pct; $("risk-out").textContent = `${b.risk_pct}%`;
  $("strength").value = b.min_strength; $("str-out").textContent = b.min_strength;
  $("gexfilter").checked = b.use_gex_filter;
  if (window.LXChart) LXChart.equity(b.equity_curve);
}

/* ---------------------------------------------------------------- flows */

function paintKpis() {
  const a = S.analysis;
  const last = a.bars[a.bars.length - 1].c;
  countUp($("kpi-last"), last, decimals(last));
  $("kpi-bias").textContent = a.structure.bias;
  const conf = a.oscillators.confluence[a.oscillators.confluence.length - 1];
  $("kpi-conf").textContent = `${conf >= 0 ? "+" : ""}${conf.toFixed(0)}`;
  $("kpi-conf").style.color = conf > 20 ? css("--bull") : conf < -20 ? css("--bear") : "";
  countUp($("meter-val"), conf, 0, conf >= 0 ? "+" : "");
  drawMeter(conf);
  if (S.gex) $("kpi-gex").textContent = `${S.gex.total_gex_bn >= 0 ? "+" : ""}${fmt(S.gex.total_gex_bn, 2)} bn`;
  if (S.ml?.ok) $("kpi-ml").textContent = `${Math.round(S.ml.p_up * 100)}%`;
}

async function runAll(opts = {}) {
  if (window.LXDesk?.replaying) return;
  const btn = $("run-all");
  if (!opts.silent) { btn.disabled = true; btn.textContent = "Computing…"; }
  try {
    const body = { symbol: S.symbol, n: S.bars, tf: S.tf, seed: S.seed, live: S.live, csv: S.csv || "" };
    const [analysis, gex, ml, whalesPack] = await Promise.all([
      api("/api/analyze", body),
      api("/api/gex", body),
      api("/api/ml", body),
      api(`/api/whales?levels=1&symbol=${encodeURIComponent(S.symbol)}`).catch(() => null),
    ]);
    S.analysis = analysis; S.gex = gex; S.ml = ml;
    if (whalesPack?.ok) S.whales = whalesPack;
    S.source = analysis.source || (S.live ? "live" : "synthetic");
    drawHeroSpark();
    try { drawChart(); } catch (err) { console.error("chart", err); toast("Chart error — see console"); }
    paintSignals(); paintStructure(); drawOsc(); paintGex(); paintMl(); paintKpis();
    window.LXTerminal?.paintLiquidations();
    window.LXDesk?.afterRun();
    window.LXGodmode?.afterRun();
    if (!opts.silent) toast(`${S.symbol} · ${S.source === "live" ? "live" : "synthetic"} · ${analysis.signals.length} signals · GEX ${gex.regime}`);
    if (S.source === "synthetic-fallback" && !opts.silent) toast("Live feed unreachable — showing synthetic tape");
  } catch (err) {
    toast("Compute failed");
    console.error(err);
  }
  btn.disabled = false; btn.textContent = "Run all";
}

async function runGexPaste() {
  const chain = $("chain-text").value.trim();
  const spot = S.analysis ? S.analysis.bars[S.analysis.bars.length - 1].c : 0;
  S.gex = await api("/api/gex", { chain, spot, symbol: S.symbol });
  paintGex(); drawChart(); paintKpis();
  toast(S.gex.chain_source === "pasted" ? "Chain parsed" : "No valid rows — synthetic chain used");
}

async function runAi() {
  const box = document.querySelector(".ai-body");
  box.classList.add("thinking");
  $("ai-text").textContent = "Thinking with the local model…";
  const conf = S.analysis?.oscillators.confluence.slice(-1)[0] ?? 0;
  const out = await api("/api/ai", { symbol: S.symbol, bias: S.analysis?.structure.bias, confluence: conf, gex: S.gex, ml: S.ml });
  box.classList.remove("thinking");
  $("ai-text").textContent = out.text;
  $("ai-source").textContent = `source · ${out.source}${out.host_error ? " · " + out.host_error : ""}`;
}

async function botRefresh() {
  S.bot = await api("/api/bot");
  paintBot();
}

function botPoll() {
  clearInterval(S.botTimer);
  S.botTimer = setInterval(async () => {
    if (S.bot?.running) await botRefresh();
  }, 1000);
}

function bindUi() {
  const sel = $("symbol");
  api("/api/symbols").then((d) => {
    sel.innerHTML = Object.entries(d.symbols).map(([k, v]) => `<option value="${k}">${k} · ${v.name}</option>`).join("");
    sel.value = S.symbol;
  });
  sel.addEventListener("change", () => { S.symbol = sel.value; S.seed = null; S.lastBellKey = ""; runAll(); window.LXDesk?.savePrefs({ symbol: S.symbol }); });
  $("regen").addEventListener("click", () => { S.seed = Math.floor(Math.random() * 1e6); runAll(); });
  const TF_BARS = { "1m": 390, "5m": 300, "15m": 240, "1h": 200 };
  document.querySelectorAll("#tf-switch button").forEach((b) => b.addEventListener("click", async () => {
    if (b.dataset.tf === S.tf) return;
    S.tf = b.dataset.tf; S.bars = TF_BARS[S.tf] || 240;
    document.querySelectorAll("#tf-switch button").forEach((x) => x.classList.toggle("is-on", x === b));
    S.lastBellKey = "";
    await runAll();
    S.bot = await api("/api/bot/reset", { symbol: S.symbol, tf: S.tf, live: S.live, csv: S.csv || "" }); paintBot();
    window.LXTerminal?.paintMonitor();
    window.LXDesk?.savePrefs({ tf: S.tf });
    toast(`${S.symbol} · ${S.tf} bars`);
  }));
  $("run-all").addEventListener("click", runAll);
  document.querySelectorAll("#overlay-toggles input").forEach((i) => i.addEventListener("change", () => {
    S.layers[i.dataset.layer] = i.checked;
    if (!window.LXChart || LXChart.setLayer(i.dataset.layer, i.checked)) drawChart();
  }));
  $("ann-note").addEventListener("click", () => {
    const text = prompt("Note text", `${S.symbol} · ${S.analysis?.structure.bias ?? ""} · conf ${S.analysis?.oscillators.confluence.slice(-1)[0]?.toFixed(0) ?? ""}`);
    if (text) LXChart.addNote(text);
  });
  $("ann-measure").addEventListener("click", () => LXChart.addMeasure());
  $("ann-fib").addEventListener("click", () => LXChart.addFib());
  $("ann-clear").addEventListener("click", () => { LXChart.clearDrawings(); toast("Drawings cleared"); });
  $("chart-full").addEventListener("click", () => LXChart.fullscreen());
  $("chart-export").addEventListener("click", () => LXChart.exportPng());
  $("gex-run").addEventListener("click", runGexPaste);
  $("ai-run").addEventListener("click", runAi);
  $("bot-toggle").addEventListener("click", async () => { S.bot = await api("/api/bot/config", { running: !S.bot?.running }); paintBot(); toast(S.bot.running ? "Bot running (paper)" : "Bot paused"); });
    $("bot-step").addEventListener("click", async () => {
    S.bot = await api("/api/bot/step", { n: 10 });
    paintBot();
    if (S.bot?.journal?.count) {
      toast(`Journaled ${S.bot.journal.count} paper close${S.bot.journal.count === 1 ? "" : "s"}`);
      window.LXGodmode?.paintJournal?.();
    }
  });
  $("bot-reset").addEventListener("click", async () => {
    S.bot = await api("/api/bot/reset", { symbol: S.symbol, tf: S.tf, live: S.live, csv: S.csv || "" });
    paintBot();
    toast(S.csv ? "Bot reset on CSV tape" : S.live ? "Bot reset on live tape" : "Bot reset");
  });
  const cfg = async (patch) => { S.bot = await api("/api/bot/config", patch); paintBot(); };
  $("risk").addEventListener("input", (e) => { $("risk-out").textContent = `${e.target.value}%`; });
  $("risk").addEventListener("change", (e) => cfg({ risk_pct: parseFloat(e.target.value) }));
  $("strength").addEventListener("input", (e) => { $("str-out").textContent = e.target.value; });
  $("strength").addEventListener("change", (e) => cfg({ min_strength: parseInt(e.target.value, 10) }));
  $("gexfilter").addEventListener("change", (e) => cfg({ use_gex_filter: e.target.checked }));
  const bellBtn = $("signal-bell");
  const bellPanel = $("signal-bell-panel");
  bellBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = bellPanel.hidden;
    bellPanel.hidden = !open;
    bellBtn.setAttribute("aria-expanded", String(open));
    if (open) paintSignalBell();
  });
  document.addEventListener("click", () => { if (bellPanel) bellPanel.hidden = true; bellBtn?.setAttribute("aria-expanded", "false"); });
  bellPanel?.addEventListener("click", (e) => e.stopPropagation());
  const mute = $("signal-bell-mute");
  if (mute) {
    mute.checked = S.bellMuted;
    mute.addEventListener("change", () => {
      S.bellMuted = mute.checked;
      localStorage.setItem("fmc_bell_mute", S.bellMuted ? "1" : "0");
    });
  }
  // Tab scroll-spy + animated pill live in motion.js
}

window.LX_STATE = S;
window.LX_TOAST = toast;
window.runAll = runAll;
window.drawChart = drawChart;
bindUi();
window.LXDesk?.bind();
window.LXGodmode?.bind();
(window.LXTerminal ? LXTerminal.init() : Promise.resolve())
  .then(() => window.LXDesk?.refreshAuth())
  .then((u) => window.LXGodmode?.restoreSession(u))
  .then((applied) => { if (!applied) return runAll(); })
  .then(botRefresh).then(botPoll)
  .then(() => window.LXDesk?.paintQuant())
  .then(() => window.LXGodmode?.afterRun());

async function pollStrike() {
  const box = $("strike-watch");
  if (!box) return;
  try {
    const pack = await api("/api/strike?tf=60m");
    const armed = pack.armed || [];
    box.hidden = false;
    if (!armed.length) {
      box.innerHTML = `<strong>MMC Confluence Strike</strong> · H1 watch (NQ, US30, XAU, GBPJPY, BTC) · no fresh 0.618 arm on the latest bar. Research profile was about 75%+ win rate on the 2026 sample — paper only. Alerts keep running on this Mac after you quit the window.`;
      return;
    }
    box.innerHTML = armed.map((s) => `<div class="armed">${s.symbol} ${String(s.side).toUpperCase()} · entry ${fmt(s.entry, 2)} · SL ${fmt(s.sl, 2)} · TP ${fmt(s.tp, 2)}</div>`).join("");
    const key = armed.map((s) => `${s.symbol}:${s.bar_t}:${s.side}`).join("|");
    if (key && key !== S.lastStrikeKey && "Notification" in window) {
      S.lastStrikeKey = key;
      if (Notification.permission === "granted") {
        armed.forEach((s) => new Notification(`FMC ${s.symbol} ${String(s.side).toUpperCase()}`, {
          body: `Entry ${s.entry} · SL ${s.sl} · TP ${s.tp}`,
        }));
      } else if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  } catch (_) { /* desk can run before the route is up */ }
}
pollStrike();
setInterval(pollStrike, 60000);
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
