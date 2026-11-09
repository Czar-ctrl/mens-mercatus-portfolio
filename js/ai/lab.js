/* preview wave 3 AI — AI Lab page (/ai/): mounts Recruiter Match, Playground, Narrator, Build-in-public feed, theme toggle. */
const d = document, B = (window.MM_AI_CONFIG || {}).base || '/';
const imp = n => window.MM_AI.load(n);
function theme() {
  const b = d.querySelector('[data-mm-theme]'); if (!b) return;
  const sync = () => { const dark = d.documentElement.classList.contains('dark'); b.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode'); b.textContent = dark ? '☾' : '☀'; };
  b.addEventListener('click', () => { const dark = !d.documentElement.classList.contains('dark'); d.documentElement.classList.toggle('dark', dark); try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch (e) {} sync(); });
  sync();
}
const _lazy = (el, fn) => { if (!el) return; if (!('IntersectionObserver' in window)) return fn(); const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); fn(); } }, { rootMargin: '600px 0px' }); io.observe(el); };
export async function mount() {
  theme();
  // UI shells mount right away (small); heavy engines (model, OCR, mic) still load only on use. Mounting before the visitor
  // scrolls means nothing below grows while it's on screen (CLS ≈ 0); the hash target is re-applied once everything is in place.
  const q = s => d.querySelector(s);
  await Promise.all([imp('match').then(m => m.mount(q('[data-mm-match]'))), imp('playground').then(m => m.mount(q('[data-mm-pg]'))),
    imp('narrator').then(m => m.full(q('[data-mm-nar]'))), imp('feed').then(m => m.full(q('[data-mm-feed]')))]);
  if (location.hash && scrollY < 40) { const t = d.querySelector(location.hash); if (t) t.scrollIntoView(); }
  d.documentElement.dataset.mmLab = 'ready';
}
