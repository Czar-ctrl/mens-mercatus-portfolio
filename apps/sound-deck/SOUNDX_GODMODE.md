# SoundX God Mode

**Live:** https://mensmercatus.online/apps/sound-deck/  
**Cache stamp:** `20261007w23` (Wave 2 + 3; was `20261007gm` for Wave 1) — index.html, `js/main.js` imports, hub, barrels, feature modules  
**Spec / plan:** internal planning documents (Wave 1, Wave 2+3), kept in the repository and not published on the site.  

**60 tools:** Wave 1 creative (20) · Wave 2 workflow agents (20) · Wave 3 honest AI/ML/AGI desk (20).

Native Suno-class UX inside Mens Mercatus Sound Deck — **no Suno API**, no suno.com links, no cloud “generate a full song” claim. Everything runs on the shared Web Audio engine with local heuristics; optional Blueprint Assist only when `/health` is ok.

## How to use

1. Open https://mensmercatus.online/apps/sound-deck/ (hard-refresh once after deploy).
2. Click the **God Mode** tab → sub-tab **God Mode** (Labs still has Dice Forge / Tradingfloor Form).
3. Pick a wave (**Wave 1 · Wave 2 · Wave 3 · All**, remembered per browser) then search or scroll. Each card shows an honest **DEMO** or **LIVE** badge; W2/W3 cards carry a wave tag.
4. Configure the card, hit **Apply**. A session snapshot is taken first — use **Restore** (session versions) to undo.
5. Shortcuts also live on:
   - **Generate** — Prompt → Arrangement, Continue Clip, Intent Co-Pilot, AGI Desk
   - **Stems** — Stem Remix Desk, Key/BPM Lock Warp, Stem Colorist, Stem Role Classifier
   - **Transport** — Cinema Mix Modes, Vault Export Suite, Loop WAV (Export Loop Clip)
6. **Song view loop chrome** (above the ruler): ⏭ Song end (parks the playhead 1 bar before the last clip ends and scrolls there), Loop end 4 / 8, `{` In / `}` Out at the playhead, and section chips (Intro / Verse / Drop / Break / Outro — from clip names, else from bar activity) that set the loop region in one click. Drag the `{ }` braces on the ruler as before. An END marker and an energy heat strip (after Drop Finder / Energy Predictor) sit on the ruler.

## DEMO vs LIVE (honesty)

| Badge | Meaning |
|-------|---------|
| **DEMO** | Local Web Audio / rule-based / heuristic. No cloud ML. |
| **LIVE** | Blueprint Assist path when `GET /api/cartel/.../health` succeeds. Intent/parse only — never auto-emails or leaves SoundX. |
| **AUTO** | Resolves to LIVE or DEMO from the hub assist pill at mount time. |

Hub chrome shows a single assist pill (`DEMO` / `LIVE`) from `js/modules/god-mode/assist.js`. Cards that declare `badge: 'DEMO'` stay DEMO even if Assist is up. We never label features as “Suno” or “Grok cloud.”

## Feature table (all 20)

| # | ID | Feature | What it does | Badge |
|---|----|---------|--------------|-------|
| 1 | `prompt-arrangement` | Prompt → Arrangement | Text + genre → Drums / Bass / Chords / Lead skeleton at session BPM | DEMO |
| 2 | `continue-clip` | Continue Clip | Duplicate & lightly mutate the last clip on the selected track, offset by N bars | DEMO |
| 3 | `cover-remap` | Cover Remap | Restyle selected track via preset FX + pitch/rate tags | DEMO |
| 4 | `persona-voice` | Persona Voice | Named vocal character (EQ + delay + chorus) on Vocals / selected track | DEMO |
| 5 | `radio-seed` | Radio Seed | Endless generative radio from a mood seed at session BPM | DEMO |
| 6 | `stem-remix-desk` | Stem Remix Desk | Timeline clips as pads → mute/solo/gain → Remix tracks with auto-gain | DEMO |
| 7 | `hook-forge` | Hook Forge | 4 hook candidates from a 1–2 bar source — A/B via mute-solo | DEMO |
| 8 | `lyric-lattice` | Lyric Lattice | Syllable-aware lyric pad on an 8-bar grid, beat-synced flash | DEMO |
| 9 | `key-bpm-lock` | Key/BPM Lock Warp | Warp audio playbackRate + transpose MIDI toward session/Stem DNA | DEMO |
| 10 | `contrast-automator` | Contrast Automator | Intro→drop→bridge energy arc (volumes + optional master filter) | DEMO |
| 11 | `ghost-harmony` | Ghost Harmony | Muted chord pad under the lead from Stem DNA / session key | DEMO |
| 12 | `call-response` | Call & Response | Answering percussion fill from the last phrase length | DEMO |
| 13 | `scene-morph` | Scene Morph | Morph Live Loops scenes with stepped crossfade over N bars | DEMO |
| 14 | `one-shot-alchemy` | One-Shot Alchemy | Slice a buffer on transient peaks into Alchemy Pads one-shots | DEMO |
| 15 | `master-glue` | Master Glue Bus | One-knob DynamicsCompressor + soft Drive via inserts | DEMO |
| 16 | `session-dna-share` | Session DNA Share | Export portable DNA card (BPM, key, mood, pattern) as JSON | DEMO |
| 17 | `multidevice-pad-link` | Multi-Device Pad Link | Phone pads → desktop transport via existing hub bar | DEMO |
| 18 | `coproducer-godmode` | Co-Producer God Mode | Suggestion rail from local session rules — Apply is undoable | DEMO |
| 19 | `cinema-mix` | Cinema Mix Modes | Headphone / club / car / phone via master EQ + generated space IR | DEMO |
| 20 | `vault-export` | Vault Export Suite | Master WAV + optional stems + session JSON + DNA (sequential downloads) | DEMO |

## Wave 2 — workflow agents (20)

| # | ID | Feature | What it actually does |
|---|----|---------|-----------------------|
| 1 | `song-end-section-loop` | Song End & Section Loop | Card twin of the Song chrome: jump to song end, loop last 4/8 bars, In/Out braces, section chips → loop. |
| 2 | `link-pull-agent` | Link Pull Agent | Fetches a **direct audio-file URL** (CORS permitting, 80 MB cap) or a dropped file → decode → new track via `add_clip` buffer-ref. Streaming pages (YouTube/Spotify/SoundCloud/Apple/TikTok…) are refused. |
| 3 | `genre-morph-agent` | Genre Morph Agent | Hip-Hop/Boom-Bap/Trap/Amapiano/House → Afro Tech/Amapiano/Afro House/Gqom/House: BPM jump or ride, four-on-floor kick+clap, perc layers with genre swing, source-drum mute, genre FX. One batch. |
| 4 | `bar-jump-pad` | Bar Jump Pad | Pad grid of bars + markers (Start · { In · Out } · sections · End); tap = seek, Loop mode = loop from the tapped bar. |
| 5 | `loop-bookmark-shelf` | Loop Bookmark Shelf | Save named loop regions (localStorage) and recall from chips; “save all sections” in one tap. |
| 6 | `arrangement-scale` | Arrangement Scale | Scale song length ½×–2× keeping relative layout; note clips stretch, audio clips move but keep their length. |
| 7 | `drop-finder` | Drop Finder | Offline mixdown → per-bar RMS in the worker → top windows → loop; publishes the ruler heat strip. |
| 8 | `fill-autopilot` | Fill Autopilot | Conga/snare/tom/clap fills before every section change (+ song end) as re-renderable hit clips. |
| 9 | `stem-colorist` | Stem Colorist | Tints clips per role and applies a gentle per-role EQ character as ramped batch commands. |
| 10 | `swing-dial-ai` | Swing Dial AI | Groove templates (Trap/Amapiano/Afro Tech/House/Boom-Bap/Straight) — re-swings pattern clips and moves note/hit positions. |
| 11 | `reference-match-lite` | Reference Match Lite | Match loudness + rough tonal tilt to a dropped file or a clip; nudges master volume + shelves. |
| 12 | `phrase-slicer` | Phrase Slicer | Chop an audio clip into phrase pads on the beat grid; audition, then lay out original / reverse / shuffle / stutter. |
| 13 | `vocal-duck-conductor` | Vocal Duck Conductor | Ducks the beat under the vocal (telemetry envelope follower, or while vocal clips play) with attack/release. |
| 14 | `transition-glue` | Transition Glue | Synthesized riser + impact at every section change on an FX Transitions track. |
| 15 | `key-lock-choir` | Key Lock Choir | Diatonic harmony voices (3rd/5th/6th/octave) of a MIDI lead in the session key on a Choir track. |
| 16 | `bpm-ramp-ride` | BPM Ramp Ride | Bar-quantized tempo ride from → to over N bars without cutting audio (transport re-anchors). Engine clamps 40–240 BPM. |
| 17 | `mute-solo-storyboard` | Mute/Solo Storyboard | Save mute/solo/level scenes in slots A–D and flip between them (optionally on the next bar) as batches. |
| 18 | `export-loop-clip` | Export Loop Clip | Offline-bounce the `{ }` loop to WAV (normalize −1 dBFS) — download or drop onto a Loop Bounces track. |
| 19 | `session-diff` | Session Diff | Diff two snapshots (tempo, loop, tracks, levels, EQ, clips); apply only the ticked deltas from A or B. |
| 20 | `copilot-checklist` | Co-Pilot Checklist | Guided finish-the-song steps (groove → bass → sections → fills → transitions → drop → headroom → export) with Apply on each. |

## Wave 3 — honest AI / ML / AGI (20)

“AI/ML/AGI” here means **local heuristics, DSP analysis in a Web Worker, hand-weighted tables and validated agent batches** — no cloud models, no neural nets, no vocals generated.

| # | ID | Feature | Badge | What it actually does |
|---|----|---------|-------|-----------------------|
| 1 | `intent-copilot` | Intent Co-Pilot | AUTO | Text → local keyword router (or Assist parse when LIVE) → validated plan preview → Apply. “Clear agent FX” removes agent-added inserts. |
| 2 | `arrangement-critic` | Arrangement Critic | DEMO | 12 rules (length, contrast, intro/outro, transitions, fills, levels, bass, tempo pocket, drop) → score /100 with one-click fixes. |
| 3 | `genre-graph-router` | Genre Graph Router | DEMO | BFS over a hand-made genre graph (e.g. Hip-Hop → Amapiano → Afro Tech); one groove segment per hop + tempo ride + loop. |
| 4 | `stem-role-classifier` | Stem Role Classifier | DEMO | Solo offline render per track → 8 audio features (worker) → rule scores → role tags (+ reasons, editable). Tags live on clip meta. |
| 5 | `energy-predictor` | Energy Predictor | DEMO | Per-bar energy (0.7·RMS + 0.3·onset density), smoothed curve, peaks/valleys → loop, least-squares trend forecast of the next 4 bars. |
| 6 | `hook-likelihood-scout` | Hook Likelihood Scout | DEMO | Ranks 2/4/8-bar windows by repetition + energy + melodic features; Audition loops and plays a candidate. |
| 7 | `lyric-melody-sketch` | Lyric → Melody Sketch | DEMO | Syllabify lyrics → one note per syllable on a rhythm grid, contour in session key, stresses lifted, line ends resolve → notes clip. |
| 8 | `melody-lyric-slots` | Melody → Lyric Slots | DEMO | Melody clip → phrases → syllable slots (strong beats marked); live fit counter; saves syllables to the notes; lyric sheet .txt. |
| 9 | `reference-embed-match` | Reference Embed Match | DEMO | 9-number profile (loudness, crest, bands, onset rate, sustain, tempo, swing) for ref + mix, cosine similarity, matching plan (tempo, tilt EQ, limiter). |
| 10 | `style-memory-bank` | Style Memory Bank | DEMO | Save tempo/grooves/per-role mix/FX/master tone as named packs (localStorage, JSON export/import) → replay as one batch. |
| 11 | `auto-mix-balancer` | Auto-Mix Balancer | DEMO | Pre-fader RMS per track → fader trims to role targets (drums anchor, bass −2, vox +1, keys −5, fx −9 dB) + low-cut on masking tracks. |
| 12 | `transient-surgeon` | Transient Surgeon | DEMO | Onset detection → attack/sustain gain envelope (tighten / smear) on audio clips (new clip, original in snapshot); grid-tighten / humanize for MIDI. |
| 13 | `harmony-suggest-net` | Harmony Suggest Net | DEMO | Hand-weighted Markov table (afro / pop / soulful) conditioned on your last keys chord → next-chord probabilities → progression clip. Not a neural net. |
| 14 | `fill-generator-net` | Fill Generator Net | DEMO | Reads the previous bar's groove (density, syncopation, voices, swing) → 3 conditioned fill candidates → hit clips at each boundary. Procedural. |
| 15 | `vocal-presence-coach` | Vocal Presence Coach | DEMO | Vocal vs rest-of-mix band/crest/level analysis → low-cut + comp + presence/air EQ (+ keys mid dip) as one batch. |
| 16 | `crowd-reaction-sim` | Crowd Reaction Sim | DEMO | Club / radio / phone scores from weighted, visible factors (tempo pocket, low end, contrast, length, hook, vocal, intro, crest, bands). No audience data. |
| 17 | `session-autopilot` | Session Autopilot | DEMO | Visible 4-step agent: loop section → genre morph → safety pass → export loop WAV; one Restore point per mutating step; Stop button. |
| 18 | `diff-explain` | Diff Explain | AUTO | Plain-language summary of snapshot A → B + agent transaction log; “Rephrase” via Assist only when LIVE (text only). |
| 19 | `safety-fader` | Safety Fader | DEMO | Offline render peak → master trim to ceiling (+ MM Limiter); live guard names clipping tracks from AnalyserNode telemetry. |
| 20 | `agi-desk` | AGI Desk (honest) | AUTO | Chat that only builds validated batches you approve or opens registered tools (keyword search over all 60); refuses Suno/Udio, full-song cloud gen, voice clones, streaming rips. |

## Agent command protocol (SoundXCommandBatch 1.0.0)

Adapted from the Gemini DAW-agent chat for the browser: agents never mutate the session directly.

- `js/modules/god-mode/command-schema.js` — `makeBatch`, `validateBatch` (all-or-nothing: protocol_version, transaction_id, description ≤128, 1–64 commands, ranges, track/slot/fx existence, chain length ≤6, loop ≤ song length incl. clips added earlier in the batch). Error codes: BAD_BATCH, UNKNOWN_ACTION, TRACK_NOT_FOUND, SLOT_NOT_FOUND, FX_NOT_FOUND, OUT_OF_RANGE, BAD_TYPE, NOT_SUPPORTED, NOT_FOUND.
- Actions: `set_parameter` (amount/volume/pan/eq_*; 20 ms default ramp), `set_track_state` (volume_db/pan/mute/solo; master = volume_db), `insert_fx`, `remove_fx`, `set_loop_region`, `set_bpm` (+ `ramp_bars` tempo ride), `add_clip` (pattern / notes / buffer-ref; `create_track`).
- `command-exec.js` — `executeBatch` validates, then runs every command inside **one** `godApply` (one snapshot / Restore point); AudioParams ramp (no zipper/clicks); failed batches roll back inserts they added; `TX_LOG` + `sx-god:tx` event.
- Telemetry (`telemetry.js`) = read-only AnalyserNode taps sampled on rAF. Analysis (`analysis.js` → `analysis-worker.js`) = module Web Worker with main-thread fallback.
- Pattern / hit clips store small JSON (`god-pattern`, `god-hits`) and re-render on load / Restore.

## Known gaps (honest)

- Insert chains are not part of session snapshots: **Restore does not remove FX** an agent inserted. Use Intent Co-Pilot → *Clear agent FX* (removes every `_god` insert) or the Plugins rack.
- Audio clips are never time-stretched (Arrangement Scale / tempo changes move positions; pattern clips re-render at the new tempo).
- Buffer-only clips (Link Pull imports, Transient Surgeon output, loop bounces) survive Restore via an in-memory cache but not a page reload / project file.
- Engine `setBpm` clamps to 40–240 BPM; master fader max is 0 dB (agents hold at unity and warn).
- Safety Fader's offline render excludes master EQ/inserts (live meters include them); MM Limiter is a fast compressor, not a true-peak brickwall.
- Blueprint Assist `/health` currently answers 404 on the live host, so AUTO cards show **DEMO** and use the local router.
- Link Pull only works for direct audio files on hosts that allow CORS; otherwise drop the file.

## Architecture (quick)

```
God Mode tab
  └── js/modules/godmode-ideas.js → mountGodModeHub
        └── js/modules/god-mode/
              hub.js · registry.js · assist.js · apply.js · features.js
              + 20 Wave 1 feature modules
              wave2/ (20) · wave3/ (20) · command-schema/exec · telemetry · analysis(+worker)
              sections · genre-maps · roles · intent-router · audio-kit · w23-ui
  js/ui/song-loop-chrome.js — Song end / { } / section chips strip above the ruler
```

Shared services (no second audio graph): engine, inserts, Stem DNA, session-versions, Live Loops, export-audio. Every Apply goes through `godApply` → snapshot → mutator → toast; failure restores the snap when available.

## Deploy notes

- Remote root: `/home/dh_yrv4fw/mensmercatus.online/apps/sound-deck`
- Local checkout: `/workspace/mens-mercatus-sound-deck`
- After deploy, hard-refresh so `?v=20261007w23` loads hub, barrels and features.
- Shared singletons (registry, apply, command-*, telemetry, analysis, sections, roles, w23-ui …) are imported **unstamped** so there is one instance; stamped feature modules cross-import each other with the same `?v=20261007w23`.
- Tests: `node tests/godmode-w23-node.test.mjs`; headless: `PW=<playwright-core> node tests/godmode-w23-browser-smoke.cjs http://127.0.0.1:<port>/index.html`.
- Out of scope: Suno library import, neural TTS/singing models, separate `/apps/soundx-godmode/` app.
