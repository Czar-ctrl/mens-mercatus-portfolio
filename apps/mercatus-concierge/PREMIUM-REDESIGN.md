# Maison Concierge — Premium Redesign (2026-10-07)

Blank-slate UI/UX overhaul of the Mercatus Concierge marketing site toward luxury hospitality × private-bank editorial. Functionality preserved; naming updated to **Mens Mercatus Blueprint**.

## Backup
- `_pre-premium-2026-10-07/` — prior `index.html`, `styles.css`, `pitch.css`

## Visual system
| Token | Value |
|-------|-------|
| Display | Cormorant Garamond (H1 / section titles / desk numbers) |
| Body | DM Sans |
| Micro | IBM Plex Mono (eyebrows, chrome labels only) |
| Charcoal | `#070708` / `#0E0E10` |
| Ivory | `#F4EFE6` |
| Champagne | `#C4A574` |
| Accent (Blueprints) | `#C8102E` — rare (primary CTA, mark, active underline) |
| Max width | ~1240px, generous padding |
| Panels | Soft glass (`backdrop-filter`), hairline borders, pill CTAs |

## What changed
- **Typography** — left Inter + Space Mono SaaS stack; serif display hierarchy
- **Palette** — charcoal / ivory / champagne; Blueprints red as accent only (not named “Blueprint”)
- **Nav** — sticky glass with hairline; serif mark; underline hover
- **Hero** — large split-line display H1; calmer gradients (champagne + faint accent)
- **Value / desks** — editorial tiles with large display numbers; glass pillars; more air
- **Pitch reel** — softer chrome, champagne glows, serif narration; video + Assist kept
- **CTA / footer** — serif headline; playbook PDF link; Mens Mercatus Blueprint credit
- **Motion** — CSS fade/rise (`.reveal`); respects `prefers-reduced-motion`
- **Naming** — “Blueprint” → “Mens Mercatus Blueprint” / “Blueprints” in marketing copy, meta, chrome, comments

## Preserved
- Assist expand / collapse / overlay (`script.js` IDs unchanged)
- Pitch video + `pitch-anim/` reel
- Nav anchors `#value` `#desks` `#cta`
- Open Concierge / Book walkthrough CTAs
- Cold-call playbook link (`docs/…pdf`)
- All desk + value content meaning

## Concierge app (light polish)
- `mensmercatus-portfolio/apps/makedas-canvas/styles.css` — root tokens nudged toward charcoal/ivory/champagne so the app shell doesn’t clash with the marketing site. No structural app rewrite.

## View
- Local: see `LIVE.txt` (port **8777**)

## Restored 2026-10-07
User asked for brown (pre-premium red/black/cream) back. Champagne shell saved in `_champagne-2026-10-07/`. Live path: `/apps/mercatus-concierge/` only.
