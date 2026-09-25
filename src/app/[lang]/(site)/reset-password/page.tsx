import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Alert } from "@/components/account/Alert";
import { AuthShell } from "@/components/account/AuthShell";
import { ExpiredResetLink, ResetPasswordForm } from "@/components/account/forms";
import { AccountsUnavailable } from "@/components/account/SignedInNotice";
import { RECOVERY_COOKIE } from "@/lib/customer/config";
import { getCustomerSession } from "@/lib/customer/portal";
import { alternatesFor } from "@/lib/seo/page-metadata";
import { accountText } from "@/content/i18n/account";
import { getLocale } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const title = accountText(await getLocale()).meta.reset;
  return { title, robots: { index: false, follow: false }, alternates: await alternatesFor("/reset-password") };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const error = (await searchParams).error;
  const session = await getCustomerSession();
  const recovering = (await cookies()).get(RECOVERY_COOKIE)?.value === "1";
  const a = accountText(await getLocale());
  const title = a.pages.resetTitle;

  if (session.kind === "disabled") {
    return (
      <AuthShell title={title}>
        <AccountsUnavailable />
      </AuthShell>
    );
  }
  if (error === "unavailable" || session.kind === "unavailable") {
    return (
      <AuthShell title={title}>
        <Alert tone="error" title={a.pages.resetUnavailableTitle}>
          {a.pages.resetUnavailableBody}
        </Alert>
      </AuthShell>
    );
  }
  // Only a session that just came through a valid recovery link may set a new password.
  if (error || !recovering || (session.kind !== "customer" && session.kind !== "staff")) {
    return (
      <AuthShell title={title}>
        <ExpiredResetLink t={a.forms} />
      </AuthShell>
    );
  }
  return (
    <AuthShell title={title} intro={a.pages.resetIntro}>
      <ResetPasswordForm t={a.forms} />
    </AuthShell>
  );
}
