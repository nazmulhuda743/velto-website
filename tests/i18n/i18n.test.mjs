import assert from "node:assert/strict";
import test from "node:test";
import { requireTs } from "../../scripts/lib/ts-require.mjs";

/**
 * Bangla / English content checks: both languages have the same shape, the Bangla
 * service pages keep the English data (images, price-list names, columns), and no
 * English copy was left untranslated in a Bangla file.
 */
const { en } = requireTs("src/content/i18n/en.ts");
const { bn } = requireTs("src/content/i18n/bn.ts");
const { pagesEn } = requireTs("src/content/i18n/pages/en.ts");
const { pagesBn } = requireTs("src/content/i18n/pages/bn.ts");
const { formsEn } = requireTs("src/content/i18n/forms/en.ts");
const { formsBn } = requireTs("src/content/i18n/forms/bn.ts");
const { accountEn } = requireTs("src/content/i18n/account/en.ts");
const { accountBn } = requireTs("src/content/i18n/account/bn.ts");
const { todayEn } = requireTs("src/content/i18n/admin-today/en.ts");
const { todayBn } = requireTs("src/content/i18n/admin-today/bn.ts");
const { todayText, TODAY_LANG_COOKIE } = requireTs("src/content/i18n/admin-today/index.ts");
const { SERVICE_PAGES, servicePages } = requireTs("src/content/services.ts");
const { BANGLA_READY_PATHS } = requireTs("src/lib/i18n/config.ts");
const { SHORT_ADDRESS } = requireTs("src/content/seo-routes.ts");
const { IMAGE_SLOTS } = requireTs("src/content/mock.ts");
const { LOCATIONS } = requireTs("src/content/site.ts");

/** Every key path of an object, with arrays checked element by element. */
function shape(value, path = "") {
  if (Array.isArray(value)) return [`${path}[]#${value.length}`, ...value.flatMap((v, i) => shape(v, `${path}[${i}]`))];
  if (value && typeof value === "object") return Object.keys(value).sort().flatMap((k) => shape(value[k], path ? `${path}.${k}` : k));
  return [`${path}:${typeof value}`];
}

/** Record-style maps whose keys may legitimately differ between languages. */
const FREE_MAPS = ["imageAlts", "locationHours", "seo", "priceUnits"];
const withoutFreeMaps = (dict) => Object.fromEntries(Object.entries(dict).filter(([k]) => !FREE_MAPS.includes(k)));

test("UI dictionary: Bangla has exactly the English keys", () => {
  assert.deepEqual(shape(withoutFreeMaps(bn)), shape(withoutFreeMaps(en)));
});

test("page text: Bangla has exactly the English keys", () => {
  assert.deepEqual(shape(pagesBn), shape(pagesEn));
});

test("form text: Bangla has exactly the English keys", () => {
  assert.deepEqual(shape(formsBn), shape(formsEn));
});

test("account text: Bangla has exactly the English keys", () => {
  assert.deepEqual(shape(accountBn), shape(accountEn));
});

test("every built-in photo has Bangla alt text", () => {
  // Admin-replaced photos can add their own (Admin → Images); built-in ones must not fall back to English.
  const missing = IMAGE_SLOTS.map((s) => s.id).filter((id) => !bn.imageAlts[id]);
  assert.deepEqual(missing, []);
});

test("service pages: Bangla keeps every service's structure and data", () => {
  const bnPages = servicePages("bn");
  assert.deepEqual(bnPages.map((s) => s.slug), SERVICE_PAGES.map((s) => s.slug));
  for (const [i, e] of SERVICE_PAGES.entries()) {
    const b = bnPages[i];
    const at = e.slug;
    for (const key of ["image", "primary", "secondary", "heroGoogleProof"]) assert.deepEqual(b[key], e[key], `${at}.${key}`);
    assert.equal(b.intro.length, e.intro.length, `${at}.intro`);
    assert.deepEqual(b.blocks.map((x) => x.type), e.blocks.map((x) => x.type), `${at} block order`);
    e.blocks.forEach((eb, j) => {
      const bb = b.blocks[j];
      const where = `${at}.blocks[${j}] (${eb.type})`;
      if (eb.type === "prices") {
        assert.deepEqual(bb.columns, eb.columns, `${where} columns`);
        assert.deepEqual(bb.groups.map((g) => g.names), eb.groups.map((g) => g.names), `${where} price-list names`);
        assert.equal(bb.searchHint, eb.searchHint, `${where} search hint`);
        assert.equal(Boolean(bb.note), Boolean(eb.note), `${where} note`);
      }
      if (eb.type === "process") {
        assert.deepEqual(bb.image, eb.image, `${where} image`);
        assert.equal(bb.steps.length, eb.steps.length, `${where} steps`);
      }
      if (eb.type === "compare") assert.equal(bb.current, eb.current, `${where} current`);
      if (eb.type === "review") assert.equal(bb.review, eb.review, `${where} review (never translated)`);
      if (eb.type === "scope") assert.equal(bb.groups.length, eb.groups.length, `${where} groups`);
      if (eb.type === "notes") assert.equal(bb.items.length, eb.items.length, `${where} items`);
      if (eb.type === "measure") {
        assert.equal(bb.steps.length, eb.steps.length, `${where} steps`);
        assert.equal(bb.examples.length, eb.examples.length, `${where} examples`);
      }
      if (eb.type === "facts") {
        assert.equal(bb.rows.length, eb.rows.length, `${where} rows`);
        assert.equal(bb.steps?.steps.length, eb.steps?.steps.length, `${where} steps`);
        assert.equal(Boolean(bb.footnote), Boolean(eb.footnote), `${where} footnote`);
      }
    });
    // Shared questions by the same key, custom questions in the same places.
    assert.deepEqual(
      b.faq.items.map((x) => (typeof x === "string" ? x : `custom:${x.a.length}`)),
      e.faq.items.map((x) => (typeof x === "string" ? x : `custom:${x.a.length}`)),
      `${at}.faq`,
    );
    for (const s of [e, b]) {
      if (s.h1Highlight) assert.ok(s.h1.includes(s.h1Highlight), `${at}: highlight "${s.h1Highlight}" is not in the H1`);
    }
  }
});

/** Words that stay in Latin script on Bangla pages (brands, platforms, addresses). */
const LATIN_OK =
  /\b(?:Velto|Premium|Laundry|WhatsApp|Google|Facebook|Instagram|Meta|Pixel|Analytics|RUAP|House|Road|Poncoboti|Bazar|English)\b|\b01X+\b|\bX{3,}\b|\bVEL-\d+/g;
/** Keys that hold data, not copy (price-list item names, search terms, slugs). */
// booking.items.placeholder: example searches, in English because the price list is (they must match it).
const DATA_KEYS =
  /(?:^|\.)(?:names|searchHint|slug|primary|secondary|current|columns|type)(?:\[|\.|$)|faq\.items\[\d+\]$|priceFinder\.examples|meta\.siteName|language\.switchTo|booking\.items\.placeholder$/;

function untranslated(english, bangla, path = "", found = []) {
  if (typeof bangla === "string") {
    // Street addresses stay as written (they match Google Maps and what riders use).
    const copy = LOCATIONS.reduce((text, l) => text.replaceAll(l.address, "").replaceAll(SHORT_ADDRESS[l.id], ""), bangla);
    if (!DATA_KEYS.test(path) && /[A-Za-z]{3,}/.test(copy.replace(LATIN_OK, "").replace(/\{\w+\}/g, ""))) found.push(`${path}: ${bangla}`);
  } else if (bangla && typeof bangla === "object") {
    for (const k of Object.keys(bangla)) untranslated(english?.[k], bangla[k], Array.isArray(bangla) ? `${path}[${k}]` : path ? `${path}.${k}` : k, found);
  }
  return found;
}

test("Bangla copy has no untranslated English left in it", () => {
  // Images and customer reviews are data; reviews are shown as the customer wrote them.
  const omit = (obj, keys) => Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));
  const services = servicePages("bn").map((page) => ({
    ...omit(page, ["image", "blocks"]),
    blocks: page.blocks.map((block) => omit(block, ["review", "image"])),
  }));
  assert.deepEqual(
    [
      ...untranslated(en, bn),
      ...untranslated(pagesEn, pagesBn),
      ...untranslated(formsEn, formsBn),
      ...untranslated(accountEn, accountBn),
      ...untranslated(SERVICE_PAGES, services, "services"),
    ],
    [],
  );
});

test("only translated pages are advertised in Bangla", () => {
  const paths = ["/", "/services", ...SERVICE_PAGES.map((s) => `/services/${s.slug}`), "/pricing", "/how-it-works", "/regular-laundry", "/locations", "/locations/sector-11", "/locations/sector-18", "/about"];
  for (const p of BANGLA_READY_PATHS) assert.ok(paths.includes(p), `${p} is marked Bangla-ready but has no Bangla page text`);
  for (const p of BANGLA_READY_PATHS.filter((p) => !p.startsWith("/services/"))) {
    // Search titles are required for every advertised page except service pages (they carry their own meta).
    assert.ok(bn.seo[p]?.title && bn.seo[p]?.description, `${p} has no Bangla search title/description`);
  }
});

/** Today page: function values are called with sample arguments so both languages can be compared. */
function todayShape(value, path = "") {
  if (typeof value === "function") return [`${path}:fn${value.length}`];
  if (value && typeof value === "object") return Object.keys(value).sort().flatMap((k) => todayShape(value[k], path ? `${path}.${k}` : k));
  return [`${path}:${typeof value}`];
}
/** These take text that is already in the page language (a window label, a name), so the sample is text. */
const TODAY_TEXT_ARGS = ["confirmFor", "assignTo", "everyWeekday", "fullAsk"];
function todayStrings(value, path = "", out = []) {
  if (typeof value === "function") out.push([path, TODAY_TEXT_ARGS.includes(path) ? value("X", "Y") : value(3, 5)]);
  else if (value && typeof value === "object") for (const k of Object.keys(value)) todayStrings(value[k], path ? `${path}.${k}` : k, out);
  else out.push([path, value]);
  return out;
}

test("Today text: Bangla has exactly the English keys and function shapes", () => {
  assert.deepEqual(todayShape(todayBn), todayShape(todayEn));
  assert.deepEqual(Object.keys(todayBn.windows).sort(), ["afternoon", "evening", "morning"]);
});

test("Today text: every value is a non-empty string, Bangla shows Bangla digits and no stray English", () => {
  for (const [key, value] of todayStrings(todayEn)) {
    assert.equal(typeof value, "string", `en.${key}`);
    assert.ok(value.trim().length > 0, `en.${key} is empty`);
  }
  for (const [key, value] of todayStrings(todayBn)) {
    assert.equal(typeof value, "string", `bn.${key}`);
    assert.ok(value.trim().length > 0, `bn.${key} is empty`);
    assert.ok(!/[0-9]/.test(value), `bn.${key} has Western digits: ${value}`);
    const latin = value.replace(/\b(?:Velto|Ops|WhatsApp)\b/g, "");
    assert.ok(!/[A-Za-z]{3,}/.test(latin), `bn.${key} has untranslated English: ${value}`);
  }
});

test("Today text: exact English copy and Bangla digits", () => {
  assert.equal(todayEn.title, "Today");
  assert.deepEqual(todayEn.tabs, { call: "Call", assign: "Assign", deliver: "Deliver", route: "Route" });
  assert.equal(todayEn.lateNote(1), "1 customer waiting over 30 min");
  assert.equal(todayEn.lateNote(3), "3 customers waiting over 30 min");
  assert.equal(todayEn.confirmFor("Evening 4–8"), "Confirmed for Evening 4–8");
  assert.equal(todayEn.readySince("9:40"), "Ready since 9:40");
  assert.equal(todayEn.stopsOf(3, 8), "3/8 stops");
  assert.equal(todayEn.opsDown("9:40"), "Can't reach Velto Ops right now. Showing the list from 9:40.");
  assert.equal(todayEn.firstOrder, "First website order · 10% off");
  assert.equal(todayBn.stopsOf(3, 8), "৩/৮ স্টপ");
  assert.equal(todayBn.readySince("9:40"), "প্রস্তুত ৯:৪০ থেকে");
  assert.equal(todayBn.windows.evening, "সন্ধ্যা ৪–৮");
  assert.equal(todayEn.windows.morning, "Morning 9–12");
});

test("Today text: todayText picks the language and the cookie name is fixed", () => {
  assert.equal(TODAY_LANG_COOKIE, "velto_admin_lang");
  assert.equal(todayText("en"), todayEn);
  assert.equal(todayText("bn"), todayBn);
});

test("care approval copy: same keys in both languages, every Ops risk type in customer words", () => {
  const { careText } = requireTs("src/content/i18n/care.ts");
  const en = careText("en");
  const bn = careText("bn");
  assert.deepEqual(Object.keys(bn).sort(), Object.keys(en).sort());
  // The list Velto Ops offers staff at intake (velto-ops-pwa RISK_TYPES).
  const ops = [
    "Colour may bleed / run",
    "Dark or red / indigo — loose dye",
    "Dust or dirt on collar / cuffs (sets if ironed)",
    "Delicate — beads / sequins / zari work",
    "Dry-clean only — no water wash",
    "Shrinkage risk",
    "Pre-existing damage may worsen",
    "Colour-fastness uncertain — needs test",
    "Embroidery / print may lift",
    "Other — see note",
  ];
  for (const type of ops) {
    assert.ok(en.types[type], `English for ${type}`);
    assert.ok(bn.types[type], `Bangla for ${type}`);
  }
  assert.equal(bn.garments(3), "৩টি কাপড়");
  assert.equal(en.banner(2), "2 orders need your approval");
});
