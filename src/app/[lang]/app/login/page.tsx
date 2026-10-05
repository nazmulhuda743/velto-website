import type { Metadata } from "next";
import { Alert } from "@/components/account/Alert";
import { AuthShell } from "@/components/account/AuthShell";
import { SignInForm } from "@/components/account/forms";
import { AccountsUnavailable, SignedInNotice, StaffAccountNotice } from "@/components/account/SignedInNotice";
import { AppHeader } from "@/components/pwa/AppHeader";
import { accountText } from "@/content/i18n/account";
import { formText } from "@/content/i18n/forms";
import { authProviders } from "@/lib/customer/providers";
import { getCustomerSession } from "@/lib/customer/portal";
import { safeNextPath, signedInAs } from "@/lib/customer/validation";
import { getLocale } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Velto", robots: { index: false, follow: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * The app's sign-in: the same mobile-number sign-in as the website's /login, inside the app (logo
 * header, no tabs), coming back to the app screen that was asked for (Home by default).
 */
export default async function AppLogin({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = safeNextPath(one(params.next), "/app/home");
  const locale = await getLocale();
  const a = accountText(locale);
  const app = formText(locale).common.appBar;
  const [session, providers] = await Promise.all([getCustomerSession(), authProviders()]);
  const body =
    session.kind === "disabled" ? (
      <AccountsUnavailable />
    ) : session.kind === "customer" || session.kind === "staff" ? (
      session.kind === "staff" ? <StaffAccountNotice /> : <SignedInNotice email={signedInAs(session.user)} next={next} />
    ) : (
      <SignInForm
        t={a.forms}
        next={next}
        google={providers.google}
        phone={providers.phone}
        notice={session.kind === "unavailable" ? <Alert tone="error">{a.pages.signInUnavailable}</Alert> : undefined}
      />
    );
  return (
    <div className="min-h-dvh bg-warm" data-app-login>
      <AppHeader />
      <AuthShell title={app.signInTitle} intro={app.signInIntro}>
        {body}
      </AuthShell>
    </div>
  );
}
