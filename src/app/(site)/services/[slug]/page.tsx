import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageMetadata } from "@/lib/seo";
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
  return getServicePage(slug) ? pageMetadata(`/services/${slug}`) : {};
}

export default async function ServiceRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = getServicePage(slug);
  if (!service) notFound();
  return <ServicePage service={service} />;
}
