import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { LOCATIONS, NAV, SERVICE_AREA, WHATSAPP_URL, bookHref } from "@/content/site";

export function Footer() {
  return (
    <footer className="on-navy border-t border-white/15 bg-navy-deep text-white/80">
      <div className="container-page pb-10 pt-16 md:pt-20">
        <div className="grid-page gap-y-12">
          <div className="col-span-4 md:col-span-8 xl:col-span-4">
            <Link href="/" aria-label="Velto home" className="inline-flex">
              <Logo inverse className="h-11" />
            </Link>
            <p className="mt-5 max-w-[30ch] t-small">
              Laundry and dry cleaning with pickup across {SERVICE_AREA}.
            </p>
          </div>

          <nav aria-label="Footer" className="col-span-2 md:col-span-2 xl:col-span-2">
            <h2 className="t-label uppercase text-white/60">Explore</h2>
            <ul className="mt-4 space-y-1">
              {[...NAV.mobile, { label: "About", href: "/about" }].map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="inline-block py-1.5 t-small text-white hover:text-cyan">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="col-span-2 md:col-span-2 xl:col-span-2">
            <h2 className="t-label uppercase text-white/60">Contact</h2>
            <ul className="mt-4 space-y-1">
              <li>
                <Link
                  href={bookHref("footer")}
                  className="inline-block py-1.5 t-small text-white hover:text-cyan"
                  data-analytics="book_pickup_click"
                  data-placement="footer"
                >
                  Book a Pickup
                </Link>
              </li>
              <li>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block py-1.5 t-small text-white hover:text-cyan"
                  data-analytics="whatsapp_click"
                  data-placement="footer"
                >
                  WhatsApp Velto
                </a>
              </li>
              <li>
                <Link href="/quote" className="inline-block py-1.5 t-small text-white hover:text-cyan">
                  Request a Quote
                </Link>
              </li>
            </ul>
          </div>

          {LOCATIONS.map((loc) => (
            <div key={loc.id} className="col-span-4 md:col-span-4 xl:col-span-2">
              <h2 className="t-label uppercase text-white/60">{loc.name}</h2>
              <address className="mt-4 t-small not-italic text-white">{loc.address}</address>
              <p className="mt-2 t-small">{loc.hours}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col gap-3 border-t border-white/15 pt-6 t-caption text-white/60 md:flex-row md:justify-between">
          <p>© {new Date().getFullYear()} Velto Premium Laundry</p>
          <Link href="/privacy" className="hover:text-white">
            Privacy
          </Link>
        </div>
      </div>
    </footer>
  );
}
