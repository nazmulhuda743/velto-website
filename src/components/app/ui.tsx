import Link from "next/link";
import type { ReactNode } from "react";
import { WHATSAPP_URL } from "@/content/site";

/*
 * The installed app's building blocks (docs/design/velto-app-screens.dc.html, "Components and
 * states"). Presentational and server-safe; they only render inside the app scope, where the
 * colour utilities carry the app's tokens (src/app/app-shell.css).
 */

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

/** Card: white, 1 px border, radius 16. "hero" (navy) is only for an order in progress; "dashed" for empty or explainer. */
export function Card({
  tone = "default",
  className,
  children,
  ...rest
}: {
  tone?: "default" | "hero" | "dashed";
  className?: string;
  children: ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  const tones = {
    default: "border border-line bg-app-card",
    hero: "bg-navy text-white",
    dashed: "border border-dashed border-line-strong",
  } as const;
  return (
    <section className={cx("rounded-2xl p-5", tones[tone], className)} {...rest}>
      {children}
    </section>
  );
}

/** Banners: info (blue tint), success (green), warning (amber, money due), error (red, inline, never a modal). */
export function Banner({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "info" | "success" | "warning" | "error";
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const tones = {
    info: "bg-app-tint text-navy",
    success: "bg-app-green-tint text-app-green",
    warning: "bg-app-amber-tint text-app-amber",
    error: "border border-app-red-line bg-app-red-tint text-app-red",
  } as const;
  return (
    <div role={tone === "error" ? "alert" : undefined} className={cx("rounded-xl px-4 py-3.5 a-sec", tones[tone], className)}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={title ? "mt-1" : undefined}>{children}</div> : null}
    </div>
  );
}

/** Status pills: neutral (Booked), progress (Collected, Cleaning, Ready), done (Delivered), due (money). */
export function Pill({ tone = "neutral", children }: { tone?: "neutral" | "progress" | "done" | "due"; children: ReactNode }) {
  const tones = {
    neutral: "bg-app-off text-body",
    progress: "bg-app-tint text-action",
    done: "bg-app-green-tint text-app-green",
    due: "bg-app-amber-tint text-app-amber",
  } as const;
  return <span className={cx("inline-flex items-center rounded-full px-2.5 py-1 a-meta font-semibold", tones[tone])}>{children}</span>;
}

/** The small capital line above a card title. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("a-eyebrow text-action", className)}>{children}</p>;
}

/** Buttons are 52 px, radius 12. One primary per screen. */
export const buttonClass = (variant: "primary" | "secondary" | "text" | "inverse" = "primary", className?: string) =>
  cx(
    variant === "text"
      ? "inline-flex min-h-11 items-center justify-center px-2 a-body font-semibold text-action"
      : "inline-flex h-13 w-full items-center justify-center gap-2.5 rounded-xl px-5 text-[16px] font-semibold",
    variant === "primary" && "bg-action text-white active:bg-action-active",
    variant === "secondary" && "border-[1.5px] border-line-strong bg-app-card text-navy",
    variant === "inverse" && "border-[1.5px] border-white/40 text-white",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action",
    className,
  );

export function ButtonLink({
  href,
  variant = "primary",
  className,
  children,
  ...rest
}: {
  href: string;
  variant?: "primary" | "secondary" | "text" | "inverse";
  className?: string;
  children: ReactNode;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <Link href={href} className={buttonClass(variant, className)} {...rest}>
      {children}
    </Link>
  );
}

/** "/go/whatsapp" with a prefilled message (order number, amount): the number itself is managed in the dashboard. */
export const whatsappHref = (text?: string) => (text ? `${WHATSAPP_URL}?text=${encodeURIComponent(text)}` : WHATSAPP_URL);

export function WhatsAppIcon({ className = "size-[18px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.4A8.5 8.5 0 1 1 21 12z" />
    </svg>
  );
}

/** A WhatsApp action (secondary weight; the screen's primary stays the booking or order action). */
export function WhatsAppButton({
  text,
  placement,
  variant = "secondary",
  className,
  icon = true,
  children,
}: {
  text?: string;
  placement: string;
  variant?: "secondary" | "inverse" | "text";
  className?: string;
  /** The hero card's buttons are text only. */
  icon?: boolean;
  children: ReactNode;
}) {
  return (
    <a href={whatsappHref(text)} target="_blank" rel="noopener noreferrer" className={buttonClass(variant, className)} data-analytics="whatsapp_click" data-placement={placement}>
      {icon ? <WhatsAppIcon className={cx("size-[18px]", variant !== "inverse" && "text-whatsapp")} /> : null}
      {children}
    </a>
  );
}

/** A labelled value with a "Change" action (Home rebook, Book summary). A button when onClick, a link when href. */
export function SummaryRow({
  label,
  value,
  action,
  href,
  onClick,
  muted,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  action?: ReactNode;
  href?: string;
  onClick?: () => void;
  muted?: boolean;
  className?: string;
}) {
  const body = (
    <>
      <span className="flex min-w-0 flex-col gap-0.5 text-left">
        <span className="a-meta text-muted">{label}</span>
        <span className={cx("a-body", muted ? "text-muted" : "text-body")}>{value}</span>
      </span>
      {action ? <span className="shrink-0 a-sec font-semibold text-action">{action}</span> : null}
    </>
  );
  const rowClass = cx("flex min-h-13 w-full items-center justify-between gap-3 border-b border-line py-3", className);
  if (href) {
    return (
      <Link href={href} className={rowClass}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={rowClass}>
        {body}
      </button>
    );
  }
  return <div className={rowClass}>{body}</div>;
}

/** Navigation row (Profile list): title, subtitle, chevron. */
export function ListRow({ href, title, sub, className }: { href: string; title: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <Link href={href} className={cx("flex min-h-13 items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0", className)}>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="a-row font-semibold text-navy">{title}</span>
        {sub ? <span className="a-cap text-muted">{sub}</span> : null}
      </span>
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="size-5 shrink-0 text-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m9 6 6 6-6 6" />
      </svg>
    </Link>
  );
}
