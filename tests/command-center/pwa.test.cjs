/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");

const { swStrategy, swCanStore } = require("../../.command-center-test-build/lib/pwa/sw-rules.js");

const O = "https://www.velto.com.bd";
const req = (path, extra = {}) => {
  const headers = Object.fromEntries(Object.entries(extra.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  return { method: extra.method ?? "GET", url: path.startsWith("http") ? path : O + path, mode: extra.mode ?? "navigate", header: (n) => headers[n] ?? null };
};

test("personal and live pages are network-only (offline page on failure), data is never touched", () => {
  for (const path of [
    "/account", "/account/orders/VEL-01234", "/bn/account", "/login", "/signup", "/forgot-password", "/reset-password",
    "/book", "/book?service=ironing", "/bn/book", "/quote", "/track", "/admin", "/admin/prices", "/auth/confirm",
  ]) {
    assert.equal(swStrategy(req(path), O), "live", path);
    assert.equal(swStrategy(req(path, { mode: "cors" }), O), "passthrough", `${path} (fetch)`);
  }
  for (const path of ["/api/prices", "/api/collect", "/go/whatsapp", "/sw.js", "/manifest.webmanifest"]) {
    assert.equal(swStrategy(req(path), O), "passthrough", path);
  }
  assert.equal(swStrategy(req("/", { method: "POST" }), O), "passthrough", "form posts and server actions");
  assert.equal(swStrategy(req("/pricing", { headers: { RSC: "1" } }), O), "passthrough", "RSC payloads");
  assert.equal(swStrategy(req("/pricing", { headers: { "Next-Router-Prefetch": "1" } }), O), "passthrough", "prefetches");
  assert.equal(swStrategy(req("/pricing", { headers: { "Next-Action": "abc" } }), O), "passthrough", "server actions");
  assert.equal(swStrategy(req("/pricing?_rsc=1x2"), O), "passthrough");
  assert.equal(swStrategy(req("https://xyz.supabase.co/rest/v1/x"), O), "passthrough", "other sites");
  assert.equal(swStrategy(req("https://maps.google.com/"), O), "passthrough");
});

test("similar-looking public paths are not caught by the never-cache list", () => {
  assert.equal(swStrategy(req("/bookmarks"), O), "page");
  assert.equal(swStrategy(req("/services/dry-cleaning"), O), "page");
});

test("build files, brand art and photos get the right cache strategy", () => {
  assert.equal(swStrategy(req("/_next/static/chunks/app.js", { mode: "no-cors" }), O), "static");
  assert.equal(swStrategy(req("/brand/velto-logo.png", { mode: "no-cors" }), O), "static");
  assert.equal(swStrategy(req("/icons/icon-192.png", { mode: "no-cors" }), O), "static");
  assert.equal(swStrategy(req("/_next/image?url=%2Fimages%2Fhero.webp&w=640&q=75", { mode: "no-cors" }), O), "image");
  assert.equal(swStrategy(req("/images/home/hero.webp", { mode: "no-cors" }), O), "image");
});

test("public pages are network-first; other same-site fetches are left alone", () => {
  for (const p of ["/", "/pricing", "/bn", "/bn/pricing", "/services", "/locations/sector-11", "/offline"]) assert.equal(swStrategy(req(p), O), "page", p);
  assert.equal(swStrategy(req("/robots.txt", { mode: "cors" }), O), "passthrough");
  assert.equal(swStrategy(req("/about", { mode: "cors", headers: { accept: "text/html" } }), O), "page");
});

test("only complete, public responses are ever stored", () => {
  assert.equal(swCanStore(200, "basic", "public, max-age=0, must-revalidate"), true);
  assert.equal(swCanStore(200, "basic", null), true);
  assert.equal(swCanStore(200, "basic", "private, no-cache, no-store, max-age=0, must-revalidate"), false);
  assert.equal(swCanStore(200, "basic", "no-store"), false);
  assert.equal(swCanStore(206, "basic", null), false, "partial content");
  assert.equal(swCanStore(404, "basic", null), false);
  assert.equal(swCanStore(200, "opaque", null), false, "cross-site opaque");
  assert.equal(swCanStore(200, "opaqueredirect", null), false);
});

test("the rules can be inlined into the worker script (self-contained source)", () => {
  const inlined = new Function(`const f = ${swStrategy.toString()}; return f;`)();
  assert.equal(inlined(req("/account"), O), "live");
  assert.equal(inlined(req("/api/prices"), O), "passthrough");
  assert.equal(inlined(req("/pricing"), O), "page");
  const store = new Function(`const f = ${swCanStore.toString()}; return f;`)();
  assert.equal(store(200, "basic", "private"), false);
});
