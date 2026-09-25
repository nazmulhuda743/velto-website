"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function SubmitButton({ children, pending: pendingLabel, className = "", variant = "primary" }: { children: ReactNode; pending: string; className?: string; variant?: "primary" | "secondary" }) {
  const { pending } = useFormStatus();
  const look =
    variant === "primary"
      ? "bg-action text-white hover:bg-action-hover disabled:bg-action/70"
      : "border border-line-strong bg-white text-navy hover:border-navy";
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={`inline-flex h-[52px] w-full items-center justify-center gap-2.5 rounded-md px-6 text-base font-semibold transition-colors lg:h-12 ${look} ${className}`}
    >
      {pending ? (
        <>
          <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
