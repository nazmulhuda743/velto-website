import Link from "next/link";
import { signOutAction } from "@/lib/customer/actions";
import { Alert } from "./Alert";

/** Shown on sign-in / sign-up pages when a session already exists. */
export function SignedInNotice({ email, next }: { email: string; next: string }) {
  return (
    <div className="space-y-5" data-already-signed-in>
      <Alert tone="info" title="You're already signed in.">
        Signed in as <strong className="text-navy">{email}</strong>.
      </Alert>
      <Link href={next} className="inline-flex h-[52px] w-full items-center justify-center rounded-md bg-action px-6 font-semibold text-white hover:bg-action-hover lg:h-12">
        Continue to your account
      </Link>
      <form action={signOutAction}>
        <button type="submit" className="w-full text-center t-small font-semibold text-navy underline decoration-blue/50 underline-offset-4">
          Not you? Sign out
        </button>
      </form>
    </div>
  );
}

export function AccountsUnavailable() {
  return (
    <div className="space-y-5" data-accounts-disabled>
      <Alert tone="info" title="Customer accounts are coming soon.">
        You don&apos;t need an account to use Velto. Book a pickup, request a quote or track an order at any time.
      </Alert>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/book" className="inline-flex h-12 items-center justify-center rounded-md bg-action px-5 font-semibold text-white hover:bg-action-hover">
          Book a Pickup
        </Link>
        <Link href="/track" className="inline-flex h-12 items-center justify-center rounded-md border border-line-strong bg-white px-5 font-semibold text-navy hover:border-navy">
          Track an Order
        </Link>
      </div>
    </div>
  );
}

export function StaffAccountNotice() {
  return (
    <div className="space-y-5">
      <Alert tone="info" title="This is a Velto staff account.">
        Staff accounts can&apos;t be used as customer accounts. Sign out, then sign in with a personal customer account.
      </Alert>
      <form action={signOutAction}>
        <button type="submit" className="inline-flex h-12 w-full items-center justify-center rounded-md border border-line-strong bg-white px-5 font-semibold text-navy hover:border-navy">
          Sign out
        </button>
      </form>
    </div>
  );
}
