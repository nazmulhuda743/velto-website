import type { Metadata } from "next";
import { Alert } from "@/components/account/Alert";
import { AuthShell } from "@/components/account/AuthShell";
import { SignInForm } from "@/components/account/forms";
import { AccountsUnavailable, SignedInNotice, StaffAccountNotice } from "@/components/account/SignedInNotice";
import { getCustomerSession } from "@/lib/customer/portal";
import { safeNextPath } from "@/lib/customer/validation";

export const metadata: Metadata = {
  title: "Sign in — Velto Premium Laundry",
  robots: { index: false, follow: false },
  alternates: { canonical: "/login" },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const NOTICES: Record<string, { tone: "error" | "info"; text: string }> = {
  link_expired: { tone: "error", text: "That link has expired or was already used. Sign in below, or request a new link." },
  link_unavailable: { tone: "error", text: "We couldn't check that link just now. Please try it again in a moment." },
  signed_out: { tone: "info", text: "You've been signed out." },
};

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = safeNextPath(one(params.next));
  const notice = NOTICES[one(params.error) ?? ""];
  const session = await getCustomerSession();

  if (session.kind === "disabled") {
    return (
      <AuthShell title="Sign in">
        <AccountsUnavailable />
      </AuthShell>
    );
  }
  if (session.kind === "customer" || session.kind === "staff") {
    return (
      <AuthShell title="Sign in">
        {session.kind === "staff" ? <StaffAccountNotice /> : <SignedInNotice email={session.user.email ?? ""} next={next} />}
      </AuthShell>
    );
  }
  return (
    <AuthShell
      title="Sign in"
      intro={next.startsWith("/book") ? "Sign in and we'll fill in your details for this pickup." : "See your orders and book pickups faster."}
    >
      <SignInForm
        next={next}
        notice={
          session.kind === "unavailable" ? (
            <Alert tone="error">We can&apos;t reach Velto accounts right now. You can still try to sign in, or come back in a moment.</Alert>
          ) : notice ? (
            <Alert tone={notice.tone}>{notice.text}</Alert>
          ) : undefined
        }
      />
    </AuthShell>
  );
}
