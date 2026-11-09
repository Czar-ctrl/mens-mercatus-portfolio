# Mac Mini — Install Mens Mercatus Sound Deck

Run the same Sound Deck UI as a native macOS window via Electron (gold / black / white Mens Mercatus chrome).

## Requirements

- Mac Mini (Apple Silicon or Intel) with **macOS 12+** recommended  
- **Node.js 20 LTS** (or 18+) from https://nodejs.org  
- Xcode Command Line Tools (`xcode-select --install`) if electron-builder asks for them  

## Option A — Dev run (fastest)

```bash
cd mens-mercatus-sound-deck
npm install
npm run electron
```

This opens an Electron window loading local `index.html` (Web Audio works offline after first load).

## Option B — Installable DMG / ZIP

On the **Mac Mini itself** (darwin build; cross-compiling macOS from Linux is not supported for signed DMGs):

```bash
cd mens-mercatus-sound-deck
npm install
npm run pack:mac
```

Artifacts land in `dist/`:

- `Mens Mercatus Sound Deck-x.y.z-arm64.dmg` (Apple Silicon) and/or  
- `Mens Mercatus Sound Deck-x.y.z-x64.dmg` / `.zip` (Intel), depending on machine arch  

Open the DMG → drag **Mens Mercatus Sound Deck** to Applications → launch.

### First launch Gatekeeper

If macOS says the app is from an unidentified developer (unsigned local build):

1. System Settings → Privacy & Security → allow the app, **or**  
2. Right-click the app → Open → confirm once  

For distribution outside your machines, add Apple Developer ID signing / notarization in `electron-builder` (`mac.identity`, notarize hook). Not configured in this MVP scaffold.

## Option C — Browser only (no install)

```bash
npm start
# open http://localhost:8765/
```

## Audio tips on Mac Mini

- Allow microphone/audio if the OS prompts (Sound Deck uses Web Audio output; mic not required for demo).  
- Use headphones to avoid monitoring feedback when testing.  
- Click **Demo** then **Play** (or Space) for the offline oscillator arrangement.

## VST / FL Studio

In-app FL panel imports **your** WAV folders only. Native VST hosting is **Phase 2** — see `desktop/vst-bridge/README.md`.

## Brand

Product: **Mens Mercatus Sound Deck** · Colors: gold `#F5C518`, black `#0A0A0A`, white `#F7F7F5`. Not affiliated with Greysound, Suno, or Image-Line.
