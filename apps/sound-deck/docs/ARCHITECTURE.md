# Architecture — Mens Mercatus Sound Deck

Static ES-module app. No backend required for the MVP.

## Layout

```
left: Library | center: Timeline | right: AI / connectors | bottom: Mixer
top: Transport | footer: Status
```

## Module diagram

```mermaid
flowchart TB
  subgraph UI
    Transport[ui/transport.js]
    Timeline[ui/timeline.js]
    MixerUI[ui/mixer.js]
    CoProd[modules/ai-producer.js]
    Stems[modules/stems.js]
    Synth[modules/sample-synth.js]
    Generate[modules/generate.js]
    FL[connectors/fl-studio.js]
  end

  subgraph Audio
    Engine[audio/engine.js]
    MixerFX[audio/mixer.js]
  end

  main[main.js] --> Transport
  main --> Timeline
  main --> MixerUI
  main --> CoProd
  main --> Stems
  main --> Synth
  main --> Generate
  Generate --> GenHelpers[audio/generator.js]
  main --> FL
  main --> Engine
  main --> MixerFX

  Transport --> Engine
  Timeline --> Engine
  MixerUI --> Engine
  MixerUI --> MixerFX
  CoProd --> Engine
  Stems --> Engine
  Synth --> Engine
  Generate --> Engine
  FL --> Engine

  Engine --> WA[Web Audio API]
  MixerFX --> WA
```

## Audio graph (per track)

```mermaid
flowchart LR
  Src[BufferSource / Oscillator] --> EQLow[Lowshelf]
  EQLow --> EQMid[Peaking]
  EQMid --> EQHigh[Highshelf]
  EQHigh --> Pan[StereoPanner]
  Pan --> Gain[Track Gain]
  Gain --> Master[Master Gain]
  Master --> Dest[Destination]
```

## Responsibilities

| Module | Role |
|--------|------|
| `audio/engine.js` | Context, transport clock, tracks/clips, scheduling, demo buffers, project JSON |
| `audio/mixer.js` | Optional convolver stub / FX state |
| `ui/transport.js` | Transport chrome, save/load/export |
| `ui/timeline.js` | Track lanes, clips, drag/drop from library |
| `ui/mixer.js` | Channel strips bound to engine params |
| `modules/ai-producer.js` | Local regex/intent replies |
| `modules/stems.js` | OfflineAudioContext band split |
| `modules/sample-synth.js` | Prompt → recipe → buffer library |
| `modules/generate.js` | Text-to-music / stems / continuation (Web Audio) |
| `audio/generator.js` | Scales, drum patterns, phrase helpers |
| `connectors/fl-studio.js` | User file/folder decode → library |

## Project state

Serialized via `engine.toJSON()` / `fromJSON()`:

- BPM, loop, metronome  
- Tracks: name, type, mute/solo, volume, pan, EQ  
- Clips: timing, color, `recipe` / `notes` (AudioBuffers rebuilt on load)

Persisted to `localStorage` key `mm-sound-deck-project` or downloaded as `.json`.


## Additional panels (MVP+)

| Module | Role |
|--------|------|
| `modules/ai-producer.js` | Local order-taking assistant |
| `modules/stems.js` | Demo DSP band split |
| `modules/beats.js` | 16-step sequencer → clips |
| `modules/mic.js` | getUserMedia record |
| `modules/vocals.js` | Vocal record + FX bounce |
| `modules/vst-rack.js` | Insert slot UI + bridge client |
| `connectors/fl-studio.js` | User pack import |
| `connectors/vst-bridge-client.js` | Bridge probe/load |
| `modules/generate.js` | In-house Generate panel |
| `audio/generator.js` | Shared synthesis helpers |
| `connectors/suno.js` | Removed stub (no UI) |
