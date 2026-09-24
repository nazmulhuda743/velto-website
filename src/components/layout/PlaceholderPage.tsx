import type { Metadata } from "next";
import { TextLink } from "@/components/ui/TextLink";

export const placeholderMetadata = (title: string): Metadata => ({
  title: `${title} — Velto`,
  robots: { index: false, follow: false },
});

/**
 * Minimal destination used only for navigation testing during the homepage
 * build (spec §35). Real pages follow after homepage approval.
 */
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <section className="container-page py-(--space-section)">
      <p className="t-label uppercase text-secondary">Placeholder route</p>
      <h1 className="mt-4 t-h2 text-navy">{title}</h1>
      <p className="mt-4 max-w-[50ch] text-body">
        This page is built after the homepage has been approved.
      </p>
      <div className="mt-6">
        <TextLink href="/">Back to the homepage</TextLink>
      </div>
    </section>
  );
}
