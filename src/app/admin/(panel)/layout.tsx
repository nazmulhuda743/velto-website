import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { Logo } from "@/components/ui/Logo";
import { requireAdmin } from "@/lib/admin/session";
import { logoutAction } from "../actions";

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[250px_1fr]">
      <aside className="bg-navy px-4 py-4 text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:px-5 lg:py-7">
        <div className="flex items-center justify-between gap-4 lg:block">
          <Link href="/admin" aria-label="Dashboard home" className="inline-flex">
            <Logo inverse className="h-8 lg:h-9" />
          </Link>
          <Link href="/" target="_blank" className="t-small text-white/70 underline underline-offset-4 hover:text-white lg:mt-4 lg:block">
            View website ↗
          </Link>
        </div>
        <div className="mt-4 lg:mt-8">
          <AdminNav />
        </div>
        <div className="mt-4 hidden border-t border-white/15 pt-4 lg:mt-auto lg:block">
          <p className="t-small font-semibold">{admin.name}</p>
          <p className="t-caption text-white/60">{admin.email}</p>
          <form action={logoutAction} className="mt-3">
            <button type="submit" className="t-small text-white/80 underline underline-offset-4 hover:text-white">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 md:px-8 md:py-10 xl:px-12">
        <div className="mx-auto max-w-[1100px]">{children}</div>
        <form action={logoutAction} className="mt-10 lg:hidden">
          <button type="submit" className="t-small text-secondary underline underline-offset-4">
            Sign out ({admin.name})
          </button>
        </form>
      </main>
    </div>
  );
}
