import type { ReactNode } from "react";

export type TrackerItem = {
  key: string;
  title: ReactNode;
  /** What happened, or (upcoming) what will happen. */
  line?: ReactNode;
  /** Shown only when Ops recorded a time; never invented. */
  time?: ReactNode;
  state: "done" | "current" | "upcoming";
  /** Under the step (the Ready step's delivery pill). */
  extra?: ReactNode;
};

/**
 * The five-step order tracker. Done: filled dot with a check, blue line, timestamp. Current:
 * filled dot, no check, grey line below. Upcoming: hollow dot, muted text, no time.
 */
export function Tracker({ steps, label }: { steps: TrackerItem[]; label: string }) {
  return (
    <ol aria-label={label} className="flex flex-col">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        const reached = s.state !== "upcoming";
        return (
          <li key={s.key} className="grid grid-cols-[28px_1fr_auto] gap-x-3" aria-current={s.state === "current" ? "step" : undefined}>
            <span className="flex flex-col items-center" aria-hidden="true">
              <span className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${reached ? "border-action bg-action" : "border-app-chip bg-app-card"}`}>
                {s.state === "done" ? (
                  <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                ) : null}
              </span>
              {last ? null : <span className={`my-0.5 w-0.5 flex-1 ${s.state === "done" ? "bg-action" : "bg-line"}`} />}
            </span>
            <div className={last ? "" : "pb-4"}>
              <p className={`a-body font-semibold ${reached ? "text-navy" : "text-app-off-text"}`}>{s.title}</p>
              {s.line ? <p className={`a-cap ${reached ? "text-secondary" : "text-app-off-text"}`}>{s.line}</p> : null}
              {s.extra ? <div className="mt-2">{s.extra}</div> : null}
            </div>
            <span className="a-meta pt-0.5 text-app-off-text">{s.time ?? null}</span>
          </li>
        );
      })}
    </ol>
  );
}
