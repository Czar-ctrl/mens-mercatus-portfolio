/* Hosted paper desk. Serves the FMC UI without localhost:8792. */
(function () {
  const orig = window.fetch.bind(window);
  const FIX = new URL("fixtures/", document.currentScript.src);
  const cache = new Map();
  const mem = { bot: null };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function json(obj, status) {
    return new Response(JSON.stringify(obj), {
      status: status || 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  async function load(rel) {
    if (cache.has(rel)) return clone(cache.get(rel));
    const res = await orig(new URL(rel, FIX).href);
    if (!res.ok) throw new Error(rel);
    const data = await res.json();
    cache.set(rel, data);
    return clone(data);
  }
  function qs(url) { return url.searchParams; }
  function bodyOf(init) {
    try { return init && init.body ? JSON.parse(init.body) : {}; }
    catch { return {}; }
  }
  function store(key, val) {
    if (val === undefined) {
      try { return JSON.parse(localStorage.getItem(key) || "null"); }
      catch { return null; }
    }
    localStorage.setItem(key, JSON.stringify(val));
    return val;
  }
  function journalStats(entries) {
    const pnls = entries.map((e) => Number(e.pnl) || 0);
    const wins = pnls.filter((p) => p >= 0);
    const losses = pnls.filter((p) => p < 0);
    const gain = wins.reduce((a, b) => a + b, 0);
    const loss = Math.abs(losses.reduce((a, b) => a + b, 0));
    const moods = {};
    entries.forEach((e) => { if (e.mood) moods[e.mood] = (moods[e.mood] || 0) + 1; });
    return {
      trades: entries.length,
      win_rate: entries.length ? wins.length / entries.length : 0,
      avg_pnl: entries.length ? pnls.reduce((a, b) => a + b, 0) / entries.length : 0,
      total_pnl: pnls.reduce((a, b) => a + b, 0),
      profit_factor: loss ? gain / loss : (gain ? 99 : 0),
      avg_r: 0,
      best: pnls.length ? Math.max(...pnls) : 0,
      worst: pnls.length ? Math.min(...pnls) : 0,
      moods,
    };
  }
  function journalList() {
    const entries = store("fmc_hosted_journal") || [];
    return { ok: true, entries, stats: journalStats(entries), count: entries.length };
  }
  function botStats(trades) {
    const pnls = trades.map((t) => Number(t.pnl) || 0);
    const wins = pnls.filter((p) => p > 0);
    const losses = pnls.filter((p) => p < 0);
    const gain = wins.reduce((a, b) => a + b, 0);
    const loss = Math.abs(losses.reduce((a, b) => a + b, 0));
    const curve = mem.bot.equity_curve || [100000];
    let peak = curve[0], dd = 0;
    curve.forEach((v) => { peak = Math.max(peak, v); dd = Math.max(dd, (peak - v) / peak); });
    const start = curve[0] || 100000;
    return {
      trades: trades.length,
      win_rate: trades.length ? wins.length / trades.length : 0,
      profit_factor: loss ? +(gain / loss).toFixed(2) : (gain ? 99 : 0),
      max_drawdown: +dd.toFixed(4),
      return_pct: +((mem.bot.equity / start - 1) * 100).toFixed(2),
    };
  }
  async function ensureBot() {
    if (!mem.bot) mem.bot = await load("post/bot_reset.json");
    return mem.bot;
  }

  async function matrix(route, b) {
    const sym = String(b.symbol || "SPX").toUpperCase();
    const tf = b.tf || "15m";
    const tries = [`post/${route}/${sym}_${tf}.json`, `post/${route}/SPX_${tf}.json`, `post/${route}/SPX_15m.json`];
    for (const rel of tries) {
      try { return await load(rel); } catch { /* next */ }
    }
    return { ok: false, error: "no hosted tape for " + sym + " " + tf };
  }

  async function history(url) {
    const q = qs(url);
    const sym = (q.get("symbol") || "SPX").toUpperCase();
    let iv = q.get("interval") || "1d";
    let rg = q.get("range") || "1y";
    if (rg === "max" || rg === "5y") { iv = iv === "1d" ? "1d" : iv; rg = iv === "1mo" ? "5y" : "2y"; }
    const tries = [
      `get/history__symbol-${sym}_interval-${iv}_range-${rg}.json`,
      `get/history__symbol-${sym}_interval-1d_range-1y.json`,
      `get/history__symbol-${sym}_interval-1d_range-2y.json`,
      "get/history__symbol-SPX_interval-1d_range-1y.json",
    ];
    for (const rel of tries) {
      try { return await load(rel); } catch { /* next */ }
    }
    return { ok: false, error: "history unavailable" };
  }

  async function onGet(url) {
    const path = url.pathname;
    const q = qs(url);
    if (path === "/api/health") return json(await load("get/health.json"));
    if (path === "/api/kernel") return json(await load("get/kernel.json"));
    if (path === "/api/session") {
      const saved = store("fmc_hosted_session");
      if (saved) return json(saved);
      return json(await load("get/session.json"));
    }
    if (path === "/api/quant/handshake") return json(await load("get/quant/handshake.json"));
    if (path === "/api/ready") return json(await load("get/ready.json"));
    if (path === "/api/agents/report") return json(await load("get/agents/report.json"));
    if (path === "/api/models") return json(await load("get/models.json"));
    if (path === "/api/symbols") return json(await load("get/symbols.json"));
    if (path === "/api/study") return json(await load("get/study.json"));
    if (path === "/api/strategies") return json(await load("get/strategies.json"));
    if (path === "/api/indicators") return json(await load("get/indicators.json"));
    if (path === "/api/scripts") return json(await load("get/scripts.json"));
    if (path === "/api/emotion") return json(await load("get/emotion.json"));
    if (path === "/api/replay") return json(await load("get/replay.json"));
    if (path === "/api/agi/ideas") return json(await load("get/agi/ideas.json"));
    if (path === "/api/auth/me") {
      const user = store("fmc_hosted_user");
      return json({ ok: true, user: user ? { email: user.email, name: user.name, prefs: user.prefs || {} } : null, mode: "browser" });
    }
    if (path === "/api/journal") return json(journalList());
    if (path === "/api/bot") return json(await ensureBot());
    if (path === "/api/strike") return json(await load("get/strike__tf-60m.json"));
    if (path === "/api/quote") {
      const pack = await load("get/quote__symbols-SPX,NQ,DJI,XAU,XAG,EURUSD,GBPUSD,USDJPY,BTC,ETH.json");
      const want = (q.get("symbols") || "").split(",").filter(Boolean);
      const now = Date.now() / 1000;
      const quotes = pack.quotes.filter((row) => !want.length || want.includes(row.symbol)).map((row) => {
        const wobble = Math.sin(now / 4 + row.symbol.length) * row.last * 0.00012;
        const last = +(row.last + wobble).toFixed(row.last > 50 ? 2 : 5);
        return Object.assign({}, row, { last, t: Math.floor(now), change: +(last - row.prev_close).toFixed(4), change_pct: +((last / row.prev_close - 1) * 100).toFixed(3) });
      });
      return json({ ok: true, quotes, t: Math.floor(now), realtime: false, paper: true });
    }
    if (path === "/api/history") return json(await history(url));
    if (path === "/api/calendar") {
      const week = q.get("week") === "next" ? "next" : "this";
      return json(await load(`get/calendar__week-${week}.json`));
    }
    if (path === "/api/news") {
      const sym = (q.get("symbol") || "SPX").toUpperCase();
      try { return json(await load(`get/news__symbol-${sym}.json`)); }
      catch { return json(await load("get/news__symbol-SPX.json")); }
    }
    if (path === "/api/cot") {
      const sym = (q.get("symbol") || "SPX").toUpperCase();
      try { return json(await load(`get/cot__symbol-${sym}_weeks-104.json`)); }
      catch { return json(await load("get/cot__symbol-SPX_weeks-104.json")); }
    }
    if (path === "/api/monitor") {
      const tf = q.get("tf") || "15m";
      try { return json(await load(`get/monitor__tf-${tf}.json`)); }
      catch { return json(await load("get/monitor__tf-15m.json")); }
    }
    if (path === "/api/whales") {
      const sym = (q.get("symbol") || "SPX").toUpperCase();
      const kind = q.get("levels") === "1" ? `get/whales__levels-1_symbol-${sym}.json` : `get/whales__symbol-${sym}.json`;
      try { return json(await load(kind)); }
      catch { return json(await load(q.get("levels") === "1" ? "get/whales__levels-1_symbol-SPX.json" : "get/whales__symbol-SPX.json")); }
    }
    return json({ ok: false, error: "hosted desk has no " + path }, 404);
  }

  async function onPost(url, init) {
    const path = url.pathname;
    const b = bodyOf(init);
    if (["/api/analyze", "/api/gex", "/api/ml", "/api/orderflow", "/api/astro"].includes(path)) {
      return json(await matrix(path.slice(5), b));
    }
    if (path === "/api/bot/reset") {
      mem.bot = await load("post/bot_reset.json");
      mem.bot.symbol = b.symbol || mem.bot.symbol;
      mem.bot.tf = b.tf || mem.bot.tf;
      mem.bot.running = false;
      mem.bot.log = [`reset ${mem.bot.symbol} ${mem.bot.tf} · hosted paper tape`];
      return json(mem.bot);
    }
    if (path === "/api/bot/config") {
      const bot = await ensureBot();
      Object.assign(bot, b);
      return json(bot);
    }
    if (path === "/api/bot/step") {
      const bot = await ensureBot();
      const n = b.n || 10;
      const drift = Math.sin(bot.cursor / 7) * 35 + (bot.cursor % 5 === 0 ? 18 : -6);
      bot.cursor = Math.min(bot.total, bot.cursor + n);
      bot.cash = +(bot.cash + drift).toFixed(2);
      bot.equity = bot.cash;
      bot.equity_curve.push(bot.equity);
      bot.trades.push({ side: drift >= 0 ? "long" : "short", entry: 100, exit: +(100 + drift / 50).toFixed(2), qty: 1, pnl: +drift.toFixed(2), bars: n, reason: "paper step" });
      bot.stats = botStats(bot.trades);
      bot.log = [`step ${n} · cursor ${bot.cursor}/${bot.total} · pnl ${drift.toFixed(2)}`].concat(bot.log).slice(0, 12);
      bot.journal = { count: 0 };
      return json(bot);
    }
    if (path === "/api/journal/add") {
      const entries = store("fmc_hosted_journal") || [];
      const entry = Object.assign({ id: "j" + Date.now(), t: Math.floor(Date.now() / 1000) }, b);
      const pnl = (Number(b.exit) - Number(b.entry)) * (Number(b.qty) || 1) * (b.side === "short" ? -1 : 1);
      entry.pnl = +pnl.toFixed(2);
      entry.pnl_pct = b.entry ? +((pnl / Math.abs(b.entry)) * 100).toFixed(2) : 0;
      entries.unshift(entry);
      store("fmc_hosted_journal", entries);
      return json({ ok: true, entry });
    }
    if (path === "/api/journal/delete") {
      const entries = (store("fmc_hosted_journal") || []).filter((e) => e.id !== b.id);
      store("fmc_hosted_journal", entries);
      return json({ ok: true });
    }
    if (path === "/api/journal/review") {
      const entries = store("fmc_hosted_journal") || [];
      const entry = entries.find((e) => e.id === b.id);
      if (!entry) return json({ ok: false, error: "entry not found" });
      entry.ai_review = { source: "hosted rule", text: `${entry.symbol} ${entry.side} paper review: PnL ${entry.pnl}. Setup “${entry.setup || "unspecified"}”. This is a local note, not a model call.` };
      store("fmc_hosted_journal", entries);
      return json({ ok: true, review: entry.ai_review });
    }
    if (path === "/api/auth/login" || path === "/api/auth/register") {
      const email = String(b.email || "").trim().toLowerCase();
      const password = String(b.password || "");
      if (!email || password.length < 8) return json({ ok: false, error: "Use an email and an 8+ character password. It stays in this browser only." });
      const accounts = store("fmc_hosted_accounts") || {};
      if (path.endsWith("register")) {
        accounts[email] = { email, name: b.name || email.split("@")[0], password, prefs: {} };
      } else if (!accounts[email] || accounts[email].password !== password) {
        return json({ ok: false, error: "No local account matches. Create one on this browser." });
      }
      store("fmc_hosted_accounts", accounts);
      const user = { email, name: accounts[email].name, prefs: accounts[email].prefs || {} };
      store("fmc_hosted_user", user);
      return json({ ok: true, user });
    }
    if (path === "/api/auth/logout") { localStorage.removeItem("fmc_hosted_user"); return json({ ok: true }); }
    if (path === "/api/auth/prefs") {
      const user = store("fmc_hosted_user");
      if (user) { user.prefs = Object.assign({}, user.prefs, b.prefs || {}); store("fmc_hosted_user", user); }
      return json({ ok: true });
    }
    if (path === "/api/session") {
      const prev = store("fmc_hosted_session") || { ok: true, prefs: {} };
      prev.ok = true;
      prev.prefs = Object.assign({}, prev.prefs, b.prefs || {});
      store("fmc_hosted_session", prev);
      return json(prev);
    }
    if (path === "/api/search") {
      const pack = await load("post/search.json");
      pack.query = b.query || pack.query;
      return json(pack);
    }
    if (path === "/api/ai") {
      const pack = await load("post/ai.json");
      const sym = b.symbol || "SPX";
      pack.text = `${sym}: hosted paper readout. Structure ${b.bias || "mixed"}, confluence ${b.confluence ?? "—"}. GEX ${b.gex?.regime || "snapshot"} · flip ${b.gex?.gamma_flip ?? "—"}. ML p(up) ${b.ml?.p_up ?? "—"}. Not a brokerage and not advice.`;
      pack.source = "hosted rule";
      pack.host_error = "";
      return json(pack);
    }
    if (path === "/api/agi/ask") {
      const pack = await load("post/agi_ask.json");
      pack.answer = `Hosted desk · ${b.question || "desk question"}\n\n` + (pack.answer || "Paper engines only. Nothing is sent to a model host.");
      pack.source = "hosted rule";
      return json(pack);
    }
    const file = {
      "/api/backtest": "post/backtest.json",
      "/api/kata": "post/kata.json",
      "/api/liquidations": "post/liquidations.json",
      "/api/strategies/fit": "post/strategies_fit.json",
      "/api/models/run": "post/models_run.json",
      "/api/agents/run": "post/agents_run.json",
      "/api/agi/bundle": "post/agi_bundle.json",
      "/api/agi/swarm": "post/agi_swarm.json",
      "/api/agi/twin": "post/agi_twin.json",
      "/api/csv": "post/csv.json",
    }[path];
    if (file) {
      try { return json(await load(file)); } catch { return json({ ok: false, error: "fixture missing" }); }
    }
    if (path === "/api/lab/discharge" || path === "/api/lab/overnight") {
      return json({ ok: true, note: "Hosted desk keeps the paper ritual in the browser. No lab process is running on the server." });
    }
    return json({ ok: true, hosted: true, path });
  }

  window.fetch = function (input, init) {
    const raw = typeof input === "string" ? input : input instanceof URL ? String(input) : input.url;
    let abs;
    try { abs = new URL(raw, location.href); }
    catch { return orig(input, init); }
    if (abs.origin !== location.origin || !abs.pathname.startsWith("/api/")) return orig(input, init);
    const method = ((init && init.method) || (typeof input !== "string" && input.method) || "GET").toUpperCase();
    const run = method === "GET" || method === "HEAD" ? onGet(abs) : onPost(abs, init);
    return run.catch((err) => json({ ok: false, error: String(err && err.message || err) }, 500));
  };
})();
