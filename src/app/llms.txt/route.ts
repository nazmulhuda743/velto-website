import { dictionary } from "@/content/i18n";
import { SERVICE_PAGES } from "@/content/services";
import { FREE_DELIVERY_THRESHOLD, LOCATIONS, REGULAR_FREE_DELIVERY_THRESHOLD, SERVICE_AREA, SOCIAL_PROFILES } from "@/content/site";
import { absoluteUrl, SITE_NAME } from "@/lib/seo/site";

/**
 * /llms.txt (llmstxt.org): a plain-text summary of Velto for AI assistants, so what they say about
 * Velto comes from the site. Built from the same content the pages show (services, outlets, the
 * approved FAQ), never a separate copy: nothing here that isn't already on the site. No phone number
 * (the confirmed line is WhatsApp), no opening days (not verified), no prices (they live in Ops).
 */
export const dynamic = "force-static";

const plain = (s: string) => s.replace(/⁠/g, "");

export function GET() {
  const faqs = dictionary("en").faqs;
  const text = [
    `# ${SITE_NAME}`,
    "",
    `> Laundry, dry cleaning and ironing in Uttara, Dhaka, Bangladesh. Pickup and delivery across ${plain(SERVICE_AREA)}, and outlets in Uttara Sector 11 and Sector 18. Free pickup and delivery on orders of ${FREE_DELIVERY_THRESHOLD} or more.`,
    "",
    "Velto collects from the customer's door, checks in, tags and looks over every item before cleaning, checks it again before packing, and returns it packed. Final prices are confirmed after items are counted; curtains, carpets and blankets are quoted.",
    "",
    "## Book or ask",
    "",
    `- [Book a pickup](${absoluteUrl("/book")}): choose a day and time window; nothing to pay online.`,
    `- [Request a quote](${absoluteUrl("/quote")}): for curtains, carpets, blankets and comforters.`,
    `- [WhatsApp Velto](${absoluteUrl("/go/whatsapp")})`,
    `- [Price list](${absoluteUrl("/pricing")})`,
    `- [Track an order](${absoluteUrl("/track")})`,
    "",
    "## Services",
    "",
    ...SERVICE_PAGES.map((s) => `- [${s.name}](${absoluteUrl(`/services/${s.slug}`)}): ${s.whenToChoose} ${plain(s.overviewFact).replace(/ · /g, "; ")}.`),
    `- [Regular laundry](${absoluteUrl("/regular-laundry")}): a weekly or fortnightly laundry and ironing pickup; regular orders of ${REGULAR_FREE_DELIVERY_THRESHOLD} or more get free pickup and delivery.`,
    "",
    "## Outlets (drop-off)",
    "",
    ...LOCATIONS.map((l) => `- [Velto ${l.name}](${absoluteUrl(`/locations/${l.id}`)}): ${l.address}. Hours ${l.hours}.`),
    "",
    "## Common questions",
    "",
    ...faqs.flatMap((f) => [`### ${f.q}`, "", f.a.map(plain).join(" "), ""]),
    "## More",
    "",
    `- [How it works](${absoluteUrl("/how-it-works")})`,
    `- [About Velto](${absoluteUrl("/about")})`,
    ...SOCIAL_PROFILES.map((p) => `- [${p.name}](${p.href})`),
    "",
  ].join("\n");
  return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
