import type { Metadata } from "next";
import { LOCATIONS } from "@/content/site";
import { alternatesFor } from "@/lib/seo/page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!LOCATIONS.some((location) => location.id === id)) return {};
  return { alternates: await alternatesFor(`/locations/${id}`) };
}

export default function LocationLayout({ children }: { children: React.ReactNode }) {
  return children;
}
