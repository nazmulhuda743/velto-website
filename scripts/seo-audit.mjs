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
 *
 * Usage: SEO_BASE_URL=http://127.0.0.1:3000 node scripts/seo-audit.mjs
 * The build must use NEXT_PUBLIC_SITE_URL=https://www.velto.com.bd (as in CI).
 */
import { readFile } from "node:fs/promises";

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
    ogUrl: meta("property", "og:url"),
    canonicals: [...html.matchAll(/<link\b[^>]*rel="canonical"[^>]*>/gi)].map((m) => attr(m[0], "href")),
    h1s: (html.match(/<h1\b/gi) ?? []).length,
    jsonLd: [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]),
    links: [...html.matchAll(/<a\b[^>]*href="(\/[^"#]*)[^"]*"/gi)].map((m) => m[1].split("?")[0] || "/"),
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

// old-URL redirects must land on a real page
const config = await readFile(new URL("../next.config.ts", import.meta.url), "utf8");
for (const [, source, destination] of config.matchAll(/to\("([^"]+)",\s*"([^"]+)"\)/g)) {
  const probe = source.replace(":path*", "anything");
  const res = await get(probe);
  if (![301, 308].includes(res.status)) fail(`redirect ${source} returned ${res.status}, expected permanent`);
  const target = await get(destination);
  if (target.status !== 200) fail(`redirect ${source} → ${destination} lands on ${target.status}`);
}

if (failures.length) {
  console.error(`SEO audit failed (${failures.length}):\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log(
  `SEO audit passed: ${indexable.length} sitemap pages (canonical, title, description, H1, JSON-LD, og:image), ${internal.size} internal links, ${PRIVATE.length + 1} private routes and all old-URL redirects.`,
);
