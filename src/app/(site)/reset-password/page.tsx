import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Alert } from "@/components/account/Alert";
import { AuthShell } from "@/components/account/AuthShell";
import { ExpiredResetLink, ResetPasswordForm } from "@/components/account/forms";
import { AccountsUnavailable } from "@/components/account/SignedInNotice";
import { RECOVERY_COOKIE } from "@/lib/customer/config";
import { getCustomerSession } from "@/lib/customer/portal";

export const metadata: Metadata = {
  title: "Choose a new password — Velto Premium Laundry",
  robots: { index: false, follow: false },
  alternates: { canonical: "/reset-password" },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const error = (await searchParams).error;
  const session = await getCustomerSession();
  const recovering = (await cookies()).get(RECOVERY_COOKIE)?.value === "1";
  const title = "Choose a new password";

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
        <Alert tone="error" title="We couldn't check your reset link just now.">
          Please open the link from your email again in a moment.
        </Alert>
      </AuthShell>
    );
  }
  // Only a session that just came through a valid recovery link may set a new password.
  if (error || !recovering || (session.kind !== "customer" && session.kind !== "staff")) {
    return (
      <AuthShell title={title}>
        <ExpiredResetLink />
      </AuthShell>
    );
  }
  return (
    <AuthShell title={title} intro="Choose a password you don't use anywhere else.">
      <ResetPasswordForm />
    </AuthShell>
  );
}
