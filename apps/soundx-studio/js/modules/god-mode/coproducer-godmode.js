/**
 * Co-Producer God Mode — suggestion rail with Apply via godApply (local DEMO rules).
 */
import { registerFeature } from './registry.js';
import { godApply } from './apply.js';

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
  const keys = trackByName(engine, /key|melod|lead|synth|chord/i);
  const muted = engine.tracks.filter((t) => t.muted).length;
  const bpm = engine.bpm;
  const clips = engine.tracks.reduce((n, t) => n + clipCount(t), 0);

  if (bpm < 90) {
    tips.push({
      id: 'bpm-slow',
      title: 'Tempo feels leisurely',
      body: `Session is ${bpm} BPM. For house / amapiano energy, try 110–120.`,
      action: { type: 'bpm', value: 118 },
      actionLabel: 'Set 118 BPM',
    });
  }
  if (bpm > 150) {
    tips.push({
      id: 'bpm-fast',
      title: 'Very fast tempo',
      body: `${bpm} BPM is DnB territory. Drop toward 128 for dancefloor room.`,
      action: { type: 'bpm', value: 128 },
      actionLabel: 'Set 128 BPM',
    });
  }
  if (drums && bass && clipCount(drums) && clipCount(bass)) {
    if ((drums.eq?.low || 0) > 3 && (bass.eq?.low || 0) > 3) {
      tips.push({
        id: 'kick-bass-clash',
        title: 'Kick / bass low-end clash',
        body: 'Both Drums and Bass have boosted lows. Ease bass low EQ.',
        action: { type: 'eq', trackId: bass.id, eq: { low: Math.max(-6, (bass.eq?.low || 0) - 4) } },
        actionLabel: 'Ease bass low EQ',
      });
    }
  }
  if (drums && clipCount(drums) === 0) {
    tips.push({
      id: 'no-drums',
      title: 'No drum clips yet',
      body: 'Generate an arrangement or open Drummer for a groove.',
      action: { type: 'ensure-drums' },
      actionLabel: 'Add kick stub',
    });
  }
  if (keys && clipCount(keys) === 0 && clipCount(drums) > 0) {
    tips.push({
      id: 'add-keys',
      title: 'Space for a topline',
      body: 'Drums are in — sketch a Lead / Keys phrase.',
      action: { type: 'noop' },
      actionLabel: null,
    });
  }
  if (muted >= 2) {
    tips.push({
      id: 'many-muted',
      title: 'Several tracks muted',
      body: `${muted} tracks muted. Unmute all non-ghost lanes?`,
      action: { type: 'unmute-all' },
      actionLabel: 'Unmute all',
    });
  }
  if (!engine._reverbOn && clips > 2) {
    tips.push({
      id: 'reverb-glue',
      title: 'Try master space',
      body: 'A touch of master reverb can glue the drop.',
      action: { type: 'reverb', on: true },
      actionLabel: 'Enable master reverb',
    });
  }
  if (extras.mood === 'dark' && !engine._reverbOn) {
    tips.push({
      id: 'dark-mood',
      title: 'Stem DNA reads dark',
      body: 'Last stem analysis tagged dark — delay/space can add depth.',
      action: { type: 'reverb', on: true },
      actionLabel: 'Enable reverb',
    });
  }
  if (!tips.length) {
    tips.push({
      id: 'all-good',
      title: 'Session looks balanced',
      body: 'No clashes flagged. Forge hooks or export a vault when ready.',
      action: { type: 'noop' },
      actionLabel: null,
    });
  }
  return tips;
}

async function runAction(ctx, action) {
  const engine = ctx.engine;
  if (!action || action.type === 'noop') return 'No-op';
  if (action.type === 'bpm') {
    engine.setBpm(action.value);
    return `BPM → ${action.value}`;
  }
  if (action.type === 'reverb') {
    engine.setMasterReverb?.(!!action.on);
    return 'Master reverb on';
  }
  if (action.type === 'eq' && action.trackId) {
    const t = engine.tracks.find((x) => x.id === action.trackId);
    if (t && action.eq) {
      t.eq = { ...t.eq, ...action.eq };
      if (typeof engine.setTrackEq === 'function') {
        for (const [band, gain] of Object.entries(action.eq)) {
          engine.setTrackEq(t.id, band, gain);
        }
      }
      engine._emit?.('tracks', engine.tracks);
      return `EQ on ${t.name}`;
    }
  }
  if (action.type === 'unmute-all') {
    engine.tracks.forEach((t) => {
      if (t.muted) {
        t.muted = false;
        engine._applyTrackGain?.(t);
      }
    });
    engine._emit?.('tracks', engine.tracks);
    return 'Unmuted all tracks';
  }
  if (action.type === 'ensure-drums') {
    let drums = trackByName(engine, /drum|perc|beat/i);
    if (!drums) drums = engine.addTrack('audio', 'Drums');
    const kick = engine.createBufferFromRecipe({ type: 'kick', duration: 0.4 });
    engine.addClip(drums.id, {
      name: 'Stub Kick',
      startBeat: 0,
      durationBeats: 0.4,
      color: '#F5C518',
      buffer: kick,
      meta: { kind: 'god-copro-stub' },
    });
    engine._emit?.('tracks', engine.tracks);
    return 'Kick stub on Drums';
  }
  return 'Done';
}

registerFeature({
  id: 'coproducer-godmode',
  title: 'Co-Producer God Mode',
  blurb: 'Proactive suggestion rail from local session rules — Apply goes through godApply (undoable).',
  badge: 'DEMO',
  mount(cardEl, ctx) {
    cardEl.innerHTML = `
      <div class="btn-row">
        <button type="button" class="btn sm ghost" data-cp-refresh>Refresh tips</button>
      </div>
      <div class="sx-god-copro-list" data-cp-list></div>
      <p class="fineprint" data-cp-status>Local heuristics · never auto-sends · DEMO</p>
    `;
    const list = cardEl.querySelector('[data-cp-list]');
    const status = cardEl.querySelector('[data-cp-status]');
    let tips = [];

    function moodFromCtx() {
      const dna = ctx.stemDna?.lastAnalysis;
      return dna?.mood?.mood || dna?.mood || null;
    }

    function render() {
      const engine = ctx.engine;
      if (!engine) {
        list.innerHTML = '<p class="fineprint">No engine</p>';
        return;
      }
      tips = buildSuggestions(engine, { mood: moodFromCtx() });
      list.innerHTML = tips.map((t, i) => `
        <div class="sx-god-copro-item" data-tip="${t.id}">
          <strong>${t.title}</strong>
          <p>${t.body}</p>
          <div class="btn-row">
            ${t.actionLabel ? `<button type="button" class="btn sm primary" data-cp-apply="${i}">${t.actionLabel}</button>` : ''}
          </div>
        </div>
      `).join('');
      status.textContent = `${tips.length} tip(s) · ${ctx.assistMode === 'LIVE' ? 'Assist reachable (rules still local)' : 'DEMO rules'} · DEMO`;
    }

    cardEl.querySelector('[data-cp-refresh]').addEventListener('click', render);

    list.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-cp-apply]');
      if (!btn) return;
      const tip = tips[Number(btn.dataset.cpApply)];
      if (!tip?.action) return;
      await godApply(ctx, `Co-Producer · ${tip.title}`, async () => {
        await ctx.engine.init();
        const msg = await runAction(ctx, tip.action);
        status.textContent = `${msg} · undo via Restore · DEMO`;
      });
      render();
    });

    render();
  },
});
