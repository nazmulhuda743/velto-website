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
const STAR = `<svg width="22" height="22" viewBox="0 0 24 24"><path fill="#F4B400" d="M12 2.8l2.8 6 6.5.7-4.9 4.4 1.4 6.4L12 17l-5.8 3.3 1.4-6.4-4.9-4.4 6.5-.7z"/></svg>`;
const P = (path, file, pos, en, bn, rating, left) => ({ path, file, pos, en, bn, rating, left });
const PAGES = [
  P("/", "home/final.jpg", "center", ["Uttara, Dhaka", "Laundry and dry cleaning in Uttara, with pickup from your door."], ["উত্তরা, ঢাকা", "উত্তরায় লন্ড্রি ও ড্রাই ক্লিনিং, আপনার দরজা থেকে পিকআপসহ।"], undefined, ["home/dry-cleaning.webp", "35% center"]),
  P("/services", "pages/finished-shirts-rail.webp", "center 40%", ["Services", "Dry cleaning, Wash & Iron, ironing and household items."], ["সার্ভিস", "ড্রাই ক্লিনিং, ওয়াশ ও আয়রন, আয়রন এবং ঘরের জিনিস।"], undefined, ["home/dry-cleaning.webp", "40% center"]),
  P("/services/dry-cleaning", "home/dry-cleaning.webp", "40% 40%", ["Dry Cleaning", "Dry cleaning for garments that need a closer look."], ["ড্রাই ক্লিনিং", "যেসব পোশাক ভালো করে দেখে নিতে হয়, সেগুলোর জন্য ড্রাই ক্লিনিং।"], undefined, ["home/delicate.jpg", "center"]),
  P("/services/wash-and-iron", "home/wash-and-iron.webp", "center 55%", ["Wash & Iron", "Everyday laundry, washed, ironed and brought back."], ["ওয়াশ ও আয়রন", "প্রতিদিনের লন্ড্রি, ধুয়ে, আয়রন করে ফিরিয়ে দেওয়া।"], undefined, ["home/process-07-packed.jpg", "center"]),
  P("/services/ironing", "home/ironing.webp", "45% 55%", ["Ironing", "Already washed? Send it for ironing."], ["আয়রন", "ধোয়া হয়ে গেছে? আয়রনের জন্য পাঠান।"], undefined, ["home/process-05-finished.jpg", "center 40%"]),
  P("/services/curtain-cleaning", "home/household-curtains.jpg", "35% center", ["Curtain Cleaning", "Curtain cleaning, priced by the square foot."], ["পর্দা পরিষ্কার", "পর্দা পরিষ্কার, দাম বর্গফুট অনুযায়ী।"], undefined, ["home/household-section.jpg", "60% center"]),
  P("/services/carpet-cleaning", "pages/carpet-woven.webp", "center", ["Carpet Cleaning", "Carpet cleaning, priced by size."], ["কার্পেট পরিষ্কার", "কার্পেট পরিষ্কার, দাম মাপ অনুযায়ী।"], undefined, ["home/household-section.jpg", "60% center"]),
  P("/services/blanket-comforter-cleaning", "pages/bedding-linen-stack.webp", "center", ["Blankets & Comforters", "Blankets, comforters and quilts, priced by type and size."], ["কম্বল ও কমফোর্টার", "কম্বল, কমফোর্টার ও লেপ, দাম ধরন ও মাপ অনুযায়ী।"], undefined, ["pages/bedding-folded.webp", "center"]),
  P("/services/express", "pages/express-shirt-hanger.webp", "center", ["Express", "Need it back sooner? Ask about Express."], ["এক্সপ্রেস", "আরও তাড়াতাড়ি ফেরত দরকার? এক্সপ্রেসের কথা জিজ্ঞেস করুন।"], undefined, ["pages/finished-shirts-rail.webp", "center"]),
  P("/regular-laundry", "home/regular.webp", "center", ["Regular Laundry", "A regular laundry pickup, so the week takes care of itself."], ["নিয়মিত লন্ড্রি", "নিয়মিত লন্ড্রি পিকআপ, সপ্তাহের কাপড় নিয়ে আর ভাবতে হবে না।"], undefined, ["home/wash-and-iron.webp", "center"]),
  P("/pricing", "home/process-07-packed.jpg", "center", ["Pricing", "Find the price of an item before you book."], ["দাম", "বুক করার আগেই যেকোনো আইটেমের দাম দেখুন।"], undefined, ["pages/finished-shirts-rail.webp", "center"]),
  P("/how-it-works", "home/process-03-tagged.jpg", "center", ["How It Works", "From your door and back again."], ["যেভাবে কাজ করে", "আপনার দরজা থেকে, আবার আপনার দরজায়।"], undefined, ["home/process-05-finished.jpg", "center 40%"]),
  P("/locations", "locations/sector-11.webp", "center", ["Locations", "Two outlets in Uttara. Pickup across Sectors 1–18."], ["শাখা", "উত্তরায় দুটি শাখা। সেক্টর ১–১৮ জুড়ে পিকআপ।"], undefined, ["home/final.jpg", "center"]),
  P("/locations/sector-11", "locations/sector-11.webp", "center", ["Sector 11 outlet", "Laundry and dry cleaning in Uttara Sector 11."], ["সেক্টর ১১ শাখা", "উত্তরা সেক্টর ১১-এ লন্ড্রি ও ড্রাই ক্লিনিং।"], undefined, ["home/process-07-packed.jpg", "center"]),
  P("/locations/sector-18", "home/delicate.jpg", "center", ["Sector 18 outlet", "Laundry and dry cleaning in Uttara Sector 18."], ["সেক্টর ১৮ শাখা", "উত্তরা সেক্টর ১৮-এ লন্ড্রি ও ড্রাই ক্লিনিং।"], false, ["home/process-07-packed.jpg", "center"]),
  P("/about", "home/process-06-qc.jpg", "30% center", ["About Velto", "A laundry in Uttara that works to a written process."], ["Velto সম্পর্কে", "উত্তরার একটি লন্ড্রি, যা লিখিত নিয়ম মেনে কাজ করে।"], undefined, ["home/process-04-checked.jpg", "center 40%"]),
];
const slug = (p) => (p === "/" ? "home" : p.slice(1).replace(/\//g, "-"));
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
// Everything that matters sits inside the centre 630×630: WhatsApp's small preview crops to it.
const LINE = { en: "Pickup across Uttara Sectors 1–18 · Free on ৳499+", bn: "উত্তরা সেক্টর ১–১৮ জুড়ে পিকআপ · ৳৪৯৯+ অর্ডারে ফ্রি" };
const card = (pg, lang) => {
  const [eyebrow, headline] = pg[lang];
  const n = headline.length;
  const size = (n > 50 ? 44 : n > 36 ? 50 : 56) - (lang === "bn" ? 5 : 0);
  const rating = pg.rating === false ? "" : `
      <div style="display:inline-flex;align-self:flex-start;align-items:center;gap:14px;background:#fff;color:#002B4E;border-radius:12px;padding:12px 18px 11px">
        <div style="font-size:40px;line-height:1;font-weight:600;letter-spacing:-0.02em">${RATING[lang].score}</div>
        <div style="display:flex;flex-direction:column;gap:5px">
          <div style="display:flex;gap:2px">${STAR.repeat(5)}</div>
          <div style="font-size:${lang === "bn" ? 17 : 16}px;font-weight:600;color:#30373d;white-space:nowrap">${esc(RATING[lang].line)}</div>
        </div>
      </div>`;
  return `
<div id="card" lang="${lang}" style="position:fixed;inset:0 auto auto 0;width:1200px;height:630px;background:#002B4E;font-family:var(--font-instrument-sans),var(--font-bengali),sans-serif;z-index:99999;overflow:hidden">
  <img src="${SITE}/images/${pg.left[0]}" style="position:absolute;left:0;top:0;width:285px;height:630px;object-fit:cover;object-position:${pg.left[1]}" alt="">
  <img src="${SITE}/images/${pg.file}" style="position:absolute;right:0;top:0;width:285px;height:630px;object-fit:cover;object-position:${pg.pos}" alt="">
  <div style="position:absolute;left:285px;top:0;width:630px;height:630px;background:#002B4E;color:#fff;box-sizing:border-box;padding:46px 44px 42px;display:flex;flex-direction:column">
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
      <div style="font-size:${lang === "bn" ? 19 : 18}px;font-weight:500;color:rgba(255,255,255,.9)">${esc(LINE[lang])}</div>
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
      if (ONLY && slug(pg.path) !== ONLY) continue;
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
