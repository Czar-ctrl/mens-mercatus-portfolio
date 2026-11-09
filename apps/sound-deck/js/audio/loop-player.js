/**
 * Loop player — lookahead step scheduler for Pattern / Piano previews.
 * Uses the engine AudioContext + live engine BPM (re-read every tick so BPM edits apply).
 */
export function createLoopPlayer(engine, { getTotalSteps, stepBeats = 0.25, onStep, onPosition }) {
  let timer = null;
  let nextTime = 0;
  let step = 0;
  let out = null;
  const queue = []; // {step, when} for UI sync

  function tick() {
    const ctx = engine.ctx;
    if (!ctx) return;
    const total = Math.max(1, getTotalSteps());
    while (nextTime < ctx.currentTime + 0.12) {
      onStep(step % total, nextTime, out);
      queue.push({ step: step % total, when: nextTime });
      nextTime += stepBeats * engine.secondsPerBeat;
      step = (step + 1) % total;
    }
    while (queue.length && queue[0].when <= ctx.currentTime) {
      const q = queue.shift();
      onPosition?.(q.step);
    }
  }

  return {
    get playing() { return !!timer; },
    get output() { return out; },
    async start() {
      await engine.init();
      await engine.resume();
      if (timer) return;
      out = engine.ctx.createGain();
      out.gain.value = 0.9;
      out.connect(engine.masterGain);
      step = 0;
      queue.length = 0;
      nextTime = engine.ctx.currentTime + 0.05;
      timer = setInterval(tick, 25);
      tick();
    },
    stop() {
      clearInterval(timer);
      timer = null;
      queue.length = 0;
      if (out) {
        const o = out;
        try {
          o.gain.setTargetAtTime(0, engine.ctx.currentTime, 0.02);
          setTimeout(() => { try { o.disconnect(); } catch (_) {} }, 300);
        } catch (_) {}
      }
      out = null;
      onPosition?.(-1);
    },
  };
}
