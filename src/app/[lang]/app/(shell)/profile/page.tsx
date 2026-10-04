import Link from "next/link";
import { ProfileView } from "@/components/account/views/ProfileView";
import { CookieSettingsButton } from "@/components/consent/CookieSettingsButton";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { WhatsAppButton } from "@/components/ui/Button";
import { accountText } from "@/content/i18n/account";
import { formText } from "@/content/i18n/forms";
import { WHATSAPP_URL } from "@/content/site";
import { signOutAction } from "@/lib/customer/actions";
import { localizeHref } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { getSiteContent } from "@/lib/site-content";

/**
 * Profile in the app: the account's profile screen, then what the website keeps in its menu and
 * footer: rewards, help on WhatsApp, language, the legal pages (opened as website pages) and sign out.
 */
export default async function AppProfile() {
  const locale = await getLocale();
  const t = formText(locale).common.appBar;
  const a = accountText(locale);
  const { loyalty } = await getSiteContent();
  const row = "flex min-h-[52px] items-center justify-between gap-4 border-t border-line px-5 first:border-t-0";
  return (
    <div className="space-y-8">
      <ProfileView base="/app" />
      <section aria-labelledby="app-more-title" className="overflow-hidden rounded-lg border border-line bg-white" data-app-more>
        <h2 id="app-more-title" className="sr-only">
          {t.more}
        </h2>
        {loyalty.enabled || loyalty.goal.enabled ? (
          <Link href="/app/rewards" className={`${row} font-semibold text-navy hover:bg-soft`}>
            {a.layout.nav.rewards}
            <span aria-hidden="true" className="text-secondary">›</span>
          </Link>
        ) : null}
        <div className={`${row} py-4`}>
          <div>
            <p className="font-semibold text-navy">{t.help}</p>
            <p className="mt-0.5 t-small text-secondary">{t.helpBody}</p>
          </div>
          <WhatsAppButton href={WHATSAPP_URL} placement="app_profile" className="!h-11 shrink-0 !px-4" />
        </div>
        <div className={row}>
          <span className="font-semibold text-navy">{t.language}</span>
          <LanguageSwitcher />
        </div>
        <div className={`${row} flex-wrap py-3 t-small text-secondary`}>
          <span className="sr-only">{t.legal}</span>
          <span className="flex flex-wrap gap-x-5 gap-y-2">
            <a href={localizeHref("/privacy", locale)} className="hover:text-navy">{a.layout.privacy}</a>
            <a href={localizeHref("/terms", locale)} className="hover:text-navy">{a.layout.terms}</a>
            <CookieSettingsButton className="hover:text-navy">{a.layout.cookies}</CookieSettingsButton>
          </span>
        </div>
        <form action={signOutAction} className={row}>
          <input type="hidden" name="base" value="/app" />
          <button type="submit" className="min-h-11 font-semibold text-navy underline decoration-blue/50 underline-offset-4">
            {a.layout.signOut}
          </button>
        </form>
      </section>
    </div>
  );
}
