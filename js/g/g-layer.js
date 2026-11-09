/* Option G layer (preview). Loaded on idle by js/mm-motion.js, never before first paint.
   - Contact cluster: WhatsApp chat + "Book a call" (opens a booking panel; uses BOOKING_URL when set, otherwise the existing suggest-a-time flow → email / WhatsApp the visitor sends themselves).
   - Home: automation pipeline visual, 30-second app tours (click-to-play, captions), "Built this week" (data/built-this-week.json) + technical overview PDF, testimonials (real entries only).
   - /work/: technical overview PDF + app tours. /case-studies/: client stories only when data/case-studies/clients.json has published entries.
   No cookies, no tracking, no third-party requests until the visitor clicks out (WhatsApp / Google Calendar). */
(function () {
  'use strict';
  var w = window, d = document, root = d.documentElement;
  if (w.__mmG) return; w.__mmG = true;

  /* ======== CONFIG: paste Katlego's Google Calendar appointment-schedule link here (https://calendar.app.google/… or https://calendar.google.com/calendar/appointments/schedules/…) ======== */
  var BOOKING_URL = '';
  /* ============================================================================================================================================================================ */
  var C = (w.MM_AI_CONFIG && w.MM_AI_CONFIG.g) || {};
  if (C.BOOKING_URL) BOOKING_URL = C.BOOKING_URL;
  if (!/^https:\/\/(calendar\.app\.google|calendar\.google\.com)\//.test(BOOKING_URL)) BOOKING_URL = ''; // only a real Google Calendar link is accepted
  var WA_NUM = '27658424274', EMAIL = 'katlego.mokoto.km@gmail.com';
  var WA_TEXT = "Hi Katlego, I saw your portfolio and I'd like to talk about an AI automation for my business.";
  var PDF = { href: '/docs/mens-mercatus-portfolio-systems.pdf?v=b106ef14', pages: 21, size: '5.3 MB' };
  var V = 'g3';
  var path = location.pathname.replace(/index\.html$/, '');
  var isHome = path === '/', reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function el(tag, cls, html, attrs) { var e = d.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
  function waLink(text) { return 'https://wa.me/' + WA_NUM + '?text=' + encodeURIComponent(text || WA_TEXT); }
  function getJSON(u) { return fetch(u, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  // small JSON files: fetch right after the sections mount so their final height is known before anyone scrolls past them
  function soon(fn) { setTimeout(fn, 0); }
  var rlT; function relayoutSoon() { clearTimeout(rlT); rlT = setTimeout(relayoutNow, 120); }
  function near(node, fn, margin) { if (!('IntersectionObserver' in w)) return fn(); var io = new IntersectionObserver(function (es) { if (es.some(function (x) { return x.isIntersecting; })) { io.disconnect(); fn(); } }, { rootMargin: margin || '500px' }); io.observe(node); }
  var SAST = function (iso, withTime) { var t = new Date(iso); if (isNaN(t)) return ''; var o = { day: 'numeric', month: 'short', timeZone: 'Africa/Johannesburg' }; if (withTime) { o.hour = '2-digit'; o.minute = '2-digit'; o.hour12 = false; } return t.toLocaleString('en-ZA', o).replace(',', '') + (withTime ? ' SAST' : ''); };
  w.MM_G = { BOOKING_URL: BOOKING_URL, waLink: waLink };

  d.addEventListener('visibilitychange', function () { root.classList.toggle('mmg-hidden', d.hidden); });

  /* ---------- icons ---------- */
  var WA_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#25D366" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z"/><path fill="#fff" d="M17.3 14.5c-.3-.1-1.7-.8-1.9-.9-.3-.1-.5-.1-.7.1l-.9 1.1c-.2.2-.3.2-.6.1a7.6 7.6 0 0 1-3.8-3.3c-.3-.5.3-.5.8-1.6.1-.2 0-.4 0-.5l-.9-2c-.2-.5-.4-.5-.6-.5h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2c.2-.6.2-1 .1-1.2l-.5-.4z"/></svg>';
  var IC = {
    scrape: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg>',
    ai: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9z"/></svg>',
    draft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 6h16v12H4z"/><path d="M4 7l8 6 8-6"/></svg>',
    gate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.2-3.6 4-5 7-5s5.8 1.4 7 5"/></svg>',
    play: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>'
  };

  /* ---------- 5 + 6) contact cluster and booking panel ---------- */
  var fab, dlg, lastFocus = null;
  function buildFab() {
    if (d.querySelector('.mmg-fab') || /^\/(plan)\//.test(path)) return;
    root.classList.add('mmg-on');
    fab = el('div', 'mmg-fab', null, { role: 'group', 'aria-label': 'Contact Katlego' });
    fab.innerHTML = '<a class="mmg-wa" href="' + esc(waLink()) + '" target="_blank" rel="noopener" data-magnetic aria-label="Chat with Katlego on WhatsApp (opens WhatsApp in a new tab)">' + WA_SVG + '<span class="lbl">WhatsApp</span></a>' +
      '<a class="mmg-book" href="/services/#book" role="button" aria-haspopup="dialog" aria-controls="mmg-book-dlg" data-magnetic><span class="dot" aria-hidden="true"></span>Book a call</a>';
    d.body.appendChild(fab);
    // phones: the site's own bottom bar (call + Book a call) stays; the cluster then shows only WhatsApp, just above that bar
    var bar = function () { var b = d.querySelector('div.fixed.inset-x-0.bottom-0'); return b && getComputedStyle(b).display !== 'none' && b.offsetHeight ? b : null; };
    var fitBar = function () { var b = bar(); root.classList.toggle('mmg-hasbar', !!b); if (b) root.style.setProperty('--mmg-bar', b.offsetHeight + 'px'); };
    fitBar(); w.addEventListener('resize', fitBar, { passive: true }); setTimeout(fitBar, 1500);
    fab.querySelector('.mmg-book').addEventListener('click', function (e) { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); openBook(this); });
    var foot = d.querySelector('footer'), footIn = false, ticking = 0;
    var thresh = function () { return isHome ? innerHeight * 0.55 : 160; };
    var upd = function () { ticking = 0; var on = scrollY > thresh() && !footIn && !(dlg && !dlg.hidden); fab.classList.toggle('on', on); root.classList.toggle('mmg-fab-on', on); };
    if (foot && 'IntersectionObserver' in w) new IntersectionObserver(function (es) { footIn = es[0].isIntersecting; upd(); }, { rootMargin: '0px 0px -40px 0px' }).observe(foot);
    w.addEventListener('scroll', function () { if (!ticking) ticking = requestAnimationFrame(upd); }, { passive: true }); upd();
    // other "Book a call" links on the page open the same panel
    // capture phase on window: runs before Next's <Link> handler, which would otherwise route to /services/
    w.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href$="#book"], .pv-pill'); if (!a || a.closest('.mmg-fab') || a.closest('.mmg-dlg') || e.metaKey || e.ctrlKey) return;
      if (path === '/services/' && !a.closest('.mm-svc-card,.mm-f-hero-actions')) return;
      e.preventDefault(); e.stopPropagation(); openBook(a);
    }, true);
    if (location.hash === '#book' && path !== '/services/') openBook(null);
  }
  function openBook(from) {
    lastFocus = from || d.activeElement;
    if (!dlg) {
      dlg = el('div', 'mmg-dlg', null, { id: 'mmg-book-dlg', hidden: '' });
      var body = BOOKING_URL
        ? '<p>Pick a free 30-minute slot in Katlego\'s calendar. Times are in your zone; Katlego works in Johannesburg (SAST, UTC+2).</p>' +
          '<div class="mmg-row"><a class="mmg-btn pri" href="' + esc(BOOKING_URL) + '" target="_blank" rel="noopener">Pick a free slot ↗</a><a class="mmg-btn" href="' + esc(waLink()) + '" target="_blank" rel="noopener">WhatsApp instead</a></div>' +
          '<p class="mmg-note">Opens Google Calendar\'s booking page in a new tab; Google\'s privacy policy applies there. Nothing loads from Google until you click.</p>'
        : '<p>Choose a time that suits you. Katlego works in Johannesburg (SAST, UTC+2); each slot also shows your local time.</p>' +
          '<div data-mmg-slots><p class="mmg-note">Loading times…</p></div>' +
          '<div class="mmg-row"><a class="mmg-btn pri" data-mmg-mail href="mailto:' + EMAIL + '">Email this request</a><a class="mmg-btn" data-mmg-wa href="' + esc(waLink()) + '" target="_blank" rel="noopener">Send on WhatsApp</a></div>' +
          '<p class="mmg-note">Nothing is sent from this site. Your email app or WhatsApp opens with the text filled in, and you press send. Katlego replies to confirm.</p>';
      dlg.innerHTML = '<div class="mmg-sheet" role="dialog" aria-modal="true" aria-labelledby="mmg-book-h"><button type="button" class="mmg-x" aria-label="Close">✕</button>' +
        '<p class="mmg-kick">Book a call</p><h2 id="mmg-book-h">Talk to Katlego</h2>' + body +
        '<p class="mmg-note" style="margin-top:12px"><a href="/services/" style="color:inherit">See packages</a> · <a href="tel:+27658424274" style="color:inherit">065 842 4274</a> · <a href="mailto:' + EMAIL + '" style="color:inherit">' + EMAIL + '</a></p></div>';
      d.body.appendChild(dlg);
      dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.closest('.mmg-x')) closeBook(); });
      dlg.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.preventDefault(); closeBook(); }
        if (e.key === 'Tab') { var f = [].filter.call(dlg.querySelectorAll('a[href],button,textarea,input,select'), function (n) { return n.offsetParent; }); if (!f.length) return; var a = f[0], z = f[f.length - 1]; if (e.shiftKey && d.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && d.activeElement === z) { e.preventDefault(); a.focus(); } }
      });
      if (!BOOKING_URL) mountSlots(dlg.querySelector('[data-mmg-slots]'));
    }
    dlg.hidden = false; requestAnimationFrame(function () { dlg.classList.add('on'); });
    d.body.style.overflow = 'hidden';
    if (fab) fab.classList.remove('on');
    setTimeout(function () { var f = dlg.querySelector('.mm-f-slots button, .mmg-btn.pri, .mmg-x'); if (f) f.focus(); }, 30);
  }
  function closeBook() {
    if (!dlg) return; dlg.classList.remove('on'); d.body.style.overflow = '';
    if (w.__pvLenis) try { w.__pvLenis.start(); } catch (e) { }
    setTimeout(function () { dlg.hidden = true; w.dispatchEvent(new Event('scroll')); }, reduce ? 0 : 220);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function mountSlots(host) {
    import('/js/ai/f/booking.js?v=' + V).then(function (m) {
      m.mount(host, {});
      var out = host.querySelector('[data-out]'), mail = dlg.querySelector('[data-mmg-mail]'), wa = dlg.querySelector('[data-mmg-wa]');
      var sync = function () {
        var t = out ? out.textContent : ''; var subj = (t.match(/^Subject: (.*)$/m) || [, 'Call with Katlego Mokoto'])[1];
        var bodyTxt = t.replace(/^Subject: .*\n+/, '').replace(/\n*Pages I viewed:.*$/m, '');
        mail.href = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(bodyTxt);
        var when = (bodyTxt.match(/Proposed time: (.*)/) || [, ''])[1];
        wa.href = waLink("Hi Katlego, I saw your portfolio and I'd like to book a call" + (when ? ' on ' + when : '') + '.');
      };
      [].forEach.call(host.querySelectorAll('.mm-f-slots button'), function (b, i) { b.setAttribute('aria-pressed', String(i === 0)); b.addEventListener('click', function () { [].forEach.call(host.querySelectorAll('.mm-f-slots button'), function (x) { x.setAttribute('aria-pressed', String(x === b)); }); setTimeout(sync); }); });
      var ta = host.querySelector('textarea'); if (ta) ta.addEventListener('input', function () { setTimeout(sync); });
      sync();
    }).catch(function () { host.innerHTML = '<p class="mmg-note">Email or WhatsApp Katlego with a time that suits you (SAST, UTC+2).</p>'; });
  }

  /* ---------- 9) home: automation pipeline ---------- */
  function pipeSection() {
    var s = el('section', 'mmg-sec mmg-pipe', null, { 'aria-labelledby': 'mmg-pipe-h', 'data-mmg': 'pipe' });
    var N = [
      ['01', 'Scrape', 'Collects public job posts on a schedule.', IC.scrape, ''],
      ['02', 'AI tailor', 'Ranks each post against real CV evidence and tailors a letter.', IC.ai, ''],
      ['03', 'Draft', 'Saves the letter as a Gmail draft. Nothing is sent.', IC.draft, ''],
      ['04', 'Review', 'Katlego reads it and decides. A person makes every irreversible decision.', IC.gate, ' gate']];
    s.innerHTML = '<div class="mmg-wrap"><p class="mmg-kick">How an automation runs here · JobNet</p><h2 id="mmg-pipe-h">Scrape, tailor, draft, then a human says yes</h2>' +
      '<p class="mmg-lead">The same four steps run JobNet every day, and they are the pattern behind the business automations on the services page: the AI does the slow work, and a person makes the call.</p>' +
      '<ol class="mmg-pipe-flow">' + N.map(function (n) { return '<li class="mmg-node' + n[4] + '"><span class="n">' + n[0] + '</span><span class="ico" aria-hidden="true">' + n[3] + '</span><h3>' + n[1] + '</h3><p>' + n[2] + '</p><span class="mmg-link" aria-hidden="true"><i></i></span></li>'; }).join('') + '</ol>' +
      '<div class="mmg-links"><a class="mmg-btn" href="/apps/jobnet/">Open JobNet Application</a><a class="mmg-btn" href="/services/">Get an automation for your business</a></div></div>';
    if (!reduce && 'IntersectionObserver' in w) new IntersectionObserver(function (es) { s.classList.toggle('run', es[0].isIntersecting); }, { threshold: 0.2 }).observe(s);
    return s;
  }

  /* ---------- 8) app tours ---------- */
  function videosSection(id) {
    var s = el('section', 'mmg-sec mmg-videos', null, { 'aria-labelledby': (id || 'mmg-vid') + '-h', 'data-mmg': 'videos' });
    s.innerHTML = '<div class="mmg-wrap"><p class="mmg-kick">30-second tours</p><h2 id="' + (id || 'mmg-vid') + '-h">See the apps run</h2>' +
      '<p class="mmg-lead">Screen recordings of the live apps with a South African English voice-over. Captions are on; nothing plays until you press play.</p><div class="mmg-vids" data-mmg-vids></div></div>';
    soon(function () {
      getJSON('/data/g/videos.json?v=' + V).then(function (j) {
        var box = s.querySelector('[data-mmg-vids]');
        box.innerHTML = j.items.map(function (v) {
          return '<article class="mmg-vid" data-id="' + esc(v.id) + '"><div class="frame"><img src="' + esc(v.poster + (v.rev ? '?v=' + v.rev : '')) + '" alt="' + esc(v.title) + ' app screen" loading="lazy" decoding="async" width="1280" height="720">' +
            '<button type="button" class="play" aria-label="Play the ' + esc(v.title) + ' tour, ' + Math.round(v.duration) + ' seconds, with sound and captions"><span>' + IC.play + 'Play · ' + Math.round(v.duration) + ' s</span></button></div>' +
            '<div class="meta"><h3>' + esc(v.title) + '</h3><a href="' + esc(v.app_url.replace('https://mensmercatus.online', '')) + '">Open the app →</a>' +
            '<details><summary>Transcript</summary><p>' + esc(v.transcript) + '</p></details></div></article>';
        }).join('');
        box.addEventListener('click', function (e) {
          var b = e.target.closest('.play'); if (!b) return; var card = b.closest('.mmg-vid'), v = j.items.filter(function (x) { return x.id === card.dataset.id; })[0];
          [].forEach.call(box.querySelectorAll('video'), function (x) { x.pause(); });
          var f = card.querySelector('.frame');
          f.innerHTML = '<video controls playsinline preload="auto" poster="' + esc(v.poster + (v.rev ? '?v=' + v.rev : '')) + '" aria-label="' + esc(v.title) + ' tour"><source src="' + esc(v.video + (v.rev ? '?v=' + v.rev : '')) + '" type="video/mp4"><track kind="captions" srclang="en-ZA" label="English (South Africa)" src="' + esc(v.captions + (v.rev ? '?v=' + v.rev : '')) + '" default></video>';
          var vid = f.querySelector('video'); var p = vid.play(); if (p && p.catch) p.catch(function () { }); vid.focus();
        });
        relayout();
      }).catch(function () { s.remove(); relayout(); });
    });
    return s;
  }

  /* ---------- 4 + 7) built this week + technical overview ---------- */
  function docCard() {
    return '<a class="mmg-doc" href="' + PDF.href + '" target="_blank" rel="noopener" type="application/pdf" data-mmg-pdf><span class="mmg-kick">Technical overview · PDF</span><strong>Every system, AI model and tool behind this site</strong>' +
      '<span>Architecture, each app, the AI and ML stack, privacy under POPIA, speed and SEO, deploys and tests. Same dark design as the site.</span><em>' + PDF.pages + ' pages · ' + PDF.size + '</em><b>Download the technical overview</b></a>';
  }
  function builtSection() {
    var s = el('section', 'mmg-sec mmg-built', null, { 'aria-labelledby': 'mmg-built-h', 'data-mmg': 'built' });
    s.innerHTML = '<div class="mmg-wrap"><p class="mmg-kick">Build in public</p><h2 id="mmg-built-h">Built this week</h2><p class="mmg-lead">Work that went live on this site, newest first, with times in South African time. Each item links to a real commit.</p>' +
      '<div class="mmg-built-grid"><ol class="mmg-feed" data-mmg-feed aria-live="off"><li><p>Loading…</p></li></ol>' + docCard() + '</div></div>';
    soon(function () {
      getJSON('/data/built-this-week.json').then(function (j) {
        var all = (j.entries || []).filter(function (e) { return e && e.status === 'live' && e.title && e.date; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
        var weekAgo = Date.now() - 7 * 864e5, week = all.filter(function (e) { return Date.parse(e.date) >= weekAgo; });
        var list = (week.length ? week : all).slice(0, 10);
        if (!week.length) s.querySelector('h2').textContent = 'Recently built';
        if (!list.length) { s.querySelector('[data-mmg-feed]').remove(); return; }
        s.querySelector('[data-mmg-feed]').innerHTML = list.map(function (e) {
          var src = (e.source || []).map(function (x) { return x.repo + ' ' + x.commit; }).join(' · ');
          return '<li><time datetime="' + esc(e.date) + '">' + esc(SAST(e.date, true)) + '</time><span class="pj">' + esc(e.project) + '</span>' +
            '<h3>' + (e.link ? '<a href="' + esc(e.link) + '">' + esc(e.title) + '</a>' : esc(e.title)) + '</h3><p>' + esc(e.summary) + '</p>' + (src ? '<small>commit ' + esc(src) + '</small>' : '') + '</li>';
        }).join('');
        relayout();
      }).catch(function () { var f = s.querySelector('[data-mmg-feed]'); if (f) f.remove(); relayout(); });
    });
    return s;
  }

  /* ---------- 3) testimonials: nothing at all unless real, approved entries exist ---------- */
  function testimonials(insert) {
    getJSON('/data/testimonials.json').then(function (j) {
      var q = (j.entries || []).filter(function (t) { return t && t.permission === true && t.quote && t.name && t.role; });
      if (!q.length) return;
      var s = el('section', 'mmg-sec mmg-testi', null, { 'aria-labelledby': 'mmg-testi-h', 'data-mmg': 'quotes' });
      s.innerHTML = '<div class="mmg-wrap"><p class="mmg-kick">Clients and colleagues</p><h2 id="mmg-testi-h">In their words</h2><div class="mmg-quotes">' + q.map(function (t) {
        return '<figure class="mmg-quote"><blockquote>“' + esc(t.quote) + '”</blockquote><figcaption><b>' + esc(t.name) + '</b>, ' + esc(t.role) + (t.company ? ' · ' + esc(t.company) : '') + (t.date ? ' · ' + esc(t.date) : '') + (t.source ? ' · <a href="' + esc(t.source) + '" rel="noopener">source</a>' : '') + '</figcaption></figure>';
      }).join('') + '</div></div>';
      insert(s);
    }).catch(function () { });
  }

  /* ---------- 2) client stories (renders only with published entries) ---------- */
  function clientStories(insert) {
    getJSON('/data/case-studies/clients.json').then(function (j) {
      var c = (j.entries || []).filter(function (x) { return x && x.published === true && x.slug && x.title; });
      if (!c.length) return;
      var s = el('section', 'mmg-sec', null, { 'aria-labelledby': 'mmg-cl-h', 'data-mmg': 'clients' });
      s.innerHTML = '<div class="mmg-wrap"><p class="mmg-kick">Client work</p><h2 id="mmg-cl-h">Before and after</h2><div class="mmg-vids">' + c.map(function (x) {
        return '<a class="mmg-doc" href="/case-studies/client/?id=' + encodeURIComponent(x.slug) + '"><span class="mmg-kick">' + esc(x.industry || 'Client') + '</span><strong>' + esc(x.title) + '</strong><span>' + esc(x.summary || '') + '</span></a>';
      }).join('') + '</div></div>';
      insert(s);
    }).catch(function () { });
  }

  /* ---------- placement ---------- */
  function homeWrap() { var main = d.querySelector('main#content'); var sec = main && main.querySelector('section'); return sec && sec.parentNode; }
  function outer(n) { return n && n.parentNode && n.parentNode.classList && n.parentNode.classList.contains('pin-spacer') ? n.parentNode : n; }
  function home() {
    var wrap = homeWrap(); if (!wrap || wrap.querySelector('[data-mmg]')) return;
    var method = outer(wrap.querySelector('section[aria-labelledby="method-heading"]')), ai = outer(wrap.querySelector('.mm-home-ai')), about = outer(wrap.querySelector('section[aria-labelledby="about-heading"]'));
    var after = function (ref, n) { if (ref && ref.parentNode === wrap) wrap.insertBefore(n, ref.nextSibling); else wrap.insertBefore(n, about && about.parentNode === wrap ? about : null); };
    var pipe = pipeSection(), vids = videosSection('mmg-vid'), built = builtSection();
    after(method, pipe); after(pipe, vids); after(ai, built);
    testimonials(function (s) { wrap.insertBefore(s, about && about.parentNode === wrap ? about : null); relayout(); });
    relayout();
  }
  function relayout() { relayoutSoon(); }
  function relayoutNow() { if (w.MM_AI && w.MM_AI.relayout) w.MM_AI.relayout(); else if (w.__pvRelayout) w.__pvRelayout(); else if (w.ScrollTrigger) w.ScrollTrigger.refresh(); }
  function work() {
    var main = d.querySelector('main#content') || d.querySelector('main'); if (!main || main.querySelector('[data-mmg]')) return;
    var band = el('div', 'mmg-wrap', '<div class="mmg-docband" data-mmg="doc"><span><b style="color:inherit">Technical overview</b> · how every system, AI model and tool on this site fits together (' + PDF.pages + ' pages, ' + PDF.size + ' PDF)</span><a class="mmg-btn pri" href="' + PDF.href + '" target="_blank" rel="noopener" type="application/pdf" data-mmg-pdf>Download the technical overview</a></div>');
    band.style.paddingBottom = '0'; main.appendChild(band); main.appendChild(videosSection('mmg-wvid'));
  }
  function caseStudies() { var main = d.querySelector('main#content') || d.querySelector('main'); if (main) clientStories(function (s) { main.appendChild(s); }); }
  function services() {
    var faq = d.getElementById('faq'); if (faq) testimonials(function (s) { faq.parentNode.insertBefore(s, faq); });
  }

  function css(cb) { if (d.querySelector('link[href*="/css/g.css"]')) return cb(); var l = el('link', null, null, { rel: 'stylesheet', href: '/css/g.css?v=' + V }); l.onload = l.onerror = cb; d.head.appendChild(l); }
  css(function () {
    buildFab();
    if (isHome) home(); else if (path === '/work/') work(); else if (path === '/case-studies/') caseStudies(); else if (path === '/services/') services();
    w.dispatchEvent(new CustomEvent('mmg-ready'));
  });
})();
