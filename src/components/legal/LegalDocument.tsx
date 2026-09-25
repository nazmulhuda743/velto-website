import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL } from "@/content/legal";
import { WHATSAPP_URL } from "@/content/site";
import { getLocations } from "@/lib/site-content";

export type LegalSection = { id: string; title: string; body: ReactNode };

/**
 * Long-form legal page: plain-language summary first, then a numbered table
 * of contents and numbered sections, so a customer can find the one clause
 * they need without reading everything.
 */
export function LegalDocument({
  label,
  title,
  intro,
  summary,
  sections,
  children,
}: {
  label: string;
  title: string;
  intro: ReactNode;
  /** "The short version": the handful of points most people need. */
  summary: ReactNode[];
  sections: LegalSection[];
  /** Optional block under the summary (e.g. the cookie settings button). */
  children?: ReactNode;
}) {
  return (
    <article className="container-page py-16 md:py-24">
      <div className="max-w-3xl">
        <p className="t-label uppercase text-action">{label}</p>
        <h1 className="mt-3 t-h1 text-navy">{title}</h1>
        <p className="mt-4 t-small text-secondary">Last updated: {LEGAL.updated}</p>
        <div className="mt-6 space-y-4 t-body-lg text-body">{intro}</div>

        <section aria-labelledby="summary-title" className="mt-10 rounded-md border border-line bg-soft p-5 md:p-7">
          <h2 id="summary-title" className="t-h4 text-navy">
            The short version
          </h2>
          <ul className="mt-4 space-y-2.5 text-body">
            {summary.map((point, i) => (
              <li key={i} className="flex gap-3">
                <span aria-hidden="true" className="mt-[11px] h-px w-3 shrink-0 bg-action" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
          {children ? <div className="mt-5">{children}</div> : null}
        </section>

        <nav aria-labelledby="contents-title" className="mt-12">
          <h2 id="contents-title" className="t-label uppercase text-navy">
            Contents
          </h2>
          <ol className="mt-4 grid gap-x-8 border-t border-line pt-3 md:grid-cols-2">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="flex gap-3 py-1.5 t-small text-body hover:text-navy">
                  <span className="w-6 shrink-0 tabular-nums text-secondary">{i + 1}.</span>
                  <span className="underline decoration-line underline-offset-4 hover:decoration-navy">{s.title}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-14 space-y-12 text-body [&_a]:font-medium [&_a]:text-navy [&_a]:underline [&_a]:underline-offset-4 [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_p+p]:mt-3 [&_p+ul]:mt-3 [&_ul+p]:mt-3 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="scroll-mt-24 border-t border-line pt-8">
              <h2 id={`${s.id}-title`} className="t-h3 text-navy">
                <span className="mr-3 tabular-nums text-action">{i + 1}.</span>
                {s.title}
              </h2>
              <div className="mt-4">{s.body}</div>
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}

/** Contact details for legal and privacy questions, from confirmed facts only. */
export async function LegalContact() {
  const locations = await getLocations();
  return (
    <>
      <p>
        {LEGAL.legalEntity ? `${LEGAL.tradingName} is operated by ${LEGAL.legalEntity}. ` : null}
        {LEGAL.tradeLicence ? `Trade licence ${LEGAL.tradeLicence}. ` : null}
        You can reach us in any of these ways:
      </p>
      <ul>
        <li>
          WhatsApp: <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">{LEGAL.whatsappDisplay}</a>
        </li>
        {LEGAL.email ? (
          <li>
            Email: <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>
          </li>
        ) : null}
        {locations.map((l) => (
          <li key={l.id}>
            In person at Velto {l.name}: {l.address} ({l.hours})
          </li>
        ))}
      </ul>
      <p>
        See also our <Link href="/terms">Terms of Service</Link>, <Link href="/privacy">Privacy Policy</Link> and{" "}
        <Link href="/cookies">Cookie Policy</Link>.
      </p>
    </>
  );
}
