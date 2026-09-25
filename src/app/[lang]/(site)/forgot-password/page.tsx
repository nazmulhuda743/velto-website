import type { Metadata } from "next";
import { AuthShell } from "@/components/account/AuthShell";
import { ForgotPasswordForm } from "@/components/account/forms";
import { AccountsUnavailable } from "@/components/account/SignedInNotice";
import { customerAccountsEnabled } from "@/lib/customer/config";
import { alternatesFor } from "@/lib/seo/page-metadata";
import { accountText } from "@/content/i18n/account";
import { getLocale } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const title = accountText(await getLocale()).meta.forgot;
  return { title, robots: { index: false, follow: false }, alternates: await alternatesFor("/forgot-password") };
}

export default async function ForgotPasswordPage() {
  const a = accountText(await getLocale());
  return (
    <AuthShell title={a.pages.forgotTitle} intro={a.pages.forgotIntro}>
      {customerAccountsEnabled() ? <ForgotPasswordForm t={a.forms} /> : <AccountsUnavailable />}
    </AuthShell>
  );
}
