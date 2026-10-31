import type { Metadata } from "next";
import { Alert } from "@/components/account/Alert";
import { SignInForm } from "@/components/account/forms";
import { AccountsUnavailable, SignedInNotice, StaffAccountNotice } from "@/components/account/SignedInNotice";
import { Logo } from "@/components/ui/Logo";
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
 * The app's sign-in: the same mobile-number sign-in as the website's /login, drawn as an app entry
 * screen (logo, title, the form; the code as six boxes), coming back to the app screen that was
 * asked for (Home by default).
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
        codeBoxes
      />
    );
  return (
    <main className="min-h-dvh bg-warm px-6 pb-[calc(32px+env(safe-area-inset-bottom))] pt-[calc(20px+env(safe-area-inset-top))]" data-app-login>
      <div className="mx-auto w-full max-w-[420px]">
        <Logo className="h-6 w-auto" />
        <h1 className="mt-12 a-title a-entry">{app.signInTitle}</h1>
        <p className="mt-2.5 a-row text-secondary">{app.signInIntro}</p>
        <div className="mt-8">{body}</div>
      </div>
    </main>
  );
}
