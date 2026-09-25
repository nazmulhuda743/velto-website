import type { Metadata } from "next";
import { alternatesFor } from "@/lib/seo/page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return { alternates: await alternatesFor("/pricing") };
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
