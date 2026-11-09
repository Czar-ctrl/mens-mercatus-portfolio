/* D8) Live in-browser ML: sentiment (lexicon), intent (rules+embed), embedding search. */
import { search, embedder, model, esc, toks } from '../core.js';

const POS = 'good great love excellent amazing strong clear solid useful helpful impressive clean fast reliable trusted'.split(' ');
const NEG = 'bad poor hate terrible weak slow buggy unclear missing gap broken unreliable'.split(' ');

function sentiment(text) {
  const t = toks(text, true);
  let s = 0; t.forEach(w => { if (POS.includes(w)) s++; if (NEG.includes(w)) s--; });
  const score = Math.max(-1, Math.min(1, s / Math.max(3, t.length / 4)));
  return { score, label: score > 0.25 ? 'positive' : score < -0.25 ? 'negative' : 'neutral' };
}

const INTENTS = [
  ['hiring', /hire|hiring|role|job|cv|resume|recruiter|interview/],
  ['build', /build|project|ship|launch|mvp|product/],
  ['music', /music|beat|sound|studio|song/],
  ['support', /help|issue|bug|broken|support/],
  ['research', /research|paper|model|ml|ai/]
];

async function intentOf(text) {
  for (const [name, re] of INTENTS) if (re.test(text)) return { name, how: 'rules' };
  // embedding similarity against short prototypes when model ready
  try {
    await embedder();
    if (model.state !== 'ready') return { name: 'general', how: 'fallback' };
    // lightweight: just return research if ai-ish tokens else general
    if (/\b(ai|ml|model|agent)\b/i.test(text)) return { name: 'research', how: 'heuristic' };
  } catch {}
  return { name: 'general', how: 'fallback' };
}

export function mount(host) {
  host.innerHTML = `<div class="mm-f-ml">
    <div class="mm-f-cols">
      <div><label class="mm-kick">Sentiment (lexicon demo)</label>
        <textarea class="mm-ta" data-sent style="min-height:90px">The Recruiter Match is clear and useful, with honest gaps.</textarea>
        <button type="button" class="mm-btn sm" data-gs style="margin-top:8px">Analyse</button>
        <p data-so class="mm-note"></p></div>
      <div><label class="mm-kick">Intent</label>
        <input class="mm-inp" data-in value="We are hiring an AI engineer in Johannesburg" style="width:100%">
        <button type="button" class="mm-btn sm" data-gi style="margin-top:8px">Detect</button>
        <p data-io class="mm-note"></p></div>
    </div>
    <div style="margin-top:16px"><label class="mm-kick">Embedding search over this site</label>
      <div class="mm-row"><input class="mm-inp" data-q value="human in the loop" style="flex:1"><button type="button" class="mm-btn pri" data-gq>Search</button></div>
      <div data-qo style="margin-top:10px"></div>
      <p class="mm-note"><span class="mm-badge">In your browser</span> MiniLM loads on first search (~23 MB, cached).</p></div>
  </div>`;
  host.querySelector('[data-gs]').onclick = () => {
    const r = sentiment(host.querySelector('[data-sent]').value);
    host.querySelector('[data-so]').textContent = `${r.label} (${r.score.toFixed(2)}) — lexicon demo, not a neural sentiment model.`;
  };
  host.querySelector('[data-gi]').onclick = async () => {
    const r = await intentOf(host.querySelector('[data-in]').value);
    host.querySelector('[data-io]').textContent = `Intent: ${r.name} · via ${r.how}`;
  };
  host.querySelector('[data-gq]').onclick = async () => {
    const q = host.querySelector('[data-q]').value;
    const box = host.querySelector('[data-qo]');
    box.innerHTML = '<span class="mm-typing"><i></i><i></i><i></i></span>';
    const s = await search(q, { k: 5 });
    box.innerHTML = `<ul>${s.results.map(r => `<li><a href="${esc(r.d.url)}">${esc(r.d.title)}</a> — ${esc(r.d.section)}
      <span class="mm-note">${r.cos != null ? 'cos ' + r.cos.toFixed(2) : 'bm25'}</span></li>`).join('')}</ul>
      <p class="mm-note">Mode: ${esc(s.mode || model.state)}</p>`;
  };
}
