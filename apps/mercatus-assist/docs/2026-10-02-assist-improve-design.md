# Mercatus Assist improve — 2026-10-02

User-approved order: Phase 1 → Phase 2 → Phase 3.

## Goals

Make the portfolio Assist page feel usable on first open (no stuck welcome), put the chat panel first, keep DEMO vs live honest, enrich canned coaching, and best-effort the ASP.NET live path without inventing API keys.

Brand: Mens Mercatus gold/black/white; Blueprint red `#c8102e`. JobNet stays JobNet. No Greysound.

## Phase 1 — First open + layout

| Change | Detail |
|--------|--------|
| Welcome gate | Portfolio `index.html` calls `mountRobot` directly (no `mountWelcome`). Robot client still exports `mountWelcome(onDone, opts)` with `opts.skipWelcome` and `sessionStorage mm_welcome_seen` for Event / raw shell. |
| Layout | Chat column primary (wider, taller `min(720px, 78vh)` on desktop); cards + disk meta secondary. Sticky chat on wide viewports. |
| Empty center | Intro strip above chat + DEMO greeting + suggested prompt chips (not a lone red mark). |
| Favicon | `favicon.svg` (Blueprint bullseye) linked from the page; alt link to wheat mark. |
| Status pill | Accurate DEMO / mixed (API up, chat DEMO) / LIVE classes. |

## Phase 2 — Smarter DEMO

`demo-assist.js` keyword/intent table (not an LLM claim), all replies prefixed `DEMO ·`:

- What Assist won’t do / hard limits  
- KYC / POPIA / SA ID redact  
- Event signup gates  
- Rate lock / NMW / 4-hour rule  
- Check-in/out  
- Payout / Netza / dispute / no-show  
- Close-friends ping consent  
- NLTA goods vs passenger  
- Diagrams / schematics  
- Skills ladder, vehicle checklist  
- Backend / live path  
- JobNet (sister app pointer)  
- Brand (gold/black/white + Blueprint red)

Fetch to `/api/mercatus-cartel/*` tries live first; on failure returns canned JSON so the UI stays fluid.

## Phase 3 — Live path (best-effort)

| Check | Result (2026-10-02) |
|-------|---------------------|
| `dotnet` on PATH | **Not found** — cannot run backend on :5080 |
| `Llm:ApiKey` | Empty in `appsettings.json` (unchanged; do not invent) |
| CORS | Added `http://127.0.0.1:8765` and `http://localhost:8765` in `Program.cs` for when SDK exists |

When SDK is available:

```bash
cd apps/mercatus-assist/backend
ASPNETCORE_URLS=http://127.0.0.1:5080 dotnet run
# set Llm:ApiKey or Llm__ApiKey, then reload Assist page
```

Without a key, `/health` may go live while chat remains DEMO (pill: mixed).

## Paths touched

- `/workspace/mensmercatus-portfolio/apps/mercatus-assist/index.html`
- `/workspace/mensmercatus-portfolio/apps/mercatus-assist/demo-assist.js`
- `/workspace/mensmercatus-portfolio/apps/mercatus-assist/favicon.svg`
- `/workspace/mensmercatus-portfolio/apps/mercatus-assist/README.md`
- `/workspace/mensmercatus-portfolio/apps/mercatus-assist/docs/2026-10-02-assist-improve-design.md`
- `/workspace/mercatus-cartel/robot/frontend/mercatus-cartel-robot.js` (+ Lab `02-mercatus-cartel` mirror)
- `/workspace/mercatus-cartel/robot/backend/Program.cs` CORS (+ Lab mirror)
- Lab twin: `/workspace/Masticators Lab/01-portfolio/mensmercatus-portfolio/apps/mercatus-assist/` (copied files)

## Success criteria

- Phase 1 + 2: done  
- Phase 3: blocked on missing `dotnet`; documented; CORS prepared  
- Reload: `http://127.0.0.1:8765/apps/mercatus-assist/`

## Live polish pass (same day)

- Assist cards on home / apps hub / Blueprint brought to Canvas-grade copy + meta.
- Hub keeps **six** teasers (Assist as 6th); `daily-pipeline.json` + `hub-pipeline.js` fallback aligned.
- Ambient + red cursor: live site already wired; Lab twin gained `ambient-bg.css/js`, cursor sync, and ambient on contact/vault/event/app stubs.
- New `raw-shell.html` — portfolio-correct chat shell (ambient + cursor, no welcome). `frontend/index.html` remains Blueprint-depth (background 404 under :8765).
- DEMO pill defaults to `DEMO · checking API…` before health probe.

## Guided DEMO tour (depth pass)

- Tour bar: Start / Next / Reset + 6 step chips (signup → rate → KYC → check-in → payout → limits)
- Starter chips expanded; `▶ Start DEMO tour` jumps to step 1
- Still honest DEMO keyword coaching — no live LLM claim
