import type { ReactNode } from "react";

const POINTS = [
  { title: "Every order in one place", copy: "Status, dates and what's due, without calling us." },
  { title: "Faster pickups", copy: "Your name, number and address are filled in when you book." },
  { title: "Your details stay yours", copy: "We only use them to run your orders." },
];

/** Frame for sign-in, sign-up and password pages: calm, one task per screen. */
export function AuthShell({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby="page-title" className="bg-warm py-10 md:py-16 xl:py-20">
      <div className="container-page grid gap-10 xl:grid-cols-12 xl:gap-8">
        <div className="xl:col-span-6 xl:col-start-2">
          <div className="mx-auto max-w-[480px] xl:mx-0">
            <h1 id="page-title" className="t-h1 text-navy">
              {title}
            </h1>
            {intro ? <div className="mt-3 t-body-lg text-body">{intro}</div> : null}
            <div className="mt-8 rounded-lg border border-line bg-white p-5 shadow-[0_12px_32px_-24px_rgba(0,43,78,0.35)] md:p-8">{children}</div>
          </div>
        </div>
        <aside aria-label="About Velto accounts" className="hidden xl:col-span-4 xl:col-start-8 xl:block">
          <div className="sticky top-[120px] rounded-lg bg-navy p-8 text-white">
            <p className="t-label uppercase text-cyan">Your Velto account</p>
            <ul className="mt-6 space-y-6">
              {POINTS.map((p) => (
                <li key={p.title} className="border-t border-white/15 pt-5 first:border-0 first:pt-0">
                  <p className="font-semibold">{p.title}</p>
                  <p className="mt-1 t-small text-white/75">{p.copy}</p>
                </li>
              ))}
            </ul>
            <p className="mt-8 t-small text-white/70">Booking and order tracking still work without an account.</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
