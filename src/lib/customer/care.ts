import "server-only";

import { supabaseFetch, supabaseOrigin } from "../supabase-server";
import { customerSupabase } from "./supabase";

/**
 * Care approvals for the signed-in customer (docs/technical/sql/website_care.sql). The database
 * answers only for the caller's own linked orders; photos are then signed here for ten minutes.
 */
export type CareRisk = { item: string; type: string | null; note: string | null; photos: string[] };
export type CareState = {
  orderNumber: string;
  status: "pending" | "approved" | "declined";
  decidedOnWebsite: boolean;
  decidedAt: string | null;
  risks: CareRisk[];
};

const PHOTO_BUCKET = "order-photos";
const SAFE_PATH = /^[A-Za-z0-9/_.-]{1,200}$/;

/** The order's care decision, or null (not theirs, nothing to decide, or unavailable). */
export async function getCare(orderNumber: string): Promise<CareState | null> {
  const supabase = await customerSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("portal_care_get", { p_order_number: orderNumber });
  if (error) {
    // Before website_care.sql is applied the function doesn't exist: the page simply has no section.
    if (error.code !== "PGRST202") console.error("portal_care_get_failed", error.code);
    return null;
  }
  return (data ?? null) as CareState | null;
}

/** Orders waiting for the caller's decision (account home). */
export async function getCarePending(): Promise<{ orderNumber: string; items: number }[]> {
  const supabase = await customerSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("portal_care_pending");
  if (error) {
    if (error.code !== "PGRST202") console.error("portal_care_pending_failed", error.code);
    return [];
  }
  return Array.isArray(data) ? (data as { orderNumber: string; items: number }[]) : [];
}

/** Ten-minute links to the garment photos staff took (only for paths the database just returned). */
export async function signedRiskPhotos(paths: string[]): Promise<string[]> {
  const safe = paths.filter((p) => SAFE_PATH.test(p) && !p.includes("..")).slice(0, 12);
  const urls = await Promise.all(
    safe.map(async (p) => {
      const res = await supabaseFetch(`/storage/v1/object/sign/${PHOTO_BUCKET}/${p.split("/").map(encodeURIComponent).join("/")}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresIn: 600 }),
        cache: "no-store",
      }).catch(() => null);
      if (!res?.ok) return null;
      const body = (await res.json().catch(() => null)) as { signedURL?: unknown } | null;
      return typeof body?.signedURL === "string" && body.signedURL.startsWith("/") ? `${supabaseOrigin()}/storage/v1${body.signedURL}` : null;
    }),
  );
  return urls.filter((u): u is string => Boolean(u));
}
