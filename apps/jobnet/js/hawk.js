/* AI Hawk — the draft step of JobNet Application (formerly the standalone Drop Net demo).
   Turns one shortlisted or pasted vacancy into a plain-text cover note + CV synopsis, built ONLY from facts in
   profile.json (the published CV and case studies). Anything it can't back up stays a [bracketed placeholder]
   or is listed as a gap. Runs on this device: no LLM call, no network, nothing stored or sent. */
export const SAMPLES = { // fictional, employer-free sample vacancies (from the former Drop Net page)
  dotnet: "Backend Developer (.NET) — Johannesburg / hybrid\nWe are looking for a developer to build and maintain ASP.NET Core APIs. You will integrate third-party REST services, write SQL, work with Docker-based deployments and help add AI-assisted features (LLM APIs) to internal tools. Nice to have: Kubernetes, Azure or AWS, POPIA awareness.",
  frontend: "Frontend Engineer — Remote (SA hours)\nBuild responsive, accessible web interfaces in JavaScript/TypeScript. Experience with React or vanilla JS, CSS, Web Audio or Canvas a plus. You care about performance, mobile layouts and clear UX copy. Git, CI and testing expected.",
  data: "Junior Quant / Data Analyst — Cape Town\nSupport research with Python, pandas and SQL. Build dashboards and charting, clean market data feeds, and help evaluate trading signals in a paper / simulated environment. Interest in FX, statistics and automation required."
};
export function signalOf(r) {
  const n = r.matched.length + r.partial.length + r.gaps.length; if (!n) return 'unknown';
  const x = (r.matched.length + 0.5 * r.partial.length) / n; return x >= 0.75 ? 'high' : x >= 0.45 ? 'medium' : 'low';
}
export function draft(job, r, P, skills, LEARN) {
  const srcs = []; const cite = (label, url) => { let i = srcs.findIndex(s => s.url === url); if (i < 0) { srcs.push({ label, url }); i = srcs.length - 1; } return `[${i + 1}]`; };
  const pool = P.projects.flatMap(p => p.bullets.map(b => ({ b, name: p.name, url: p.url, skills: p.skills }))); const used = new Set(); const pts = [];
  for (const m of r.matched) {
    const sk = skills.find(x => x.key === m.key); if (!sk) continue;
    const hit = pool.filter(x => !used.has(x.b) && sk.re.some(re => re.test(x.b))).sort((a, b) => b.skills.includes(m.key) - a.skills.includes(m.key))[0];
    if (!hit) continue; used.add(hit.b); pts.push({ label: sk.label, b: hit.b, c: cite(hit.name, hit.url) }); if (pts.length >= 4) break;
  }
  const company = job.company && !/^pasted|^\(sample|^sample/i.test(job.company) ? job.company.replace(/\s*\(sample\)$/i, '') : '';
  const where = r.log && r.log.city && job.location && !/unspecified/i.test(job.location) ? ` (${job.location})` : '';
  const sig = signalOf(r); const L = [];
  L.push(`AI HAWK DRAFT · ${job.title}${company ? ' · ' + company : ''}`);
  L.push(`Signal: ${sig.toUpperCase()} · JobNet fit ${r.fit}% · ${r.matched.length} evidenced, ${r.partial.length} partial, ${r.gaps.length} gap${r.gaps.length === 1 ? '' : 's'}`);
  L.push('Draft only. Nothing was sent, saved or applied.', '');
  L.push('── Cover note ──');
  L.push(`Dear ${company ? 'Hiring Team at ' + company : '[Hiring manager name]'},`, '');
  L.push(`I'm applying for the ${job.title} role${where}. I'm an ${P.title} with ${P.years} years of experience ${cite('Résumé', '/resume/')}, ${P.availability.toLowerCase()}, and open to ${P.modes.join(', ')} work.`);
  if (pts.length) { L.push('', 'Where my shipped work maps to your brief:'); pts.slice(0, 3).forEach(p => L.push(`  • ${p.label}: ${p.b} ${p.c}`)); }
  else L.push('', '[Explain your fit in two sentences. No matching evidence was found in the published CV for this brief.]');
  L.push('', `${P.summary} ${cite('Résumé', '/resume/')}`);
  const gap = r.gaps[0], learn = gap && LEARN[gap.key];
  if (gap) L.push('', `To be upfront: I haven't used ${gap.label} in production yet${learn ? `; I'd close that with ${learn[0]} and a proof project` : ''}.`);
  L.push('', 'Kind regards,', P.name, 'https://mensmercatus.online', '');
  L.push('── CV synopsis ──');
  if (pts.length) pts.forEach(p => L.push(`  • ${p.label} — ${p.b} ${p.c}`)); else L.push('  • [No overlapping evidence detected — tailor manually]');
  r.partial.slice(0, 3).forEach(i => L.push(`  • ${i.label} — partial / listed on CV; confirm depth before claiming it`));
  L.push('', '── Gaps to confirm before using ──');
  if (r.gaps.length) r.gaps.forEach(g => L.push(`  • ${g.label}: [confirm real experience or leave out]`)); else L.push('  • None detected by the matcher. Still verify every claim.');
  L.push('', '── Sources ──'); srcs.forEach((s, i) => L.push(`  [${i + 1}] ${s.label} · ${/^https?:/.test(s.url) ? s.url : 'https://mensmercatus.online' + s.url}`));
  const order = P.projects.map(p => ({ p, n: p.skills.filter(k => r.req.includes(k)).length })).sort((a, b) => b.n - a.n);
  return { text: L.join('\n'), signal: sig, order, sources: srcs };
}
