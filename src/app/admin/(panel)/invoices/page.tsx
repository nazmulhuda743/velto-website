import Link from "next/link";
import { CopyText } from "@/components/admin/CopyText";
import { InvoiceSendButton } from "@/components/admin/InvoiceSendButton";
import { AdminHeader, Badge, DataNotice, one, type SearchParams } from "@/components/admin/ui";
import { getInvoiceList } from "@/lib/admin/invoices";
import { whatsappLink } from "@/lib/admin/retention-messages";
import { requireSection } from "@/lib/admin/session";
import { displayBdPhone } from "@/lib/customer/validation";
import { invoiceLink, invoiceMessage, type InvoiceLang } from "@/lib/invoice";
import type { InvoiceRow } from "@/lib/invoice-server";
import { SITE_URL } from "@/lib/seo/site";

export const metadata = { title: "Invoices on WhatsApp · Velto Command Center" };

const DAYS = [1, 3, 7] as const;

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Dhaka" }) : null;
const tk = (n: number) => `৳${Math.round(n).toLocaleString("en-US")}`;

function Row({ r, lang }: { r: InvoiceRow; lang: InvoiceLang }) {
  const link = invoiceLink(SITE_URL, r.code, lang);
  const message = invoiceMessage({ name: r.name, orderNumber: r.orderNumber, status: r.status, total: r.total, due: r.due, link }, lang);
  // The customer's WhatsApp number when Ops has one, else their phone.
  const to = r.whatsapp ?? r.phone;
  const wa = whatsappLink(to, message);
  return (
    <li className="admin-card p-4 md:p-5" data-invoice-row>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="font-semibold text-navy">
            {r.orderNumber} · {r.name || "Unnamed customer"}
          </p>
          <p className="t-small text-secondary">
            {[r.status, `total ${tk(r.total)}`, r.due > 0 ? `due ${tk(r.due)}` : "paid", `created ${when(r.createdAt)}`].join(" · ")}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {r.sentAt ? <Badge tone="green">Sent {when(r.sentAt)}{r.sentCount > 1 ? ` (${r.sentCount}×)` : ""}</Badge> : <Badge tone="amber">Not sent</Badge>}
            {r.openedAt ? <Badge tone="blue">Opened {when(r.openedAt)}</Badge> : null}
            {r.hasAccount ? <Badge>Has an account</Badge> : null}
          </div>
        </div>
        <p className="t-small font-semibold text-navy tabular-nums">{to ? displayBdPhone(to) : "No number"}</p>
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer t-small font-semibold text-blue">See the message</summary>
        <p className="mt-2 whitespace-pre-line rounded-md bg-soft p-3 t-small text-body" lang={lang}>
          {message}
        </p>
      </details>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {wa ? <InvoiceSendButton href={wa} code={r.code} label={r.sentAt ? "Send again on WhatsApp" : "Send on WhatsApp"} /> : <Badge tone="amber">No valid mobile number</Badge>}
        <CopyText text={link} label="Copy link" />
        <a href={link} target="_blank" rel="noopener noreferrer" className="admin-btn-secondary">
          View invoice
        </a>
      </div>
    </li>
  );
}

export default async function InvoicesPage({ searchParams }: { searchParams: SearchParams }) {
  await requireSection("dispatch");
  const params = await searchParams;
  const lang: InvoiceLang = one(params.lang) === "en" ? "en" : "bn";
  const daysParam = Number(one(params.days));
  const days = (DAYS as readonly number[]).includes(daysParam) ? daysParam : 3;
  const q = (one(params.q) ?? "").trim().slice(0, 40) || null;
  const list = await getInvoiceList(days, q);
  const href = (p: Record<string, string>) => `/admin/invoices?${new URLSearchParams({ lang, days: String(days), ...(q ? { q } : {}), ...p })}`;
  const rows = list.state === "ok" ? list.rows : [];
  const unsent = rows.filter((r) => !r.sentAt).length;

  return (
    <>
      <AdminHeader
        title="Invoices on WhatsApp"
        intro="Every Velto Ops order has one invoice link. Send it on WhatsApp: the customer sees the items, prices and what's due, and signing in with the same number puts all their orders in their website account. The message carries this one link only."
      />
      {list.state === "not_configured" ? <DataNotice state="not_configured" /> : null}
      {list.state === "error" ? <DataNotice state="error" message={list.message} /> : null}

      <form action="/admin/invoices" className="mt-6 flex flex-wrap items-end gap-2">
        <input type="hidden" name="lang" value={lang} />
        <input type="hidden" name="days" value={String(days)} />
        <label className="grid gap-1 t-small font-semibold text-navy">
          Find an order
          <input name="q" defaultValue={q ?? ""} placeholder="Order number or phone" className="admin-input w-64 max-w-full" />
        </label>
        <button type="submit" className="admin-btn-secondary">
          Search
        </button>
        {q ? (
          <Link href={href({ q: "" })} className="t-small font-semibold text-blue underline underline-offset-4">
            Clear
          </Link>
        ) : null}
      </form>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Period" className="flex flex-wrap gap-1.5">
          {DAYS.map((d) => (
            <Link key={d} href={href({ days: String(d) })} aria-current={!q && d === days ? "page" : undefined} className={!q && d === days ? "admin-btn" : "admin-btn-secondary"}>
              {d === 1 ? "Last 24 hours" : `Last ${d} days`}
            </Link>
          ))}
        </nav>
        <nav aria-label="Message language" className="flex gap-1.5">
          {(["bn", "en"] as const).map((l) => (
            <Link key={l} href={href({ lang: l })} aria-current={l === lang ? "page" : undefined} className={l === lang ? "admin-btn" : "admin-btn-secondary"}>
              {l === "bn" ? "বাংলা" : "English"}
            </Link>
          ))}
        </nav>
      </div>

      {list.state === "ok" ? (
        <>
          <p className="mt-5 t-small text-secondary">
            {q ? `${rows.length} order${rows.length === 1 ? "" : "s"} found` : `${rows.length} order${rows.length === 1 ? "" : "s"}, ${unsent} not sent yet`}
          </p>
          {rows.length ? (
            <ul className="mt-3 space-y-3">
              {rows.map((r) => (
                <Row key={r.code + r.orderNumber} r={r} lang={lang} />
              ))}
            </ul>
          ) : (
            <p className="mt-3 admin-card p-5 t-small text-body">{q ? "No order matches. Check the order number or phone." : "No orders in this period."}</p>
          )}
        </>
      ) : null}
    </>
  );
}
