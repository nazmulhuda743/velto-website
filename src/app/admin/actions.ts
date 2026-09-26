"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { IMAGE_SLOTS } from "@/content/mock";
import { getSeoRoute } from "@/content/seo-routes";
import { saveContent, uploadImage } from "@/lib/admin/content-store";
import { SEEN_COOKIE } from "@/lib/admin/notifications";
import { logServerEvent } from "@/lib/analytics/store";
import { logActivity } from "@/lib/admin/activity";
import { slotName } from "@/lib/admin/image-pages";
import { homeFor } from "@/lib/admin/permissions";
import { getAdmin, requireSection, signIn, signOut } from "@/lib/admin/session";
import { supabaseFetch } from "@/lib/supabase-server";
import { getSiteContent, readCharge, type ReviewEntry, type SiteSettings } from "@/lib/site-content";

const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);
const file = (form: FormData, key: string) => {
  const f = form.get(key);
  return f instanceof File && f.size > 0 ? f : null;
};
const back = (path: string, params: Record<string, string>): never =>
  redirect(`${path}${path.includes("?") ? "&" : "?"}${new URLSearchParams(params)}`);
const failure = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong.").slice(0, 160);
/** Health Center record of a failed admin save/upload (kind + route only). */
const logFailure = (kind: "media_upload_error" | "content_save_error", route: string) => logServerEvent(kind, route);

/* ---------- session ---------- */

export async function loginAction(_: unknown, form: FormData): Promise<{ error: string } | undefined> {
  const email = text(form, "email", 200);
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };
  const result = await signIn(email, password);
  if (!result.ok) {
    return {
      error:
        result.reason === "role"
          ? "This account doesn't have admin access to the website dashboard."
          : result.reason === "credentials"
            ? "Email or password is incorrect."
            : "Sign-in is unavailable right now. Try again shortly.",
    };
  }
  await logActivity(result.admin, { section: "session", action: "signed_in", summary: "Signed in" });
  redirect(homeFor(result.admin.role));
}

export async function logoutAction() {
  const admin = await getAdmin();
  if (admin) await logActivity(admin, { section: "session", action: "signed_out", summary: "Signed out" });
  await signOut();
  redirect("/admin/login");
}

/** Top-level fields that differ, with one level of nesting ("announcement.text"). */
function changedKeys(before: Record<string, unknown>, after: Record<string, unknown>, prefix = "", depth = 0): string[] {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  return [...keys].flatMap((k) => {
    const a = before?.[k];
    const b = after?.[k];
    if (JSON.stringify(a) === JSON.stringify(b)) return [];
    if (depth < 1 && a && b && typeof a === "object" && typeof b === "object") {
      return changedKeys(a as Record<string, unknown>, b as Record<string, unknown>, `${prefix}${k}.`, depth + 1);
    }
    return [`${prefix}${k}`];
  });
}

/* ---------- settings ---------- */

export async function saveSettingsAction(form: FormData) {
  const admin = await requireSection("settings");
  const { settings } = await getSiteContent();
  const whatsapp = text(form, "whatsappNumber", 20).replace(/\D/g, "");
  if (!/^\d{8,15}$/.test(whatsapp)) back("/admin/settings", { error: "WhatsApp number must include the country code, e.g. 8801605162788." });
  const href = text(form, "announcementHref", 300);
  if (href && !/^(\/|https:\/\/)/.test(href)) back("/admin/settings", { error: "Announcement link must start with / or https://" });

  const chargeRaw = text(form, "pickupChargeTaka", 6);
  const pickupChargeTaka = chargeRaw === "" ? null : readCharge(Number(chargeRaw));
  if (chargeRaw !== "" && pickupChargeTaka === null) back("/admin/settings", { error: "Pickup & delivery charge must be a whole number of taka from 0 to 2000, or empty." });

  const next: SiteSettings = {
    whatsappNumber: whatsapp,
    announcement: {
      enabled: form.get("announcementEnabled") === "on",
      text: text(form, "announcementText", 160),
      textBn: text(form, "announcementTextBn", 160),
      href,
    },
    outlets: { ...settings.outlets },
    pickupChargeTaka,
  };
  for (const id of Object.keys(next.outlets) as (keyof SiteSettings["outlets"])[]) {
    const count = Number(text(form, `${id}.reviewCount`, 7));
    next.outlets[id] = {
      rating: text(form, `${id}.rating`, 4) || settings.outlets[id].rating,
      reviewCount: Number.isInteger(count) && count >= 0 ? count : settings.outlets[id].reviewCount,
      hours: text(form, `${id}.hours`, 80) || settings.outlets[id].hours,
    };
  }
  try {
    await saveContent("settings", next, admin.name);
  } catch (e) {
    await logFailure("content_save_error", "/admin/settings");
    back("/admin/settings", { error: failure(e) });
  }
  const changed = changedKeys(settings as unknown as Record<string, unknown>, next as unknown as Record<string, unknown>);
  await logActivity(admin, {
    section: "settings",
    action: "settings_saved",
    summary: changed.length ? `Updated site settings: ${changed.join(", ")}` : "Saved site settings (no changes)",
    detail: { changed },
  });
  back("/admin/settings", { saved: "1" });
}

/* ---------- SEO ---------- */

export async function saveSeoAction(form: FormData) {
  const admin = await requireSection("seo");
  const path = text(form, "path", 200);
  if (!getSeoRoute(path)) back("/admin/seo", { error: "Unknown page." });
  const editUrl = `/admin/seo/edit`;
  const { seo } = await getSiteContent();
  const entry = { ...(seo[path] ?? {}) };

  if (form.get("reset") === "1") {
    delete (seo as Record<string, unknown>)[path];
  } else {
    entry.title = text(form, "title", 120) || undefined;
    entry.description = text(form, "description", 320) || undefined;
    entry.titleBn = text(form, "titleBn", 120) || undefined;
    entry.descriptionBn = text(form, "descriptionBn", 320) || undefined;
    entry.noindex = form.get("noindex") === "on";
    try {
      const upload = file(form, "ogImage");
      if (upload) entry.ogImage = await uploadImage(upload, "seo");
      else if (form.get("removeOgImage") === "on") entry.ogImage = undefined;
    } catch (e) {
      await logFailure("media_upload_error", "/admin/seo");
      back(editUrl, { path, error: failure(e) });
    }
    seo[path] = entry;
  }
  try {
    await saveContent("seo", seo, admin.name);
  } catch (e) {
    await logFailure("content_save_error", "/admin/seo");
    back(editUrl, { path, error: failure(e) });
  }
  const reset = form.get("reset") === "1";
  await logActivity(admin, {
    section: "seo",
    action: reset ? "seo_reset" : "seo_saved",
    target: path,
    summary: reset ? `Reset the search text for ${path} to the default` : `Updated the search text for ${path}`,
    detail: reset ? {} : { title: entry.title ?? null, noindex: entry.noindex ?? false, ogImage: Boolean(entry.ogImage) },
  });
  back(editUrl, { path, saved: "1" });
}

/* ---------- images ---------- */

export async function saveImageAction(form: FormData) {
  const admin = await requireSection("images");
  const id = text(form, "id", 80);
  if (!IMAGE_SLOTS.some((s) => s.id === id)) back("/admin/images", { error: "Unknown image slot." });
  const { images } = await getSiteContent();
  const page = text(form, "page", 40).replace(/[^a-z0-9-]/g, "");
  const target = `/admin/images${page ? `?page=${page}` : ""}`;

  const before = images[id];
  let uploaded = false;
  if (form.get("reset") === "1") {
    delete images[id];
  } else {
    const upload = file(form, "image");
    uploaded = Boolean(upload);
    const alt = text(form, "alt", 300);
    const altBn = text(form, "altBn", 300);
    const position = text(form, "position", 40);
    const current = images[id];
    if (!upload && !current) back(target, { error: "Choose an image to upload.", slot: id });
    try {
      images[id] = {
        src: upload ? await uploadImage(upload, id) : current!.src,
        alt: alt || current?.alt,
        // Emptying the Bangla field clears it (Bangla pages then use the built-in or English text).
        altBn: altBn || undefined,
        position: /^[\w% .-]*$/.test(position) && position ? position : current?.position,
        updatedAt: new Date().toISOString(),
      };
    } catch (e) {
      await logFailure("media_upload_error", "/admin/images");
      back(target, { error: failure(e), slot: id });
    }
  }
  try {
    await saveContent("images", images, admin.name);
  } catch (e) {
    await logFailure("content_save_error", "/admin/images");
    back(target, { error: failure(e), slot: id });
  }
  const name = slotName(id);
  const after = images[id];
  await logActivity(admin, {
    section: "images",
    action: form.get("reset") === "1" ? "image_restored" : uploaded ? "image_replaced" : "image_details_saved",
    target: id,
    summary:
      form.get("reset") === "1"
        ? `Restored the original photo for ${name}`
        : uploaded
          ? `Replaced the photo for ${name}`
          : `Updated alt text / focus for ${name}`,
    detail: { before: before?.src ?? null, after: after?.src ?? null, alt: after?.alt ?? null, position: after?.position ?? null },
  });
  back(target, { saved: id });
}

/* ---------- reviews ---------- */

function reviewFromForm(form: FormData, id: string): ReviewEntry | string {
  const name = text(form, "name", 80);
  const body = String(form.get("text") ?? "").replace(/\r\n/g, "\n").trim().slice(0, 4000);
  if (!name || !body) return "A review needs the customer's name and the review text.";
  const rating = Number(form.get("rating"));
  const sourceUrl = text(form, "sourceUrl", 500);
  const branch = form.get("branch");
  return {
    id,
    name,
    text: body,
    platform: form.get("platform") === "Facebook" ? "Facebook" : "Google",
    rating: form.get("rating") === "recommends" ? "recommends" : rating >= 1 && rating <= 5 ? rating : null,
    branch: branch === "sector-11" || branch === "sector-18" ? branch : undefined,
    sourceUrl: /^https:\/\//.test(sourceUrl) ? sourceUrl : null,
    showOnHome: form.get("showOnHome") === "on",
  };
}

export async function saveReviewAction(form: FormData) {
  const admin = await requireSection("reviews");
  const reviews = [...(await getSiteContent()).reviews];
  const op = String(form.get("op") ?? "save");
  const id = text(form, "id", 40);
  const index = reviews.findIndex((r) => r.id === id);
  const existingName = index >= 0 ? reviews[index].name : null;

  if (op === "add") {
    const review = reviewFromForm(form, `review-${Date.now().toString(36)}`);
    if (typeof review === "string") back("/admin/reviews", { error: review });
    reviews.unshift(review as ReviewEntry);
  } else if (index === -1) {
    back("/admin/reviews", { error: "Review not found." });
  } else if (op === "delete") {
    reviews.splice(index, 1);
  } else if (op === "up" || op === "down") {
    const to = op === "up" ? index - 1 : index + 1;
    if (to >= 0 && to < reviews.length) [reviews[index], reviews[to]] = [reviews[to], reviews[index]];
  } else {
    const review = reviewFromForm(form, id);
    if (typeof review === "string") back("/admin/reviews", { error: review });
    reviews[index] = review as ReviewEntry;
  }
  try {
    await saveContent("reviews", reviews, admin.name);
  } catch (e) {
    await logFailure("content_save_error", "/admin/reviews");
    back("/admin/reviews", { error: failure(e) });
  }
  const who = (op === "add" ? reviews[0]?.name : existingName) || "a customer";
  const verb = { add: "Added", delete: "Deleted", up: "Moved up", down: "Moved down" }[op] ?? "Edited";
  await logActivity(admin, { section: "reviews", action: `review_${op}`, target: op === "add" ? reviews[0]?.id : id, summary: `${verb} the review by ${who}` });
  back("/admin/reviews", { saved: "1" });
}

/* ---------- notifications ---------- */

export async function markNotificationsReadAction() {
  await requireSection("notifications");
  (await cookies()).set(SEEN_COOKIE, String(Date.now()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    maxAge: 60 * 60 * 24 * 90,
  });
  redirect("/admin/notifications");
}

/* ---------- customer account links ---------- */

const LINK_DECISIONS = new Set(["approve", "reject", "unlink"]);

/**
 * Staff verification of "Link my Velto history": approve only after calling the phone on
 * the Ops customer record. The database re-checks the phone match and one-account rule.
 */
export async function decideLinkAction(form: FormData) {
  const admin = await requireSection("accounts");
  const target = "/admin/accounts";
  const userId = text(form, "authUserId", 40);
  const decision = text(form, "decision", 10);
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !LINK_DECISIONS.has(decision)) back(target, { error: "Unknown request." });
  if (decision === "approve" && form.get("confirmed") !== "on") {
    back(target, { error: "Tick the box to confirm you verified the number by phone before approving." });
  }
  const res = await supabaseFetch("/rest/v1/rpc/portal_link_decide", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ p_auth_user_id: userId, p_decision: decision, p_decided_by: admin.name, p_method: "staff_callback" }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    back(target, { error: (body?.message ?? `Failed with HTTP ${res.status}`).slice(0, 160) });
  }
  const verb = { approve: "Approved", reject: "Rejected", unlink: "Unlinked" }[decision] ?? decision;
  await logActivity(admin, { section: "accounts", action: `link_${decision}`, target: userId, summary: `${verb} a customer's order-history link` });
  back(target, { saved: decision });
}

/* ---------- bring-back list ---------- */

const RETENTION_BUCKETS = new Set(["second", "due", "winback"]);
const RETENTION_OUTCOMES = new Set(["messaged", "not_now", "wrong_number", "opt_out"]);

/** Staff record of a bring-back contact; the list then hides that customer for a while. */
export async function logRetentionAction(form: FormData) {
  const admin = await requireSection("retention");
  const bucket = text(form, "bucket", 10);
  const outcome = text(form, "outcome", 20);
  const customerId = text(form, "customerId", 40);
  const lang = text(form, "lang", 2) === "en" ? "en" : "bn";
  const target = "/admin/retention";
  if (!RETENTION_BUCKETS.has(bucket) || !RETENTION_OUTCOMES.has(outcome) || !/^[0-9a-f-]{36}$/i.test(customerId)) {
    back(target, { error: "Unknown request." });
  }
  const res = await supabaseFetch("/rest/v1/rpc/website_retention_log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ p_customer_id: customerId, p_bucket: bucket, p_outcome: outcome, p_staff_name: admin.name }),
    cache: "no-store",
  }).catch(() => null);
  if (!res?.ok) back(target, { bucket, lang, error: "Couldn't save that. Please try again." });
  const label = { messaged: "Messaged", not_now: "Marked not now", wrong_number: "Marked wrong number", opt_out: "Marked don't contact" }[outcome];
  await logActivity(admin, { section: "retention", action: `retention_${outcome}`, target: customerId, summary: `${label}: a customer on the ${bucket} list` });
  back(target, { bucket, lang, saved: outcome });
}
