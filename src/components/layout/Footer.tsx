import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { SERVICE_PAGES } from "@/content/services";
import { CUSTOMER_PORTAL, SERVICE_AREA, WHATSAPP_URL, bookHref } from "@/content/site";
import { getLocations } from "@/lib/site-content";

const link = "inline-block py-1.5 t-small text-white hover:text-cyan";

/** Everything a customer might look for after the page ends; the header stays short. */
const HELP = [
  { label: "Pricing", href: "/pricing" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "Regular Laundry", href: "/regular-laundry" },
  { label: "Request a Quote", href: "/quote" },
  { label: "Track an Order", href: "/track" },
  ...(CUSTOMER_PORTAL.enabled ? [{ label: CUSTOMER_PORTAL.label, href: CUSTOMER_PORTAL.href }] : []),
  { label: "About Velto", href: "/about" },
];

export async function Footer() {
  const locations = await getLocations();
  return (
    <footer className="on-navy border-t border-white/15 bg-navy-deep text-white/80">
      <div className="container-page pb-10 pt-16 md:pt-20">
        <div className="grid-page gap-y-12">
          <div className="col-span-4 md:col-span-8 xl:col-span-3">
            <Link href="/" aria-label="Velto home" className="inline-flex">
              <Logo inverse className="h-11" />
            </Link>
            <p className="mt-5 max-w-[30ch] t-small">
              Laundry and dry cleaning with pickup across {SERVICE_AREA}.
            </p>
            <ul className="mt-5 space-y-1">
              <li>
                <Link href={bookHref("footer")} className={`${link} font-semibold`} data-analytics="book_pickup_click" data-placement="footer">
                  Book a Pickup
                </Link>
              </li>
              <li>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={link}
                  data-analytics="whatsapp_click"
                  data-placement="footer"
                >
                  WhatsApp Velto<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            </ul>
          </div>

          <nav aria-labelledby="footer-services" className="col-span-2 md:col-span-3 xl:col-span-2">
            <h2 id="footer-services" className="t-label uppercase text-white/60">
              Services
            </h2>
            <ul className="mt-4 space-y-1">
              <li>
                <Link href="/services" className={link}>
                  All services
                </Link>
              </li>
              {SERVICE_PAGES.map((s) => (
                <li key={s.slug}>
                  <Link href={`/services/${s.slug}`} className={link}>
                    {s.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-help" className="col-span-2 md:col-span-3 xl:col-span-2">
            <h2 id="footer-help" className="t-label uppercase text-white/60">
              Help
            </h2>
            <ul className="mt-4 space-y-1">
              {HELP.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={link}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {locations.map((loc, i) => (
            <div key={loc.id} className={`col-span-4 md:col-span-4 xl:col-span-2 ${i === 0 ? "xl:col-start-9" : ""}`}>
              <h2 className="t-label uppercase text-white/60">
                <Link href={`/locations/${loc.id}`} className="hover:text-cyan">
                  Velto {loc.name}
                </Link>
              </h2>
              <address className="mt-4 t-small not-italic text-white">{loc.address}</address>
              <p className="mt-2 t-small">{loc.hours}</p>
              <a
                href={loc.directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`${link} mt-1 underline decoration-cyan/60 underline-offset-4`}
                data-analytics="directions_click"
                data-placement="footer"
                data-branch={loc.id}
              >
                Get Directions<span className="sr-only"> to Velto {loc.name} (opens in a new tab)</span>
              </a>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col gap-3 border-t border-white/15 pt-6 t-caption text-white/60 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Velto Premium Laundry</p>
          {/* Cookies link joins here when the consent work (PR #19) lands. */}
          <ul className="flex gap-4">
            <li>
              <Link href="/privacy" className="inline-block py-1.5 hover:text-white">
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="inline-block py-1.5 hover:text-white">
                Terms
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
