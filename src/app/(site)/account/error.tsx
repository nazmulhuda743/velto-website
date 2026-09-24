"use client";

export default function AccountError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="container-page py-14"><div className="max-w-xl"><p className="t-label uppercase text-blue">Velto account</p><h1 className="mt-3 t-h2 text-navy">We couldn’t load your account</h1><p className="mt-3 t-body text-body">Your data was not exposed. Try loading the account again.</p><button onClick={reset} className="mt-6 h-12 rounded-md bg-action px-6 font-semibold text-white hover:bg-action-hover">Try again</button></div></section>;
}
