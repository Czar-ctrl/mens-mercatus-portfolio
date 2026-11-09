# Phase-2 — Native VST Bridge

**Status:** Stub / IPC contract only. Browser Sound Deck cannot execute VST/VST3.

## Goal

Host **user-owned** VST3/CLAP plugins beside Electron Sound Deck. No Image-Line or third-party plugin redistribution.

## IPC contract

### Electron preload (`window.mmDesktop.vstBridge`)

```js
{
  available: boolean,
  loadPlugin({ channel, slot, path, name }) => Promise<{ ok, message }>,
  listPlugins() => Promise<Array<{ path, name }>>,
  bypass({ channel, slot, on }) => Promise<void>,
}
```

MVP preload returns `available: false` until the companion ships.

### Local companion HTTP (optional)

- `GET  http://127.0.0.1:17321/vst/health` → `{ ok: true }`
- `POST http://127.0.0.1:17321/vst/load` body `{ channel, slot, path, name }`

Client: `js/connectors/vst-bridge-client.js`.

## Security

Localhost only · user grants plugin folder access · never upload plugin binaries.
