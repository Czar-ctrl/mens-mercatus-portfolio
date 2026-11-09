# VST Bridge Protocol (draft)

| Message | Direction | Payload |
|---------|-----------|---------|
| `health` | client→host | — |
| `loadPlugin` | client→host | `{ channel, slot, path, name }` |
| `pluginLoaded` | host→client | `{ channel, slot, ok, error? }` |
| `bypass` | client→host | `{ channel, slot, on }` |
| `transport` | bidirectional | `{ bpm, playing, beat }` |

Channels: track id string or `"master"`. Slots: `0..n`.
