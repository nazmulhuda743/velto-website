import type { Metadata } from "next";
import { alternatesFor } from "@/lib/seo/page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return { alternates: await alternatesFor("/careers") };
}

export default function CareersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
