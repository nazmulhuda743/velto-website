"use client";

import { useSearchParams } from "next/navigation";

/** Shown after requireSection() sends someone to their home page (?denied=section). */
export function DeniedNotice() {
  const denied = useSearchParams().get("denied");
  // Landing on /admin without Overview is normal for some roles; only a real detour needs a note.
  if (!denied || denied === "overview" || !/^[a-z]{1,30}$/.test(denied)) return null;
  return (
    <p role="alert" className="mb-6 rounded-md border border-[#e6c48a] bg-[#fff4e5] px-4 py-3 t-small font-medium text-[#8a5300]">
      Your role doesn&apos;t include the {denied} page, so you were brought here instead. Ask an Owner if you need it.
    </p>
  );
}
