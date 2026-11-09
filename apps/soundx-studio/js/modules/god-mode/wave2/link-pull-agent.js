/**
 * W2 #2 Link Pull Agent — paste a direct audio-file URL → fetch → decodeAudioData → clip.
 * Honest limits: only links the browser is allowed to read (CORS) and that point at an audio file.
 * Streaming / page links (YouTube, Spotify, SoundCloud, Apple Music, TikTok, Suno …) are refused —
 * no proxy, no scraping. Fallback: drop / pick a file you own.
 */
import { registerFeature } from '../registry.js';
import { makeBatch } from '../command-schema.js';
import { executeBatch, registerBufferRef, resultLine } from '../command-exec.js';
import { decodeAudio } from '../audio-kit.js';
import { songEndBeat, playheadBeat } from '../sections.js';
import { fileDrop, setStatus, busy, esc } from '../w23-ui.js';

const STREAMING = /(^|\.)(youtube\.com|youtu\.be|music\.youtube\.com|spotify\.com|soundcloud\.com|music\.apple\.com|tiktok\.com|deezer\.com|tidal\.com|suno\.(com|ai)|udio\.com|audiomack\.com|boomplay\.com|instagram\.com|facebook\.com|x\.com|twitter\.com)$/i;
const MAX_BYTES = 80 * 1024 * 1024;

export function classifyUrl(raw) {
  let u;
  try { u = new URL(String(raw).trim()); } catch (_) { return { ok: false, code: 'BAD_URL', msg: 'That is not a valid URL.' }; }
  if (!/^https?:$/.test(u.protocol)) return { ok: false, code: 'BAD_URL', msg: 'Only http(s) links are supported.' };
  if (STREAMING.test(u.hostname)) {
    return { ok: false, code: 'STREAMING', msg: `${u.hostname} is a streaming / social page, not an audio file. SoundX does not rip streams. Download the track you own (or export it from your DAW) and drop the file below.` };
  }
  return { ok: true, url: u.href, name: decodeURIComponent(u.pathname.split('/').pop() || u.hostname).slice(0, 48) || 'Link audio' };
}

registerFeature({
  id: 'link-pull-agent',
  title: 'Link Pull Agent',
  blurb: 'Paste a direct audio-file link (wav / mp3 / ogg / m4a / flac) → import as a clip. CORS-blocked or page links get an honest message + file-drop fallback.',
  badge: 'DEMO',
  wave: 2,
  mount(card, ctx) {
    card.innerHTML = `
      <label class="field sx-god-field"><span>Audio file URL</span>
        <input type="url" data-lp-url placeholder="https://example.com/loop.wav" autocomplete="off" />
      </label>
      <div class="sx-god-row">
        <label class="field"><span>Place at</span>
          <select data-lp-at><option value="playhead">Playhead</option><option value="end">Song end</option><option value="zero">Bar 1</option><option value="loop">Loop start</option></select>
        </label>
        <label class="field"><span>Track</span><input type="text" data-lp-track value="Link Pull" /></label>
      </div>
      <div class="btn-row"><button type="button" class="btn primary sm" data-lp-go>Pull link</button></div>
      <div class="sx-god-drop" data-lp-drop tabindex="0" role="button">Fallback: drop an audio file here (or click to pick)</div>
      <input type="file" accept="audio/*,video/mp4,.wav,.mp3,.ogg,.m4a,.flac,.aac" data-lp-file hidden />
      <p class="fineprint" data-lp-status>Browser fetch only — no server proxy, no stream ripping · DEMO</p>
    `;
    const engine = ctx.engine;
    const status = card.querySelector('[data-lp-status]');
    const go = card.querySelector('[data-lp-go]');

    const placeBar = () => {
      const at = card.querySelector('[data-lp-at]').value;
      if (at === 'end') return Math.ceil(songEndBeat(engine) / 4 * 4) / 4;
      if (at === 'zero') return 0;
      if (at === 'loop') return engine.loopStart;
      return Math.floor(playheadBeat(engine) * 4) / 16;
    };

    async function importBuffer(buffer, name) {
      const ref = registerBufferRef(buffer, name);
      const trackName = card.querySelector('[data-lp-track]').value.trim() || 'Link Pull';
      const bar = Math.max(0, Math.round(placeBar() * 4) / 4);
      const res = await executeBatch(ctx, makeBatch(`Link Pull · ${name}`.slice(0, 128), [
        { action: 'add_clip', track: trackName, create_track: true, bar, name, source: { type: 'buffer-ref', ref } },
      ]));
      setStatus(status, res.status === 'success'
        ? `Imported “${name}” · ${buffer.duration.toFixed(1)} s · ${buffer.numberOfChannels} ch @ bar ${bar + 1} on ${trackName} · ${resultLine(res)}`
        : resultLine(res));
    }

    go.addEventListener('click', async () => {
      const c = classifyUrl(card.querySelector('[data-lp-url]').value);
      if (!c.ok) { setStatus(status, c.msg, 'warn'); ctx.toast?.(c.msg, 'warn'); return; }
      busy(go, true, 'Pulling…');
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 30000);
      try {
        await engine.init();
        let res;
        try {
          res = await fetch(c.url, { mode: 'cors', credentials: 'omit', signal: ctrl.signal, cache: 'no-store' });
        } catch (err) {
          if (err?.name === 'AbortError') throw new Error('Timed out after 30 s.');
          throw new Error('The site blocked browser downloads (CORS) or is unreachable. SoundX will not route around that — download the file and drop it below.');
        }
        if (!res.ok) throw new Error(`Server answered ${res.status}. Check the link is public and points at the file itself.`);
        const type = (res.headers.get('content-type') || '').toLowerCase();
        const len = Number(res.headers.get('content-length') || 0);
        if (/text\/html|application\/json|text\/plain/.test(type)) throw new Error(`That link returns a web page (${type.split(';')[0]}), not an audio file. Use the direct file link (ends in .wav/.mp3/.ogg…) or drop the file below.`);
        if (len > MAX_BYTES) throw new Error(`File is ${(len / 1048576).toFixed(0)} MB — limit is 80 MB in the browser.`);
        const ab = await res.arrayBuffer();
        if (ab.byteLength > MAX_BYTES) throw new Error('File is over 80 MB.');
        let buffer;
        try { buffer = await decodeAudio(engine, ab); } catch (_) {
          throw new Error(`Downloaded ${(ab.byteLength / 1024).toFixed(0)} KB but the browser could not decode it as audio (${type || 'unknown type'}).`);
        }
        await importBuffer(buffer, c.name);
      } catch (err) {
        setStatus(status, `✗ ${err.message}`, 'warn');
        ctx.toast?.(err.message, 'warn');
      } finally {
        clearTimeout(timer);
        busy(go, false);
      }
    });

    fileDrop(card.querySelector('[data-lp-drop]'), card.querySelector('[data-lp-file]'), async (file) => {
      try {
        if (file.size > MAX_BYTES) throw new Error('File is over 80 MB.');
        setStatus(status, `Decoding ${esc(file.name)}…`);
        const buffer = await decodeAudio(engine, file);
        await importBuffer(buffer, file.name.replace(/\.[^.]+$/, '').slice(0, 48));
      } catch (err) {
        setStatus(status, `✗ Could not decode ${file.name}: ${err.message || err}`, 'warn');
      }
    });
  },
});
