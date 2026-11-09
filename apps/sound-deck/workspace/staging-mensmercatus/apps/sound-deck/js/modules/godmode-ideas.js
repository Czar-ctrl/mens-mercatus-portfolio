/**
 * Godmode Ideas — top 15 high-end / innovative Sound Deck roadmap cards.
 * Read-only showcase. Honest IDEA labels — not shipped features.
 */
export const GODMODE_IDEAS = [
  {
    tier: 'Ship',
    tags: ['ARRANGE', 'AI PRODUCER'],
    title: 'Arrangement Autopilot',
    blurb: 'Expand an 8-bar loop into intro · verse · drop · outro with Producer confirming each section before it lands on the timeline.',
  },
  {
    tier: 'Ship',
    tags: ['MIX', 'SIDECHAIN'],
    title: 'Sidechain Ghost',
    blurb: 'One-click duck pads/bass to kick without cable spaghetti — ghost envelope preview on the mixer strip.',
  },
  {
    tier: 'Ship',
    tags: ['VOCALS', 'WEB AUDIO'],
    title: 'Harmony Stack Lite',
    blurb: 'Live vocal doubles + 3-part harmony from the mic chain, all in-browser, with honest wet/dry and formant shift limits.',
  },
  {
    tier: 'Ship',
    tags: ['EXPORT', 'STEMS'],
    title: 'Bounce Packets',
    blurb: 'One export: stems · master · session JSON · cover still — a zip a collaborator can open without the DAW.',
  },
  {
    tier: 'Ship',
    tags: ['UX', 'HUD'],
    title: 'Focus Stage Mode',
    blurb: 'Fullscreen performance HUD: giant transport, next-clip cues, and mixer meters only — hide every edit panel.',
  },
  {
    tier: 'Stretch',
    tags: ['STEMS', 'A/B'],
    title: 'Stem Diff HUD',
    blurb: 'Overlay two takes with phase invert and spectral diff so you hear what actually changed between bounces.',
  },
  {
    tier: 'Stretch',
    tags: ['REFERENCE', 'DNA'],
    title: 'Genre DNA Decoder',
    blurb: 'Drop a reference track → suggest BPM, key, kit density, and arrangement skeleton without uploading to a cloud model.',
  },
  {
    tier: 'Stretch',
    tags: ['MIDI', 'SCALE'],
    title: 'Clip Intelligence',
    blurb: 'Scale/chord lock, voice-leading hints, and ghost notes that snap melody clips into the Producer’s key map.',
  },
  {
    tier: 'Stretch',
    tags: ['SAMPLES', 'XY'],
    title: 'Sample Morph Lattice',
    blurb: 'XY pad morphs four one-shots in realtime — record the path as automation on the selected track.',
  },
  {
    tier: 'Stretch',
    tags: ['SPATIAL', 'MIX'],
    title: 'Binaural Mix Check',
    blurb: 'Headphone HRTF preview + mono collapse switch so mobile/club translation is audible before bounce.',
  },
  {
    tier: 'Stretch',
    tags: ['VST', 'GRAPH'],
    title: 'Plugin Graph God View',
    blurb: 'Node map of insert chains per track + master; drag to reorder, solo a node, export a routing PNG for the brief.',
  },
  {
    tier: 'Moonshot',
    tags: ['LOCAL LLM', 'AGENTS'],
    title: 'Sovereign Generate Fleet',
    blurb: 'Local LLM seats that propose arrangement / mix / lyric moves — always confirm-before-write, never silent cloud spend.',
  },
  {
    tier: 'Moonshot',
    tags: ['WEBRTC', 'COLLAB'],
    title: 'Live Collab Cursor',
    blurb: 'Shared transport + playhead cursors over WebRTC so two producers see the same session without a third-party DAW host.',
  },
  {
    tier: 'Moonshot',
    tags: ['DETECT', 'TRUST'],
    title: 'Synthetic Audio Radar',
    blurb: 'Flag likely AI-generated imports with confidence bands — protect release integrity without claiming perfect detection.',
  },
  {
    tier: 'Moonshot',
    tags: ['ML BRIDGE', 'STEMS'],
    title: 'Neural Stem Bridge',
    blurb: 'Optional desktop worker for real ML separation; browser stays honest Demo DSP until the bridge is connected.',
  },
];

export function mountGodmodeIdeas(root) {
  const cards = GODMODE_IDEAS.map((idea, i) => {
    const n = String(i + 1).padStart(2, '0');
    const tierClass = idea.tier.toLowerCase();
    const chips = idea.tags.map((t) => `<span class="gm-idea-chip">${t}</span>`).join('');
    return `
      <article class="gm-idea-card" data-tier="${tierClass}">
        <header class="gm-idea-card__head">
          <span class="gm-idea-rank">#${n}</span>
          <span class="badge gm-idea-tier ${tierClass}">${idea.tier}</span>
          <span class="badge">IDEA</span>
        </header>
        <h3 class="gm-idea-card__title">${idea.title}</h3>
        <p class="gm-idea-card__blurb">${idea.blurb}</p>
        <div class="gm-idea-chips">${chips}</div>
      </article>`;
  }).join('');

  root.innerHTML = `
    <div class="panel-head">
      <h2>Godmode Ideas</h2>
      <span class="badge warn">Roadmap · 15</span>
    </div>
    <p class="panel-desc">Top high-end, innovative Sound Deck directions — <strong>ideas only</strong>, not shipped features. Ranked Ship → Stretch → Moonshot. No fake Run buttons.</p>
    <div class="gm-idea-filters" role="group" aria-label="Filter by tier">
      <button type="button" class="btn sm active" data-filter="all">All</button>
      <button type="button" class="btn sm" data-filter="ship">Ship</button>
      <button type="button" class="btn sm" data-filter="stretch">Stretch</button>
      <button type="button" class="btn sm" data-filter="moonshot">Moonshot</button>
    </div>
    <div class="gm-idea-list" data-idea-list>${cards}</div>
    <p class="fineprint">Mens Mercatus Sound Deck · research / product roadmap · local Web Audio first · confirm-before-write on any future agent seats.</p>
  `;

  const list = root.querySelector('[data-idea-list]');
  root.querySelectorAll('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const f = btn.dataset.filter;
      root.querySelectorAll('[data-filter]').forEach((b) => b.classList.toggle('active', b === btn));
      list.querySelectorAll('.gm-idea-card').forEach((card) => {
        card.hidden = f !== 'all' && card.dataset.tier !== f;
      });
    });
  });
}
