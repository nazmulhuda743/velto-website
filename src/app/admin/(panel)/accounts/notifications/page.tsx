import Link from "next/link";
import { AdminHeader, Badge, one, type SearchParams } from "@/components/admin/ui";
import { getPushDevices } from "@/lib/admin/push-admin";
import { requireSection } from "@/lib/admin/session";
import { displayBdPhone } from "@/lib/customer/validation";
import { PUSH_DESIGNS, renderPush, type PushDesign, type PushLane, type PushLang } from "@/lib/push/catalog";
import { sampleContext } from "@/lib/push/samples";
import { sendDesignAction } from "../../../push-design-actions";

export const metadata = { title: "Notification designs · Velto Command Center" };

const GROUPS: { title: string; note: string; lanes: PushLane[] }[] = [
  { title: "Pickup", note: "Each one a different degree of certainty: requested, confirmed, approaching, collected.", lanes: ["pickup"] },
  { title: "Order", note: "Facts arrive once, at verification. In care and quality check stay off the phone on purpose.", lanes: ["order"] },
  { title: "Your approval", note: "The only kind allowed to interrupt. It stays until opened and never decides anything from the notification.", lanes: ["care"] },
  { title: "Delivery changes", note: "Requested is never confirmed; a confirmed change is always sent.", lanes: ["delivery"] },
  { title: "Payment", note: "Instructions and verification, not a payment gateway. A balance is never shown on the lock screen.", lanes: ["payment"] },
  { title: "Problems, reminders and account", note: "Rare by design.", lanes: ["support", "repeat", "account"] },
];

const CLASS: Record<number, { text: string; tone: "amber" | "blue" | "neutral" }> = {
  1: { text: "Action required · stays until opened", tone: "amber" },
  2: { text: "Update · replaces the older one", tone: "blue" },
  3: { text: "Reminder · silent", tone: "neutral" },
};

const PUSH: Record<string, string> = {
  sent: "Sent to the phone with sample details. It should appear within a few seconds.",
  none: "That phone has no active notifications.",
  failed: "The push service refused it.",
  phone: "Choose a phone first.",
  invalid: "Unknown design.",
  unavailable: "Couldn't reach the database. Try again in a moment.",
};

/** One notification as Android shows it in the shade: app line, title, two lines, picture, button. */
function PhoneCard({ design, lang }: { design: PushDesign; lang: PushLang }) {
  const m = renderPush(design.id, sampleContext(design.id, lang), lang, 1);
  return (
    <div lang={lang} className="rounded-[22px] bg-[#f3f5f7] p-4 text-[#1b1f23] shadow-[0_1px_0_rgba(0,0,0,0.04)]">
      <p className="flex items-center gap-1.5 text-[12px] text-[#5b6670]">
        <span aria-hidden="true" className="inline-grid size-[18px] place-items-center rounded-full bg-action text-[10px] font-bold text-white">
          V
        </span>
        Velto · {lang === "bn" ? "এখন" : "now"}
        {design.cls === 3 ? <span className="ml-1">· {lang === "bn" ? "নীরব" : "silent"}</span> : null}
      </p>
      <div className="mt-1.5 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-snug">{m.title}</p>
          <p className="mt-0.5 text-[14px] leading-snug text-[#47515a]">{m.body}</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- the same static file the phone shows */}
        <img src={m.icon} alt="" width={44} height={44} className="size-11 shrink-0 rounded-[10px]" />
      </div>
      {m.actions?.length ? (
        <div className="mt-3 flex gap-2">
          {m.actions.map((a) => (
            <span key={a.action} className="rounded-full bg-[#e3edf4] px-3.5 py-2 text-[13.5px] font-semibold text-[#0b5a8c]">
              {a.title}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Design({ design, phones }: { design: PushDesign; phones: string[] }) {
  const cls = CLASS[design.cls];
  const link = renderPush(design.id, sampleContext(design.id, "en"), "en", 1).url;
  return (
    <li id={design.id} className="admin-card scroll-mt-24 p-4 md:p-5" data-push-design={design.id}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-soft px-2 py-0.5 font-mono text-[12px] font-semibold text-navy">{design.id}</span>
        <h3 className="font-semibold text-navy">{design.name}</h3>
        <Badge tone={cls.tone}>{cls.text}</Badge>
        {design.live ? <Badge tone="green">Live</Badge> : <Badge>Design only · not sent yet</Badge>}
      </div>
      <p className="mt-1.5 t-small text-secondary">
        {design.when}. Opens <code className="text-navy">{link}</code>
        {design.pref ? ` · customer setting: ${design.pref}` : " · always sent"}.
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <PhoneCard design={design} lang="en" />
        <PhoneCard design={design} lang="bn" />
      </div>
      {phones.length ? (
        <form action={sendDesignAction} className="mt-3 flex flex-wrap items-center gap-2">
          <input type="hidden" name="state" value={design.id} />
          <label className="sr-only" htmlFor={`phone-${design.id}`}>
            Phone
          </label>
          <select id={`phone-${design.id}`} name="phone" className="h-10 rounded-md border border-line-strong bg-white px-3 t-small text-navy">
            {phones.map((p) => (
              <option key={p} value={p}>
                {displayBdPhone(p)}
              </option>
            ))}
          </select>
          <button type="submit" className="admin-btn-secondary">
            Send to this phone
          </button>
        </form>
      ) : null}
    </li>
  );
}

export default async function NotificationDesignsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireSection("accounts");
  const params = await searchParams;
  const devices = await getPushDevices();
  const phones = devices.state === "ok" ? [...new Set(devices.devices.filter((d) => d.active && d.phone).map((d) => d.phone as string))] : [];
  const result = one(params.push);
  const state = one(params.state);
  const live = PUSH_DESIGNS.filter((d) => d.live).length;

  return (
    <>
      <AdminHeader
        title="Notification designs"
        intro={`Every notification a customer can get on their phone, in English and Bangla, with sample details. ${live} of ${PUSH_DESIGNS.length} are sent today; the rest are designed and wait for their Ops event.`}
        actions={
          <Link href="/admin/accounts#notifications" className="admin-btn-secondary">
            Phones with notifications
          </Link>
        }
      />
      {result && PUSH[result] ? (
        <p role="status" className={`mt-6 rounded-md px-4 py-3 t-small font-medium ${result === "sent" ? "border border-success/30 bg-success-soft text-success" : "border border-warning/40 bg-warning-soft text-navy"}`}>
          {state ? `${state}: ` : ""}
          {PUSH[result]}
          {result === "failed" && one(params.status) ? ` (answer: ${one(params.status)})` : ""}
        </p>
      ) : null}
      <div className="mt-6 admin-card p-4 t-small text-body md:p-5">
        <p className="font-semibold text-navy">The rules every notification follows</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>If everything is normal, Velto doesn&apos;t send anything: in care and quality check stay on the website only.</li>
          <li>Line one says what happened; line two says what it means or what happens next. No emoji, no internal codes as the headline.</li>
          <li>A newer update on the same order replaces the older one on the phone, so the phone shows the current state, not a list.</li>
          <li>Nothing private on the lock screen: no address, phone number, garment fault or staff name; a balance is never shown there.</li>
          <li>Only &ldquo;your approval&rdquo;-type notifications have a button, and the button only opens the screen; nothing is decided from the notification.</li>
        </ul>
      </div>
      {GROUPS.map((g) => (
        <section key={g.title} aria-labelledby={`g-${g.title}`} className="mt-10">
          <h2 id={`g-${g.title}`} className="t-h4 text-navy">
            {g.title}
          </h2>
          <p className="mt-1 max-w-[70ch] t-small text-secondary">{g.note}</p>
          <ul className="mt-4 space-y-4">
            {PUSH_DESIGNS.filter((d) => g.lanes.includes(d.lane)).map((d) => (
              <Design key={d.id} design={d} phones={phones} />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
