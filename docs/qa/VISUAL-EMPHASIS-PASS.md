# Visual emphasis pass

Branch: `claude/velto-visual-emphasis-pass` (from `claude/velto-public-cro-final-pass`, PR #22).

Goal: better attention control, not more decoration. Every viewport should answer: what do I notice first, what do I understand second, what do I do next.

Approved batch: H1, H2, H3, H5, H7, H9, S1, S3, S4, S5, S8.
Held for second review: H4, H6, H8, S6, S7.

## The emphasis rule (S8)

1. **At most one highlighted phrase or idea per section.** Highlight means Velto blue text or a larger size. If two things compete, neither is highlighted.
2. **Eyebrow labels** (`Eyebrow` in `SectionIntro.tsx`) are the one small blue label above an H2. They name the section and aren't a second highlight. Colour: `text-action` (#0078BC, AA at 13px). `text-blue` (#027CC3) is only for large type.
3. **Important operational numbers get larger type:** 5.0, 1–18, ~72h, ৳499+ in the hero, and prices in results. They're plain figures with a small label under each. No badges, pills or KPI cards.
4. **One primary button per view.** Secondary actions are outline buttons, or text links when a primary is already dominant (e.g. WhatsApp in the final CTA).
5. **Don't state the same proof twice in one viewport.** The hero figures replaced the hero proof list, and the marquee strip under the hero was retired.

## What changed

| Item | Change | Files |
|---|---|---|
| H1 | Hero proof as four figures: `5.0★` Google rating, 100+ reviews · `1–18` Uttara sectors · `~72h` usual time for Dry Cleaning and Wash & Iron · `৳499+` free pickup & delivery. All values come from config (`getGoogleProof`, `SERVICE_SECTORS`, `USUAL_TURNAROUND_HOURS`, `FREE_DELIVERY_THRESHOLD`). The rating is the Sector 11 profile only and falls back to "100+ Google reviews". Screen readers get full wording ("Usually around 72 hours"). | `Hero.tsx`, `site.ts`, `site-content.ts` |
| H2 | Only "pickup from your door" is in Velto blue. Wording unchanged. | `Hero.tsx` |
| H3 | Eyebrows: Services, After pickup, Customer proof, Locations, Pricing, Household care, Regular laundry, Questions. The final CTA has none, on purpose. Pricing page: Choosing a service, Household care. | `SectionIntro.tsx`, home sections, `FAQ.tsx`, `pricing/page.tsx` |
| H5 | The review carousel is replaced by a static editorial grid (spec §20: no carousel). Source comes first (`GOOGLE · SECTOR 11` + stars), then a verbatim pull line, then "Read the full review", then name + "See it on Google". Pull lines are exact substrings of the review text and are only rendered if they still match character for character. The same component is used on service pages. | `ReviewsSection.tsx`, `mock.ts` |
| H7 | Final CTA: one large Book a Pickup, helper "Send the request. We'll confirm the pickup time with you.", then WhatsApp as a text link. The proof list is reduced to one quiet line. Quote-first service pages get a quote helper. | `FinalBookingCTA.tsx`, `ServicePage.tsx` |
| H9 | `ProofMarquee` and the `Marquee` primitive and CSS are removed. | homepage, `globals.css` |
| S1 | "At a glance" band under every service hero: Pricing · Turnaround · Pickup · Best for. It restates facts already on each page (former hero facts, `overviewFact`, `whenToChoose`). The hero fact list it replaces is removed so nothing repeats. | `services.ts`, `ServicePage.tsx` |
| S3 | Price results: large price (26–30px) on the right, unit ("per sq ft") under it, a one-line description of what each service covers under the service name, "On request" explained once. Descriptions are shared with the service comparison. | `PriceFinder.tsx`, `service-summaries.ts`, `ServiceCompare.tsx`, `ServicePriceTable.tsx` |
| S4 | The booking form is four groups, so it's shown as `1 What · 2 Where · 3 When · 4 You`. There's a progress rule that fills as each group is answered, and numbered group headings. No backend change. The desktop live summary was not built: the progress row gives the same clarity without extra UI. | `BookingForm.tsx` |
| S5 | A found order leads with the current status at H1 size, its meaning, and "Expected back", then the timeline and facts. Not-found and error stay generic. API and security are untouched. | `TrackOrder.tsx` |

## QA

Widths: 1440, 1024, 390, 360. Before shots come from the CRO commit (`5b9fec5`, via a worktree) and after shots from this branch. Pairs are in `docs/qa/visual-emphasis/` (`before-*.png` / `after-*.png`).

- No horizontal overflow and no page errors at any width, for the homepage, a service page, pricing, book and track.
- lint, typecheck, `test:foundation` (12/12) and `test:security` pass. `test:launch` passes on a production build (21 routes).
- The tracking "found" state was captured by stubbing `/api/track` in the browser. No code or API change.
- Mock pricing has no amounts, so the committed pricing shot shows "On request". The large-price layout was checked locally with dummy amounts, which aren't committed so no invented price appears in the repo.

## Known trade-offs

- **Mobile first viewport:** the hero figures sit above the image, so at 390×844 the image now starts below the fold. Before, it peeked in. The proof is now inside the first screen, which spec §20 put partly under the image. This is intentional under H1, but it's a deviation from the locked mobile order.
- The "At a glance" values are all the same weight, on purpose: no single one is the section highlight.
