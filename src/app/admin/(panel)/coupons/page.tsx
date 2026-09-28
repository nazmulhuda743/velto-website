import Link from "next/link";
import { AdminHeader, Badge, DataNotice, Notice, one, type SearchParams } from "@/components/admin/ui";
import { getGoalCoupons, type CouponRow } from "@/lib/admin/customer-extras";
import { whatsappLink } from "@/lib/admin/retention-messages";
import { requireSection } from "@/lib/admin/session";
import { monthName, shiftMonth, todayDhaka } from "@/lib/customer/goal";
import { displayBdPhone } from "@/lib/customer/validation";
import { getSiteContent } from "@/lib/site-content";
import { markCouponAction, settleGoalAction } from "../../customer-actions";

const day = (iso: string) => new Date(`${iso}T00:00:00+06:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Dhaka" });
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
const taka = (n: number) => `৳${Math.round(n).toLocaleString("en-IN")}`;

const TONE: Record<CouponRow["status"], "green" | "blue" | "neutral" | "amber"> = { open: "green", used: "blue", void: "neutral", expired: "neutral" };

function Row({ r }: { r: CouponRow }) {
  const what = r.kind === "delivery" ? "Free pickup & delivery all month" : `${taka(r.amount)} off one order`;
  const first = r.customerName?.split(" ")[0];
  const wa = whatsappLink(
    r.customerPhone,
    `Hello${first ? ` ${first}` : ""}, this is Velto. You reached your ${monthName(r.month)} goal, so this month you have: ${what}. Your code is ${r.code}. Book as usual and we apply it. Thank you for being a regular!`,
  );
  return (
    <li className="admin-card p-4 md:p-5" data-coupon-row={r.status}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-sm bg-navy px-2 py-0.5 text-[13px] font-semibold tracking-[0.06em] text-white">{r.code}</span>
            <span className="font-semibold text-navy">{what}</span>
            <Badge tone={TONE[r.status]}>{r.status === "open" ? `Valid ${day(r.validFrom)} – ${day(r.validTo)}` : r.status === "used" ? `Used${r.orderNumber ? ` on ${r.orderNumber}` : ""}` : r.status === "void" ? "Withdrawn" : "Expired"}</Badge>
          </div>
          <p className="mt-1.5 t-small text-body">
            <span className="font-semibold text-navy">{r.customerName ?? "Customer"}</span>
            {r.customerPhone ? <span className="text-secondary"> · {displayBdPhone(r.customerPhone)}</span> : null}
            <span className="text-secondary"> · spent {taka(r.spend)} in {monthName(r.month)}</span>
            {r.usedAt ? <span className="text-secondary"> · {r.status} by {r.usedBy ?? "staff"}, {when(r.usedAt)}</span> : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {wa && r.status === "open" ? (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="admin-btn-secondary !h-9 !px-3 t-small">
              Tell them on WhatsApp ↗
            </a>
          ) : null}
          {r.status === "open" ? (
            <form action={markCouponAction} className="flex items-center gap-2">
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="code" value={r.code} />
              <input type="hidden" name="status" value="used" />
              <input name="orderNumber" placeholder="VEL-01234" aria-label="Order number" className="admin-input !h-9 w-32 t-small" />
              <button type="submit" className="admin-btn !h-9 !px-3 t-small">
                Mark used
              </button>
            </form>
          ) : null}
          {r.status === "open" ? (
            <form action={markCouponAction}>
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="code" value={r.code} />
              <input type="hidden" name="status" value="void" />
              <button type="submit" className="admin-btn-secondary !h-9 !px-3 t-small">
                Withdraw
              </button>
            </form>
          ) : r.status !== "expired" ? (
            <form action={markCouponAction}>
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="code" value={r.code} />
              <input type="hidden" name="status" value="open" />
              <button type="submit" className="admin-btn-secondary !h-9 !px-3 t-small">
                Reopen
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/** The month's coupons: issue them on the 1st, tell the customer, mark them used when Ops applies them. */
export default async function CouponsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireSection("coupons");
  const params = await searchParams;
  const { loyalty } = await getSiteContent();
  const rows = await getGoalCoupons();
  const saved = one(params.saved);
  const thisMonth = todayDhaka().slice(0, 7);
  const months = [1, 2, 3].map((n) => shiftMonth(thisMonth, -n));
  const filter = one(params.status) ?? "open";
  const list = rows.state === "ok" ? rows.data.filter((r) => (filter === "all" ? true : r.status === filter)) : [];
  const counts = rows.state === "ok" ? { open: rows.data.filter((r) => r.status === "open").length, used: rows.data.filter((r) => r.status === "used").length, all: rows.data.length } : null;

  return (
    <>
      <AdminHeader
        title="Goal coupons"
        intro="Rewards customers earned by reaching their monthly goal (the ladder is on Loyalty). Issue last month's coupons on the 1st, tell each customer, and when Ops applies a coupon to an order, mark it used here. The website never changes an order's total."
        actions={<Link href="/admin/loyalty#goal" className="admin-btn-secondary">Set the ladder</Link>}
      />
      <Notice saved={saved?.startsWith("issued:") ? undefined : saved} error={one(params.error)} />
      {saved?.startsWith("issued:") ? (
        <p className="mt-4 rounded-md border border-[#bfe3c8] bg-[#eefaf1] px-4 py-3 t-small font-medium text-[#1d6b34]">
          Issued {saved.slice(7)} new coupon{saved.slice(7) === "1" ? "" : "s"}. Customers who already had one for that month were skipped.
        </p>
      ) : null}

      <section aria-labelledby="issue-title" className="admin-card mt-6 p-5 md:p-7">
        <h2 id="issue-title" className="t-h4 text-navy">
          Issue a month&apos;s coupons
        </h2>
        <p className="mt-1 t-small text-secondary">
          Safe to run more than once: nobody gets two coupons for one month. Ladder now:{" "}
          {loyalty.goal.rungs.map((r, i) => (
            <span key={r.spend}>
              {i > 0 ? " · " : ""}৳{r.spend} → {r.label}
            </span>
          ))}
          {loyalty.goal.doubleFirst ? " · first order counts twice" : ""}. {loyalty.goal.enabled ? "" : "The goal is switched off for customers; coupons can still be issued."}
        </p>
        <form action={settleGoalAction} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="block t-small font-semibold text-navy">Month</span>
            <select name="month" defaultValue={months[0]} className="admin-input mt-1 w-48">
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthName(m)} {m.slice(0, 4)}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="admin-btn">
            Issue coupons
          </button>
        </form>
      </section>

      <section aria-labelledby="list-title" className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="list-title" className="t-h4 text-navy">
            Coupons
          </h2>
          {counts ? (
            <nav aria-label="Filter" className="flex gap-1.5 t-small">
              {(["open", "used", "all"] as const).map((f) => (
                <Link key={f} href={`/admin/coupons?status=${f}`} className={`rounded-full border px-3 py-1 ${filter === f ? "border-navy bg-navy text-white" : "border-line text-body hover:border-navy"}`}>
                  {f === "open" ? "Open" : f === "used" ? "Used" : "All"} · {counts[f]}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
        {rows.state !== "ok" ? (
          <DataNotice state={rows.state} message={rows.state === "error" ? rows.message : undefined} />
        ) : (
          <>
            {rows.preview ? <DataNotice state="preview" /> : null}
            {list.length ? (
              <ul className="mt-4 space-y-3">
                {list.map((r) => (
                  <Row key={r.id} r={r} />
                ))}
              </ul>
            ) : (
              <p className="mt-4 t-small text-secondary">No {filter === "all" ? "" : filter + " "}coupons yet. Issue last month&apos;s above once the month is over.</p>
            )}
          </>
        )}
      </section>
    </>
  );
}
