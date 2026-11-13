/**
 * What the website chat knows: the website's own approved words, gathered into one reference text.
 * Nothing here is written for the chat; every fact comes from the content the pages already show
 * (site.ts, services.ts, the UI dictionary), so a change on the site changes the chat's answers too.
 * Prices are not in here on purpose: they come live from the public price view (lookup_prices).
 * Deterministic output (same content, same text), so the prompt prefix stays cacheable.
 */
import { dictionary } from "@/content/i18n";
import { pageText } from "@/content/i18n/pages";
import { FIRST_ORDER_OFFER } from "@/lib/first-order-offer";
import {
  FREE_DELIVERY_THRESHOLD,
  GOOGLE_PROOF,
  LOCATIONS,
  REGULAR_FREE_DELIVERY_THRESHOLD,
  SERVICE_AREA,
  SOCIAL_PROFILES,
} from "@/content/site";
import { servicePages, type FAQRef, type ServiceBlock } from "@/content/services";
import { FAQ_KEYS } from "@/components/home/FAQ";

const clean = (s: string) => s.replace(/[⁠]/g, "").replace(/\s+/g, " ").trim();

function faqText(ref: FAQRef): string {
  const faqs = dictionary("en").faqs;
  const item = typeof ref === "string" ? faqs[FAQ_KEYS[ref]] : ref;
  return item ? `Q: ${clean(item.q)}\nA: ${clean(item.a.join(" "))}` : "";
}

function blockText(b: ServiceBlock): string {
  const head = `### ${clean(b.title)}`;
  switch (b.type) {
    case "scope":
      return [head, b.intro, ...b.groups.map((g) => `- ${g.title}: ${g.copy}`)].filter(Boolean).map((s) => clean(s as string)).join("\n");
    case "notes":
      return [head, b.intro, ...b.items.map((g) => `- ${g.title}: ${g.copy}`)].filter(Boolean).map((s) => clean(s as string)).join("\n");
    case "process":
      return [head, b.intro, ...b.steps.map((s, i) => `${i + 1}. ${s.title}: ${s.copy}`)].map(clean).join("\n");
    case "measure":
      return [head, b.intro, ...b.steps.map((s, i) => `${i + 1}. ${s.title}: ${s.copy}`), ...b.examples.map((e) => `- ${e.label}: ${e.value}`), b.note].map(clean).join("\n");
    case "facts":
      return [head, b.intro ?? "", ...b.rows.map((r) => `- ${r.label}: ${r.value}`), b.footnote ?? ""].filter(Boolean).map(clean).join("\n");
    case "prices":
      return [head, b.intro, `Items with a listed price: ${b.groups.flatMap((g) => g.names).join(", ")}`, b.note ?? ""].filter(Boolean).map(clean).join("\n");
    default:
      return "";
  }
}

let cached: { text: string; at: number } | null = null;
/** Rebuilt at most this often, so copy edited in the admin reaches the chat without a deploy. */
const KNOWLEDGE_TTL_MS = 10 * 60_000;

/** The reference text (rebuilt every ten minutes at most). */
export function chatKnowledge(): string {
  if (cached && Date.now() - cached.at < KNOWLEDGE_TTL_MS) return cached.text;
  const p = pageText("en");
  const t = dictionary("en");
  const parts: string[] = [];

  parts.push(
    "## Velto at a glance",
    "- Velto is a laundry and dry cleaning service in Uttara, Dhaka, with pickup from the customer's door and delivery back.",
    `- Pickup and delivery area: ${clean(SERVICE_AREA)}, Dhaka. Outside that area, the customer should ask Velto before booking.`,
    `- Free pickup and delivery on orders of ${FREE_DELIVERY_THRESHOLD}+. On a fixed weekly or fortnightly pickup, regular orders of ${REGULAR_FREE_DELIVERY_THRESHOLD}+ qualify. Smaller orders have a pickup and delivery charge; Velto tells the customer the amount when confirming the pickup.`,
    "- Turnaround: general orders usually around 48 hours; Wash & Iron and Dry Cleaning usually around 72 hours. Special garments, household items and unusual conditions may take longer. These are usual times, never a promise.",
    "- Express: sometimes available, depending on the item, service and current workload. Confirm with Velto before booking.",
    `- First website booking: ${FIRST_ORDER_OFFER.percent}% off a phone number's first booking made on the website, whatever the amount. No code is needed; Velto applies it when the order is created.`,
    `- Google: ${GOOGLE_PROOF.label} (Sector 11 outlet).`,
    "- Booking: on the website (Book a Pickup, /book) or on WhatsApp. The customer gives the pickup address, what they are sending and a preferred pickup day and time window. Velto calls or messages to confirm the pickup time.",
    "- Payment: Velto goes through the amount when confirming; details of payment methods are handled by the team (point to WhatsApp if asked for specifics that are not written here).",
    "- Order status: the customer can track an order on /track with the order number and phone number, or in their Velto account if they have one.",
    `- Social: ${SOCIAL_PROFILES.map((s) => `${s.name} ${s.href}`).join(", ")}.`,
  );

  parts.push("", "## Outlets");
  for (const l of LOCATIONS) {
    parts.push(`- ${l.name} outlet: ${l.address}. Open ${l.hours} (Dhaka time). Google rating ${l.rating} from ${l.reviewCount} reviews. Directions: ${l.directionsUrl}`);
  }

  parts.push("", "## How an order works");
  p.howPage.steps.forEach((s, i) => parts.push(`${i + 1}. ${s.title}: ${clean(s.copy)}`));
  parts.push("Inside Velto, every order follows the same ten steps:");
  for (const g of p.operational.groups) parts.push(`- ${g.label}: ${g.steps.map((s) => `${s.title} (${clean(s.copy)})`).join("; ")}`);

  parts.push("", "## Pricing");
  parts.push(clean(p.pricingPage.intro), clean(p.pricingPage.smaller), clean(p.pricingPage.householdIntro));
  for (const h of p.pricingPage.household) parts.push(`- ${h.label}: ${clean(h.copy)}`);
  parts.push(`- "After assessment" on a price: ${clean(t.priceFinder.afterAssessmentNote)}`);
  for (const [slug, summary] of Object.entries(t.priceFinder.summaries)) parts.push(`- ${slug}: ${summary}`);

  parts.push("", "## Regular laundry (recurring pickup)");
  parts.push(clean(p.regularPage.intro), clean(p.regularPage.howIntro));
  p.regularPage.steps.forEach((s, i) => parts.push(`${i + 1}. ${s.title}: ${clean(s.copy)}`));
  parts.push(clean(p.regularPage.saveIntro.replace("{amount}", REGULAR_FREE_DELIVERY_THRESHOLD)));

  parts.push("", "## Common questions");
  for (const f of t.faqs) parts.push(faqText(f));

  for (const s of servicePages("en")) {
    parts.push("", `## Service: ${s.name} (page /services/${s.slug})`);
    parts.push(`- Best for: ${clean(s.whenToChoose)}`, `- Pricing: ${clean(s.glance.pricing)}`, `- Turnaround: ${clean(s.glance.turnaround)}`);
    parts.push(...s.intro.map(clean));
    for (const b of s.blocks) {
      const text = blockText(b);
      if (text) parts.push(text);
    }
    const custom = s.faq.items.filter((r) => typeof r !== "string");
    if (custom.length) parts.push("Questions about this service:", ...custom.map(faqText));
  }

  cached = { text: parts.join("\n"), at: Date.now() };
  return cached.text;
}
