import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale, loginRedirectPath } from "@/lib/i18n/server";
import { accountText, type AccountText } from "@/content/i18n/account";
import { AccountNav } from "@/components/account/AccountNav";
import { Alert } from "@/components/account/Alert";
import { ProfileForm } from "@/components/account/forms";
import { StaffAccountNotice } from "@/components/account/SignedInNotice";
import Link from "@/components/i18n/Link";
import { CookieSettingsButton } from "@/components/consent/CookieSettingsButton";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { WhatsAppButton } from "@/components/ui/Button";
import { WHATSAPP_URL } from "@/content/site";
import { signOutAction } from "@/lib/customer/actions";
import { requireCustomer } from "@/lib/customer/portal";
import { getSiteContent } from "@/lib/site-content";

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

/** Every /account page: a verified customer session, decided on the server. */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await requireCustomer("/account");
  const a = accountText(await getLocale());
  const t = a.layout;

  if (session.kind === "disabled") redirect(await loginRedirectPath());
  if (session.kind === "unavailable") {
    return (
      <Frame nav={false} t={t}>
        <h1 className="t-h2 text-navy">{t.yourAccount}</h1>
        <div className="mt-6">
          <Alert tone="error" title={t.cantLoadTitle}>
            {t.cantLoadBody}
          </Alert>
        </div>
      </Frame>
    );
  }
  if (session.kind === "staff") {
    return (
      <Frame nav={false} t={t}>
        <h1 className="t-h2 text-navy">{t.customerAccount}</h1>
        <div className="mt-6">
          <StaffAccountNotice />
        </div>
      </Frame>
    );
  }
  if (session.kind !== "customer") redirect(await loginRedirectPath("/account"));
  if (session.account.state === "incomplete") {
    // Google sign-ups arrive with their name in the auth metadata; use it as the starting value.
    const meta = session.user.user_metadata ?? {};
    const metaName = typeof meta.full_name === "string" ? meta.full_name : typeof meta.name === "string" ? meta.name : "";
    return (
      <Frame nav={false} t={t}>
        <h1 className="t-h2 text-navy">{t.finishTitle}</h1>
        <p className="mt-3 text-body">{t.finishBody}</p>
        <div className="mt-6 rounded-lg border border-line bg-white p-5 md:p-7">
          <ProfileForm
            t={a.forms}
            completing
            phoneLocked={session.account.phoneVerified && session.account.phone ? "verified" : null}
            initial={{ fullName: metaName.trim().slice(0, 80), phone: session.account.phone ?? "", address: "", area: "" }}
          />
        </div>
      </Frame>
    );
  }
  const { loyalty } = await getSiteContent();
  return (
    <Frame t={t} rewards={loyalty.enabled || loyalty.goal.enabled}>
      {children}
    </Frame>
  );
}
