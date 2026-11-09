/* D15) Accessibility AI: alt suggestions from nearby text, simple-reading mode, spoken summaries. */
import { esc, reduce } from '../core.js';

function simplify(text) {
  return text
    .replace(/\b(utilise|utilize)\b/gi, 'use')
    .replace(/\b(approximately)\b/gi, 'about')
    .replace(/\b(demonstrates)\b/gi, 'shows')
    .replace(/\b(architecture)\b/gi, 'design')
    .replace(/\b(retriev(?:al|e))\b/gi, 'look-up')
    .replace(/\s+/g, ' ').trim();
}

export function mount(host) {
  host.innerHTML = `<div class="mm-f-a11y">
    <div class="mm-row">
      <button type="button" class="mm-btn pri" data-simple>Toggle simple-reading mode</button>
      <button type="button" class="mm-btn" data-alts>Suggest alt text for images on this page</button>
      <button type="button" class="mm-btn" data-speak>Speak page summary</button>
    </div>
    <div data-out class="mm-card" style="margin-top:12px"></div>
    <p class="mm-note"><span class="mm-badge">On device</span> Simple mode rewrites visible text in this tab only. Speech uses your browser’s voice.</p>
  </div>`;
  const out = host.querySelector('[data-out]');
  host.querySelector('[data-simple]').onclick = () => {
    const on = document.documentElement.toggleAttribute('data-mm-simple');
    if (on) {
      document.querySelectorAll('main p, main li, main h1, main h2, main h3').forEach(n => {
        if (!n.dataset.orig) n.dataset.orig = n.textContent;
        n.textContent = simplify(n.dataset.orig);
      });
      out.textContent = 'Simple-reading mode on. Reload to restore original wording, or toggle again.';
    } else {
      document.querySelectorAll('[data-orig]').forEach(n => { n.textContent = n.dataset.orig; delete n.dataset.orig; });
      out.textContent = 'Simple-reading mode off.';
    }
  };
  host.querySelector('[data-alts]').onclick = () => {
    const imgs = [...document.images].slice(0, 20);
    out.innerHTML = `<ul>${imgs.map(img => {
      const sug = img.alt || (img.closest('figure')?.querySelector('figcaption')?.textContent) || img.getAttribute('aria-label') || `Image (${(img.currentSrc||img.src||'').split('/').pop()||'unknown'})`;
      return `<li><code>${esc((img.currentSrc||img.src||'').split('/').pop()||'')}</code> → ${esc(sug.trim() || '(no suggestion — add a short description)')}</li>`;
    }).join('') || '<li>No images found.</li>'}</ul>`;
  };
  host.querySelector('[data-speak]').onclick = () => {
    if (!window.speechSynthesis) { out.textContent = 'Speech synthesis not available in this browser.'; return; }
    const text = (document.querySelector('main h1')?.textContent || '') + '. ' + (document.querySelector('main .mm-lead, main p')?.textContent || '');
    const u = new SpeechSynthesisUtterance(text.slice(0, 500));
    u.lang = 'en-ZA';
    if (reduce()) { out.textContent = 'Reduced motion is on — showing summary instead: ' + text.slice(0, 300); return; }
    speechSynthesis.cancel(); speechSynthesis.speak(u);
    out.textContent = 'Speaking summary…';
  };
}
