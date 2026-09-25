import Link from "@/components/i18n/Link";
import type { PortalAccount } from "@/lib/customer/portal";
import { requestLinkAction } from "@/lib/customer/actions";
import { displayBdPhone } from "@/lib/customer/validation";
import { accountText, orderFormat } from "@/content/i18n/account";
import { format } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { SubmitButton } from "./SubmitButton";

type Ready = Extract<PortalAccount, { state: "ready" }>;

/**
 * Connecting past Velto orders: a secondary setup task, so it stays visually quiet.
 * Nothing links automatically from a typed phone number: Velto verifies the number on
 * the customer record first.
 */
export async function LinkHistoryCard({ account, emphasis = "quiet" }: { account: Ready; emphasis?: "quiet" | "page" }) {
  const locale = await getLocale();
  const t = accountText(locale).link;
  const { day } = orderFormat(locale);
  const { status, requestedAt } = account.link;
  if (status === "linked") return null;
  const phone = <strong className="font-semibold text-navy">{displayBdPhone(account.phone)}</strong>;
  const page = emphasis === "page";

  return (
    <section
      aria-labelledby="link-title"
      className={`rounded-lg border ${page ? "border-line bg-white p-5 md:p-7" : "border-dashed border-line-strong bg-white/60 p-4 md:p-5"}`}
      data-link-status={status}
    >
      <div className={page ? "" : "md:flex md:items-start md:justify-between md:gap-6"}>
        <div className="min-w-0">
          <h2 id="link-title" className={page ? "t-h3 text-navy" : "font-semibold text-navy"}>
            {status === "pending" ? t.pendingTitle : t.title}
          </h2>
          {status === "pending" ? (
            <p className="mt-1.5 max-w-[62ch] t-small text-body">
              {format(t.pendingBefore, { date: day(requestedAt) ?? "" })}
              {phone}
              {t.pendingAfter}
            </p>
          ) : (
            <p className="mt-1.5 max-w-[62ch] t-small text-body">
              {t.bodyBefore}
              {phone}
              {t.bodyAfter}
              {status === "rejected" ? (
                <>
                  {t.rejectedBefore}
                  <Link href="/account/profile" className="font-semibold text-navy underline underline-offset-4">
                    {t.updateLink}
                  </Link>
                  {t.rejectedAfter}
                </>
              ) : null}
            </p>
          )}
        </div>
        {status !== "pending" ? (
          <form action={requestLinkAction} className={page ? "mt-5 max-w-[320px]" : "mt-4 shrink-0 md:mt-0 md:w-[220px]"}>
            <SubmitButton pending={t.pending} variant="secondary" className={page ? "" : "!h-11"}>
              {t.button}
            </SubmitButton>
          </form>
        ) : null}
      </div>
    </section>
  );
}
