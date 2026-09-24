import type { ReactNode } from "react";

/** H2 + supporting copy with the spec §14 heading→intro rhythm. */
export function SectionIntro({
  id,
  title,
  children,
  inverse = false,
  className = "",
  titleClassName = "max-w-[22ch]",
}: {
  id: string;
  title: ReactNode;
  children?: ReactNode;
  inverse?: boolean;
  className?: string;
  titleClassName?: string;
}) {
  return (
    <div className={className}>
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
