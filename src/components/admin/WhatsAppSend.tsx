"use client";

import { useTransition } from "react";
import { logWhatsAppAction } from "@/app/admin/request-actions";

/**
 * "Send on WhatsApp: বাংলা · English". Opens WhatsApp with the message written out (staff can
 * still edit it there) and records on the request's timeline that it was opened.
 */
export function WhatsAppSend({
  job,
  kind,
  label,
  links,
}: {
  job: string;
  kind: "confirm" | "picked" | "ready";
  label: string;
  links: { bn: string; en: string };
}) {
  const [, start] = useTransition();
  const log = (lang: "bn" | "en") => start(() => logWhatsAppAction(job, kind, lang));
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-2 t-small">
      <span className="font-semibold text-navy">{label}</span>
      <a href={links.bn} target="_blank" rel="noopener noreferrer" onClick={() => log("bn")} className="admin-btn-secondary !h-9 !px-3">
        <span lang="bn">বাংলা</span>
      </a>
      <a href={links.en} target="_blank" rel="noopener noreferrer" onClick={() => log("en")} className="admin-btn-secondary !h-9 !px-3">
        English
      </a>
    </p>
  );
}
