# Mercatus Lab Ops desk

**Status:** Polished local ops board — **zero SaaS**, powered by Mercatus Lab JSON on disk.  
**Date:** 2026-10-07 (Africa/Johannesburg)  
**Placement:** Admin / internal only — not a client-facing journey chapter. Discreet Close card + footer micro-link.

## Exact URL

| Environment | Path |
|-------------|------|
| **Primary (local)** | `http://127.0.0.1:8777/ops/lab.html` |
| **Site-relative** | `/ops/lab.html` |
| **Legacy redirect** | `/ops/clickup.html` → `lab.html` (old links) |
| **Anchor** | `ops/lab.html#ops-lab` |

**Reached from Concierge:** footer **“Ops · Lab”** · Close chapter one-line card **“Ops · Lab”** · optional Lab chapter context (`#lab` is the product chapter; ops desk is separate admin).

## Look

- Maison Concierge tokens: charcoal `#070708` / `#0E0E10`, ivory `#F4EFE6`, champagne `#C4A574`, Blueprints red `#C8102E`
- Luxury-minimal **kanban**: columns **Backlog · Doing · Done**
- List filters: Cold-call pipeline · DropNet follow-ups · Concierge build · Meeting Desk prep
- Banner: **Powered by Mercatus Lab (local)** — tasks from `ops/lab-tasks.json`; status moves cached in `localStorage`
- Chrome name: **Ops desk / Mercatus Lab Ops** (not ClickUp)

## Files

| Piece | Location | Role |
|-------|----------|------|
| Ops page | `ops/lab.html` | Kanban UI (noindex) |
| Desk script | `ops/lab-desk.js` | Load JSON, filters, drag/select status, localStorage |
| Task data | `ops/lab-tasks.json` | Local Lab seed (8 mock tasks) |
| Legacy URL | `ops/clickup.html` | Meta + JS redirect to `lab.html` |
| Styles | `styles.css` (Ops desk block) | Kanban + Close card + footer micro-link |
| Footer / Close | `index.html` | “Ops · Lab” + `ops-close-card` |

## Explicitly untouched

- DropNet apply modes / Careers Drop mode selector / apply-queue
- Pitch-video / automation 90s render
- Full journey chapter redesign (JOURNEY.md owned elsewhere) — only ops entry hooks

## Data model (lab-tasks.json)

```json
{
  "engine": "Mercatus Lab",
  "columns": ["backlog", "doing", "done"],
  "lists": ["Cold-call pipeline", "DropNet follow-ups", "Concierge build", "Meeting Desk prep"],
  "tasks": [{ "id", "name", "status", "list", "priority", "note" }]
}
```

Edit the JSON on disk to change the seed. Browser `localStorage` key `mercatus-lab-ops-v1` stores status overrides only (Reset board clears them).

## Legacy ClickUp scaffolding

`clickup/` client, proxy, and config examples remain on disk as historical scaffolding but are **not** wired into the polished UI. See `CLICKUP-INTEGRATION.md` (superseded notice).

## Brand

Mens Mercatus Blueprint / Maison Concierge. “Blueprint” avoided in ops UI strings.
