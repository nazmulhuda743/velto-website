import type { Metadata } from "next";
import { Alert } from "@/components/account/Alert";
import { AuthShell } from "@/components/account/AuthShell";
import { SignInForm } from "@/components/account/forms";
import { AccountsUnavailable, SignedInNotice, StaffAccountNotice } from "@/components/account/SignedInNotice";
import { authProviders } from "@/lib/customer/providers";
import { getCustomerSession } from "@/lib/customer/portal";
import { signedInAs, safeNextPath } from "@/lib/customer/validation";
import { alternatesFor, shareCardMetadata } from "@/lib/seo/page-metadata";
import { accountText } from "@/content/i18n/account";
import { getLocale } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const title = accountText(await getLocale()).meta.signIn;
  return { title, robots: { index: false, follow: false }, alternates: await alternatesFor("/login"), ...(await shareCardMetadata("/login", title)) };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const NOTICE_TONES: Record<string, "error" | "info"> = { link_expired: "error", link_unavailable: "error", signed_out: "info", oauth_failed: "error" };

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = safeNextPath(one(params.next));
  const a = accountText(await getLocale());
  const t = a.pages;
  const code = one(params.error) ?? "";
  const notice = NOTICE_TONES[code] ? { tone: NOTICE_TONES[code], text: t.notices[code] } : undefined;
  const [session, providers] = await Promise.all([getCustomerSession(), authProviders()]);

  if (session.kind === "disabled") {
    return (
      <AuthShell title={t.signInTitle}>
        <AccountsUnavailable />
      </AuthShell>
    );
  }
  if (session.kind === "customer" || session.kind === "staff") {
    return (
      <AuthShell title={t.signInTitle}>
        {session.kind === "staff" ? <StaffAccountNotice /> : <SignedInNotice email={signedInAs(session.user)} next={next} />}
      </AuthShell>
    );
  }
  return (
    <AuthShell title={t.signInTitle} intro={/^(?:\/bn)?\/book/.test(next) ? t.signInIntroBook : t.signInIntro}>
      <SignInForm
        t={a.forms}
        next={next}
        google={providers.google}
        phone={providers.phone}
        notice={
          session.kind === "unavailable" ? (
            <Alert tone="error">{t.signInUnavailable}</Alert>
          ) : notice ? (
            <Alert tone={notice.tone}>{notice.text}</Alert>
          ) : undefined
        }
      />
    </AuthShell>
  );
}
