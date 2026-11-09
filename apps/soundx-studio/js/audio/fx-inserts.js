/**
 * Browser insert FX — real Web Audio node chains per channel (track or master).
 * Track: gainNode → [fx…] → masterGain. Master: masterEqHigh → [fx…] → analyser.
 * These are simple DEMO processors, not emulations of any commercial plugin.
 */
export const FX_TYPES = {
  comp: { name: 'MM Comp', desc: 'DynamicsCompressor — glue / punch', param: 'Amount' },
  eqlow: { name: 'MM Low Cut', desc: 'High-pass filter 20 Hz–1.5 kHz', param: 'Cutoff' },
  filter: { name: 'MM Filter', desc: 'Resonant low-pass sweep', param: 'Close' },
  drive: { name: 'MM Drive', desc: 'Tanh WaveShaper saturation', param: 'Drive' },
  crush: { name: 'MM Crush', desc: 'Bit-depth staircase shaper', param: 'Crush' },
  delay: { name: 'MM Delay', desc: 'Tempo-synced dotted-8th feedback delay', param: 'Mix' },
  chorus: { name: 'MM Chorus', desc: 'LFO-modulated short delay', param: 'Depth' },
  space: { name: 'MM Space', desc: 'Convolution room (generated IR)', param: 'Mix' },
  limiter: { name: 'MM Limiter', desc: 'Fast high-ratio compressor', param: 'Push' },
};

function wetDry(ctx, input, output, wetNode, amount) {
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  input.connect(dry); dry.connect(output);
  wetNode.connect(wet); wet.connect(output);
  const set = (a) => { dry.gain.value = 1 - a * 0.5; wet.gain.value = a; };
  set(amount);
  return set;
}

export function createFx(engine, type, amount = 0.5) {
  const ctx = engine.ctx;
  const input = ctx.createGain();
  const output = ctx.createGain();
  const nodes = [];
  let set = () => {};
  switch (type) {
    case 'comp': {
      const c = ctx.createDynamicsCompressor();
      const mk = ctx.createGain();
      input.connect(c); c.connect(mk); mk.connect(output);
      set = (a) => { c.threshold.value = -6 - a * 34; c.ratio.value = 2 + a * 10; c.attack.value = 0.008; c.release.value = 0.18; mk.gain.value = 1 + a * 0.9; };
      nodes.push(c, mk);
      break;
    }
    case 'eqlow':
    case 'filter': {
      const f = ctx.createBiquadFilter();
      f.type = type === 'eqlow' ? 'highpass' : 'lowpass';
      input.connect(f); f.connect(output);
      set = type === 'eqlow'
        ? (a) => { f.frequency.value = 20 * Math.pow(75, a); f.Q.value = 0.7; }
        : (a) => { f.frequency.value = 18000 * Math.pow(0.012, a); f.Q.value = 0.8 + a * 6; };
      nodes.push(f);
      break;
    }
    case 'drive':
    case 'crush': {
      const ws = ctx.createWaveShaper();
      const trim = ctx.createGain();
      input.connect(ws); ws.connect(trim); trim.connect(output);
      set = (a) => {
        const n = 2048; const curve = new Float32Array(n);
        if (type === 'drive') {
          const k = 1 + a * 24;
          for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; curve[i] = Math.tanh(k * x) / Math.tanh(k); }
          trim.gain.value = 1 / (1 + a * 0.8);
        } else {
          const steps = Math.max(2, Math.round(Math.pow(2, 8 - a * 6)));
          for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; curve[i] = Math.round(x * steps) / steps; }
          trim.gain.value = 0.9;
        }
        ws.curve = curve;
      };
      ws.oversample = '2x';
      nodes.push(ws, trim);
      break;
    }
    case 'delay': {
      const d = ctx.createDelay(2);
      const fb = ctx.createGain();
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass'; tone.frequency.value = 4500;
      d.delayTime.value = Math.min(1.9, engine.secondsPerBeat * 0.75);
      input.connect(d); d.connect(tone); tone.connect(fb); fb.connect(d);
      const mix = wetDry(ctx, input, output, tone, amount);
      set = (a) => { mix(a * 0.7); fb.gain.value = 0.25 + a * 0.4; };
      nodes.push(d, fb, tone);
      const onBpm = () => { try { d.delayTime.setTargetAtTime(Math.min(1.9, engine.secondsPerBeat * 0.75), ctx.currentTime, 0.05); } catch (_) {} };
      engine.on('bpm', onBpm);
      nodes.cleanup = () => engine.off('bpm', onBpm);
      break;
    }
    case 'chorus': {
      const d = ctx.createDelay(0.05);
      d.delayTime.value = 0.016;
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 0.8;
      lfo.connect(depth); depth.connect(d.delayTime);
      lfo.start();
      input.connect(d);
      const mix = wetDry(ctx, input, output, d, 0.5);
      set = (a) => { depth.gain.value = 0.001 + a * 0.005; mix(0.3 + a * 0.4); };
      nodes.push(d, lfo, depth);
      nodes.cleanup = () => { try { lfo.stop(); } catch (_) {} };
      break;
    }
    case 'space': {
      const conv = ctx.createConvolver();
      const sr = ctx.sampleRate; const len = Math.floor(sr * 1.3);
      const ir = ctx.createBuffer(2, len, sr);
      for (let c = 0; c < 2; c++) { const data = ir.getChannelData(c); for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
      conv.buffer = ir;
      input.connect(conv);
      const mix = wetDry(ctx, input, output, conv, amount);
      set = (a) => mix(a * 0.8);
      nodes.push(conv);
      break;
    }
    case 'limiter': {
      const c = ctx.createDynamicsCompressor();
      const mk = ctx.createGain();
      input.connect(c); c.connect(mk); mk.connect(output);
      set = (a) => { c.threshold.value = -1 - a * 11; c.ratio.value = 20; c.knee.value = 0; c.attack.value = 0.002; c.release.value = 0.08; mk.gain.value = 1 + a * 0.7; };
      nodes.push(c, mk);
      break;
    }
    default:
      input.connect(output);
  }
  set(amount);
  return {
    type, input, output,
    set,
    dispose() {
      try { nodes.cleanup?.(); } catch (_) {}
      [input, output, ...nodes].forEach((n) => { try { n.disconnect(); } catch (_) {} });
    },
  };
}

/** Manages insert chains per channel id ('master' | trackId). */
export function createInsertHost(engine) {
  const chains = new Map(); // id -> { items: [{uid,type,amount,bypass,fx}], src }

  function endpoints(id) {
    if (id === 'master') return { src: engine.masterEqHigh, dest: engine.analyser };
    const t = engine.tracks.find((x) => x.id === id);
    if (!t?.gainNode) return null;
    return { src: t.gainNode, dest: engine.masterGain };
  }

  function rewire(id) {
    const ch = chains.get(id);
    const ep = endpoints(id);
    if (!ch || !ep) return false;
    try { ep.src.disconnect(); } catch (_) {}
    ch.items.forEach((it) => { try { it.fx.output.disconnect(); } catch (_) {} });
    let node = ep.src;
    ch.items.filter((it) => !it.bypass).forEach((it) => { node.connect(it.fx.input); node = it.fx.output; });
    node.connect(ep.dest);
    ch.src = ep.src;
    return true;
  }

  function get(id) {
    if (!chains.has(id)) chains.set(id, { items: [], src: null });
    return chains.get(id);
  }

  return {
    list: (id) => get(id).items,
    add(id, type, amount = 0.5) {
      if (!engine.ctx || !FX_TYPES[type]) return null;
      const ch = get(id);
      if (ch.items.length >= 6) return null;
      const it = { uid: `fx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`, type, amount, bypass: false, fx: createFx(engine, type, amount) };
      ch.items.push(it);
      rewire(id);
      return it;
    },
    remove(id, uid) {
      const ch = get(id);
      const i = ch.items.findIndex((x) => x.uid === uid);
      if (i < 0) return;
      const [it] = ch.items.splice(i, 1);
      rewire(id);
      it.fx.dispose();
    },
    setAmount(id, uid, a) {
      const it = get(id).items.find((x) => x.uid === uid);
      if (it) { it.amount = a; it.fx.set(a); }
    },
    toggleBypass(id, uid) {
      const it = get(id).items.find((x) => x.uid === uid);
      if (it) { it.bypass = !it.bypass; rewire(id); }
      return it?.bypass;
    },
    /** After track rebuilds (project load), re-attach or drop stale chains. */
    sync() {
      [...chains.keys()].forEach((id) => {
        const ch = chains.get(id);
        const ep = endpoints(id);
        if (!ep) { ch.items.forEach((it) => it.fx.dispose()); chains.delete(id); return; }
        if (ch.items.length && ch.src !== ep.src) rewire(id);
      });
    },
  };
}
