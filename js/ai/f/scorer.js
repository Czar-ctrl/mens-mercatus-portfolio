/* C) CV scorer: honest score vs a job post, keyword flags with evidence, ATS-clean variant. Never suggests stuffing. */
import { analyse, extract, SAMPLES } from '../match.js';
import { loadData, esc, toks, norm } from '../core.js';
import { openAfterCv } from './leads.js';
import { loadingHTML, emptyHTML, errHTML } from './util.js';

function keywordsFromJd(jd, profile) {
  const reqs = extract(jd);
  const wanted = new Set();
  reqs.forEach(r => toks(r.text).forEach(t => { if (t.length > 2) wanted.add(t); }));
  // Also pull known skill aliases that appear in the JD
  const t = norm(jd);
  const present = [], missingEvidence = [], trueGaps = [];
  profile.skills.forEach(s => {
    const hit = s.aliases.some(a => new RegExp(a, 'i').test(t));
    if (!hit) return;
    if (s.level === 'gap' || !s.evidence.length) trueGaps.push(s);
    else if (s.level === 'partial') missingEvidence.push({ skill: s, tip: 'Listed with partial evidence — surface it honestly, do not invent.' });
    else present.push(s);
  });
  return { present, missingEvidence, trueGaps, reqCount: reqs.length };
}

function atsText(res) {
  const P = res.profile;
  const hitKeys = new Set();
  res.rows.forEach(r => (r.skills || []).forEach(s => {
    const k = P.skills.find(x => x.label === s.label);
    if (k && k.level !== 'gap') hitKeys.add(k.key);
  }));
  const projects = P.projects.map(p => ({ p, n: p.skills.filter(s => hitKeys.has(s)).length }))
    .sort((a, b) => b.n - a.n).slice(0, 4).map(x => x.p);
  const skills = P.skills.filter(s => hitKeys.has(s.key) || s.level === 'shipped').map(s => s.label);
  const lines = [
    P.name.toUpperCase(),
    P.title,
    `${P.phone} | ${P.email} | ${P.web} | ${P.linkedin}`,
    `Johannesburg, South Africa | ${P.locations.join(', ')} | ${P.modes.join(' / ')} | ${P.availability}`,
    '',
    'SUMMARY',
    `${P.title} with ${P.years} years of experience. ${P.summary}`,
    '',
    'SELECTED SYSTEMS'
  ];
  projects.forEach(p => {
    lines.push(`${p.name} — ${p.tag}`);
    p.bullets.forEach(b => lines.push(`- ${b}`));
    lines.push(`URL: https://mensmercatus.online${p.url}`);
    lines.push('');
  });
  lines.push('TECHNICAL SKILLS');
  lines.push(skills.join(', '));
  lines.push('');
  lines.push('EXPERIENCE');
  P.experience.forEach(e => {
    lines.push(`${e.role} — ${e.org} (${e.when})`);
    e.bullets.forEach(b => lines.push(`- ${b}`));
    lines.push('');
  });
  lines.push('EDUCATION');
  lines.push(P.education);
  lines.push('');
  lines.push(`ATS-clean plain-text CV tailored for "${res.title}". Only facts from mensmercatus.online. No tables, no columns, no icons, no headers/footers.`);
  return lines.join('\n');
}

export async function score(jd) {
  const res = await analyse(jd);
  const kw = keywordsFromJd(jd, res.profile);
  res.keywords = kw;
  res.ats = atsText(res);
  return res;
}

function render(host, res) {
  const kw = res.keywords;
  host.innerHTML = `<div class="mm-score"><div class="mm-ring" style="--p:${res.overall}" role="img" aria-label="Overall fit ${res.overall} percent"><b>${res.overall}<small>%</small></b></div>
    <div><p class="mm-kick">CV score for</p><h3 style="margin:.3rem 0;font:600 18px/1.25 var(--mm-disp)">${esc(res.title)}</h3>
    <p class="mm-note">${res.rows.length} requirements · ${kw.present.length} evidenced keywords · ${kw.trueGaps.length} true gaps · in your browser · honest</p></div></div>
    <div class="mm-f-kw">
      <div><b>Keywords you can evidence</b><ul>${kw.present.map(s => `<li>${esc(s.label)} — <a href="${esc(s.evidence[0][1])}">${esc(s.evidence[0][0])}</a></li>`).join('') || '<li class="mm-note">None matched this ad.</li>'}</ul></div>
      <div><b>Partial — surface carefully</b><ul>${kw.missingEvidence.map(x => `<li>${esc(x.skill.label)}: ${esc(x.tip)}</li>`).join('') || '<li class="mm-note">None.</li>'}</ul></div>
      <div><b>True gaps — do not claim</b><ul>${kw.trueGaps.map(s => `<li>${esc(s.label)}${s.note ? ' — ' + esc(s.note) : ''}</li>`).join('') || '<li class="mm-note">None flagged.</li>'}</ul></div>
    </div>
    <p class="mm-note"><strong>No keyword stuffing.</strong> This tool never suggests hidden text, white-on-white words, or claiming skills without evidence.</p>
    <div class="mm-reqs">${res.rows.map(r => {
      const lab = { strong: 'Strong', partial: 'Partial', gap: 'Gap', info: 'Not scored' }[r.status];
      return `<div class="mm-req" data-status="${r.status}"><span class="mm-st ${r.status}">${lab}</span><span class="q">${esc(r.text)}</span>
        <span class="ev">${(r.notes||[]).map(esc).join(' ')}</span></div>`;
    }).join('')}</div>
    <div class="mm-row" style="margin-top:14px">
      <button type="button" class="mm-btn pri" data-ats>Copy ATS-clean CV</button>
      <button type="button" class="mm-btn" data-dl>Download .txt</button>
      <button type="button" class="mm-btn" data-send>Send me this CV…</button>
    </div>
    <pre class="mm-f-ats" hidden></pre>`;
  const pre = host.querySelector('.mm-f-ats');
  pre.textContent = res.ats;
  host.querySelector('[data-ats]').onclick = async () => {
    try { await navigator.clipboard.writeText(res.ats); host.querySelector('[data-ats]').textContent = 'Copied'; }
    catch { pre.hidden = false; }
  };
  host.querySelector('[data-dl]').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([res.ats], { type: 'text/plain' }));
    a.download = 'katlego-mokoto-ats.txt'; a.click();
  };
  host.querySelector('[data-send]').onclick = () => openAfterCv(res);
}

export function mount(host) {
  host.innerHTML = `<div class="mm-match"><div><label class="mm-kick" style="display:block;margin-bottom:8px">Paste a job post</label>
    <textarea class="mm-ta" style="min-height:260px" placeholder="Full job ad…"></textarea>
    <div class="mm-row" style="margin-top:10px">
      <button type="button" class="mm-btn pri" data-go>Score my CV</button>
      <button type="button" class="mm-btn sm" data-s="dotnet">Sample: AI Engineer (.NET)</button>
      <button type="button" class="mm-btn sm" data-s="cv">Sample: ML Engineer (CV)</button>
    </div>
    <p class="mm-note" style="margin-top:10px"><span class="mm-badge">In your browser · honest</span> Flags only keywords Katlego can evidence. Never suggests stuffing.</p></div>
    <div class="mm-card" data-out aria-live="polite"><p class="mm-note">Score, keyword flags and an ATS-clean plain-text CV appear here.</p></div></div>`;
  const ta = host.querySelector('textarea'), out = host.querySelector('[data-out]');
  host.querySelectorAll('[data-s]').forEach(b => b.addEventListener('click', () => { ta.value = SAMPLES[b.dataset.s].text; go(); }));
  const go = async () => {
    if (!ta.value.trim()) { ta.focus(); return; }
    out.innerHTML = loadingHTML;
    try { const r = await score(ta.value); if (!r.rows.length) { out.innerHTML = emptyHTML('No requirements found in that text. Paste a fuller job post.'); return; } render(out, r); host.__last = r; }
    catch (e) { out.innerHTML = errHTML('Could not score that post. Try again, or open Recruiter Match above.'); }
  };
  host.querySelector('[data-go]').onclick = go;
}
