(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Accessible project filters (radiogroup semantics via aria-pressed + live region)
  const filterGroup = document.getElementById('project-filters');
  const cards = [...document.querySelectorAll('[data-project-card]')];
  const live = document.getElementById('filter-live');

  function applyFilter(value) {
    let shown = 0;
    for (const card of cards) {
      const tags = (card.getAttribute('data-tags') || '').split(/\s+/);
      const match = value === 'all' || tags.includes(value);
      card.hidden = !match;
      if (match) shown += 1;
    }
    if (live) {
      live.textContent = value === 'all'
        ? `Showing all ${shown} projects.`
        : `Showing ${shown} project${shown === 1 ? '' : 's'} for ${value}.`;
    }
  }

  if (filterGroup) {
    filterGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-filter]');
      if (!btn) return;
      for (const b of filterGroup.querySelectorAll('button[data-filter]')) {
        b.setAttribute('aria-pressed', String(b === btn));
      }
      applyFilter(btn.getAttribute('data-filter'));
    });

    filterGroup.addEventListener('keydown', (e) => {
      const buttons = [...filterGroup.querySelectorAll('button[data-filter]')];
      const current = document.activeElement;
      const i = buttons.indexOf(current);
      if (i < 0) return;
      let next = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = buttons[(i + 1) % buttons.length];
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = buttons[(i - 1 + buttons.length) % buttons.length];
      if (e.key === 'Home') next = buttons[0];
      if (e.key === 'End') next = buttons[buttons.length - 1];
      if (next) {
        e.preventDefault();
        next.focus();
        next.click();
      }
    });
  }

  // Restrained in-view motion (no-op when prefers-reduced-motion)
  if (!reduce && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-in'));
  }
})();
