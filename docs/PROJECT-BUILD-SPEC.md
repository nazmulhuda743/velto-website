# Velto Premium Laundry — Project Build Specification

> **SOURCE OF TRUTH FOR IMPLEMENTATION**
>
> Project: Velto Premium Laundry
> Status: Active Build
> Strategy: LOCKED
> Homepage strategy: LOCKED
> Homepage architecture: LOCKED
> Homepage copy: LOCKED
> Trust strategy: LOCKED
> Design system: LOCKED
> Current build phase: Homepage implementation
> First implementation target: HOMEPAGE ONLY

This file is the implementation source of truth for the Velto website rebuild. The build agent must read this file completely before planning, editing code, adding dependencies, or making implementation decisions.

Do not independently reopen or reinterpret decisions marked LOCKED. If implementation reveals a genuine contradiction or technical blocker, flag it instead of silently changing the approved direction.

---

## 1. Project purpose

Velto Premium Laundry is a premium-positioned laundry and dry-cleaning service operating in Uttara, Dhaka.

The website is not a brochure. It is part of Velto's customer acquisition and retention engine.

Primary commercial outcomes:

1. Pickup bookings
2. WhatsApp conversations
3. Quote requests
4. Higher-value service enquiries
5. Repeat / recurring laundry customers

The website must make Velto feel higher quality through organisation, process, transparency, visual execution, service presentation, trust, convenience, accountability, proof and booking ease.

Do not repeatedly call Velto:
- premium
- best
- trusted
- professional
- expert care

Show the difference through evidence.

Core brand/customer feeling:

> These people have a system.

The public website should show the result of the operating discipline more often than it uses words such as "system", "structured", "process", "quality", "handling" or "operational".

---

## 2. Positioning — LOCKED

Velto should feel like a calm, highly organised customer-facing window into the Velto operating system.

The website should communicate:

- real local presence
- clear services
- visible intake / identification / garment assessment / finishing / QC / packaging
- transparent pricing logic
- predictable expectations
- pickup convenience
- accountability
- real customer proof

Customer buying reasons:

- confidence that important garments will be handled properly
- convenience
- saved time
- reliable pickup and delivery
- accountability
- predictable turnaround
- confidence in pricing
- reduced mental load

---

## 3. Conversion hierarchy — LOCKED

### Primary conversion

**Book a Pickup**

### Secondary conversions

1. WhatsApp Velto
2. Find / View Pricing
3. Request a Quote
4. Choose a Service
5. Set Up Regular Pickup
6. Get Directions
7. Call

Do not style all CTAs with equal priority.

---

## 4. Core service area and live business rules

### Confirmed core service area

Uttara, Sectors 1–18.

Requests outside the confirmed core area should be handled separately and must not be automatically promised.

### Pickup and delivery rule

Orders of **৳499+** qualify for **FREE pickup & delivery**.

Orders below the threshold have an applicable pickup/delivery charge.

Do not hardcode the below-threshold charge in multiple UI locations. Treat it as configuration / operational data.

### Turnaround

- General service: usually around 48 hours
- Wash & Iron: usually around 72 hours
- Dry Cleaning: usually around 72 hours

Special garments, household items, unusual conditions and express requests may require different timing.

Do not promise absolute delivery times.

### Express

Express may be available depending on service, item and current workload. Do not imply guaranteed express availability.

---

## 5. Verified operating facts

Formal SOPs exist for:

- garment intake
- item/order identification
- tagging
- stain identification and handling
- quality control

These are structured operating procedures, not informal habits.

Do not expose technical chemistry, machine settings, partner details, or sensitive routing logic unless there is a specific approved trust reason.

### Dry Cleaning high-level workflow

Pickup
→ Structured Intake
→ Item Identification / Tagging
→ Garment & Stain Assessment
→ Service Routing
→ Dry Cleaning Treatment
→ Finishing / Pressing
→ Quality Control
→ Packaging
→ Delivery

Customer-facing principle:

A garment is assessed and routed through a defined service workflow rather than treated as an anonymous piece of laundry.

Do not claim:
- perfect cleaning
- zero risk
- guaranteed stain removal
- best dry cleaning in Dhaka

### Wash & Iron high-level workflow

Pickup
→ Intake
→ Item Count / Identification
→ Tagging / Order Association
→ Service Routing
→ Washing / Drying
→ Ironing / Finishing
→ Quality Control
→ Packaging
→ Delivery

---

## 6. Pricing source of truth — LOCKED

Velto Ops / Supabase is the official source of truth for website pricing.

Target architecture:

Velto Ops / Supabase
→ controlled public-safe pricing view / API
→ website

Public website must only receive the fields it needs.

Never expose:
- customer data
- internal costs
- private order data
- unrestricted database access
- operationally sensitive information

The website must not maintain an independent price universe.

---

## 7. Household quote logic

### Curtains

Pricing follows Velto operational pricing data and may require quantity / dimensions.

Customer journey:

Curtain Cleaning
→ approximate quantity / dimensions where useful
→ price guidance
→ Velto confirms final applicable amount where measurement / condition requires verification
→ pickup

### Carpets

Carpet pricing is size / dimension driven.

Customer journey:

Carpet Cleaning
→ approximate dimensions
→ pricing guidance or quote
→ optional photo
→ Velto confirmation
→ pickup

Do not promise exact automated price where size is uncertain, material matters, or condition materially changes the work.

### Blankets / Comforters

Primarily priced by item / type / size, not square-foot pricing.

Possible item types include:
- blanket
- heavy blanket
- comforter
- quilt / similar bedding where applicable

Typical planning range: roughly 3–4 days where this matches current operating conditions.

### Household quote UX

Keep it short:

- Name
- Phone / WhatsApp
- Area
- Service
- Approximate quantity / dimensions
- Optional photos
- Notes

→ Request Quote

---

## 8. Website + Ops relationship — LOCKED

The new website is the customer acquisition / front-door layer of the existing Velto operating system.

Conceptually:

Meta / Google / Organic / Maps
→ Velto website / service landing page
→ Book Pickup / Request Quote
→ server-side website endpoint
→ Velto operational backend / Supabase
→ Ops team
→ pickup
→ intake
→ processing
→ delivery

Do not create a disconnected second database for website leads.

Website submissions must be handled server-side through appropriate business logic. Never allow unrestricted browser access to private operational tables.

---

## 9. Campaign attribution

Where practical, booking acquisition context should travel with the booking.

Capture:
- source
- medium
- campaign
- ad/content
- landing page
- service
- UTM values
- Meta click identifiers where available

Long-term measurement goal:

ad
→ booking
→ real order
→ revenue
→ repeat customer

---

## 10. Technical stack — LOCKED

Use:

- Next.js
- TypeScript
- App Router unless a genuine technical reason prevents it
- Tailwind CSS
- Vercel deployment target
- existing Velto Supabase / PostgreSQL through controlled server-side/public-safe interfaces

Do not add a separate CMS for V1.

Do not add a separate database.

Use server components by default where appropriate. Use client components only when interaction requires them.

Prefer CSS transitions / Intersection Observer before adding a motion dependency.

Do not add dependencies without a concrete technical reason.

---

# 11. Brand source assets — REQUIRED

The website is a refinement and digital evolution of the existing Velto brand, not a rebrand.

Required source assets are expected in:

- `/public/brand/velto-logo.png`
- `/docs/brand/velto-company-profile.pdf`

The implementation agent must use the actual supplied Velto logo artwork.

Never:
- recreate it
- redraw it
- trace it
- substitute a text wordmark
- create an approximation

The company profile is a principles reference, not a UI template.

Brand DNA to preserve:

- deep navy
- Velto blue
- brighter cyan / light blue
- limited purple transition/accent
- white space
- thin structural rules
- disciplined grids
- strong typography
- restrained corporate/editorial composition
- process and accountability expressed visually

Adapt this DNA for B2C by introducing more:

- real photography
- human moments
- service discovery
- mobile usability
- booking emphasis
- price clarity
- customer reviews
- household context

Do not turn the consumer website into a dark corporate presentation.

---

## 12. Production colour tokens — LOCKED ROLES

The following working values were derived from the supplied Velto logo asset. If an official vector / brand manual later supplies slightly different formal colour values, those official values override the sampled hex values without changing token roles.

```css
:root {
  --velto-navy: #002B4E;
  --velto-blue: #027CC3;
  --velto-cyan: #00A6E5;
  --velto-purple: #7C5AAA;

  --color-brand: var(--velto-blue);
  --color-brand-deep: var(--velto-navy);
  --color-brand-bright: var(--velto-cyan);
  --color-brand-accent: var(--velto-purple);

  --color-text-primary: var(--velto-navy);
  --color-text-body: #30373D;
  --color-text-secondary: #596168;
  --color-text-muted: #7B8288;
  --color-text-inverse: #FFFFFF;

  --color-bg: #FFFFFF;
  --color-bg-warm: #FAFAF8;
  --color-bg-soft: #F5F7F8;
  --color-bg-navy: var(--velto-navy);
  --color-bg-navy-deep: #00223D; /* footer surface, one step below navy */

  --color-border: #D9E0E4;
  --color-border-strong: #B8C5CD;

  --color-disabled-bg: #ECEFF1;
  --color-disabled-text: #92999F;
  --color-error: #B42318;
  --color-error-soft: #FEF3F2;
  --color-success: #137A4A;
  --color-success-soft: #EFF8F3;
}
```

Colour roles:

- Navy = identity / major typography / selected high-contrast surfaces / footer
- Velto blue = primary interactive colour
- Cyan = bright supporting signal / focus accent
- Purple = restrained inherited accent only, not a competing CTA colour
- White / warm light surfaces remain dominant

No unrelated primary blue.
No gold.
No black luxury theme.
No decorative gradients by default.

---

# 13. Typography system — LOCKED

Primary: **Instrument Sans**

Secondary: **Source Serif 4**, used selectively for reviews / editorial quotes.

| Style | Desktop | Mobile | Line height | Weight | Tracking |
|---|---:|---:|---:|---:|---:|
| Display / Hero | clamp(2.75rem, 4.4vw, 4rem), text width ~600px (aim ≤4 lines) | ~36px | 1.02 | 600 | -0.035em |
| H1 | clamp(2.5rem, 4vw, 3.5rem) | min ~40px | 1.05 | 600 | -0.03em |
| H2 | clamp(2rem, 3vw, 2.75rem) | min ~32px | 1.08 | 600 | -0.025em |
| H3 | clamp(1.5rem, 2vw, 2rem) | min ~24px | 1.15 | 600 | -0.015em |
| H4 | 22px | 20px | 1.25 | 600 | -0.01em |
| Body Large | 20px | 18px | 1.55 | 400 | normal |
| Body | 16px | 16px | 1.6 | 400 | normal |
| Small | 14px | 14px | 1.5 | 400 | normal |
| Caption | 13px | 13px | 1.45 | 400 | 0.01em |
| Label | 13px | 13px | 1.3 | 600 | 0.025em |
| Button | 16px | 16px | 1 | 600 | -0.005em |
| Input | 16px | 16px | 1.4 | 400 | normal |

Major headings normally use Velto navy.

Body copy uses dark neutral.

Source Serif 4 review body: approximately 22–28px desktop, 19–22px mobile, line-height ~1.45, weight 400.

---

# 14. Layout system — LOCKED

Global content max width: **1240px**.

### Desktop >= 1200px

- 12 columns
- 24px column gap
- 32px minimum page gutter

### Tablet 768–1199px

- 8 columns
- 20px gap
- 24px page gutter

### Mobile < 768px

- 4 columns
- 16px gap
- 20px page margin
- 16px margin allowed below 360px width

### Vertical rhythm

| Spacing | Desktop | Tablet | Mobile |
|---|---:|---:|---:|
| Major section | 112px | 88px | 64px |
| Related section transition | 80px | 72px | 52px |
| Heading → intro | 24px | 20px | 16px |
| Intro → primary content | 48px | 40px | 32px |
| Component group | 32px | 28px | 24px |
| Tight component spacing | 16px | 16px | 12px |
| Caption gap | 8px | 8px | 6px |

Use thin structural rules to organise information instead of wrapping everything in cards.

---

# 15. Radius / border / shadow system

### Radius

- small: 4px
- medium: 8px
- large: 12px
- full/pill: only for status/badges where genuinely appropriate

Do not use oversized SaaS radii.

### Borders

Use 1px structural lines for:
- service rows
- FAQ boundaries
- pricing results
- location information
- process metadata
- selected section transitions

### Shadows

Default: none.

Use border, spacing and background contrast first.

An overlay shadow may be used only for an autocomplete overlay or mobile menu when necessary.

---

# 16. Button system

## Primary

- background: Velto blue
- white text
- 48px desktop height
- 52px mobile primary conversion height
- 22–24px horizontal padding
- 8px radius
- visible focus ring using cyan / accessible equivalent

## Secondary

- white / transparent background
- navy text
- structural border
- matching height when paired with primary

## Text actions

Use for service details, directions and review links.

Do not fake buttons when plain text navigation is more appropriate.

## WhatsApp

May use official WhatsApp green on the dedicated WhatsApp action.

Book Pickup remains visually stronger.

---

# 17. Form system

No floating labels.

Inputs: approximately 52px desktop / 54px mobile.

Search: approximately 58px desktop / 56px mobile.

Textarea minimum height: 120px.

Clear visible focus.

Errors require text, not colour alone.

Upload field copy for household quote: **Add photos, optional**.

Booking must remain simple and accessible.

---

# 18. Header + navigation — LOCKED

## Desktop

Header height:
- initial 76px
- scrolled 64px, lighter (smaller logo/CTA, hairline border + soft shadow)

Navigation:
- Services
- How It Works
- Pricing
- Locations
- WhatsApp
- Book a Pickup

Sticky after scrolling.

Use white / lightly translucent background, bottom border, restrained transition.

No dramatic shrink animation.

## Mobile

Top header:
- 64px
- logo
- menu trigger

Mobile menu:
- Services
- How It Works
- Pricing
- Regular Laundry
- Locations
- WhatsApp
- Book a Pickup

### Bottom conversion bar

Persistent on homepage and service pages.

Primary: **Book a Pickup** (same casing as every other CTA)

Secondary: **WhatsApp** (with WhatsApp icon)

Book Pickup gets ~68–70% visual width.

Bar base height about 72px plus safe-area inset.

Hide when:
- user is actively typing and mobile keyboard is open
- user is on `/book`
- final booking section occupies roughly 60%+ of viewport

No bouncing / attention animation.

---

# 19. Homepage hierarchy — LOCKED

Do not reorder, remove or insert homepage sections without explicit instruction.

1. Hero + local proof
2. Service chooser
3. What happens to your clothes after pickup?
4. Customer proof
5. Built around Uttara
6. Find a Price
7. Curtains, carpets & bedding
8. Regular laundry
9. FAQ
10. Final booking

Order adjusted in the owner-requested UI audit: the proof cluster (customer proof, locations) now precedes the pricing cluster (Find a Price, household), so trust evidence lands before price. Section backgrounds alternate white / warm / white / warm / white / soft / white / soft / white / navy with no adjacent repeats; the footer sits on `--color-bg-navy-deep` with a hairline top rule so the final booking section and footer read as separate surfaces.

---

# 20. Homepage final copy + implementation specification

## SECTION 01 — Hero + local proof

### H1

**Laundry and dry cleaning in Uttara, with pickup from your door.**

### Supporting copy

Send everyday laundry, dry cleaning, ironing, curtains, carpets or bedding. We collect across Uttara Sectors 1–18 and bring it back when it's ready.

### Primary CTA

**Book a Pickup**

### Secondary CTA

**Find a Price**

### Proof

**5.0 on Google · 100+ reviews**

**Uttara Sectors 1–18**

**Dry Cleaning & Wash & Iron usually around 72 hours**

**Free pickup & delivery on orders of ৳499+**

### Desktop layout

- 12-column grid
- copy columns 1–6 (headline max ~600px, aim ≤4 lines)
- image columns 7–12
- supporting text max width ~520px
- hero top padding 72–88px below header
- hero bottom ~80px
- image ratio approximately 4:5 or 5:6

Preferred hero image: real Velto rider/customer pickup or delivery moment.

### Mobile order

1. H1
2. supporting copy
3. Book a Pickup
4. Find a Price
5. Google proof
6. hero image
7. service area / turnaround / free-delivery proof

Do not place all proof above the image.

### Placeholder behavior

If live rating data fails, show a verified durable fallback such as **100+ Google reviews**. Never show `0 reviews`.

---

## SECTION 02 — Service chooser

### H2

**What do you need cleaned?**

### Supporting copy

Choose the service you need. If you are unsure, send us a photo or message Velto on WhatsApp.

### Dry Cleaning

For suits, blazers, sarees, sherwanis and garments that need a closer look before cleaning.

**View Dry Cleaning**

### Wash & Iron

We collect your laundry, wash and finish it, then return it ready to wear.

**View Wash & Iron**

### Ironing

Already washed? Send it to Velto for ironing and finishing.

**View Ironing**

### Curtain Cleaning

Tell us roughly how many curtains you have and their size. We'll help you work out the price.

**View Curtain Cleaning**

### Carpet Cleaning

Share the approximate dimensions. The material and condition may affect the final price.

**View Carpet Cleaning**

### Blankets & Comforters

Pricing depends mainly on the item, type and size.

**View Blanket Cleaning**

### Desktop composition

Do not create six identical cards.

Recommended:

- Dry Cleaning: columns 1–7, strongest visual weight
- Wash & Iron: columns 8–12
- second row Ironing: columns 1–5
- household group: columns 6–12

Household group contains Curtains / Carpets / Blankets as editorial rows with one or two strong images.

### Mobile

Vertical list. No horizontal carousel.

---

## SECTION 03 — Signature process experience

### H2

**What happens to your clothes after pickup?**

### Supporting copy

Once your order reaches Velto, we check it in, identify the items and look over the garments before cleaning starts. When the work is finished, everything is checked again, packed and returned.

### Stages

#### 01 — Collected

We arrange pickup from your address in Uttara.

#### 02 — Checked in

We count the order and connect the items to the right customer and order.

#### 03 — Tagged

Items are tagged so they stay connected to the correct order.

#### 04 — Checked before cleaning

We look over the garment condition and visible stains before cleaning starts.

#### 05 — Cleaned & finished

The garment is cleaned for the booked service, then pressed or finished where needed.

#### 06 — Checked before packing

Finished items are checked again before they are packed.

#### 07 — Packed for return

Your finished order is organised and packed for delivery.

#### 08 — Returned to you

Delivery is arranged back to your address.

### Delicate garment insert

#### Headline

**Some garments need a closer look.**

#### Copy

A blazer, saree or sherwani isn't the same job as everyday laundry. We check the garment and visible stains before cleaning starts.

Some stains cannot be fully removed. If something needs extra attention, we'll explain the options first.

CTA: **See Dry Cleaning**

### Desktop interaction

- sticky image area: columns 1–7
- narrative: columns 8–12
- sticky top: header height + ~32px
- visual height: `min(72vh, 720px)` with sensible minimum
- native browser scroll, no scroll hijack
- stage active when stage midpoint crosses ~42–48% viewport
- active number uses brand colour
- inactive text remains readable

### Image transition

Crossfade only, approximately 300–450ms.

Optional subtle scale 1.015 → 1.

No cinematic effects.

### Reduced motion

Disable crossfade/transform and swap immediately.

### JavaScript fallback

All stage copy remains fully accessible. First image remains visible and no content disappears.

### Mobile

No sticky process.

All eight stages stay present, grouped visually into four movements, each with one real image and compact stage rows:

1. Pickup: Collected
2. Intake: Checked in, Tagged, Checked before cleaning
3. Cleaning & finishing: Cleaned & finished
4. QC & return: Checked before packing, Packed for return, Returned to you

---

## SECTION 04 — Customer proof

### H2

**What customers noticed**

No intro paragraph.

### Purpose

Use 3–4 strong reviews that are not already used contextually elsewhere.

Do not duplicate reviews.

No carousel.

### Metadata

Show:
- reviewer name
- Google or Facebook
- rating/recommendation where available
- source link where practical

Do not rewrite customer language.

---

## SECTION 05 — Built around Uttara

### H2

**Built around Uttara.**

### Supporting copy

Velto serves Uttara Sectors 1–18, with locations in Sector 11 and Sector 18.

Book a pickup from home or visit the outlet that works for you.

### Sector 11

**5.0 ★ · 102 Google reviews**

House 2, Road 14, Sector 11, Uttara, Dhaka

9:00 AM–10:00 PM

**Get Directions**

**See Google Reviews**

### Sector 18

**4.9 ★ · 8 Google reviews**

RUAP, North Side of Gate 1, Poncoboti Bazar, Sector 18, Uttara, Dhaka

10:00 AM–9:00 PM

**Get Directions**

**See Google Reviews**

### Desktop

Two 6-column location blocks.

Storefront image ~3:2.

No heavy map embed on homepage.

### Mobile

Sector 11 then Sector 18. Image → rating → address → hours → directions → reviews.

Never merge the two branch ratings.

Review counts must be verified immediately before launch or retrieved dynamically where practical.

---

## SECTION 06 — Find a Price

### H2

**Check the price before you send it.**

### Supporting copy

Search for an item such as a shirt, blazer or saree to see the services available and the current Velto price.

### Search field

**Search an item**

Helper: **Try: Shirt, Blazer, Saree**

### Example result model

**Shirt**

Ironing  
`[Live price]`

Wash & Iron  
`[Live price]`

Dry Cleaning  
`[Live price]`

No cart.
No quantity.
No checkout.
No ecommerce UI.

### Desktop layout

- soft light background
- search area columns 1–7
- column 8 breathing room
- turnaround + delivery columns 9–12

### States

#### Default
Input + helper only.

#### Typing
Begin likely matches after 2 characters when data is available.

#### Multiple matches
Show up to ~5 relevant item names for selection.

#### No result

**We couldn't find that item.**

**Try another name or WhatsApp Velto and tell us what you need cleaned.**

CTA: **WhatsApp Velto**

#### Loading
2–3 subtle skeleton rows.

#### Error

**Prices couldn't load right now.**

**You can still book a pickup or ask Velto on WhatsApp.**

Actions:
- **Try Again**
- **WhatsApp Velto**

Never expose raw API/database errors.

### Turnaround block

**General orders**  
Usually around 48 hours

**Wash & Iron**  
Usually around 72 hours

**Dry Cleaning**  
Usually around 72 hours

Some garments and household items may take longer.

### Delivery rule

**Free pickup & delivery on orders of ৳499+.**

For smaller orders, the applicable pickup and delivery charge will be shown before booking.

### CTAs

**View Full Pricing**

**Book a Pickup**

### Mobile

Search → results → turnaround → delivery rule → CTAs.

---

## SECTION 07 — Curtains, carpets & bedding

### H2

**For curtains, carpets and bedding, start with a few details.**

### Supporting copy

Size, material and condition can affect the price. Tell us what you have, add approximate measurements where useful and upload a photo if it helps.

We will confirm the final amount when measurement or condition needs to be checked.

### Curtains

Approximate quantity and dimensions help us quote more accurately.

### Carpets

Send the approximate length and width. Material and condition can change the final price.

### Blankets & Comforters

Pricing depends mainly on the item, type and size. These jobs can take longer than everyday laundry.

### CTA

**Request a Quote**

### Desktop

- image columns 1–6
- content columns 8–12
- image ratio 4:3 or 3:2
- three service rows, not three cards

### Mobile

Image first → heading/copy → service rows → CTA.

---

## SECTION 08 — Regular laundry

### H2

**If the laundry comes back every week, make pickup part of the week.**

### Supporting copy

Regular laundry and ironing can be arranged as recurring pickups, so you don't need to book from scratch every time.

Put the week's laundry together and orders of ৳499+ qualify for free pickup and delivery.

### Primary CTA

**Set Up Regular Pickup**

### Secondary CTA

**WhatsApp Velto**

### Desktop

Image columns 1–6. Text columns 8–12.

Use a verified repeat-customer review if available.

### Mobile

Image → headline → copy → review if available → CTAs.

---

## SECTION 09 — FAQ

### H2

**A few things worth knowing before you book.**

### How long does an order usually take?

General orders are usually around 48 hours.

Wash & Iron and Dry Cleaning are usually around 72 hours.

Special garments, household items and unusual conditions may take longer.

### Where do you provide pickup and delivery?

Velto's confirmed core service area is Uttara, Sectors 1–18.

If you are outside that area, ask us before booking.

### When is pickup and delivery free?

Orders of ৳499+ qualify for free pickup and delivery.

Smaller orders have an applicable pickup and delivery charge.

### Can every stain be removed?

No.

We check visible stains and treat them according to the garment and service, but no laundry should promise that every stain will come out.

### What if I do not know which service I need?

Send us a photo or message Velto on WhatsApp. We can help you choose before booking.

### Is Express service available?

Sometimes.

Availability depends on the item, service and current workload. Confirm with Velto before booking.

### How are curtains and carpets priced?

Curtain and carpet pricing can depend on size, material and condition.

Share approximate measurements and a photo where useful. We can confirm the final price when more information is needed.

### Desktop

H2 columns 1–4. FAQ columns 6–12.

No card shells. Use structural divider lines.

### Mobile

Accessible single-column accordion.

---

## SECTION 10 — Final booking

### H2

**Ready to send it?**

### Supporting copy

Tell us where to collect from, what you need cleaned and your preferred pickup time.

That's enough to get the booking started.

### Primary CTA

**Book a Pickup**

### Secondary CTA

**WhatsApp Velto**

### Proof

**5.0 on Google · 100+ reviews**

**Serving Uttara Sectors 1–18**

**Free pickup & delivery on orders of ৳499+**

### Desktop

- strong closing image columns 1–7
- content columns 8–12
- candidate navy closing section with white text if visual QA supports it

### Mobile

Copy → CTAs → proof → image.

Hide mobile sticky conversion bar when this section occupies ~60%+ of viewport.

---

# 21. Distributed trust strategy — LOCKED

Reviews are evidence, not decoration.

Homepage durable trust treatment:

**5.0 on Google · 100+ reviews**

The 5.0 refers only to the primary Sector 11 profile.

Do not fabricate a blended rating across locations.

Use reviews contextually:

- Dry Cleaning: saree / silk / blazer / delicate garment / special-care review
- Pickup / Delivery: pickup / delivery / communication / convenience review
- QC / Packaging: finishing / folding / packaging / garment condition review
- Regular Laundry: repeat / returning customer review
- Curtains / Carpets / Blankets: service-specific review where available

Facebook recommendations may be used when genuine and useful.

For every review retain:
- reviewer name
- platform
- rating/recommendation where available
- exact review text
- source link where practical
- semantic tags internally

Never rewrite customer reviews to make them sound polished.

The dedicated review section remains editorial, not a testimonial carousel wall.

---

# 22. Booking entry point — LOCKED

Primary booking route:

`/book`

Do not use a tiny modal as the primary booking experience.

Suggested source parameters:

- Hero: `/book?source=home_hero`
- Header: `/book?source=header`
- Mobile sticky: `/book?source=mobile_sticky`
- Pricing: `/book?source=home_pricing`
- Final CTA: `/book?source=home_final`

Service pages should preserve selected service where appropriate, e.g.

`/book?service=dry-cleaning&source=dry-cleaning-page`

Preserve where practical:
- selected service
- source page
- landing page
- UTM parameters
- supported click identifiers

---

# 23. Analytics event map

Prepare UI hooks for these events. Do not configure production analytics IDs during the first homepage build.

| Event | Trigger |
|---|---|
| `book_pickup_click` | Any Book a Pickup CTA click |
| `booking_start` | First meaningful interaction with `/book` form |
| `booking_success` | Successful booking creation |
| `whatsapp_click` | Any WhatsApp action |
| `pricing_search` | User submits/selects an item in Find a Price |
| `pricing_view` | Valid pricing result becomes visible |
| `service_view` | User opens a service page |
| `quote_start` | User begins household quote form |
| `quote_success` | Quote request succeeds |
| `directions_click` | Get Directions clicked |
| `google_reviews_click` | Google reviews source clicked |
| `regular_laundry_interest` | Set Up Regular Pickup clicked |

Where relevant include context such as:
- page
- section
- CTA placement
- service
- branch
- campaign / UTM context

---

# 24. Accessibility requirements

Working standard: WCAG 2.2 AA.

- exactly one homepage `h1`
- major sections use `h2`
- heading levels must reflect semantics, not visual size
- all links/buttons/forms/menus/FAQ/search suggestions keyboard accessible
- visible focus styles
- use links for navigation and buttons for state/action changes
- meaningful image alt text where image conveys evidence
- decorative images use empty alt
- review rating/platform must be text accessible
- meet AA contrast
- no important text over photography unless contrast is guaranteed
- respect `prefers-reduced-motion`

Good alt example:

`Velto staff attaching an order tag to a customer's garment during intake.`

Bad alt example:

`Premium laundry service image.`

---

# 25. Performance requirements

Paid mobile traffic makes performance part of conversion.

### Hero

- priority load
- no lazy loading
- explicit dimensions / aspect ratio reserved
- responsive image sizes
- AVIF/WebP where supported

### Below the fold

- lazy load images
- responsive `sizes`
- do not ship oversized desktop images to mobile

### Fonts

Load only required weights.

Recommended Instrument Sans: 400, 500, 600.

Source Serif 4: 400, optionally 500.

### JavaScript

Keep client JS minimal.

Process section should work with CSS + Intersection Observer unless a genuine reason requires a motion library.

### Layout shift

Reserve space for images, search result region where practical, reviews and sticky UI.

### Third-party embeds

Avoid heavy homepage embeds for:
- Facebook feed
- Google review widget
- full Google Maps iframe

Use direct links / controlled data instead.

### Targets

Aim for strong real-world mobile performance and roughly:
- Lighthouse Performance 90+ where realistic with final imagery
- Accessibility 95+
- Best Practices 95+
- SEO 95+

Scores are secondary to fast first viewport, responsive interaction, low CLS and no input lag.

---

# 26. Reusable homepage component set

Required components:

- Header
- MobileMenu
- MobileConversionBar
- Hero
- ProofLine
- ServiceChooser
- ServiceItem
- ProcessStory
- ProcessStage
- DelicateGarmentInsert
- PriceFinder
- PriceResult
- HouseholdSection
- ReviewBlock
- ReviewsSection
- LocationBlock
- LocationsSection
- RegularLaundrySection
- FAQ
- FinalBookingCTA
- Footer

Shared primitives:

- Button
- TextLink
- Input
- SearchInput
- SectionContainer
- ResponsiveImage

Do not over-componentize trivial markup.

Do not force every component into a card.

---

# 27. Mock / placeholder rules

Temporary homepage development may use mock data for:

- pricing responses
- selected reviews
- process images
- hero image
- location images
- household images

Mock data must be centralized and clearly marked `MOCK` or `TODO_VERIFY`.

Never invent realistic-looking customer reviews.

Never invent ratings.

Never invent prices.

Never invent addresses.

For review placeholders use language such as:

**Verified review will appear here**

not fake customer copy.

---

# 28. Homepage responsive acceptance sizes

Verify at minimum:

- Desktop: 1440 × 900
- Laptop: 1280 × 800
- Tablet: 1024 × 768
- Mobile: 390 × 844
- Small mobile: 360 × 800

Check:
- no horizontal overflow
- headline wrapping
- CTA collisions
- sticky header
- mobile bottom safe area
- process usability
- pricing states
- location layout
- FAQ touch targets

---

# 29. Required homepage preview states

Produce screenshots / previews for:

1. Desktop hero
2. Desktop service chooser
3. Desktop process mid-scroll
4. Desktop price search with results
5. Desktop locations
6. Full mobile first viewport
7. Mobile service chooser
8. Mobile process story
9. Mobile price result
10. Mobile bottom conversion bar
11. Mobile menu open
12. Pricing no-result state
13. Pricing loading state
14. Pricing error state

---

# 30. Definition of homepage implementation complete

Homepage V1 is implementation-complete only when:

- all 10 approved sections exist
- approved copy is used
- design tokens are applied consistently
- responsive layouts match this specification
- process interaction works without scroll hijacking
- reduced-motion fallback works
- price-search mocked states work
- links / CTAs route correctly
- mobile bottom action works correctly
- keyboard focus is visible
- images reserve space and avoid layout shift
- no console errors
- no broken responsive states
- no invented business data
- mock data is clearly isolated
- preview screenshots are produced
- homepage passes visual QA before internal pages begin

---

# 31. Full website sitemap — approved direction

After homepage approval, continue through the approved site architecture:

- `/` Home
- `/services` Services overview
- `/services/dry-cleaning`
- `/services/wash-and-iron`
- `/services/ironing`
- `/services/curtain-cleaning`
- `/services/carpet-cleaning`
- `/services/blanket-comforter-cleaning`
- `/services/express`
- `/regular-laundry`
- `/pricing`
- `/how-it-works`
- `/locations`
- `/locations/sector-11`
- `/locations/sector-18`
- `/about`
- `/business-bulk-laundry` when approved commercial content is ready
- `/book`
- `/quote`
- `/privacy`
- `/terms` if required by the implemented data flow

Do not create major SEO pages for gender/clothing taxonomy such as Men's Item / Ladies Item / Bottom Wear. Those belong in pricing/filter structures, not primary site architecture.

---

# 32. Paid traffic architecture

Do not automatically send all campaigns to the homepage.

High-intent campaigns should land on the relevant service page, including:

- curtain ads → Curtain Cleaning page
- carpet ads → Carpet Cleaning page
- dry cleaning ads → Dry Cleaning page
- blanket / comforter ads → Blanket & Comforter page
- everyday laundry ads → Wash & Iron or Regular Laundry depending on the promise

Landing-page message must match ad promise.

---

# 33. Internal page implementation rule

After homepage is visually approved and the reusable system is stable:

1. build service page template/system
2. build approved service pages
3. build pricing experience
4. build How It Works
5. build location system
6. build recurring laundry
7. build About
8. build Book Pickup
9. build Quote flow
10. add approved integrations
11. technical SEO
12. responsive QA
13. accessibility QA
14. functional QA
15. deployment preparation

Do not require the user to prompt each normal implementation step if the full build has already been authorized.

Respect explicit approval gates.

---

# 34. Agent implementation contract — LOCKED

The coding agent must treat these as approved:

- positioning
- homepage strategy
- homepage 10-section hierarchy
- homepage copy
- CTA hierarchy
- distributed Google/Facebook proof strategy
- design direction
- typography
- brand colour roles
- mobile conversion model
- booking route
- pricing-search concept
- process storytelling model
- technical stack

The agent must not:

- redesign the homepage independently
- rewrite approved copy
- change section order
- add or remove homepage sections
- introduce generic SaaS card layouts
- add decorative gradients
- add glassmorphism
- add meaningless animation
- create a new brand identity
- recreate the Velto logo
- add dependencies without a clear technical reason
- create fake reviews
- invent prices
- invent operating claims
- invent ratings, addresses or policies
- expose private Supabase tables to the browser
- create ecommerce/cart logic

Use supplied brand assets exactly as source material.

The corporate profile is a visual-principles reference, not a website template.

---

# 35. Current implementation gate

## Current target

**HOMEPAGE ONLY**

The first build agent should implement, test and visually QA the homepage before building internal pages.

Minimal placeholder routes such as `/book`, `/quote` and service destinations may exist only to support navigation testing.

## Approval gate

Do not proceed into full internal-page implementation until the homepage implementation has been visually reviewed and approved.

---

# 36. Live verification required before production launch

These may be mocked during initial implementation but must be verified before launch:

- exact live prices from the approved Supabase/public-safe pricing source
- exact below-৳499 pickup/delivery charge
- current Google review counts
- exact selected Google reviews
- exact selected Facebook reviews/recommendations
- review source links
- final Google Maps directions links for both locations
- final WhatsApp destinations
- current recurring pickup rules beyond confirmed availability
- exact Express surcharge / rules if displayed
- current curtain/carpet turnaround ranges
- current payment methods
- final production photography
- official reversed/white logo variant if used on navy surfaces

Current confirmed location facts:

### Sector 11 / Main
- Google rating: 5.0
- Google reviews: 102 at last verification
- Address: House 2, Road 14, Sector 11, Uttara, Dhaka
- Google hours: 9:00 AM–10:00 PM

### Sector 18
- Google rating: 4.9
- Google reviews: 8 at last verification
- Address: RUAP, North Side of Gate 1, Poncoboti Bazar, Sector 18, Uttara, Dhaka
- Google hours: 10:00 AM–9:00 PM

Do not combine branch ratings into a fabricated overall rating.

---

# 37. Project status

Current phase: Homepage implementation handoff

Strategy: LOCKED

Homepage copy: LOCKED

Homepage hierarchy: LOCKED

Design system: LOCKED

Brand source direction: LOCKED

Next required implementation step:

> Build the homepage faithfully from this specification, produce the required desktop/mobile preview states, run responsive/functional/accessibility QA, and stop at the homepage approval gate before proceeding into full internal pages.
