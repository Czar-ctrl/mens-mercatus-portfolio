# SoundX · GarageBand-inspired features

Mens Mercatus Sound Deck (SoundX) — Live Loops-style grid, Virtual Drummer, Pedalboard FX, and Voice Assist · Mercatus Bot.

These are original SoundX UIs inspired by common DAW patterns (Live Loops grids, virtual drummers, stomp boxes). No Apple trademarks beyond the descriptive phrase “Live Loops-style”, and no GarageBand assets.

## Features

### 1. Live Loops-style grid (`js/modules/live-loops.js`)

- Tab: **Loops**
- Rows = Kick / Snare / Hats / Perc / Bass lanes; columns = 8 scene slots
- Click a cell to arm (gold rim); **Launch** a column header to trigger armed clips
- Playback uses the shared `createLoopPlayer` lookahead scheduler at session BPM
- Syncs kick/snare/hat/perc into the Beats panel; **Write scene → track** places one-shots on the selected timeline track
- Label: **Live Loops-style · DEMO**

### 2. Virtual Drummer (`js/modules/virtual-drummer.js`)

- Tab: **Drummer**
- Genre presets: House, Hip-Hop, Amapiano, Afrobeat, Rock, Electronic
- Intensity + Complexity sliders (local procedural / rule-based — not a cloud model)
- **Generate** fills Beats (via `setPattern`), optionally the Pattern rack, and can **Write to Drums track**
- **Apply genre BPM** nudges the engine transport
- Label: **DEMO AI drummer** (honest)

### 3. Pedalboard (`js/modules/pedalboard.js`)

- Tab: **Pedals**
- Stomp UI for Filter, Drive, Delay, Space (reverb), plus Comp / Chorus / Crush
- Wired to the shared `createInsertHost` from `js/audio/fx-inserts.js` (same Web Audio nodes as Plugins & Packs)
- **Attach to:** Master bus by default (documented in UI); can target any track
- Toggle footswitch = bypass; amount slider; add / remove / reorder (▲▼)
- Default stomps seed a 4-pedal chain (filter/drive/delay start bypassed; space ready)

### 4. Voice Assist · Mercatus Bot (`js/modules/voice-assist.js`)

- Tab: **Voice**
- Pipeline:
  1. **Capture** — Listen button (Web Speech API `SpeechRecognition` / `webkitSpeechRecognition`); chips work without mic
  2. **STT** — in-browser transcript shown live
  3. **Intent** — `POST` same-origin `/api/cartel/index.php?path=/api/mercatus-cartel/chat` when `/health` is ok (**LIVE**); else **LOCAL** keyword/regex parser (`parseLocalVoice`) with the same command set
  4. **Executor** — maps JSON/local commands onto SoundX: transport, Virtual Drummer, Pedalboard, Live Loops, demo load, bass stub
- Pill: **LIVE** vs **LOCAL** — never claims Grok cloud unless a Grok endpoint is actually wired (it is not; LIVE = Mercatus Blueprint Assist)
- Never auto-sends email or navigates away from SoundX

#### Example voice / chip commands

| Phrase | Action |
|--------|--------|
| play / stop / pause | Transport |
| set BPM 120 | `engine.setBpm` |
| make a beat | Virtual Drummer generate + write |
| switch to Amapiano | Genre + generate + genre BPM |
| turn up reverb / more delay / add distortion | Pedalboard FX |
| launch scene 1 / trigger loop | Live Loops |
| load demo | Demo arrangement |

## Wiring

- `index.html` — tabs/panes: Loops, Drummer, Pedals, Voice
- `js/main.js` — creates one shared `inserts = createInsertHost(engine)` on `engine.inserts`; mounts all four modules; passes inserts into Plugins & Packs
- `js/modules/beats.js` — now returns `{ setPattern, getPattern, writeToTrack }` for drummer/loops sync
- `css/app.css` — gold/black/white godmode chrome for grids, stomps, voice

## Deploy notes

Changed files under `apps/sound-deck` (symlink → `/workspace/mens-mercatus-sound-deck/`):

- `index.html`
- `css/app.css`
- `js/main.js`
- `js/modules/beats.js`
- `js/modules/live-loops.js` *(new)*
- `js/modules/virtual-drummer.js` *(new)*
- `js/modules/pedalboard.js` *(new)*
- `js/modules/voice-assist.js` *(new)*
- `js/modules/plugins-packs.js` (shared inserts hook)
- `SOUNDX_GB_FEATURES.md` *(this file)*

Existing Demo → Play path, transport, mixer, and Generate are untouched in behaviour.
