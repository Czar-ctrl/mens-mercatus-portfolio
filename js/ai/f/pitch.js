/* D11) 30s voice pitch (en-ZA), tailored to role presets. */
import { esc } from '../core.js';

const PRESETS = [
  { id: 'general', label: 'General', src: '/media/pitch/general.mp3',
    script: 'Hi, I am Katlego Mokoto, an AI and ML engineer and full-stack developer in Johannesburg. I build agentic workflows and full-stack systems a teammate can review, deploy and trust — like Mercatus Assist, JobNet, Forex Mercatus Codex and SoundX AI — with a human decision on every irreversible step. I am available immediately, on-site, hybrid or remote in South Africa. Visit mensmercatus.online.' },
  { id: 'dotnet', label: 'AI + .NET role', src: '/media/pitch/dotnet.mp3',
    script: 'Hi, I am Katlego Mokoto. For an AI engineer role on .NET: I ship ASP.NET Core 8 APIs in C# that call Gemini through an OpenAI-compatible client, with React tools, rate limiting, and a human gate on irreversible actions — see Mercatus Assist. Four years of experience, available immediately in Johannesburg. mensmercatus.online.' },
  { id: 'ml', label: 'ML / data role', src: '/media/pitch/ml.mp3',
    script: 'Hi, I am Katlego Mokoto. For an ML-leaning role: I build retrieval and ranking with embeddings, Pandas and NumPy pipelines, and on-device browser ML with transformers.js — see JobNet and this portfolio lab. I flag gaps honestly when a job asks for PyTorch or cloud MLOps I have not shipped. mensmercatus.online.' }
];

export function mount(host) {
  host.innerHTML = `<div class="mm-f-pitch">
    <div class="mm-row">${PRESETS.map(p => `<button type="button" class="mm-btn sm" data-id="${p.id}">${esc(p.label)}</button>`).join('')}</div>
    <audio controls preload="none" data-au style="width:100%;margin-top:12px"></audio>
    <p class="mm-f-script" data-sc style="margin-top:10px"></p>
    <p class="mm-note"><span class="mm-badge">South African English · demo</span> Script uses only published facts. Generate more roles in preview with tools/f/make_pitch.py.</p>
  </div>`;
  const au = host.querySelector('[data-au]'), sc = host.querySelector('[data-sc]');
  const play = (p) => { au.src = p.src; sc.textContent = p.script; au.play().catch(()=>{}); };
  host.querySelectorAll('[data-id]').forEach(b => b.onclick = () => play(PRESETS.find(p => p.id === b.dataset.id)));
  play(PRESETS[0]);
}
