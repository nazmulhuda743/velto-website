import Link from "@/components/i18n/Link";
import { CookieSettingsButton } from "@/components/consent/CookieSettingsButton";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { WhatsAppIcon } from "@/components/ui/icons";
import { Logo } from "@/components/ui/Logo";
import { dictionary } from "@/content/i18n";
import { b999WhatsApp } from "@/lib/campaigns/b999";
import { getLocale } from "@/lib/i18n/server";
import { getLocations } from "@/lib/site-content";
import { waHref } from "./wa";

/**
 * Landing-page chrome for /blanket-cleaning-uttara: no site menu, no "Book pickup" to /book (that
 * flow carries the first-order 10%), no long footer. One page, one offer, one action.
 */
export async function B999Header() {
  const t = dictionary(await getLocale());
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-white">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo className="h-9" priority />
        <div className="flex items-center gap-4">
          <LanguageSwitcher className="rounded-sm px-1 py-2 text-[15px] font-semibold text-navy hover:text-blue" />
          <a
            href={waHref(b999WhatsApp.check)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-sm px-1 py-2 text-[15px] font-medium text-navy hover:text-blue"
            data-analytics="whatsapp_click"
            data-placement="b999_header"
            data-service="blanket-comforter-cleaning"
          >
            <WhatsAppIcon className="size-[18px] text-whatsapp" />
            {t.common.whatsapp}
          </a>
        </div>
      </div>
    </header>
  );
}

export async function B999Footer() {
  const t = dictionary(await getLocale());
  const [primary] = await getLocations();
  return (
    <footer className="bg-navy py-8 text-white/75">
      <div className="container-page flex flex-col gap-3 t-small md:flex-row md:items-center md:justify-between">
        <p>
          © {new Date().getFullYear()} Velto Premium Laundry · {primary.address}
        </p>
        <ul className="flex flex-wrap gap-x-5">
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
            <CookieSettingsButton className="inline-block py-1.5 hover:text-white">{t.footer.cookieSettings}</CookieSettingsButton>
          </li>
        </ul>
      </div>
    </footer>
  );
}
