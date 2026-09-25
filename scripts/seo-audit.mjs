/**
 * SEO audit against a running build (npm start). Crawls what Google would crawl
 * and fails on the mistakes that quietly cost rankings:
 *
 *  - sitemap URLs on the wrong host, or pages in it that aren't 200 / are noindex
 *  - missing, duplicate or wrong-host canonicals (e.g. a preview or localhost URL)
 *  - missing or duplicate titles and descriptions, missing/duplicate H1
 *  - malformed JSON-LD, missing share image
 *  - private routes (auth, account, admin, forms, legal) that are indexable
 *  - internal links and old-URL redirects that end in a 404
 *  - languages: hreflang en / bn / x-default and self-canonicals on translated pages, Bangla
 *    sitemap entries exactly matching BANGLA_READY_PATHS, untranslated /bn pages noindex with an
 *    English canonical and no hreflang, and (Bangla off) no /bn anywhere and /bn redirecting
 *
 * Usage: SEO_BASE_URL=http://127.0.0.1:3000 node scripts/seo-audit.mjs
 * The build must use NEXT_PUBLIC_SITE_URL=https://www.velto.com.bd (as in CI). Whether Bangla is on
 * is read from the running site; if NEXT_PUBLIC_BANGLA_ENABLED is set here, the site must match it.
 */
import { readFile } from "node:fs/promises";
import { requireTs } from "./lib/ts-require.mjs";

const { BANGLA_READY_PATHS, localizeHref } = requireTs("src/lib/i18n/config.ts");

const base = process.env.SEO_BASE_URL || process.env.LAUNCH_BASE_URL || "http://127.0.0.1:3000";
const origin = process.env.SEO_EXPECTED_ORIGIN || "https://www.velto.com.bd";

/** Must never be indexable, whether or not they are linked. */
const PRIVATE = ["/login", "/signup", "/forgot-password", "/reset-password", "/account", "/book", "/quote", "/track", "/privacy", "/terms", "/cookies"];

const failures = [];
const fail = (msg) => failures.push(msg);
const get = (path, init = {}) => fetch(new URL(path, base), { redirect: "manual", ...init });
const pathOf = (url) => {
  const u = new URL(url);
  return u.pathname.replace(/\/$/, "") || "/";
};

const decode = (s) =>
  s?.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const attr = (tag, name) => decode(tag.match(new RegExp(`${name}="([^"]*)"`, "i"))?.[1]);
function head(html) {
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
  const meta = (key, value) => metas.filter((t) => attr(t, key) === value).map((t) => attr(t, "content"));
  return {
    titles: [...html.matchAll(/<title[^>]*>([\s\S]*?)<\/title>/gi)].map((m) => decode(m[1].trim())),
    descriptions: meta("name", "description"),
    robots: meta("name", "robots").join(",").toLowerCase(),
    ogImage: meta("property", "og:image"),
    twitterImage: meta("name", "twitter:image"),
    ogUrl: meta("property", "og:url"),
    canonicals: [...html.matchAll(/<link\b[^>]*rel="canonical"[^>]*>/gi)].map((m) => attr(m[0], "href")),
    h1s: (html.match(/<h1\b/gi) ?? []).length,
    jsonLd: [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]),
    links: [...html.matchAll(/<a\b[^>]*href="(\/[^"#]*)[^"]*"/gi)].map((m) => m[1].split("?")[0] || "/"),
    hreflang: [...html.matchAll(/<link\b[^>]*rel="alternate"[^>]*>/gi)]
      .map((m) => ({ lang: attr(m[0], "hreflang"), href: attr(m[0], "href") }))
      .filter((l) => l.lang),
    htmlLang: html.match(/<html\b[^>]*\blang="([^"]*)"/i)?.[1],
    ogLocale: meta("property", "og:locale"),
  };
}

// robots.txt
const robots = await (await get("/robots.txt")).text();
if (!robots.includes(`Sitemap: ${origin}/sitemap.xml`)) fail(`robots.txt does not point to ${origin}/sitemap.xml`);
const disallows = (p) => robots.split("\n").some((line) => line.trim() === `Disallow: ${p}`);
for (const p of ["/admin", "/account", "/api/"]) if (!disallows(p)) fail(`robots.txt does not disallow ${p}`);

// sitemap
const sitemapXml = await (await get("/sitemap.xml")).text();
const sitemapUrls = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (!sitemapUrls.length) fail("sitemap.xml has no URLs");
for (const u of sitemapUrls) if (!u.startsWith(`${origin}/`) && u !== origin) fail(`sitemap URL on the wrong host: ${u}`);
const indexable = sitemapUrls.map(pathOf);
for (const p of PRIVATE) if (indexable.includes(p)) fail(`private route listed in sitemap: ${p}`);

// every sitemap page
const seenTitles = new Map();
const seenDescriptions = new Map();
const internal = new Set();
for (const path of indexable) {
  const res = await get(path);
  if (res.status !== 200) {
    fail(`${path} returned ${res.status}`);
    continue;
  }
  const h = head(await res.text());
  const expected = path === "/" ? [origin, `${origin}/`] : [`${origin}${path}`];
  if (h.canonicals.length !== 1) fail(`${path} has ${h.canonicals.length} canonical links`);
  else if (!expected.includes(h.canonicals[0])) fail(`${path} canonical is ${h.canonicals[0]}, expected ${expected[0]}`);
  if (h.robots.includes("noindex")) fail(`${path} is in the sitemap but noindex`);
  if (h.titles.length !== 1 || !h.titles[0]) fail(`${path} has ${h.titles.length} titles`);
  else if (seenTitles.has(h.titles[0])) fail(`duplicate title "${h.titles[0]}" on ${path} and ${seenTitles.get(h.titles[0])}`);
  else seenTitles.set(h.titles[0], path);
  if (h.titles[0] && h.titles[0].length > 65) fail(`${path} title is ${h.titles[0].length} characters (keep under ~65)`);
  if (h.descriptions.length !== 1 || !h.descriptions[0]) fail(`${path} has no single meta description`);
  else if (seenDescriptions.has(h.descriptions[0])) fail(`duplicate description on ${path} and ${seenDescriptions.get(h.descriptions[0])}`);
  else seenDescriptions.set(h.descriptions[0], path);
  if (h.h1s !== 1) fail(`${path} has ${h.h1s} <h1> elements`);
  if (!h.ogImage.length) fail(`${path} has no og:image`);
  if (!h.twitterImage.length) fail(`${path} has no twitter:image`);
  for (const u of [...h.ogUrl, ...h.canonicals, ...h.ogImage]) {
    if (/localhost|127\.0\.0\.1|vercel\.app/.test(u)) fail(`${path} metadata points to a non-production host: ${u}`);
  }
  for (const block of h.jsonLd) {
    try {
      const data = JSON.parse(block);
      for (const item of [data].flat()) if (!item["@context"]) fail(`${path} JSON-LD block without @context`);
    } catch {
      fail(`${path} has malformed JSON-LD`);
    }
  }
  for (const l of h.links) internal.add(l);
}

// private routes must not be indexable
for (const path of [...PRIVATE, "/admin"]) {
  const res = await get(path);
  if (res.status >= 300 && res.status < 400) continue; // redirects to sign-in: not indexable content
  const h = head(await res.text());
  // Shared links to these pages still show the brand card.
  if (res.status === 200 && (!h.ogImage.length || !h.twitterImage.length)) fail(`${path} has no share image (og:image / twitter:image)`);
  const disallowed = disallows(path);
  if (!h.robots.includes("noindex") && !disallowed) fail(`${path} is indexable (no noindex, not disallowed)`);
}

// internal links must resolve
for (const path of internal) {
  if (path.startsWith("/go/") || path.startsWith("/api/")) continue;
  let res = await get(path);
  if (res.status >= 300 && res.status < 400) res = await get(new URL(res.headers.get("location"), base).pathname);
  if (res.status === 404) fail(`internal link to ${path} is a 404`);
}

// languages
const abs = (path) => (path === "/" ? origin : `${origin}${path}`);
const bnProbe = await get("/bn");
const banglaOn = bnProbe.status === 200;
const expectedFlag = process.env.NEXT_PUBLIC_BANGLA_ENABLED;
if (expectedFlag !== undefined && banglaOn !== (expectedFlag === "true")) {
  fail(`Bangla is ${banglaOn ? "on" : "off"} on the site but NEXT_PUBLIC_BANGLA_ENABLED=${expectedFlag} here`);
}
const englishPages = indexable.filter((p) => !/^\/bn(\/|$)/.test(p));
const bnInSitemap = indexable.filter((p) => /^\/bn(\/|$)/.test(p));
const hreflangOf = (h, lang) => h.hreflang.filter((l) => l.lang.toLowerCase() === lang).map((l) => l.href);
for (const path of indexable) {
  const h = head(await (await get(path)).text());
  for (const l of h.hreflang) {
    if (!l.href?.startsWith(origin)) fail(`${path} hreflang ${l.lang} points off the production host: ${l.href}`);
  }
}
let languageChecks = 0;
if (!banglaOn) {
  if (![301, 302, 307, 308].includes(bnProbe.status)) fail(`/bn returned ${bnProbe.status} with Bangla off (expected a redirect)`);
  if (bnInSitemap.length) fail(`Bangla is off but the sitemap lists ${bnInSitemap.join(", ")}`);
  for (const path of englishPages) {
    const h = head(await (await get(path)).text());
    if (h.hreflang.length) fail(`${path} has hreflang links while Bangla is off`);
    const bn = await get(localizeHref(path, "bn"));
    const to = bn.headers.get("location") && new URL(bn.headers.get("location"), base).pathname.replace(/\/$/, "") || "/";
    if (![307, 308].includes(bn.status) || to !== path) fail(`${localizeHref(path, "bn")} returned ${bn.status} → ${to} with Bangla off (expected a redirect to ${path})`);
    languageChecks++;
  }
} else {
  const ready = englishPages.filter((p) => BANGLA_READY_PATHS.includes(p));
  const expectedBn = ready.map((p) => localizeHref(p, "bn")).sort();
  const listed = [...bnInSitemap].sort();
  for (const p of listed) if (!expectedBn.includes(p)) fail(`unexpected Bangla sitemap entry ${p} (not in BANGLA_READY_PATHS)`);
  for (const p of expectedBn) if (!listed.includes(p)) fail(`Bangla-ready page ${p} is missing from the sitemap`);
  for (const path of englishPages) {
    const bnPath = localizeHref(path, "bn");
    const enRes = await get(path);
    const bnRes = await get(bnPath);
    const en = head(await enRes.text());
    const bn = head(await bnRes.text());
    if (bnRes.status !== 200) {
      fail(`${bnPath} returned ${bnRes.status}`);
      continue;
    }
    if (bn.htmlLang !== "bn") fail(`${bnPath} has <html lang="${bn.htmlLang}">`);
    if (en.htmlLang !== "en") fail(`${path} has <html lang="${en.htmlLang}">`);
    if (BANGLA_READY_PATHS.includes(path)) {
      // Translated: both pages name each other and English as the default.
      for (const [page, h] of [[path, en], [bnPath, bn]]) {
        const want = { en: abs(path), bn: abs(bnPath), "x-default": abs(path) };
        for (const [lang, href] of Object.entries(want)) {
          const got = hreflangOf(h, lang);
          if (got.length !== 1 || got[0].replace(/\/$/, "") !== href.replace(/\/$/, "")) {
            fail(`${page} hreflang ${lang} is ${JSON.stringify(got)}, expected ${href}`);
          }
        }
        if (h.hreflang.length !== 3) fail(`${page} has ${h.hreflang.length} hreflang links (expected en, bn, x-default)`);
      }
      if (bn.canonicals.length !== 1 || bn.canonicals[0] !== abs(bnPath)) fail(`${bnPath} canonical is ${bn.canonicals[0]}, expected ${abs(bnPath)}`);
      if (bn.robots.includes("noindex") || /noindex/i.test(bnRes.headers.get("x-robots-tag") ?? "")) fail(`${bnPath} is translated but noindex`);
      if (bn.ogLocale[0] !== "bn_BD") fail(`${bnPath} og:locale is ${bn.ogLocale[0]}, expected bn_BD`);
    } else {
      // Not translated yet: must not be indexable as a duplicate of the English page.
      if (!bn.robots.includes("noindex")) fail(`${bnPath} is untranslated but has no noindex robots meta`);
      if (!/noindex/i.test(bnRes.headers.get("x-robots-tag") ?? "")) fail(`${bnPath} is untranslated but has no X-Robots-Tag: noindex`);
      if (bn.canonicals.length !== 1 || bn.canonicals[0] !== abs(path)) fail(`${bnPath} canonical is ${bn.canonicals[0]}, expected the English ${abs(path)}`);
      if (bn.hreflang.length) fail(`${bnPath} is untranslated but has hreflang links`);
      if (en.hreflang.length) fail(`${path} advertises a Bangla version that isn't translated (hreflang)`);
    }
    languageChecks++;
  }
  // Private pages stay private in Bangla too.
  for (const path of PRIVATE) {
    const bnPath = localizeHref(path, "bn");
    const res = await get(bnPath);
    if (res.status >= 300 && res.status < 400) continue;
    const h = head(await res.text());
    if (!h.robots.includes("noindex") && !/noindex/i.test(res.headers.get("x-robots-tag") ?? "")) fail(`${bnPath} is indexable`);
  }
}

// old-URL redirects must land on a real page
const config = await readFile(new URL("../next.config.ts", import.meta.url), "utf8");
for (const [, source, destination] of config.matchAll(/to\("([^"]+)",\s*"([^"]+)"\)/g)) {
  const probe = source.replace(":path*", "anything");
  const res = await get(probe);
  if (![301, 308].includes(res.status)) fail(`redirect ${source} returned ${res.status}, expected permanent`);
  let target = await get(destination);
  // A destination may redirect once more (e.g. /account sends signed-out visitors to /login).
  if (target.status >= 300 && target.status < 400) target = await get(new URL(target.headers.get("location"), base).pathname);
  if (target.status !== 200) fail(`redirect ${source} → ${destination} lands on ${target.status}`);
}

if (failures.length) {
  console.error(`SEO audit failed (${failures.length}):\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log(
  `SEO audit passed: ${indexable.length} sitemap pages (canonical, title, description, H1, JSON-LD, og:image), ${internal.size} internal links, ${PRIVATE.length + 1} private routes and all old-URL redirects. Languages (Bangla ${banglaOn ? "on" : "off"}): ${languageChecks} pages checked for hreflang, canonicals, indexing and ${banglaOn ? "sitemap entries" : "/bn redirects"}.`,
);
