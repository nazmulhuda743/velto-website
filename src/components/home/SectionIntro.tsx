import type { ReactNode } from "react";

/**
 * Small section label above an H2. Uses the action blue (#0078BC, AA at 13px);
 * cyan on navy. One per section, never a second highlight.
 */
export function Eyebrow({ children, inverse = false }: { children: ReactNode; inverse?: boolean }) {
  return <p className={`mb-3 t-label uppercase md:mb-4 ${inverse ? "text-cyan" : "text-action"}`}>{children}</p>;
}

/** Optional eyebrow + H2 + supporting copy with the spec §14 heading→intro rhythm. */
export function SectionIntro({
  id,
  eyebrow,
  title,
  children,
  inverse = false,
  className = "",
  titleClassName = "max-w-[22ch]",
}: {
  id: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  inverse?: boolean;
  className?: string;
  titleClassName?: string;
}) {
  return (
    <div className={className}>
      {eyebrow ? <Eyebrow inverse={inverse}>{eyebrow}</Eyebrow> : null}
      <h2 id={id} className={`t-h2 ${inverse ? "text-white" : "text-navy"} ${titleClassName}`}>
        {title}
      </h2>
      {children ? (
        <div
          className={`mt-(--space-heading-intro) max-w-[560px] space-y-4 t-body-lg ${
            inverse ? "text-white/80" : "text-body"
          }`}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
