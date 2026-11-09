/* Home teaser for /plan/ (live client demo). Inserted after hydration so the Next.js markup is untouched. */
(function () {
  function put() {
    if (document.querySelector('.mm-plan-teaser')) return true;
    var anchor = document.querySelector('.mm-home-ai'); /* injected by ai-boot.js after hydration; never touch the DOM before React hydrates */
    if (!anchor) return false;
    var s = document.createElement('section'); s.className = 'mm-plan-teaser'; s.setAttribute('aria-labelledby', 'mm-plan-h');
    s.innerHTML = '<a href="/plan/" class="mm-plan-card"><span class="k">Live client demo · small businesses</span><strong id="mm-plan-h">Get a one-page AI automation plan for your business</strong>' +
      '<span class="d">Spaza, salon, plumber, clinic, law firm, online store… pick yours and what slows you down. Every recommendation links to a project I built. Runs in your browser.</span><span class="go">Build my plan →</span></a>';
    anchor.insertBefore(s, anchor.firstChild); /* inside the AI section so it shares its stacking layer */
    return true;
  }
  var css = document.createElement('style');
  css.textContent = '.mm-plan-teaser{position:relative;z-index:1;max-width:1180px;margin:0 auto 48px;padding:0}.mm-plan-card{display:grid;gap:10px;text-decoration:none;color:inherit;padding:30px 32px;border-radius:22px;border:1px solid rgba(230,57,70,.35);background:radial-gradient(700px 300px at 90% 0,rgba(230,57,70,.18),transparent 70%),rgba(127,127,127,.06);transition:transform .2s,border-color .2s}' +
    '.mm-plan-card:hover{transform:translateY(-2px);border-color:rgba(230,57,70,.7)}.mm-plan-card .k{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#e63946}.mm-plan-card strong{font-size:clamp(22px,3vw,32px);line-height:1.15}.mm-plan-card .d{opacity:.75;max-width:760px}.mm-plan-card .go{font-weight:700;color:#e63946}' +
    '@media (prefers-reduced-motion:reduce){.mm-plan-card{transition:none}}';
  document.head.appendChild(css);
  var n = 0, t = setInterval(function () { if (put() || ++n > 80) clearInterval(t); }, 250);
})();
