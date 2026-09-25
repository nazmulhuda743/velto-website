import Link from "@/components/i18n/Link";
import { signOutAction } from "@/lib/customer/actions";
import { Alert } from "./Alert";
import { accountText } from "@/content/i18n/account";
import { getLocale } from "@/lib/i18n/server";

const text = async () => accountText(await getLocale()).notices;

/** Shown on sign-in / sign-up pages when a session already exists. */
export async function SignedInNotice({ email, next }: { email: string; next: string }) {
  const t = await text();
  return (
    <div className="space-y-5" data-already-signed-in>
      <Alert tone="info" title={t.alreadyTitle}>
        {t.signedInAsBefore}
        <strong className="text-navy">{email}</strong>
        {t.signedInAsAfter}
      </Alert>
      <Link href={next} className="inline-flex h-[52px] w-full items-center justify-center rounded-md bg-action px-6 font-semibold text-white hover:bg-action-hover lg:h-12">
        {t.continue}
      </Link>
      <form action={signOutAction}>
        <button type="submit" className="w-full text-center t-small font-semibold text-navy underline decoration-blue/50 underline-offset-4">
          {t.notYou}
        </button>
      </form>
    </div>
  );
}

export async function AccountsUnavailable() {
  const t = await text();
  return (
    <div className="space-y-5" data-accounts-disabled>
      <Alert tone="info" title={t.comingTitle}>
        {t.comingBody}
      </Alert>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/book" className="inline-flex h-12 items-center justify-center rounded-md bg-action px-5 font-semibold text-white hover:bg-action-hover">
          {t.book}
        </Link>
        <Link href="/track" className="inline-flex h-12 items-center justify-center rounded-md border border-line-strong bg-white px-5 font-semibold text-navy hover:border-navy">
          {t.track}
        </Link>
      </div>
    </div>
  );
}

export async function StaffAccountNotice() {
  const t = await text();
  return (
    <div className="space-y-5">
      <Alert tone="info" title={t.staffTitle}>
        {t.staffBody}
      </Alert>
      <form action={signOutAction}>
        <button type="submit" className="inline-flex h-12 w-full items-center justify-center rounded-md border border-line-strong bg-white px-5 font-semibold text-navy hover:border-navy">
          {t.signOut}
        </button>
      </form>
    </div>
  );
}
