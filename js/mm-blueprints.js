/* System blueprints: packets along edges (one rAF loop, transforms only), hover/focus highlight,
   keyboard pinning, pause off-screen and on hidden tab, static under prefers-reduced-motion. */
(function () {
  'use strict';
  // Gentle bob on Blueprint chip / tag clusters (CSS animation; off under reduced motion)
  [].forEach.call(document.querySelectorAll('.cartel-page .card .tag, .bp-jump, .bp-legend .bp-chip, .cartel-banner, .bp-bob-scope .chip, .bp-bob-scope .badge'), function (el) {
    if (getComputedStyle(el).display === 'inline') el.style.display = 'inline-block';
    el.classList.add('bp-bob');
  });
  var figs = [].slice.call(document.querySelectorAll('.bp-fig'));
  if (!figs.length) return;
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MOB = window.matchMedia ? matchMedia('(max-width: 720px)') : { matches: false };
  var NS = 'http://www.w3.org/2000/svg';
  var PERIOD = { http: 2600, ws: 2200, data: 3200, build: 4200, local: 2000 };
  // the mobile layout ships without duplicated labels/roles: copy them from the desktop layout
  figs.forEach(function (f) {
    var dsk = f.querySelector('.bp-svg--d'), mob = f.querySelector('.bp-svg--m'); if (!dsk || !mob) return;
    [].forEach.call(mob.querySelectorAll('.bp-n'), function (g) {
      var src = dsk.querySelector('.bp-n[data-id="' + g.getAttribute('data-id') + '"]'); if (!src) return;
      ['aria-label', 'data-role', 'data-label', 'data-st'].forEach(function (a) { g.setAttribute(a, src.getAttribute(a)); });
    });
  });
  var state = figs.map(function (f) { return { fig: f, vis: false, built: {}, pk: [] }; });

  function svgOf(st) { return st.fig.querySelector(MOB.matches ? '.bp-svg--m' : '.bp-svg--d'); }

  function build(st) {
    var svg = svgOf(st), key = MOB.matches ? 'm' : 'd';
    if (st.built[key]) { st.pk = st.built[key]; return; }
    var layer = svg.querySelector('.bp-packets'), list = [];
    [].forEach.call(svg.querySelectorAll('.bp-e'), function (p, i) {
      var len = p.getTotalLength(), n = 40, pts = [];
      for (var k = 0; k <= n; k++) { var q = p.getPointAtLength(len * k / n); pts.push(q.x, q.y); }
      var kind = p.getAttribute('data-kind');
      function dot(cls, r) { var c = document.createElementNS(NS, 'circle'); c.setAttribute('r', r); c.setAttribute('class', 'bp-pkt ' + cls); c.setAttribute('cx', 0); c.setAttribute('cy', 0); c.style.opacity = 0; layer.appendChild(c); return c; }
      var e = { pts: pts, kind: kind, per: PERIOD[kind] * (0.9 + (i % 5) * 0.06), off: (i * 0.37) % 1, path: p, a: null, b: null };
      if (kind === 'http') { e.a = dot('bp-pkt--req', 3.2); e.b = dot('bp-pkt--res', 2.8); }
      else if (kind === 'ws') { e.a = dot('bp-pkt--ws', 2.8); e.b = dot('bp-pkt--ws', 2.8); }
      else e.a = dot('bp-pkt--' + kind, kind === 'local' ? 2.2 : 2.7);
      list.push(e);
    });
    st.built[key] = st.pk = list;
  }

  function place(c, pts, t) {
    var n = pts.length / 2 - 1, f = Math.max(0, Math.min(n, t * n)), i = Math.floor(f), r = f - i, j = Math.min(n, i + 1);
    var x = pts[i * 2] + (pts[j * 2] - pts[i * 2]) * r, y = pts[i * 2 + 1] + (pts[j * 2 + 1] - pts[i * 2 + 1]) * r;
    c.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')');
  }
  function ease(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  var raf = 0;
  function frame(now) {
    raf = 0; var any = false;
    state.forEach(function (st) {
      if (!st.vis) return; any = true;
      var hot = st.fig.querySelector('.bp-svg.is-focus');
      st.pk.forEach(function (e) {
        var sp = hot && e.path.classList.contains('is-hot') ? 1.6 : 1;
        var u = ((now * sp / e.per) + e.off) % 1, dim = hot && !e.path.classList.contains('is-hot');
        var op = dim ? .12 : 1;
        if (e.kind === 'http') {              // request out (red), response back (cyan)
          if (u < .5) { place(e.a, e.pts, ease(u * 2)); e.a.style.opacity = op; e.b.style.opacity = 0; }
          else { place(e.b, e.pts, 1 - ease((u - .5) * 2)); e.b.style.opacity = op; e.a.style.opacity = 0; }
        } else if (e.kind === 'ws') {         // both directions at once
          place(e.a, e.pts, u); place(e.b, e.pts, 1 - u); e.a.style.opacity = e.b.style.opacity = op * .95;
        } else { place(e.a, e.pts, ease(u)); e.a.style.opacity = op * (u > .92 ? (1 - u) / .08 : 1); }
      });
    });
    if (any && !document.hidden) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!RM && !raf && !document.hidden) raf = requestAnimationFrame(frame); }

  // Highlight a node + its edges + neighbours, and print its role
  function focusNode(svg, g, pin) {
    clear(svg, true);
    var id = g.getAttribute('data-id'); svg.classList.add('is-focus'); g.classList.add('is-hot');
    var near = [];
    [].forEach.call(svg.querySelectorAll('.bp-e'), function (p) {
      var a = p.getAttribute('data-from'), b = p.getAttribute('data-to');
      if (a === id || b === id) { p.classList.add('is-hot'); near.push(a === id ? b : a); }
    });
    var names = [];
    near.forEach(function (n) { var x = svg.querySelector('.bp-n[data-id="' + n + '"]'); if (x) { x.classList.add('is-near'); names.push(x.getAttribute('data-label')); } });
    if (pin) { g.setAttribute('aria-pressed', 'true'); svg.setAttribute('data-pin', id); }
    var role = svg.parentNode.parentNode.querySelector('.bp-role');
    role.innerHTML = '';
    var s = document.createElement('strong'); s.textContent = g.getAttribute('data-label') + ' · ' + g.getAttribute('data-st');
    role.appendChild(s);
    role.appendChild(document.createTextNode(' — ' + g.getAttribute('data-role') + (names.length ? ' Talks to: ' + names.join(', ') + '.' : '')));
  }
  function clear(svg, keepText) {
    svg.classList.remove('is-focus');
    [].forEach.call(svg.querySelectorAll('.is-hot,.is-near'), function (x) { x.classList.remove('is-hot', 'is-near'); });
    [].forEach.call(svg.querySelectorAll('[aria-pressed="true"]'), function (x) { x.setAttribute('aria-pressed', 'false'); });
    svg.removeAttribute('data-pin');
    if (!keepText) { var r = svg.parentNode.parentNode.querySelector('.bp-role'); r.innerHTML = '<span class="bp-role-k">Hover or tab to a node</span> to see its role and highlight what it talks to.'; }
  }
  [].forEach.call(document.querySelectorAll('.bp-svg'), function (svg) {
    function restore() { var p = svg.getAttribute('data-pin'); if (p) focusNode(svg, svg.querySelector('.bp-n[data-id="' + p + '"]'), true); else clear(svg); }
    [].forEach.call(svg.querySelectorAll('.bp-n'), function (g) {
      g.addEventListener('mouseenter', function () { if (!svg.getAttribute('data-pin')) focusNode(svg, g); });
      g.addEventListener('mouseleave', function () { if (!svg.getAttribute('data-pin')) clear(svg); });
      g.addEventListener('focus', function () { if (!svg.getAttribute('data-pin')) focusNode(svg, g); });
      g.addEventListener('blur', function () { setTimeout(function () { if (!svg.contains(document.activeElement)) restore(); }, 0); });
      g.addEventListener('click', function () { var p = svg.getAttribute('data-pin') === g.getAttribute('data-id'); if (p) clear(svg); else focusNode(svg, g, true); });
      g.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); g.dispatchEvent(new Event('click')); }
        else if (ev.key === 'Escape') { clear(svg); }
      });
    });
  });

  if (RM) { figs.forEach(function (f) { f.classList.add('is-paused'); }); return; }   // static diagram
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (en) {
      var st = state[figs.indexOf(en.target)]; st.vis = en.isIntersecting;
      en.target.classList.toggle('is-paused', !st.vis);
      if (st.vis) { build(st); kick(); }
    });
  }, { rootMargin: '80px 0px' }) : null;
  figs.forEach(function (f) { f.classList.add('is-paused'); if (io) io.observe(f); });
  if (!io) state.forEach(function (st) { st.vis = true; st.fig.classList.remove('is-paused'); build(st); kick(); });
  document.addEventListener('visibilitychange', function () {
    figs.forEach(function (f, i) { f.classList.toggle('is-paused', document.hidden || !state[i].vis); });
    if (!document.hidden) kick();
  });
  var mq = function () { state.forEach(function (st) { if (st.vis) build(st); }); kick(); };
  if (MOB.addEventListener) MOB.addEventListener('change', mq);

})();
