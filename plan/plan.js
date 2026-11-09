/* /plan/ — on-device AI automation plan. Deterministic: keyword retrieval over plan-kb.json (patterns + verbatim proof quotes).
   No network calls except loading plan-kb.json. No prices, no promised results. "Book a call" is a mailto: nothing is sent automatically. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var KB = null, biz = null, pains = new Set();
  var WHY = {
    inbox: 'Messages from {customers} pile up across WhatsApp and email, and good replies take time.',
    assistant: '{Customers} ask the same questions, often when you are closed.',
    drafts: 'Quotes, letters and paperwork are written from scratch each time.',
    monitor: 'Keeping an eye on prices, stock, tenders or listings is manual checking.',
    match: 'Each request has to be read and routed to the right service, product or person.',
    docs: 'Slips, invoices and forms are typed in by hand.',
    numbers: 'The numbers are there, but it is hard to see what they say.',
    ops: 'Bookings, shifts and check-ins run on memory and messages, and no-shows cost money.',
    voice: 'Your hands are busy on the job when you need information.'
  };
  var BIZ_WORDS = [[/spaza|tuck|shop|store|dealer|retail|kiosk/i, 'spaza'], [/salon|barber|hair|nail|beauty|spa\b/i, 'salon'], [/plumb|electric|builder|construct|handyman|repair|mechanic|car wash/i, 'trades'],
    [/law|legal|attorney|advocate|conveyanc/i, 'law'], [/clinic|doctor|dentist|dental|medical|physio|pharmac|vet/i, 'clinic'], [/online|e-?commerce|shopify|webshop|store online/i, 'ecommerce'],
    [/restaurant|takeaway|take-away|food|cafe|caf\u00e9|catering|bakery|kota|shisa/i, 'restaurant'], [/estate|property|rental|landlord|letting/i, 'property'], [/account|bookkeep|tax|payroll|audit/i, 'accounting'],
    [/tutor|school|training|academy|teach|crèche|creche/i, 'tutoring'], [/courier|logistic|delivery|transport|freight|taxi/i, 'logistics'], [/event|hospitality|staffing|venue|wedding/i, 'events']];
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function fill(t, b) { var c = b.customer, cs = c + 's'; return t.replace(/\{customers\}/g, cs).replace(/\{Customers\}/g, cap(cs)).replace(/\{customer\}/g, c).replace(/\{Customer\}/g, cap(c)); }
  function score(p, texts) {
    var s = 0, hit = null;
    texts.forEach(function (t) { var low = t.text.toLowerCase(); p.kw.forEach(function (k) { if (low.indexOf(k) > -1) { s += t.w; if (!hit || t.w > hit.w) hit = t; } }); });
    return { s: s, hit: hit };
  }
  function plan() {
    var free = $('[data-biz-text]').value.trim(), extra = $('[data-pain-text]').value.trim();
    var b = biz;
    if (!b && free) { for (var i = 0; i < BIZ_WORDS.length; i++) if (BIZ_WORDS[i][0].test(free)) { b = KB.businesses.filter(function (x) { return x.id === BIZ_WORDS[i][1]; })[0]; break; } }
    if (!b) b = { id: 'general', label: 'Small business', customer: 'customer', pains: ['whatsapp messages', 'questions', 'quotes', 'follow up'] };
    var label = free || b.label;
    var texts = [];
    pains.forEach(function (p) { texts.push({ text: p, w: 3, user: true }); });
    if (extra) texts.push({ text: extra, w: 2, user: true });
    if (!pains.size && !extra) b.pains.forEach(function (p) { texts.push({ text: p, w: 1 }); });
    else b.pains.forEach(function (p) { texts.push({ text: p, w: 0.5 }); });
    var ranked = KB.patterns.map(function (p, i) { var r = score(p, texts); return { p: p, s: r.s, hit: r.hit, i: i }; })
      .filter(function (x) { return x.s > 0; }).sort(function (a, b2) { return b2.s - a.s || a.i - b2.i; }).slice(0, 4);
    ['inbox', 'assistant', 'drafts'].forEach(function (id) { if (ranked.length < 3 && !ranked.some(function (x) { return x.p.id === id; })) ranked.push({ p: KB.patterns.filter(function (p) { return p.id === id; })[0], s: 0, hit: null }); });
    render(label, b, ranked, Array.from(pains).concat(extra ? [extra] : []));
  }
  function render(label, b, recs, said) {
    var date = new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
    var h = '<article class="pl-doc" id="plan-doc"><h2>AI automation plan · ' + esc(label) + '</h2><p class="meta">Prepared on this device, ' + esc(date) + ' · draft for discussion with Katlego Mokoto</p>';
    h += '<p class="sum">Start with <b>' + esc(fill(recs[0].p.title, b)) + '</b>' + (recs[1] ? ', then <b>' + esc(fill(recs[1].p.title, b).replace(/^./, function (c) { return c.toLowerCase(); })) + '</b>' : '') + '. Each step keeps you in control: the AI sorts, drafts and explains; you approve anything that sends, spends or changes records.</p>';
    if (said.length) h += '<p class="meta">You said: ' + said.map(function (s) { return '“' + esc(s) + '”'; }).join(' · ') + '</p>';
    recs.forEach(function (r, i) {
      var p = r.p;
      h += '<section class="pl-rec" data-rec="' + p.id + '"><div class="n">' + (i + 1) + '</div><div><h3>' + esc(fill(p.title, b)) + '</h3>';
      h += '<p class="why">' + esc(fill(WHY[p.id], b)) + (r.hit && r.hit.user ? ' <span style="color:#7a6a55">(from “' + esc(r.hit.text.slice(0, 70)) + '”)</span>' : '') + '</p>';
      h += '<ol>' + p.steps.map(function (s) { return '<li>' + esc(fill(s, b)) + '</li>'; }).join('') + '</ol>';
      h += '<p class="guard">✓ ' + esc(p.guard) + '</p>';
      p.proofs.forEach(function (q) { h += '<div class="pl-proof" data-proof><b>Proof · ' + esc(q.project) + '</b><blockquote>“' + esc(q.quote) + '”</blockquote><a href="' + esc(q.url) + '">See it: ' + esc(q.project) + ' →</a></div>'; });
      h += '</div></section>';
    });
    h += '<div class="pl-cols"><div><h3>How it is built</h3><ul>' + KB.guardrails.map(function (g) { return '<li>“' + esc(g.quote) + '” <a href="' + esc(g.url) + '">source</a></li>'; }).join('') +
      '<li>Start with one workflow, measure it against how you work today, then decide on the next.</li></ul></div>' +
      '<div><h3>What Katlego would need from you</h3><ul><li>A 30-minute call to walk through one real week.</li><li>Read access to the inbox, sheet or system for the first workflow.</li><li>Your standard wording, prices you already publish, and policies.</li><li>Who approves what before anything is sent or paid.</li></ul></div></div>';
    h += '<p class="pl-small">Not included here: prices, timelines or predicted savings. Those depend on your setup and are agreed on the call. Proof quotes are copied word-for-word from the linked project pages.</p>';
    h += '<div class="pl-cta"><a class="pl-btn pl-btn-primary" data-book href="' + mailto(label, recs, said) + '">Book a call with Katlego</a><button class="pl-btn" type="button" data-print>Download PDF / print</button><button class="pl-btn" type="button" data-again>Change answers</button></div></article>';
    var box = $('[data-plan]'); box.innerHTML = h; box.hidden = false;
    $('[data-print]', box).addEventListener('click', function () { window.print(); });
    $('[data-again]', box).addEventListener('click', function () { $('#planner').scrollIntoView({ behavior: 'smooth' }); });
    box.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    window.__mmPlan = { label: label, recs: recs.map(function (r) { return r.p.id; }) };
  }
  function mailto(label, recs, said) {
    var body = 'Hi Katlego,\n\nI made an AI automation plan on mensmercatus.online/plan/.\n\nBusiness: ' + label + '\n' + (said.length ? 'What slows us down: ' + said.join('; ') + '\n' : '') +
      '\nSuggested first steps:\n' + recs.map(function (r, i) { return (i + 1) + '. ' + r.p.title.replace(/\{customers?\}/gi, 'customer') ; }).join('\n') +
      '\n\nCan we book a call?\n\nName:\nPhone:\nBest time:\n';
    return 'mailto:' + KB.person.email + '?subject=' + encodeURIComponent('AI automation plan – ' + label) + '&body=' + encodeURIComponent(body.slice(0, 1500));
  }
  function ui() {
    var bx = $('[data-biz]');
    bx.innerHTML = KB.businesses.map(function (b) { return '<button type="button" class="pl-chip" role="radio" aria-checked="false" data-id="' + b.id + '">' + esc(b.label) + '</button>'; }).join('');
    bx.addEventListener('click', function (e) { var t = e.target.closest('[data-id]'); if (!t) return; bx.querySelectorAll('[data-id]').forEach(function (n) { n.setAttribute('aria-checked', n === t ? 'true' : 'false'); });
      biz = KB.businesses.filter(function (b) { return b.id === t.dataset.id; })[0]; });
    var px = $('[data-pains]');
    px.innerHTML = KB.pains.map(function (p) { return '<button type="button" class="pl-chip" aria-pressed="false" data-pain="' + esc(p) + '">' + esc(p) + '</button>'; }).join('');
    px.addEventListener('click', function (e) { var t = e.target.closest('[data-pain]'); if (!t) return; var on = t.getAttribute('aria-pressed') !== 'true'; t.setAttribute('aria-pressed', on); on ? pains.add(t.dataset.pain) : pains.delete(t.dataset.pain); });
    $('[data-generate]').addEventListener('click', plan);
    var q = new URLSearchParams(location.search).get('biz');
    if (q) { var n = bx.querySelector('[data-id="' + q.replace(/[^a-z]/g, '') + '"]'); n && n.click(); }
  }
  fetch('plan-kb.json?v=1').then(function (r) { return r.json(); }).then(function (j) { KB = j; ui(); window.__mmPlanReady = true; })
    .catch(function () { $('[data-hint]').textContent = 'Could not load the plan data. Please refresh.'; });
})();
