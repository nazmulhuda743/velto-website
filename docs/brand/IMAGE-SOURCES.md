# Homepage image sources

Status: **pending**. No stock photography has been imported yet. This environment's
network policy blocks the image libraries (unsplash.com, images.unsplash.com,
pexels.com, images.pexels.com), so every homepage image is still a marked MOCK frame.

## Rules

- Licensed stock only (Unsplash License / Pexels License or equivalent). Never hotlink: files are downloaded into `public/images/home/`.
- Stock photography is illustrative. Alt text describes what each photo shows and never presents stock people, outlets, tags or facilities as Velto's own staff, branches or SOP evidence.
- Replace with real Velto photography before launch wherever a section makes a factual claim about Velto's intake, tagging, QC, packaging, riders or outlets.

## Import workflow

1. Add one entry per slot to `docs/brand/image-imports.json`:
   `{ "slot": "hero", "download": "<direct image URL>", "page": "<photo page URL>", "platform": "Unsplash", "photographer": "<name>" }`
2. Run `node scripts/import-images.mjs`.
3. In `src/content/mock.ts`, set `src`, `width`/`height`, `alt`, `position` and `source` for that slot.
4. Record the photo in the table below.

## Sources

| File | Section | Source URL | Platform | Photographer |
|---|---|---|---|---|
| — | — | — | — | — |
