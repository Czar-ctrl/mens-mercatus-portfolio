# Mens Mercatus Sound Deck

Original browser DAW by **Mens Mercatus** (gold `#F5C518` / black `#0A0A0A` / white `#F7F7F5`). Web Audio transport, timeline, mixer, **AI Producer**, in-house **Generate** (text-to-music / stems / continuation), demo stem split, 16-step beats, mic + vocal chain, VST slot rack (bridge stub), sample synth, FL user-pack import.

**Not affiliated with** Suno, Image-Line (FL Studio), Greysound, or any third-party AI DAW. User-owned packs/plugins only — no Image-Line redistribution. Suno link-out / API connector was **removed**; music generation is local Web Audio only.

## Portfolio path

Linked from the Mens Mercatus portfolio:

- Symlink: `mensmercatus-portfolio/apps/sound-deck` → `/workspace/mens-mercatus-sound-deck`
- Apps hub: `mensmercatus-portfolio/apps/index.html` → **Sound Deck** card
- Serve portfolio root and open `/apps/sound-deck/`

## Quick start (web)

```bash
cd /workspace/mens-mercatus-sound-deck
python3 -m http.server 8765
# http://localhost:8765/
```

Or via portfolio:

```bash
cd /workspace/mensmercatus-portfolio
python3 -m http.server 8765
# http://localhost:8765/apps/sound-deck/
```

## Feature map

| Panel | What it does |
|-------|----------------|
| **AI Producer** | Local assistant — BPM, drums, melody/bass/pad, make beat, arm record / vocal / VST / pack hints |
| **Generate** | In-house AI Music: text-to-music arrangement, stem generation, song continuation (Web Audio / local synthesis) |
| **Stems** | Demo DSP 4-band split (not Demucs) |
| **Beats** | 16-step kick/snare/hat/perc → timeline @ BPM |
| **Vocals** | Record → gate stub / HPF / comp / de-ess stub / reverb → bounce |
| **Mic** | Device picker, meter, arm monitor, record AudioBuffer clips (USB / condenser via interface) |
| **VST** | Insert slots per track + master; metadata + bridge stub (no in-browser native VST) |
| **Synth** | Prompt → one-shots |
| **FL Packs** | Multi-file / folder import of **user-owned** samples |
| **Transport** | Play/pause/stop, BPM, metro, loop, Demo, Save/Load/Export |

### Keyboard

- `Space` — play / pause  
- `S` — stop  

## Docs

- [ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [INTEGRATIONS.md](docs/INTEGRATIONS.md) — mic, VST bridge, FL packs, Generate (Suno removed)  
- [desktop/vst-bridge/](desktop/vst-bridge/) — Phase-2 native host contract  

## Limits (honest)

- Stem split = filter bands, not ML separation.  
- **Generate** = procedural multi-layer synth (kick/snare/hats, bass, pad, lead) — not a cloud foundation model or vocal singer.  
- Native VST requires desktop bridge (not in browser).  
- Gate / de-esser on Vocals are stubs; HPF/comp/reverb are live.  
- Electron Mac pack scripts exist as scaffold; use web first.

## Playable demo path (portfolio)

First open shows a tip: **Load Demo + Play** (or transport **Demo** → Space). Built-in drums/bass/keys/pad arrangement — Mens Mercatus Sound Deck only (not Greysound). Dismiss persists in `localStorage` key `mm-sound-deck-tip-dismissed`.
