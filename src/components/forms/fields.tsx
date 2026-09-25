import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

/**
 * Form primitives — spec §17: visible labels (no floating labels), ~52/54px
 * inputs, 120px min textarea, clear focus, and errors in text, not colour only.
 */
const control =
  "w-full rounded-md border bg-white px-4 text-base text-navy placeholder:text-secondary/80 hover:border-navy/50 focus:border-blue focus:outline-1 focus:outline-offset-0 focus:outline-blue aria-[invalid=true]:border-error";

type FieldShellProps = {
  id: string;
  label: string;
  optional?: boolean;
  /** Text after an optional field's label, in the page language. */
  optionalText?: string;
  helper?: ReactNode;
  error?: string;
  children: ReactNode;
};

export function FieldShell({ id, label, optional, optionalText = ", optional", helper, error, children }: FieldShellProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-[15px] font-semibold text-navy">
        {label}
        {optional ? <span className="font-normal text-secondary">{optionalText}</span> : null}
      </label>
      {helper ? (
        <p id={`${id}-help`} className="mt-1 t-small text-secondary">
          {helper}
        </p>
      ) : null}
      <div className="mt-2">{children}</div>
      {error ? (
        <p id={`${id}-error`} className="mt-2 flex items-start gap-2 t-small font-medium text-error">
          <span aria-hidden="true">!</span>
          {error}
        </p>
      ) : null}
    </div>
  );
}

const describedBy = (id: string, helper?: ReactNode, error?: string) =>
  [helper ? `${id}-help` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;

type Common = { id: string; label: string; optional?: boolean; optionalText?: string; helper?: ReactNode; error?: string };

export function TextField({ id, label, optional, optionalText, helper, error, ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldShell id={id} label={label} optional={optional} optionalText={optionalText} helper={helper} error={error}>
      <input
        id={id}
        name={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, helper, error)}
        className={`${control} h-[54px] border-line-strong md:h-[52px]`}
        {...rest}
      />
    </FieldShell>
  );
}

export function SelectField({
  id,
  label,
  optional,
  optionalText,
  helper,
  error,
  children,
  ...rest
}: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FieldShell id={id} label={label} optional={optional} optionalText={optionalText} helper={helper} error={error}>
      <div className="relative">
        <select
          id={id}
          name={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, helper, error)}
          className={`${control} h-[54px] appearance-none border-line-strong pr-11 md:h-[52px]`}
          {...rest}
        >
          {children}
        </select>
        <svg viewBox="0 0 16 16" aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-navy">
          <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </FieldShell>
  );
}

export function TextAreaField({ id, label, optional, optionalText, helper, error, ...rest }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldShell id={id} label={label} optional={optional} optionalText={optionalText} helper={helper} error={error}>
      <textarea
        id={id}
        name={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, helper, error)}
        className={`${control} min-h-[120px] border-line-strong py-3 leading-[1.4]`}
        {...rest}
      />
    </FieldShell>
  );
}

/** Uttara Sectors 1–18 plus an explicit outside-area option (spec §4). */
export const AREA_OPTIONS = [
  ...Array.from({ length: 18 }, (_, i) => `Uttara Sector ${i + 1}`),
  "Outside Uttara Sectors 1–18",
];

export const OUTSIDE_AREA = "Outside Uttara Sectors 1–18";

/** Bangladeshi mobile numbers, with or without +880, spaces or dashes. Shared by the booking and quote forms. */
export const normalisePhone = (v: string) => v.replace(/[\s-]/g, "");
export const phoneOk = (v: string) => /^(\+?880|0)1\d{9}$/.test(normalisePhone(v));
