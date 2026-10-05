import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

/** The installed app's header: the Velto logo, which goes Home. Nothing else (no website menu). */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur" data-app-header>
      <div className="mx-auto flex h-14 max-w-[720px] items-center px-4">
        <Link href="/app/home" aria-label="Velto" className="inline-flex items-center">
          <Logo className="h-7" />
        </Link>
      </div>
    </header>
  );
}
