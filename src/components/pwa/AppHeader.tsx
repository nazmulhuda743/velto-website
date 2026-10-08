import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui/Logo";

/**
 * The top of an app screen, on the page ground (no bar): the Velto logo, which goes Home, and the
 * screen's own actions on the right (Home: Prices and WhatsApp; Book: Prices, components/app/prices). A detail screen
 * passes `back` (e.g. "← Orders") and `aside` (the order number) instead of the logo.
 */
export function AppHeader({ actions, back, aside }: { actions?: ReactNode; back?: { href: string; label: string }; aside?: ReactNode }) {
  return (
    <header className="pt-[env(safe-area-inset-top)]" data-app-header>
      <div className="mx-auto flex min-h-[60px] max-w-[720px] items-center justify-between gap-3 px-5 pb-2 pt-4">
        {back ? (
          <Link href={back.href} className="-ml-1 inline-flex min-h-11 items-center px-1 a-body font-semibold text-action">
            <span aria-hidden="true">←&nbsp;</span>
            {back.label}
          </Link>
        ) : (
          <Link href="/app/home" aria-label="Velto" className="inline-flex min-h-11 items-center">
            <Logo className="h-[22px] w-auto" />
          </Link>
        )}
        {actions ? <div className="flex items-center gap-2">{actions}</div> : aside ? <span className="a-cap text-muted">{aside}</span> : null}
      </div>
    </header>
  );
}

const pill = "inline-flex min-h-11 items-center justify-center";

/** Header WhatsApp button (icon only, labelled). */
export function HeaderWhatsApp({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className={`${pill} min-w-11`} data-analytics="whatsapp_click" data-placement="app_header">
      <span className="flex size-[34px] items-center justify-center rounded-full border border-app-chip bg-app-card">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[18px]" fill="none" stroke="#25D366" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.4A8.5 8.5 0 1 1 21 12z" />
        </svg>
      </span>
    </a>
  );
}
