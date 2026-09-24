import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { Logo } from "@/components/ui/Logo";
import { getAdmin } from "@/lib/admin/session";

export default async function AdminLoginPage() {
  if (await getAdmin()) redirect("/admin");
  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="w-full max-w-[420px] rounded-lg border border-line bg-white p-7 md:p-9">
        <Logo className="h-10" />
        <h1 className="mt-8 t-h3 text-navy">Website dashboard</h1>
        <p className="mt-2 t-small text-secondary">Sign in with your Velto Ops admin account.</p>
        <LoginForm />
      </div>
    </main>
  );
}
