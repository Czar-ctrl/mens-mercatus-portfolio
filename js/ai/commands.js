/* preview wave 3 AI — command grammar shared by voice navigation and the typed fallback (palette "> …", voice panel field). */
const d = document, B = (window.MM_AI_CONFIG || {}).base || '/', MM = () => window.MM_AI || {};
const PAGES = [
  [/\b(contact|get in touch|hire( him)?|email|reach)\b/, 'contact/', 'Contact'], [/\b(case stud(y|ies))\b/, 'case-studies/', 'Case studies'],
  [/\b(resume|résumé|cv|curriculum)\b/, 'resume/', 'Résumé'], [/\b(selected )?work\b(?! (on|with))/, 'work/', 'Selected work'], [/\blabs?\b/, 'labs/', 'Labs'],
  [/\b(apps|demos)\b/, 'apps/', 'Apps'], [/\b(home|start|front page)\b/, '', 'Home'], [/\b(ai lab|lab page|ai tools)\b/, 'ai/', 'AI Lab'],
  [/\b(playground|hum|till slip|pipeline)\b/, 'ai/#playground', 'AI Playground'], [/\b(recruiter match|job match|match( me)?|fit score)\b/, 'ai/#match', 'Recruiter Match'],
  [/\b(narrat|walkthrough|listen)\w*/, 'ai/#narrator', 'Case-study narrator'], [/\b(feed|changelog|shipped|build in public)\b/, 'ai/#feed', 'Build in public'],
  [/\b(rag|retrieval map)\b/, 'rag/', 'RAG and agents']
];
const PROJECTS = [
  [/sound ?x ai|sound ?x studio|sound ?deck( ai)?|sounddeck/, 'apps/soundx-ai/', 'SoundX AI', 'case-studies/soundx/'],
  [/sound ?x|sounds x/, 'case-studies/soundx/', 'SoundX case study'], [/job ?net/, 'case-studies/jobnet/', 'JobNet case study'],
  [/assist|mercatus assist/, 'case-studies/assist/', 'Mercatus Assist case study'], [/\bthink\b/, 'think/', 'THINK'],
  [/forex|codex|paper desk/, 'case-studies/forex/', 'Forex Mercatus Codex case study'], [/blueprint|blueprint/, 'blueprint/', 'Mens Mercatus Blueprint']
];
export const HELP = ['“show me music work”', '“open SoundX AI”', '“go to contact”', '“read this project”', '“switch to light mode”', '“search JobNet”', '“stop”'];
function go(url, label) { location.href = B + url; return 'Opening ' + label + '…'; }
function themeTo(mode) {
  const want = mode === 'light' ? 'Switch to light mode' : 'Switch to dark mode';
  const btn = d.querySelector(`button[aria-label="${want}"]`) || d.querySelector('[data-mm-theme]');
  const isDark = d.documentElement.classList.contains('dark');
  if ((mode === 'light' && !isDark) || (mode === 'dark' && isDark)) return 'Already in ' + mode + ' mode.';
  if (btn && btn.getAttribute('aria-label') === want) { btn.click(); return 'Switched to ' + mode + ' mode.'; }
  if (btn && btn.hasAttribute('data-mm-theme')) { btn.click(); return 'Switched to ' + mode + ' mode.'; }
  d.documentElement.classList.toggle('dark', mode === 'dark'); try { localStorage.setItem('theme', mode); } catch (e) {}
  return 'Switched to ' + mode + ' mode.';
}
/* ---- read aloud (Web Speech synthesis; highlights the paragraph being read) ---- */
let reading = null;
export function readAloud(scope) {
  stopReading();
  const ss = window.speechSynthesis; if (!ss) return 'Read-aloud is not supported in this browser.';
  const nar = d.querySelector('[data-mm-nar-play]'); if (nar && !scope) { nar.click(); return 'Playing the narrated walkthrough.'; }
  if (!scope && window.MM_AI_CS && d.querySelector('.mm-csbar [data-k=listen]')) { window.MM_AI_CS.show('listen'); return 'Playing the 60-second walkthrough of this project.'; }
  const main = scope || d.querySelector('main') || d.body;
  const ps = [...main.querySelectorAll('h1,h2,h3,p,li')].filter(p => p.offsetParent !== null && p.textContent.trim().split(/\s+/).length > 2 && !p.closest('.mm-ai,nav,footer,header'));
  if (!ps.length) return 'Nothing to read here.';
  let i = 0; reading = { ps, on: true };
  const voice = (ss.getVoices() || []).find(v => /en-ZA/i.test(v.lang)) || (ss.getVoices() || []).find(v => /^en/i.test(v.lang));
  const next = () => {
    ps.forEach(p => p.classList.remove('mm-reading')); if (!reading || !reading.on || i >= ps.length) { reading = null; return; }
    const p = ps[i++]; p.classList.add('mm-reading'); p.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    const u = new SpeechSynthesisUtterance(p.textContent.trim()); if (voice) u.voice = voice; u.rate = 1; u.onend = next; u.onerror = next; ss.speak(u);
  };
  next(); window.__mmReading = true; return 'Reading this page aloud. Say or type “stop” to end.';
}
export function stopReading() { if (reading) reading.on = false; reading = null; window.__mmReading = false; if (window.speechSynthesis) speechSynthesis.cancel(); d.querySelectorAll('.mm-reading').forEach(p => p.classList.remove('mm-reading')); }
/* ---- parse + run ---- */
export function parse(raw) {
  const t = String(raw || '').toLowerCase().replace(/[.!?,]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^(hey|ok|okay|please|can you|could you)\s+/, '');
  if (!t) return null;
  let m;
  if (/^(stop|stop reading|be quiet|quiet|pause)$/.test(t)) return { id: 'stop', label: 'Stop reading', run: () => { stopReading(); return 'Stopped.'; } };
  if (/^(help|what can i say|commands)$/.test(t)) return { id: 'help', label: 'Show voice commands', run: () => 'Try ' + HELP.join(', ') + '.' };
  if ((m = t.match(/(switch|change|turn|go|set)?\s*(to )?(light|dark)( mode| theme)?$/)) && /light|dark/.test(t) && /mode|theme|switch|turn|light$|dark$/.test(t)) { const mode = m[3]; return { id: 'theme', label: `Switch to ${mode} mode`, run: () => themeTo(mode) }; }
  if ((m = t.match(/^(read|narrate)( out)?( this| the)?( project| page| case study| article)?( aloud| to me)?$/))) return { id: 'read', label: 'Read this page aloud', run: () => readAloud() };
  if ((m = t.match(/^(search|find|look up)( for)? (.+)$/))) return { id: 'search', label: `Search “${m[3]}”`, run: () => { MM().load('palette').then(p => p.open(null, m[3])); return 'Searching for “' + m[3] + '”.'; } };
  if ((m = t.match(/(show|take) me( the)? (music|audio|recruiter|hiring|developer|dev|engineering|code|founder|client|business)( work| stuff| projects| side)?/))) {
    const k = { music: 'music', audio: 'music', recruiter: 'recruiter', hiring: 'recruiter', developer: 'developer', dev: 'developer', engineering: 'developer', code: 'developer', founder: 'founder', client: 'founder', business: 'founder' }[m[3]];
    return { id: 'intent', label: `Show ${k} work first`, run: () => {
      const home = location.pathname === B || location.pathname === B + 'index.html';
      if (!home) { location.href = B + '?for=' + k; return 'Opening the home page, tailored for ' + k + '.'; }
      MM().setIntent && MM().setIntent(k, 'voice');
      const target = { music: '.pv-bento-wrap,.mm-home-ai', recruiter: 'section[aria-labelledby="about-heading"]', developer: 'section[aria-labelledby="method-heading"]', founder: '.pv-hz,section[aria-labelledby="work-heading"]' }[k];
      setTimeout(() => { const n = d.querySelector(target); if (n) { if (window.__pvLenis) window.__pvLenis.scrollTo(n, { offset: -60 }); else n.scrollIntoView({ behavior: 'smooth' }); } }, 120);
      return 'Tailored the page for ' + k + ' and scrolled to it.'; } };
  }
  if (/^(scroll )?(down|next)$/.test(t)) return { id: 'down', label: 'Scroll down', run: () => { scrollBy({ top: innerHeight * 0.8, behavior: 'smooth' }); return 'Scrolling down.'; } };
  if (/^(scroll )?(up|back up|to the top|top)$/.test(t)) return { id: 'up', label: 'Back to top', run: () => { scrollTo({ top: 0, behavior: 'smooth' }); return 'Back to the top.'; } };
  const verb = /^(open|go to|goto|show|show me|take me to|navigate to|launch|play|visit|view)\b\s*(the )?/;
  const rest = t.replace(verb, '');
  if (verb.test(t) || rest.split(' ').length <= 4) {
    for (const [re, url, label] of PROJECTS) if (re.test(rest)) return { id: 'open', label: 'Open ' + label, url: B + url, run: () => go(url, label) };
    for (const [re, url, label] of PAGES) if (re.test(rest)) return { id: 'nav', label: 'Go to ' + label, url: B + url, run: () => go(url, label) };
  }
  return null;
}
export function exec(text) { const c = parse(text); if (!c) return { ok: false, msg: `Didn’t catch a command in “${text}”. Try ${HELP.slice(0, 4).join(', ')}.` }; return { ok: true, cmd: c, msg: c.run() }; }
window.MM_AI_CMD = { parse, exec };
