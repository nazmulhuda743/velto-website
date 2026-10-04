import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/server";
import { accountGate } from "@/components/account/AccountGate";
import { accountText, type AccountText } from "@/content/i18n/account";
import { AccountNav } from "@/components/account/AccountNav";
import Link from "@/components/i18n/Link";
import { CookieSettingsButton } from "@/components/consent/CookieSettingsButton";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { WhatsAppButton } from "@/components/ui/Button";
import { WHATSAPP_URL } from "@/content/site";
import { signOutAction } from "@/lib/customer/actions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: accountText(await getLocale()).meta.account, robots: { index: false, follow: false } };
}

function Frame({ children, nav = true, rewards = false, t }: { children: React.ReactNode; nav?: boolean; rewards?: boolean; t: AccountText["layout"] }) {
  return (
    // data-account-frame: the site footer steps aside (globals.css); the account has its own short one.
    <div className="bg-warm" data-account-frame>
      {nav ? <AccountNav variant="tabs" labels={t.nav} rewards={rewards} /> : null}
      <div className="container-page grid gap-8 py-7 md:py-10 xl:grid-cols-12 xl:gap-8 xl:py-11">
        {nav ? (
          <aside className="hidden xl:col-span-3 xl:block">
            <div className="sticky top-[110px] space-y-6">
              <AccountNav variant="side" labels={t.nav} rewards={rewards} />
              <div className="space-y-1 border-t border-line pt-5">
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="flex h-11 items-center rounded-md px-3 text-[15px] font-medium text-body hover:bg-soft hover:text-navy" data-analytics="whatsapp_click" data-placement="account_nav">
                  {t.support}
                </a>
                <form action={signOutAction}>
                  <button type="submit" className="flex h-11 w-full items-center rounded-md px-3 text-left text-[15px] font-medium text-body hover:bg-soft hover:text-navy">
                    {t.signOut}
                  </button>
                </form>
              </div>
            </div>
          </aside>
        ) : null}
        <div className={nav ? "min-w-0 xl:col-span-9 xl:col-start-4" : "mx-auto w-full max-w-[560px] xl:col-span-12"}>{children}</div>
      </div>
      {/* A short footer for signed-in customers: help, sign out, the legal links and the language. */}
      <footer className="border-t border-line bg-white" data-account-footer>
        <div className="container-page py-6 md:py-7">
          {nav ? (
            <div className="flex flex-wrap items-center justify-between gap-4 xl:hidden">
              <WhatsAppButton href={WHATSAPP_URL} placement="account_footer" className="!h-12 !px-5">
                {t.support}
              </WhatsAppButton>
              <form action={signOutAction}>
                <button type="submit" className="h-12 px-2 font-semibold text-navy underline decoration-blue/50 underline-offset-4">
                  {t.signOut}
                </button>
              </form>
            </div>
          ) : null}
          <div className={`flex flex-wrap items-center gap-x-5 gap-y-2 t-small text-secondary ${nav ? "mt-5 border-t border-line pt-5 xl:mt-0 xl:border-0 xl:pt-0" : ""}`}>
            <Link href="/privacy" className="hover:text-navy">{t.privacy}</Link>
            <Link href="/terms" className="hover:text-navy">{t.terms}</Link>
            <CookieSettingsButton className="hover:text-navy">{t.cookies}</CookieSettingsButton>
            <LanguageSwitcher className="ml-auto" />
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Every /account page: a verified customer session, decided on the server (AccountGate). */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const gate = await accountGate("/account");
  const t = accountText(await getLocale()).layout;
  if (gate.screen) {
    return (
      <Frame nav={false} t={t}>
        {gate.screen}
      </Frame>
    );
  }
  return (
    <Frame t={t} rewards={gate.rewards}>
      {children}
    </Frame>
  );
}
