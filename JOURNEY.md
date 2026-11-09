# Mercatus Concierge — Portfolio Journey

**Role:** SKELLETON / narrative GUIDE shell — the front-door walkthrough of Mens Mercatus.  
**Not:** a new product silo or a pile of standalone apps under `/apps/`.

**Surface:** `/workspace/mercatus-concierge-site/` (local preview often `http://127.0.0.1:8777/`)  
**Portfolio Concierge entry:** `https://mensmercatus.online/apps/makedas-canvas/` — deep-links the same existing desks; does not invent new app folders.

**Look:** charcoal / ivory / champagne · Mens Mercatus Blueprint naming (not “Blueprint” in UI copy).  
**Ops:** Mercatus Lab Ops stays tucked at `ops/lab.html` (footer + Close micro-card) — not a journey chapter. Legacy `ops/clickup.html` redirects.

---

## Chapters

| # | Chapter | What visitors see | Status chip | Open live (existing URL only) |
|---|---------|-------------------|-------------|-------------------------------|
| 01 | **Arrive** | Hero: “Your digital footprint. One concierge.” Blueprints frame — Concierge as guide, not another silo. | — | Begin → `#assist`; Portfolio `https://mensmercatus.online/apps/` |
| 02 | **Assist** | Mercatus Assist / Blueprints robot stage | Up/Down via Blueprints `/health` (cache + CORS when allowed) | `https://mensmercatus.online/apps/mercatus-assist/` |
| 03 | **THINK** | Gemini multimodal workspace | Up/Down via `https://api.mensmercatus.online/think/api/health` | `https://mensmercatus.online/think/` |
| 04 | **Careers · DropNet / AI Hawk** | Daily leads desk; digest counts from `data/dropnet-latest.json` | Demo · lead counts (not fake green) | `https://mensmercatus.online/apps/drop-net/` (Careers Drop `#/drop`); JobNet `…/apps/jobnet/` |
| 05 | **Lab** | Mercatus Lab / God Eye / workstations | **Local** — honest Lab.app note | No public URL (local Mercatus Lab.app) |
| 06 | **Forex · Codex** | Paper desk | Up when API forex page reachable | `https://mensmercatus.online/apps/forex-codex/` · `https://api.mensmercatus.online/forex/` |
| 07 | **Sound Dex** | Browser DAW highlight | Demo | `https://mensmercatus.online/apps/sound-deck/` |
| 08 | **Blueprints LIVE** | Robot health | Up/Down from `https://api.mensmercatus.online/health` | Health JSON · Assist deep-link |
| 09 | **Close** | Cold-call leave-behinds | Leave-behind | Playbook PDF `docs/Mercatus-Concierge-Cold-Call-Pitch-Playbook.pdf` · Meeting Desk via `…/apps/makedas-canvas/` · mailto walkthrough |

Soft progress rail (desktop): numbered `#arrive` … `#close` anchors.

---

## Where each portfolio product appears

| Product | Journey chapter | Path / note |
|---------|-----------------|-------------|
| Mercatus Assist | 02 Assist, also 08 | `/apps/mercatus-assist/` |
| THINK | 03 THINK | `/think/` (not under `/apps/`) |
| DropNet / AI Hawk / Careers Drop | 04 Careers | `/apps/drop-net/` → Careers `#/drop`; digest snapshot in `data/dropnet-latest.json` |
| JobNet | 04 Careers (secondary) | `/apps/jobnet/` |
| Mercatus Lab / God Eye | 05 Lab | Local Lab.app only |
| Forex Mercatus Codex | 06 Forex | `/apps/forex-codex/` + API `/forex/` |
| Sound Dex (SoundX) | 07 Sound | `/apps/sound-deck/` |
| Blueprints robot (API health) | 08 Blueprints LIVE | `api.mensmercatus.online/health` |
| Meeting Desk + Concierge atelier | 09 Close | `/apps/makedas-canvas/` (Meeting Desk stage inside) |
| Cold-call playbook | 09 Close | `docs/Mercatus-Concierge-Cold-Call-Pitch-Playbook.pdf` |
| Mercatus Lab Ops | Footer + Close card | `ops/lab.html` — admin/ops, not journey (`clickup.html` redirects) |

---

## Status probing (lightweight)

1. **Same-origin cache:** `data/status.json` (refreshed by curling health endpoints from the box) + `data/dropnet-latest.json` (counts snapshot from portfolio Careers DropNet digest).
2. **Browser enrich:** when the page is served from an origin allowed by API CORS (e.g. `mensmercatus.online`), live `fetch` of `/health` and `/think/api/health` updates chips.
3. **Honesty:** Lab = Local; Sound/Close = Demo/Leave-behind; failed probes → “Open live” / Down — **never fake green**.

Refresh cache from the box:

```bash
# re-run the status snapshot helper used by agents, or:
curl -s https://api.mensmercatus.online/health
curl -s https://api.mensmercatus.online/think/api/health
```

---

## Hard rules (do not break)

- Do **not** add new standalone apps under `mensmercatus-portfolio/apps/`.
- Do **not** edit DropNet apply modes (`mm.careers.dropnet.applyMode`, Careers Drop mode selector).
- Do **not** touch `pitch-video/automation/` (90-second render).
- Do **not** promote Lab Ops into a new journey chapter (footer / Close hook only).

---

## Files

| File | Role |
|------|------|
| `index.html` | Journey chapters 01–09 |
| `styles.css` | Luxury tokens + journey rail / chips |
| `script.js` | Assist overlay + status + rail sync |
| `data/status.json` | Probe cache |
| `data/dropnet-latest.json` | Careers digest counts |
| `ops/clickup.html` | Tucked ops desk |
| `JOURNEY.md` | This document |
