# Integrations — Mens Mercatus Sound Deck

## Microphone input

- Uses `navigator.mediaDevices.getUserMedia({ audio })` and `MediaRecorder`.
- Works with **any browser-visible input**: built-in, **USB class-compliant** mics, and condensers connected through a class-compliant audio interface.
- Mic panel: device picker (after permission), input meter, arm monitor, record → `AudioBuffer` clip on selected track.
- Tip: disable speaker monitoring or use headphones to avoid feedback.

## Vocals chain

Order on bounce: optional soft **gate stub** → **high-pass** → optional **de-esser stub** (HF dip) → **compressor** → **convolver reverb** mix → timeline clip.

## VST / VST3

- Browser **cannot** execute native VST/VST3.
- VST Rack stores per-track + master insert **slots** (path/name metadata).
- Bridge client: `js/connectors/vst-bridge-client.js`
- Stub + IPC: `desktop/vst-bridge/README.md` and `protocol.md`
- Preload hook: `window.mmDesktop.vstBridge` (available: false until companion ships)
- Optional health: `http://127.0.0.1:17321/vst/health`

## FL Studio / sample packs

- **FL Packs** panel: multi-file + folder import of user-owned WAV/MP3/OGG/FLAC.
- Catalog with filter; drag or + to timeline.
- **Legal:** user-owned packs only. No Image-Line stock content redistribution.
- Native FL/VST hosting = Phase-2 bridge (see above), not this panel.

## Generate (in-house AI Music)

- Replaces the former Suno link-out / API connector. **No suno.com links, no Suno API calls.**
- Panel: `js/modules/generate.js` · helpers: `js/audio/generator.js`
- Tools (all offline in the browser via Web Audio oscillators / noise / envelopes):
  1. **Text-to-music** — prompt + genre/mood + bars → multi-layer arrangement (drums, bass, pad, lead) onto timeline tracks; samples added to library.
  2. **Stem generation** — drums / bass / melody / pad / fx from a short prompt onto a chosen or new track.
  3. **Song continuation** — uses session BPM + last clip end or playhead; appends N bars continuing harmony/rhythm feel.
- Honest limits: procedural synthesis, not a cloud foundation model, not vocal synthesis.

## Suno (removed)

- Previous `connectors/suno.js` usage (API key / Open Suno Studio) was removed from the UI.
- Stub file retained only to document the removal; use **Generate** instead.

## Greysound

Original Mens Mercatus codebase. AI Producer and Generate are local/rule-based. Do not copy proprietary Greysound assets or models.
