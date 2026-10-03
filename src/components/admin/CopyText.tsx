"use client";

import { useState } from "react";

/** Copies a text (the invoice link) for pasting into a chat that is already open. */
export function CopyText({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="admin-btn-secondary"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(
          () => {
            setDone(true);
            setTimeout(() => setDone(false), 2000);
          },
          () => {},
        );
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}
