/**
 * AI co-producer — one dismissible suggestion at a time based on session state.
 * Local DEMO rules; optional Assist / Blueprint hook when /health is ok.
 * Never takes control — hints only.
 */
const DISMISS_KEY = 'mm-sound-deck-copro-dismissed';

function trackByName(engine, re) {
  return engine.tracks.find((t) => re.test(t.name || ''));
}

function clipCount(track) {
  return track?.clips?.length || 0;
}

function buildSuggestions(engine, extras = {}) {
  const tips = [];
  const drums = trackByName(engine, /drum|perc|beat/i);
  const bass = trackByName(engine, /bass/i);
  const keys = trackByName(engine, /key|melod|lead|synth/i);
  const muted = engine.tracks.filter((t) => t.muted).length;
  const bpm = engine.bpm;

  if (bpm < 90) {
    tips.push({
      id: 'bpm-slow',
      title: 'Tempo feels leisurely',
      body: `Session is ${bpm} BPM. For house / amapiano energy, try 110–120 — or lean into the slow groove.`,
      action: { type: 'bpm', value: 118 },
      actionLabel: 'Set 118 BPM',
    });
  }
  if (bpm > 150) {
    tips.push({
      id: 'bpm-fast',
      title: 'Very fast tempo',
      body: `${bpm} BPM is drum-and-bass territory. Drop toward 128 if you want dancefloor room.`,
      action: { type: 'bpm', value: 128 },
      actionLabel: 'Set 128 BPM',
    });
  }

  if (drums && bass && clipCount(drums) && clipCount(bass)) {
    const drumLow = (drums.eq?.low || 0) > 3;
    const bassLow = (bass.eq?.low || 0) > 3;
    if (drumLow && bassLow) {
      tips.push({
        id: 'kick-bass-clash',
        title: 'Kick / bass low-end clash',
        body: 'Both Drums and Bass have boosted lows. Try cutting bass EQ low a few dB or high-passing the kick’s mud.',
        action: { type: 'eq', trackId: bass.id, eq: { low: Math.max(-6, (bass.eq?.low || 0) - 4) } },
        actionLabel: 'Ease bass low EQ',
      });
    }
  }

  if (drums && clipCount(drums) === 0) {
    tips.push({
      id: 'no-drums',
      title: 'No drum clips yet',
      body: 'Open Drummer or Beats and generate a groove — or load Demo for a starter kit.',
      action: { type: 'tab', tab: 'drummer' },
      actionLabel: 'Open Drummer',
    });
  }

  if (!engine._reverbOn && engine.tracks.some((t) => clipCount(t) > 2)) {
    tips.push({
      id: 'filter-sweep',
      title: 'Try a filter / space move',
      body: 'Arrangement has a few clips. A master reverb or Pedalboard filter sweep can glue the drop.',
      action: { type: 'reverb', on: true },
      actionLabel: 'Enable master reverb',
    });
  }

  if (keys && clipCount(keys) === 0 && clipCount(drums) > 0) {
    tips.push({
      id: 'add-keys',
      title: 'Space for a topline',
      body: 'Drums are in — sketch a Keys melody in Piano view or ask AI Producer for “melody in A minor”.',
      action: { type: 'tab', tab: 'aiproducer' },
      actionLabel: 'Open AI Producer',
    });
  }

  if (muted >= 2) {
    tips.push({
      id: 'many-muted',
      title: 'Several tracks muted',
      body: `${muted} tracks are muted. Solo one bus or unmute to hear the full picture.`,
      action: null,
      actionLabel: null,
    });
  }

  if (extras.stemDna?.mood === 'dark' && !engine._reverbOn) {
    tips.push({
      id: 'dark-mood',
      title: 'Stem DNA reads dark',
      body: 'Your last stem analysis tagged “dark”. A short delay on Pedals can add depth without brightening.',
      action: { type: 'tab', tab: 'pedals' },
      actionLabel: 'Open Pedals',
    });
  }

  if (!tips.length) {
    tips.push({
      id: 'all-good',
      title: 'Session looks balanced',
      body: 'No clashes flagged. Try Ghost layer for a tape echo throw, or export a mixdown when ready.',
      action: { type: 'noop' },
      actionLabel: null,
    });
  }

  return tips;
}

async function tryCartelHint(engine) {
  try {
    const health = await fetch('/api/cartel/index.php?path=/health', { method: 'GET' });
    if (!health.ok) return null;
    // Soft optional — do not block; DEMO stays primary
    return { live: true };
  } catch (_) {
    return null;
  }
}

export function mountCoProducer(host, engine, toast, { openTab } = {}) {
  let dismissed = new Set();
  try {
    const raw = JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]');
    if (Array.isArray(raw)) dismissed = new Set(raw.slice(-40));
  } catch (_) {}

  const el = document.createElement('div');
  el.className = 'sx-copro';
  el.setAttribute('data-copro', '');
  el.hidden = true;
  el.innerHTML = `
    <div class="sx-copro-inner" data-copro-chip>
      <span class="badge warn">DEMO co-producer</span>
      <strong data-copro-title></strong>
      <p data-copro-body></p>
      <div class="btn-row">
        <button type="button" class="btn sm primary" data-copro-act hidden>Apply hint</button>
        <button type="button" class="btn sm ghost" data-copro-next>Next</button>
        <button type="button" class="btn sm ghost" data-copro-dismiss>Dismiss</button>
      </div>
    </div>
  `;
  host.appendChild(el);

  const titleEl = el.querySelector('[data-copro-title]');
  const bodyEl = el.querySelector('[data-copro-body]');
  const actBtn = el.querySelector('[data-copro-act]');
  let current = null;
  let queue = [];
  let stemDna = null;
  let liveAssist = false;

  function persistDismiss() {
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify([...dismissed].slice(-40))); } catch (_) {}
  }

  function show(s) {
    current = s;
    if (!s) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    titleEl.textContent = s.title;
    bodyEl.textContent = s.body + (liveAssist ? ' · Assist reachable' : '');
    if (s.action && s.actionLabel) {
      actBtn.hidden = false;
      actBtn.textContent = s.actionLabel;
    } else {
      actBtn.hidden = true;
    }
  }

  function refresh() {
    const all = buildSuggestions(engine, { stemDna });
    queue = all.filter((t) => !dismissed.has(t.id));
    show(queue[0] || null);
  }

  function applyAction(action) {
    if (!action || action.type === 'noop') return;
    if (action.type === 'bpm') {
      engine.setBpm(action.value);
      toast?.(`Co-producer hint: BPM → ${action.value}`);
    } else if (action.type === 'reverb') {
      engine.setMasterReverb?.(!!action.on);
      toast?.('Co-producer hint: master reverb on');
    } else if (action.type === 'eq' && action.trackId) {
      const t = engine.tracks.find((x) => x.id === action.trackId);
      if (t && action.eq) {
        t.eq = { ...t.eq, ...action.eq };
        engine._emit?.('tracks', engine.tracks);
        toast?.('Co-producer hint: EQ nudged (you stay in control)');
      }
    } else if (action.type === 'tab' && action.tab) {
      openTab?.(action.tab);
      toast?.(`Opened ${action.tab}`);
    }
  }

  actBtn.addEventListener('click', () => {
    if (current?.action) applyAction(current.action);
  });
  el.querySelector('[data-copro-dismiss]').addEventListener('click', () => {
    if (current) {
      dismissed.add(current.id);
      persistDismiss();
    }
    queue = queue.filter((t) => t.id !== current?.id);
    show(queue[0] || null);
    if (!queue.length) toast?.('Co-producer dismissed');
  });
  el.querySelector('[data-copro-next]').addEventListener('click', () => {
    if (!queue.length) { refresh(); return; }
    queue.push(queue.shift());
    show(queue[0]);
  });

  window.addEventListener('mm-stem-dna', (e) => {
    stemDna = e.detail;
    refresh();
  });

  engine.on('tracks', () => { clearTimeout(refresh._t); refresh._t = setTimeout(refresh, 600); });
  engine.on('bpm', () => { clearTimeout(refresh._t); refresh._t = setTimeout(refresh, 400); });

  tryCartelHint(engine).then((r) => {
    liveAssist = !!r?.live;
    const badge = el.querySelector('.badge');
    if (liveAssist && badge) {
      badge.textContent = 'DEMO + Assist hook';
      badge.title = 'Local rules primary; Blueprint /health reachable — co-producer still does not take control';
    }
  });

  // Initial
  setTimeout(refresh, 1200);

  return { refresh, dismissAll() { dismissed = new Set(queue.map((t) => t.id)); persistDismiss(); show(null); } };
}
