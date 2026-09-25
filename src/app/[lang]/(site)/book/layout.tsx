import type { Metadata } from "next";
import { alternatesFor } from "@/lib/seo/page-metadata";

const baseMetadata: Metadata = {
  robots: { index: false, follow: true },
};

export async function generateMetadata(): Promise<Metadata> {
  return { ...baseMetadata, alternates: await alternatesFor("/book") };
}

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return children;
}
