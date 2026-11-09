import { exportAudio } from '../audio/export-audio.js?v=20261007b-sxs20261020b';
/**
 * Transport bar UI — play/pause/stop, BPM, metronome, loop
 */
function openGodFeature(id) {
  document.dispatchEvent(new CustomEvent('sx-god:focus', { detail: { id } }));
}

export function mountTransport(root, engine, toast, hooks = {}) {
  root.innerHTML = `
    <div class="transport" role="toolbar" aria-label="Transport">
      <div class="transport-brand">
        <span class="logo-mark" aria-hidden="true"></span>
        <div class="brand-text">
          <strong>Mens Mercatus</strong>
          <span>SoundX Studio</span>
        </div>
      </div>
      <div class="transport-controls">
        <button type="button" class="btn icon" data-action="stop" title="Stop (S)">⏹</button>
        <button type="button" class="btn icon primary" data-action="play" title="Play / Pause (Space)">▶</button>
        <label class="field bpm-field" title="Beats per minute">
          <span>BPM</span>
          <input type="number" min="40" max="240" value="${engine.bpm}" data-field="bpm" />
        </label>
        <label class="toggle" title="Metronome click">
          <input type="checkbox" data-field="metro" ${engine.metronomeOn ? 'checked' : ''} />
          <span>Metro</span>
        </label>
        <label class="toggle" title="Loop region on/off. Drag the gold bar on the ruler to set start and end.">
          <input type="checkbox" data-field="loop" ${engine.isLooping ? 'checked' : ''} />
          <span>Loop</span>
        </label>
        <label class="field loop-len-field" title="Loop length in bars (keeps start; moves end)">
          <span>Len</span>
          <select data-field="loop-len">
            <option value="1">1 bar</option>
            <option value="2">2 bars</option>
            <option value="4">4 bars</option>
            <option value="8">8 bars</option>
            <option value="16">16 bars</option>
          </select>
        </label>
        <label class="field loop-edge-field" title="Loop start bar">
          <span>In</span>
          <input type="number" min="0" max="64" step="0.25" data-field="loop-start" value="${engine.loopStart}" />
        </label>
        <label class="field loop-edge-field" title="Loop end bar">
          <span>Out</span>
          <input type="number" min="0.25" max="64" step="0.25" data-field="loop-end" value="${engine.loopEnd}" />
        </label>
        <span class="timecode" data-timecode>001.1.00</span>
        <span class="kbd-hint" title="Keyboard transport">Space play · ← → nudge · S stop · Ctrl+Z undo · Esc exit</span>
      </div>
      <div class="transport-actions">
        <button type="button" class="btn ghost" data-action="undo" title="Undo panel layout or the last mix change (Ctrl+Z)">Undo</button>
        <button type="button" class="btn ghost" data-action="focus" aria-pressed="false" title="Focus mode — hide panels and leave arrange + transport. Escape exits.">Focus</button>
        <button type="button" class="btn ghost" data-action="fs-deck" data-fs="deck" aria-pressed="false" title="Fullscreen the whole deck. Escape exits.">⛶ Deck</button>
        <button type="button" class="btn ghost" data-action="demo" title="Load demo arrangement">Demo</button>
        <button type="button" class="btn ghost" data-action="save" title="Save project to browser">Save</button>
        <button type="button" class="btn ghost" data-action="load" title="Load project from browser">Load</button>
        <label class="field cinema-mix-field" title="Open God Mode Cinema Mix preview modes">
          <span>Cinema</span>
          <select data-god-cinema aria-label="Cinema Mix modes">
            <option value="">Mix…</option>
            <option value="cinema-mix">Open Cinema Mix</option>
          </select>
        </label>
        <button type="button" class="btn ghost" data-god-hook="vault-export" title="Open God Mode · Vault Export Suite">Vault</button>
        <button type="button" class="btn ghost" data-god-hook="export-loop-clip" title="Open God Mode · Export Loop Clip (bounce the loop region to WAV)">Loop WAV</button>
        <div class="sx-export-menu" data-export-menu>
          <button type="button" class="btn ghost" data-action="export-toggle" data-sx-tip="Export project JSON or audio mixdown (WAV / FLAC / MP3 / Ogg)" title="Export" aria-haspopup="true" aria-expanded="false">Export ▾</button>
          <div class="sx-export-dropdown" data-export-dropdown hidden role="menu">
            <button type="button" role="menuitem" data-export="json">Project JSON</button>
            <button type="button" role="menuitem" data-export="wav">WAV (PCM)</button>
            <button type="button" role="menuitem" data-export="flac">FLAC</button>
            <button type="button" role="menuitem" data-export="mp3">MP3</button>
            <button type="button" role="menuitem" data-export="ogg">Ogg Vorbis / Opus</button>
          </div>
        </div>
        <label class="btn ghost file-btn" title="Import project JSON">
          Import
          <input type="file" accept="application/json,.json" data-field="import" hidden />
        </label>
      </div>
    </div>
  `;

  const playBtn = root.querySelector('[data-action="play"]');
  const timecode = root.querySelector('[data-timecode]');

  root.addEventListener('click', (e) => {
    const hook = e.target.closest('[data-god-hook]');
    if (!hook) return;
    e.preventDefault();
    openGodFeature(hook.dataset.godHook);
  });
  root.querySelector('[data-god-cinema]')?.addEventListener('change', (e) => {
    const id = e.target.value;
    e.target.value = '';
    if (id) openGodFeature(id);
  });

  function updatePlayBtn() {
    playBtn.textContent = engine.isPlaying ? '⏸' : '▶';
    playBtn.title = engine.isPlaying ? 'Pause (Space)' : 'Play (Space)';
  }

  function formatTC(beat) {
    const bar = Math.floor(beat / 4) + 1;
    const b = Math.floor(beat % 4) + 1;
    const tick = Math.floor((beat % 1) * 100);
    return `${String(bar).padStart(3, '0')}.${b}.${String(tick).padStart(2, '0')}`;
  }

  engine.on('tick', ({ beat }) => {
    timecode.textContent = formatTC(beat);
  });
  engine.on('play', updatePlayBtn);
  engine.on('pause', updatePlayBtn);
  engine.on('stop', () => {
    updatePlayBtn();
    timecode.textContent = '001.1.00';
  });
  engine.on('bpm', (bpm) => {
    root.querySelector('[data-field="bpm"]').value = bpm;
  });

  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'undo') {
      hooks.onUndo?.();
    } else if (action === 'focus') {
      hooks.onFocus?.();
    } else if (action === 'fs-deck') {
      hooks.onFullscreen?.();
    } else if (action === 'play') {
      if (engine.isPlaying) engine.pause();
      else await engine.play();
    } else if (action === 'stop') {
      engine.stop();
    } else if (action === 'demo') {
      await engine.init();
      engine.loadDemoProject();
      window.dispatchEvent(new CustomEvent('mm-sound-deck-demo-loaded'));
      toast('Demo arrangement loaded — press Play');
    } else if (action === 'save') {
      localStorage.setItem('mm-sound-deck-project', JSON.stringify(engine.toJSON()));
      toast('Project saved to localStorage');
    } else if (action === 'load') {
      const raw = localStorage.getItem('mm-sound-deck-project');
      if (!raw) {
        toast('No saved project found', 'warn');
        return;
      }
      try {
        await engine.init();
        engine.fromJSON(JSON.parse(raw));
        toast('Project loaded');
      } catch (err) {
        toast('Failed to load project', 'error');
      }
    } else if (action === 'export-toggle') {
      const dd = root.querySelector('[data-export-dropdown]');
      const open = dd && dd.hidden;
      if (dd) {
        dd.hidden = !open;
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
    }
  });

  async function doExport(kind) {
    const dd = root.querySelector('[data-export-dropdown]');
    if (dd) dd.hidden = true;
    root.querySelector('[data-action="export-toggle"]')?.setAttribute('aria-expanded', 'false');
    if (kind === 'json') {
      const blob = new Blob([JSON.stringify(engine.toJSON(), null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `soundx-studio-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast('Project JSON downloaded');
      return;
    }
    try {
      await exportAudio(engine, kind, toast);
    } catch (err) {
      console.error(err);
      toast(`Export failed: ${err.message || err}`, 'error');
    }
  }

  root.querySelector('[data-export-dropdown]')?.addEventListener('click', (e) => {
    const item = e.target.closest('[data-export]');
    if (!item) return;
    doExport(item.dataset.export);
  });

  document.addEventListener('click', (e) => {
    const menu = root.querySelector('[data-export-menu]');
    if (!menu || menu.contains(e.target)) return;
    const dd = root.querySelector('[data-export-dropdown]');
    if (dd) dd.hidden = true;
  });

  root.querySelector('[data-field="bpm"]').addEventListener('change', (e) => {
    engine.setBpm(e.target.value);
  });
  root.querySelector('[data-field="metro"]').addEventListener('change', (e) => {
    engine.metronomeOn = e.target.checked;
    toast(e.target.checked ? 'Metronome on' : 'Metronome off');
  });
  function syncLoopFields() {
    const len = root.querySelector('[data-field="loop-len"]');
    const sIn = root.querySelector('[data-field="loop-start"]');
    const sOut = root.querySelector('[data-field="loop-end"]');
    const span = Math.round((engine.loopEnd - engine.loopStart) * 1000) / 1000;
    if (len) {
      const match = [...len.options].find((o) => Math.abs(Number(o.value) - span) < 0.01);
      if (match) len.value = match.value;
      else {
        // custom length: leave select on closest without forcing
        let best = len.options[0];
        let bestD = Infinity;
        for (const o of len.options) {
          const d = Math.abs(Number(o.value) - span);
          if (d < bestD) { bestD = d; best = o; }
        }
        len.value = best.value;
      }
    }
    if (sIn) sIn.value = String(engine.loopStart);
    if (sOut) sOut.value = String(engine.loopEnd);
  }
  syncLoopFields();

  root.querySelector('[data-field="loop"]').addEventListener('change', (e) => {
    engine.setLoopRegion(engine.loopStart, engine.loopEnd, e.target.checked);
    const sb = Math.round(engine.loopStart * 4 * 100) / 100;
    const eb = Math.round(engine.loopEnd * 4 * 100) / 100;
    toast(e.target.checked ? `Loop on · beats ${sb}–${eb}. Drag the gold bar on the ruler.` : 'Loop off');
  });
  root.querySelector('[data-field="loop-len"]').addEventListener('change', (e) => {
    const bars = Math.max(0.25, Number(e.target.value) || 4);
    const start = engine.loopStart;
    engine.setLoopRegion(start, start + bars, true);
    toast(`Loop length ${bars} bar${bars === 1 ? '' : 's'}`);
  });
  function applyLoopEdges() {
    const s = Number(root.querySelector('[data-field="loop-start"]').value);
    const e = Number(root.querySelector('[data-field="loop-end"]').value);
    engine.setLoopRegion(s, e, true);
    const sb = Math.round(engine.loopStart * 4 * 100) / 100;
    const eb = Math.round(engine.loopEnd * 4 * 100) / 100;
    toast(`Loop beats ${sb}–${eb}`);
  }
  root.querySelector('[data-field="loop-start"]').addEventListener('change', applyLoopEdges);
  root.querySelector('[data-field="loop-end"]').addEventListener('change', applyLoopEdges);
  engine.on('loop', ({ isLooping }) => {
    const box = root.querySelector('[data-field="loop"]');
    if (box) box.checked = !!isLooping;
    syncLoopFields();
  });
  root.querySelector('[data-field="import"]').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await engine.init();
      engine.fromJSON(JSON.parse(text));
      toast(`Imported ${file.name}`);
    } catch (_) {
      toast('Invalid project file', 'error');
    }
    e.target.value = '';
  });

  return { updatePlayBtn };
}
