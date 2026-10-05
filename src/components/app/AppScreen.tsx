import type { ReactNode } from "react";
import { AppHeader } from "@/components/pwa/AppHeader";

/**
 * One app screen: its header (logo by default; Home and Book add their actions, detail screens a
 * back link) and the content column, 20 px gutters, on the page ground.
 */
export function AppScreen({ header, children }: { header?: ReactNode; children: ReactNode }) {
  return (
    <>
      {header ?? <AppHeader />}
      <main id="main" className="mx-auto w-full max-w-[720px] px-5 pb-8 pt-4">
        {children}
      </main>
    </>
  );
}
