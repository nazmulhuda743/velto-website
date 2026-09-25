import { redirect } from "next/navigation";
import { loginRedirectPath } from "@/lib/i18n/server";
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

  return (
    <div className="space-y-8">
      <header>
        <h1 className="t-h1 text-navy">Profile</h1>
        <p className="mt-2 text-body">These details fill in your bookings. Velto confirms every pickup with you before collecting.</p>
      </header>

      <section aria-labelledby="details-title" className="rounded-lg border border-line bg-white p-5 md:p-8">
        <h2 id="details-title" className="t-h3 text-navy">
          Your details
        </h2>
        <div className="mt-6 max-w-[560px]">
          <ProfileForm phoneLocked={locked} initial={{ fullName: a.fullName, phone: a.phone, address: a.address ?? "", area: a.area ?? "" }} />
        </div>
      </section>

      <section aria-labelledby="sign-in-title" className="rounded-lg border border-line bg-white p-5 md:p-8">
        <h2 id="sign-in-title" className="t-h3 text-navy">
          Sign-in
        </h2>
        <dl className="mt-4 max-w-[560px] space-y-4">
          <div>
            <dt className="text-[15px] font-semibold text-navy">Email</dt>
            <dd className="mt-1 text-body">{a.email}</dd>
            <dd className="mt-1 t-small text-secondary">
              To change the email you sign in with,{" "}
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-navy underline underline-offset-4">
                message Velto
              </a>
              .
            </dd>
          </div>
          <div>
            <dt className="text-[15px] font-semibold text-navy">Password</dt>
            <dd className="mt-1 t-small text-secondary">
              Sign out and use &quot;Forgot password?&quot; to choose a new one. We&apos;ll email you a secure link.
            </dd>
          </div>
        </dl>
        <form action={signOutAction} className="mt-6">
          <button type="submit" className="inline-flex h-12 items-center rounded-md border border-line-strong bg-white px-5 font-semibold text-navy hover:border-navy">
            Sign out
          </button>
        </form>
      </section>

      {a.link.status !== "linked" ? (
        <LinkHistoryCard account={a} />
      ) : (
        <section aria-labelledby="linked-title" className="rounded-lg border border-line bg-white p-5 md:p-8">
          <h2 id="linked-title" className="t-h3 text-navy">
            Velto history
          </h2>
          <p className="mt-3 text-body">
            Linked to your Velto customer record, verified {a.link.verifiedPhone ? `with ${displayBdPhone(a.link.verifiedPhone)}` : ""}.
          </p>
        </section>
      )}
    </div>
  );
}
