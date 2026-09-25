import Link from "@/components/i18n/Link";
import { CookieSettingsButton } from "@/components/consent/CookieSettingsButton";
import { Logo } from "@/components/ui/Logo";
import { SERVICE_PAGES } from "@/content/services";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { dictionary, type Dictionary } from "@/content/i18n";
import { CUSTOMER_PORTAL, WHATSAPP_URL, bookHref } from "@/content/site";
import { getLocale } from "@/lib/i18n/server";
import { getLocations } from "@/lib/site-content";

const link = "inline-block py-1.5 t-small text-white hover:text-cyan";

/** Everything a customer might look for after the page ends; the header stays short. */
const HELP: { key: keyof Dictionary["nav"]; href: string }[] = [
  { key: "pricing", href: "/pricing" },
  { key: "howItWorks", href: "/how-it-works" },
  { key: "regularLaundry", href: "/regular-laundry" },
  { key: "requestQuote", href: "/quote" },
  { key: "trackAnOrder", href: "/track" },
  ...(CUSTOMER_PORTAL.enabled ? [{ key: "myAccount" as const, href: CUSTOMER_PORTAL.href }] : []),
  { key: "about", href: "/about" },
];

export async function Footer() {
  const locations = await getLocations();
  const t = dictionary(await getLocale());
  return (
    <footer className="on-navy border-t border-white/15 bg-navy-deep text-white/80">
      <div className="container-page pb-10 pt-16 md:pt-20">
        <div className="grid-page gap-y-12">
          <div className="col-span-4 md:col-span-8 xl:col-span-3">
            <Link href="/" aria-label={t.common.homeAria} className="inline-flex">
              <Logo inverse className="h-11" />
            </Link>
            <p className="mt-5 max-w-[30ch] t-small">{t.footer.tagline}</p>
            <ul className="mt-5 space-y-1">
              <li>
                <Link href={bookHref("footer")} className={`${link} font-semibold`} data-analytics="book_pickup_click" data-placement="footer">
                  {t.common.bookPickup}
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
                  {t.common.whatsappVelto}
                  <span className="sr-only"> {t.common.opensNewTab}</span>
                </a>
              </li>
            </ul>
          </div>

          <nav aria-labelledby="footer-services" className="col-span-2 md:col-span-3 xl:col-span-2">
            <h2 id="footer-services" className="t-label uppercase text-white/60">
              {t.footer.services}
            </h2>
            <ul className="mt-4 space-y-1">
              <li>
                <Link href="/services" className={link}>
                  {t.footer.allServices}
                </Link>
              </li>
              {SERVICE_PAGES.map((s) => (
                <li key={s.slug}>
                  <Link href={`/services/${s.slug}`} className={link}>
                    {t.serviceNames[s.slug] ?? s.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-help" className="col-span-2 md:col-span-3 xl:col-span-2">
            <h2 id="footer-help" className="t-label uppercase text-white/60">
              {t.footer.help}
            </h2>
            <ul className="mt-4 space-y-1">
              {HELP.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={link}>
                    {t.nav[item.key]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {locations.map((loc, i) => (
            <div key={loc.id} className={`col-span-4 md:col-span-4 xl:col-span-2 ${i === 0 ? "xl:col-start-9" : ""}`}>
              <h2 className="t-label uppercase text-white/60">
                <Link href={`/locations/${loc.id}`} className="hover:text-cyan">
                  Velto {t.locationNames[loc.id] ?? loc.name}
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
                {t.common.getDirections}
                <span className="sr-only">
                  {` ${t.footer.directionsTo.replace("{name}", t.locationNames[loc.id] ?? loc.name)} ${t.common.opensNewTab}`}
                </span>
              </a>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col gap-3 border-t border-white/15 pt-6 t-caption text-white/60 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Velto Premium Laundry</p>
          <ul className="flex flex-wrap gap-x-4">
            <li>
              <Link href="/privacy" className="inline-block py-1.5 hover:text-white">
                {t.footer.privacy}
              </Link>
            </li>
            <li>
              <Link href="/terms" className="inline-block py-1.5 hover:text-white">
                {t.footer.terms}
              </Link>
            </li>
            <li>
              <Link href="/cookies" className="inline-block py-1.5 hover:text-white">
                {t.footer.cookies}
              </Link>
            </li>
            <li>
              <CookieSettingsButton className="inline-block py-1.5 hover:text-white">{t.footer.cookieSettings}</CookieSettingsButton>
            </li>
            <li>
              <LanguageSwitcher className="inline-block py-1.5 font-semibold text-white hover:text-cyan" />
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
