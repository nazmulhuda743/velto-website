# DNS cutover: www.velto.com.bd from Webflow to Vercel

Owner: Velto. Recorded 25 Sep 2026. Tick each box in order. Don't start step C until everything in A and B is ticked.

## What is true today (checked 25 Sep 2026)

| Record | Current value | Meaning |
|---|---|---|
| Nameservers | `ernest.ns.cloudflare.com`, `eve.ns.cloudflare.com` | DNS is managed in **Cloudflare**, so the change is made there. |
| `velto.com.bd` A | `198.202.211.1` | Webflow |
| `www.velto.com.bd` CNAME | `cdn.webflow.com` | Webflow |
| `velto.com.bd` MX | `route1/2/3.mx.cloudflare.net` | **Cloudflare Email Routing: domain email depends on this.** |
| `velto.com.bd` TXT | present (SPF / verification) | **Don't touch.** |
| Vercel | Production deploys of `main` succeed (`veltoofficial/velto-website`) | The deployment URL is behind Vercel login; the public domain isn't attached yet. |

**Only two records change: the apex A record and the `www` CNAME.** Leave MX, TXT and every other record exactly as they are, or email stops working.

---

## A. Before the cutover (can be done days ahead)

### A1. Vercel production environment variables
Project → Settings → Environment Variables → **Production**:

- [ ] `NEXT_PUBLIC_SITE_URL` = `https://www.velto.com.bd`
- [ ] `VELTO_SUPABASE_URL` (server only, no `NEXT_PUBLIC_` prefix)
- [ ] `VELTO_SUPABASE_SECRET_KEY` (server only, no `NEXT_PUBLIC_` prefix)
- [ ] `VELTO_PRICING_VIEW` = `website_pricing_public`
- [ ] `ADMIN_SESSION_SECRET`: a new random value, **not** the same as the Supabase key
- [ ] `VELTO_OPS_WRITES_ENABLED` = `false` until the controlled booking test in D3
- [ ] `WEBSITE_ANALYTICS_WRITES_ENABLED` = `false` until the analytics SQL is applied (docs/technical/COMMAND-CENTER.md)
- [ ] `NEXT_PUBLIC_GTM_ID`: the reviewed production container, or leave empty
- [ ] **Redeploy** after setting these. `NEXT_PUBLIC_*` values are baked in at build time, so a redeploy is required.

### A2. Prove the build is production-ready
- [ ] With production values loaded, `npm run verify:production-readiness` reports no FAIL.
- [ ] The latest `main` passes CI (`verify`) and Vercel shows the deployment as Ready.
- [ ] A Vercel team member opens the production deployment URL and clicks through: home, one service page, pricing search, /book, /quote, /track, /cookies.

### A3. Old Webflow URLs
- [x] Redirects for the old public Webflow URLs are in `next.config.ts` (contact, about-us, team, checkout, the clothing-category service pages, utility pages).
- [ ] **Decide on the old account URLs** `/log-in`, `/sign-up`, `/reset-password`, `/update-password`, `/user-account`, `/access-denied`. They will 404 after the cutover unless the Customer Portal work redirects them.
- [ ] If any old URL was used in live ads, Google Business Profile or printed material, check it is covered above.

### A4. Prepare for rollback
- [ ] In Cloudflare DNS, **screenshot or export** the current records (DNS → Advanced → Export). This is the rollback copy.
- [ ] Lower the TTL of the apex A and `www` CNAME records to **Auto / 5 minutes** at least a day before. This only matters for records set to DNS only; proxied records already switch quickly.
- [ ] Keep the Webflow site **published** until step E. Don't cancel Webflow hosting yet.

### A5. Choose the Cloudflare mode
- [ ] Recommended: the apex and `www` records set to **DNS only (grey cloud)**, so Vercel serves the site and issues and renews the SSL certificate itself.
- [ ] If you must keep Cloudflare's proxy (orange cloud): SSL/TLS mode **Full (strict)**, no Cloudflare page rules or cache rules on these hostnames, and "Always Use HTTPS" either on or left to Vercel. Never use "Flexible" SSL, which causes redirect loops.

---

## B. Attach the domain in Vercel (no visitor impact yet)

- [ ] Vercel → project → Settings → **Domains** → add `www.velto.com.bd`.
- [ ] Add `velto.com.bd` and set it to **redirect to `www.velto.com.bd` (308)**. `www` is the canonical host the site is built for.
- [ ] Vercel now shows the records it expects, usually an **A record for the apex** and a **CNAME for `www`**. **Copy the exact values Vercel displays**; newer projects show a project-specific CNAME target.
- [ ] If Vercel asks for a TXT record to verify ownership, add it in Cloudflare. It doesn't affect the live site.
- [ ] Confirm Vercel's **Deployment Protection** doesn't apply to the production domain: Settings → Deployment Protection, with "Standard Protection" protecting preview and deployment URLs but not the production domain.

---

## C. The cutover (about 15 minutes, during a quiet hour)

In **Cloudflare → DNS → Records**:

- [ ] Edit `velto.com.bd` **A** `198.202.211.1` and change it to Vercel's apex A value.
- [ ] Edit `www` **CNAME** `cdn.webflow.com` and change it to Vercel's `www` CNAME value.
- [ ] Set both to **DNS only**, as decided in A5.
- [ ] **Don't edit** MX, TXT or any other record.
- [ ] Cloudflare → Caching → **Purge everything**, so no cached Webflow pages linger.
- [ ] In Vercel → Domains, wait until both domains show **Valid Configuration** and a certificate is issued. This usually takes a few minutes.

---

## D. Verify (first hour)

### D1. It's the new site
- [ ] `https://www.velto.com.bd` loads the new homepage ("Laundry and dry cleaning in Uttara, with pickup from your door.").
- [ ] `curl -sI https://www.velto.com.bd` shows `server: Vercel` and an `x-vercel-id` header.
- [ ] `https://velto.com.bd` and `http://www.velto.com.bd` redirect to `https://www.velto.com.bd`.
- [ ] The page source contains `<link rel="canonical" href="https://www.velto.com.bd/"`.
- [ ] `/robots.txt` allows public pages, and `/sitemap.xml` lists `https://www.velto.com.bd/...` URLs.
- [ ] `/contact` redirects to `/locations`, and `/services/mens-ethnic-wear` redirects to `/services/dry-cleaning`.
- [ ] An unknown URL shows the Velto 404 page.

### D2. Customer paths (on a phone, on mobile data)
- [ ] Cookie banner: Reject works, the banner disappears, and it stays gone after a reload.
- [ ] The pricing search returns live prices (not "After assessment" for everything).
- [ ] The WhatsApp buttons open a chat with +880 1605-162788.
- [ ] Get Directions opens Google Maps at the right outlet.
- [ ] /track with a real order number and phone number finds the order. A wrong pair shows the generic "couldn't find" message.

### D3. Bookings (only when Ops is ready)
- [ ] With `VELTO_OPS_WRITES_ENABLED=false`, /book shows the honest "isn't switched on yet" state with the WhatsApp fallback.
- [ ] Controlled test: set it to `true`, redeploy, submit one real test booking and one test quote, confirm both appear in Velto Ops, then clean up the test records.

### D4. Email still works
- [ ] Send an email to a `@velto.com.bd` address from an outside account and confirm it arrives.

### D5. Search, maps and ads
- [ ] Google Search Console: add or verify the `velto.com.bd` Domain property, then submit `https://www.velto.com.bd/sitemap.xml`.
- [ ] Google Business Profile (Sector 11 and Sector 18): set the website link to the location page, e.g. `https://www.velto.com.bd/locations/sector-11`.
- [ ] Meta / Google ads: update landing URLs to the matching service pages (spec §32), keeping UTM parameters.
- [ ] If GTM is set: GTM Preview shows no tags firing before consent and the GA4/Meta tags firing after Accept.

---

## E. After it's stable (1–2 weeks)

- [ ] Search Console shows no spike of 404s from old URLs. Add redirects for any that matter.
- [ ] Unpublish the Webflow site, then cancel Webflow hosting.
- [ ] Raise the TTL back to Auto or 1 hour.

---

## Rollback (if something is badly wrong in step C or D)

1. In Cloudflare, set the apex A back to `198.202.211.1` and `www` CNAME back to `cdn.webflow.com`, as in the A4 export.
2. Purge the Cloudflare cache.
3. The old Webflow site is live again within minutes, because Webflow was kept published.
4. Nothing else needs undoing: email records were never touched, and the Vercel domain can stay attached.
