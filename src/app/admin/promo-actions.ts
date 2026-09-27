"use server";

import { redirect } from "next/navigation";
import { logActivity } from "@/lib/admin/activity";
import { saveContent, uploadImage } from "@/lib/admin/content-store";
import { requireSection } from "@/lib/admin/session";
import { logServerEvent } from "@/lib/analytics/store";
import { POPUP_FREQUENCIES, popupFingerprint, popupProblem, promoHrefOk, type PopupFrequency, type PromoPopup } from "@/lib/promo";
import { getSiteContent, type SiteSettings } from "@/lib/site-content";

const PAGE = "/admin/promo";
const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);
const back = (params: Record<string, string>): never => redirect(`${PAGE}?${new URLSearchParams(params)}`);
const failure = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong.").slice(0, 160);

/* ---------- top bar ---------- */

/** The announcement bar above the header: moving (default) or still, one or several messages. */
export async function savePromoBarAction(form: FormData) {
  const admin = await requireSection("promo");
  const { settings } = await getSiteContent();
  const href = text(form, "href", 300);
  if (!promoHrefOk(href)) back({ error: "The top bar link must be a page like /pricing or a full https:// address.", tab: "bar" });
  const next: SiteSettings = {
    ...settings,
    announcement: {
      enabled: form.get("enabled") === "on",
      still: form.get("still") === "on",
      text: text(form, "text", 400),
      textBn: text(form, "textBn", 400),
      href,
    },
  };
  if (next.announcement.enabled && !next.announcement.text) back({ error: "Write the message before switching the top bar on.", tab: "bar" });
  try {
    await saveContent("settings", next, admin.name);
  } catch (e) {
    await logServerEvent("content_save_error", PAGE);
    back({ error: failure(e), tab: "bar" });
  }
  const before = settings.announcement;
  const after = next.announcement;
  const state = !after.enabled ? "off" : after.still ? "still" : "moving";
  await logActivity(admin, {
    section: "promo",
    action: "promo_bar_saved",
    summary: `Top bar ${state}: ${after.text ? `“${after.text.slice(0, 60)}${after.text.length > 60 ? "…" : ""}”` : "no message"}`,
    detail: { before, after },
  });
  back({ saved: "bar", tab: "bar" });
}

/* ---------- popup ---------- */

/** The campaign popup: text, link, poster, frequency and dates. Switching on needs a complete popup. */
export async function savePromoPopupAction(form: FormData) {
  const admin = await requireSection("promo");
  const { promo } = await getSiteContent();
  const frequency = text(form, "frequency", 10) as PopupFrequency;
  const delay = Number(text(form, "delaySeconds", 3));
  const next: PromoPopup = {
    ...promo,
    enabled: form.get("enabled") === "on",
    imageAlt: text(form, "imageAlt", 300),
    imageAltBn: text(form, "imageAltBn", 300),
    tag: text(form, "tag", 40),
    tagBn: text(form, "tagBn", 40),
    title: text(form, "title", 120),
    titleBn: text(form, "titleBn", 120),
    body: text(form, "body", 400),
    bodyBn: text(form, "bodyBn", 400),
    cta: text(form, "cta", 40),
    ctaBn: text(form, "ctaBn", 40),
    href: text(form, "href", 300),
    frequency: POPUP_FREQUENCIES.includes(frequency) ? frequency : "day",
    delaySeconds: Number.isInteger(delay) && delay >= 0 && delay <= 60 ? delay : 3,
    startsOn: /^\d{4}-\d{2}-\d{2}$/.test(text(form, "startsOn", 10)) ? text(form, "startsOn", 10) : "",
    endsOn: /^\d{4}-\d{2}-\d{2}$/.test(text(form, "endsOn", 10)) ? text(form, "endsOn", 10) : "",
  };

  const upload = form.get("image");
  let posterChanged = false;
  if (form.get("removeImage") === "on") {
    next.image = "";
    posterChanged = Boolean(promo.image);
  } else if (upload instanceof File && upload.size > 0) {
    try {
      next.image = await uploadImage(upload, "promo");
      posterChanged = true;
    } catch (e) {
      await logServerEvent("media_upload_error", PAGE);
      back({ error: failure(e), tab: "popup" });
    }
  }

  if (!promoHrefOk(next.href)) back({ error: "The popup link must be a page like /signup or a full https:// address.", tab: "popup" });
  const problem = popupProblem(next);
  if (next.enabled && problem) back({ error: `Can't switch the popup on yet: ${problem}`, tab: "popup" });

  // New content = new campaign: everyone who closed the old one sees this one once more.
  const fingerprint = popupFingerprint(next);
  if (fingerprint !== popupFingerprint(promo) || !promo.version) next.version = fingerprint;
  next.updatedAt = new Date().toISOString();

  try {
    await saveContent("promo", next, admin.name);
  } catch (e) {
    await logServerEvent("content_save_error", PAGE);
    back({ error: failure(e), tab: "popup" });
  }
  const turned = next.enabled !== promo.enabled ? (next.enabled ? "switched on" : "switched off") : "updated";
  await logActivity(admin, {
    section: "promo",
    action: posterChanged ? "promo_popup_poster_replaced" : "promo_popup_saved",
    summary: `Popup ${turned}: ${next.title || next.imageAlt || "poster"}${posterChanged ? " (new poster)" : ""}`,
    detail: {
      enabled: next.enabled,
      href: next.href,
      frequency: next.frequency,
      startsOn: next.startsOn || null,
      endsOn: next.endsOn || null,
      poster: next.image || null,
      version: next.version,
    },
  });
  back({ saved: "popup", tab: "popup" });
}
