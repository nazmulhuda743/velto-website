import Link from "next/link";

/** Unknown /admin URL (admin has its own root layout, so it needs its own 404). */
export default function AdminNotFound() {
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <p className="t-label uppercase text-blue">404</p>
      <h1 className="mt-3 t-h2 text-navy">That dashboard page doesn&apos;t exist.</h1>
      <Link href="/admin" className="mt-6 inline-block font-semibold text-navy underline underline-offset-4">
        Back to the dashboard
      </Link>
    </main>
  );
}
