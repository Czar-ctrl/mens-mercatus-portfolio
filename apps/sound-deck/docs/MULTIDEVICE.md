# SoundX multi-device (LAN)

Mac Mini hosts the SoundX deck + a small Node hub (HTTP + WebSocket on **port 8791**).
Phones join on the same Wi‑Fi.

## Quick start (Mac)

```bash
cd ~/Desktop/godmode/apps/sound-deck   # or your local checkout
cd server && npm install               # once
node multidevice-hub.mjs
```

Or from the deck root:

```bash
npm run hub
```

Printed URLs use your LAN IP (e.g. `192.168.43.137`).

### Firewall tip
Allow **incoming TCP 8791** on the Mac (System Settings → Network → Firewall → Options),
or temporarily disable the firewall while testing on trusted Wi‑Fi.

## Connect each device

| Device | Role | URL |
|--------|------|-----|
| **Mac Mini** | Host / full SoundX deck | `http://MAC_IP:8791/` (or Lab page + Connect hub in the gold bar) |
| **Android** | MPC pad controller | `http://MAC_IP:8791/controller/` |
| **Android / iPhone** | Mercatus Bot mic | `http://MAC_IP:8791/mic/` |

1. Start the hub on the Mac.
2. Open SoundX on the Mac from the hub URL so the **Multi-device** bar auto-connects as `host`.
3. On the phone, open the controller or mic URL (same Wi‑Fi). Optionally **Add to Home Screen** (controller is a PWA).
4. If the WS URL is wrong, paste `ws://MAC_IP:8791/ws` and tap Connect.

> Prefer serving controller/mic **from the Mac hub** (HTTP on LAN). Loading UI from HTTPS DreamHost and pointing WS at `ws://LAN` hits mixed-content blocks in mobile browsers.

## Protocol (WS `/ws`)

- `hello` `{ role: "host"|"controller"|"mic", name }`
- `pad` `{ pad, inst, midi, velocity }`
- `pattern` `{ patternId }` — e.g. `mm-trap`, `mm-house`
- `scene` `{ scene: 1..8 }` — Live Loops launch (public API only)
- `transport` `{ action: "play"|"pause"|"stop" }`
- `stt_text` / `stt_result` — voice transcript to host
- `mic_chunk` + `mic_end` — audio bytes for Mac STT stub

## DEMO vs LIVE

| Path | Status |
|------|--------|
| Pad hits → `previewNote` on Mac | **LIVE** (Web Audio) |
| Transport play/pause/stop | **LIVE** |
| Pattern / scene remote | **LIVE** (uses existing Beats / Live Loops APIs; does not edit `live-loops.js`) |
| Phone Web Speech → text → Voice Assist | **LIVE** text path when SpeechRecognition works |
| Audio → Mac whisper.cpp | **LIVE** only if `whisper-cli`/`whisper` + `ffmpeg` installed |
| Audio → Mac without whisper | **DEMO** labeled stub transcript |
| Ollama | Present for chat models; **no** native audio STT in default models |

## Layout

```
server/multidevice-hub.mjs   — hub
controller/                  — MPC PWA
mic/                         — phone mic page
js/modules/multidevice-host.js — SoundX host bridge
```
