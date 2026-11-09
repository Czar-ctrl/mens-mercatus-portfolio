/* preview wave 3 AI — Live AI Playground (all in the browser, no server):
   (a) hum / tap → pitch detection (YIN) → melody + beat sketch you can play (Web Audio)
   (b) till slip → OCR (tesseract.js, self-hosted, lazy) or pasted text → item/price breakdown on clearly-labelled EXAMPLE data
   (c) agent pipeline visualiser → how Katlego's bots route a task through intent, context, router, tools, human gate and record. */
import { esc, reduce } from './core.js';
const d = document, B = (window.MM_AI_CONFIG || {}).base || '/';
const NOTE = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const nm = m => NOTE[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
let AC = null; const ac = () => AC || (AC = new (window.AudioContext || window.webkitAudioContext)());

/* ================= (a) hum / tap ================= */
export function yin(buf, sr) {
  const n = buf.length; let rms = 0; for (let i = 0; i < n; i++) rms += buf[i] * buf[i]; rms = Math.sqrt(rms / n);
  if (rms < 0.012) return { f: 0, c: 0, rms };
  const W = n >> 1, df = new Float32Array(W);
  for (let t = 1; t < W; t++) { let s = 0; for (let i = 0; i < W; i++) { const x = buf[i] - buf[i + t]; s += x * x; } df[t] = s; }
  let run = 0; df[0] = 1; for (let t = 1; t < W; t++) { run += df[t]; df[t] = run ? df[t] * t / run : 1; }
  const lo = Math.floor(sr / 1100), hi = Math.min(W - 1, Math.floor(sr / 70)); let tau = -1;
  for (let t = lo; t < hi; t++) if (df[t] < 0.15) { while (t + 1 < hi && df[t + 1] < df[t]) t++; tau = t; break; }
  if (tau < 0) return { f: 0, c: 0, rms };
  const a = df[tau - 1], b = df[tau], c = df[tau + 1] ?? b, den = a + c - 2 * b, bt = den ? tau + (a - c) / (2 * den) : tau;
  return { f: sr / bt, c: 1 - b, rms };
}
export function segment(frames, hop) {
  const mid = frames.map(fr => fr.f > 0 && fr.c > 0.8 ? 69 + 12 * Math.log2(fr.f / 440) : null);
  const sm = mid.map((v, i) => { if (v == null) return null; const w = mid.slice(Math.max(0, i - 2), i + 3).filter(x => x != null).sort((x, y) => x - y); return w[w.length >> 1]; });
  const notes = []; let cur = null;
  sm.forEach((v, i) => {
    const t = i * hop, m = v == null ? null : Math.round(v);
    if (cur && (m == null || Math.abs(m - cur.m) >= 1)) { cur.dur = t - cur.t; if (cur.dur >= 0.09) notes.push(cur); cur = null; }
    if (m != null && !cur) cur = { m, t };
  });
  if (cur) { cur.dur = sm.length * hop - cur.t; if (cur.dur >= 0.09) notes.push(cur); }
  // merge tiny gaps between identical notes
  return notes.reduce((o, x) => { const p = o[o.length - 1]; if (p && p.m === x.m && x.t - (p.t + p.dur) < 0.06) p.dur = x.t + x.dur - p.t; else o.push({ ...x }); return o; }, []);
}
const MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88], MIN = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
export function key(notes) {
  const h = new Array(12).fill(0); notes.forEach(n => h[((n.m % 12) + 12) % 12] += n.dur); if (!notes.length) return '—';
  let best = [-9, '']; const corr = (p, r) => { const x = h.map((_, i) => h[(i + r) % 12]), mx = x.reduce((a, b) => a + b) / 12, mp = p.reduce((a, b) => a + b) / 12; let s = 0, sx = 0, sp = 0; for (let i = 0; i < 12; i++) { s += (x[i] - mx) * (p[i] - mp); sx += (x[i] - mx) ** 2; sp += (p[i] - mp) ** 2; } return s / Math.sqrt(sx * sp || 1); };
  for (let r = 0; r < 12; r++) { const a = corr(MAJ, r), b = corr(MIN, r); if (a > best[0]) best = [a, NOTE[r] + ' major']; if (b > best[0]) best = [b, NOTE[r] + ' minor']; }
  return best[1];
}
function sampleHum() {
  const sr = 44100, seq = [60, 64, 67, 64, 62, 65, 69, 67], dur = 0.42, gap = 0.06, len = seq.length * (dur + gap) + 0.3, out = new Float32Array(Math.ceil(len * sr));
  let ph = 0; seq.forEach((m, k) => { const f = 440 * 2 ** ((m - 69) / 12), s0 = Math.floor((0.15 + k * (dur + gap)) * sr), n = Math.floor(dur * sr);
    for (let i = 0; i < n; i++) { const env = Math.min(1, i / 600, (n - i) / 900), vib = 1 + 0.004 * Math.sin(2 * Math.PI * 5.5 * i / sr); ph += 2 * Math.PI * f * vib / sr; out[s0 + i] = 0.45 * env * (Math.sin(ph) + 0.25 * Math.sin(2 * ph) + 0.1 * Math.sin(3 * ph)); } });
  return { data: out, sr };
}
export function analyseBuffer(data, sr) {
  const N = 2048, H = 512, frames = []; for (let i = 0; i + N < data.length; i += H) frames.push(yin(data.subarray(i, i + N), sr));
  return segment(frames, H / sr);
}
function drum(type, t, out) {
  const c = ac(), g = c.createGain(); g.connect(out);
  if (type === 'k') { const o = c.createOscillator(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.32); o.connect(g); o.start(t); o.stop(t + 0.35); return; }
  const len = type === 's' ? 0.18 : 0.05, b = c.createBuffer(1, Math.ceil(c.sampleRate * len), c.sampleRate), x = b.getChannelData(0); for (let i = 0; i < x.length; i++) x[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(); s.buffer = b; const f = c.createBiquadFilter(); f.type = type === 's' ? 'bandpass' : 'highpass'; f.frequency.value = type === 's' ? 1800 : 7000;
  g.gain.setValueAtTime(type === 's' ? 0.5 : 0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + len); s.connect(f); f.connect(g); s.start(t);
}
function tone(m, t, dur, out) {
  const c = ac(), o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
  o.type = 'triangle'; o2.type = 'sawtooth'; o.frequency.value = o2.frequency.value = 440 * 2 ** ((m - 69) / 12); o2.detune.value = 7; f.type = 'lowpass'; f.frequency.setValueAtTime(2400, t); f.frequency.exponentialRampToValueAtTime(700, t + dur);
  const g2 = c.createGain(); g2.gain.value = 0.18; o2.connect(g2); g2.connect(f); o.connect(f); f.connect(g); g.connect(out);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.28, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.12, dur));
  o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
}
function hum(host) {
  host.innerHTML = `<div class="mm-pg two"><div><p class="mm-kick">Hum or tap</p><h3 style="font:600 20px/1.25 var(--mm-disp);margin:.4rem 0">Melody and beat sketch</h3>
    <p class="mm-note">Hum for up to 6 seconds (the microphone is requested only when you press the button), or try the sample hum. Pitch is detected with YIN, notes are segmented, the key is estimated, and a one-bar beat is built at your tapped tempo.</p>
    <div class="mm-row" style="margin-top:12px"><button type="button" class="mm-btn pri" data-mic>🎙 Hum (mic)</button><button type="button" class="mm-btn" data-sample>Use a sample hum</button><button type="button" class="mm-btn" data-tap aria-describedby="mm-tap-h">Tap tempo</button></div>
    <p id="mm-tap-h" class="mm-stat" style="margin-top:8px">Tap 4+ times (or press T) to set the tempo.</p>
    <div class="mm-meter" aria-hidden="true"><i></i></div><p class="mm-status" data-st aria-live="polite">Ready.</p>
    <div class="mm-row" style="margin-top:6px"><button type="button" class="mm-btn" data-play disabled>▶ Play sketch</button><button type="button" class="mm-btn" data-stop>■ Stop</button><a class="mm-btn" href="${B}apps/soundx-ai/">Open SoundX AI →</a></div></div>
    <div><canvas class="mm-roll" width="640" height="180" aria-label="Detected notes (piano roll)" role="img"></canvas>
    <div class="mm-steps" aria-label="Beat pattern, 16 steps">${'<i></i>'.repeat(16)}</div>
    <p class="mm-stat" style="margin-top:10px" data-sum>Notes: <b>—</b> · Key: <b>—</b> · Tempo: <b>100 BPM</b></p>
    <p class="mm-note" style="margin-top:6px"><span class="mm-badge">Runs on your device · private</span> Audio is analysed in this tab and never uploaded.</p></div></div>`;
  const st = host.querySelector('[data-st]'), meter = host.querySelector('.mm-meter i'), cv = host.querySelector('canvas'), steps = [...host.querySelectorAll('.mm-steps i')], sum = host.querySelector('[data-sum]');
  const S = host.__state = { notes: [], bpm: 100, taps: [], pat: { k: [0, 6, 8], s: [4, 12], h: [0, 2, 4, 6, 8, 10, 12, 14] }, playing: [] };
  const draw = () => {
    const g = cv.getContext('2d'), W = cv.width, H = cv.height; g.clearRect(0, 0, W, H); if (!S.notes.length) return;
    const lo = Math.min(...S.notes.map(n => n.m)) - 2, hi = Math.max(...S.notes.map(n => n.m)) + 2, T = Math.max(...S.notes.map(n => n.t + n.dur)) + 0.1;
    S.notes.forEach(n => { const x = n.t / T * W, w = Math.max(4, n.dur / T * W - 2), y = H - (n.m - lo + 1) / (hi - lo + 1) * H; const gr = g.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, '#e2475a'); gr.addColorStop(1, '#a78bfa'); g.fillStyle = gr; g.beginPath(); g.roundRect ? g.roundRect(x, y - 6, w, 10, 4) : g.rect(x, y - 6, w, 10); g.fill(); g.fillStyle = 'rgba(255,255,255,.75)'; g.font = '10px ui-monospace,monospace'; if (w > 22) g.fillText(nm(n.m), x + 4, y + 2); });
  };
  const paint = () => { steps.forEach((s, i) => { s.className = S.pat.k.includes(i) ? 'k' : S.pat.s.includes(i) ? 's' : S.pat.h.includes(i) ? 'h' : ''; }); sum.innerHTML = `Notes: <b>${S.notes.length ? S.notes.map(n => nm(n.m)).join(' ') : '—'}</b> · Key: <b>${esc(key(S.notes))}</b> · Tempo: <b>${Math.round(S.bpm)} BPM</b>`; host.querySelector('[data-play]').disabled = !S.notes.length; draw(); host.dataset.notes = S.notes.length; };
  const done = (notes, how) => { S.notes = notes; paint(); st.textContent = notes.length ? `${how}: ${notes.length} notes detected.` : 'No clear pitch found — try humming a little louder, closer to the mic.'; st.className = 'mm-status' + (notes.length ? ' ok' : ''); };
  host.querySelector('[data-sample]').addEventListener('click', () => { const { data, sr } = sampleHum(); st.textContent = 'Analysing the sample hum…'; setTimeout(() => done(analyseBuffer(data, sr), 'Sample hum'), 10); });
  host.querySelector('[data-mic]').addEventListener('click', async e => {
    const btn = e.currentTarget; if (S.rec) { S.rec.stop(); return; }
    let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); }
    catch (err) { st.textContent = 'Microphone not available (' + (err.name || 'blocked') + ') — try the sample hum instead.'; return; }
    const c = ac(); await c.resume(); const src = c.createMediaStreamSource(stream), an = c.createAnalyser(); an.fftSize = 2048; src.connect(an);
    const buf = new Float32Array(2048), frames = [], t0 = performance.now(), hop = 0.02; btn.textContent = '■ Stop listening'; st.textContent = 'Listening… hum a short tune.';
    const iv = setInterval(() => { an.getFloatTimeDomainData(buf); const r = yin(buf, c.sampleRate); frames.push(r); meter.style.width = Math.min(100, r.rms * 400) + '%'; if (performance.now() - t0 > 6000) S.rec.stop(); }, hop * 1000);
    S.rec = { stop: () => { clearInterval(iv); stream.getTracks().forEach(t => t.stop()); S.rec = null; btn.textContent = '🎙 Hum (mic)'; meter.style.width = '0'; done(segment(frames, hop), 'Microphone'); host.dataset.micFrames = frames.length; } };
  });
  const tap = () => { const t = performance.now(); S.taps = S.taps.filter(x => t - x < 3000).concat(t); if (S.taps.length >= 2) { const iv = []; for (let i = 1; i < S.taps.length; i++) iv.push(S.taps[i] - S.taps[i - 1]); iv.sort((a, b) => a - b); S.bpm = Math.max(60, Math.min(180, 60000 / iv[iv.length >> 1])); }
    if (S.taps.length >= 4) { const T0 = S.taps[S.taps.length - 4], sp = 60000 / S.bpm / 4; S.pat.k = [...new Set(S.taps.slice(-4).map(x => Math.round((x - T0) / sp) % 16))].filter(x => x >= 0); if (!S.pat.k.includes(0)) S.pat.k.unshift(0); }
    paint(); st.textContent = `Tap ${S.taps.length} · ${Math.round(S.bpm)} BPM`; };
  host.querySelector('[data-tap]').addEventListener('click', tap);
  host.addEventListener('keydown', e => { if ((e.key === 't' || e.key === 'T') && !/INPUT|TEXTAREA/.test(e.target.tagName)) tap(); });
  const stop = () => { S.playing.forEach(clearTimeout); S.playing = []; if (S.bus) { S.bus.disconnect(); S.bus = null; } steps.forEach(s => s.classList.remove('now')); };
  host.querySelector('[data-stop]').addEventListener('click', stop);
  host.querySelector('[data-play]').addEventListener('click', async () => {
    stop(); const c = ac(); await c.resume(); const out = c.createGain(); out.gain.value = 0.8; out.connect(c.destination); S.bus = out;
    const sp = 60 / S.bpm / 4, t0 = c.currentTime + 0.08, bars = 2, n0 = S.notes[0] ? S.notes[0].t : 0;
    for (let b = 0; b < bars; b++) for (let i = 0; i < 16; i++) { const t = t0 + (b * 16 + i) * sp; if (S.pat.k.includes(i)) drum('k', t, out); if (S.pat.s.includes(i)) drum('s', t, out); if (S.pat.h.includes(i)) drum('h', t, out);
      if (!reduce()) S.playing.push(setTimeout(() => { steps.forEach((s, j) => s.classList.toggle('now', j === i)); }, (t - c.currentTime) * 1000)); }
    S.notes.forEach(n => { const q = Math.round((n.t - n0) / sp), len = Math.max(1, Math.round(n.dur / sp)); if (q < bars * 16) tone(n.m, t0 + q * sp, len * sp * 0.95, out); });
    S.playing.push(setTimeout(stop, (bars * 16 * sp + 0.6) * 1000)); host.dataset.played = '1'; st.textContent = `Playing ${bars} bars at ${Math.round(S.bpm)} BPM.`;
  });
  paint();
}

/* ================= (b) till slip ================= */
const CATS = [['Fresh produce', /apple|banana|tomato|onion|potato|carrot|spinach|orange|lettuce|veg|fruit/], ['Dairy & bakery', /milk|bread|egg|cheese|butter|yog|amasi|loaf|rolls/],
  ['Pantry staples', /maize|mealie|rice|pasta|flour|sugar|oil|beans|samp|salt|tea\b|coffee|cereal|oats/], ['Meat & fish', /chicken|beef|mince|wors|fish|pork|polony|sausage/],
  ['Household', /soap|wash|toilet|tissue|bleach|detergent|dish|sponge|candle/], ['Drinks', /juice|cooldrink|cola|water|soda|drink/]];
export function parseSlip(text) {
  const clean = String(text).replace(/\b(?:\d[ -]?){13,19}\b/g, '[card removed]').replace(/\b0\d{2}[ -]?\d{3}[ -]?\d{4}\b/g, '[phone removed]');
  const lines = clean.split(/\n+/).map(l => l.replace(/[|]/g, ' ').trim()).filter(Boolean), items = []; let total = null;
  lines.forEach(l => {
    const m = l.match(/^(.*?[A-Za-z].*?)\s+(?:(\d+)\s*[x@]\s*(?:R\s?)?\d+[.,]\d{2}\s+)?R?\s?(-?\d{1,5}[.,]\d{2})\s*[A-Z*]?$/i);
    if (!m) return; const name = m[1].replace(/\s{2,}/g, ' ').replace(/[^\w\s&%.\/-]/g, '').trim(), price = parseFloat(m[3].replace(',', '.'));
    if (/^(sub ?total|total|amount due|balance|tender|cash|card|change|vat|tax|rounding|you saved|savings)/i.test(name)) { if (/^total|amount due/i.test(name)) total = price; return; }
    if (name.length < 2 || price <= 0) return;
    const cat = (CATS.find(c => c[1].test(name.toLowerCase())) || ['Other'])[0];
    const pack = name.match(/(\d+(?:[.,]\d+)?)\s?(kg|g|l|ml)\b/i); let unit = null;
    if (pack) { let q = parseFloat(pack[1].replace(',', '.')); const u = pack[2].toLowerCase(); if (u === 'g' || u === 'ml') q /= 1000; unit = { v: price / q, u: u === 'g' || u === 'kg' ? 'kg' : 'L' }; }
    items.push({ name, qty: m[2] ? +m[2] : 1, price, cat, unit });
  });
  const sum = Math.round(items.reduce((a, b) => a + b.price, 0) * 100) / 100;
  const byCat = {}; items.forEach(i => { byCat[i.cat] = (byCat[i.cat] || 0) + i.price; });
  return { items, sum, total, byCat, sanitised: clean !== String(text) };
}
const R = v => 'R' + v.toFixed(2);
// WebAssembly SIMD feature test (same bytes as wasm-feature-detect); picks one self-hosted OCR core instead of shipping three
const simd = () => { try { return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])); } catch (e) { return false; } };
function slip(host) {
  host.innerHTML = `<div class="mm-slip"><div><span class="mm-ex">EXAMPLE DATA</span><img src="${B}media/ai/sample-slip.png" alt="A sample till slip from a made-up shop called Sample Mart. All items and prices are invented." width="560" height="758" loading="lazy" data-slip-img>
    <div class="mm-row" style="margin-top:10px"><button type="button" class="mm-btn pri sm" data-ocr>Read the sample (OCR)</button><label class="mm-btn sm" style="cursor:pointer">Upload a photo<input type="file" accept="image/*" hidden data-file></label></div>
    <details style="margin-top:10px"><summary class="mm-stat" style="cursor:pointer">…or paste slip text</summary><textarea class="mm-ta" data-paste style="min-height:120px;margin-top:8px" placeholder="BREAD WHITE 700G   17.99&#10;MILK 2L   32.49&#10;TOTAL   50.48"></textarea><button type="button" class="mm-btn sm" style="margin-top:6px" data-parse>Parse text</button></details></div>
    <div><p class="mm-kick">Till slip → breakdown</p><h3 style="font:600 20px/1.25 var(--mm-disp);margin:.4rem 0">An item and price breakdown</h3>
    <p class="mm-note">A demo on a made-up slip: OCR on your device, card and phone numbers stripped before display, then items, categories and unit prices. <strong>Prices here are invented example data</strong>, not real retailer prices.</p>
    <div class="mm-meter" aria-hidden="true"><i></i></div><p class="mm-status" data-st aria-live="polite">Pick the sample slip, upload a photo, or paste text.</p><div data-out></div></div></div>`;
  const st = host.querySelector('[data-st]'), out = host.querySelector('[data-out]'), meter = host.querySelector('.mm-meter i');
  const show = (text, src) => {
    const r = parseSlip(text); host.__slip = r; host.dataset.items = r.items.length;
    if (!r.items.length) { out.innerHTML = '<p class="mm-note">No priced lines found. OCR works best on a flat, well-lit slip.</p>'; return; }
    const cats = Object.entries(r.byCat).sort((a, b) => b[1] - a[1]), mx = cats[0][1];
    out.innerHTML = `<span class="mm-ex">EXAMPLE DATA · NOT REAL PRICES</span><table class="mm-table"><thead><tr><th>Item</th><th>Category</th><th class="r">Unit price</th><th class="r">Price</th></tr></thead><tbody>
      ${r.items.map(i => `<tr><td>${esc(i.name)}${i.qty > 1 ? ' ×' + i.qty : ''}</td><td>${esc(i.cat)}</td><td class="r">${i.unit ? R(i.unit.v) + '/' + i.unit.u : '—'}</td><td class="r">${R(i.price)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="3"><b>Lines add up to</b></td><td class="r"><b>${R(r.sum)}</b></td></tr>${r.total != null ? `<tr><td colspan="3">Slip total ${Math.abs(r.total - r.sum) < 0.02 ? '✓ matches' : '— differs (check OCR)'}</td><td class="r">${R(r.total)}</td></tr>` : ''}</tfoot></table>
      <div class="mm-cats" aria-label="Spend by category">${cats.map(([c, v]) => `<div class="mm-cat"><span>${esc(c)}</span><span class="b"><i style="width:${(v / mx * 100).toFixed(0)}%"></i></span><span class="r">${R(v)}</span></div>`).join('')}</div>
      <p class="mm-note" style="margin-top:10px">${esc(cats[0][0])} is ${Math.round(cats[0][1] / r.sum * 100)}% of this basket.${r.sanitised ? ' Card/phone numbers were removed before display.' : ''} Source: ${esc(src)} · processed on your device.</p>`;
  };
  host.querySelector('[data-parse]').addEventListener('click', () => show(host.querySelector('[data-paste]').value, 'pasted text'));
  const ocr = async (img, src) => {
    st.textContent = 'Loading OCR (tesseract.js, ≈7 MB once, self-hosted)…';
    try {
      if (!window.Tesseract) await new Promise((ok, no) => { const s = d.createElement('script'); s.src = B + 'js/ai/vendor/tesseract/tesseract.min.js'; s.onload = ok; s.onerror = no; d.head.appendChild(s); });
      const V = B + 'js/ai/vendor/tesseract/';
      const worker = host.__w || (host.__w = await window.Tesseract.createWorker('eng', 1, { workerPath: V + 'worker.min.js', corePath: V + (simd() ? 'tesseract-core-simd-lstm.wasm.js' : 'tesseract-core-lstm.wasm.js'), langPath: V + 'lang', gzip: true, workerBlobURL: false,
        logger: m => { if (m.progress != null) meter.style.width = Math.round(m.progress * 100) + '%'; st.textContent = (m.status || '') + (m.progress != null ? ' ' + Math.round(m.progress * 100) + '%' : ''); } }));
      const t0 = performance.now(); const { data } = await worker.recognize(img);
      st.textContent = `OCR done in ${((performance.now() - t0) / 1000).toFixed(1)} s (confidence ${Math.round(data.confidence)}%).`; st.className = 'mm-status ok'; host.dataset.ocr = data.text.length;
      host.__ocrText = data.text; show(data.text, src);
    } catch (e) { st.textContent = 'OCR could not load (' + (e && e.message || e) + '). You can paste the text instead.'; }
  };
  host.querySelector('[data-ocr]').addEventListener('click', () => ocr(B + 'media/ai/sample-slip.png', 'sample slip (OCR)'));
  host.querySelector('[data-file]').addEventListener('change', e => { const f = e.target.files[0]; if (f) ocr(f, 'your photo (OCR, not uploaded)'); });
}

/* ================= (c) agent pipeline visualiser ================= */
const STEPS = [['01', 'Intent', 'What the person asked for'], ['02', 'Context', 'Only the data that task needs'], ['03', 'Router', 'Model, tool, or fallback'], ['04', 'Tools', 'Approved APIs and files'], ['05', 'Human gate', 'Stop before irreversible acts'], ['06', 'Record', 'Status, latency, source']];
const ROUTES = [
  { re: /job|role|vacanc|recruit|cv|résumé|resume|cover letter|apply|hiring/i, agent: 'JobNet pipeline', ctx: 'Posting text + the closest case study', tools: ['ranker (sentence embedding)', 'CV context', 'letter draft'], gate: 'Letters are drafted, never sent: mail leaves only if the posting prints an employer address — and a person presses send.', link: '/case-studies/jobnet/' },
  { re: /beat|music|bpm|song|amapiano|gqom|drum|melody|track|808/i, agent: 'SoundX AI · Producer Agent', ctx: 'Your brief + the current session', tools: ['beat plan', 'tempo & key', 'sample packs', 'plugin chain'], gate: 'The producer proposes; your session changes only when you press Apply.', link: '/apps/soundx-ai/' },
  { re: /market|forex|gold|xau|btc|bitcoin|eurusd|nasdaq|spx|chart|trade|stock/i, agent: 'Forex desk · paper bot', ctx: 'Delayed public quotes for one session', tools: ['chart & multi view', 'paper action'], gate: 'paper_only is true — live orders are blocked by policy.', link: '/case-studies/forex/' },
  { re: /slip|receipt|grocer|basket|price|shopping/i, agent: 'Slip parser (demo)', ctx: 'Your slip, sanitised on device (POPIA)', tools: ['OCR', 'line parser', 'unit prices'], gate: 'Nothing is shared or sent; prices are labelled Illustrative unless verified.', link: null },
  { re: /katlego|portfolio|availab|experience|stack|who is|about him|search|find/i, agent: 'Site search (retrieval)', ctx: 'This site’s pages, chunked with sources', tools: ['on-device embeddings', 'BM25 keywords', 'result links'], gate: 'Read-only: it returns links to pages, not written answers.', link: null },
  { re: /.*/, agent: 'Mercatus Assist (server-side model)', ctx: 'Your message + session context', tools: ['Gemini via OpenAI-compatible client', 'retry on 429/5xx'], gate: 'If the robot is unhealthy, the UI switches to a labelled demo — live and demo are different states.', link: '/case-studies/assist/' }
];
const IRREV = /\b(send|e-?mail|apply|submit|pay|buy|order|purchase|post|publish|delete|transfer|book|sign)\b/i;
export function route(task) { const r = ROUTES.find(x => x.re.test(task)); return { ...r, irreversible: IRREV.test(task) }; }
function pipe(host) {
  const EX = ['Find .NET roles in Cape Town and email the letters', 'Make an amapiano beat at 112 BPM', 'Summarise today’s gold market', 'Read my till slip and compare prices', 'Search the site for how the API key is protected'];
  host.innerHTML = `<p class="mm-kick">Agent pipeline visualiser</p><h3 style="font:600 20px/1.25 var(--mm-disp);margin:.4rem 0">How a task is routed — and where it stops</h3>
    <p class="mm-note">Type a task. The router picks one of Katlego’s systems, shows the context it may use and the tools it may call, and stops at the human gate before anything irreversible. <strong>Simulation</strong> — no real agents are called.</p>
    <form class="mm-row" style="margin-top:12px" data-f><label class="mm-sr" for="mm-task">Task</label><input id="mm-task" class="mm-input" style="flex:1;min-width:220px" placeholder="e.g. ${esc(EX[0])}"><button class="mm-btn pri">Route it</button></form>
    <div class="mm-sugg" style="padding:10px 0 0">${EX.map(e => `<button type="button" data-ex>${esc(e)}</button>`).join('')}</div>
    <div class="mm-pipe" aria-live="polite">${STEPS.map(s => `<div class="mm-node" data-step="${s[1]}"><span class="n">${s[0]}</span><span class="lat"></span><strong>${s[1]}</strong><p>${s[2]}</p></div>`).join('')}</div>
    <div class="mm-gate" role="alert"><strong>Human gate.</strong> <span data-gt></span><button type="button" class="mm-btn sm pri" data-ok>Approve (simulated)</button><button type="button" class="mm-btn sm" data-hold>Hold</button></div>
    <pre class="mm-stat" data-log style="white-space:pre-wrap;margin-top:12px;max-height:180px;overflow:auto"></pre>`;
  const nodes = [...host.querySelectorAll('.mm-node')], gate = host.querySelector('.mm-gate'), log = host.querySelector('[data-log]'); let run = 0;
  const go = async task => {
    const my = ++run, r = route(task), t0 = performance.now(), wait = ms => new Promise(ok => setTimeout(ok, reduce() ? 0 : ms));
    nodes.forEach(n => { n.className = 'mm-node'; n.querySelector('.lat').textContent = ''; }); gate.classList.remove('on'); log.textContent = '';
    const P = [`“${task}”`, r.ctx, '→ ' + r.agent + (r.link ? ' (' + r.link + ')' : ''), r.tools.join(' · '), r.irreversible ? 'STOP — irreversible step detected' : 'Not needed (nothing irreversible)', 'logged locally'];
    const L = [];
    for (let i = 0; i < 6; i++) {
      if (my !== run) return; const n = nodes[i]; n.classList.add('on'); n.querySelector('p').textContent = P[i]; await wait(380);
      const ms = Math.round(performance.now() - t0); n.querySelector('.lat').textContent = ms + ' ms'; L.push(`${String(ms).padStart(5)} ms  ${STEPS[i][1].padEnd(10)} ${P[i]}`); log.textContent = L.join('\n');
      if (i === 4 && r.irreversible) { n.classList.add('stop'); gate.querySelector('[data-gt]').textContent = r.gate; gate.classList.add('on'); host.dataset.gate = 'stopped';
        const ok = await new Promise(res => { gate.querySelector('[data-ok]').onclick = () => res(true); gate.querySelector('[data-hold]').onclick = () => res(false); });
        gate.classList.remove('on'); L.push(`        ${ok ? 'approved by you (simulated) — in the real system a person presses send' : 'held — nothing happens'}`); n.querySelector('p').textContent = ok ? 'Approved by you (simulated)' : 'Held by you'; }
      else if (i === 4) n.querySelector('p').textContent = r.gate;
      n.classList.remove('on'); n.classList.add('done');
    }
    host.dataset.routed = r.agent; host.dataset.done = '1';
  };
  host.querySelector('[data-f]').addEventListener('submit', e => { e.preventDefault(); const v = host.querySelector('#mm-task').value.trim() || EX[0]; go(v); });
  host.querySelectorAll('[data-ex]').forEach(b => b.addEventListener('click', () => { host.querySelector('#mm-task').value = b.textContent; go(b.textContent); }));
}

export function mount(host) {
  host.innerHTML = `<div class="mm-tabs" role="tablist" aria-label="Playground demos">
    <button role="tab" id="mm-t1" aria-controls="mm-p1" aria-selected="true">Hum → beat</button><button role="tab" id="mm-t2" aria-controls="mm-p2" aria-selected="false" tabindex="-1">Till slip → breakdown</button><button role="tab" id="mm-t3" aria-controls="mm-p3" aria-selected="false" tabindex="-1">Agent pipeline</button></div>
    <div class="mm-card glow" role="tabpanel" id="mm-p1" aria-labelledby="mm-t1" data-pg="hum"></div><div class="mm-card glow" role="tabpanel" id="mm-p2" aria-labelledby="mm-t2" data-pg="slip" hidden></div><div class="mm-card glow" role="tabpanel" id="mm-p3" aria-labelledby="mm-t3" data-pg="pipe" hidden></div>`;
  const tabs = [...host.querySelectorAll('[role=tab]')], panels = [...host.querySelectorAll('[role=tabpanel]')], made = {};
  const sel = i => { tabs.forEach((t, j) => { t.setAttribute('aria-selected', String(i === j)); t.tabIndex = i === j ? 0 : -1; panels[j].hidden = i !== j; });
    const p = panels[i]; if (!made[i]) { made[i] = 1; ({ hum, slip, pipe })[p.dataset.pg](p); } };
  tabs.forEach((t, i) => { t.addEventListener('click', () => sel(i)); t.addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const k = (i + (e.key === 'ArrowRight' ? 1 : -1) + 3) % 3; sel(k); tabs[k].focus(); } }); });
  sel(0); host.__sel = sel;
}
