import { pageMetadata } from "@/lib/seo/page-metadata";
import { BookingForm } from "@/components/forms/BookingForm";
import { Breadcrumbs } from "@/components/pages/Breadcrumbs";
import { WhatsAppButton } from "@/components/ui/Button";
import { WHATSAPP_URL } from "@/content/site";
import { portalMe } from "@/lib/customer-portal";
import { getPortalIdentity } from "@/lib/supabase/portal-server";

export const generateMetadata = () => pageMetadata("/book");
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const PRESET_NOTES: Record<string, string> = {
  "regular-laundry": "I'd like to set up a regular pickup.",
  express: "I'd like Express, if it's possible for this order.",
};

const NEXT_STEPS = [
  "We call or WhatsApp you to confirm the pickup time.",
  "We collect from your door.",
  "Your order comes back checked, cleaned, finished and packed.",
];

function sectorFromArea(area: string | null | undefined) {
  const match = area?.match(/(?:sector\s*)?(\d{1,2})/i);
  if (!match) return "";
  const n = Number(match[1]);
  return n >= 1 && n <= 18 ? String(n) : "";
}

export default async function BookPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const service = one(params.service);
  const preview = process.env.NODE_ENV !== "production" ? one(params.preview) : undefined;
  const previewOutcome = preview === "success" || preview === "error" ? preview : undefined;

  let prefill: { sector?: string; address?: string; name?: string; phone?: string } | undefined;
  const identity = await getPortalIdentity();
  if (identity) {
    try {
      const profile = await portalMe(identity.supabase);
      const sourceName = profile.fullName || profile.veltoProfile?.name || "";
      const sourcePhone = profile.link.verifiedPhone || profile.phone || profile.veltoProfile?.phone || "";
      const sourceAddress = profile.address || profile.veltoProfile?.address || "";
      const sourceArea = profile.area || profile.veltoProfile?.zone || "";
      prefill = { name: sourceName, phone: sourcePhone, address: sourceAddress, sector: sectorFromArea(sourceArea) };
    } catch {
      prefill = undefined;
    }
  }

  return (
    <section aria-labelledby="page-title" className="group/book pb-(--space-section) pt-7 md:pt-10 xl:pt-12">
      <div className="container-page">
        <div className="hidden md:block"><Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Book a Pickup" }]} /></div>
        <div className="grid-page gap-y-10 md:mt-8">
          <div className="col-span-4 md:col-span-8 xl:col-span-7">
            <div className="max-w-[640px]">
              <BookingForm intro="Tell us what you're sending and where to collect it. We'll confirm the time with you before we come." initialService={service} presetNote={PRESET_NOTES[service ?? ""]} previewOutcome={previewOutcome} prefill={prefill} />
              {prefill ? <p className="mt-4 t-small text-secondary">We filled in your saved account details. Check them before you send the pickup request.</p> : null}
            </div>
          </div>
          <aside aria-label="About booking" className="group-has-[[data-booking-success]]/book:hidden col-span-4 md:col-span-8 xl:col-span-4 xl:col-start-9"><div className="xl:sticky xl:top-[100px]"><div className="hidden xl:block"><h2 className="t-label uppercase text-navy">How it works</h2><ol className="mt-4 border-t border-navy">{NEXT_STEPS.map((step, i) => <li key={step} className="flex gap-3 border-b border-line py-3.5 t-small text-body"><span className="t-label pt-[2px] text-blue">{String(i + 1).padStart(2, "0")}</span>{step}</li>)}</ol><p className="mt-4 t-small text-secondary">Pickup covers Uttara Sectors 1–18. For smaller orders, the applicable pickup and delivery charge is shown before booking.</p></div><div className="border-t border-line pt-6 xl:mt-8"><p className="font-semibold text-navy">Rather message us?</p><p className="mt-1 t-small text-secondary">Send the details or a photo on WhatsApp instead.</p><WhatsAppButton href={WHATSAPP_URL} placement="booking_aside" className="mt-4" /></div></div></aside>
        </div>
      </div>
    </section>
  );
}
