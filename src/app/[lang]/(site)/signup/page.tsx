import type { Metadata } from "next";
import { AuthShell } from "@/components/account/AuthShell";
import { SignUpForm } from "@/components/account/forms";
import { AccountsUnavailable, SignedInNotice, StaffAccountNotice } from "@/components/account/SignedInNotice";
import { authProviders } from "@/lib/customer/providers";
import { getCustomerSession } from "@/lib/customer/portal";
import { signedInAs, safeNextPath } from "@/lib/customer/validation";
import { alternatesFor, shareCardMetadata } from "@/lib/seo/page-metadata";
import { accountText } from "@/content/i18n/account";
import { getLocale } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const title = accountText(await getLocale()).meta.signUp;
  return { title, robots: { index: false, follow: false }, alternates: await alternatesFor("/signup"), ...(await shareCardMetadata("/signup", title)) };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function SignUpPage({ searchParams }: { searchParams: SearchParams }) {
  const next = safeNextPath(one((await searchParams).next));
  const [session, providers] = await Promise.all([getCustomerSession(), authProviders()]);
  const a = accountText(await getLocale());
  const title = a.pages.signUpTitle;

  if (session.kind === "disabled") {
    return (
      <AuthShell title={title}>
        <AccountsUnavailable />
      </AuthShell>
    );
  }
  if (session.kind === "customer" || session.kind === "staff") {
    return (
      <AuthShell title={title}>
        {session.kind === "staff" ? <StaffAccountNotice /> : <SignedInNotice email={signedInAs(session.user)} next={next} />}
      </AuthShell>
    );
  }
  return (
    <AuthShell mode="signup" next={next} title={title} intro={a.pages.signUpIntro}>
      <SignUpForm t={a.forms} next={next} google={providers.google} phone={providers.phone} />
    </AuthShell>
  );
}
