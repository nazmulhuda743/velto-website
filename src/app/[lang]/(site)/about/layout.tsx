import type { Metadata } from "next";
import { alternatesFor } from "@/lib/seo/page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return { alternates: await alternatesFor("/about") };
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
