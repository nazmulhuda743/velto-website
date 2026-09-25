import { ORDER_STAGES, stageIndex } from "@/content/order-status";

/** Five-step progress for one order: vertical on phones, a row from tablet up. */
export function OrderProgress({ status, compact = false }: { status: string; compact?: boolean }) {
  const current = stageIndex(status);
  return (
    <ol className={`grid gap-0 ${compact ? "grid-cols-5 gap-1.5" : "md:grid-cols-5 md:gap-3"}`} aria-label="Order progress">
      {ORDER_STAGES.map((stage, i) => {
        const done = i <= current;
        if (compact) {
          return (
            <li key={stage.status} aria-current={i === current ? "step" : undefined}>
              <span aria-hidden="true" className={`block h-1.5 rounded-full ${done ? "bg-blue" : "bg-line"}`} />
              <span className={`mt-2 block text-[12px] leading-tight md:text-[13px] ${i === current ? "font-semibold text-navy" : "text-secondary"}`}>
                {stage.title}
                <span className="sr-only">{done ? " (done)" : " (not yet)"}</span>
              </span>
            </li>
          );
        }
        return (
          <li key={stage.status} aria-current={i === current ? "step" : undefined} className="relative flex gap-3 pb-5 last:pb-0 md:block md:pb-0">
            <span
              aria-hidden="true"
              className={`relative z-10 mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-[12px] font-semibold ${
                done ? "border-blue bg-blue text-white" : "border-line-strong bg-white text-secondary"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            {i < ORDER_STAGES.length - 1 ? (
              <span
                aria-hidden="true"
                className={`absolute left-[11px] top-7 h-[calc(100%-1.5rem)] w-0.5 md:left-7 md:top-3 md:h-0.5 md:w-[calc(100%-1rem)] ${i < current ? "bg-blue" : "bg-line"}`}
              />
            ) : null}
            <span className="md:mt-3 md:block">
              <span className={`block font-semibold ${done ? "text-navy" : "text-secondary"}`}>
                {stage.title}
                <span className="sr-only">{done ? " (done)" : " (not yet)"}</span>
              </span>
              <span className="block t-small text-secondary">{stage.copy}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
