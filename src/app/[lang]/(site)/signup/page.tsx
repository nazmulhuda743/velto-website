import type { Metadata } from "next";
import { AuthShell } from "@/components/account/AuthShell";
import { SignUpForm } from "@/components/account/forms";
import { AccountsUnavailable, SignedInNotice, StaffAccountNotice } from "@/components/account/SignedInNotice";
import { getCustomerSession } from "@/lib/customer/portal";
import { safeNextPath } from "@/lib/customer/validation";
import { alternatesFor } from "@/lib/seo/page-metadata";

const baseMetadata: Metadata = {
  title: "Create an account — Velto Premium Laundry",
  robots: { index: false, follow: false },
};

export async function generateMetadata(): Promise<Metadata> {
  return { ...baseMetadata, alternates: await alternatesFor("/signup") };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function SignUpPage({ searchParams }: { searchParams: SearchParams }) {
  const next = safeNextPath(one((await searchParams).next));
  const session = await getCustomerSession();
  const title = "Create your Velto account";

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
    <AuthShell title={title} intro="Keep your orders in one place and book pickups with your details already filled in.">
      <SignUpForm next={next} />
    </AuthShell>
  );
}
