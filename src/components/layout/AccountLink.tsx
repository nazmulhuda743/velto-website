"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ArrowRight } from "@/components/ui/icons";

const HINT = "velto_account=1";
const subscribe = () => () => {};
const signedInSnapshot = () => document.cookie.split("; ").includes(HINT);

function PersonIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <circle cx="10" cy="7" r="3.25" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.75 16.5c.9-2.9 3.3-4.5 6.25-4.5s5.35 1.6 6.25 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** The round account mark: soft blue when signed out, navy when signed in. */
function Avatar({ signedIn, size = "size-7" }: { signedIn: boolean; size?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex ${size} shrink-0 items-center justify-center rounded-full transition-colors ${
        signedIn ? "bg-navy text-white" : "bg-[#e6f1f9] text-action group-hover:bg-action group-hover:text-white"
      }`}
    >
      <PersonIcon />
      {signedIn ? <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-white bg-success" /> : null}
    </span>
  );
}

/**
 * "Sign in" / "My Account". Reads a non-sensitive hint cookie so public pages stay static;
 * the account pages themselves always verify the session on the server.
 *
 * Variants: `header` (desktop control), `icon` (mobile header), `menu` (featured card in the
 * mobile menu), or a plain link with `className`.
 */
export function AccountLink({
  className = "",
  onClick,
  variant,
}: {
  className?: string;
  onClick?: () => void;
  variant?: "header" | "icon" | "menu";
}) {
  const signedIn = useSyncExternalStore(subscribe, signedInSnapshot, () => false);
  const href = signedIn ? "/account" : "/login";
  const label = signedIn ? "My Account" : "Sign in";
  const common = { href, onClick, "data-account-link": signedIn ? "account" : "signin" };

  if (variant === "header") {
    return (
      <Link
        {...common}
        className={`group inline-flex h-10 items-center gap-2 rounded-md border border-line-strong bg-white pl-1.5 pr-3.5 text-[15px] font-semibold text-navy transition-colors hover:border-navy ${className}`}
      >
        <Avatar signedIn={signedIn} />
        {label}
      </Link>
    );
  }

  if (variant === "icon") {
    return (
      <Link {...common} aria-label={label} className={`group inline-flex size-11 items-center justify-center rounded-md ${className}`}>
        <Avatar signedIn={signedIn} size="size-8" />
      </Link>
    );
  }

  if (variant === "menu") {
    return (
      <Link
        {...common}
        className={`group flex items-center gap-4 rounded-md border border-line bg-soft p-4 transition-colors hover:border-navy ${className}`}
      >
        <Avatar signedIn={signedIn} size="size-10" />
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-semibold tracking-[-0.01em] text-navy">{label}</span>
          <span className="block t-small text-secondary">
            {signedIn ? "Your orders, their status and your details" : "See your orders and where each one is"}
          </span>
        </span>
        <ArrowRight className="size-4 shrink-0 text-action" />
      </Link>
    );
  }

  return (
    <Link {...common} className={className}>
      {label}
    </Link>
  );
}
