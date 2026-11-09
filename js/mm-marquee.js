/* Live marquee under the home hero (preview D). Two lanes: real market quotes and the latest public JobNet posts.
   Sources (first-party first): FMC desk /forex/api/quote (Kraken/Yahoo; synthetic rows are dropped), fallback ExchangeRate-API daily
   reference rates (attribution shown). If a source is down the last good values are shown marked "stale"; nothing is ever invented.
   Absolutely positioned inside the hero's bottom padding, so it causes no layout shift. aria-live off; pause button; reduced motion = static. */
(function () {
  'use strict';
  var w = window, d = document;
  var hero = d.querySelector('[data-mm-marquee]') || (d.querySelector('main#content') || d.querySelector('main') || d.body).querySelector('section');
  if (!hero || d.querySelector('.mmq')) return;
  var API = 'https://api.mensmercatus.online', reduce = w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SAST = function (ms, withDay) { var o = { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg' }; if (withDay) { o.day = 'numeric'; o.month = 'short'; } return new Date(ms).toLocaleString('en-ZA', o).replace(',', ''); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var store = { get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };
  function get(url, ms) { var c = new AbortController(); var t = setTimeout(function () { c.abort(); }, ms || 8000); return fetch(url, { signal: c.signal, cache: 'no-store' }).then(function (r) { clearTimeout(t); if (!r.ok) throw new Error(r.status); return r.json(); }); }

  hero.classList.add('mmq-host');
  var el = d.createElement('section'); el.className = 'mmq'; el.setAttribute('aria-label', 'Live markets and latest job posts'); el.setAttribute('aria-live', 'off');
  el.innerHTML = '<button type="button" class="mmq-pause" aria-pressed="false" aria-label="Pause the ticker"><span aria-hidden="true">❚❚</span></button>' +
    '<div class="mmq-lanes"><div class="mmq-lane" data-lane="mk" aria-label="Markets"><div class="mmq-track"><span class="mmq-i mmq-note">Loading live prices…</span></div></div>' +
    '<div class="mmq-lane rev" data-lane="jb" aria-label="JobNet posts"><div class="mmq-track"><span class="mmq-i mmq-note">Loading the latest JobNet posts…</span></div></div></div>';
  hero.appendChild(el);
  if (reduce) el.classList.add('static');
  var btn = el.querySelector('.mmq-pause');
  btn.addEventListener('click', function () { var p = !el.classList.contains('paused'); el.classList.toggle('paused', p); btn.setAttribute('aria-pressed', String(p)); btn.setAttribute('aria-label', p ? 'Play the ticker' : 'Pause the ticker'); btn.firstChild.textContent = p ? '▶' : '❚❚'; go(); });

  function fill(lane, html) {
    var tr = el.querySelector('[data-lane="' + lane + '"] .mmq-track'); if (tr.__html === html) return; tr.__html = html;
    tr.innerHTML = '<div class="mmq-set">' + html + '</div>' + (reduce ? '' : '<div class="mmq-set" aria-hidden="true">' + html + '</div>');
    tr.querySelectorAll('[aria-hidden="true"] a').forEach(function (a) { a.tabIndex = -1; });
    var set = tr.firstChild, px = set.getBoundingClientRect().width;
    if (reduce) return;
    // G: rAF-driven lane (transform only). Speed follows the content: short lanes drift slowly, long lanes move a bit faster (34–64 px/s, ~25% slower on phones).
    var L = lanes[lane] || (lanes[lane] = { tr: tr, x: 0, v: 0, dir: tr.parentNode.classList.contains('rev') ? 1 : -1 });
    L.tr = tr; L.w = px; L.speed = Math.max(34, Math.min(64, px / 40)) * (innerWidth < 640 ? 0.75 : 1); if (L.x <= -px) L.x = 0;
    tr.classList.add('raf'); go();
  }
  var lanes = {}, raf = 0, last = 0, hover = false;
  function moving() { return !el.classList.contains('paused') && !el.classList.contains('offscreen') && !d.hidden; }
  function go() { if (!raf && !reduce) { last = performance.now(); raf = requestAnimationFrame(tick); } }
  function tick(now) {
    raf = 0; var dt = Math.min(0.05, (now - last) / 1000), live = false; last = now;
    for (var k in lanes) { var L = lanes[k]; if (!L.w) continue;
      var target = moving() && !hover ? L.speed : 0; L.v += (target - L.v) * (1 - Math.exp(-dt * (target ? 2.2 : 6))); // ease in slowly, brake quickly
      L.x += L.dir * L.v * dt; if (L.x <= -L.w) L.x += L.w; if (L.x > 0) L.x -= L.w;
      L.tr.style.transform = 'translate3d(' + (L.dir < 0 ? L.x : L.x - L.w).toFixed(2) + 'px,0,0)';
      if (target || L.v > 0.5) live = true; }
    if (live && !d.hidden) raf = requestAnimationFrame(tick);
  }
  el.addEventListener('pointerenter', function () { hover = true; }); el.addEventListener('pointerleave', function () { hover = false; go(); });
  el.addEventListener('focusin', function () { hover = true; }); el.addEventListener('focusout', function () { hover = false; go(); });
  d.addEventListener('visibilitychange', function () { if (!d.hidden) go(); });

  /* ---- markets ---- */
  var FMT = { EURUSD: 5, GBPUSD: 5, AUDUSD: 5, USDJPY: 3, USDZAR: 4, XAU: 2, XAG: 2 }, NAME = { XAU: 'Gold', XAG: 'Silver', SPX: 'S&P 500', NQ: 'Nasdaq 100', DJI: 'Dow', DAX: 'DAX' };
  function mkHtml(m) {
    var items = m.rows.map(function (q) {
      var dir = q.chg == null ? '' : q.chg > 0 ? 'up' : q.chg < 0 ? 'dn' : 'flat', arrow = dir === 'up' ? '▲' : dir === 'dn' ? '▼' : dir === 'flat' ? '■' : '';
      return '<span class="mmq-i mmq-q ' + dir + (m.stale ? ' stale' : '') + '"><b>' + esc(NAME[q.sym] || q.sym) + '</b> ' + esc(q.px) +
        (arrow ? ' <span class="mmq-chg"><span aria-hidden="true">' + arrow + '</span><span class="sr">' + (dir === 'up' ? 'up' : dir === 'dn' ? 'down' : 'unchanged') + '</span> ' + Math.abs(q.chg).toFixed(2) + '%</span>' : '') +
        ' <small>' + esc(q.asof) + '</small></span>';
    });
    items.push('<span class="mmq-i mmq-src">' + (m.stale ? '<b class="mmq-stale">stale</b> last good values · ' : '') + m.src + '</span>');
    return items.join('');
  }
  function markets() {
    return get(API + '/forex/api/quote').then(function (j) {
      var rows = (j.quotes || []).filter(function (q) { return q && q.ok && q.last != null && /^(kraken|yahoo|binance)$/i.test(q.source || '') && q.t; }).map(function (q) {
        return { sym: q.symbol, px: Number(q.last).toLocaleString('en-US', { minimumFractionDigits: FMT[q.symbol] || 2, maximumFractionDigits: FMT[q.symbol] || 2 }), chg: q.change_pct == null ? null : +q.change_pct, asof: SAST(q.t * 1000, Date.now() - q.t * 1000 > 432e5) + ' SAST' };
      });
      if (!rows.length) throw new Error('no real rows');
      return { rows: rows, src: 'Prices: <a href="/apps/forex-codex/">FMC desk</a> (Kraken, Yahoo) · change vs previous close · as of times in SAST' };
    }).catch(function () {
      return get('https://open.er-api.com/v6/latest/USD').then(function (j) {
        if (j.result !== 'success' || !j.rates) throw new Error('bad');
        var asof = SAST(j.time_last_update_unix * 1000, true) + ' SAST', P = [['EURUSD', 'EUR', 1], ['GBPUSD', 'GBP', 1], ['USDJPY', 'JPY', 0], ['USDZAR', 'ZAR', 0], ['AUDUSD', 'AUD', 1]];
        return { rows: P.filter(function (p) { return j.rates[p[1]]; }).map(function (p) { var v = p[2] ? 1 / j.rates[p[1]] : j.rates[p[1]]; return { sym: p[0], px: v.toFixed(FMT[p[0]]), chg: null, asof: 'ref. rate ' + asof }; }),
          src: 'Daily reference rates by <a href="https://www.exchangerate-api.com" rel="noopener" target="_blank">ExchangeRate-API</a>' };
      });
    }).then(function (m) { m.at = Date.now(); store.set('mmq-mk', m); fill('mk', mkHtml(m)); el.setAttribute('data-mk', 'live'); },
      function () { var m = store.get('mmq-mk'); if (m && m.rows && m.rows.length) { m.stale = true; fill('mk', mkHtml(m)); el.setAttribute('data-mk', 'stale'); } else { fill('mk', '<span class="mmq-i mmq-note">Live prices are unavailable right now. Nothing is shown rather than a guess.</span>'); el.setAttribute('data-mk', 'none'); } });
  }

  /* ---- JobNet ---- */
  function jbHtml(j) {
    var when = j.scraped ? SAST(Date.parse(j.scraped), true) + ' SAST' : '';
    return j.rows.map(function (r) {
      return '<a class="mmq-i mmq-j' + (j.stale ? ' stale' : '') + '" href="/apps/jobnet/">' + (r.fresh ? '<em>new</em> ' : '') + '<b>' + esc(r.title) + '</b>' + (r.company ? ' · ' + esc(r.company) : '') + (r.loc ? ' · ' + esc(r.loc) : '') + '</a>';
    }).join('') + '<span class="mmq-i mmq-src">' + (j.stale ? '<b class="mmq-stale">stale</b> · ' : '') + 'JobNet read-only run' + (when ? ' · found ' + esc(when) : '') + ' · draft-only, nothing auto-applied</span>';
  }
  function jobs() {
    return get(API + '/jobnet/api/listings').then(function (j) {
      var rows = (j.listings || []).slice(0, 10).map(function (l) { return { title: l.title, company: l.company, loc: l.location, fresh: !!l.new_since_last_run }; }).filter(function (r) { return r.title; });
      if (!rows.length) throw new Error('empty'); return { rows: rows, scraped: j.run && j.run.scraped_at };
    }).then(function (m) { m.at = Date.now(); store.set('mmq-jb', m); fill('jb', jbHtml(m)); el.setAttribute('data-jb', 'live'); },
      function () { var m = store.get('mmq-jb'); if (m && m.rows && m.rows.length) { m.stale = true; fill('jb', jbHtml(m)); el.setAttribute('data-jb', 'stale'); } else { fill('jb', '<a class="mmq-i mmq-note" href="/apps/jobnet/">JobNet posts are unavailable right now · open JobNet</a>'); el.setAttribute('data-jb', 'none'); } });
  }

  var vis = true; if ('IntersectionObserver' in w) new IntersectionObserver(function (es) { vis = es[0].isIntersecting; el.classList.toggle('offscreen', !vis); go(); }).observe(el);
  markets(); jobs();
  setInterval(function () { if (!d.hidden && vis) markets(); }, 60000);
  setInterval(function () { if (!d.hidden && vis) jobs(); }, 600000);
  w.__mmMarquee = { el: el, lanes: lanes, get running() { return !!raf; }, refresh: function () { return Promise.all([markets(), jobs()]); } };
})();
