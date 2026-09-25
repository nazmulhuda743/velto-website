import type { Metadata } from "next";
import { alternatesFor } from "@/lib/seo/page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return { alternates: await alternatesFor("/regular-laundry") };
}

export default function RegularLaundryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
