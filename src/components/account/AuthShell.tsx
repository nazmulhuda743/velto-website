import Link from "next/link";
import type { ReactNode } from "react";

export const authInput = "mt-2 h-[52px] w-full rounded-md border border-line-strong bg-white px-4 text-base text-navy outline-none transition focus:border-blue focus:ring-2 focus:ring-blue/15";
export const authButton = "inline-flex h-[52px] w-full items-center justify-center rounded-md bg-action px-6 font-semibold text-white transition hover:bg-action-hover disabled:opacity-60";

export function AuthShell({ eyebrow, title, intro, children, footer }: { eyebrow: string; title: string; intro: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section className="bg-soft py-12 md:py-18" aria-labelledby="auth-title">
      <div className="container-page">
        <div className="mx-auto max-w-[520px] rounded-lg border border-line bg-white p-6 shadow-[0_18px_60px_rgba(13,34,56,0.06)] md:p-9">
          <p className="t-label uppercase text-blue">{eyebrow}</p>
          <h1 id="auth-title" className="mt-3 t-h2 text-navy">{title}</h1>
          <p className="mt-3 t-body text-body">{intro}</p>
          <div className="mt-7">{children}</div>
          {footer ? <div className="mt-7 border-t border-line pt-5 t-small text-body">{footer}</div> : null}
        </div>
      </div>
    </section>
  );
}

export function AuthNotice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "error" | "success" }) {
  const klass = tone === "error" ? "border-error/30 bg-red-50 text-navy" : tone === "success" ? "border-line bg-soft text-navy" : "border-blue/20 bg-[#f2f8fc] text-navy";
  return <div role={tone === "error" ? "alert" : "status"} className={`mb-5 rounded-md border p-4 t-small ${klass}`}>{children}</div>;
}

export function AuthFooterLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="font-semibold text-navy underline decoration-blue/50 underline-offset-4 hover:decoration-blue">{children}</Link>;
}
