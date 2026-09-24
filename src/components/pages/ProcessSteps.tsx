export type Step = { title: string; copy: string };

/** Static numbered stage rows — the homepage process row style without the scroll story. */
export function ProcessSteps({ steps, className = "" }: { steps: Step[]; className?: string }) {
  return (
    <ol className={`list-none border-b border-line ${className}`}>
      {steps.map((step, i) => (
        <li key={step.title} className="grid grid-cols-[2.75rem_1fr] gap-x-3 border-t border-line py-4 md:py-5">
          <span className="t-label pt-[3px] text-blue">{String(i + 1).padStart(2, "0")}</span>
          <div>
            <h3 className="text-[17px] font-semibold leading-snug text-navy md:t-h4">{step.title}</h3>
            <p className="mt-1 max-w-[52ch] t-small text-secondary md:t-body">{step.copy}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
