import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServiceViewTracker } from "@/components/analytics/ServiceViewTracker";
import { JsonLd } from "@/components/seo/JsonLd";
import { ServicePage } from "@/components/services/ServicePage";
import { SERVICE_PAGES, getServicePage } from "@/content/services";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { buildBreadcrumbSchema, buildServiceSchema } from "@/lib/seo/schema";

export const dynamicParams = true;
export const revalidate = 300;

export function generateStaticParams() {
  return SERVICE_PAGES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return getServicePage(slug) ? pageMetadata(`/services/${slug}`) : {};
}

export default async function ServiceRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = getServicePage(slug);
  if (!service) notFound();
  return (
    <>
      <JsonLd
        data={[
          buildServiceSchema(service),
          buildBreadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Services", path: "/services" },
            { name: service.name, path: `/services/${service.slug}` },
          ]),
        ]}
      />
      <ServiceViewTracker service={service.slug} />
      <ServicePage service={service} />
    </>
  );
}
