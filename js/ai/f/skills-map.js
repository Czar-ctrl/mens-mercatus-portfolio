/* D2) Interactive skills map with proof links. Canvas 2D; still layout if reduced motion. */
import { loadData, esc, reduce } from '../core.js';

export async function mount(host) {
  const { profile: P } = await loadData();
  const skills = P.skills.filter(s => s.level !== 'gap').slice(0, 36);
  host.innerHTML = `<div class="mm-f-map"><canvas width="900" height="520" aria-label="Skills map"></canvas>
    <div class="mm-f-map-side" data-side><p class="mm-note">Click a skill for proof links.</p></div>
    <p class="mm-note"><span class="mm-badge">In your browser</span> Node size = evidence count. Colours: shipped / listed / partial.</p></div>`;
  const canvas = host.querySelector('canvas'), side = host.querySelector('[data-side]');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const col = { shipped: '#5eead4', listed: '#93c5fd', partial: '#fcd34d' };
  const nodes = skills.map((s, i) => {
    const a = (i / skills.length) * Math.PI * 2;
    return { s, x: W/2 + Math.cos(a)*180, y: H/2 + Math.sin(a)*140, vx: 0, vy: 0, r: 10 + Math.min(14, s.evidence.length * 4) };
  });
  // Link skills that share a project
  const links = [];
  P.projects.forEach(p => {
    const idx = nodes.map((n, i) => p.skills.includes(n.s.key) ? i : -1).filter(i => i >= 0);
    for (let i = 0; i < idx.length; i++) for (let j = i+1; j < idx.length; j++) links.push([idx[i], idx[j]]);
  });
  let sel = null, drag = null;
  function step() {
    if (reduce()) return;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i+1; j < nodes.length; j++) {
        let dx = nodes[j].x - nodes[i].x, dy = nodes[j].y - nodes[i].y;
        let d = Math.hypot(dx, dy) || 1;
        const f = 800 / (d*d);
        nodes[i].vx -= dx/d*f; nodes[i].vy -= dy/d*f;
        nodes[j].vx += dx/d*f; nodes[j].vy += dy/d*f;
      }
    }
    links.forEach(([a, b]) => {
      let dx = nodes[b].x - nodes[a].x, dy = nodes[b].y - nodes[a].y, d = Math.hypot(dx, dy) || 1;
      const f = (d - 110) * 0.01;
      nodes[a].vx += dx/d*f; nodes[a].vy += dy/d*f;
      nodes[b].vx -= dx/d*f; nodes[b].vy -= dy/d*f;
    });
    nodes.forEach(n => {
      n.vx += (W/2 - n.x) * 0.002; n.vy += (H/2 - n.y) * 0.002;
      n.vx *= 0.85; n.vy *= 0.85;
      if (n !== drag) { n.x += n.vx; n.y += n.vy; }
      n.x = Math.max(n.r, Math.min(W-n.r, n.x)); n.y = Math.max(n.r, Math.min(H-n.r, n.y));
    });
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(148,163,184,.25)'; ctx.lineWidth = 1;
    links.forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(nodes[a].x, nodes[a].y); ctx.lineTo(nodes[b].x, nodes[b].y); ctx.stroke(); });
    nodes.forEach(n => {
      ctx.beginPath(); ctx.fillStyle = col[n.s.level] || '#94a3b8';
      ctx.globalAlpha = sel && sel !== n ? 0.35 : 1;
      ctx.arc(n.x, n.y, n.r, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--mm-ink') || '#e2e8f0';
      ctx.font = '600 11px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(n.s.label, n.x, n.y + n.r + 12);
    });
  }
  function loop() { step(); draw(); if (!reduce()) requestAnimationFrame(loop); else draw(); }
  function pick(x, y) {
    const r = canvas.getBoundingClientRect(), sx = (x-r.left)*W/r.width, sy = (y-r.top)*H/r.height;
    return nodes.find(n => Math.hypot(n.x-sx, n.y-sy) <= n.r+4);
  }
  canvas.addEventListener('pointerdown', e => { drag = pick(e.clientX, e.clientY); if (drag) canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => { if (!drag) return; const r = canvas.getBoundingClientRect(); drag.x = (e.clientX-r.left)*W/r.width; drag.y = (e.clientY-r.top)*H/r.height; });
  canvas.addEventListener('pointerup', e => {
    const n = pick(e.clientX, e.clientY); drag = null;
    if (!n) return;
    sel = n;
    side.innerHTML = `<p class="mm-kick">${esc(n.s.level)}</p><h3>${esc(n.s.label)}</h3>
      ${n.s.note ? `<p class="mm-note">${esc(n.s.note)}</p>` : ''}
      <ul>${n.s.evidence.map(e => `<li><a href="${esc(e[1])}">${esc(e[0])}</a></li>`).join('') || '<li class="mm-note">No linked evidence.</li>'}</ul>`;
    draw();
  });
  loop();
}
