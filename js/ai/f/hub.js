/* Option F hub — mounts [data-mm-f]; boots visits / adaptive / rum. */
import { boot as visits } from './visits.js';
import { boot as adaptive } from './adaptive.js';
import { boot as rum } from './rum.js';
import { viewed, loadingHTML, flushLeadQueue } from './util.js';

viewed(); visits(); adaptive(); rum(); flushLeadQueue();

const MAP = {
  leads: './leads.js', scorer: './scorer.js', matcher: './matcher.js', skills: './skills-map.js',
  twin: './twin.js', tour: './code-tour.js', arch: './arch.js', rank: './rank.js',
  ml: './mldemos.js', fit: './fitcheck.js', change: './changelog.js', pitch: './pitch.js',
  proof: './proofcheck.js', value: './value.js', book: './booking.js', a11y: './a11y.js'
};

async function mountNode(node) {
  if (node.__mmF) return;
  node.__mmF = true;
  const id = node.getAttribute('data-mm-f');
  const path = MAP[id];
  if (!path) return;
  node.innerHTML = loadingHTML;
  try {
    const mod = await import(path + '?v=m1');
    if (mod.mount) await mod.mount(node, { source: node.dataset.source || id, title: node.dataset.title, blurb: node.dataset.blurb });
  } catch (e) {
    node.innerHTML = '<p class="mm-f-state err" role="alert">This tool could not load. Refresh the page, or email katlego.mokoto.km@gmail.com.</p>';
    console.warn('mm-f', id, e);
  }
}

function observe() {
  const nodes = document.querySelectorAll('[data-mm-f]');
  if (!('IntersectionObserver' in window)) { nodes.forEach(mountNode); return; }
  const io = new IntersectionObserver(ents => {
    ents.forEach(en => { if (en.isIntersecting) { mountNode(en.target); io.unobserve(en.target); } });
  }, { rootMargin: '240px' });
  nodes.forEach(n => io.observe(n));
}

document.addEventListener('click', async e => {
  const b = e.target.closest('[data-mm-cv]');
  if (!b) return;
  setTimeout(async () => {
    const wrap = document.querySelector('.mm-cvwrap');
    if (!wrap || wrap.querySelector('[data-mm-send-cv]')) return;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'mm-btn pri'; btn.setAttribute('data-mm-send-cv', '1');
    btn.textContent = 'Send me this CV…';
    btn.style.minHeight = '44px';
    wrap.querySelector('.mm-cvbar')?.appendChild(btn);
    btn.onclick = async () => {
      const { openAfterCv } = await import('./leads.js');
      const host = document.querySelector('[data-mm-match]');
      openAfterCv((host && host.__last) || { title: 'this role' });
    };
  }, 60);
}, true);

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe);
else observe();
