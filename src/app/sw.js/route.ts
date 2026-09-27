import { swCanStore, swStrategy } from "@/lib/pwa/sw-rules";

/**
 * The service worker (installable app + offline page). Served from a route so every deploy gets a
 * new version string: the browser installs the new worker and old caches are dropped, so nobody
 * is left on old files. The routing rules are unit-tested (lib/pwa/sw-rules.ts).
 *
 * NEXT_PUBLIC_PWA_ENABLED=false turns it into a kill switch: the worker removes its caches and
 * unregisters itself on the next visit.
 */
export const dynamic = "force-dynamic";

const VERSION = (process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || "dev").slice(0, 24);
const ENABLED = process.env.NEXT_PUBLIC_PWA_ENABLED !== "false";

const KILL = `
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith("velto-")) await caches.delete(key);
    await self.registration.unregister();
  })());
});
`;

const WORKER = `
const VERSION = ${JSON.stringify(VERSION)};
const STATIC = "velto-static-" + VERSION;
const PAGES = "velto-pages-" + VERSION;
const IMAGES = "velto-images-v1";
const KEEP = [STATIC, PAGES, IMAGES];
const OFFLINE = "/offline";
const MAX_IMAGES = 60;
const MAX_PAGES = 40;
const PAGE_TIMEOUT_MS = 4000;

const swStrategy = ${swStrategy.toString()};
const swCanStore = ${swCanStore.toString()};

const storable = (res) => swCanStore(res.status, res.type, res.headers.get("cache-control"));

async function trim(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - max))) await cache.delete(key);
}

// Install: keep the offline page and the files it needs, so it renders with no connection.
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const pages = await caches.open(PAGES);
    const res = await fetch(OFFLINE, { cache: "reload", credentials: "omit" });
    if (!res.ok) throw new Error("offline page unavailable");
    const html = await res.clone().text();
    await pages.put(OFFLINE, res);
    const assets = [...new Set(html.match(/\\/_next\\/static\\/[^"'\\s)]+/g) || [])];
    const statics = await caches.open(STATIC);
    await Promise.all([...assets, "/icons/icon-192.png"].map((u) => statics.add(u).catch(() => {})));
  })());
});

// Activate: drop caches from earlier versions.
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith("velto-") && !KEEP.includes(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const strategy = swStrategy({ method: req.method, url: req.url, mode: req.mode, header: (n) => req.headers.get(n) }, self.location.origin);
  if (strategy === "passthrough") return;

  if (strategy === "static") {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (storable(res)) cache.put(req, res.clone());
      return res;
    })());
    return;
  }

  if (strategy === "image") {
    event.respondWith((async () => {
      const cache = await caches.open(IMAGES);
      const hit = await cache.match(req);
      const fresh = fetch(req).then((res) => {
        if (storable(res)) cache.put(req, res.clone()).then(() => trim(IMAGES, MAX_IMAGES));
        return res;
      });
      if (hit) {
        event.waitUntil(fresh.catch(() => {}));
        return hit;
      }
      return fresh;
    })());
    return;
  }

  // Personal and live pages: the network only. Nothing is stored; offline shows the offline page.
  if (strategy === "live") {
    event.respondWith(fetch(req).catch(async () => (await caches.match(OFFLINE)) || Response.error()));
    return;
  }

  // Public pages: always the network when it answers; a copy only when it doesn't.
  event.respondWith((async () => {
    const cache = await caches.open(PAGES);
    const url = new URL(req.url);
    const network = fetch(req).then((res) => {
      if (!url.search && storable(res)) cache.put(req, res.clone()).then(() => trim(PAGES, MAX_PAGES));
      return res;
    });
    const fallback = async () => (await cache.match(req)) || (await cache.match(req, { ignoreSearch: true })) || (await cache.match(OFFLINE));
    try {
      const slow = new Promise((resolve) => setTimeout(() => resolve("slow"), PAGE_TIMEOUT_MS));
      const first = await Promise.race([network, slow]);
      if (first !== "slow") return first;
      const copy = (await cache.match(req)) || (await cache.match(req, { ignoreSearch: true }));
      return copy || (await network);
    } catch {
      return (await fallback()) || Response.error();
    }
  })());
});
`;

export function GET() {
  return new Response(ENABLED ? WORKER : KILL, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // Browsers must always check for a new worker.
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Service-Worker-Allowed": "/",
    },
  });
}
