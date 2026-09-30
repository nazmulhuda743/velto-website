"use client";

import { useSearchParams } from "next/navigation";
import { sectionLabel } from "@/lib/admin/nav";

/** Shown after requireSection() sends someone to their home page (?denied=section). */
export function DeniedNotice() {
  const denied = useSearchParams().get("denied");
  // Landing on /admin without Overview is normal for some roles; only a real detour needs a note.
  if (!denied || denied === "overview" || !/^[a-z]{1,30}$/.test(denied)) return null;
  return (
    <p role="alert" className="mb-6 rounded-md border border-warning/30 bg-warning-soft px-4 py-3 t-small font-medium text-warning">
      Your role doesn&apos;t include the {sectionLabel(denied) ?? denied} page, so you were brought here instead. Ask an Owner if you need it.
    </p>
  );
}
