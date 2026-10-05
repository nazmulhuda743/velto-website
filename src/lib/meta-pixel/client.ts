/**
 * Browser runtime for the Meta Pixel. The only module that calls fbq().
 *
 * - Loaded once, asynchronously, and only after the visitor allows Marketing (the consent gate is
 *   src/components/consent/MetaPixel.tsx). Before that, nothing is queued and nothing is sent.
 * - Events arrive from one place: track() in src/components/layout/Analytics.tsx, the site's
 *   single analytics choke point. Components never call this module directly, so a click can
 *   only produce the Meta events its one analytics event maps to (src/lib/meta-pixel/events.ts).
 * - PageView is sent once per path: the Pixel's own History API auto-PageView is switched off
 *   (fbq.disablePushState) and a repeated page_view for the same path (React Strict Mode
 *   re-running an effect in development) is ignored.
 * - Automatic configuration (button-click scraping, page metadata) is off, and no advanced
 *   matching data is passed: Meta receives only the parameters built in events.ts.
 */
import { isMetaExcludedPath, metaCallsFor, pageViewCalls, type MetaCall, type MetaContext } from "./events";

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  push?: unknown;
  loaded?: boolean;
  version?: string;
  disablePushState?: boolean;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

const SCRIPT_SRC = "https://connect.facebook.net/en_US/fbevents.js";

let pixelId: string | null = null;
let state: "off" | "on" | "revoked" = "off";
let lastPagePath: string | undefined;
let blockedWarned = false;

/** Random id per event: lets a future Conversions API send the same event_id for deduplication. */
const eventId = (name: string) =>
  `${name}.${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}.${Math.random().toString(36).slice(2)}`}`;

function send(call: MetaCall) {
  const fbq = window.fbq;
  if (!fbq || !pixelId) return;
  const method = call.kind === "standard" ? "trackSingle" : "trackSingleCustom";
  // trackSingle* targets only this Pixel, even if another Pixel was initialised on the page.
  fbq(method, pixelId, call.name, call.params, { eventID: eventId(call.name) });
}

function installBase() {
  if (window.fbq) {
    // Another Pixel base is already on the page (most likely a Meta tag left in GTM). Reuse it,
    // but say so: its own event tags would double-count against these.
    console.warn("[meta-pixel] fbq was already defined before Velto's Pixel loaded. Remove any other Meta Pixel (for example in GTM) to avoid duplicate events.");
    return;
  }
  // Official Meta base code, unminified. Like Meta's snippet, it queues the arguments object itself.
  // One addition: it drops calls this module never makes (broadcast track/trackCustom, and init of
  // any other Pixel). Those can only come from other code on the page, such as an old Meta tag in
  // GTM, and would count events twice in Velto's Pixel.
  const fbq: Fbq = function () {
    // eslint-disable-next-line prefer-rest-params
    const [method, id] = arguments as unknown as unknown[];
    if (method === "track" || method === "trackCustom" || (method === "init" && id !== pixelId)) {
      if (!blockedWarned) {
        blockedWarned = true;
        console.warn(`[meta-pixel] Ignored fbq('${String(method)}') from outside src/lib/meta-pixel. Remove any other Meta Pixel code (for example in GTM).`);
      }
      return;
    }
    // eslint-disable-next-line prefer-rest-params
    if (fbq.callMethod) fbq.callMethod(...Array.from(arguments));
    // eslint-disable-next-line prefer-rest-params
    else fbq.queue!.push(arguments);
  };
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  // Next.js navigation calls history.pushState; without this the Pixel would send its own PageView
  // on every route change on top of ours.
  fbq.disablePushState = true;
  window.fbq = fbq;
  window._fbq ??= fbq;

  const script = document.createElement("script");
  script.async = true;
  script.src = SCRIPT_SRC;
  document.head.appendChild(script);
}

/** Start (or resume) the Pixel. Safe to call repeatedly; the base loads once per document. */
export function startMetaPixel(id: string) {
  if (state === "on") return;
  if (state === "revoked") {
    window.fbq?.("consent", "grant");
    state = "on";
    sendPage(window.location.pathname);
    return;
  }
  pixelId = id;
  installBase();
  window.fbq!("set", "autoConfig", false, id);
  window.fbq!("init", id);
  state = "on";
  // The page_view for the current page usually happened before consent: send it now.
  sendPage(window.location.pathname);
}

/** Marketing consent withdrawn: Meta stops receiving anything until it is granted again. */
export function stopMetaPixel() {
  if (state !== "on") return;
  window.fbq?.("consent", "revoke");
  state = "revoked";
}

export const isMetaPixelLoaded = () => state !== "off";

/** PageView (+ ViewContent on service/outlet pages), once per path. */
export function sendPage(pathname: string) {
  if (state !== "on" || isMetaExcludedPath(pathname) || pathname === lastPagePath) return;
  lastPagePath = pathname;
  for (const call of pageViewCalls(pathname)) send(call);
}

/** Forward one site analytics event (from track()) to Meta, mapped by events.ts. */
export function sendMetaEvent(event: string, context: MetaContext) {
  if (typeof window === "undefined") return;
  const pathname = window.location.pathname;
  if (event === "page_view") {
    sendPage(pathname);
    return;
  }
  if (state !== "on" || isMetaExcludedPath(pathname)) return;
  for (const call of metaCallsFor(event, context, pathname)) send(call);
}
