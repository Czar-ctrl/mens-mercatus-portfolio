/* /services/ — theme toggle + first-client offer flag (off by default). */
(function () {
  'use strict';
  var d = document, root = d.documentElement;
  function theme() {
    var b = d.querySelector('[data-mm-theme]');
    if (!b) return;
    var sync = function () {
      var dark = root.classList.contains('dark');
      b.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      b.textContent = dark ? '☾' : '☀';
    };
    b.addEventListener('click', function () {
      var dark = !root.classList.contains('dark');
      root.classList.toggle('dark', dark);
      try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch (e) {}
      sync();
    });
    sync();
  }
  function firstClientOffer() {
    var box = d.querySelector('[data-offer="first-client"]');
    if (!box) return;
    var on = false;
    try {
      var q = new URLSearchParams(location.search);
      on = q.get('offer') === '1' || q.get('first-client') === '1';
      if (!on && localStorage.getItem('mm-svc-first-client') === '1') on = true;
      if (!on && window.MM_AI_CONFIG && window.MM_AI_CONFIG.services && window.MM_AI_CONFIG.services.firstClientOffer) on = true;
    } catch (e) {}
    if (on) box.hidden = false;
  }
  function start() { theme(); firstClientOffer(); }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start);
  else start();
})();
