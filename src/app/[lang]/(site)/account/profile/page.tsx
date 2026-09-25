import { redirect } from "next/navigation";
import { getLocale, loginRedirectPath } from "@/lib/i18n/server";
import { accountText } from "@/content/i18n/account";
import { format } from "@/lib/i18n/config";
import { ProfileForm } from "@/components/account/forms";
import { LinkHistoryCard } from "@/components/account/LinkHistoryCard";
import { WHATSAPP_URL } from "@/content/site";
import { signOutAction } from "@/lib/customer/actions";
import { getCustomerSession } from "@/lib/customer/portal";
import { displayBdPhone } from "@/lib/customer/validation";

export default async function ProfilePage() {
  const session = await getCustomerSession();
  if (session.kind !== "customer" || session.account.state !== "ready") redirect(await loginRedirectPath("/account/profile"));
  const a = session.account;
  const locked = a.link.status === "linked" ? "linked" : a.link.status === "pending" ? "pending" : null;
  const text = accountText(await getLocale());
  const t = text.profile;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="t-h1 text-navy">{t.title}</h1>
        <p className="mt-2 text-body">{t.intro}</p>
      </header>

      <section aria-labelledby="details-title" className="rounded-lg border border-line bg-white p-5 md:p-8">
        <h2 id="details-title" className="t-h3 text-navy">
          {t.yourDetails}
        </h2>
        <div className="mt-6 max-w-[560px]">
          <ProfileForm t={text.forms} phoneLocked={locked} initial={{ fullName: a.fullName, phone: a.phone, address: a.address ?? "", area: a.area ?? "" }} />
        </div>
      </section>

      <section aria-labelledby="sign-in-title" className="rounded-lg border border-line bg-white p-5 md:p-8">
        <h2 id="sign-in-title" className="t-h3 text-navy">
          {t.signIn}
        </h2>
        <dl className="mt-4 max-w-[560px] space-y-4">
          <div>
            <dt className="text-[15px] font-semibold text-navy">{t.email}</dt>
            <dd className="mt-1 text-body">{a.email}</dd>
            <dd className="mt-1 t-small text-secondary">
              {t.changeEmailBefore}
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-navy underline underline-offset-4">
                {t.messageVelto}
              </a>
              {t.changeEmailAfter}
            </dd>
          </div>
          <div>
            <dt className="text-[15px] font-semibold text-navy">{t.password}</dt>
            <dd className="mt-1 t-small text-secondary">{t.passwordBody}</dd>
          </div>
        </dl>
        <form action={signOutAction} className="mt-6">
          <button type="submit" className="inline-flex h-12 items-center rounded-md border border-line-strong bg-white px-5 font-semibold text-navy hover:border-navy">
            {t.signOut}
          </button>
        </form>
      </section>

      {a.link.status !== "linked" ? (
        <LinkHistoryCard account={a} />
      ) : (
        <section aria-labelledby="linked-title" className="rounded-lg border border-line bg-white p-5 md:p-8">
          <h2 id="linked-title" className="t-h3 text-navy">
            {t.history}
          </h2>
          <p className="mt-3 text-body">
            {t.linkedBefore}
            {a.link.verifiedPhone ? format(t.linkedWith, { phone: displayBdPhone(a.link.verifiedPhone) }) : ""}
            {t.linkedAfter}
          </p>
        </section>
      )}
    </div>
  );
}
