/* Proof strip: measured figures for this project, each with its source and date (data: /data/proof.json).
   Inserted only after React has hydrated (Next pages) so server markup is never touched. */
(function () {
  var d = document, path = location.pathname.replace(/index\.html$/, '');
  if (!/\/$/.test(path)) path += '/';
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function day(s) { var t = new Date(s); return isNaN(t) ? s : t.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Johannesburg' }); }
  function hydrated(el) { if (!d.getElementById('__next') && !d.querySelector('script[src*="/_next/"]')) return true; for (var k in el) if (k.indexOf('__reactFiber') === 0 || k.indexOf('__reactProps') === 0) return true; return false; }
  function render(strip) {
    var h1 = d.querySelector('main h1') || d.querySelector('h1') || d.querySelector('main h2, h2'); if (!h1 || d.querySelector('.mm-proof')) return;
    var anchor = h1.closest('header, section') || h1.parentElement;
    var s = d.createElement('section'); s.className = 'mm-proof'; s.setAttribute('aria-label', 'Measured results');
    s.innerHTML = '<div class="mm-proof-in"><p class="mm-proof-k">Measured, not claimed</p><ul>' + strip.items.map(function (it) {
      return '<li><b>' + esc(it.display) + '</b><span>' + esc(it.label) + '</span><details><summary>Source</summary><p>' + esc(it.source) + '<br>' + esc(it.how || '') + '<br>Measured ' + esc(day(it.date)) + '</p></details></li>';
    }).join('') + '</ul><p class="mm-proof-f">Figures read from live endpoints, the live file mirror and automated browser runs. Each has a source and date.</p></div>';
    /* Never shift what the visitor can already see (CLS): place the strip right after the hero if that point is below the
       viewport, otherwise at the first block boundary of the same container that starts below the viewport. */
    var ref = anchor.nextElementSibling, vh = innerHeight;
    if (anchor.getBoundingClientRect().bottom < vh) { while (ref && ref.getBoundingClientRect().top < vh) ref = ref.nextElementSibling; }
    anchor.parentNode.insertBefore(s, ref || null); window.__mmProof = strip;
  }
  var css = d.createElement('style');
  css.textContent = '.mm-proof{margin:28px auto;max-width:1180px;padding:0 24px;position:relative;z-index:1}.mm-proof-in{border:1px solid rgba(127,127,127,.28);border-radius:18px;padding:18px 20px;background:rgba(127,127,127,.06)}' +
    '.mm-proof-k{margin:0 0 10px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#e63946;font-weight:700}.mm-proof ul{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px}' +
    '.mm-proof li{display:flex;flex-direction:column;gap:2px;min-width:0}.mm-proof b{font-size:clamp(22px,2.6vw,30px);line-height:1.1;font-variant-numeric:tabular-nums}.mm-proof span{font-size:13px;opacity:.75;line-height:1.35}' +
    '.mm-proof details{font-size:11px;opacity:.7;margin-top:2px}.mm-proof summary{cursor:pointer;width:max-content}.mm-proof details p{margin:4px 0 0;word-break:break-word}.mm-proof-f{margin:12px 0 0;font-size:11px;opacity:.6}' +
    '@media print{.mm-proof details{display:none}}';
  d.head.appendChild(css);
  fetch('/data/proof.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (P) {
    var strip = null; Object.keys(P.strips).forEach(function (k) { if (P.strips[k].pages.indexOf(path) > -1) strip = P.strips[k]; }); if (!strip) return;
    var n = 0, t = setInterval(function () { var h1 = d.querySelector('h1') || d.querySelector('h2'); if ((h1 && hydrated(h1) && d.readyState === 'complete') || ++n > 60) { clearInterval(t); if (h1) render(strip); } }, 250);
  }).catch(function () {});
})();
