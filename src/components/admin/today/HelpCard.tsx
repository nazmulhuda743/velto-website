"use client";

import { useState } from "react";
import { TODAY_HELP_COOKIE } from "@/content/i18n/admin-today";
import { Icon } from "./icons";

/** "How Today works": shown until this person closes it (a cookie keeps it closed). */
export function HelpCard({ title, body, gotIt }: { title: string; body: string; gotIt: string }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  const close = () => {
    document.cookie = `${TODAY_HELP_COOKIE}=closed; path=/admin; max-age=31536000; samesite=lax`;
    setOpen(false);
  };
  return (
    <section aria-label={title} className="mb-4 flex gap-3 rounded-[12px] border border-line bg-soft p-4">
      <span className="mt-0.5 text-action">
        <Icon name="info" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-semibold text-navy">{title}</h2>
        <p className="mt-1 t-small text-body">{body}</p>
        <button type="button" onClick={close} className="-ml-2 mt-1 min-h-11 rounded-md px-2 t-small font-semibold text-action underline underline-offset-4 hover:text-action-hover">
          {gotIt}
        </button>
      </div>
    </section>
  );
}
