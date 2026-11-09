# Portfolio preview (local)

Static, reviewable Mens Mercatus / Blueprint / MM seal portfolio page built from this showcase repository’s real screenshots and verified claims.

## Serve locally

```bash
npm run preview
# open http://127.0.0.1:4173
```

Or:

```bash
cd preview && python3 -m http.server 4173
```

## Notes

- No silent video loops: none existed in this repository, so cards use compressed poster WebP derived from `apps/*/screenshots/`.
- “Now building” logbook omitted: no dated build feed lives in this repo, so a fabricated logbook would invent claims.
- Guided walkthrough: Concierge link only (already present as the guide shell).
- Not a production deploy; do not point DNS or hosting at this folder.
