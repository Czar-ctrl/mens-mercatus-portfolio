# Surge XT notes (SoundX)

**Source:** [surge-synthesizer.github.io](https://surge-synthesizer.github.io/) — **Surge XT**, a free open-source hybrid synthesizer plugin (JUCE-based, native VST3/AU/CLAP/LV2).

## What it is

- Full-featured **desktop plugin** synth (wavetable / FM / analog-ish / effects rack).
- Native C++ / JUCE — not a Web Audio library and not a DAW.

## Verdict for SoundX

**SKIP a deep port.** SoundX is a browser **Web Audio DAW** (timeline, mixer, Live Loops-style grid, stems, export). Reimplementing Surge XT’s DSP and modulation matrix in JS/WASM would be a multi-month product of its own, not a Sound Deck feature pack.

## Optional later inspiration only

- Modulation UX patterns (macro knobs, matrix overview).
- Wavetable “scene” switching metaphors — already closer to Live Loops than to Surge’s engine.

Do **not** claim SoundX “includes Surge” or ship Surge trademarks/assets. Native VST hosting remains the existing desktop bridge path (`desktop/vst-bridge`), which can load Surge XT on the user’s machine if they install it — that is hosting, not a port.
