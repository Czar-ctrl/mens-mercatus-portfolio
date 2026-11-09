/* JobNet Application — read-only PUBLIC GitHub data via the unauthenticated REST API (no token, no private data).
   Respects the 60 requests/hour core limit (10/min for search): every response is cached for 1 hour in this browser,
   the remaining quota from the X-RateLimit headers is shown, and calls stop when the quota is nearly used up. */
const API = 'https://api.github.com', TTL = 60 * 60e3, PFX = 'jn.gh.';
export const CFG = { user: '' }; // Katlego's GitHub username: not published on the site or CV, so it is a config value (see report)
try { CFG.user = (window.JOBNET_CFG && window.JOBNET_CFG.githubUser) || localStorage.getItem(PFX + 'user') || ''; } catch {}
export function setUser(u) { CFG.user = String(u || '').trim(); try { localStorage.setItem(PFX + 'user', CFG.user); } catch {} }
const SLUG = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
export const validSlug = s => SLUG.test(String(s || ''));
export function quota() { try { return JSON.parse(localStorage.getItem(PFX + 'quota') || 'null'); } catch { return null; } }
export function quotaText() {
  const q = quota(); if (!q) return 'GitHub quota: not used yet (60 requests/hour without a token)';
  const reset = new Date(q.reset * 1000).toLocaleTimeString('en-ZA', { timeZone: 'Africa/Johannesburg', hour: '2-digit', minute: '2-digit', hour12: false });
  return `GitHub ${q.resource || 'core'} quota: ${q.remaining}/${q.limit} left · resets ${reset} SAST`;
}
async function get(path, resource = 'core') {
  const k = PFX + 'c:' + path;
  try { const c = JSON.parse(localStorage.getItem(k) || 'null'); if (c && Date.now() - c.t < TTL) return { data: c.d, cached: true }; } catch {}
  const q = quota(); if (q && q.resource === resource && q.remaining <= 1 && Date.now() / 1000 < q.reset) throw new Error('GitHub rate limit nearly used up. ' + quotaText());
  const r = await fetch(API + path, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
  const rem = r.headers.get('x-ratelimit-remaining');
  if (rem != null) try { localStorage.setItem(PFX + 'quota', JSON.stringify({ remaining: +rem, limit: +r.headers.get('x-ratelimit-limit'), reset: +r.headers.get('x-ratelimit-reset'), resource: r.headers.get('x-ratelimit-resource') || resource })); } catch {}
  if (r.status === 404) throw new Error('Not found on GitHub: ' + path.split('?')[0]);
  if (r.status === 403 || r.status === 429) throw new Error('GitHub rate limit reached. ' + quotaText());
  if (!r.ok) throw new Error('GitHub ' + r.status);
  const d = await r.json(); try { localStorage.setItem(k, JSON.stringify({ t: Date.now(), d })); } catch {}
  return { data: d, cached: false };
}
const slim = x => ({ name: x.name, full: x.full_name, url: x.html_url, desc: x.description || '', lang: x.language || '', topics: x.topics || [], stars: x.stargazers_count, fork: !!x.fork, archived: !!x.archived, pushed: x.pushed_at });
export async function userRepos(user = CFG.user) {
  if (!validSlug(user)) throw new Error('Set a GitHub username first: type “repos user <name>”.');
  const { data, cached } = await get(`/users/${user}/repos?per_page=100&sort=pushed`); return { repos: data.map(slim).filter(r => !r.fork), cached };
}
export async function orgRepos(org) {
  if (!validSlug(org)) throw new Error(org ? 'That is not a valid GitHub organisation name.' : 'Type the company\'s GitHub organisation name (no guess for pasted or sample roles).');
  let res; try { res = await get(`/orgs/${org}/repos?per_page=100&sort=pushed`); } catch (e) { if (!/Not found/.test(e.message)) throw e; res = await get(`/users/${org}/repos?per_page=100&sort=pushed`); }
  const repos = res.data.map(slim).filter(r => !r.fork && !r.archived); const langs = {}, topics = {};
  repos.forEach(r => { if (r.lang) langs[r.lang] = (langs[r.lang] || 0) + 1; r.topics.forEach(t => topics[t] = (topics[t] || 0) + 1); });
  const rank = o => Object.entries(o).sort((a, b) => b[1] - a[1]);
  return { org, repos, langs: rank(langs), topics: rank(topics).slice(0, 12), cached: res.cached };
}
/* Vacancy → AI/ML topics. Only well-known GitHub topics; results are real repos with their real star counts. */
const TOPIC_MAP = [[/\bllm|large language|gpt|gemini|openai/i, 'llm'], [/\bagent|agentic|tool[- ]calling|mcp\b/i, 'ai-agents'], [/\brag\b|retrieval|vector|embedding/i, 'rag'],
  [/transformer|hugging ?face|bert/i, 'transformers'], [/machine learning|\bml\b|scikit|model training/i, 'machine-learning'], [/deep learning|pytorch|tensorflow|neural/i, 'deep-learning'],
  [/computer vision|\bocr\b|image/i, 'computer-vision'], [/\bnlp\b|natural language|text classification/i, 'nlp'], [/\bmlops|mlflow|model serving|evals?\b/i, 'mlops'], [/langchain|langgraph/i, 'langchain']];
export const topicsFor = text => [...new Set(TOPIC_MAP.filter(([re]) => re.test(text || '')).map(([, t]) => t))].slice(0, 3);
export async function aiRepos(text) {
  const tp = topicsFor(text); if (!tp.length) return { topics: [], repos: [], note: 'No AI/ML topics detected in this vacancy.' };
  const out = []; for (const t of tp) { const { data } = await get(`/search/repositories?q=${encodeURIComponent('topic:' + t + ' stars:>1000')}&sort=stars&order=desc&per_page=5`, 'search'); out.push(...data.items.map(x => ({ ...slim(x), topic: t }))); }
  return { topics: tp, repos: out };
}
/* Rank Katlego's own repos against the vacancy's detected skill keys (name/description/topics/language overlap). */
export function relevant(repos, text, skills) {
  const req = skills.filter(s => s.re.some(r => r.test(' ' + String(text || '').toLowerCase() + ' ')));
  return repos.map(r => { const hay = ` ${r.name} ${r.desc} ${r.topics.join(' ')} ${r.lang} `.toLowerCase().replace(/[-_]/g, ' ');
    const hit = req.filter(s => s.re.some(re => re.test(hay))); return { ...r, hits: hit.map(s => s.label), score: hit.length }; })
    .filter(r => r.score > 0).sort((a, b) => b.score - a.score || String(b.pushed).localeCompare(String(a.pushed))).slice(0, 5);
}
export const orgGuess = company => /^pasted|\(sample\)|^sample/i.test(String(company || '')) ? '' : String(company || '').replace(/\(.*?\)/g, '').replace(/\b(pty|ltd|inc|llc|limited|group|holdings|sa|south africa)\b/gi, '').replace(/[^A-Za-z0-9]+/g, '').toLowerCase().slice(0, 39);
