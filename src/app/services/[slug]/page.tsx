import { notFound } from "next/navigation";
import { PlaceholderPage, placeholderMetadata } from "@/components/layout/PlaceholderPage";

const SERVICE_TITLES: Record<string, string> = {
  "dry-cleaning": "Dry Cleaning",
  "wash-and-iron": "Wash & Iron",
  ironing: "Ironing",
  "curtain-cleaning": "Curtain Cleaning",
  "carpet-cleaning": "Carpet Cleaning",
  "blanket-comforter-cleaning": "Blankets & Comforters",
};

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(SERVICE_TITLES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return placeholderMetadata(SERVICE_TITLES[slug] ?? "Service");
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const title = SERVICE_TITLES[slug];
  if (!title) notFound();
  return <PlaceholderPage title={title} />;
}
