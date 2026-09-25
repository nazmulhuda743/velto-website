"use client";

import { useState } from "react";
import { FieldShell } from "@/components/forms/fields";

/** Password input with a visible show/hide control (no floating labels, spec §17). */
export function PasswordField({
  id,
  label,
  error,
  helper,
  autoComplete,
  labels = { show: "Show", hide: "Hide", srPassword: " password" },
}: {
  id: string;
  label: string;
  error?: string;
  helper?: string;
  autoComplete: "current-password" | "new-password";
  /** The show/hide control's text, in the page language. */
  labels?: { show: string; hide: string; srPassword: string };
}) {
  const [visible, setVisible] = useState(false);
  const described = [helper ? `${id}-help` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <FieldShell id={id} label={label} helper={helper} error={error}>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          maxLength={200}
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
          className="h-[54px] w-full rounded-md border border-line-strong bg-white px-4 pr-20 text-base text-navy hover:border-navy/50 focus:border-blue focus:outline-1 focus:outline-offset-0 focus:outline-blue aria-[invalid=true]:border-error md:h-[52px]"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          className="absolute right-1.5 top-1/2 h-10 -translate-y-1/2 rounded-sm px-3 t-small font-semibold text-navy underline decoration-blue/50 underline-offset-4 hover:decoration-blue"
        >
          {visible ? labels.hide : labels.show}
          <span className="sr-only">{labels.srPassword}</span>
        </button>
      </div>
    </FieldShell>
  );
}
