import assert from "node:assert/strict";

/**
 * Installable-app smoke checks against a running server (npm run test:pwa after next start).
 * Browser behaviour (offline fallback, never-cached pages) is covered by the unit tests in
 * tests/command-center/pwa.test.cjs and the manual checklist in docs/technical/PWA.md.
 */
const base = process.env.LAUNCH_BASE_URL || "http://127.0.0.1:3000";
const get = (path) => fetch(new URL(path, base), { redirect: "manual" });

const manifest = await get("/manifest.webmanifest");
assert.equal(manifest.status, 200, "manifest must be served (not rewritten by the proxy)");
assert.match(manifest.headers.get("content-type") ?? "", /manifest\+json/);
const m = await manifest.json();
assert.equal(m.start_url, "/", "start_url stays plain so launches don't overwrite campaign attribution");
assert.equal(m.display, "standalone");
for (const size of ["192x192", "512x512"]) assert.ok(m.icons.some((i) => i.sizes === size && i.purpose === "any"), `icon ${size}`);
assert.ok(m.icons.some((i) => i.purpose === "maskable"), "maskable icon");
for (const icon of m.icons) assert.equal((await get(icon.src)).status, 200, icon.src);

const sw = await get("/sw.js");
assert.equal(sw.status, 200);
assert.match(sw.headers.get("content-type") ?? "", /javascript/);
assert.match(sw.headers.get("cache-control") ?? "", /no-store/, "the worker must never be cached");
const script = await sw.text();
new Function(script); // parses
assert.match(script, /const swStrategy = /, "routing rules are inlined");

const offline = await get("/offline");
assert.equal(offline.status, 200);
const html = await offline.text();
assert.match(html, /noindex/, "offline page is not indexed");
assert.match(html, /https:\/\/wa\.me\/\d+/, "offline WhatsApp link works without the /go redirect");

const home = await (await get("/")).text();
assert.match(home, /<link rel="manifest" href="\/manifest\.webmanifest"/);
console.log("PWA smoke checks passed.");
