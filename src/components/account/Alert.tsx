import type { ReactNode } from "react";

const TONES = {
  info: "border-line bg-soft text-body",
  success: "border-success/30 bg-success-soft text-success",
  error: "border-error/30 bg-error-soft text-error",
} as const;

export function Alert({ tone = "info", title, children, id }: { tone?: keyof typeof TONES; title?: string; children?: ReactNode; id?: string }) {
  return (
    <div id={id} role={tone === "error" ? "alert" : "status"} className={`rounded-md border px-4 py-3.5 t-small ${TONES[tone]}`}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={title ? "mt-1 text-body" : "font-medium"}>{children}</div> : null}
    </div>
  );
}
