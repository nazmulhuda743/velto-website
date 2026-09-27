import { accountText, orderFormat } from "@/content/i18n/account";
import { formText } from "@/content/i18n/forms";
import { WHATSAPP_URL } from "@/content/site";
import { fill, format, type Locale } from "@/lib/i18n/config";
import type { PortalPickup } from "@/lib/customer/portal";
import { PickupControls } from "./PickupControls";

const dhakaDay = (offset: number) => {
  const d = new Date(Date.now() + 6 * 3_600_000 + offset * 86_400_000);
  return d.toISOString().slice(0, 10);
};

/**
 * The customer's open website pickups, newest first, with change and cancel. Shown only for a
 * proven phone (linked history or SMS sign-in); the database decides what may still change.
 */
export function UpcomingPickups({ pickups, locale }: { pickups: PortalPickup[]; locale: Locale }) {
  const a = accountText(locale);
  const t = a.pickups;
  const f = formText(locale).booking;
  const { day, time } = orderFormat(locale);
  const slotLabel = (s: string) => f.slots[s] ?? s;
  const days = Array.from({ length: 15 }, (_, i) => {
    const value = dhakaDay(i);
    const name = day(value) ?? value;
    return { value, label: i === 0 ? `${t.today}, ${name}` : i === 1 ? `${t.tomorrow}, ${name}` : name };
  });
  const slots = ["morning", "afternoon", "evening"].map((value) => ({ value, label: slotLabel(value) }));

  return (
    <section aria-labelledby="pickups-title" className="rounded-lg border border-line bg-white p-5 shadow-[0_12px_32px_-26px_rgba(0,43,78,0.45)] md:p-7" data-upcoming-pickups>
      <h2 id="pickups-title" className="text-[22px] font-semibold tracking-[-0.01em] text-navy">
        {pickups.length > 1 ? t.titleMany : t.title}
      </h2>
      <ul className="mt-4 divide-y divide-line">
        {pickups.map((p) => (
          <li key={p.id} className="py-4 first:pt-0 last:pb-0" data-pickup={p.stage}>
            {p.plannedDate && p.plannedSlot ? (
              <p className="text-[18px] font-semibold text-navy">{format(t.planned, { day: day(p.plannedDate) ?? p.plannedDate, slot: slotLabel(p.plannedSlot) })}</p>
            ) : (
              <>
                <p className="text-[18px] font-semibold text-navy">{format(t.requested, { when: p.requested ?? "" })}</p>
                <p className="mt-0.5 t-small text-secondary">{t.waiting}</p>
              </>
            )}
            <p className="mt-1 t-caption text-secondary">{format(t.reference, { ref: p.reference })}</p>
            {p.changeable ? (
              <>
                {p.cutoffAt ? <p className="mt-2 t-small text-secondary">{format(t.until, { time: `${day(p.cutoffAt)}, ${time(p.cutoffAt)}` })}</p> : null}
                {p.changesLeft > 0 ? (
                  <>
                    <p className="mt-1 t-caption text-secondary">{p.changesLeft === 1 ? t.changesLeftOne : fill(t.changesLeft, { n: p.changesLeft }, locale)}</p>
                    <PickupControls id={p.id} t={t} days={days} slots={slots} defaultSlot={p.plannedSlot ?? "morning"} />
                  </>
                ) : (
                  <p className="mt-3 t-small text-body">
                    {a.actions.pickupTooMany}{" "}
                    <a href={`${WHATSAPP_URL}?text=${encodeURIComponent(p.reference)}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-navy underline underline-offset-4">
                      WhatsApp
                    </a>
                  </p>
                )}
              </>
            ) : (
              <p className="mt-3 t-small text-body">
                {t.locked}{" "}
                <a href={`${WHATSAPP_URL}?text=${encodeURIComponent(p.reference)}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-navy underline underline-offset-4">
                  WhatsApp
                </a>
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
