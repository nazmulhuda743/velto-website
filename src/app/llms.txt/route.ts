import { dictionary } from "@/content/i18n";
import { SERVICE_PAGES } from "@/content/services";
import { FREE_DELIVERY_THRESHOLD, LOCATIONS, REGULAR_FREE_DELIVERY_THRESHOLD, SERVICE_AREA, SOCIAL_PROFILES } from "@/content/site";
import { phoneDisplay } from "@/lib/contact-phone";
import { absoluteUrl, SITE_NAME } from "@/lib/seo/site";
import { getSiteContent } from "@/lib/site-content";

/**
 * /llms.txt (llmstxt.org): a plain-text summary of Velto for AI assistants, so what they say about
 * Velto comes from the site. Built from the same content the pages show (services, outlets, the
 * approved FAQ), never a separate copy: nothing here that isn't already on the site. The phone number
 * (calls and WhatsApp, from Admin → Site settings) is the one in the footer and the schema. No opening
 * days (not verified), no prices (they live in Ops). Rebuilt hourly so a changed number follows.
 */
export const dynamic = "force-static";
export const revalidate = 3600;

const plain = (s: string) => s.replace(/⁠/g, "");

export async function GET() {
  const faqs = dictionary("en").faqs;
  const phone = phoneDisplay((await getSiteContent()).settings.whatsappNumber);
  const text = [
    `# ${SITE_NAME}`,
    "",
    `> Laundry, dry cleaning and ironing in Uttara, Dhaka, Bangladesh. Pickup and delivery across ${plain(SERVICE_AREA)}, and outlets in Uttara Sector 11 and Sector 18. Free pickup and delivery on orders of ${FREE_DELIVERY_THRESHOLD} or more.`,
    "",
    "Velto collects from the customer's door, checks in, tags and looks over every item before cleaning, checks it again before packing, and returns it packed. Final prices are confirmed after items are counted; curtains, carpets and blankets are quoted.",
    "",
    "## Book or ask",
    "",
    `- Phone and WhatsApp: ${phone} (calls and WhatsApp, both outlets)`,
    `- [Book a pickup](${absoluteUrl("/book")}): choose a day and time window; nothing to pay online.`,
    `- [Request a quote](${absoluteUrl("/quote")}): for curtains, carpets, blankets and comforters.`,
    `- [WhatsApp Velto](${absoluteUrl("/go/whatsapp")})`,
    `- [Price list](${absoluteUrl("/pricing")})`,
    `- [Blanket cleaning, 3 regular blankets ৳999](${absoluteUrl("/blanket-cleaning-uttara")}): pickup and delivery in Uttara Sectors 1 to 18, pay at delivery.`,
    `- [Track an order](${absoluteUrl("/track")})`,
    "",
    "## Services",
    "",
    ...SERVICE_PAGES.map((s) => `- [${s.name}](${absoluteUrl(`/services/${s.slug}`)}): ${s.whenToChoose} ${plain(s.overviewFact).replace(/ · /g, "; ")}.`),
    `- [Regular laundry](${absoluteUrl("/regular-laundry")}): a weekly or fortnightly laundry and ironing pickup; regular orders of ${REGULAR_FREE_DELIVERY_THRESHOLD} or more get free pickup and delivery.`,
    "",
    "## Outlets (drop-off)",
    "",
    ...LOCATIONS.map((l) => `- [Velto ${l.name}](${absoluteUrl(`/locations/${l.id}`)}): ${l.address}. Hours ${l.hours}. Phone ${phone}.`),
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
