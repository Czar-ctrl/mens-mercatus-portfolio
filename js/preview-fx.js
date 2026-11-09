/* Mens Mercatus — PREVIEW effects (2026-10-20). Revert = remove this <script> + css/preview-theme.css.
 * Progressive enhancement only: if this file fails, every page still shows all content and links.
 * Runs after the page (and the Next.js hydration on the home page) has settled, so it never fights React. */
(function () {
  'use strict';
  var d = document, root = d.documentElement;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var conn = navigator.connection || {};
  var lowPower = !!conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '') || (navigator.deviceMemory && navigator.deviceMemory < 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4);
  var isHome = !!d.querySelector('main#content h1') && /^\/(index\.html)?$/.test(location.pathname);
  var SCRIPT = d.currentScript && d.currentScript.src;
  var BASE = SCRIPT ? SCRIPT.replace(/js\/preview-fx\.js.*$/, '') : '/';

  function el(tag, attrs, html) { var e = d.createElement(tag); if (attrs) for (var k in attrs) { if (k === 'class') e.className = attrs[k]; else e.setAttribute(k, attrs[k]); } if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function whenSettled(fn) {
    var go = function () { (window.requestIdleCallback || function (f) { return setTimeout(f, 60); })(fn, { timeout: 900 }); };
    if (d.readyState === 'complete') setTimeout(go, 50); else window.addEventListener('load', function () { setTimeout(go, 50); }, { once: true });
  }

  /* ---------- 7) grain ---------- */
  function grain() { if (!d.querySelector('.pv-grain')) d.body.appendChild(el('div', { class: 'pv-grain', 'aria-hidden': 'true' })); }

  /* ---------- 3) spotlight (event delegation, one listener) ---------- */
  var SPOT_SEL = '.pv-spot';
  function spotlight() {
    d.querySelectorAll('#content article, .discover-card, .pv-card').forEach(function (c) { c.classList.add('pv-spot'); });
    var raf = 0, lastE = null;
    d.addEventListener('pointermove', function (e) {
      lastE = e; if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0; var t = lastE.target && lastE.target.closest ? lastE.target.closest(SPOT_SEL) : null; if (!t) return;
        var r = t.getBoundingClientRect(); t.style.setProperty('--mouse-x', (lastE.clientX - r.left) + 'px'); t.style.setProperty('--mouse-y', (lastE.clientY - r.top) + 'px');
      });
    }, { passive: true });
  }

  /* ---------- 4) reveals ---------- */
  function reveals() {
    if (reduce || !('IntersectionObserver' in window)) return;
    var items = d.querySelectorAll('#content section h2, #content article, .pv-cell, .pv-stories, .discover-card, .section-head');
    var vh = window.innerHeight;
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('pv-in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(function (n, i) {
      var r = n.getBoundingClientRect();
      if (r.top < vh && r.bottom > 0) return; // already visible: never hide what the user can see
      n.classList.add('pv-reveal'); n.style.setProperty('--pv-delay', ((i % 4) * 70) + 'ms'); io.observe(n);
    });
    root.classList.add('pv-reveal-ready');
    setTimeout(function () { items.forEach(function (n) { n.classList.add('pv-in'); }); }, 12000); // safety net
  }

  /* ---------- 5) gradient key words ---------- */
  function gradientWords() {
    var h1 = d.querySelector('main#content h1'); if (!h1) return;
    var sub = h1.nextElementSibling; if (!sub || sub.querySelector('.pv-ai-word')) return;
    var w = d.createTreeWalker(sub, NodeFilter.SHOW_TEXT), n;
    while ((n = w.nextNode())) {
      var i = n.textContent.search(/\bAI\b/); if (i < 0) continue;
      var after = n.splitText(i); after.splitText(2); var span = el('span', { class: 'pv-ai-word' }); after.parentNode.replaceChild(span, after); span.textContent = 'AI'; break;
    }
  }

  /* ---------- 8) stories data (existing site screenshots/videos only) ---------- */
  var M = BASE + 'media/';
  var STORIES = [
    { id: 'sda', name: 'SoundX AI', cover: M + 'soundx-ai.webp', href: BASE + 'apps/soundx-ai/', cta: 'Open SoundX AI', slides: [
      { img: M + 'soundx-ai.webp', t: 'SoundX AI', p: 'AI drum station and studio. A brief becomes a full beat in one click, all on-device.' },
      { img: M + 'soundx-ai-aiplus.webp', t: 'AI+ · Top 20 tools', p: 'Timbre search, clash-fixing EQ, kick-following bass, style transfer and Mix QA.' },
      { img: M + 'soundx-ai-hub.webp', t: '22 themes, offline', p: 'Plugin rack, Afro sample packs and a working light/dark switch. No sign-in, no upload.' },
      { img: M + 'soundx-studio.webp', t: 'SoundX Studio, built in', p: 'AI Producer chat, Pattern picker, Night Shift, Snapshot and Vault, God Mode and phone pairing (Controller and Mic), now in SoundX AI.' },
      { video: M + 'demo-soundx.mp4', poster: M + 'soundx.webp', t: 'Four-step demo', p: 'Load Demo, Play, Shape master, Generate.' } ] },
    { id: 'think', name: 'THINK', cover: M + 'showcase/think-circle.webp', href: BASE + 'think/', cta: 'Open THINK', slides: [
      { img: M + 'showcase/think.webp', t: 'THINK', p: 'Gemini multimodal workspace: chat, live voice, Net Sites, Net Code, Netzar Protocol and Net Learn.' },
      { img: M + 'showcase/think-shot.webp', t: 'Pulse, Chat, Live Voice', p: 'Hosted on Mens Mercatus. The API key stays on the VPS.' } ] },
    { id: 'assist', name: 'Assist', cover: M + 'showcase/assist-circle.webp', href: BASE + 'apps/mercatus-assist/', cta: 'Open Mercatus Assist', slides: [
      { img: M + 'showcase/assist.webp', t: 'Mercatus Assist', p: 'Ask the Blueprint Robot. Gemini via /api/cartel/ when healthy, labelled DEMO coaching when not.' },
      { video: M + 'demo-assist.mp4', poster: M + 'assist.webp', t: 'Assist in action', p: 'Live, with a labelled fallback when the model is unavailable.' } ] },
    { id: 'concierge', name: 'Concierge', cover: M + 'showcase/concierge-circle.webp', href: BASE + 'apps/mercatus-concierge/', cta: 'Begin the journey', slides: [
      { img: M + 'showcase/concierge.webp', t: 'Your digital footprint. One concierge.', p: 'Concierge is the guide through Mens Mercatus, a narrative shell over the desks you already run.' },
      { img: M + 'showcase/concierge-app.webp', t: 'The builder shell', p: 'Launch Path venture coach, design picks, Plan/Build, studio, paint, Ops and role kits.' } ] },
    { id: 'cartel', name: 'Blueprint', cover: M + 'showcase/cartel-circle.webp', href: BASE + 'blueprint/', cta: 'Open Blueprint', slides: [
      { img: M + 'showcase/cartel.webp', t: 'Mens Mercatus Blueprint', p: 'Event, schematics, docs: event mode screens, seven schematics, SAMPLE books and the system prompt.' },
      { img: BASE + 'assets/marks/cartel-ace-bicycle-card-dark.webp', t: 'Mercatus Blueprint', p: 'Architecture intel: schematics and written blueprints for every system.', cover: true },
      { img: M + 'blueprint-architecture.webp', t: 'System architecture', p: 'How the services, gates and agents fit together.' } ] },
    { id: 'jobnet', name: 'JobNet Application', cover: M + 'jobnet.webp', href: BASE + 'apps/jobnet/', cta: 'Open JobNet Application', slides: [
      { img: M + 'jobnet.webp', t: 'JobNet', p: 'A daily career pipeline that ranks roles and drafts letters, with a human approval gate.' },
      { video: M + 'demo-jobnet.mp4', poster: M + 'jobnet.webp', t: 'Draft-only by design', p: 'It never auto-applies or sends mail.' } ] },
    { id: 'forex', name: 'Forex Mercatus Codex', cover: M + 'forex.webp', href: BASE + 'apps/forex-codex/', cta: 'Open the paper desk', slides: [
      { img: M + 'forex.webp', t: 'Forex Mercatus Codex', p: 'A hosted Python desk: charts, multi-market views and a paper bot.' },
      { video: M + 'demo-forex.mp4', poster: M + 'forex.webp', t: 'Paper desk tour', p: 'Chart · Multi · Flow · Bot. Not a brokerage.' } ] }
  ];

  function storiesRow() {
    var row = el('div', { class: 'pv-stories', role: 'list', 'aria-label': 'Project stories' });
    STORIES.forEach(function (s, i) {
      var b = el('button', { class: 'pv-story', type: 'button', role: 'listitem', 'aria-label': 'Open the ' + s.name + ' story', 'data-story': String(i) },
        '<span class="pv-ring"><img src="' + esc(s.cover) + '" alt="" width="70" height="70" loading="lazy" decoding="async"></span><span>' + esc(s.name) + '</span>');
      b.addEventListener('click', function () { openStory(i, b); }); row.appendChild(b);
    });
    return row;
  }

  var modal, timer = 0, cur = 0, slide = 0, opener = null, startT = 0, DUR = 5200, rafBar = 0;
  function buildModal() {
    modal = el('div', { class: 'pv-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Project story', hidden: '' });
    modal.innerHTML = '<div class="pv-sheet"><div class="pv-bars"></div><div class="pv-shead"><img alt="" width="30" height="30"><span class="pv-sname"></span>' +
      '<button class="pv-close" type="button" aria-label="Close story">×</button></div><div class="pv-stage"></div>' +
      '<button class="pv-nav prev" type="button" aria-label="Previous">Previous</button><button class="pv-nav next" type="button" aria-label="Next">Next</button>' +
      '<div class="pv-cap" aria-live="polite"><h4></h4><p></p><a class="pv-scta" target="_blank" rel="noopener"></a></div></div>';
    d.body.appendChild(modal);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeStory(); });
    modal.querySelector('.pv-close').addEventListener('click', closeStory);
    modal.querySelector('.prev').addEventListener('click', function () { go(-1); });
    modal.querySelector('.next').addEventListener('click', function () { go(1); });
    modal.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); closeStory(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if (e.key === 'Tab') { // focus trap
        var f = [].slice.call(modal.querySelectorAll('button, a[href], video[controls]')).filter(function (x) { return x.offsetParent !== null; });
        if (!f.length) return; var a = f[0], z = f[f.length - 1];
        if (e.shiftKey && d.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && d.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    });
  }
  function openStory(i, btn) {
    if (!modal) buildModal(); opener = btn || null; cur = i; slide = 0;
    modal.hidden = false; d.body.style.overflow = 'hidden';
    requestAnimationFrame(function () { modal.classList.add('open'); });
    render(); modal.querySelector('.pv-close').focus();
  }
  function closeStory() {
    if (!modal || modal.hidden) return; stopTimer(); var v = modal.querySelector('video'); if (v) v.pause();
    modal.classList.remove('open'); modal.hidden = true; d.body.style.overflow = '';
    var b = d.querySelector('.pv-story[data-story="' + cur + '"]'); if (b) b.classList.add('seen');
    if (opener) opener.focus();
  }
  function go(dir) {
    var s = STORIES[cur]; slide += dir;
    if (slide >= s.slides.length) { if (cur < STORIES.length - 1) { var b = d.querySelector('.pv-story[data-story="' + cur + '"]'); if (b) b.classList.add('seen'); cur++; slide = 0; } else { closeStory(); return; } }
    else if (slide < 0) { if (cur > 0) { cur--; slide = STORIES[cur].slides.length - 1; } else slide = 0; }
    render();
  }
  function stopTimer() { clearTimeout(timer); cancelAnimationFrame(rafBar); }
  function render() {
    stopTimer(); var s = STORIES[cur], sl = s.slides[slide];
    var bars = modal.querySelector('.pv-bars'); bars.innerHTML = s.slides.map(function (_, k) { return '<i class="' + (k < slide ? 'done' : '') + '"><b></b></i>'; }).join('');
    modal.querySelector('.pv-shead img').src = s.cover; modal.querySelector('.pv-sname').textContent = s.name;
    modal.setAttribute('aria-label', s.name + ' story, slide ' + (slide + 1) + ' of ' + s.slides.length);
    var stage = modal.querySelector('.pv-stage'); stage.innerHTML = '';
    var media;
    if (sl.video) {
      media = el('video', { src: sl.video, poster: sl.poster || '', playsinline: '', muted: '', preload: 'metadata', 'aria-label': sl.t });
      media.muted = true; if (!reduce) { media.autoplay = true; media.loop = false; } else media.setAttribute('controls', '');
      media.addEventListener('error', function () { stage.innerHTML = '<img alt="' + esc(sl.t) + '" src="' + esc(sl.poster || s.cover) + '">'; });
    } else media = el('img', { src: sl.img, alt: sl.t, decoding: 'async', class: sl.cover ? 'pv-cover' : '' });
    stage.appendChild(media);
    modal.querySelector('.pv-cap h4').textContent = sl.t; modal.querySelector('.pv-cap p').textContent = sl.p;
    var a = modal.querySelector('.pv-scta'); a.href = s.href; a.textContent = s.cta + ' →';
    if (reduce) return; // no auto-advance under reduced motion
    var bar = bars.children[slide].firstChild, dur = DUR;
    var tick = function (now) {
      if (sl.video && media.duration && isFinite(media.duration)) { dur = Math.min(media.duration * 1000, 15000); }
      var p = Math.min(1, (now - startT) / dur); bar.style.width = (p * 100) + '%';
      if (p >= 1) { go(1); return; } rafBar = requestAnimationFrame(tick);
    };
    startT = performance.now(); rafBar = requestAnimationFrame(tick);
  }

  /* ---------- 6) agent typing terminal ---------- */
  var TERM = [
    ['dim', '$ '], ['', 'agent run jobnet --daily\n'],
    ['ai', '› '], ['', 'ranked 42 roles · drafted 6 letters\n'],
    ['ai', '› '], ['', 'soundx-ai: brief → 113 BPM amapiano beat\n'],
    ['gate', '⏸ '], ['', 'send_email → waiting for human approval\n'],
    ['ok', '✓ '], ['', 'nothing irreversible ran without a yes\n']
  ];
  function typeTerm(body) {
    var full = TERM.map(function (x) { return x[0] ? '<span class="' + x[0] + '">' + esc(x[1]) + '</span>' : esc(x[1]); }).join('');
    if (reduce) { body.innerHTML = full + '<span class="pv-caret" aria-hidden="true"></span>'; return; }
    body.setAttribute('aria-label', TERM.map(function (x) { return x[1]; }).join('')); 
    var seg = 0, ch = 0, started = false;
    var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting && !started) { started = true; step(); io.disconnect(); } });
    io.observe(body);
    function step() {
      var html = '';
      for (var k = 0; k < seg; k++) { var x = TERM[k]; html += x[0] ? '<span class="' + x[0] + '">' + esc(x[1]) + '</span>' : esc(x[1]); }
      if (seg < TERM.length) { var y = TERM[seg]; var part = esc(y[1].slice(0, ch)); html += y[0] ? '<span class="' + y[0] + '">' + part + '</span>' : part; }
      body.innerHTML = html + '<span class="pv-caret" aria-hidden="true"></span>';
      if (seg >= TERM.length) return;
      ch++; if (ch > TERM[seg][1].length) { seg++; ch = 0; setTimeout(step, TERM[seg - 1][1].slice(-1) === '\n' ? 420 : 40); return; }
      setTimeout(step, 18 + Math.random() * 34);
    }
  }

  /* ---------- 2) bento: skills · flagship apps (SoundX AI featured) · about ---------- */
  function bento() {
    var main = d.querySelector('main#content'); var hero = main && main.querySelector('section'); if (!hero || d.querySelector('.pv-bento-wrap')) return;
    var wrap = el('section', { class: 'pv-bento-wrap', 'aria-labelledby': 'pv-bento-heading', 'data-preview': 'theme-2026-10-20' });
    wrap.innerHTML =
      '<div class="pv-bento-inner">' +
      '<p class="pv-kicker">Flagship · Skills · About</p>' +
      '<h2 id="pv-bento-heading" class="pv-h2">Systems that ship, with <span class="pv-ai-word">AI</span> behind a human gate</h2>' +
      '<p class="pv-sub">Tap a story for a quick tour, or open any app. Everything here runs in the browser.</p>' +
      '<div class="pv-stories-slot"></div>' +
      '<div class="pv-bento">' +
        '<a class="pv-card pv-cell pv-b-feature" href="' + BASE + 'apps/soundx-ai/" target="_blank" rel="noopener">' +
          '<div class="pv-media"><img src="' + M + 'soundx-ai-reel.webp" alt="SoundX AI studio with drum pads, mixer and AI tools" width="1600" height="1000" loading="lazy" decoding="async"></div>' +
          '<span class="pv-tag">Flagship · New</span><h3>SoundX <span class="pv-ai-word">AI</span></h3>' +
          '<p>An AI drum station and studio. Producer Agent, plugin rack, Afro sample packs, 20 on-device AI tools and 22 themes. Audio stays on your machine.</p>' +
          '<div class="pv-chips"><span class="pv-chip">20 AI tools</span><span class="pv-chip">9 sample packs</span><span class="pv-chip">22 themes</span><span class="pv-chip">Offline</span></div>' +
          '<span class="pv-cta">Open SoundX AI <span aria-hidden="true">→</span></span></a>' +
        '<div class="pv-card pv-cell pv-b-wide pv-term" role="group" aria-label="Agent log"><div class="pv-term-bar"><i></i><i></i><i></i><b>agent · live log</b></div><div class="pv-term-body"></div></div>' +
        '<div class="pv-card pv-cell"><span class="pv-tag">Skills</span><h3>Stack</h3><ul class="pv-skills"><li class="pv-chip">Agentic workflows</li><li class="pv-chip">.NET · ASP.NET Core</li><li class="pv-chip">React · TypeScript</li><li class="pv-chip">Python</li><li class="pv-chip">Web Audio · DSP</li><li class="pv-chip">On-device ML</li><li class="pv-chip">Gemini · LLM tools</li></ul></div>' +
        '<div class="pv-card pv-cell"><span class="pv-tag">Rule</span><div class="pv-stat">1 <small>human gate</small></div><p>On every irreversible step: send, pay, apply, delete.</p></div>' +
        '<a class="pv-card pv-cell" href="' + BASE + 'apps/jobnet/"><span class="pv-tag">Career pipeline</span><h3>JobNet Application</h3><p>Ranks roles and drafts letters. Draft-only, never auto-sends.</p><span class="pv-cta">Open demo <span aria-hidden="true">→</span></span></a>' +
        '<a class="pv-card pv-cell" href="' + BASE + 'apps/mercatus-assist/" target="_blank" rel="noopener"><span class="pv-tag">Multimodal</span><h3>Assist &amp; THINK</h3><p>.NET service and React workspace calling Gemini from the server.</p><span class="pv-cta">Open Assist <span aria-hidden="true">→</span></span></a>' +
        '<a class="pv-card pv-cell pv-b-wide" href="' + BASE + 'resume/"><span class="pv-tag">About</span><h3>Who you would be hiring</h3><p>Self-taught, 4 years’ experience, available immediately. I want a team that ships applied AI with clear ownership: model calls behind a service, a human decision before anything irreversible, and production habits on the first public version.</p><span class="pv-cta">Read the résumé <span aria-hidden="true">→</span></span></a>' +
      '</div></div>';
    // insert where nothing visible moves (zero layout shift): after the first section boundary below the viewport
    var secs = [].slice.call(hero.parentNode.children).filter(function (n) { return n.tagName === 'SECTION'; });
    var vh = window.innerHeight, before = null;
    for (var i = 1; i < secs.length; i++) { if (secs[i].getBoundingClientRect().top > vh) { before = secs[i]; break; } }
    if (!before) { for (var j = 2; j < secs.length; j++) { if (secs[j].getBoundingClientRect().top > vh) { before = secs[j]; break; } } }
    if (before) hero.parentNode.insertBefore(wrap, before); else hero.parentNode.appendChild(wrap);
    wrap.querySelector('.pv-stories-slot').appendChild(storiesRow());
    typeTerm(wrap.querySelector('.pv-term-body'));
  }

  /* ---------- 1) hero glass refraction ---------- */
  function staticOrbs(h1) {
    // static "glass beads" around (not over) the headline: decorative, never hide the words
    var box = h1.parentNode; if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
    var rg = d.createRange(); rg.selectNodeContents(h1); var t = rg.getBoundingClientRect(), b = box.getBoundingClientRect();
    var L = t.left - b.left, T = t.top - b.top, W = t.width, H = t.height;
    var o = el('div', { class: 'pv-orbs', 'aria-hidden': 'true' });
    var orb = function (sz, x, y) { return '<span class="pv-orb" style="width:' + sz + 'px;height:' + sz + 'px;left:' + Math.round(x) + 'px;top:' + Math.round(y) + 'px"></span>'; };
    o.style.inset = '0';
    o.innerHTML = orb(58, L + W - 22, T - 8) + orb(30, L + W + 46, T + H * 0.55) + orb(18, L - 30, T + H * 0.62);
    box.insertBefore(o, box.firstChild);
  }
  function webglOK() { try { var c = d.createElement('canvas'); return !!(window.WebGL2RenderingContext && c.getContext('webgl2')); } catch (e) { return false; } }
  function heroGlass() {
    var h1 = d.querySelector('main#content section h1'); if (!h1) return;
    var canAnimate = !reduce && !lowPower && window.innerWidth >= 768 && webglOK();
    if (!canAnimate) { if (window.innerWidth >= 640) staticOrbs(h1); return; }
    staticOrbs(h1); // visible until the WebGL scene is ready
    var isDark = function () { return root.classList.contains('dark'); };
    // the WebGL headline is tuned for the dark theme; light mode keeps the CSS gradient text + static glass orbs
    new MutationObserver(function () {
      if (!isDark() && window.__pvGlass) { window.__pvGlass.destroy(); window.__pvGlass = null; }
      else if (isDark() && !window.__pvGlass && started) mount();
    }).observe(root, { attributes: true, attributeFilter: ['class'] });
    var started = false;
    var mount = function () { if (!isDark()) return; import(BASE + 'js/preview-hero-glass.js?v=m4').then(function (m) { if (isDark() && !window.__pvGlass) window.__pvGlass = m.mountHeroGlass(h1); }).catch(function (e) { root.classList.remove('pv-glass-on'); if (window.console) console.warn('[preview-fx] glass fallback:', e && e.message); }); };
    var start = function () { started = true; (d.fonts && d.fonts.ready ? d.fonts.ready : Promise.resolve()).then(mount); };
    // lazy: only when the hero is on screen
    if ('IntersectionObserver' in window) { var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); start(); } }); io.observe(h1); } else start();
  }

  function init() {
    try { grain(); } catch (e) {}
    if (isHome) { try { gradientWords(); } catch (e) {} try { bento(); } catch (e) {} try { heroGlass(); } catch (e) {} }
    try { spotlight(); } catch (e) {}
    try { reveals(); } catch (e) {}
    root.classList.add('pv-fx');
  }
  whenSettled(init);
  window.__pvStories = { open: function (i) { openStory(i || 0); }, close: closeStory };
})();
