/**
 * Mens Mercatus Sound Deck — master FX facade.
 * Reverb is a ConvolverNode on the engine master bus (see AudioEngine._buildMasterBus).
 */
export class MixerFX {
  constructor(engine) {
    this.engine = engine;
  }

  get reverbEnabled() {
    return !!this.engine.reverbOn;
  }

  async ensureReverb() {
    await this.engine.init();
  }

  async setReverb(on) {
    await this.engine.init();
    this.engine.setMasterReverb(!!on);
  }

  getState() {
    return {
      reverbEnabled: this.reverbEnabled,
      masterVolume: this.engine.masterGain?.gain.value ?? this.engine._masterVol ?? 0.85,
      masterEq: { ...(this.engine.masterEq || { low: 0, mid: 0, high: 0 }) },
    };
  }
}
