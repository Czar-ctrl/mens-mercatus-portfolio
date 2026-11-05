# After proof — portfolio preview

Date: 2026-11-05 (Africa/Johannesburg)
Branch: `code-shipyard/portfolio-preview`

## Commands run

| Check | Command | Result |
|---|---|---|
| Lint | `npm run lint` | pass (includes progressive-enhancement guard: no default `opacity: 0` on `.reveal`) |
| Content | `npm test` | pass (JobNet public drafts-only + private gated send) |
| Playwright e2e | `npm run test:e2e` | 6/6 pass — includes assertion that all 6 card headings are visible after load and after each filter toggle |
| axe WCAG 2 A/AA | inside e2e + `npm run proof:axe` | 0 violations (critical/serious); 25 passes |
| Page weight | `npm run proof:weight` | ~333 KB transfer (document+css+js+webp) |
| PDF export | `npm run proof:pdf` | `/workspace/portfolio-preview.pdf` |

## Screenshots (regenerated after reveal fix)

- `proof/after/screenshots/desktop-full.png` — visual inspection: all 6 project cards present
- `proof/after/screenshots/desktop-work.png` — visual inspection: filter bar + all 6 cards (JobNet, Assist, THINK, Forex Mercatus Codex, SoundX AI, Concierge); no blank Selected Work
- `proof/after/screenshots/mobile-full.png` — visual inspection: cards present in mobile stack

## Fix note (blocker)

Root cause: `.reveal { opacity: 0 }` hid cards until IntersectionObserver added `.is-in`. Below-fold / element screenshots captured invisible cards (PDF looked fine because export forced `.is-in`).

Fix: progressive enhancement — `.reveal` always `opacity: 1`; restrained rise animation only under `html.js-motion` + `prefers-reduced-motion: no-preference`. Content readable without scroll/JS.

## Lighthouse note

No Lighthouse CLI packaged here. Page-weight proxy used instead. Out of scope for this draft PR (no deploy).

## Skips / flags

- Silent video loops: skipped — no in-repo footage; WebP posters only.
- “Now building” logbook: omitted — no dated feed in-repo.
- Live marketing figures outside verified set flagged in the proof strip.
- JobNet: public = drafts only / no auto-apply; private = capped send only with printed verified employer address + quality checks.

## Preview locally

```bash
npm run preview
# http://127.0.0.1:4173
```
