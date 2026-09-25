import type { Metadata } from "next";
import { AuthShell } from "@/components/account/AuthShell";
import { SignUpForm } from "@/components/account/forms";
import { AccountsUnavailable, SignedInNotice, StaffAccountNotice } from "@/components/account/SignedInNotice";
import { getCustomerSession } from "@/lib/customer/portal";
import { safeNextPath } from "@/lib/customer/validation";
import { alternatesFor } from "@/lib/seo/page-metadata";
import { accountText } from "@/content/i18n/account";
import { getLocale } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const title = accountText(await getLocale()).meta.signUp;
  return { title, robots: { index: false, follow: false }, alternates: await alternatesFor("/signup") };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function SignUpPage({ searchParams }: { searchParams: SearchParams }) {
  const next = safeNextPath(one((await searchParams).next));
  const session = await getCustomerSession();
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
        {session.kind === "staff" ? <StaffAccountNotice /> : <SignedInNotice email={session.user.email ?? ""} next={next} />}
      </AuthShell>
    );
  }
  return (
    <AuthShell title={title} intro={a.pages.signUpIntro}>
      <SignUpForm t={a.forms} next={next} />
    </AuthShell>
  );
}
