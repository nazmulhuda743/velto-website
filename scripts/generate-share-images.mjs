/**
 * Share cards (Open Graph / WhatsApp / Facebook link previews): 1200×630 JPEGs in
 * public/images/share, one per page and language, used by src/lib/seo/page-metadata.ts.
 *
 * Rendered in Chromium on top of the live site's stylesheet, so the cards use the site's own
 * fonts (Instrument Sans, Noto Sans Bengali), photos and white logo artwork. Text is each
 * page's headline plus claims already on the site. Not part of the build or CI.
 *
 * Run: PLAYWRIGHT_CORE=/path/to/playwright-core CHROMIUM=/path/to/chrome  *      node scripts/generate-share-images.mjs public/images/share [only-one-name]
 * After changing a headline or photo, re-run and commit the images.
 */
import fs from "node:fs";

const { chromium } = await import(process.env.PLAYWRIGHT_CORE || "playwright-core");
const SITE = "https://www.velto.com.bd";
const OUT = process.argv[2];
const ONLY = process.argv[3];
// The site's own Google proof (src/content/site.ts GOOGLE_PROOF, Sector 11 profile), same wording.
// Not on the Sector 18 card: that rating belongs to the Sector 11 profile.
const RATING = { en: { score: "5.0", line: "100+ Google reviews" }, bn: { score: "৫.০", line: "১০০+ Google রিভিউ" } };
// Sector 18's own Google profile (outlet settings in the Command Center: 4.9 from 8 reviews).
const RATING_SECTOR_18 = { en: { score: "4.9", line: "8 Google reviews" }, bn: { score: "৪.৯", line: "৮টি Google রিভিউ" } };
const STAR = `<svg width="22" height="22" viewBox="0 0 24 24"><path fill="#F4B400" d="M12 2.8l2.8 6 6.5.7-4.9 4.4 1.4 6.4L12 17l-5.8 3.3 1.4-6.4-4.9-4.4 6.5-.7z"/></svg>`;

// Share-card headlines: shorter and more direct than the page H1s, using only facts the site
// already states (thresholds from src/content/site.ts, outlet addresses from SHORT_ADDRESS).
const SHARE = {
  "/": ["Your laundry, picked up and brought back.", "আপনার লন্ড্রি, নিয়ে যাই, ফিরিয়ে দিই।"],
  "/services": ["Dry cleaning, wash & iron and more, picked up from your door.", "ড্রাই ক্লিনিং, ওয়াশ ও আয়রন আরও অনেক কিছু, দরজা থেকে পিকআপ।"],
  "/services/dry-cleaning": ["Suits, saris and sherwanis, dry‑cleaned and covered.", "স্যুট, শাড়ি ও শেরওয়ানি, ড্রাই ক্লিন করে কভারে ফেরত।"],
  "/services/wash-and-iron": ["Everyday clothes, washed, ironed and folded.", "প্রতিদিনের কাপড়, ধুয়ে, আয়রন করে, ভাঁজ করা।"],
  "/services/ironing": ["Washed at home? We iron it and bring it back.", "বাসায় ধোয়া? আমরা আয়রন করে ফিরিয়ে দিই।"],
  "/services/curtain-cleaning": ["Curtains cleaned and returned. Priced per square foot.", "পর্দা পরিষ্কার করে ফেরত। দাম বর্গফুট অনুযায়ী।"],
  "/services/carpet-cleaning": ["Carpets and rugs, cleaned and priced by size.", "কার্পেট ও রাগ, পরিষ্কার করা, দাম মাপ অনুযায়ী।"],
  "/services/blanket-comforter-cleaning": ["Blankets, comforters and quilts, cleaned and packed.", "কম্বল, কমফোর্টার ও লেপ, পরিষ্কার করে প্যাক করা।"],
  "/services/express": ["Need it back sooner? Ask for Express.", "তাড়াতাড়ি ফেরত দরকার? এক্সপ্রেস নিন।"],
  "/regular-laundry": ["Regular laundry, picked up every week or two.", "নিয়মিত লন্ড্রি, প্রতি এক বা দুই সপ্তাহে পিকআপ।"],
  "/pricing": ["Shirt, blazer, saree: see the price before you book.", "শার্ট, ব্লেজার, শাড়ি: বুক করার আগেই দাম দেখুন।"],
  "/how-it-works": ["Collected, tagged, cleaned, checked, returned.", "সংগ্রহ, ট্যাগ, পরিষ্কার, যাচাই, ফেরত।"],
  "/locations": ["Two outlets in Uttara. Pickup across Sectors 1–18.", "উত্তরায় দুটি শাখা। সেক্টর ১–১৮ জুড়ে পিকআপ।"],
  "/locations/sector-11": ["Velto Sector 11: House 2, Road 14.", "Velto সেক্টর ১১: বাড়ি ২, রোড ১৪।"],
  "/locations/sector-18": ["Velto Sector 18: RUAP, Poncoboti Bazar.", "Velto সেক্টর ১৮: RUAP, পঞ্চবটি বাজার।"],
  "/about": ["A laundry that works to a written process.", "একটি লন্ড্রি, যা লিখিত নিয়ম মেনে কাজ করে।"],
  "/book": ["Book a pickup. We collect from your door.", "পিকআপ বুক করুন। আমরা বাসা থেকে নিয়ে যাই।"],
  "/quote": ["Curtains, carpets or bedding? Get a quote first.", "পর্দা, কার্পেট বা বিছানাপত্র? আগে কোটেশন নিন।"],
  "/track": ["Where's my order? Check it here.", "আমার অর্ডার কোথায়? এখানেই দেখুন।"],
  "/login": ["Your orders, and where each one is.", "আপনার অর্ডার, আর প্রতিটি কোথায় আছে।"],
  "/signup": ["Create your Velto account.", "আপনার Velto অ্যাকাউন্ট খুলুন।"],
};
const P = (path, file, pos, en, bn, rating, left) => ({ path, file, pos, en: [en[0], SHARE[path]?.[0] ?? en[1]], bn: bn && [bn[0], SHARE[path]?.[1] ?? bn[1]], rating, left });
const PAGES = [
  P("/", "home/process-06-qc.jpg", "30% center", ["Uttara, Dhaka", "Laundry and dry cleaning in Uttara, with pickup from your door."], ["উত্তরা, ঢাকা", "উত্তরায় লন্ড্রি ও ড্রাই ক্লিনিং, আপনার দরজা থেকে পিকআপসহ।"], undefined, ["home/dry-cleaning.webp", "35% center"]),
  P("/services", "pages/finished-shirts-rail.webp", "center 40%", ["Services", "Dry cleaning, Wash & Iron, ironing and household items."], ["সার্ভিস", "ড্রাই ক্লিনিং, ওয়াশ ও আয়রন, আয়রন এবং ঘরের জিনিস।"], undefined, ["home/dry-cleaning.webp", "40% center"]),
  P("/services/dry-cleaning", "home/dry-cleaning.webp", "60% 40%", ["Dry Cleaning", "Dry cleaning for garments that need a closer look."], ["ড্রাই ক্লিনিং", "যেসব পোশাক ভালো করে দেখে নিতে হয়, সেগুলোর জন্য ড্রাই ক্লিনিং।"], undefined, ["home/delicate.jpg", "center"]),
  P("/services/wash-and-iron", "home/wash-and-iron.webp", "center 55%", ["Wash & Iron", "Everyday laundry, washed, ironed and brought back."], ["ওয়াশ ও আয়রন", "প্রতিদিনের লন্ড্রি, ধুয়ে, আয়রন করে ফিরিয়ে দেওয়া।"], undefined, ["home/process-07-packed.jpg", "center"]),
  P("/services/ironing", "home/ironing.webp", "45% 55%", ["Ironing", "Already washed? Send it for ironing."], ["আয়রন", "ধোয়া হয়ে গেছে? আয়রনের জন্য পাঠান।"], undefined, ["home/process-05-finished.jpg", "center 40%"]),
  P("/services/curtain-cleaning", "home/household-curtains.jpg", "35% center", ["Curtain Cleaning", "Curtain cleaning, priced by the square foot."], ["পর্দা পরিষ্কার", "পর্দা পরিষ্কার, দাম বর্গফুট অনুযায়ী।"], undefined, ["home/household-section.jpg", "60% center"]),
  P("/services/carpet-cleaning", "pages/carpet-woven.webp", "center", ["Carpet Cleaning", "Carpet cleaning, priced by size."], ["কার্পেট পরিষ্কার", "কার্পেট পরিষ্কার, দাম মাপ অনুযায়ী।"], undefined, ["home/household-section.jpg", "60% center"]),
  P("/services/blanket-comforter-cleaning", "pages/bedding-linen-stack.webp", "center", ["Blankets & Comforters", "Blankets, comforters and quilts, priced by type and size."], ["কম্বল ও কমফোর্টার", "কম্বল, কমফোর্টার ও লেপ, দাম ধরন ও মাপ অনুযায়ী।"], undefined, ["pages/bedding-folded.webp", "center"]),
  P("/services/express", "pages/finished-shirts-rail.webp", "center 40%", ["Express", "Need it back sooner? Ask about Express."], ["এক্সপ্রেস", "আরও তাড়াতাড়ি ফেরত দরকার? এক্সপ্রেসের কথা জিজ্ঞেস করুন।"], undefined, ["pages/finished-shirts-rail.webp", "center"]),
  P("/regular-laundry", "home/regular.webp", "center", ["Regular Laundry", "A regular laundry pickup, so the week takes care of itself."], ["নিয়মিত লন্ড্রি", "নিয়মিত লন্ড্রি পিকআপ, সপ্তাহের কাপড় নিয়ে আর ভাবতে হবে না।"], undefined, ["home/wash-and-iron.webp", "center"]),
  P("/pricing", "home/process-07-packed.jpg", "center", ["Pricing", "Find the price of an item before you book."], ["দাম", "বুক করার আগেই যেকোনো আইটেমের দাম দেখুন।"], undefined, ["pages/finished-shirts-rail.webp", "center"]),
  P("/how-it-works", "home/process-03-tagged.jpg", "center", ["How It Works", "From your door and back again."], ["যেভাবে কাজ করে", "আপনার দরজা থেকে, আবার আপনার দরজায়।"], undefined, ["home/process-05-finished.jpg", "center 40%"]),
  P("/locations", "locations/sector-11.webp", "center", ["Locations", "Two outlets in Uttara. Pickup across Sectors 1–18."], ["শাখা", "উত্তরায় দুটি শাখা। সেক্টর ১–১৮ জুড়ে পিকআপ।"], undefined, ["home/final.jpg", "center"]),
  P("/locations/sector-11", "locations/sector-11.webp", "center", ["Sector 11 outlet", "Laundry and dry cleaning in Uttara Sector 11."], ["সেক্টর ১১ শাখা", "উত্তরা সেক্টর ১১-এ লন্ড্রি ও ড্রাই ক্লিনিং।"], undefined, ["home/process-07-packed.jpg", "center"]),
  P("/locations/sector-18", "home/delicate.jpg", "center", ["Sector 18 outlet", "Laundry and dry cleaning in Uttara Sector 18."], ["সেক্টর ১৮ শাখা", "উত্তরা সেক্টর ১৮-এ লন্ড্রি ও ড্রাই ক্লিনিং।"], RATING_SECTOR_18, ["home/process-07-packed.jpg", "center"]),
  P("/about", "home/process-04-checked.jpg", "center 40%", ["About Velto", "A laundry in Uttara that works to a written process."], ["Velto সম্পর্কে", "উত্তরার একটি লন্ড্রি, যা লিখিত নিয়ম মেনে কাজ করে।"], undefined, ["home/process-04-checked.jpg", "center 40%"]),
  P("/book", "home/process-01-collected.jpg", "center", ["Book a pickup", "Book a pickup"], ["পিকআপ বুক করুন", "পিকআপ বুক করুন"], undefined, ["home/final.jpg", "center"]),
  P("/quote", "home/household-curtains.jpg", "35% center", ["Request a quote", "Request a quote"], ["কোটেশন চান", "কোটেশন চান"], undefined, ["home/household-section.jpg", "60% center"]),
  P("/track", "home/process-07-packed.jpg", "center", ["Track an order", "Where's my order?"], ["অর্ডার ট্র্যাক", "আমার অর্ডার কোথায়?"], undefined, ["home/process-03-tagged.jpg", "center"]),
  P("/login", "home/final.jpg", "center", ["My account", "Sign in"], ["আমার অ্যাকাউন্ট", "সাইন ইন"], undefined, ["home/final.jpg", "center"]),
  P("/signup", "home/process-06-qc.jpg", "30% center", ["My account", "Create your Velto account"], ["আমার অ্যাকাউন্ট", "আপনার Velto অ্যাকাউন্ট খুলুন"], undefined, ["home/final.jpg", "center"]),
  // Legal pages: English only (no Bangla version yet), plain, no rating.
  P("/privacy", "home/process-03-tagged.jpg", "center", ["Legal", "Privacy Policy"], null, false, ["home/final.jpg", "center"]),
  P("/terms", "home/process-03-tagged.jpg", "center", ["Legal", "Terms of Service"], null, false, ["home/final.jpg", "center"]),
  P("/cookies", "home/process-03-tagged.jpg", "center", ["Legal", "Cookie Policy"], null, false, ["home/final.jpg", "center"]),

];
const slug = (p) => (p === "/" ? "home" : p.slice(1).replace(/\//g, "-"));
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
// Everything that matters sits inside the centre 630×630: WhatsApp's small preview crops to it.
const LINE = { en: "Pickup across Uttara Sectors 1–18 · Free on ৳499+", bn: "উত্তরা সেক্টর ১–১৮ জুড়ে পিকআপ · ৳৪৯৯+ অর্ডারে ফ্রি" };
// Regular Laundry states only its own rule (src/content/site.ts REGULAR_FREE_DELIVERY_THRESHOLD).
const LINE_FOR = {
  "/regular-laundry": { en: "Fixed weekly or fortnightly pickup · Free on ৳300+", bn: "নির্দিষ্ট সাপ্তাহিক বা পাক্ষিক পিকআপ · ৳৩০০+ অর্ডারে ফ্রি" },
};
const card = (pg, lang) => {
  const [eyebrow, headline] = pg[lang];
  const n = headline.length;
  const size = (n > 50 ? 50 : n > 38 ? 56 : 62) - (lang === "bn" ? 6 : 0);
  const R = pg.rating && typeof pg.rating === "object" ? pg.rating : RATING;
  const rating = pg.rating === false ? "" : `
      <div style="display:inline-flex;align-self:flex-start;align-items:center;gap:14px;background:#fff;color:#002B4E;border-radius:12px;padding:12px 18px 11px">
        <div style="font-size:40px;line-height:1;font-weight:600;letter-spacing:-0.02em">${R[lang].score}</div>
        <div style="display:flex;flex-direction:column;gap:5px">
          <div style="display:flex;gap:2px">${STAR.repeat(5)}</div>
          <div style="font-size:${lang === "bn" ? 17 : 16}px;font-weight:600;color:#30373d;white-space:nowrap">${esc(R[lang].line)}</div>
        </div>
      </div>`;
  return `
<div id="card" lang="${lang}" style="position:fixed;inset:0 auto auto 0;width:1200px;height:630px;background:#002B4E;font-family:var(--font-instrument-sans),var(--font-bengali),sans-serif;z-index:99999;overflow:hidden">
  <img src="${SITE}/images/${pg.file}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:${pg.pos}" alt="">
  <div style="position:absolute;left:285px;top:0;width:630px;height:630px;background:#002B4E;color:#fff;box-sizing:border-box;padding:46px 46px 42px;display:flex;flex-direction:column;box-shadow:0 0 60px rgba(0,20,40,.45)">
    <div style="position:absolute;left:0;right:0;top:0;height:6px;background:#00A6E5"></div>
    <div style="display:flex;align-items:center;justify-content:space-between">
      <img src="${SITE}/brand/velto-logo-white.png" style="width:168px;height:auto;display:block" alt="">
      <div style="font-size:17px;font-weight:500;color:rgba(255,255,255,.72)">velto.com.bd</div>
    </div>
    <div style="margin-top:auto;display:flex;align-items:center;gap:12px;font-size:${lang === "bn" ? 21 : 18}px;font-weight:600;letter-spacing:${lang === "bn" ? 0 : 0.14}em;text-transform:uppercase;color:#00A6E5">
      <span style="width:30px;height:2px;background:#00A6E5;display:block"></span>${esc(eyebrow)}
    </div>
    <div style="margin-top:14px;font-size:${size}px;line-height:${lang === "bn" ? 1.28 : 1.06};font-weight:600;letter-spacing:${lang === "bn" ? 0 : -0.02}em;text-wrap:balance">${esc(headline)}</div>
    <div style="margin-top:auto;padding-top:26px;display:flex;flex-direction:column;gap:14px">
      ${rating}
      <div style="font-size:${lang === "bn" ? 19 : 18}px;font-weight:500;color:rgba(255,255,255,.9)">${esc((LINE_FOR[pg.path] ?? LINE)[lang])}</div>
    </div>
  </div>
</div>`;
};

  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const ctx = await b.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await ctx.addCookies([{ name: "velto_consent_v1", value: encodeURIComponent(JSON.stringify({ version: 1, analytics: false, marketing: false, timestamp: "2026-09-29T00:00:00.000Z" })), domain: "www.velto.com.bd", path: "/" }]);
  const p = await ctx.newPage();
  for (const lang of ["en", "bn"]) {
    // The site's stylesheet must be in place (its font variables), or the cards fall back to a serif.
    for (let t = 0; ; t++) {
      try {
        await p.goto(SITE + (lang === "bn" ? "/bn/about" : "/about"), { waitUntil: "networkidle", timeout: 45000 });
        const ok = await p.evaluate(() => getComputedStyle(document.body).getPropertyValue("--font-instrument-sans").trim() !== "");
        if (ok) break;
      } catch (e) {
        if (t >= 5) throw e;
      }
      if (t >= 5) throw new Error("The site's stylesheet did not load");
    }
    for (const pg of PAGES) {
      if ((ONLY && slug(pg.path) !== ONLY) || !pg[lang]) continue;
      await p.evaluate((html) => { document.getElementById("card")?.remove(); document.body.insertAdjacentHTML("beforeend", html); }, card(pg, lang));
      await p.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.querySelectorAll("#card img")].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))); });
      const bad = await p.evaluate(() => [...document.querySelectorAll("#card img")].filter((i) => !i.naturalWidth).map((i) => i.src));
      const font = await p.evaluate(() => document.fonts.check(`600 40px ${getComputedStyle(document.body).getPropertyValue("--font-instrument-sans").split(",")[0]}`));
      if (bad.length || !font) throw new Error(`${pg.path} (${lang}): ${bad.length ? `missing ${bad.join(", ")}` : "site font not loaded"}`);
      const name = `${slug(pg.path)}${lang === "bn" ? "-bn" : ""}.jpg`;
      await p.locator("#card").screenshot({ path: `${OUT}/${name}`, type: "jpeg", quality: 86 });
      console.log(name, fs.statSync(`${OUT}/${name}`).size);
    }
  }
  await b.close();
