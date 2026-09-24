import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServiceViewTracker } from "@/components/analytics/ServiceViewTracker";
import { ServicePage } from "@/components/services/ServicePage";
import { SERVICE_PAGES, getServicePage } from "@/content/services";

export const dynamicParams = false;
/** Price tables come from the public pricing view; refresh them every 5 minutes. */
export const revalidate = 300;

export function generateStaticParams() {
  return SERVICE_PAGES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const service = getServicePage(slug);
  if (!service) return {};
  const path = `/services/${service.slug}`;
  return {
    title: service.meta.title,
    description: service.meta.description,
    alternates: { canonical: path },
    openGraph: {
      title: service.meta.title,
      description: service.meta.description,
      url: path,
      siteName: "Velto Premium Laundry",
      locale: "en_BD",
      type: "website",
    },
  };
}

export default async function ServiceRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = getServicePage(slug);
  if (!service) notFound();
  return (
    <>
      <ServiceViewTracker service={service.slug} />
      <ServicePage service={service} />
    </>
  );
}
