import type { Metadata } from "next";
import { AuthShell } from "@/components/account/AuthShell";
import { ForgotPasswordForm } from "@/components/account/forms";
import { AccountsUnavailable } from "@/components/account/SignedInNotice";
import { customerAccountsEnabled } from "@/lib/customer/config";
import { alternatesFor } from "@/lib/seo/page-metadata";

const baseMetadata: Metadata = {
  title: "Reset your password — Velto Premium Laundry",
  robots: { index: false, follow: false },
};

export async function generateMetadata(): Promise<Metadata> {
  return { ...baseMetadata, alternates: await alternatesFor("/forgot-password") };
}

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Reset your password" intro="Enter the email you signed up with and we'll send you a link to choose a new password.">
      {customerAccountsEnabled() ? <ForgotPasswordForm /> : <AccountsUnavailable />}
    </AuthShell>
  );
}
