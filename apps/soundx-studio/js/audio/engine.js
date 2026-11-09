/**
 * Mens Mercatus Sound Deck — Audio Engine
 * Web Audio transport, tracks, clips. Original implementation.
 */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.metronomeGain = null;
    this.bpm = 120;
    this.isPlaying = false;
    this.isLooping = false;
    this.loopStart = 0;
    this.loopEnd = 8; // bars
    this.metronomeOn = false;
    this.currentBeat = 0;
    this.startTime = 0;
    this.pauseOffset = 0;
    this.schedulerTimer = null;
    this.lookAhead = 0.1;
    this.scheduleInterval = 25;
    this.nextNoteTime = 0;
    this.tracks = [];
    this.listeners = new Map();
    this._soloActive = false;
    this._masterVol = 0.85;
    this.masterEq = { low: 0, mid: 0, high: 0 };
    this._reverbOn = false;
    this._reverbWetLevel = 0.42;
    this.masterEqLow = null;
    this.masterEqMid = null;
    this.masterEqHigh = null;
    this.reverb = null;
    this.reverbPre = null;
    this.reverbTone = null;
    this.reverbWet = null;
    // kind -> (meta, engine) => AudioBuffer. Lets Pattern / Piano clips re-render after JSON load.
    this.metaRenderers = new Map();
    // clip id -> AudioBuffer. Buffers are not serialized in toJSON, so Restore / fromJSON
    // re-attaches decoded audio (imports, bounces) for buffer-only clips by their old id.
    this._bufCache = new Map();
  }

  rememberBuffer(clipId, buffer) {
    if (!clipId || !buffer) return;
    this._bufCache.delete(clipId);
    this._bufCache.set(clipId, buffer);
    while (this._bufCache.size > 1500) this._bufCache.delete(this._bufCache.keys().next().value);
  }

  get reverbOn() {
    return this._reverbOn;
  }

  async init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this._masterVol;
    // Pass-through analyser: spectrum/level read the master bus after EQ. Silence stays flat.
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;
    this._buildMasterBus();
    this.metronomeGain = this.ctx.createGain();
    this.metronomeGain.gain.value = 0.35;
    this.metronomeGain.connect(this.masterGain);
    // seed 4 demo tracks — named to match mixer / arrangement roles
    const seed = [
      { type: 'audio', name: 'Drums' },
      { type: 'audio', name: 'Bass' },
      { type: 'midi', name: 'Keys' },
      { type: 'midi', name: 'Pad' },
    ];
    seed.forEach((s) => this.addTrack(s.type, s.name));
    this._emit('ready');
  }

  async resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  on(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(fn);
  }

  off(event, fn) {
    this.listeners.get(event)?.delete(fn);
  }

  _emit(event, data) {
    this.listeners.get(event)?.forEach((fn) => fn(data));
  }

  get secondsPerBeat() {
    return 60 / this.bpm;
  }

  get currentTime() {
    if (!this.isPlaying || !this.ctx) return this.pauseOffset;
    return this.pauseOffset + (this.ctx.currentTime - this.startTime);
  }

  get currentBar() {
    const beats = this.currentTime / this.secondsPerBeat;
    return beats / 4;
  }

  setBpm(bpm) {
    this.bpm = Math.max(40, Math.min(240, Number(bpm) || 120));
    this._emit('bpm', this.bpm);
  }

  addTrack(type = 'audio', name) {
    const id = `track-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const track = {
      id,
      name: name || `Track ${this.tracks.length + 1}`,
      type, // audio | midi
      muted: false,
      solo: false,
      volume: 0.8,
      pan: 0,
      clips: [],
      // mixer nodes created lazily
      gainNode: null,
      panNode: null,
      eqLow: null,
      eqMid: null,
      eqHigh: null,
      eq: { low: 0, mid: 0, high: 0 },
    };
    this.tracks.push(track);
    this._wireTrack(track);
    this._emit('tracks', this.tracks);
    return track;
  }

  removeTrack(id) {
    const idx = this.tracks.findIndex((t) => t.id === id);
    if (idx < 0 || this.tracks.length <= 1) return false;
    const track = this.tracks[idx];
    try {
      track.gainNode?.disconnect();
      track.panNode?.disconnect();
    } catch (_) {}
    this.tracks.splice(idx, 1);
    this._updateSoloState();
    this._emit('tracks', this.tracks);
    return true;
  }

  _wireTrack(track) {
    if (!this.ctx) return;
    track.eqLow = this.ctx.createBiquadFilter();
    track.eqLow.type = 'lowshelf';
    track.eqLow.frequency.value = 320;
    track.eqMid = this.ctx.createBiquadFilter();
    track.eqMid.type = 'peaking';
    track.eqMid.frequency.value = 1000;
    track.eqMid.Q.value = 0.7;
    track.eqHigh = this.ctx.createBiquadFilter();
    track.eqHigh.type = 'highshelf';
    track.eqHigh.frequency.value = 3200;
    track.panNode = this.ctx.createStereoPanner();
    track.gainNode = this.ctx.createGain();
    track.eqLow.connect(track.eqMid);
    track.eqMid.connect(track.eqHigh);
    track.eqHigh.connect(track.panNode);
    track.panNode.connect(track.gainNode);
    track.gainNode.connect(this.masterGain);
    this._applyTrackGain(track);
  }

  _applyTrackGain(track) {
    if (!track.gainNode) return;
    const silent = track.muted || (this._soloActive && !track.solo);
    const target = silent ? 0 : track.volume;
    const now = this.ctx ? this.ctx.currentTime : 0;
    try {
      track.gainNode.gain.cancelScheduledValues(now);
      track.gainNode.gain.setValueAtTime(target, now);
    } catch (_) {
      track.gainNode.gain.value = target;
    }
    if (track.panNode) track.panNode.pan.value = track.pan;
    if (track.eqLow) track.eqLow.gain.value = track.eq.low;
    if (track.eqMid) track.eqMid.gain.value = track.eq.mid;
    if (track.eqHigh) track.eqHigh.gain.value = track.eq.high;
  }

  _updateSoloState() {
    this._soloActive = this.tracks.some((t) => t.solo);
    this.tracks.forEach((t) => this._applyTrackGain(t));
  }

  setTrackMute(id, muted) {
    const t = this.tracks.find((x) => x.id === id);
    if (!t) return;
    t.muted = !!muted;
    this._applyTrackGain(t);
    this._emit('tracks', this.tracks);
  }

  setTrackSolo(id, solo) {
    const t = this.tracks.find((x) => x.id === id);
    if (!t) return;
    t.solo = !!solo;
    this._updateSoloState();
    this._emit('tracks', this.tracks);
  }

  setTrackVolume(id, vol) {
    const t = this.tracks.find((x) => x.id === id);
    if (!t) return;
    t.volume = Math.max(0, Math.min(1, vol));
    this._applyTrackGain(t);
    this._emit('tracks', this.tracks);
  }

  setTrackPan(id, pan) {
    const t = this.tracks.find((x) => x.id === id);
    if (!t) return;
    t.pan = Math.max(-1, Math.min(1, pan));
    this._applyTrackGain(t);
  }

  setTrackEq(id, band, gainDb) {
    const t = this.tracks.find((x) => x.id === id);
    if (!t) return;
    t.eq[band] = Math.max(-12, Math.min(12, gainDb));
    this._applyTrackGain(t);
  }

  _buildMasterBus() {
    const ctx = this.ctx;
    this.masterEqLow = ctx.createBiquadFilter();
    this.masterEqLow.type = 'lowshelf';
    this.masterEqLow.frequency.value = 320;
    this.masterEqMid = ctx.createBiquadFilter();
    this.masterEqMid.type = 'peaking';
    this.masterEqMid.frequency.value = 1000;
    this.masterEqMid.Q.value = 0.7;
    this.masterEqHigh = ctx.createBiquadFilter();
    this.masterEqHigh.type = 'highshelf';
    this.masterEqHigh.frequency.value = 3200;
    this.masterEqLow.connect(this.masterEqMid);
    this.masterEqMid.connect(this.masterEqHigh);
    this.masterEqHigh.connect(this.analyser);
    this.analyser.connect(ctx.destination);

    // Convolver is always in the graph. Wet gain is 0 until the Reverb chip is on.
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * 1.7);
    const impulse = ctx.createBuffer(2, length, rate);
    const taps = [0.011, 0.017, 0.029, 0.043, 0.067, 0.097];
    for (let c = 0; c < 2; c++) {
      const data = impulse.getChannelData(c);
      for (let t = 0; t < taps.length; t++) {
        const i = Math.floor(taps[t] * rate);
        if (i < length) data[i] += (c === 0 ? 0.42 : 0.33) * (1 - t / taps.length);
      }
      for (let i = 0; i < length; i++) {
        const decay = Math.pow(1 - i / length, 2.15);
        data[i] += (Math.random() * 2 - 1) * decay * 0.32;
      }
    }
    this.reverb = ctx.createConvolver();
    this.reverb.normalize = true;
    this.reverb.buffer = impulse;
    this.reverbPre = ctx.createDelay(0.1);
    this.reverbPre.delayTime.value = 0.028;
    this.reverbTone = ctx.createBiquadFilter();
    this.reverbTone.type = 'lowpass';
    this.reverbTone.frequency.value = 6500;
    this.reverbTone.Q.value = 0.7;
    this.reverbWet = ctx.createGain();
    this.reverbWet.gain.value = 0;

    // masterGain -> EQ -> analyser -> destination
    // masterGain -> predelay -> convolver -> tone -> wet -> EQ
    this.masterGain.connect(this.masterEqLow);
    this.masterGain.connect(this.reverbPre);
    this.reverbPre.connect(this.reverb);
    this.reverb.connect(this.reverbTone);
    this.reverbTone.connect(this.reverbWet);
    this.reverbWet.connect(this.masterEqLow);
    this._applyMasterEq();
    this.setMasterReverb(this._reverbOn);
  }

  _clampDb(gainDb) {
    return Math.max(-12, Math.min(12, Number(gainDb) || 0));
  }

  _applyMasterEq() {
    if (this.masterEqLow) this.masterEqLow.gain.value = this.masterEq.low;
    if (this.masterEqMid) this.masterEqMid.gain.value = this.masterEq.mid;
    if (this.masterEqHigh) this.masterEqHigh.gain.value = this.masterEq.high;
  }

  setMasterEq(band, gainDb) {
    if (!Object.prototype.hasOwnProperty.call(this.masterEq, band)) return;
    this.masterEq[band] = this._clampDb(gainDb);
    this._applyMasterEq();
  }

  setMasterReverb(on) {
    this._reverbOn = !!on;
    if (!this.reverbWet || !this.ctx) return;
    const now = this.ctx.currentTime;
    const target = this._reverbOn ? this._reverbWetLevel : 0;
    try {
      this.reverbWet.gain.cancelScheduledValues(now);
      this.reverbWet.gain.setValueAtTime(target, now);
    } catch (_) {
      this.reverbWet.gain.value = target;
    }
  }

  setMasterVolume(vol) {
    this._masterVol = Math.max(0, Math.min(1, Number(vol) || 0));
    if (this.masterGain) {
      const now = this.ctx ? this.ctx.currentTime : 0;
      try {
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(this._masterVol, now);
      } catch (_) {
        this.masterGain.gain.value = this._masterVol;
      }
    }
  }

  /** Fader/pan/EQ/mute/solo/master — no clip audio, safe to snapshot. */
  captureMix() {
    return {
      master: this._masterVol,
      masterEq: { low: this.masterEq.low, mid: this.masterEq.mid, high: this.masterEq.high },
      reverb: this._reverbOn,
      tracks: this.tracks.map((t) => ({
        id: t.id,
        volume: t.volume,
        pan: t.pan,
        muted: !!t.muted,
        solo: !!t.solo,
        eq: { low: t.eq?.low || 0, mid: t.eq?.mid || 0, high: t.eq?.high || 0 },
      })),
    };
  }

  applyMix(state) {
    if (!state) return;
    if (typeof state.master === 'number') this.setMasterVolume(state.master);
    const eq = state.masterEq || { low: 0, mid: 0, high: 0 };
    this.masterEq = {
      low: this._clampDb(eq.low),
      mid: this._clampDb(eq.mid),
      high: this._clampDb(eq.high),
    };
    this._applyMasterEq();
    this.setMasterReverb(!!state.reverb);
    const byId = new Map((state.tracks || []).map((t) => [t.id, t]));
    this.tracks.forEach((t) => {
      const s = byId.get(t.id);
      if (!s) return;
      t.volume = Math.max(0, Math.min(1, Number(s.volume ?? t.volume)));
      t.pan = Math.max(-1, Math.min(1, Number(s.pan ?? t.pan)));
      t.muted = !!s.muted;
      t.solo = !!s.solo;
      t.eq = {
        low: Number(s.eq?.low ?? 0),
        mid: Number(s.eq?.mid ?? 0),
        high: Number(s.eq?.high ?? 0),
      };
    });
    this._updateSoloState();
    this._emit('tracks', this.tracks);
  }

  setLoopRegion(startBar, endBar, looping = this.isLooping) {
    let s = Math.max(0, Number(startBar) || 0);
    let e = Math.max(0, Number(endBar) || 0);
    if (e < s) [s, e] = [e, s];
    const minSpan = 0.25; // one beat
    if (e - s < minSpan) e = s + minSpan;
    this.loopStart = Math.round(s * 1000) / 1000;
    this.loopEnd = Math.round(e * 1000) / 1000;
    this.isLooping = !!looping;
    this._emit('loop', {
      loopStart: this.loopStart,
      loopEnd: this.loopEnd,
      isLooping: this.isLooping,
    });
  }

  /** Move the playhead by whole beats (negative ok). Reschedules if playing. */
  nudgeBeats(deltaBeats) {
    const shift = (Number(deltaBeats) || 0) * this.secondsPerBeat;
    if (this.isPlaying && this.ctx) {
      this.pauseOffset = Math.max(0, this.currentTime + shift);
      this.startTime = this.ctx.currentTime;
      this._stopScheduled();
      this.currentBeat = this.pauseOffset / this.secondsPerBeat;
      this._lastScheduledBeat = this.currentBeat - 0.01;
    } else {
      this.pauseOffset = Math.max(0, this.pauseOffset + shift);
      this.currentBeat = this.pauseOffset / this.secondsPerBeat;
    }
    this._emit('tick', {
      beat: this.currentBeat,
      time: this.pauseOffset,
      bar: this.currentBeat / 4,
    });
  }

  /** Seek playhead to an absolute beat. Reschedules if playing. */
  seekToBeat(beat) {
    const b = Math.max(0, Number(beat) || 0);
    const t = b * this.secondsPerBeat;
    if (this.isPlaying && this.ctx) {
      this.pauseOffset = t;
      this.startTime = this.ctx.currentTime;
      this._stopScheduled();
      this.currentBeat = b;
      this._lastScheduledBeat = b - 0.01;
    } else {
      this.pauseOffset = t;
      this.currentBeat = b;
    }
    this._emit('tick', {
      beat: this.currentBeat,
      time: this.pauseOffset,
      bar: this.currentBeat / 4,
    });
  }

  /** Create an AudioBuffer from a simple synth recipe */
  createBufferFromRecipe(recipe) {
    if (!this.ctx) return null;
    const sr = this.ctx.sampleRate;
    const duration = recipe.duration || 0.5;
    const len = Math.floor(sr * duration);
    const buffer = this.ctx.createBuffer(1, len, sr);
    const data = buffer.getChannelData(0);
    const type = recipe.type || 'tone';

    if (type === 'kick') {
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 18);
        const freq = 150 * Math.exp(-t * 12) + 40;
        data[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.9;
      }
    } else if (type === 'hat') {
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 40);
        data[i] = (Math.random() * 2 - 1) * env * 0.35;
      }
    } else if (type === 'snare') {
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 22);
        const tone = Math.sin(2 * Math.PI * 180 * t) * Math.exp(-t * 30);
        data[i] = ((Math.random() * 2 - 1) * 0.6 + tone * 0.4) * env * 0.7;
      }
    } else if (type === 'pad') {
      const freqs = recipe.freqs || [220, 277, 330];
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const attack = Math.min(1, t / 0.08);
        const release = Math.min(1, (duration - t) / 0.15);
        const env = attack * release;
        let s = 0;
        freqs.forEach((f) => {
          s += Math.sin(2 * Math.PI * f * t) * 0.25;
          s += Math.sin(2 * Math.PI * f * 2 * t) * 0.08;
        });
        data[i] = s * env * 0.6;
      }
    } else if (type === 'noise') {
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const env = Math.min(1, t / 0.01) * Math.min(1, (duration - t) / 0.05);
        data[i] = (Math.random() * 2 - 1) * env * 0.25;
      }
    } else {
      // tone / melody note
      const freq = recipe.freq || 440;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const attack = Math.min(1, t / 0.01);
        const release = Math.min(1, (duration - t) / 0.05);
        data[i] = Math.sin(2 * Math.PI * freq * t) * attack * release * 0.4;
      }
    }
    return buffer;
  }

  addClip(trackId, clip) {
    const track = this.tracks.find((t) => t.id === trackId);
    if (!track) return null;
    const id = `clip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const entry = {
      id,
      name: clip.name || 'Clip',
      startBeat: clip.startBeat ?? 0,
      durationBeats: clip.durationBeats ?? 4,
      color: clip.color || '#F5C518',
      buffer: clip.buffer || null,
      recipe: clip.recipe || null,
      notes: clip.notes || null, // MIDI-like [{beat, dur, freq, vel?}]
      meta: clip.meta || null, // e.g. { kind: 'pattern' | 'piano', ... } — editable source data
    };
    if (!entry.buffer && entry.recipe) {
      entry.buffer = this.createBufferFromRecipe(entry.recipe);
    }
    if (!entry.buffer && !entry.notes && entry.meta && this.ctx) {
      const render = this.metaRenderers.get(entry.meta.kind);
      if (render) {
        try { entry.buffer = render(entry.meta, this) || null; } catch (_) {}
      }
    }
    if (entry.buffer) this.rememberBuffer(entry.id, entry.buffer);
    track.clips.push(entry);
    this._emit('tracks', this.tracks);
    return entry;
  }

  removeClip(trackId, clipId) {
    const track = this.tracks.find((t) => t.id === trackId);
    if (!track) return;
    track.clips = track.clips.filter((c) => c.id !== clipId);
    this._emit('tracks', this.tracks);
  }

  moveClip(trackId, clipId, startBeat) {
    const track = this.tracks.find((t) => t.id === trackId);
    if (!track) return;
    const clip = track.clips.find((c) => c.id === clipId);
    if (!clip) return;
    clip.startBeat = Math.max(0, startBeat);
    this._emit('tracks', this.tracks);
  }

  async play() {
    await this.init();
    await this.resume();
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.startTime = this.ctx.currentTime;
    this.nextNoteTime = this.ctx.currentTime;
    this.currentBeat = this.pauseOffset / this.secondsPerBeat;
    this._scheduleClipsFrom(this.currentBeat);
    this.schedulerTimer = setInterval(() => this._scheduler(), this.scheduleInterval);
    this._emit('play');
  }

  pause() {
    if (!this.isPlaying) return;
    this.pauseOffset = this.currentTime;
    this.isPlaying = false;
    clearInterval(this.schedulerTimer);
    this.schedulerTimer = null;
    this._stopScheduled();
    this._emit('pause');
  }

  stop() {
    this.isPlaying = false;
    clearInterval(this.schedulerTimer);
    this.schedulerTimer = null;
    this.pauseOffset = 0;
    this.currentBeat = 0;
    this._stopScheduled();
    this._emit('stop');
  }

  _scheduledSources = [];

  _stopScheduled() {
    this._scheduledSources.forEach((s) => {
      try { s.stop(); } catch (_) {}
    });
    this._scheduledSources = [];
  }

  _lastScheduledBeat = -1;

  _scheduleClipsFrom(fromBeat) {
    this._lastScheduledBeat = fromBeat - 0.01;
  }

  _scheduler() {
    if (!this.isPlaying || !this.ctx) return;
    const now = this.ctx.currentTime;
    const elapsed = this.pauseOffset + (now - this.startTime);
    let beat = elapsed / this.secondsPerBeat;

    if (this.isLooping) {
      const loopStartBeat = this.loopStart * 4;
      const loopEndBeat = this.loopEnd * 4;
      if (beat >= loopEndBeat) {
        this.pauseOffset = loopStartBeat * this.secondsPerBeat;
        this.startTime = this.ctx.currentTime;
        beat = loopStartBeat;
        this._stopScheduled();
        this._lastScheduledBeat = beat - 0.01;
      }
    }

    this.currentBeat = beat;
    this._emit('tick', { beat, time: elapsed, bar: beat / 4 });

    // schedule metronome clicks a bit ahead
    const lookaheadBeats = (this.lookAhead / this.secondsPerBeat) + 0.5;
    const endBeat = beat + lookaheadBeats;

    if (this.metronomeOn) {
      const startClick = Math.ceil(Math.max(beat, this._lastScheduledBeat + 0.001));
      for (let b = startClick; b < endBeat; b++) {
        const when = this.startTime + (b * this.secondsPerBeat - this.pauseOffset);
        if (when > now - 0.01) this._playMetronomeClick(when, b % 4 === 0);
      }
    }

    // schedule clip playback for beats entering lookahead
    this.tracks.forEach((track) => {
      track.clips.forEach((clip) => {
        if (clip._scheduledFor === this.startTime) return;
        const clipStart = clip.startBeat;
        // schedule if clip starts in lookahead window relative to current playhead once
        if (clipStart >= this._lastScheduledBeat && clipStart < endBeat) {
          const when = this.startTime + (clipStart * this.secondsPerBeat - this.pauseOffset);
          if (when >= now - 0.05) {
            this._playClip(track, clip, Math.max(when, now));
            clip._scheduledFor = this.startTime;
          }
        } else if (clipStart < beat && clipStart + clip.durationBeats > beat && clip._scheduledFor !== this.startTime) {
          // mid-clip resume: play from offset
          const offsetBeats = beat - clipStart;
          const when = now;
          this._playClip(track, clip, when, offsetBeats);
          clip._scheduledFor = this.startTime;
        }
      });
    });

    this._lastScheduledBeat = endBeat;
  }

  _playMetronomeClick(when, accent) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.frequency.value = accent ? 1200 : 800;
    g.gain.setValueAtTime(accent ? 0.4 : 0.2, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.05);
    osc.connect(g);
    g.connect(this.metronomeGain);
    osc.start(when);
    osc.stop(when + 0.06);
    this._scheduledSources.push(osc);
  }

  _playClip(track, clip, when, offsetBeats = 0) {
    if (!track.eqLow) this._wireTrack(track);

    if (clip.notes && clip.notes.length) {
      clip.notes.forEach((n) => {
        const noteWhen = when + (n.beat - offsetBeats) * this.secondsPerBeat;
        if (noteWhen < when - 0.01 && offsetBeats > 0 && n.beat < offsetBeats) return;
        const startAt = Math.max(noteWhen, when);
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = n.wave || 'sine';
        osc.frequency.value = n.freq;
        const dur = (n.dur || 0.25) * this.secondsPerBeat;
        g.gain.setValueAtTime(0.0001, startAt);
        const peak = 0.35 * Math.max(0.05, Math.min(1, n.vel ?? 1));
        g.gain.exponentialRampToValueAtTime(peak, startAt + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
        osc.connect(g);
        g.connect(track.eqLow);
        osc.start(startAt);
        osc.stop(startAt + dur + 0.02);
        this._scheduledSources.push(osc);
      });
      return;
    }

    let buffer = clip.buffer;
    if (!buffer && clip.recipe) {
      buffer = this.createBufferFromRecipe(clip.recipe);
      clip.buffer = buffer;
    }
    if (!buffer) return;

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(track.eqLow);
    const offsetSec = offsetBeats * this.secondsPerBeat;
    const remaining = Math.max(0.01, buffer.duration - offsetSec);
    try {
      src.start(when, offsetSec, remaining);
      this._scheduledSources.push(src);
    } catch (_) {}
  }

  /** Generate demo drum pattern onto a track */
  addDrumPattern(trackId, bars = 2) {
    const beats = bars * 4;
    const notes = [];
    for (let b = 0; b < beats; b++) {
      // kick on 1 and 3
      if (b % 4 === 0 || b % 4 === 2) {
        notes.push({ beat: b, dur: 0.4, freq: 60, wave: 'sine' });
      }
      // hat on 8ths
      notes.push({ beat: b, dur: 0.1, freq: 8000, wave: 'square' });
      notes.push({ beat: b + 0.5, dur: 0.08, freq: 9000, wave: 'square' });
      // snare on 2 and 4
      if (b % 4 === 1 || b % 4 === 3) {
        notes.push({ beat: b, dur: 0.2, freq: 200, wave: 'triangle' });
      }
    }
    // Also add buffer-based kick/hat clips for richer sound
    const kickBuf = this.createBufferFromRecipe({ type: 'kick', duration: 0.4 });
    const hatBuf = this.createBufferFromRecipe({ type: 'hat', duration: 0.12 });
    const snareBuf = this.createBufferFromRecipe({ type: 'snare', duration: 0.25 });

    // Place as a composite: we'll schedule individual one-shots as separate short clips
    for (let b = 0; b < beats; b++) {
      if (b % 4 === 0 || b % 4 === 2) {
        this.addClip(trackId, {
          name: 'Kick',
          startBeat: b,
          durationBeats: 0.5,
          color: '#F5C518',
          buffer: kickBuf,
        });
      }
      if (b % 4 === 1 || b % 4 === 3) {
        this.addClip(trackId, {
          name: 'Snare',
          startBeat: b,
          durationBeats: 0.4,
          color: '#E8A838',
          buffer: snareBuf,
        });
      }
      this.addClip(trackId, {
        name: 'Hat',
        startBeat: b,
        durationBeats: 0.25,
        color: '#C9A227',
        buffer: hatBuf,
      });
      this.addClip(trackId, {
        name: 'Hat',
        startBeat: b + 0.5,
        durationBeats: 0.2,
        color: '#C9A227',
        buffer: hatBuf,
      });
    }
    return notes;
  }

  /** Simple melody as oscillator note events */
  addMelody(trackId, rootHz = 261.63, bars = 2) {
    const scale = [0, 2, 4, 5, 7, 9, 11, 12]; // major
    const notes = [];
    const steps = bars * 4;
    for (let i = 0; i < steps; i++) {
      const deg = scale[i % scale.length];
      const freq = rootHz * Math.pow(2, deg / 12);
      notes.push({ beat: i, dur: 0.85, freq, wave: 'sine' });
    }
    this.addClip(trackId, {
      name: 'Melody',
      startBeat: 0,
      durationBeats: steps,
      color: '#F5C518',
      notes,
    });
    return notes;
  }

  loadDemoProject() {
    // Clear clips and place a demo arrangement
    this.tracks.forEach((t) => { t.clips = []; });
    if (this.tracks[0]) {
      this.tracks[0].name = 'Drums';
      this.tracks[0].type = 'audio';
      this.addDrumPattern(this.tracks[0].id, 2);
    }
    if (this.tracks[1]) {
      this.tracks[1].name = 'Bass';
      this.tracks[1].type = 'audio';
      const bassNotes = [];
      for (let i = 0; i < 8; i++) {
        bassNotes.push({ beat: i, dur: 0.9, freq: 55 * (i % 4 === 2 ? 1.5 : 1), wave: 'sawtooth' });
      }
      this.addClip(this.tracks[1].id, {
        name: 'Bass Line',
        startBeat: 0,
        durationBeats: 8,
        color: '#D4A017',
        notes: bassNotes,
      });
    }
    if (this.tracks[2]) {
      this.tracks[2].name = 'Keys';
      this.tracks[2].type = 'midi';
      this.addMelody(this.tracks[2].id, 329.63, 2);
    }
    if (this.tracks[3]) {
      this.tracks[3].name = 'Pad';
      this.tracks[3].type = 'audio';
      const padBuf = this.createBufferFromRecipe({
        type: 'pad',
        duration: 4,
        freqs: [220, 277.18, 329.63],
      });
      this.addClip(this.tracks[3].id, {
        name: 'Warm Pad',
        startBeat: 0,
        durationBeats: 8,
        color: '#B8860B',
        buffer: padBuf,
      });
    }
    this._emit('tracks', this.tracks);
  }

  toJSON() {
    return {
      version: 1,
      bpm: this.bpm,
      isLooping: this.isLooping,
      loopStart: this.loopStart,
      loopEnd: this.loopEnd,
      metronomeOn: this.metronomeOn,
      tracks: this.tracks.map((t) => ({
        id: t.id,
        name: t.name,
        type: t.type,
        muted: t.muted,
        solo: t.solo,
        volume: t.volume,
        pan: t.pan,
        eq: { ...t.eq },
        clips: t.clips.map((c) => ({
          id: c.id,
          name: c.name,
          startBeat: c.startBeat,
          durationBeats: c.durationBeats,
          color: c.color,
          recipe: c.recipe,
          notes: c.notes,
          meta: c.meta || null,
          // buffers not serialized — recreate from recipe/notes
        })),
      })),
    };
  }

  fromJSON(data) {
    if (!data || !data.tracks) return;
    this.stop();
    this.bpm = data.bpm || 120;
    this.isLooping = !!data.isLooping;
    this.loopStart = data.loopStart ?? 0;
    this.loopEnd = data.loopEnd ?? 8;
    this.metronomeOn = !!data.metronomeOn;
    // tear down old tracks
    this.tracks.forEach((t) => {
      try { t.gainNode?.disconnect(); } catch (_) {}
    });
    this.tracks = [];
    data.tracks.forEach((td) => {
      const t = this.addTrack(td.type, td.name);
      t.id = td.id;
      t.muted = td.muted;
      t.solo = td.solo;
      t.volume = td.volume ?? 0.8;
      t.pan = td.pan ?? 0;
      t.eq = td.eq || { low: 0, mid: 0, high: 0 };
      this._applyTrackGain(t);
      (td.clips || []).forEach((cd) => {
        const cached = !cd.buffer && cd.id ? this._bufCache.get(cd.id) : null;
        const keep = cached && !cd.recipe && !(cd.notes && cd.notes.length)
          && !(cd.meta && this.metaRenderers.has(cd.meta.kind));
        const entry = this.addClip(t.id, keep ? { ...cd, buffer: cached } : cd);
        if (entry && cd.id && entry.buffer) this.rememberBuffer(cd.id, entry.buffer);
      });
    });
    this._updateSoloState();
    this._emit('bpm', this.bpm);
    this._emit('tracks', this.tracks);
    this._emit('loop', {
      loopStart: this.loopStart,
      loopEnd: this.loopEnd,
      isLooping: this.isLooping,
    });
  }
}
