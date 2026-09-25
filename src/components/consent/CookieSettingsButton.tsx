"use client";

import type { ReactNode } from "react";
import { openConsentPreferences } from "@/lib/analytics/client";

/** Reopens the cookie preferences panel (footer, /cookies). */
export function CookieSettingsButton({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <button type="button" onClick={openConsentPreferences} className={className}>
      {children}
    </button>
  );
}
