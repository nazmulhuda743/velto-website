/**
 * Simple line icons for the Today page (24px grid, drawn with the current text colour). Inline
 * SVG, no icon library; always decorative (the text next to them says what they mean).
 */
const PATHS = {
  phone: (
    <path d="M21.5 16.4v2.9a1.9 1.9 0 0 1-2.1 1.9 18.9 18.9 0 0 1-8.2-2.9 18.6 18.6 0 0 1-5.7-5.7A18.9 18.9 0 0 1 2.6 4.3 1.9 1.9 0 0 1 4.5 2.2h2.9a1.9 1.9 0 0 1 1.9 1.6c.1.9.4 1.8.7 2.6a1.9 1.9 0 0 1-.4 2l-1.2 1.2a15.2 15.2 0 0 0 5.7 5.7l1.2-1.2a1.9 1.9 0 0 1 2-.4c.8.3 1.7.6 2.6.7a1.9 1.9 0 0 1 1.6 1.9Z" />
  ),
  chat: <path d="M20.5 11.6a8.2 8.2 0 0 1-11.9 7.3L3.5 20.5l1.7-4.9a8.2 8.2 0 1 1 15.3-4Z" />,
  check: <path d="M20 6 9 17l-5-5" />,
  bike: (
    <>
      <circle cx="5.5" cy="17" r="3.3" />
      <circle cx="18.5" cy="17" r="3.3" />
      <path d="M15 6h3l2 6M5.5 17 9 9h5l4.5 8M9 9 7.5 6H5" />
    </>
  ),
  bag: (
    <>
      <path d="M6 7.5h12l1 12.5H5L6 7.5Z" />
      <path d="M9 7.5a3 3 0 0 1 6 0" />
    </>
  ),
  route: (
    <>
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="5" r="2" />
      <path d="M8 19h8.5a3.5 3.5 0 0 0 0-7h-9a3.5 3.5 0 0 1 0-7H16" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.8v4.6M12 16.2h.01" />
    </>
  ),
  chevron: <path d="m9 6 6 6-6 6" />,
  down: <path d="m6 9 6 6 6-6" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 5 5" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3.5v3M16 3.5v3M4 10h16" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  refresh: <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4" />,
  repeat: <path d="M17 3.5 20 6.5l-3 3M4 11.5v-1a4 4 0 0 1 4-4h12M7 20.5l-3-3 3-3M20 12.5v1a4 4 0 0 1-4 4H4" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.8h.01" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "size-[18px]" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {PATHS[name]}
    </svg>
  );
}
