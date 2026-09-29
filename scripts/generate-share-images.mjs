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
const TRUST = {
  en: ["Pickup across Uttara Sectors 1–18", "Every item tagged and checked", "Free pickup & delivery on ৳499+"],
  bn: ["উত্তরা সেক্টর ১–১৮ জুড়ে পিকআপ", "প্রতিটি আইটেম ট্যাগ ও যাচাই করা হয়", "৳৪৯৯+ অর্ডারে ফ্রি পিকআপ ও ডেলিভারি"],
};
// The site's own Google proof (src/content/site.ts GOOGLE_PROOF, Sector 11 profile), same wording.
const RATING = { en: { score: "5.0", line: "100+ Google reviews" }, bn: { score: "৫.০", line: "১০০+ Google রিভিউ" } };
const STAR = `<svg width="22" height="22" viewBox="0 0 24 24"><path fill="#F4B400" d="M12 2.8l2.8 6 6.5.7-4.9 4.4 1.4 6.4L12 17l-5.8 3.3 1.4-6.4-4.9-4.4 6.5-.7z"/></svg>`;
const P = (path, file, pos, en, bn) => ({ path, file, pos, en, bn });
const PAGES = [
  P("/", "home/hero.webp", "center 28%", ["Uttara, Dhaka", "Laundry and dry cleaning in Uttara, with pickup from your door."], ["উত্তরা, ঢাকা", "উত্তরায় লন্ড্রি ও ড্রাই ক্লিনিং, আপনার দরজা থেকে পিকআপসহ।"]),
  P("/services", "pages/finished-shirts-rail.webp", "center 40%", ["Services", "Dry cleaning, Wash & Iron, ironing and household items."], ["সার্ভিস", "ড্রাই ক্লিনিং, ওয়াশ ও আয়রন, আয়রন এবং ঘরের জিনিস।"]),
  P("/services/dry-cleaning", "home/dry-cleaning.webp", "40% 40%", ["Dry Cleaning", "Dry cleaning for garments that need a closer look."], ["ড্রাই ক্লিনিং", "যেসব পোশাক ভালো করে দেখে নিতে হয়, সেগুলোর জন্য ড্রাই ক্লিনিং।"]),
  P("/services/wash-and-iron", "home/wash-and-iron.webp", "center 55%", ["Wash & Iron", "Everyday laundry, washed, ironed and brought back."], ["ওয়াশ ও আয়রন", "প্রতিদিনের লন্ড্রি, ধুয়ে, আয়রন করে ফিরিয়ে দেওয়া।"]),
  P("/services/ironing", "home/ironing.webp", "45% 55%", ["Ironing", "Already washed? Send it for ironing."], ["আয়রন", "ধোয়া হয়ে গেছে? আয়রনের জন্য পাঠান।"]),
  P("/services/curtain-cleaning", "home/household-curtains.jpg", "35% center", ["Curtain Cleaning", "Curtain cleaning, priced by the square foot."], ["পর্দা পরিষ্কার", "পর্দা পরিষ্কার, দাম বর্গফুট অনুযায়ী।"]),
  P("/services/carpet-cleaning", "pages/carpet-woven.webp", "center", ["Carpet Cleaning", "Carpet cleaning, priced by size."], ["কার্পেট পরিষ্কার", "কার্পেট পরিষ্কার, দাম মাপ অনুযায়ী।"]),
  P("/services/blanket-comforter-cleaning", "pages/bedding-linen-stack.webp", "center", ["Blankets & Comforters", "Blankets, comforters and quilts, priced by type and size."], ["কম্বল ও কমফোর্টার", "কম্বল, কমফোর্টার ও লেপ, দাম ধরন ও মাপ অনুযায়ী।"]),
  P("/services/express", "pages/express-shirt-hanger.webp", "center", ["Express", "Need it back sooner? Ask about Express."], ["এক্সপ্রেস", "আরও তাড়াতাড়ি ফেরত দরকার? এক্সপ্রেসের কথা জিজ্ঞেস করুন।"]),
  P("/regular-laundry", "home/regular.webp", "center", ["Regular Laundry", "A regular laundry pickup, so the week takes care of itself."], ["নিয়মিত লন্ড্রি", "নিয়মিত লন্ড্রি পিকআপ, সপ্তাহের কাপড় নিয়ে আর ভাবতে হবে না।"]),
  P("/pricing", "home/process-07-packed.jpg", "center", ["Pricing", "Find the price of an item before you book."], ["দাম", "বুক করার আগেই যেকোনো আইটেমের দাম দেখুন।"]),
  P("/how-it-works", "home/process-03-tagged.jpg", "center", ["How It Works", "From your door and back again."], ["যেভাবে কাজ করে", "আপনার দরজা থেকে, আবার আপনার দরজায়।"]),
  P("/locations", "home/process-01-collected.jpg", "center", ["Locations", "Two outlets in Uttara. Pickup across Sectors 1–18."], ["শাখা", "উত্তরায় দুটি শাখা। সেক্টর ১–১৮ জুড়ে পিকআপ।"]),
  P("/locations/sector-11", "locations/sector-11.webp", "center", ["Sector 11 outlet", "Laundry and dry cleaning in Uttara Sector 11."], ["সেক্টর ১১ শাখা", "উত্তরা সেক্টর ১১-এ লন্ড্রি ও ড্রাই ক্লিনিং।"]),
  P("/locations/sector-18", "home/process-08-returned.jpg", "center 55%", ["Sector 18 outlet", "Laundry and dry cleaning in Uttara Sector 18."], ["সেক্টর ১৮ শাখা", "উত্তরা সেক্টর ১৮-এ লন্ড্রি ও ড্রাই ক্লিনিং।"]),
  P("/about", "home/process-06-qc.jpg", "30% center", ["About Velto", "A laundry in Uttara that works to a written process."], ["Velto সম্পর্কে", "উত্তরার একটি লন্ড্রি, যা লিখিত নিয়ম মেনে কাজ করে।"]),
];
const slug = (p) => (p === "/" ? "home" : p.slice(1).replace(/\//g, "-"));
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const card = (pg, lang) => {
  const [eyebrow, headline] = pg[lang];
  const size = headline.length > 52 ? 50 : headline.length > 38 ? 56 : 62;
  return `
<div id="card" lang="${lang}" style="position:fixed;inset:0 auto auto 0;width:1200px;height:630px;display:flex;background:#002B4E;color:#fff;font-family:var(--font-instrument-sans),var(--font-bengali),sans-serif;z-index:99999;overflow:hidden">
  <div style="width:664px;padding:56px 56px 48px 64px;display:flex;flex-direction:column">
    <div style="display:flex;align-items:center;justify-content:space-between">
      <img src="${SITE}/brand/velto-logo-white.png" style="width:188px;height:auto;display:block" alt="">
      <div style="font-size:18px;font-weight:500;color:rgba(255,255,255,.7);letter-spacing:.02em">velto.com.bd</div>
    </div>
    <div style="margin-top:auto">
      <div style="display:flex;align-items:center;gap:14px;font-size:${lang === "bn" ? 22 : 19}px;font-weight:600;letter-spacing:${lang === "bn" ? 0 : 0.14}em;text-transform:uppercase;color:#00A6E5">
        <span style="width:36px;height:2px;background:#00A6E5;display:block"></span>${esc(eyebrow)}
      </div>
      <div style="margin-top:18px;font-size:${lang === "bn" ? size - 6 : size}px;line-height:${lang === "bn" ? 1.3 : 1.08};font-weight:600;letter-spacing:${lang === "bn" ? 0 : -0.02}em;text-wrap:balance">${esc(headline)}</div>
    </div>
    <div style="margin-top:34px;padding-top:24px;border-top:1px solid rgba(255,255,255,.18);display:flex;flex-direction:column;gap:11px">
      ${TRUST[lang].map((t) => `<div style="display:flex;align-items:center;gap:12px;font-size:${lang === "bn" ? 21 : 20}px;color:rgba(255,255,255,.88)"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" stroke="#00A6E5" stroke-width="1.6"/><path d="M6 10.3l2.6 2.5L14 7.6" stroke="#00A6E5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>${esc(t)}</div>`).join("")}
    </div>
  </div>
  <div style="position:relative;flex:1;">
    <img src="${SITE}/images/${pg.file}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:${pg.pos}" alt="">
    <div style="position:absolute;left:0;top:0;bottom:0;width:6px;background:#00A6E5"></div>
    <div style="position:absolute;left:34px;bottom:30px;background:#fff;color:#002B4E;border-radius:14px;padding:16px 22px 15px;box-shadow:0 10px 30px rgba(0,20,40,.28);display:flex;align-items:center;gap:16px">
      <div style="font-size:46px;line-height:1;font-weight:600;letter-spacing:-0.02em">${RATING[lang].score}</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;gap:3px">${STAR.repeat(5)}</div>
        <div style="font-size:${lang === "bn" ? 18 : 17}px;font-weight:600;color:#30373d;white-space:nowrap">${esc(RATING[lang].line)}</div>
      </div>
    </div>
  </div>
</div>`;
};
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const ctx = await b.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await ctx.addCookies([{ name: "velto_consent_v1", value: encodeURIComponent(JSON.stringify({ version: 1, analytics: false, marketing: false, timestamp: "2026-09-29T00:00:00.000Z" })), domain: "www.velto.com.bd", path: "/" }]);
  const p = await ctx.newPage();
  for (const lang of ["en", "bn"]) {
    for (let t = 0; t < 4; t++) { try { await p.goto(SITE + (lang === "bn" ? "/bn/about" : "/about"), { waitUntil: "networkidle", timeout: 45000 }); break; } catch (e) { if (t === 3) throw e; } }
    for (const pg of PAGES) {
      if (ONLY && slug(pg.path) !== ONLY) continue;
      await p.evaluate((html) => { document.getElementById("card")?.remove(); document.body.insertAdjacentHTML("beforeend", html); }, card(pg, lang));
      await p.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.querySelectorAll("#card img")].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))); });
      const bad = await p.evaluate(() => [...document.querySelectorAll("#card img")].filter((i) => !i.naturalWidth).map((i) => i.src));
      if (bad.length) console.log("MISSING", bad);
      const name = `${slug(pg.path)}${lang === "bn" ? "-bn" : ""}.jpg`;
      await p.locator("#card").screenshot({ path: `${OUT}/${name}`, type: "jpeg", quality: 86 });
      console.log(name, fs.statSync(`${OUT}/${name}`).size);
    }
  }
  await b.close();
