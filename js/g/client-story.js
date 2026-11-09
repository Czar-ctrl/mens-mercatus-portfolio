/* Client before-and-after story renderer. Data: /data/case-studies/clients.json. An entry renders only when published === true.
   Layout (format from the freelance plan, section 9.2): client & context → problem (with a number) → before / after → solution & safeguards → result (client-confirmed numbers only) → stack → quote → CTA.
   ?preview=template shows the empty layout with [bracketed] placeholders for Katlego to review — never real-looking data. */
(function () {
  'use strict';
  var d = document, box = d.querySelector('[data-mmg-cs]'), q = new URLSearchParams(location.search);
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var PH = function (t) { return '<span class="ph">[' + esc(t) + ']</span>'; };
  var TEMPLATE = { title: PH('Client') + ' cut ' + PH('task') + ' from ' + PH('before') + ' to ' + PH('after'), industry: PH('Industry'), size: PH('Team size'), location: PH('City'),
    problem: PH('The problem in the client\u2019s words, with a number: hours lost, missed leads'), before: [[PH('Metric'), PH('Before value')]], after: [[PH('Metric'), PH('After value, confirmed by the client')]],
    solution: PH('What was built, the architecture, and the human gate'), safeguards: [PH('Safeguard, e.g. drafts only, POPIA consent')], stack: [PH('Stack item')],
    quote: PH('Client quote, approved in writing'), quote_by: PH('Name, role'), package: PH('Package') };
  function render(c, isTpl) {
    var row = function (r) { return '<dt>' + (isTpl ? r[0] : esc(r[0])) + '</dt><dd>' + (isTpl ? r[1] : esc(r[1])) + '</dd>'; };
    var t = function (v) { return isTpl ? v : esc(v); };
    d.title = (isTpl ? 'Client story template' : c.title) + ' — Katlego Mokoto';
    box.innerHTML = (isTpl ? '<p class="banner">Template preview. Nothing here is real. A story goes live only when the client has approved the text and the numbers in writing.</p>' : '') +
      '<p class="mmg-kick">Client story · ' + t(c.industry) + '</p><h1>' + t(c.title) + '</h1>' +
      '<dl><dt>Client</dt><dd>' + t(c.client || (isTpl ? PH('Name or "anonymised"') : 'Anonymised')) + '</dd><dt>Size</dt><dd>' + t(c.size) + '</dd><dt>Location</dt><dd>' + t(c.location) + '</dd>' + (c.package ? '<dt>Package</dt><dd>' + t(c.package) + '</dd>' : '') + '</dl>' +
      '<h2>The problem</h2><p>' + t(c.problem) + '</p>' +
      '<h2>Before and after</h2><div class="ba"><div><p class="mmg-kick">Before</p><dl>' + (c.before || []).map(row).join('') + '</dl></div><div class="after"><p class="mmg-kick">After</p><dl>' + (c.after || []).map(row).join('') + '</dl></div></div>' +
      '<h2>What was built</h2><p>' + t(c.solution) + '</p>' + (c.safeguards && c.safeguards.length ? '<ul>' + c.safeguards.map(function (x) { return '<li>' + t(x) + '</li>'; }).join('') + '</ul>' : '') +
      (c.stack && c.stack.length ? '<h2>Stack</h2><p>' + c.stack.map(t).join(' · ') + '</p>' : '') +
      (c.quote ? '<h2>In their words</h2><figure class="mmg-quote"><blockquote>\u201c' + t(c.quote) + '\u201d</blockquote><figcaption>' + t(c.quote_by) + '</figcaption></figure>' : '') +
      '<div class="mmg-links"><a class="mmg-btn pri" href="/services/#book">Want this for your business? Book a call</a><a class="mmg-btn" href="/case-studies/">All case studies</a></div>';
  }
  if (q.get('preview') === 'template') return render(TEMPLATE, true);
  fetch('/data/case-studies/clients.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (j) {
    var c = (j.entries || []).filter(function (x) { return x && x.published === true && x.slug === q.get('id'); })[0];
    if (!c) { box.innerHTML = '<p class="mmg-kick">Client stories</p><h1>No client stories yet</h1><p>The first one is published once a client approves it. Meanwhile, the <a href="/case-studies/">project case studies</a> show the systems in detail.</p>'; return; }
    render(c, false);
  }).catch(function () { box.innerHTML = '<h1>Could not load this story</h1><p><a href="/case-studies/">Back to case studies</a></p>'; });
})();
