/* Mercatus Assist v2 launcher (option AS, preview) — ~1 KB, classic script, defer. Nothing heavy loads until the visitor asks:
   - on /apps/mercatus-assist/ it mounts the assistant into #as-app when the page is idle (the embedding model still waits for a first focus);
   - elsewhere it adds one small "Ask Assist" button; click (or Alt+A) imports js/assist/assist.js and opens it as a dialog that can read this page. */
(function () {
  'use strict';
  var d = document, w = window; if (w.__mmAsL) return; w.__mmAsL = true;
  var V = 'as1', mod = null;
  function load() { return mod || (mod = import('/js/assist/assist.js?v=' + V)); }
  var host = d.getElementById('as-app');
  if (host) {
    var from = new URLSearchParams(location.search).get('from');
    var go = function () { load().then(function (m) { w.MM_ASSIST = m.mount(host, { from: from && /^[a-z0-9-]{2,24}$/.test(from) ? from : null, noFocus: true }); host.classList.add('as-ready'); }); };
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', go); else go();
    return;
  }
  function open() { load().then(function (m) { m.openOverlay(); }); }
  function add() {
    if (d.querySelector('.as-launch')) return;
    var b = d.createElement('button'); b.type = 'button'; b.className = 'as-launch'; b.setAttribute('aria-haspopup', 'dialog');
    b.innerHTML = '<i aria-hidden="true"></i>Ask Assist<span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)"> about this page (Alt+A)</span>';
    b.addEventListener('click', open); b.addEventListener('pointerenter', function () { load(); }, { once: true });
    // insert only once its stylesheet has applied, so the fixed button never sits in the page flow first (no layout shift)
    var put = function () { if (!b.isConnected) d.body.appendChild(b); };
    if (!d.querySelector('link[data-mm-as]')) { var l = d.createElement('link'); l.rel = 'stylesheet'; l.href = '/css/assist.css?v=' + V; l.setAttribute('data-mm-as', ''); l.onload = put; d.head.appendChild(l); } else put();
  }
  d.addEventListener('keydown', function (e) { if (e.altKey && (e.key === 'a' || e.key === 'A' || e.code === 'KeyA')) { e.preventDefault(); open(); } });
  (w.requestIdleCallback || function (f) { setTimeout(f, 1200); })(add, { timeout: 2500 });
})();
