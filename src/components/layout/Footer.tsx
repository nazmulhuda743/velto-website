import Link from "@/components/i18n/Link";
import { CookieSettingsButton } from "@/components/consent/CookieSettingsButton";
import { Logo } from "@/components/ui/Logo";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { dictionary } from "@/content/i18n";
import { defaultFooterLinks } from "@/content/footer-defaults";
import { GOOGLE_PROFILE_BRANCH, SOCIAL_PROFILES, WHATSAPP_URL, bookHref } from "@/content/site";
import { FacebookIcon, GoogleIcon, InstagramIcon, LinkedInIcon } from "@/components/ui/icons";
import { footerLabel, isExternalHref, visibleFooterLinks, type FooterLink } from "@/lib/footer-links";
import { getLocations, getSiteContent } from "@/lib/site-content";
import { getLocale, localLocation } from "@/lib/i18n/server";

const link = "inline-block py-1.5 t-small text-white hover:text-cyan";
const social = "inline-flex size-11 items-center justify-center rounded-full border border-white/25 text-white transition-colors hover:border-cyan hover:text-cyan";
const SOCIAL_ICONS = { facebook: FacebookIcon, instagram: InstagramIcon, linkedin: LinkedInIcon } as const;

/** One footer link: pages on this site keep the language; other websites open in a new tab. */
function FooterItem({ item, locale, newTab }: { item: FooterLink; locale: string; newTab: string }) {
  const label = footerLabel(item, locale);
  return (
    <li>
      {isExternalHref(item.href) ? (
        <a href={item.href} target="_blank" rel="noopener noreferrer" className={link}>
          {label}
          <span className="sr-only"> {newTab}</span>
        </a>
      ) : (
        <Link href={item.href} className={link}>
          {label}
        </Link>
      )}
    </li>
  );
}

/** Everything a customer might look for after the page ends; the header stays short. Columns are edited in Content → Footer links. */
export async function Footer() {
  // Hours in the page language (built-in defaults translated, admin edits with local digits).
  const locations = await Promise.all((await getLocations()).map(localLocation));
  const locale = await getLocale();
  const t = dictionary(locale);
  const google = locations.find((l) => l.id === GOOGLE_PROFILE_BRANCH);
  const { footer } = await getSiteContent();
  const builtIn = defaultFooterLinks();
  const services = visibleFooterLinks(footer.services ?? builtIn.services);
  const help = visibleFooterLinks(footer.help ?? builtIn.help);
  return (
    <footer id="site-footer" data-site-footer className="on-navy border-t border-white/15 bg-navy-deep text-white/80">
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
            <ul aria-label={t.footer.follow} className="mt-5 flex flex-wrap gap-3" data-social>
              {SOCIAL_PROFILES.map((p) => {
                const Icon = SOCIAL_ICONS[p.id];
                return (
                  <li key={p.id}>
                    <a href={p.href} target="_blank" rel="noopener noreferrer me" className={social} data-analytics="social_click" data-placement={`footer_${p.id}`}>
                      <Icon />
                      <span className="sr-only">
                        {t.footer.onNetwork.replace("{name}", p.name)} {t.common.opensNewTab}
                      </span>
                    </a>
                  </li>
                );
              })}
              {google ? (
                <li>
                  <a href={google.reviewsUrl} target="_blank" rel="noopener noreferrer" className={social} data-analytics="google_reviews_click" data-placement="footer" data-branch={google.id}>
                    <GoogleIcon />
                    <span className="sr-only">
                      {t.footer.onGoogle} {t.common.opensNewTab}
                    </span>
                  </a>
                </li>
              ) : null}
            </ul>
          </div>

          <nav aria-labelledby="footer-services" className="col-span-2 md:col-span-3 xl:col-span-2">
            <h2 id="footer-services" className="t-label uppercase text-white/60">
              {t.footer.services}
            </h2>
            <ul className="mt-4 space-y-1">
              {services.map((item, i) => (
                <FooterItem key={`${i}-${item.href}`} item={item} locale={locale} newTab={t.common.opensNewTab} />
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-help" className="col-span-2 md:col-span-3 xl:col-span-2">
            <h2 id="footer-help" className="t-label uppercase text-white/60">
              {t.footer.help}
            </h2>
            <ul className="mt-4 space-y-1">
              {help.map((item, i) => (
                <FooterItem key={`${i}-${item.href}`} item={item} locale={locale} newTab={t.common.opensNewTab} />
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
