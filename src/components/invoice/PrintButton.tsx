"use client";

/** "Save as PDF / print": the browser's own print dialog (Save as PDF on phones and computers). */
export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-12 items-center justify-center rounded-md border border-line-strong px-5 font-semibold text-navy hover:border-navy"
    >
      {label}
    </button>
  );
}
