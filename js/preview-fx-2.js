/* Mens Mercatus — PREVIEW wave 2 effects (2026-10-20). Revert = remove the "wave 2" include block.
 * Uses self-hosted GSAP 3.15 + ScrollTrigger (GSAP Standard "no charge" licence) and Lenis 1.3 (MIT).
 * Progressive enhancement: without JS (or without GSAP) every section, link and text stays visible. */
(function () {
  'use strict';
  var d = document, root = d.documentElement, w = window;
  var reduce = w.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = w.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
  var desk = function () { return w.innerWidth >= 768; };
  var isHome = /^\/(index\.html)?$/.test(location.pathname) && !!d.querySelector('main#content h1');
  var SCRIPT = d.currentScript && d.currentScript.src;
  var BASE = SCRIPT ? SCRIPT.replace(/js\/preview-fx-2\.js.*$/, '') : '/';
  var M = BASE + 'media/';
  var G = w.gsap, ST = w.ScrollTrigger;
  var hasG = !!(G && ST) && !reduce;
  if (hasG) G.registerPlugin(ST);
  function el(tag, cls, html) { var e = d.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  /* ---------- 1) preloader: runs immediately (script is deferred, so the DOM exists) ---------- */
  function preloader(done) {
    if (!root.classList.contains('pv-preload')) { done(); return; }
    try { sessionStorage.setItem('pv-preloaded', '1'); } catch (e) {}
    var pre = el('div', 'pv-pre', '<div class="pv-pre-num" aria-hidden="true"><span>0</span><small>%</small></div><div class="pv-pre-bar" aria-hidden="true"><i></i></div><div class="pv-pre-name">Mens Mercatus · Katlego Mokoto</div>');
    pre.setAttribute('aria-hidden', 'true'); d.body.appendChild(pre);
    root.classList.remove('pv-preload'); // the inline cover is replaced by the real preloader (same colour)
    var num = pre.querySelector('span'), bar = pre.querySelector('.pv-pre-bar i');
    var finish = function () { pre.remove(); done(); };
    if (!G) { setTimeout(finish, 300); return; }
    var o = { v: 0 }, R = Math.hypot(w.innerWidth, w.innerHeight) / 2 + 40;
    G.timeline({ onComplete: finish })
      .to(o, { v: 100, duration: 0.72, ease: 'power2.inOut', onUpdate: function () { num.textContent = Math.round(o.v); bar.style.setProperty('--p', o.v / 100); } })
      .to(pre, { '--pv-r': R + 'px', duration: 0.42, ease: 'power3.in' }, '+=0.02');
  }

  /* ---------- 2) split headings (screen readers get the untouched text) ---------- */
  function split(h) {
    if (h.dataset.pvSplit) return; h.dataset.pvSplit = '1';
    var text = h.textContent.replace(/\s+/g, ' ').trim();
    var vis = el('span'); vis.setAttribute('aria-hidden', 'true');
    [].slice.call(h.childNodes).forEach(function (n) {
      if (n.nodeType === 3) {
        n.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return; if (/^\s+$/.test(part)) { vis.appendChild(d.createTextNode(' ')); return; }
          var o = el('span', 'pv-w'), i = el('span', 'pv-wi'); i.textContent = part; o.appendChild(i); vis.appendChild(o);
        });
      } else if (n.nodeType === 1) { var o2 = el('span', 'pv-w'), i2 = el('span', 'pv-wi'); i2.appendChild(n.cloneNode(true)); o2.appendChild(i2); vis.appendChild(o2); }
    });
    var sr = el('span', 'pv-sr2'); sr.textContent = text;
    h.textContent = ''; h.appendChild(sr); h.appendChild(vis); h.classList.add('pv-split');
    h.classList.remove('pv-reveal'); h.classList.add('pv-in');
    var words = vis.querySelectorAll('.pv-wi');
    G.set(words, { yPercent: 110 });
    ST.create({ trigger: h, start: 'top 88%', once: true, onEnter: function () { G.to(words, { yPercent: 0, duration: 0.9, ease: 'expo.out', stagger: 0.055 }); } });
  }

  /* ---------- 3+4) project reel ---------- */
  var TILES = [ // BP: four flagships up front (name, image, path, problem it solves); everything else is in "More builds" below
    ['JobNet Application', 'jobnet.webp', 'apps/jobnet/', 'Job hunting by hand is slow and auto-apply bots are reckless. JobNet shortlists, matches and drafts, then waits for a human yes.'],
    ['SoundX AI', 'soundx-ai-reel.webp', 'apps/soundx-ai/', 'A beat studio with on-device AI in any browser: no install, no sign-in, audio never leaves the device.'],
    ['Forex Mercatus Codex', 'forex.webp', 'apps/forex-codex/', 'Market research without broker risk: a live paper-only desk with a session-scoped paper bot. Not advice.'],
    ['Mercatus Assist', 'showcase/assist-card.webp', 'apps/mercatus-assist/', 'A live Gemini assistant on a C# / ASP.NET Core API. The key stays on the server, and it says DEMO when the model is busy.']];
  var MORE = [ // [name, tag, path, one line]
    ['Mercatus Concierge', 'DEMO', 'apps/makedas-canvas/', 'A guided front door that walks a visitor through each desk, step by step.'],
    ['THINK', 'LIVE', 'think/', 'Gemini multimodal workspace: chat, image, live voice.'],
    ['Mens Mercatus Blueprint', 'Systems', 'blueprint/', 'Animated system blueprints for every app.'],
    ['Event Net', 'DEMO', 'apps/event-net/', 'One event shift, simulated in the browser.'],
    ['NET Gemini workspace', 'DEMO', 'apps/net-workspace/', 'The C# / .NET and Gemini stack, shown with sample JSON.']];
  function moreBuilds(after) {
    if (d.getElementById('mm-more-h')) return null;
    if (after.parentNode.classList.contains('pin-spacer')) after = after.parentNode; // M4: go after the reel's pin wrapper, not inside it (inside, it shifted the pin start and switched the mouse pan off early)
    var sec = el('section', 'mm-more-home'); sec.setAttribute('aria-labelledby', 'mm-more-h');
    sec.innerHTML = '<div class="mm-more-wrap"><p class="pv-kicker">More builds</p><h2 id="mm-more-h" class="mm-more-h">Smaller builds you can open right now</h2><ul class="mm-more" role="list">' +
      MORE.map(function (m) { return '<li><a href="' + BASE + m[2] + '"><span class="mm-more-tag">' + m[1] + '</span><strong>' + m[0] + '</strong><span>' + m[3] + '</span></a></li>'; }).join('') +
      '</ul><p class="mm-more-all"><a href="' + BASE + 'apps/">All apps →</a></p></div>';
    after.parentNode.insertBefore(sec, after.nextSibling); return sec;
  }
  var CI = Math.max(0, TILES.findIndex(function (t) { return /soundx-ai\//.test(t[2]); }));
  var NUM = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'][TILES.length] || String(TILES.length);
  function reel(hero) {
    var sec = el('section', 'pv-mask'); sec.setAttribute('aria-labelledby', 'pv-reel-h');
    sec.innerHTML = '<div class="pv-mask-stage"><div class="pv-mask-copy"><p class="pv-kicker">Flagship systems · 2026</p><h2 id="pv-reel-h" class="pv-h2">' + NUM + ' flagship systems</h2></div>' +
      '<div class="pv-reel" role="list">' + TILES.map(function (t, i) {
        return '<a class="pv-tile" role="listitem" href="' + BASE + t[2] + '" target="_blank" rel="noopener" data-i="' + i + '"><img src="' + M + t[1] + '" alt="' + t[0] + ' screenshot" width="1200" height="750" loading="' + (Math.abs(i - CI) < 2 ? 'eager' : 'lazy') + '" decoding="async"><span class="pv-tcap pv-tcap--prob">' + t[0] + '<small>' + t[3] + '</small></span></a>';
      }).join('') + '</div>' +
      '<div class="pv-expander" aria-hidden="true"><img src="' + M + 'soundx-ai-reel.webp" alt="" width="1600" height="1000" decoding="async"></div>' +
      '<div class="pv-exp-cap"><p class="pv-kicker">New flagship</p><h3>SoundX AI</h3><a class="pv-btn pv-magnet" href="' + BASE + 'apps/soundx-ai/" target="_blank" rel="noopener" tabindex="-1">Open SoundX AI <span aria-hidden="true">→</span></a></div></div>';
    hero.parentNode.insertBefore(sec, hero.nextSibling);
    root.classList.add('pv-mask-in'); // same frame: the reserved space becomes the section (no layout shift)
    if (!root.classList.contains('pv-pin')) return sec;
    var track = sec.querySelector('.pv-reel'), stage = sec.querySelector('.pv-mask-stage'), exp = sec.querySelector('.pv-expander'), cap = sec.querySelector('.pv-exp-cap');
    var centre = track.children[CI], others = [].slice.call(track.children).filter(function (x) { return x !== centre; });
    // 4) M7 pan: mouse position (opposite to the pointer), horizontal wheel / trackpad / Shift+wheel, ← → keys, the ‹ › buttons and touch/pen drag
    //    all steer one eased target. The range always reaches both end tiles fully (plus a 32px margin), at least 12vw each way. It keeps working in the
    //    first part of the pin and hands back to centre while the SoundX grow takes over (k: 1 → 0); the expander moves with the reel until then, so the
    //    grow always starts exactly on the SoundX tile.
    // SX2: vertical wheel / trackpad now tours the four flagships in order (JobNet → SoundX → Forex → Assist, each centred and lit in turn),
    //      returns to SoundX for the grow, then the page scrolls on. Before, the wheel only ever drove the SoundX grow.
    var tl = null, pan = 0, tgt = 0, last = 0, k = 1, tour = { p: 0 }, TOUR = 1.4, onI = -2;
    var tiles = [].slice.call(track.children);
    var offX = function (i) { var t = tiles[i]; return -(t.offsetLeft + t.offsetWidth / 2 - track.offsetWidth / 2); };
    var tourX = function (p) { var a = Math.max(0, Math.min(tiles.length - 1, Math.floor(p))), b = Math.min(tiles.length - 1, a + 1), f = p - a; return offX(a) + (offX(b) - offX(a)) * f; };
    var range = function () { var tw = track.offsetWidth, sw = stage.clientWidth || w.innerWidth; return Math.max(w.innerWidth * 0.12, (tw - sw) / 2 + 32); };
    var clampT = function (v) { var m = range(); return Math.max(-m, Math.min(m, v)); };
    var inView = function () { var r = sec.getBoundingClientRect(); return r.bottom > 0 && r.top < w.innerHeight; };
    var steer = function (v) { tgt = clampT(v); };
    var nudge = function (dir) { var t = track.children[0], step = t ? t.offsetWidth + parseFloat(getComputedStyle(track).columnGap || 0) : w.innerWidth * 0.28; steer(tgt - dir * step); };
    var nav = el('div', 'pv-reel-nav', '<button type="button" class="pv-reel-btn" data-d="-1" aria-label="Show earlier flagship systems"><span aria-hidden="true">‹</span></button><span class="pv-reel-hint">Scroll, move the mouse or use ← →</span><button type="button" class="pv-reel-btn" data-d="1" aria-label="Show later flagship systems"><span aria-hidden="true">›</span></button>');
    stage.appendChild(nav);
    nav.addEventListener('click', function (e) { var b = e.target.closest('.pv-reel-btn'); if (b) nudge(+b.getAttribute('data-d')); });
    if (fine) w.addEventListener('pointermove', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse') return; if (k < 0.05 || !inView()) return;
      if (Date.now() - last < 900) return; // a wheel/key/drag just moved the reel: let it rest until the mouse moves again later
      steer(-(e.clientX / w.innerWidth * 2 - 1) * range());
    }, { passive: true });
    sec.addEventListener('wheel', function (e) {
      if (k < 0.05) return; var dx = e.deltaX, dy = e.deltaY;
      if (!dx && e.shiftKey) dx = dy; else if (Math.abs(dx) <= Math.abs(dy)) return; // vertical scroll stays with the page
      e.preventDefault(); e.stopPropagation(); last = Date.now(); steer(tgt - dx * (e.deltaMode === 1 ? 16 : 1));
    }, { passive: false });
    d.addEventListener('keydown', function (e) {
      if ((e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || e.altKey || e.ctrlKey || e.metaKey || k < 0.05 || !inView()) return;
      var a = d.activeElement; if (a && a !== d.body && !sec.contains(a)) return; if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return;
      var r = sec.getBoundingClientRect(); if (!sec.contains(a) && (Math.min(r.bottom, w.innerHeight) - Math.max(r.top, 0)) < w.innerHeight * 0.4) return;
      e.preventDefault(); last = Date.now(); nudge(e.key === 'ArrowRight' ? 1 : -1);
    });
    track.addEventListener('focusin', function (e) { // Tab to a tile → bring it fully on screen
      var t = e.target.closest('.pv-tile'); if (!t) return; last = Date.now();
      var c = t.offsetLeft + t.offsetWidth / 2 - track.offsetWidth / 2; steer(-c);
    });
    var drag = null;
    track.addEventListener('pointerdown', function (e) { if (e.pointerType === 'mouse') return; drag = { x: e.clientX, y: e.clientY, t: tgt, on: false }; }, { passive: true });
    w.addEventListener('pointermove', function (e) {
      if (!drag) return; var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.on && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) drag.on = true;
      if (drag.on) { last = Date.now(); steer(drag.t + dx * 1.2); }
    }, { passive: true });
    var endDrag = function () { if (drag && drag.on) { var stop = function (ev) { ev.preventDefault(); ev.stopPropagation(); }; track.addEventListener('click', stop, { capture: true, once: true }); setTimeout(function () { track.removeEventListener('click', stop, true); }, 400); } drag = null; };
    w.addEventListener('pointerup', endDrag, { passive: true }); w.addEventListener('pointercancel', function () { drag = null; }, { passive: true });
    G.set(track, { translate: 'none', xPercent: -50, yPercent: -42, x: 0 }); // M7: own the CSS centring explicitly (GSAP dropped the -50% when it parsed it at some widths, e.g. 768px)
    var setT = G.quickSetter(track, 'x', 'px'), setE = G.quickSetter(exp, 'x', 'px'), setN = G.quickSetter(nav, 'opacity');
    G.ticker.add(function (t, dt) {
      var tt = tl ? tl.time() : 0, u = Math.max(0, Math.min(1, tt / 0.15)); k = 1 - u * u * (3 - 2 * u);
      if (k < 0.05) tgt = 0;
      pan += (tgt - pan) * (1 - Math.exp(-(dt || 16) / 260));
      if (Math.abs(tgt - pan) < 0.05) pan = tgt;
      var x = Math.round((pan * k + tourX(tour.p) * (1 - k)) * 10) / 10; if (x !== setT.v) { setT(x); setE(x); setT.v = x; }
      var oi = k < 0.5 ? Math.round(tour.p) : -1; if (oi !== onI) { onI = oi; track.classList.toggle('pv-touring', oi >= 0); tiles.forEach(function (t, i) { t.classList.toggle('pv-on', i === oi); }); }
      var o = k > 0.05 ? Math.min(1, k * 1.4) : 0; if (o !== setN.v) { setN(o); nav.style.pointerEvents = o > 0.3 ? '' : 'none'; setN.v = o; }
    });
    w.__pvReel = { range: range, steer: steer, nudge: nudge, state: function () { return { tgt: tgt, pan: pan, k: k, x: +G.getProperty(track, 'x') }; } };
    // 3) scroll-linked expanding mask (pinned, scrubbed, reversible)
    var rectInset = function () {
      var s = stage.getBoundingClientRect(), c = centre.getBoundingClientRect(), x = G.getProperty(track, 'x') || 0; // clip is measured with the reel at rest; the expander's own x follows the pan
      var l = c.left - x - s.left, t = c.top - s.top;
      return 'inset(' + t + 'px ' + (s.width - l - c.width) + 'px ' + (s.height - t - c.height) + 'px ' + l + 'px round 16px)';
    };
    // SX1: one eased value drives both the clip window and the image framing, so the SoundX screenshot fills the window at every step of the
    //      grow (before, the clip and the image scale were tweened separately and drifted apart mid-grow: black gaps, cut-off edges)
    var grow = { t: 0 }, eimg = exp.querySelector('img');
    var paint = function () {
      var e = grow.t, st = stage.getBoundingClientRect(), c = centre.getBoundingClientRect(), x = G.getProperty(track, 'x') || 0;
      var W = st.width, H = st.height, l = (c.left - x - st.left) * (1 - e), t = (c.top - st.top) * (1 - e);
      var rw = c.width + (W - c.width) * e, rh = c.height + (H - c.height) * e;
      exp.style.clipPath = 'inset(' + t + 'px ' + (W - l - rw) + 'px ' + (H - t - rh) + 'px ' + l + 'px round ' + (16 * (1 - e)) + 'px)';
      G.set(eimg, { x: l + rw / 2 - W / 2, y: t + rh / 2 - H / 2, scale: Math.max(rw / W, rh / H) });
      exp.style.setProperty('--pv-exp-shade', e);
    };
    tl = G.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: sec, start: 'top top', end: '+=290%', pin: true, pinType: 'transform', anticipatePin: 1, scrub: 0.6, invalidateOnRefresh: true } });
    var mv = function (p) { return { p: p, duration: 0.15, ease: 'power2.inOut' }; }; // tour: glide to JobNet (0–0.15), then hold 0.15 on each card, 0.15 between cards
    tl.to(tour, mv(1), 0.3).to(tour, mv(2), 0.6).to(tour, mv(3), 0.9)
      .to(tour, { p: CI, duration: 0.2, ease: 'power2.inOut' }, 1.2);
    tl.set(exp, { visibility: 'visible' }, TOUR + 0.001)
      .to(others, { opacity: 0, yPercent: function (i) { return i % 2 ? 18 : -18; }, scale: 0.92, duration: 0.35, stagger: 0.02 }, TOUR)
      .to(sec.querySelector('.pv-mask-copy'), { opacity: 0, y: -30, duration: 0.25 }, TOUR)
      .fromTo(grow, { t: 0 }, { t: 1, duration: 0.6, ease: 'power2.inOut', onUpdate: paint }, TOUR + 0.08)
      .to(cap, { opacity: 1, y: 0, duration: 0.2, onStart: function () { cap.querySelector('a').removeAttribute('tabindex'); } }, TOUR + 0.62)
      .to({}, { duration: 0.18 });
    G.set(cap, { y: 30 });
    paint(); ST.addEventListener('refresh', paint);
    return sec;
  }

  /* ---------- 5) horizontal services ---------- */
  var SERVICES = [
    ['Agentic workflows', 'Career pipelines that rank roles, draft letters and then wait for a human yes.', 'JobNet Application', 'jobnet.webp', 'apps/jobnet/'],
    ['Full-stack .NET', 'ASP.NET Core services with retries, rate limits and health checks on the first public version.', 'Mercatus Assist', 'assist.webp', 'apps/mercatus-assist/'],
    ['Multimodal assistants', 'Model calls behind a server, with a labelled fallback when the model is unavailable.', 'THINK', 'think.webp', 'think/'],
    ['Browser audio + on-device ML', 'Web Audio DSP, tempo and key detection and a Producer Agent, all inside the tab.', 'SoundX AI', 'soundx-ai.webp', 'apps/soundx-ai/'],
    ['Research desks', 'Python desks with live charts and a session-scoped paper bot. Never a brokerage.', 'Forex Mercatus Codex', 'forex.webp', 'apps/forex-codex/'],
    ['Architecture & blueprints', 'Schematics and written blueprints for how every system is designed and gated.', 'Blueprint', 'blueprint-architecture.webp', 'blueprint/']];
  function services(after) {
    var sec = el('section', 'pv-hz'); sec.setAttribute('aria-labelledby', 'pv-hz-h');
    sec.innerHTML = '<div class="pv-hz-head"><p class="pv-kicker">What I build</p><h2 id="pv-hz-h" class="pv-h2">Six skills, each proven by a system you can open</h2><p class="pv-sub" style="margin-top:.8rem"><a class="pv-btn pv-magnet" href="' + BASE + 'services/">Fixed-price packages for SA businesses <span aria-hidden="true">→</span></a></p></div>' +
      '<div class="pv-hz-viewport"><div class="pv-hz-track" role="list">' + SERVICES.map(function (s, i) {
        return '<article class="pv-card pv-panel pv-spot" role="listitem"><span class="pv-num">0' + (i + 1) + '</span><h3>' + s[0] + '</h3><p>' + s[1] + '</p>' +
          '<div class="pv-pthumb"><img src="' + M + s[3] + '" alt="' + s[2] + ' screenshot" width="1200" height="600" loading="lazy" decoding="async"></div>' +
          '<a class="pv-plink" href="' + BASE + s[4] + '" target="_blank" rel="noopener">See it in ' + s[2] + ' <span aria-hidden="true">→</span></a></article>';
      }).join('') + '<article class="pv-card pv-panel pv-panel-end" role="listitem"><span class="pv-kicker">Next</span><h3>Your team’s next system</h3><p>Available immediately. On-site, hybrid or remote in Johannesburg, Pretoria, Cape Town or Durban.</p><a class="pv-btn pv-magnet" style="margin-top:18px" href="' + BASE + 'services/">See services &amp; packages <span aria-hidden="true">→</span></a></article>' +
      '</div></div><div class="pv-hz-progress" aria-hidden="true"><i></i></div>';
    after.parentNode.insertBefore(sec, after.nextSibling);
    if (!root.classList.contains('pv-pin')) return sec;
    var mm = G.matchMedia();
    mm.add('(min-width: 768px)', function () {
      var track = sec.querySelector('.pv-hz-track'), bar = sec.querySelector('.pv-hz-progress i');
      var dist = function () { return Math.max(0, track.scrollWidth - w.innerWidth); };
      G.to(track, { x: function () { return -dist(); }, ease: 'none', scrollTrigger: { trigger: sec, start: 'top top', end: function () { return '+=' + dist(); }, pin: true, pinType: 'transform', anticipatePin: 1, scrub: 0.8, invalidateOnRefresh: true,
        onUpdate: function (self) { bar.style.transform = 'scaleX(' + self.progress + ')'; } } });
    });
    return sec;
  }

  /* ---------- 9) parallax scatter ---------- */
  function scatter(before) {
    var sec = el('section', 'pv-scatter'); sec.setAttribute('aria-labelledby', 'pv-sc-h');
    var F = [
      ['img', 'soundx-ai-aiplus.webp', 6, 10, 21, 0.5, ''], ['img', 'soundx-studio.webp', 72, 7, 20, -0.35, ''], ['img', 'jobnet.webp', 78, 62, 17, 0.7, 'hide-m'],
      ['img', 'think.webp', 4, 66, 18, -0.55, 'hide-m'], ['img', 'forex.webp', 40, 84, 15, 0.3, 'hide-m'],
      ['code', '<b>await</b> gate.<i>approve</i>(draft)  <u>// human yes</u>', 9, 46, 0, -0.8, ''],
      ['code', 'policy: <i>never_auto_send</i>', 70, 40, 0, 0.9, ''],
      ['code', 'bpm = <b>detect</b>(onsets) <u>// 112.5</u>', 58, 74, 0, -0.45, 'hide-m'],
      ['code', 'retry(<i>3</i>, backoff=<i>"exp"</i>)', 30, 6, 0, 0.6, 'hide-m']];
    sec.innerHTML = '<div class="pv-scatter-copy"><p class="pv-kicker">Receipts</p><h2 id="pv-sc-h" class="pv-h2" style="font-size:clamp(2.4rem,5vw,3.6rem)">Screens, code and a human gate</h2><p class="pv-sub">Every claim on this page links to something you can open, run or read.</p></div>' +
      F.map(function (f) {
        var pos = 'left:' + f[2] + '%;top:' + f[3] + '%;' + (f[4] ? 'width:' + f[4] + 'vw;min-width:150px;' : '');
        return '<div class="pv-float ' + f[6] + '" aria-hidden="true" data-speed="' + f[5] + '" style="' + pos + '">' + (f[0] === 'img' ? '<img src="' + M + f[1] + '" alt="" width="1200" height="750" loading="lazy" decoding="async">' : '<div class="pv-code">' + f[1] + '</div>') + '</div>';
      }).join('');
    before.parentNode.insertBefore(sec, before);
    if (hasG) sec.querySelectorAll('.pv-float').forEach(function (f) {
      var s = parseFloat(f.dataset.speed);
      G.fromTo(f, { y: -s * 220 }, { y: s * 220, ease: 'none', scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: 0.5 } });
    });
    return sec;
  }

  /* ---------- 6) background colour shifts + 7) stacking sections ---------- */
  function colourShift(list) {
    if (!hasG) return;
    list.forEach(function (p) {
      ST.create({ trigger: p[0], start: 'top 60%', end: 'bottom 60%', onToggle: function (self) { if (self.isActive) root.style.setProperty('--pv-bg', p[1]); } });
    });
  }
  var stackT = [], stackEls = [];
  function stack(pairs) {
    if (!hasG) return;
    stackT.forEach(function (t) { if (t.scrollTrigger) t.scrollTrigger.kill(); t.kill(); }); stackT = [];
    stackEls.forEach(function (n) { n.classList.remove('pv-stack', 'pv-over'); n.style.top = ''; n.style.removeProperty('--pv-dim'); }); stackEls = [];
    pairs.forEach(function (p, i) {
      p[0].classList.add('pv-stack'); p[1].classList.add('pv-over'); stackEls.push(p[0], p[1]);
      stackT.push(G.fromTo(p[0], { '--pv-dim': 0 }, { '--pv-dim': 1, ease: 'none', scrollTrigger: { trigger: p[1], start: 'top bottom', end: 'top top', scrub: true } }));
    });
    stack.pairs = pairs; setTops();
    if (!stack.l) { stack.l = 1; ST.addEventListener('refreshInit', setTops); }
  }
  function setTops() { (stack.pairs || []).forEach(function (p) { p[0].style.top = Math.min(0, w.innerHeight - p[0].offsetHeight) + 'px'; }); }
  // stack pairs come from DOM adjacency, so a reordered page (wave-3 intent) still stacks correctly
  function adjPairs(list) {
    var P = []; list.forEach(function (s) { if (!s || s.parentNode.classList.contains('pin-spacer')) return; var n = s.nextElementSibling; if (!n || n.classList.contains('pin-spacer') || n.tagName === 'FOOTER') return; P.push([s, n]); }); return P;
  }
  function layers(wrap) {
    [].slice.call(wrap.children).forEach(function (n, i) {
      var t = n.classList.contains('pin-spacer') ? n.firstElementChild : n; if (!t || i === 0) return;
      t.classList.add('pv-layer'); t.style.setProperty('--pv-z', 10 + i);
    });
  }

  /* ---------- 8) magnetic CTAs + floating contact pill ---------- */
  function magnetic(scope) {
    if (!hasG || !fine) return;
    var sel = '.pv-btn, .pv-scta, .pv-pill, .pv-magnet, header a[href="/contact/"], header a[href$="contact/"], main#content section:first-of-type a[href="/work/"], main#content section:first-of-type a[href^="/cv/"]';
    (scope || d).querySelectorAll(sel).forEach(function (a) {
      if (a.dataset.pvMag) return; a.dataset.pvMag = '1'; a.classList.add('pv-mag');
      var qx = G.quickTo(a, 'x', { duration: 0.45, ease: 'power3.out' }), qy = G.quickTo(a, 'y', { duration: 0.45, ease: 'power3.out' });
      a.addEventListener('pointermove', function (e) { var r = a.getBoundingClientRect(); qx((e.clientX - r.left - r.width / 2) * 0.35); qy((e.clientY - r.top - r.height / 2) * 0.45); });
      a.addEventListener('pointerleave', function () { G.to(a, { x: 0, y: 0, duration: 1.1, ease: 'elastic.out(1, 0.35)', overwrite: true }); });
    });
  }
  function pill() {
    var a = el('a', 'pv-pill', '<span class="dot" aria-hidden="true"></span>Book a call <span aria-hidden="true">→</span>'); a.href = BASE + 'services/#book'; a.setAttribute('aria-label','Book a call');
    d.body.appendChild(a);
    var foot = d.querySelector('footer');
    var upd = function () { var y = w.scrollY, fb = foot ? foot.getBoundingClientRect().top : 1e9; a.classList.toggle('on', y > w.innerHeight * 0.7 && fb > w.innerHeight - 40); };
    w.addEventListener('scroll', upd, { passive: true }); upd();
  }

  /* ---------- 10) cursor polish: grow the site's own ring on interactive elements ---------- */
  function cursor() {
    if (!fine || reduce) return;
    d.addEventListener('pointerover', function (e) { var t = e.target.closest && e.target.closest('a,button,[role=button],summary,label,.pv-tile'); root.classList.toggle('pv-cur-link', !!t); }, { passive: true });
  }

  /* ---------- smooth scroll (Lenis), desktop + fine pointer only ---------- */
  var lenis = null;
  function smooth() {
    if (!hasG || !fine || !w.Lenis || !desk()) return;
    lenis = new w.Lenis({ lerp: 0.11, smoothWheel: true, anchors: true });
    lenis.on('scroll', ST.update); G.ticker.add(function (t) { lenis.raf(t * 1000); }); G.ticker.lagSmoothing(0);
    // pause while a story modal (or anything else) locks the page
    new MutationObserver(function () { if (d.body.style.overflow === 'hidden') lenis.stop(); else lenis.start(); }).observe(d.body, { attributes: true, attributeFilter: ['style'] });
    w.__pvLenis = lenis;
  }

  function build() {
    if (!isHome) { magnetic(); cursor(); return; }
    var main = d.querySelector('main#content'), hero = main.querySelector('section');
    var wrap = hero.parentNode;
    var bySel = function (s) { return wrap.querySelector(s); };
    smooth(); // first, so pins know whether Lenis drives the scroll (transform pins = no layout shift)
    // pin only when Lenis drives the scroll (transform pins, zero layout shift); otherwise native swipe rows
    var pin = !!(hasG && lenis && desk()); root.classList.add(pin ? 'pv-pin' : 'pv-swipe');
    var mask = reel(hero);
    try { moreBuilds(mask); } catch (e) { }
    var work = bySel('section[aria-labelledby="work-heading"]'), bento = bySel('.pv-bento-wrap'), method = bySel('section[aria-labelledby="method-heading"]'), about = bySel('section[aria-labelledby="about-heading"]');
    var hz = work ? services(work) : null;
    var sc = method ? scatter(method) : null;
    // wave-3 AI hook (separate file): inject the AI section and apply the visitor's intent order before stacking/layering
    try { if (w.MM_AI_HOOKS && w.MM_AI_HOOKS.beforeLayout) w.MM_AI_HOOKS.beforeLayout(wrap); } catch (e) { }
    if (hasG) {
      d.querySelectorAll('#content section h2, .pv-h2').forEach(split);
      colourShift([[hero, '#151011'], [mask, '#0a0809'], [bento, '#130b1e'], [work, '#0b0a0c'], [hz, '#07110f'], [sc, '#0e0a14'], [method, '#0c0b0d'], [about, '#140b10']].filter(function (p) { return p[0]; }));
      var stackable = [bento, sc, method];
      if (desk()) {
        stack(adjPairs(stackable));
        // layer every section in DOM order (opaque), so sticky ones stay underneath the following content
        layers(wrap);
      }
      w.__pvRelayout = function () { if (desk()) { stack(adjPairs(stackable)); layers(wrap); } ST.refresh(); };
    }
    pill(); magnetic(); cursor();
    if (hasG) { ST.refresh(); w.addEventListener('load', function () { ST.refresh(); }); if (d.fonts) d.fonts.ready.then(function () { ST.refresh(); }); }
    root.classList.add('pv-fx2');
  }

  function afterFx1(fn) {
    if (!isHome || root.classList.contains('pv-fx')) { fn(); return; }
    var mo = new MutationObserver(function () { if (root.classList.contains('pv-fx')) { mo.disconnect(); fn(); } });
    mo.observe(root, { attributes: true, attributeFilter: ['class'] });
    setTimeout(function () { mo.disconnect(); if (!root.classList.contains('pv-fx2')) fn(); }, 4000);
  }
  var built = false;
  var go = function () { if (built) return; built = true; try { build(); } catch (e) { root.classList.add('pv-mask-in'); if (w.console) console.warn('[preview-fx-2]', e); } };
  preloader(function () {});
  afterFx1(go);
})();
