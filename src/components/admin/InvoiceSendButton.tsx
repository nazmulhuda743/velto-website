"use client";

import { useRouter } from "next/navigation";

/** Opens WhatsApp with the message, and records that it was sent (Admin → Invoices on WhatsApp). */
export function InvoiceSendButton({ href, code, label }: { href: string; code: string; label: string }) {
  const router = useRouter();
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="admin-btn"
      onClick={() => {
        fetch("/admin/invoices/sent", { method: "POST", body: code, keepalive: true })
          .then(() => router.refresh())
          .catch(() => {});
      }}
    >
      {label}
    </a>
  );
}
