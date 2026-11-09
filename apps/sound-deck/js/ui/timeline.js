/**
 * Timeline UI — tracks, clips, mute/solo/volume, drag place,
 * snap-to-grid, draggable loop region, arrange fullscreen.
 */
import { toggleFullscreen } from './layout.js';
import { mixChanged } from './history.js';

const PX_PER_BEAT = 40;
const BARS_VISIBLE = 16; // minimum; grows to fit long arrangements (Tradingfloor Form)
const BARS_MAX = 160;
const HEADER_W = 200;
const SNAP_KEY = 'mm-sound-deck-snap';

export function mountTimeline(root, engine, toast, library, history) {
  let snapOn = true;
  let quantizeStep = 0.5; // beats (1/8)
  try {
    const saved = JSON.parse(localStorage.getItem(SNAP_KEY) || 'null');
    if (saved) {
      snapOn = saved.on !== false;
      if (Number(saved.step) > 0) quantizeStep = Number(saved.step);
    }
  } catch (_) {}

  root.innerHTML = `
    <div class="timeline-header">
      <div class="timeline-tools">
        <button type="button" class="btn sm" data-action="add-audio" title="Add audio track">+ Audio</button>
        <button type="button" class="btn sm" data-action="add-midi" title="Add MIDI track">+ MIDI</button>
        <button type="button" class="btn sm ghost" data-action="place-demo" title="Place a demo clip on selected track">Place Clip</button>
        <label class="toggle snap-toggle" title="Snap clip moves and the loop to the grid">
          <input type="checkbox" data-snap ${snapOn ? 'checked' : ''} />
          <span>Snap</span>
        </label>
        <label class="field snap-field" title="Quantize grid">
          <span>Grid</span>
          <select data-quantize>
            <option value="4">Bar</option>
            <option value="1">Beat</option>
            <option value="0.5">1/8</option>
            <option value="0.25">1/16</option>
          </select>
        </label>
        <button type="button" class="btn sm ghost" data-action="fs-arrange" data-fs="arrange" aria-pressed="false" title="Fullscreen arrange view. Escape exits.">⛶ Arrange</button>
      </div>
      <div class="ruler" data-ruler></div>
    </div>
    <div class="timeline-body" data-body></div>
  `;

  // Header spans the full arrangement width so the ruler scrolls with long songs; tool strips
  // stay pinned to the visible width via --tl-view-w (sticky left).
  const syncViewW = () => root.style.setProperty('--tl-view-w', `${root.clientWidth}px`);
  syncViewW();
  try { new ResizeObserver(syncViewW).observe(root); } catch (_) { window.addEventListener('resize', syncViewW); }
  const body = root.querySelector('[data-body]');
  const ruler = root.querySelector('[data-ruler]');
  const quantizeSelect = root.querySelector('[data-quantize]');
  quantizeSelect.value = String(quantizeStep);
  if (![...quantizeSelect.options].some((o) => o.value === quantizeSelect.value)) {
    quantizeStep = 0.5;
    quantizeSelect.value = '0.5';
  }

  let selectedTrackId = null;
  let selectedClip = null;
  let playheadEl = null;

  function persistSnap() {
    try {
      localStorage.setItem(SNAP_KEY, JSON.stringify({ on: snapOn, step: quantizeStep }));
    } catch (_) {}
  }

  function quantizeBeat(beat) {
    const raw = Math.max(0, beat);
    if (!snapOn) return Math.round(raw * 100) / 100;
    const q = quantizeStep;
    return Math.max(0, Math.round(raw / q) * q);
  }

  function loopGeometry() {
    const startPx = engine.loopStart * 4 * PX_PER_BEAT;
    const endPx = engine.loopEnd * 4 * PX_PER_BEAT;
    return {
      left: HEADER_W + startPx,
      width: Math.max(PX_PER_BEAT * 0.25, endPx - startPx),
    };
  }

  function barsVisible() {
    let end = 0;
    engine.tracks.forEach((t) => t.clips.forEach((c) => { end = Math.max(end, c.startBeat + c.durationBeats); }));
    return Math.min(BARS_MAX, Math.max(BARS_VISIBLE, Math.ceil(end / 4) + 4));
  }

  function renderRuler() {
    let html = '<div class="ruler-inner">';
    const nBars = barsVisible();
    for (let bar = 0; bar < nBars; bar++) {
      html += `<div class="ruler-bar" style="width:${PX_PER_BEAT * 4}px"><span>${bar + 1}</span></div>`;
    }
    html += '</div>';
    const g = loopGeometry();
    html += `
      <div class="loop-bar ${engine.isLooping ? 'on' : ''}" data-loop style="left:${g.left}px;width:${g.width}px" title="Drag the loop. Edges resize. Dragging turns loop on. Double-click toggles loop.">
        <button type="button" class="loop-handle" data-loop-edge="start" aria-label="Resize loop start"></button>
        <span class="loop-label">Loop</span>
        <button type="button" class="loop-handle" data-loop-edge="end" aria-label="Resize loop end"></button>
      </div>
      <div class="playhead playhead--ruler" data-playhead-ruler style="transform:translateX(0)" aria-hidden="true">
        <span class="playhead-cap"></span>
      </div>`;
    ruler.innerHTML = html;
    bindLoopDrag();
    bindRulerScrub();
    const beatNow = engine.isPlaying ? engine.currentBeat : (engine.pauseOffset / engine.secondsPerBeat || 0);
    positionPlayheads(beatNow);
  }

  function positionLoop() {
    const bar = ruler.querySelector('[data-loop]');
    const shade = body.querySelector('[data-loop-shade]');
    const g = loopGeometry();
    if (bar) {
      bar.style.left = g.left + 'px';
      bar.style.width = g.width + 'px';
      bar.classList.toggle('on', !!engine.isLooping);
    }
    if (shade) {
      shade.style.left = g.left + 'px';
      shade.style.width = g.width + 'px';
      shade.classList.toggle('on', !!engine.isLooping);
    }
  }

  function render() {
    renderRuler();
    if (!selectedTrackId && engine.tracks[0]) selectedTrackId = engine.tracks[0].id;

    const g = loopGeometry();
    const shade = `<div class="loop-shade ${engine.isLooping ? 'on' : ''}" data-loop-shade style="left:${g.left}px;width:${g.width}px"></div>`;

    body.innerHTML = shade + engine.tracks.map((t) => {
      const clips = t.clips.map((c) => {
        const left = c.startBeat * PX_PER_BEAT;
        const width = Math.max(12, c.durationBeats * PX_PER_BEAT);
        const selected = selectedClip && selectedClip.clipId === c.id && selectedClip.trackId === t.id;
        return `<div class="clip ${selected ? 'selected' : ''}" data-clip="${c.id}" data-track="${t.id}"
          style="left:${left}px;width:${width}px;background:${c.color}"
          title="${escapeHtml(c.name)} @ beat ${c.startBeat.toFixed(2)}"
          draggable="true">${escapeHtml(c.name)}</div>`;
      }).join('');

      return `
        <div class="track-row ${selectedTrackId === t.id ? 'selected' : ''}" data-track-id="${t.id}">
          <div class="track-header">
            <button type="button" class="track-select" data-select="${t.id}" title="Select track">
              <span class="track-type">${t.type === 'midi' ? 'MIDI' : 'AUD'}</span>
              <span class="track-name">${escapeHtml(t.name)}</span>
            </button>
            <div class="track-controls">
              <button type="button" class="chip mute ${t.muted ? 'on' : ''}" data-mute="${t.id}" title="Mute — sets this track's Web Audio gain to 0">M</button>
              <button type="button" class="chip solo ${t.solo ? 'on' : ''}" data-solo="${t.id}" title="Solo — other tracks' gain goes to 0">S</button>
              <input type="range" min="0" max="1" step="0.01" value="${t.volume}" data-vol="${t.id}" title="Volume — track gain node" />
              <button type="button" class="chip danger" data-remove="${t.id}" title="Remove track">×</button>
            </div>
          </div>
          <div class="track-lane" data-lane="${t.id}" style="width:${barsVisible() * 4 * PX_PER_BEAT}px">
            ${clips}
          </div>
        </div>`;
    }).join('') + `<div class="playhead playhead--body" data-playhead style="transform:translateX(0)" aria-hidden="true"><span class="playhead-cap"></span></div>`;

    playheadEl = body.querySelector('[data-playhead]');
    const beat = engine.isPlaying ? engine.currentBeat : (engine.pauseOffset / engine.secondsPerBeat || 0);
    positionPlayheads(beat);
    bindLaneClicks();
    bindDrag();
  }

  function positionPlayheads(beat) {
    const x = Math.max(0, (Number(beat) || 0) * PX_PER_BEAT);
    if (playheadEl) playheadEl.style.transform = `translateX(${x}px)`;
    const rulerPh = ruler.querySelector('[data-playhead-ruler]');
    if (rulerPh) rulerPh.style.transform = `translateX(${x}px)`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function bindLaneClicks() {
    body.querySelectorAll('[data-lane]').forEach((lane) => {
      lane.addEventListener('click', (e) => {
        if (e.target.closest('.clip')) return;
        const trackId = lane.dataset.lane;
        selectedTrackId = trackId;
        body.querySelectorAll('.track-row').forEach((r) => {
          r.classList.toggle('selected', r.dataset.trackId === trackId);
        });
      });
      lane.addEventListener('dblclick', async (e) => {
        if (e.target.closest('.clip')) return;
        const rect = lane.getBoundingClientRect();
        const beat = quantizeBeat((e.clientX - rect.left) / PX_PER_BEAT);
        await placeDemoClip(lane.dataset.lane, beat);
      });
    });
  }

  function bindDrag() {
    let dragClip = null;
    body.querySelectorAll('.clip').forEach((el) => {
      el.addEventListener('dragstart', (e) => {
        dragClip = { trackId: el.dataset.track, clipId: el.dataset.clip };
        e.dataTransfer.setData('text/plain', JSON.stringify(dragClip));
        e.dataTransfer.effectAllowed = 'move';
      });
    });
    body.querySelectorAll('[data-lane]').forEach((lane) => {
      lane.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });
      lane.addEventListener('drop', (e) => {
        e.preventDefault();
        let data = dragClip;
        try {
          data = JSON.parse(e.dataTransfer.getData('text/plain') || '{}');
        } catch (_) {}
        const libId = e.dataTransfer.getData('application/x-mm-sample');
        const rect = lane.getBoundingClientRect();
        const beat = quantizeBeat((e.clientX - rect.left) / PX_PER_BEAT);
        if (libId && library) {
          const sample = library.get(libId);
          if (sample) {
            engine.addClip(lane.dataset.lane, {
              name: sample.name,
              startBeat: beat,
              durationBeats: sample.durationBeats || 1,
              color: sample.color || '#F5C518',
              buffer: sample.buffer,
              recipe: sample.recipe,
            });
            toast(`Dropped ${sample.name}${snapOn ? ' · snapped' : ''}`);
            return;
          }
        }
        if (data?.clipId) {
          const from = engine.tracks.find((t) => t.id === data.trackId);
          const clip = from?.clips.find((c) => c.id === data.clipId);
          if (!clip) return;
          if (data.trackId === lane.dataset.lane) {
            engine.moveClip(data.trackId, data.clipId, beat);
          } else {
            engine.removeClip(data.trackId, data.clipId);
            engine.addClip(lane.dataset.lane, {
              name: clip.name,
              startBeat: beat,
              durationBeats: clip.durationBeats,
              color: clip.color,
              buffer: clip.buffer,
              recipe: clip.recipe,
              notes: clip.notes,
              meta: clip.meta,
            });
          }
        }
      });
    });
  }

  function bindLoopDrag() {
    const bar = ruler.querySelector('[data-loop]');
    if (!bar) return;
    bar.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const edge = e.target.closest('[data-loop-edge]')?.dataset.loopEdge || 'move';
      const originX = e.clientX;
      const start0 = engine.loopStart;
      const end0 = engine.loopEnd;
      const pxPerBar = PX_PER_BEAT * 4;
      function deltaBars(ev) {
        let bars = (ev.clientX - originX) / pxPerBar;
        if (snapOn) {
          const qBars = quantizeStep / 4;
          bars = Math.round(bars / qBars) * qBars;
        }
        return bars;
      }
      function move(ev) {
        const d = deltaBars(ev);
        let s = start0;
        let en = end0;
        if (edge === 'start') s = start0 + d;
        else if (edge === 'end') en = end0 + d;
        else {
          s = start0 + d;
          en = end0 + d;
        }
        const minSpan = snapOn ? Math.max(quantizeStep / 4, 0.25) : 0.25;
        if (s < 0) {
          if (edge === 'move') en -= s;
          s = 0;
        }
        if (en < s + minSpan) en = s + minSpan;
        engine.loopStart = Math.round(s * 1000) / 1000;
        engine.loopEnd = Math.round(en * 1000) / 1000;
        engine.isLooping = true;
        positionLoop();
      }
      function up() {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        engine.setLoopRegion(engine.loopStart, engine.loopEnd, true);
        const sb = Math.round(engine.loopStart * 4 * 100) / 100;
        const eb = Math.round(engine.loopEnd * 4 * 100) / 100;
        toast(`Loop beats ${sb}–${eb}`);
      }
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
    bar.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      engine.setLoopRegion(engine.loopStart, engine.loopEnd, !engine.isLooping);
      toast(engine.isLooping ? 'Loop on' : 'Loop off');
    });
  }

  function beatFromClientX(clientX) {
    const lane = body.querySelector('[data-lane]');
    const rect = (lane || body).getBoundingClientRect();
    // lanes start after track header; ruler bars align with HEADER_W offset on loop bar
    // For lane clicks we use lane rect; for ruler use ruler content after header gap
    return (clientX - rect.left) / PX_PER_BEAT;
  }

  function beatFromRulerX(clientX) {
    const inner = ruler.querySelector('.ruler-inner') || ruler;
    const rect = inner.getBoundingClientRect();
    return (clientX - rect.left) / PX_PER_BEAT;
  }

  function bindRulerScrub() {
    if (ruler._mmScrubBound) return;
    ruler._mmScrubBound = true;
    let scrubbing = false;
    function seekAt(clientX) {
      const beat = quantizeBeat(beatFromRulerX(clientX));
      engine.seekToBeat(beat);
      positionPlayheads(beat);
    }
    ruler.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('[data-loop]')) return;
      e.preventDefault();
      scrubbing = true;
      ruler.classList.add('is-scrubbing');
      seekAt(e.clientX);
      try { ruler.setPointerCapture(e.pointerId); } catch (_) {}
    });
    ruler.addEventListener('pointermove', (e) => {
      if (!scrubbing) return;
      seekAt(e.clientX);
    });
    function endScrub(e) {
      if (!scrubbing) return;
      scrubbing = false;
      ruler.classList.remove('is-scrubbing');
      try { ruler.releasePointerCapture(e.pointerId); } catch (_) {}
    }
    ruler.addEventListener('pointerup', endScrub);
    ruler.addEventListener('pointercancel', endScrub);
  }


  async function placeDemoClip(trackId, startBeat = 0) {
    await engine.init();
    const kinds = ['kick', 'hat', 'snare', 'pad', 'tone'];
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const recipe = kind === 'tone'
      ? { type: 'tone', freq: 220 + Math.random() * 440, duration: 0.5 }
      : { type: kind, duration: kind === 'pad' ? 2 : 0.35 };
    const buf = engine.createBufferFromRecipe(recipe);
    engine.addClip(trackId, {
      name: kind.charAt(0).toUpperCase() + kind.slice(1),
      startBeat,
      durationBeats: kind === 'pad' ? 4 : 1,
      color: '#F5C518',
      buffer: buf,
      recipe,
    });
    toast(`Placed ${kind} clip`);
  }

  function nudge(dir) {
    const step = snapOn ? quantizeStep : 0.25;
    if (selectedClip) {
      const track = engine.tracks.find((t) => t.id === selectedClip.trackId);
      const clip = track?.clips.find((c) => c.id === selectedClip.clipId);
      if (clip) {
        engine.moveClip(track.id, clip.id, Math.max(0, quantizeBeat(clip.startBeat + dir * step)));
        return 'clip';
      }
    }
    engine.nudgeBeats(dir * step);
    return 'playhead';
  }

  root.querySelector('[data-snap]').addEventListener('change', (e) => {
    snapOn = e.target.checked;
    persistSnap();
    toast(snapOn ? `Snap on · grid ${labelStep(quantizeStep)}` : 'Snap off · free placement');
  });
  quantizeSelect.addEventListener('change', (e) => {
    quantizeStep = Number(e.target.value) || 0.5;
    snapOn = true;
    root.querySelector('[data-snap]').checked = true;
    persistSnap();
    toast(`Grid ${labelStep(quantizeStep)}`);
  });

  root.addEventListener('click', async (e) => {
    const fs = e.target.closest('[data-action="fs-arrange"]');
    if (fs) {
      const ok = toggleFullscreen(root);
      if (!ok) toast('Fullscreen is not available in this browser', 'warn');
      return;
    }

    const clipEl = e.target.closest('.clip');
    if (clipEl) {
      selectedClip = { trackId: clipEl.dataset.track, clipId: clipEl.dataset.clip };
      selectedTrackId = clipEl.dataset.track;
      body.querySelectorAll('.clip').forEach((c) => c.classList.toggle('selected', c === clipEl));
      body.querySelectorAll('.track-row').forEach((r) => {
        r.classList.toggle('selected', r.dataset.trackId === selectedTrackId);
      });
    }

    const addA = e.target.closest('[data-action="add-audio"]');
    const addM = e.target.closest('[data-action="add-midi"]');
    const place = e.target.closest('[data-action="place-demo"]');
    if (addA) {
      await engine.init();
      const t = engine.addTrack('audio');
      selectedTrackId = t.id;
      toast(`Added ${t.name}`);
    } else if (addM) {
      await engine.init();
      const t = engine.addTrack('midi');
      selectedTrackId = t.id;
      toast(`Added ${t.name}`);
    } else if (place) {
      await engine.init();
      const id = selectedTrackId || engine.tracks[0]?.id;
      if (!id) { toast('No track available', 'warn'); return; }
      await placeDemoClip(id, quantizeBeat(Math.floor(engine.currentBeat)));
    }

    const mute = e.target.closest('[data-mute]');
    if (mute) {
      const t = engine.tracks.find((x) => x.id === mute.dataset.mute);
      if (t) {
        const before = engine.captureMix();
        engine.setTrackMute(t.id, !t.muted);
        if (history && mixChanged(before, engine.captureMix())) {
          history.push({ label: 'Undid mix change', undo: () => engine.applyMix(before) });
        }
      }
    }
    const solo = e.target.closest('[data-solo]');
    if (solo) {
      const t = engine.tracks.find((x) => x.id === solo.dataset.solo);
      if (t) {
        const before = engine.captureMix();
        engine.setTrackSolo(t.id, !t.solo);
        if (history && mixChanged(before, engine.captureMix())) {
          history.push({ label: 'Undid mix change', undo: () => engine.applyMix(before) });
        }
      }
    }
    const rem = e.target.closest('[data-remove]');
    if (rem) {
      if (engine.removeTrack(rem.dataset.remove)) toast('Track removed');
      else toast('Keep at least one track', 'warn');
    }
    const sel = e.target.closest('[data-select]');
    if (sel) {
      selectedTrackId = sel.dataset.select;
      render();
    }
  });

  let mixGesture = null;
  root.addEventListener('pointerdown', (e) => {
    if (!history || history.applying) return;
    if (e.target.closest('[data-vol]')) mixGesture = engine.captureMix();
  });
  window.addEventListener('pointerup', () => {
    if (!mixGesture || !history || history.applying) { mixGesture = null; return; }
    const before = mixGesture;
    mixGesture = null;
    const after = engine.captureMix();
    if (mixChanged(before, after)) {
      history.push({ label: 'Undid mix change', undo: () => engine.applyMix(before) });
    }
  });

  root.addEventListener('input', (e) => {
    const vol = e.target.closest('[data-vol]');
    if (vol) engine.setTrackVolume(vol.dataset.vol, Number(vol.value));
  });

  engine.on('tracks', render);
  engine.on('loop', positionLoop);
  window.addEventListener('mm-sound-deck-demo-loaded', () => render());
  engine.on('tick', ({ beat }) => {
    positionPlayheads(beat);
  });
  engine.on('stop', () => {
    positionPlayheads(0);
  });

  document.addEventListener('fullscreenchange', syncFs);
  document.addEventListener('webkitfullscreenchange', syncFs);
  function syncFs() {
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    const btn = root.querySelector('[data-action="fs-arrange"]');
    if (!btn) return;
    const on = fs === root;
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.classList.toggle('primary', on);
  }

  render();

  return {
    getSelectedTrackId: () => selectedTrackId || engine.tracks[0]?.id,
    /** { trackId, clipId, clip, track } for the last clicked clip, or null */
    getSelectedClip: () => {
      if (!selectedClip) return null;
      const track = engine.tracks.find((t) => t.id === selectedClip.trackId);
      const clip = track?.clips.find((c) => c.id === selectedClip.clipId);
      return clip ? { trackId: track.id, clipId: clip.id, clip, track } : null;
    },
    selectClip: (trackId, clipId) => {
      selectedClip = clipId ? { trackId, clipId } : null;
      if (trackId) selectedTrackId = trackId;
      render();
    },
    placeDemoClip,
    render,
    nudge,
    quantizeBeat,
  };
}

function labelStep(step) {
  if (step === 4) return 'bar';
  if (step === 1) return 'beat';
  if (step === 0.5) return '1/8';
  if (step === 0.25) return '1/16';
  return String(step);
}
