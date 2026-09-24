import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServiceViewTracker } from "@/components/analytics/ServiceViewTracker";
import { ServicePageView } from "@/components/pages/ServicePageView";
import { SERVICE_PAGES, getServicePage } from "@/content/services";

export const dynamicParams = false;

export function generateStaticParams() {
  return SERVICE_PAGES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const service = getServicePage(slug);
  if (!service) return {};
  return {
    title: `${service.name} in Uttara — Velto`,
    description: service.metaDescription,
    alternates: { canonical: `/services/${service.slug}` },
  };
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = getServicePage(slug);
  if (!service) notFound();
  return (
    <>
      <ServiceViewTracker service={service.slug} />
      <ServicePageView service={service} />
    </>
  );
}
