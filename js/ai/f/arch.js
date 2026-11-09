/* D5) Architecture explainer — HR / developer / CTO levels. */
import { esc } from '../core.js';

const SYSTEMS = {
  assist: {
    name: 'Mercatus Assist + THINK',
    hr: 'A chat assistant for a team. It answers from company knowledge, refuses to send or delete anything on its own, and a person always approves the important steps.',
    dev: 'ASP.NET Core 8 minimal API in C# calls Gemini through an OpenAI-compatible client. React + Vite front end, WebSockets for streaming, nginx + systemd on a Linux VPS, Cloudflare in front. Rate limiting and key handling on the server.',
    cto: 'Trade-off: managed Gemini for quality vs local Ollama for privacy. Human-in-the-loop gate on irreversible tools. Exponential backoff and circuit-breakers around the model. Monitoring via health endpoints. No secrets in the client bundle.'
  },
  jobnet: {
    name: 'JobNet Application',
    hr: 'A daily job finder that ranks postings against Katlego’s real projects and drafts applications for him to review (the AI Hawk step) — nothing sends itself.',
    dev: 'Python scrape at 20:00 SAST, sentence embeddings rank postings, browser UI for explainable match (MiniLM in a Web Worker), AI Hawk draft, review and mailto forwarding. Draft-only email path.',
    cto: 'Outcome model ships coefficients only (no company names). Draft-only is a product rule, not a UI toggle. Separates scoring from sending so a bug cannot spam employers.'
  },
  forex: {
    name: 'Forex Mercatus Codex',
    hr: 'A paper-trading research desk for markets. It never risks rent or food money — paper only.',
    dev: 'Python + Highcharts, live calendar and price APIs on a VPS, god-mode AI tools in the browser.',
    cto: 'Paper trading enforced in the product. Feed CORS locked to mensmercatus.online. CSP hardened after third-party icon CDNs were self-hosted.'
  },
  soundx: {
    name: 'SoundX AI',
    hr: 'A music studio in the browser: drums, stems, themes, on-device AI tools. Audio stays on your device.',
    dev: 'TypeScript + Web Audio, 20 on-device AI tools, plugin rack, Afro packs. No server round-trip for audio buffers.',
    cto: 'On-device first for latency and privacy. Merged Studio into one app to cut maintenance. Controller pad uses local Wi-Fi bridge only on the desktop app.'
  }
};

export function mount(host) {
  const keys = Object.keys(SYSTEMS);
  host.innerHTML = `<div class="mm-f-arch">
    <div class="mm-row">${keys.map(k => `<button type="button" class="mm-btn sm" data-k="${k}">${esc(SYSTEMS[k].name)}</button>`).join('')}
      <label class="mm-note">Audience
        <select data-lv><option value="hr">HR / recruiter</option><option value="dev">Developer</option><option value="cto">CTO / architect</option></select>
      </label></div>
    <article class="mm-card" data-out style="margin-top:14px"></article>
    <p class="mm-note" style="margin-top:8px"><span class="mm-badge">DEMO</span> Wording changes by audience; facts do not.</p></div>`;
  let k = 'assist';
  const draw = () => {
    const s = SYSTEMS[k], lv = host.querySelector('[data-lv]').value;
    host.querySelector('[data-out]').innerHTML = `<p class="mm-kick">${esc(lv.toUpperCase())} view</p><h3>${esc(s.name)}</h3><p>${esc(s[lv === 'dev' ? 'dev' : lv])}</p>
      <p><a class="mm-btn" href="/case-studies/${k === 'soundx' ? 'soundx' : k}/">Open case study</a></p>`;
  };
  host.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { k = b.dataset.k; draw(); });
  host.querySelector('[data-lv]').onchange = draw;
  draw();
}
