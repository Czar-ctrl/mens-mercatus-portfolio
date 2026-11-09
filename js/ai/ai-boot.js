/* preview wave 3 AI — boot (small, classic script). Builds the dock, the intent chip and the home AI section, and lazy-loads
   the heavier modules (js/ai/*.js) only on interaction or idle. No cookies, no tracking, no third-party requests. */
(function () {
  'use strict';
  var w = window, d = document, root = d.documentElement, CFG = w.MM_AI_CONFIG || { base: '/' }, B = CFG.base || '/';
  if (w.__mmAiBoot) return; w.__mmAiBoot = true;
  var path = location.pathname.replace(/index\.html$/, '');
  var isHome = path === B, isLab = !!d.querySelector('[data-mm-ai-page]'), isCase = /\/case-studies\/[a-z-]+\/$/.test(path), isShow = /^\/(think|cartel|apps\/(mercatus-assist|mercatus-concierge|makedas-canvas))\/$/.test(path);
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, mobile = function () { return innerWidth < 768; };
  var mods = {};
  function load(name) { return mods[name] || (mods[name] = import(B + 'js/ai/' + name + '.js?v=' + (CFG.version || 'm1'))); }
  w.MM_AI = { load: load, base: B };
  function el(tag, cls, html, attrs) { var e = d.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
  var ICON = {
    spark: '<svg class="spark" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9L12 2.5z" fill="currentColor"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" fill="currentColor" opacity=".7"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>',
    tune: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>'
  };

  /* ---------- intent (adaptive homepage) ---------- */
  var INTENTS = {
    recruiter: { label: 'Recruiter', ico: 'R', desc: 'Availability, fit and evidence first' },
    founder: { label: 'Founder / client', ico: 'F', desc: 'What he can build for your team' },
    music: { label: 'Music', ico: '♪', desc: 'SoundX AI and the studios first' },
    developer: { label: 'Developer', ico: '{}', desc: 'Architecture and code paths first' }
  };
  // section keys → order per intent (hero and the project reel always stay first: their space is reserved before paint)
  var ORDER = {
    _: ['bento', 'work', 'services', 'scatter', 'method', 'pipe', 'videos', 'ai', 'built', 'quotes', 'about'],
    recruiter: ['about', 'work', 'videos', 'ai', 'built', 'bento', 'method', 'pipe', 'quotes', 'services', 'scatter'],
    founder: ['services', 'pipe', 'quotes', 'work', 'videos', 'ai', 'method', 'bento', 'built', 'about', 'scatter'],
    music: ['bento', 'videos', 'ai', 'scatter', 'work', 'services', 'method', 'pipe', 'built', 'quotes', 'about'],
    developer: ['method', 'pipe', 'work', 'built', 'videos', 'scatter', 'bento', 'ai', 'services', 'quotes', 'about']
  };
  var CAT = [[/sound-?deck|soundx|music|beat|studio|audio/i, 'music'], [/resume|cv|contact|hire|about/i, 'recruiter'], [/case-stud|rag|method|architect|github|code/i, 'developer'], [/services|crafts|conversation|contact\/$/i, 'founder']];
  function intent() { return root.getAttribute('data-mm-intent') || ''; }
  function why() { try { return sessionStorage.getItem('mm-intent-why') || ''; } catch (e) { return ''; } }
  function setIntent(k, reason) {
    try { if (k) { sessionStorage.setItem('mm-intent', k); sessionStorage.setItem('mm-intent-why', reason || 'picked'); } else { sessionStorage.removeItem('mm-intent'); sessionStorage.setItem('mm-intent-why', 'reset'); } } catch (e) {}
    if (k) root.setAttribute('data-mm-intent', k); else root.removeAttribute('data-mm-intent');
    if (isHome) relayout();
    chipRender();
    w.dispatchEvent(new CustomEvent('mm-intent', { detail: { intent: k } }));
  }
  function keyed(wrap) {
    var q = function (s) { var n = wrap.querySelector(s); return n ? (n.parentNode.classList && n.parentNode.classList.contains('pin-spacer') ? n.parentNode : n) : null; };
    return { bento: q('.pv-bento-wrap'), work: q('section[aria-labelledby="work-heading"]'), services: q('.pv-hz'), scatter: q('.pv-scatter'),
      method: q('section[aria-labelledby="method-heading"]'), about: q('section[aria-labelledby="about-heading"]'), ai: q('.mm-home-ai'),
      pipe: q('[data-mmg="pipe"]'), videos: q('[data-mmg="videos"]'), built: q('[data-mmg="built"]'), quotes: q('[data-mmg="quotes"]') };
  }
  function reorder(wrap) {
    var K = keyed(wrap), list = ORDER[intent()] || ORDER._, anchor = null;
    // everything after the reel (or the hero) is re-appended in the chosen order; skip if the visitor is already below the fold (no visible shift)
    var fixedEnd = wrap.querySelector('.pv-mask'); fixedEnd = fixedEnd ? (fixedEnd.parentNode.classList.contains('pin-spacer') ? fixedEnd.parentNode : fixedEnd) : wrap.firstElementChild;
    anchor = fixedEnd;
    list.forEach(function (k) { var n = K[k]; if (!n) return; if (anchor.nextSibling !== n) wrap.insertBefore(n, anchor.nextSibling); anchor = n; });
  }
  function homeSection(wrap) {
    if (wrap.querySelector('.mm-home-ai')) return;
    var s = el('section', 'mm-sec mm-home-ai mm-ai', null, { 'aria-labelledby': 'mm-home-ai-h', id: 'ai-tools' });
    s.innerHTML = '<div class="mm-wrap"><p class="mm-kick">For hiring managers</p><h2 class="mm-h2" id="mm-home-ai-h">Check the fit in your browser</h2>' +
      '<p class="mm-lead">Paste a job post, see honest scores with project proof, leave your details, or suggest a call. Uses only what this site publishes. You are never auto-emailed.</p>' +
      '<div class="mm-tools mm-tools4" style="margin-top:2.4rem">' +
      tool('01', 'Score a job post', 'What you get: a fit score, proof links, honest gaps, and a one-page CV.', 'ai/#match') +
      tool('02', 'Leave your details', 'What you get: Katlego receives a follow-up note. You are not emailed automatically.', 'ai/#leads') +
      tool('03', 'Skills & proof', 'What you get: a skills map, system walkthroughs, and a proof table.', 'ai/#skills') +
      tool('04', 'Services & packages', 'What you get: AI receptionist, inbox automation, custom builds — proposed ZAR ranges.', 'services/') +
      tool('05', 'Open the AI Lab', 'What you get: all fifteen tools in one place — hire, see the work, try the AI.', 'ai/') +
      '</div><div class="mm-feedmini" data-mm-feedmini aria-label="Latest shipped"></div>' +
      '<p class="mm-note" style="margin-top:12px"><a class="mm-btn pri" href="' + B + 'services/#book">Book a call</a> &nbsp; <a class="mm-btn" href="' + B + 'ai/">Open the AI Lab</a> &nbsp; <kbd>⌘</kbd>/<kbd>Ctrl</kbd>+<kbd>K</kbd> searches the site. <span class="mm-badge">Private · in your browser</span></p></div>';
    var about = wrap.querySelector('section[aria-labelledby="about-heading"]');
    wrap.insertBefore(s, about || null);
    var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); load('feed').then(function (m) { m.mini(s.querySelector('[data-mm-feedmini]'), 3); }); } }, { rootMargin: '400px' });
    io.observe(s);
  }
  function tool(n, t, desc, href) { return '<a class="mm-tool" href="' + B + href + '"><span class="n">' + n + '</span><strong>' + t + '</strong><span>' + desc + '</span></a>'; }
  w.MM_AI.intents = INTENTS;
  w.MM_AI.setIntent = setIntent;
  w.MM_AI.intent = intent;
  w.MM_AI.relayout = function () { relayout(); };

  function relayout() {
    var main = d.querySelector('main#content'); if (!main) return; var wrap = main.querySelector('section') && main.querySelector('section').parentNode; if (!wrap) return;
    homeSection(wrap); reorder(wrap);
    if (w.__pvRelayout) w.__pvRelayout(); else if (w.ScrollTrigger) w.ScrollTrigger.refresh();
  }
  // wave-2 hook: fx-2 calls this after it has injected its sections and before it layers/pins them
  w.MM_AI_HOOKS = { beforeLayout: function (wrap) { homeSection(wrap); if (scrollY < innerHeight * 0.6) reorder(wrap); } };

  /* ---------- intent chip ---------- */
  var chip;
  function chipRender() {
    if (!isHome || !chip) return;
    var k = intent(), I = INTENTS[k];
    chip.classList.toggle('set', !!k);
    chip.querySelector('.mm-chip-btn').innerHTML = ICON.tune + (k ? '<span class="lbl">Personalised for: <b>' + I.label + '</b></span>' : '<span class="lbl">Tailor this page</span>');
    chip.querySelector('.mm-chip-btn').setAttribute('aria-label', k ? 'Personalised for ' + I.label + (why() && why() !== 'picked' ? ' (from ' + why() + ')' : '') + '. Change' : 'Tailor this page');
    chip.querySelector('.mm-chip-reset').hidden = !k;
    [].forEach.call(chip.querySelectorAll('[data-k]'), function (b) { b.setAttribute('aria-pressed', String(b.dataset.k === k)); });
  }
  function buildChip() {
    chip = el('div', 'mm-chip mm-ai', '<button type="button" class="mm-chip-btn" aria-expanded="false" aria-controls="mm-intents"></button><button type="button" class="mm-chip-reset" hidden>reset</button>' +
      '<div class="mm-intents" id="mm-intents" role="group" aria-label="Personalise this page" hidden><p>Reorders this page for you. Stored in this tab only (sessionStorage) — no cookies, no tracking.</p>' +
      Object.keys(INTENTS).map(function (k) { var I = INTENTS[k]; return '<button type="button" data-k="' + k + '" aria-pressed="false"><span class="ico" aria-hidden="true">' + I.ico + '</span><span><strong>' + I.label + '</strong><span>' + I.desc + '</span></span></button>'; }).join('') + '</div>');
    d.body.appendChild(chip);
    var btn = chip.querySelector('.mm-chip-btn'), menu = chip.querySelector('.mm-intents');
    var open = function (v) { menu.hidden = !v; btn.setAttribute('aria-expanded', String(v)); if (v) menu.querySelector('button').focus(); };
    btn.addEventListener('click', function () { open(menu.hidden); });
    chip.querySelector('.mm-chip-reset').addEventListener('click', function () { setIntent('', 'reset'); toast('Back to the default order.'); });
    menu.addEventListener('click', function (e) { var b = e.target.closest('[data-k]'); if (!b) return; open(false); setIntent(b.dataset.k, 'picked'); btn.focus(); toast('Personalised for <b>' + INTENTS[b.dataset.k].label + '</b> — sections reordered below.'); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) { open(false); btn.focus(); } });
    d.addEventListener('click', function (e) { if (!menu.hidden && !chip.contains(e.target)) open(false); });
    chipRender();
    // in-session click signals: suggest (never force) an intent after two clicks in one area
    var counts = {};
    d.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]'); if (!a || intent()) return;
      var h = a.getAttribute('href') + ' ' + a.textContent;
      for (var i = 0; i < CAT.length; i++) if (CAT[i][0].test(h)) { var k = CAT[i][1]; counts[k] = (counts[k] || 0) + 1; if (counts[k] === 2) suggestIntent(k); break; }
    }, true);
  }
  function suggestIntent(k) {
    toast('Looks like you’re here for <b>' + INTENTS[k].label + '</b>. <button type="button" class="mm-btn sm" data-mm-acc>Tailor the page</button>', 7000, function (t) {
      t.querySelector('[data-mm-acc]').addEventListener('click', function () { setIntent(k, 'your clicks'); t.remove(); });
    });
  }
  function toast(html, ms, fn) {
    var t = d.querySelector('.mm-toast'); if (t) t.remove();
    t = el('div', 'mm-toast mm-ai', html, { role: 'status' }); d.body.appendChild(t); if (fn) fn(t);
    setTimeout(function () { t.remove(); }, ms || 3200);
  }
  w.MM_AI.toast = toast;

  /* ---------- dock ---------- */
  var SR = w.SpeechRecognition || w.webkitSpeechRecognition;
  function buildDock() {
    var mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    var dock = el('div', 'mm-dock mm-ai', null, { role: 'toolbar', 'aria-label': 'AI tools' });
    dock.innerHTML = '<button type="button" class="mm-db" data-act="search" aria-label="Search the site (' + (mac ? '⌘' : 'Ctrl') + '+K)" title="Search · ' + (mac ? '⌘' : 'Ctrl') + 'K">' + ICON.search + '</button>' +
      (SR ? '<button type="button" class="mm-db mic" data-act="voice" aria-label="Voice navigation" title="Voice navigation">' + ICON.mic + '</button>' : '');
    d.body.appendChild(dock);
    dock.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'search') load('palette').then(function (m) { m.open(b); });
      if (b.dataset.act === 'voice') load('voice').then(function (m) { m.toggle(b); });
    });
    d.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); load('palette').then(function (m) { m.open(dock.querySelector('[data-act=search]')); }); }
    });
  }

  /* ---------- start ---------- */
  
  /* Services nav + Book a call (after React hydrate — avoid HTML mismatch) */
  function wireServicesLinks() {
    var nav = d.querySelector('header nav') || d.querySelector('nav[aria-label="Main"]') || d.querySelector('nav');
    if (nav && !nav.querySelector('a[href="/services/"],a[href$="/services/"]')) {
      var contact = nav.querySelector('a[href="/contact/"],a[href$="contact/"]');
      var a = el('a', contact ? contact.className : '', 'Services');
      a.href = B + 'services/';
      if (contact) nav.insertBefore(a, contact); else nav.appendChild(a);
    }
    // Hire me / Contact me in hero → Book a call on services
    [].forEach.call(d.querySelectorAll('a[href="/contact/"],a[href$="/contact/"]'), function (a) {
      var tx = (a.textContent || '').trim();
      if (/^Hire me$/i.test(tx) || /^Book a call$/i.test(tx)) {
        a.href = B + 'services/#book';
        a.textContent = 'Book a call';
      }
    });
    // footer list
    var footContact = d.querySelector('footer a[href="/contact/"], footer a[href$="contact/"]');
    if (footContact && footContact.parentNode && footContact.parentNode.tagName === 'LI') {
      var ul = footContact.parentNode.parentNode;
      if (ul && !ul.querySelector('a[href="/services/"],a[href$="/services/"]')) {
        var li = d.createElement('li');
        var fa = el('a', footContact.className, 'Services');
        fa.href = B + 'services/';
        li.appendChild(fa);
        ul.insertBefore(li, footContact.parentNode);
      }
    }
  }

  function afterHydrate(fn) {
    if (!d.querySelector('script[src*="/_next/"]')) return fn();
    var n = 0; (function tick() { var m = d.querySelector('main') || d.querySelector('h1'), ok = false;
      if (m) for (var k in m) if (k.indexOf('__reactFiber') === 0 || k.indexOf('__reactProps') === 0) { ok = true; break; }
      if (ok || ++n > 60) setTimeout(fn, 50); else setTimeout(tick, 100); })();
  }
  function start() {
    buildDock();
    // G fix: on Next pages only touch the nav after React has hydrated (editing it earlier caused React error #418 on /work/ and /case-studies/)
    afterHydrate(wireServicesLinks);
    if (isHome) setTimeout(wireServicesLinks, 3200);
    if (isHome) {
      buildChip();
      // fx-2 may have built before this script ran (its hook was not defined yet): apply the AI section + order now
      if (root.classList.contains('pv-fx2') && !d.querySelector('.mm-home-ai')) relayout();
      // without the wave-2 layer (e.g. its file removed) do the home work ourselves once React has hydrated
      setTimeout(function () { if (!root.classList.contains('pv-fx2') && !d.querySelector('.mm-home-ai')) { var m = d.querySelector('main#content'); var wr = m && m.querySelector('section') && m.querySelector('section').parentNode; if (wr) { homeSection(wr); if (scrollY < innerHeight * 0.6) reorder(wr); } } }, 4500);
    }
    if (isLab) load('lab').then(function (m) { m.mount(); });
    if (isCase || isShow) (w.requestIdleCallback || setTimeout)(function () { load('enhance').then(function (m) { m.mount({ showcase: isShow }); }); });
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else start();

  /* Option F: privacy-safe visits + adaptive + rum + lab mounts */
  try {
    var fs = d.createElement('script'); fs.type = 'module'; fs.src = B + 'js/ai/f/hub.js?v=m1'; fs.defer = true; d.head.appendChild(fs);
  } catch (e) {}
})();
