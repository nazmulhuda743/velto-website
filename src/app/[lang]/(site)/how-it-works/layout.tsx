import type { Metadata } from "next";
import { alternatesFor } from "@/lib/seo/page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return { alternates: await alternatesFor("/how-it-works") };
}

export default function HowItWorksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
