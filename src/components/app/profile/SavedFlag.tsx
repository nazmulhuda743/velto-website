"use client";

import { useEffect, useState } from "react";

const EVENT = "velto:app-saved";

/** Tell the screen's header that a change was saved. */
export const announceSaved = () => window.dispatchEvent(new Event(EVENT));

/** "Saved" in the header of a Profile sub-screen, once something on it was saved (no save buttons). */
export function SavedFlag({ label }: { label: string }) {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const on = () => setSaved(true);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return (
    <span role="status" className={`a-cap font-semibold text-app-green ${saved ? "" : "invisible"}`}>
      {label}
    </span>
  );
}
