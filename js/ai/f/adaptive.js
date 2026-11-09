/* D6) Adaptive layout by visitor type — on device, no tracking. Infers from in-tab clicks. */
const MAP = [
  [/resume|cv|contact|hire|match|scorer|fit/i, 'recruiter'],
  [/soundx|music|beat|studio|audio/i, 'music'],
  [/case-stud|rag|architect|code|github|method|skills-map|tour/i, 'developer'],
  [/services|concierge|assist|book|value|roi/i, 'founder']
];

export function boot() {
  if (window.__mmFAdaptive) return;
  window.__mmFAdaptive = true;
  document.addEventListener('click', e => {
    const a = e.target.closest('a,button');
    if (!a) return;
    const sig = (a.getAttribute('href') || '') + ' ' + (a.textContent || '') + ' ' + (a.dataset.mm || '');
    for (const [re, intent] of MAP) {
      if (re.test(sig)) {
        try {
          const prev = sessionStorage.getItem('mm-intent');
          if (prev === intent) return;
          // Only auto-set if user hasn't manually picked
          if (sessionStorage.getItem('mm-intent-why') === 'picked') return;
          sessionStorage.setItem('mm-intent', intent);
          sessionStorage.setItem('mm-intent-why', 'clicks');
          document.documentElement.setAttribute('data-mm-intent', intent);
          window.dispatchEvent(new CustomEvent('mm-intent', { detail: { intent, why: 'clicks' } }));
        } catch (err) {}
        return;
      }
    }
  }, true);
}
