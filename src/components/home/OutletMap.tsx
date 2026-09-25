"use client";

import { useEffect, useState } from "react";
import { CONSENT_CHANGE_EVENT, readConsent } from "@/lib/analytics/client";

/**
 * Interactive Google map of an outlet's own Business Profile.
 *
 * Google Maps is third-party content that can set Google cookies, so the map
 * is only loaded once the visitor asks for it (Show map) or has allowed
 * Marketing. Until then the block shows a quiet map-style panel with the pin,
 * so the page never loads Google before a choice (see /cookies).
 */
export function OutletMap({
  src,
  title,
  showLabel,
  note,
}: {
  src: string;
  title: string;
  showLabel: string;
  note: string;
}) {
  const [load, setLoad] = useState(false);

  useEffect(() => {
    const sync = () => {
      if (readConsent()?.marketing) setLoad(true);
    };
    sync();
    window.addEventListener(CONSENT_CHANGE_EVENT, sync);
    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, sync);
  }, []);

  return (
    <div className="relative aspect-[3/2] overflow-hidden rounded-md border border-line bg-soft">
      {load ? (
        <iframe
          src={src}
          title={title}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 size-full border-0"
          allowFullScreen
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
          {/* Decorative street grid, so the panel reads as a map before it loads. */}
          <svg aria-hidden="true" className="absolute inset-0 size-full text-line" preserveAspectRatio="xMidYMid slice" viewBox="0 0 300 200">
            <g fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round">
              <path d="M-10 58h320M-10 142h320M72-10v220M214-10v220" />
            </g>
            <g fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M-10 100h320M143-10v220M-10 20l120 70M186 120l124 60" />
            </g>
          </svg>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="relative size-10 text-blue drop-shadow-sm" fill="currentColor">
            <path d="M12 2.5a7 7 0 0 0-7 7c0 5.1 6.1 11.3 6.4 11.6a.85.85 0 0 0 1.2 0C12.9 20.8 19 14.6 19 9.5a7 7 0 0 0-7-7Zm0 9.6a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2Z" />
          </svg>
          <button
            type="button"
            onClick={() => setLoad(true)}
            className="relative inline-flex min-h-11 items-center rounded-md bg-navy px-5 text-[15px] font-semibold text-white hover:bg-blue"
          >
            {showLabel}
          </button>
          <p className="relative max-w-[30ch] t-caption text-secondary">{note}</p>
        </div>
      )}
    </div>
  );
}
