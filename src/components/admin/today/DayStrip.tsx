import type { TodayText } from "@/content/i18n/admin-today";
import type { SlotId } from "@/lib/admin/dispatch-logic";

/**
 * The day in three bars (Morning · Afternoon · Evening): stops planned against the room of every
 * rider who is working. The window it is now is outlined and tagged "now"; windows already over
 * are paler. The page's one bold element.
 */
export function DayStrip({ strip, now, past, t }: { strip: { slot: SlotId; planned: number; capacity: number }[]; now: SlotId | null; past: SlotId[]; t: TodayText }) {
  return (
    <ol className="mt-4 grid grid-cols-3 gap-2" aria-label={t.timeWindow}>
      {strip.map((w) => {
        const pct = w.capacity ? Math.min(100, Math.round((w.planned / w.capacity) * 100)) : 0;
        const isNow = w.slot === now;
        return (
          <li key={w.slot} className="relative min-w-0" aria-current={isNow ? "time" : undefined}>
            {isNow ? <span className="absolute -top-2.5 left-2 z-10 rounded-[4px] bg-white px-1.5 text-[11px] font-semibold leading-[18px] text-navy">{t.now}</span> : null}
            <div className={`relative h-[34px] overflow-hidden rounded-[8px] bg-white/10 ${isNow ? "outline-2 outline-offset-2 outline-white" : ""}`}>
              <div className={`absolute inset-y-0 left-0 ${past.includes(w.slot) ? "bg-cyan/55" : "bg-cyan"}`} style={{ width: `${pct}%` }} />
              <span className="absolute inset-0 flex items-center justify-center text-[15px] font-semibold tabular-nums text-white [text-shadow:0_1px_2px_color-mix(in_srgb,var(--velto-navy)_45%,transparent)]">
                {t.num(w.planned)}/{t.num(w.capacity)}
              </span>
            </div>
            <p className="mt-1.5 leading-tight">
              <span className="block text-[13px] font-semibold text-white">{t.windowName[w.slot]}</span>
              <span className="block text-[12px] text-white/70">{t.windowHours[w.slot]}</span>
            </p>
          </li>
        );
      })}
    </ol>
  );
}
