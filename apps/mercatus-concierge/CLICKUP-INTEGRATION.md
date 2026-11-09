# ClickUp integration — superseded by Mercatus Lab Ops

**Status:** **Superseded 2026-10-07.** Concierge Ops is now **Mercatus Lab** (local JSON), not ClickUp.

| Was | Now |
|-----|-----|
| `ops/clickup.html` | Redirect → **`ops/lab.html`** |
| Footer “Ops · ClickUp” | **“Ops · Lab”** |
| Token / team id / proxy | **Removed from polished UI** — zero SaaS |
| Mock ClickUp tasks | **`ops/lab-tasks.json`** |

## Where to go

→ **[`OPS-DESK.md`](./OPS-DESK.md)** — look, URL, data, Concierge entry points.  
→ **Live desk:** `http://127.0.0.1:8777/ops/lab.html`

## Legacy folder

`clickup/` (`client.js`, `proxy-server.js`, `config.example.json`, `desk.js`, `mock-tasks.json`) is retained only as optional historical scaffolding. The polished ops page does **not** load these scripts.

Do not reintroduce ClickUp chrome, API tokens, or connector banners on the Concierge ops desk unless product explicitly revives a SaaS sync later.
