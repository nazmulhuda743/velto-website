import Link from "@/components/i18n/Link";
import type { ComponentProps, ReactNode } from "react";
import { T } from "@/components/i18n/T";
import { WhatsAppIcon } from "./icons";

type Variant = "primary" | "secondary" | "secondary-inverse";

const base =
  "inline-flex items-center justify-center gap-2.5 rounded-md px-6 text-base font-semibold leading-none tracking-[-0.005em] whitespace-nowrap transition-colors duration-150 h-[52px] lg:h-12";

const variants: Record<Variant, string> = {
  primary: "bg-action text-white hover:bg-action-hover active:bg-action-active",
  secondary:
    "border border-line-strong bg-white text-navy hover:border-navy active:bg-soft",
  "secondary-inverse":
    "border border-white/45 text-white hover:border-white hover:bg-white/[0.06]",
};

type ButtonLinkProps = Omit<ComponentProps<typeof Link>, "className"> & {
  variant?: Variant;
  className?: string;
  children: ReactNode;
  /** Analytics event name (spec §23). */
  event?: string;
  placement?: string;
};

export function ButtonLink({
  variant = "primary",
  className = "",
  event,
  placement,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={`${base} ${variants[variant]} ${className}`}
      data-analytics={event}
      data-placement={placement}
      {...props}
    >
      {children}
    </Link>
  );
}

/** WhatsApp action — secondary weight, official green only on the glyph. */
export function WhatsAppButton({
  href,
  placement,
  inverse = false,
  className = "",
  children = <T k="common.whatsappVelto" />,
}: {
  href: string;
  placement: string;
  inverse?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${base} ${variants[inverse ? "secondary-inverse" : "secondary"]} ${className}`}
      data-analytics="whatsapp_click"
      data-placement={placement}
    >
      <WhatsAppIcon className={`size-5 ${inverse ? "text-white" : "text-whatsapp"}`} />
      {children}
    </a>
  );
}
