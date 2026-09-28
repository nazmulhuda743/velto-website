import Link from "@/components/i18n/Link";
import type { PortalAccount } from "@/lib/customer/portal";
import { requestLinkAction } from "@/lib/customer/actions";
import { displayBdPhone } from "@/lib/customer/validation";
import { accountText, orderFormat } from "@/content/i18n/account";
import { format } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { LinkBySms } from "./forms";

type Ready = Extract<PortalAccount, { state: "ready" }>;

/**
 * Connecting past Velto orders. A typed phone number never unlocks history: the customer proves
 * the phone with an SMS code (one tap), and the orders appear at once. Customers who signed in
 * with their mobile number already proved it, so they only see this when nothing was found.
 * Staff can still check by phone when the SMS can't reach the customer.
 */
export async function LinkHistoryCard({ account, emphasis = "quiet" }: { account: Ready; emphasis?: "quiet" | "page" }) {
  const locale = await getLocale();
  const t = accountText(locale).link;
  const { day } = orderFormat(locale);
  const { status, requestedAt } = account.link;
  if (status === "linked") return null;
  const phone = <strong className="whitespace-nowrap font-semibold text-navy">{displayBdPhone(account.phone)}</strong>;
  const page = emphasis === "page";
  const staffLink = (
    <form action={requestLinkAction} className="inline">
      <button type="submit" className="font-semibold text-navy underline decoration-blue/50 underline-offset-4 hover:decoration-blue">
        {t.staffLink}
      </button>
    </form>
  );

  return (
    <section
      aria-labelledby="link-title"
      className={`rounded-lg border ${page ? "border-line bg-white p-5 md:p-7" : "border-dashed border-line-strong bg-white/60 p-4 md:p-5"}`}
      data-link-status={status}
    >
      <h2 id="link-title" className={page ? "t-h3 text-navy" : "font-semibold text-navy"}>
        {account.phoneVerified && status !== "pending" ? t.verifiedNoOrdersTitle : status === "pending" ? t.pendingTitle : t.title}
      </h2>

      {account.phoneVerified ? (
        // Signed in with this number: it's proven, and nothing matched it automatically.
        <p className="mt-1.5 max-w-[62ch] t-small text-body">
          {status === "pending" ? (
            <>
              {format(t.pendingBefore, { date: day(requestedAt) ?? "" })}
              {phone}
              {t.pendingAfter}
            </>
          ) : (
            <>
              {t.verifiedNoOrders} {t.staffBefore}
              {staffLink}
            </>
          )}
        </p>
      ) : (
        <>
          {status === "pending" ? (
            <p className="mt-1.5 max-w-[62ch] t-small text-body">
              {format(t.pendingBefore, { date: day(requestedAt) ?? "" })}
              {phone}
              {t.pendingAfter}
            </p>
          ) : (
            <p className="mt-1.5 max-w-[62ch] t-small text-body">
              {t.smsBodyBefore}
              {phone}
              {t.smsBodyAfter} {t.wrongNumberBefore}
              <Link href="/account/profile" className="font-semibold text-navy underline underline-offset-4">
                {t.updateLink}
              </Link>
              {t.wrongNumberAfter}
            </p>
          )}
          <div className={`mt-4 ${page ? "max-w-[360px]" : "max-w-[320px]"}`}>
            <LinkBySms t={t} phone={account.phone} />
          </div>
          {status !== "pending" ? (
            <p className="mt-3 t-small text-secondary">
              {t.staffBefore}
              {staffLink}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
