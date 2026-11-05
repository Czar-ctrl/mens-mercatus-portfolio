# After proof — portfolio preview

Date: 2026-11-05 (Africa/Johannesburg)
Branch: `code-shipyard/portfolio-preview`

## Commands run

| Check | Command | Result |
|---|---|---|
| Lint | `npm run lint` | pass |
| Content | `npm test` | pass (JobNet public drafts-only + private gated send) |
| Playwright e2e | `npm run test:e2e` | 6/6 pass |
| axe WCAG 2 A/AA | inside e2e + `npm run proof:axe` | 0 violations (critical/serious); 25 passes |
| Page weight | `npm run proof:weight` | ~333 KB transfer (document+css+js+webp) |
| PDF export | `npm run proof:pdf` | `/workspace/portfolio-preview.pdf` |

## Screenshots

- `proof/after/screenshots/desktop-full.png`
- `proof/after/screenshots/desktop-work.png`
- `proof/after/screenshots/mobile-full.png`

## Lighthouse note

No Lighthouse CLI packaged here. Page-weight proxy used instead (local static transfer sizes). Full Lighthouse can be run later against a hosted preview if desired — out of scope for this draft PR (no deploy).

## Skips / flags

- Silent video loops: skipped — no in-repo footage; cards use compressed WebP posters from `apps/*/screenshots/`.
- “Now building” logbook: omitted — no dated feed in this repository.
- Live marketing figures outside verified set (e.g. “22 themes”, “87 MB on disk”) flagged in the proof strip, not amplified.
- JobNet: public = drafts only / no auto-apply; private = capped send only with printed verified employer address + quality checks.

## Preview locally

```bash
npm run preview
# http://127.0.0.1:4173
```
