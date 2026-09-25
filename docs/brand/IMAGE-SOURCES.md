# Homepage image sources

Status: **imported**. 12 licensed stock photos from Pexels plus 5 owner-supplied photos (marked ²), downloaded into `public/images/home/`. Nothing is hotlinked.
Data and alt text live in `src/content/mock.ts` (`IMAGES`). The import manifest is `docs/brand/image-imports.json`.

## Licence

All images are used under the [Pexels License](https://www.pexels.com/license/): free for commercial use, no attribution required, and modification allowed. It prohibits selling unaltered copies and implying endorsement by the people shown.
Credit is recorded here anyway, for provenance.

## Trust rule

These are illustrative stock photos, **not documentary evidence of Velto**. Alt text describes what each photo shows and never presents the people, places, tags or facilities in them as Velto staff, outlets or SOPs.
Before launch, replace them with real Velto photography wherever a section makes a factual claim about Velto's intake, tagging, QC, packing or riders.

The two **location** images (Sector 11 and Sector 18) are deliberately left as marked placeholders. Those blocks name real Velto outlets, so a stock storefront would misrepresent them.

## Why Pexels only

Unsplash is behind Anubis/BotStopper bot protection, which denied automated access, so no Unsplash images were used.
Candidates were found through web search for Pexels photo IDs, reviewed as contact sheets, and downloaded from the Pexels image CDN.
Where possible the set was drawn from a few coherent shoots, so colour temperature and realism match:
- Tima Miroshnichenko (tailoring)
- Polina Tankilevitch (folded garments on navy)
- Mikhail Nilov (doorstep delivery)
- cottonbro studio (ironing)

## Sources

| File | Section | Source URL | Platform | Photographer |
|---|---|---|---|---|
| `public/images/home/hero.webp` | Hero | — | Supplied by Velto (2026-09-25) | Origin/licence to confirm ² |
| `public/images/home/dry-cleaning.webp` | Service chooser — Dry Cleaning | — | Supplied by Velto (2026-09-25) | Origin/licence to confirm ² |
| `public/images/home/wash-and-iron.webp` | Service chooser — Wash & Iron | — | Supplied by Velto (2026-09-25) | Origin/licence to confirm ² |
| `public/images/home/ironing.webp` | Service chooser — Ironing | — | Supplied by Velto (2026-09-25) | Origin/licence to confirm ² |
| `public/images/home/household-curtains.jpg` | Service chooser — household group (curtains) | https://www.pexels.com/photo/6619046/ | Pexels | Thirdman |
| `public/images/home/household-section.jpg` | Curtains, carpets & bedding section | https://www.pexels.com/photo/7217758/ | Pexels | Blue Bird ¹ |
| `public/images/home/process-01-collected.jpg` | Process 01 — Collected | https://www.pexels.com/photo/6969971/ | Pexels | Mikhail Nilov ¹ |
| `public/images/home/process-02-received.jpg` | Process 02 — Received & identified | https://www.pexels.com/photo/6764934/ | Pexels | Tima Miroshnichenko ¹ |
| `public/images/home/process-03-tagged.jpg` | Process 03 — Tagged | https://www.pexels.com/photo/11485130/ | Pexels | Andrzej Gdula |
| `public/images/home/process-04-checked.jpg` | Process 04 — Checked before cleaning | https://www.pexels.com/photo/6764947/ | Pexels | Tima Miroshnichenko ¹ |
| `public/images/home/process-05-finished.jpg` | Process 05 — Cleaned & finished | https://www.pexels.com/photo/5901623/ | Pexels | cottonbro studio ¹ |
| `public/images/home/process-06-qc.jpg` | Process 06 — Checked before packing | https://www.pexels.com/photo/3965552/ | Pexels | Ksenia Chernaya ¹ |
| `public/images/home/process-07-packed.jpg` | Process 07 — Packed for return | https://www.pexels.com/photo/4440571/ | Pexels | Polina Tankilevitch ¹ |
| `public/images/home/process-08-returned.jpg` | Process 08 — Returned to you | https://www.pexels.com/photo/6969968/ | Pexels | Mikhail Nilov ¹ |
| `public/images/home/delicate.jpg` | Process — delicate garment insert | https://www.pexels.com/photo/6764932/ | Pexels | Tima Miroshnichenko ¹ |
| `public/images/home/regular.webp` | Regular laundry | — | Supplied by Velto (2026-09-25) | Origin/licence to confirm ² |
| `public/images/home/final.jpg` | Final booking | https://www.pexels.com/photo/4440572/ | Pexels | Polina Tankilevitch ¹ |

## Internal-page images (public/images/pages)

Added in the public visual pass (2026-09-25). They are licensed Pexels stock under the same licence and trust rule, downloaded once from the Pexels CDN and optimised to WebP. Nothing is hotlinked. Data and alt text live in `src/content/mock.ts` (`pageStock`).

| File | Used for | Source URL | Photographer |
|---|---|---|---|
| `public/images/pages/bedding-folded.webp` | Blankets & Comforters hero, homepage household row | https://www.pexels.com/photo/11125918/ | Qiana Zhang |
| `public/images/pages/bedding-linen-stack.webp` | Blankets & Comforters, "How a bedding order is handled" | https://www.pexels.com/photo/31902663/ | chikawaztla |
| `public/images/pages/carpet-woven.webp` | Carpet Cleaning hero, homepage household row | https://www.pexels.com/photo/35964344/ | Thomas Parker |
| `public/images/pages/express-shirt-hanger.webp` | Express hero | https://www.pexels.com/photo/9594952/ | Ron Lach |
| `public/images/pages/finished-shirts-rail.webp` | About hero | https://www.pexels.com/photo/17293343/ | nguyendesigner |

The photographer names come from the Pexels search listing. Confirm them on each source page before relying on the credit.

Still intentionally image-free (no suitable honest image): the Sector 11 and Sector 18 outlets (they show a typographic plate until a real outlet photo is uploaded), the curtain quote-process block, and the closing CTA on internal pages. See `docs/brand/REAL-PHOTO-SHOT-LIST.md`.

² Supplied directly by the Velto owner in September 2026 to replace the Pexels photos in these five slots. The owner should confirm where each image came from and that Velto may use it commercially. Several look AI-generated; if so, record the tool and its licence terms here.

¹ The photographer is inferred from the rest of the same Pexels shoot (neighbouring photo IDs whose credit was confirmed in search results). Confirm it on the source page before relying on the credit.

## Replacing with real Velto photography

Drop the new file into `public/images/home/`. Then, in `src/content/mock.ts`, update that slot's `src`, `width`/`height`, `alt`, `position` and `source`, and update this table.
