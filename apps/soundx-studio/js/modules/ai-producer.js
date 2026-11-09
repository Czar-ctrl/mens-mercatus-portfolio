/**
 * AI Producer — polished local rule-based studio assistant (Mens Mercatus original).
 * Not affiliated with Greysound or any third-party AI DAW.
 */
import { detectSessionBeat } from '../audio/beat-detect.js?v=20261009ml-sxs20261020b';

const NOTE_HZ = {
  C: 261.63, 'C#': 277.18, Db: 277.18, D: 293.66, 'D#': 311.13, Eb: 311.13,
  E: 329.63, F: 349.23, 'F#': 369.99, Gb: 369.99, G: 392.0, 'G#': 415.3,
  Ab: 415.3, A: 440.0, 'A#': 466.16, Bb: 466.16, B: 493.88,
};

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11, 12],
  minor: [0, 2, 3, 5, 7, 8, 10, 12],
  pentatonic: [0, 2, 4, 7, 9, 12, 14, 16],
  dorian: [0, 2, 3, 5, 7, 9, 10, 12],
};

function matchScale(text) {
  if (/\bminor\b|\baeolian\b/i.test(text)) return 'minor';
  if (/\bpenta/i.test(text)) return 'pentatonic';
  if (/\bdorian\b/i.test(text)) return 'dorian';
  return 'major';
}

function parseRoot(text) {
  const m = text.match(/\b([A-G](?:#|b)?)\b/i);
  if (!m) return { name: 'C', hz: 261.63 };
  const raw = m[1];
  const key = raw.length > 1 ? raw[0].toUpperCase() + raw.slice(1) : raw.toUpperCase();
  return { name: key, hz: NOTE_HZ[key] || NOTE_HZ[key[0]] || 261.63 };
}

export function mountAiProducer(root, engine, timelineApi, toast) {
  root.innerHTML = `
    <div class="panel-head">
      <h2>AI Producer</h2>
      <span class="badge">AI Producer</span>
    </div>
    <p class="panel-desc">AI Producer — takes orders and builds alongside you in real time (local rules). Ask for tempo, grooves, melodies, or arrangement tips — original Mens Mercatus logic, no cloud model.</p>
    <div class="chat-log" data-log aria-live="polite"></div>
    <form class="chat-form" data-form>
      <input type="text" placeholder="e.g. add drums, melody in A minor, bpm 128…" data-input autocomplete="off" aria-label="AI Producer message" />
      <button type="submit" class="btn primary" title="Send">Send</button>
    </form>
    <div class="quick-row" data-quick>
      <button type="button" class="btn sm ghost" data-q="help">Help</button>
      <button type="button" class="btn sm ghost" data-q="demo">Demo</button>
      <button type="button" class="btn sm ghost" data-q="listen">Listen</button>
      <button type="button" class="btn sm ghost" data-q="make beat">Make beat</button>
      <button type="button" class="btn sm ghost" data-q="add drums">Drums</button>
      <button type="button" class="btn sm ghost" data-q="melody in A minor">Melody Am</button>
      <button type="button" class="btn sm ghost" data-q="arm record">Arm record</button>
      <button type="button" class="btn sm ghost" data-q="add vocal chain">Vocal chain</button>
      <button type="button" class="btn sm ghost" data-q="suggest vst">VST hint</button>
      <button type="button" class="btn sm ghost" data-q="load pack hint">Pack hint</button>
      <button type="button" class="btn sm ghost" data-q="suggest arrangement">Arrange</button>
    </div>
    <div class="aipro-status" data-aipro-status>Idle · local rules</div>
  `;

  const log = root.querySelector('[data-log]');
  const form = root.querySelector('[data-form]');
  const input = root.querySelector('[data-input]');
  const status = root.querySelector('[data-aipro-status]');

  function append(role, text) {
    const msg = String(text == null ? '' : text).trim();
    if (!msg) return; // never render empty bubbles
    const el = document.createElement('div');
    el.className = `chat-bubble ${role}`;
    el.textContent = msg;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }

  function setBusy(msg) {
    status.textContent = msg;
  }

  log.replaceChildren();
  append('bot', 'Welcome — AI Producer is ready. Try “add drums”, “melody in G minor”, “bass in C”, “bpm 140”, or tap a quick chip below.');

  const helpers = {
    ensureTracks() {
      while (engine.tracks.length < 4) engine.addTrack(engine.tracks.length >= 2 ? 'midi' : 'audio');
    },
    findOrName(pred, fallbackName, type = 'audio') {
      this.ensureTracks();
      let t = engine.tracks.find(pred);
      if (!t) {
        t = engine.addTrack(type, fallbackName);
      } else if (fallbackName && t.name.startsWith('Track')) {
        t.name = fallbackName;
      }
      return t;
    },
    drums() {
      return this.findOrName((t) => /drum|perc|beat/i.test(t.name), 'Drums', 'audio');
    },
    bass() {
      return this.findOrName((t) => /bass/i.test(t.name), 'Bass', 'audio');
    },
    keys() {
      return this.findOrName(
        (t) => /key|melod|lead|synth/i.test(t.name) || t.type === 'midi',
        'Keys',
        'midi'
      );
    },
    pad() {
      return this.findOrName((t) => /pad|atmos|fx/i.test(t.name), 'Pad', 'audio');
    },
    clearClips(track) {
      if (track) track.clips = [];
    },
    selected() {
      return engine.tracks.find((t) => t.id === timelineApi?.getSelectedTrackId?.()) || engine.tracks[0];
    },
  };

  async function addRichDrums(bars = 2, style = 'straight') {
    await engine.init();
    const track = helpers.drums();
    helpers.clearClips(track);
    const kick = engine.createBufferFromRecipe({ type: 'kick', duration: 0.42 });
    const snare = engine.createBufferFromRecipe({ type: 'snare', duration: 0.28 });
    const hat = engine.createBufferFromRecipe({ type: 'hat', duration: 0.1 });
    const openHat = engine.createBufferFromRecipe({ type: 'hat', duration: 0.22 });
    const beats = bars * 4;

    for (let b = 0; b < beats; b++) {
      const kickOn = style === 'four' ? true : b % 4 === 0 || b % 4 === 2;
      if (kickOn) {
        engine.addClip(track.id, {
          name: 'Kick', startBeat: b, durationBeats: 0.45, color: '#F5C518', buffer: kick,
        });
      }
      if (b % 4 === 1 || b % 4 === 3) {
        engine.addClip(track.id, {
          name: 'Snare', startBeat: b, durationBeats: 0.35, color: '#E8A838', buffer: snare,
        });
      }
      // closed hats
      const hatStep = style === 'shuffle' ? [0, 0.66] : [0, 0.5];
      hatStep.forEach((off, i) => {
        engine.addClip(track.id, {
          name: 'Hat',
          startBeat: b + off,
          durationBeats: 0.2,
          color: '#C9A227',
          buffer: i === 1 && b % 4 === 3 ? openHat : hat,
        });
      });
    }
    engine._emit('tracks', engine.tracks);
    return track;
  }

  async function addHatGroove(bars = 2) {
    await engine.init();
    const track = helpers.drums();
    const hat = engine.createBufferFromRecipe({ type: 'hat', duration: 0.08 });
    for (let b = 0; b < bars * 4; b += 0.25) {
      engine.addClip(track.id, {
        name: 'Hat16', startBeat: b, durationBeats: 0.2, color: '#DAA520', buffer: hat,
      });
    }
    engine._emit('tracks', engine.tracks);
    return track;
  }

  async function addBassLine(rootHz, bars = 2, pattern = 'root-fifth') {
    await engine.init();
    const track = helpers.bass();
    helpers.clearClips(track);
    const notes = [];
    const steps = bars * 4;
    for (let i = 0; i < steps; i++) {
      let freq = rootHz / 2;
      if (pattern === 'root-fifth') {
        freq = i % 4 === 2 ? (rootHz / 2) * 1.5 : rootHz / 2;
      } else if (pattern === 'walking') {
        const deg = SCALES.major[i % 5];
        freq = (rootHz / 2) * Math.pow(2, deg / 12);
      }
      notes.push({ beat: i, dur: 0.88, freq, wave: 'sawtooth' });
    }
    engine.addClip(track.id, {
      name: 'Bass Line', startBeat: 0, durationBeats: steps, color: '#D4A017', notes,
    });
    return track;
  }

  async function addMelody(text, bars = 2) {
    await engine.init();
    const track = helpers.keys();
    helpers.clearClips(track);
    const { name, hz } = parseRoot(text);
    const scaleName = matchScale(text);
    const scale = SCALES[scaleName];
    const notes = [];
    const steps = bars * 4;
    // simple motivic contour
    const contour = [0, 2, 4, 5, 4, 2, 0, 7, 5, 4, 2, 0, 4, 5, 7, 4];
    for (let i = 0; i < steps; i++) {
      const deg = scale[contour[i % contour.length] % scale.length];
      notes.push({
        beat: i,
        dur: i % 4 === 3 ? 1.2 : 0.75,
        freq: hz * Math.pow(2, deg / 12),
        wave: 'sine',
      });
    }
    engine.addClip(track.id, {
      name: `Melody ${name} ${scaleName}`,
      startBeat: 0,
      durationBeats: steps,
      color: '#F5C518',
      notes,
    });
    return { track, name, scaleName };
  }

  async function addPad(rootHz) {
    await engine.init();
    const track = helpers.pad();
    helpers.clearClips(track);
    const buf = engine.createBufferFromRecipe({
      type: 'pad',
      duration: 4,
      freqs: [rootHz, rootHz * 1.25, rootHz * 1.5],
    });
    engine.addClip(track.id, {
      name: 'Warm Pad', startBeat: 0, durationBeats: 8, color: '#B8860B', buffer: buf,
    });
    return track;
  }

  function arrangementAdvice() {
    const bpm = engine.bpm;
    const n = engine.tracks.length;
    const clips = engine.tracks.reduce((a, t) => a + t.clips.length, 0);
    return [
      `Session snapshot: ${n} tracks, ${clips} clips, ${bpm} BPM.`,
      bpm < 90
        ? 'Tempo feels downtempo — pad + sparse kick works well; try “add drums” then mute hats.'
        : bpm > 140
          ? 'Uptempo — keep hats busy (“add hihat groove”) and a short bass stab.'
          : 'Mid-tempo sweet spot — drums + bass + melody + pad is a solid 4-track bed.',
      'Suggested flow: Demo layout → tweak BPM → Stem Split a reference → generate one-shots in Sample Synth.',
      'Tip: solo the Keys track, nudge Mid EQ on the mixer, then unmute Drums.',
    ].join(' ');
  }

  async function handle(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    append('user', trimmed);
    setBusy('Thinking…');
    const lower = trimmed.toLowerCase();

    try {
      // greetings
      if (/^(hi|hello|hey|yo)\b/.test(lower)) {
        append('bot', 'Hey — I can set BPM, drop drum/hat grooves, sketch bass & melodies, load the demo, or suggest an arrangement. Say “help” for the full list.');
        setBusy('Idle · local rules');
        return;
      }

      if (/\bhelp\b|what can|commands/.test(lower)) {
        append(
          'bot',
          'Commands: bpm N · make beat · add drums · melody/bass/pad · arm record · add vocal chain · suggest vst · load pack hint · loop · metro · demo · suggest arrangement · status'
        );
        setBusy('Idle · local rules');
        return;
      }

      if (/\bstatus\b|what.?s playing|snapshot/.test(lower)) {
        append('bot', arrangementAdvice());
        setBusy('Idle · local rules');
        return;
      }

      if (/\bsuggest|arrang|advice|idea/.test(lower)) {
        append('bot', arrangementAdvice());
        setBusy('Idle · local rules');
        return;
      }

      if (/\blisten\b|\bmatch (the )?(beat|tempo|session)\b/.test(lower)) {
        const heard = detectSessionBeat(engine);
        if (!heard) {
          append('bot', 'I need at least two audio clips on the timeline before I can hear a tempo. Load a demo or add drums, then say listen again.');
          return;
        }
        engine.setBpm(heard.bpm);
        append('bot', `Heard ${heard.bpm} BPM from ${heard.onsets} onsets across ${heard.clips} clips (confidence ${heard.confidence}). Tempo is set. Press Space, then apply or dismiss.`);
        toast(`Heard ${heard.bpm} BPM`);
        return;
      }
      const bpmSet = lower.match(/\bbpm\s*(\d{2,3})\b/) || lower.match(/\btempo\s*(\d{2,3})\b/);
      if (bpmSet) {
        engine.setBpm(Number(bpmSet[1]));
        append('bot', `Tempo set to ${engine.bpm} BPM. Press Space to hear the grid.`);
        toast(`BPM ${engine.bpm}`);
        setBusy('Idle · local rules');
        return;
      }

      if (/\bfaster|speed up|uptempo\b/.test(lower)) {
        engine.setBpm(engine.bpm + 10);
        append('bot', `Nudged up to ${engine.bpm} BPM.`);
        setBusy('Idle · local rules');
        return;
      }
      if (/\bslower|slow down|downtempo\b/.test(lower)) {
        engine.setBpm(engine.bpm - 10);
        append('bot', `Nudged down to ${engine.bpm} BPM.`);
        setBusy('Idle · local rules');
        return;
      }

      if (/\b(metro|metronome)\b/.test(lower)) {
        engine.metronomeOn = !engine.metronomeOn;
        append('bot', engine.metronomeOn ? 'Metronome on.' : 'Metronome off.');
        setBusy('Idle · local rules');
        return;
      }

      if (/\bloop\b/.test(lower)) {
        engine.isLooping = !engine.isLooping;
        append('bot', engine.isLooping ? 'Loop enabled (bars 1–8).' : 'Loop disabled.');
        setBusy('Idle · local rules');
        return;
      }

      if (/\bdemo\b/.test(lower)) {
        setBusy('Building demo…');
        await engine.init();
        engine.loadDemoProject();
        window.dispatchEvent(new CustomEvent('mm-sound-deck-demo-loaded'));
        append('bot', 'Loaded demo arrangement (Drums, Bass, Keys, Pad). Hit Play / Space.');
        toast('Demo loaded');
        setBusy('Idle · local rules');
        return;
      }

      if (/\bclear drums\b|\bclear beat\b/.test(lower)) {
        const t = helpers.drums();
        helpers.clearClips(t);
        engine._emit('tracks', engine.tracks);
        append('bot', `Cleared clips on “${t.name}”.`);
        setBusy('Idle · local rules');
        return;
      }

      if (/\bhihat|hat groove|hats\b/.test(lower) && !/\bmelody\b/.test(lower)) {
        setBusy('Writing hats…');
        const t = await addHatGroove(2);
        append('bot', `16th-note hat groove on “${t.name}” (2 bars). Solo the track or press Play.`);
        toast('Hat groove added');
        setBusy('Idle · local rules');
        return;
      }

      if (/\bdrum|drums|beat|groove|click pattern\b/.test(lower)) {
        setBusy('Writing drums…');
        const style = /\bfour\b|four-on|4 on/i.test(lower)
          ? 'four'
          : /\bshuffle\b|swing/i.test(lower)
            ? 'shuffle'
            : 'straight';
        const t = await addRichDrums(2, style);
        append(
          'bot',
          `Dropped a 2-bar ${style} kick/snare/hat pattern on “${t.name}”. Press Play. Variants: “add drums four”, “add drums shuffle”.`
        );
        toast('Drum pattern added');
        setBusy('Idle · local rules');
        return;
      }

      if (/\bbass\b/.test(lower)) {
        setBusy('Writing bass…');
        const { hz, name } = parseRoot(trimmed);
        const pattern = /\bwalk/i.test(lower) ? 'walking' : 'root-fifth';
        const t = await addBassLine(hz, 2, pattern);
        append('bot', `Bass line in ${name} (${pattern}) on “${t.name}”.`);
        toast('Bass added');
        setBusy('Idle · local rules');
        return;
      }

      if (/\bpad\b|atmos|ambient bed/.test(lower)) {
        setBusy('Rendering pad…');
        const { hz, name } = parseRoot(trimmed);
        const t = await addPad(hz);
        append('bot', `Warm pad rooted near ${name} on “${t.name}”.`);
        toast('Pad added');
        setBusy('Idle · local rules');
        return;
      }

      if (/\bmelod/.test(lower)) {
        setBusy('Writing melody…');
        const { track, name, scaleName } = await addMelody(trimmed, 2);
        append(
          'bot',
          `Sketched a ${name} ${scaleName} melody (oscillator sequence) on “${track.name}”. Try “melody in D pentatonic” or “melody in F# minor”.`
        );
        toast('Melody added');
        setBusy('Idle · local rules');
        return;
      }

      if (/\bplay\b/.test(lower)) {
        await engine.play();
        append('bot', 'Transport playing.');
        setBusy('Idle · local rules');
        return;
      }
      if (/\bstop\b/.test(lower)) {
        engine.stop();
        append('bot', 'Transport stopped.');
        setBusy('Idle · local rules');
        return;
      }


      if (/\bmake beat\b|\bbeat maker\b|\bstep seq/.test(lower)) {
        setBusy('Building beat…');
        await engine.init();
        const track = helpers.drums();
        helpers.clearClips(track);
        const kick = engine.createBufferFromRecipe({ type: 'kick', duration: 0.4 });
        const snare = engine.createBufferFromRecipe({ type: 'snare', duration: 0.28 });
        const hat = engine.createBufferFromRecipe({ type: 'hat', duration: 0.1 });
        for (let step = 0; step < 16; step++) {
          const beat = step * 0.25;
          if (step % 4 === 0) engine.addClip(track.id, { name: 'Kick', startBeat: beat, durationBeats: 0.25, color: '#F5C518', buffer: kick });
          if (step === 4 || step === 12) engine.addClip(track.id, { name: 'Snare', startBeat: beat, durationBeats: 0.25, color: '#E8A838', buffer: snare });
          if (step % 2 === 0) engine.addClip(track.id, { name: 'Hat', startBeat: beat, durationBeats: 0.2, color: '#C9A227', buffer: hat });
        }
        engine._emit('tracks', engine.tracks);
        append('bot', `16-step beat written on “${track.name}”. Open the Beats tab to edit steps, or press Play.`);
        toast('Beat created');
        setBusy('Idle · local rules');
        return;
      }

      if (/\barm record\b|\barm mic\b|\brecord arm\b/.test(lower)) {
        append('bot', 'Open the Mic tab → Refresh devices → Arm monitor → Record. Works with USB class-compliant mics and condensers via your audio interface (any browser-visible input).');
        toast('See Mic panel');
        setBusy('Idle · local rules');
        return;
      }

      if (/\bvocal chain\b|\badd vocal\b/.test(lower)) {
        append('bot', 'Open Vocals: enable gate stub + HPF + compressor + light reverb, Record vocal, then Bounce to track. De-esser is a stub EQ dip until Phase 2.');
        toast('See Vocals panel');
        setBusy('Idle · local rules');
        return;
      }

      if (/\bsuggest vst\b|\bvst slot\b|\bplugin\b/.test(lower)) {
        append('bot', 'Plugins & Packs → Catalog: Insert a Demo effect (MM Comp, Delay, Space…) as a real Web Audio insert on any track or master. VST Rack · Bridge: assign a user .vst3 path — the browser cannot run native VST, so slots store metadata until desktop/vst-bridge is online.');
        toast('See Plugins & Packs');
        setBusy('Idle · local rules');
        return;
      }

      if (/\bload pack\b|\bpack hint\b|\bfl pack\b/.test(lower)) {
        append('bot', 'Plugins & Packs → Packs: built-in demo packs (synthesized in-browser) are already in the Library; Import a folder of WAVs you own → filter catalog → drag to timeline. No Image-Line redistribution.');
        toast('See Plugins & Packs → Packs');
        setBusy('Idle · local rules');
        return;
      }

      append(
        'bot',
        'Not sure I caught that. Try “help”, or: make beat · arm record · add vocal chain · suggest vst · load pack hint.'
      );
      setBusy('Idle · local rules');
    } catch (err) {
      append('bot', `Something went wrong: ${err.message || err}`);
      setBusy('Error · see chat');
      toast('AI Producer error', 'error');
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = input.value;
    input.value = '';
    handle(v);
  });

  root.querySelectorAll('[data-q]').forEach((btn) => {
    btn.addEventListener('click', () => handle(btn.dataset.q));
  });
}
