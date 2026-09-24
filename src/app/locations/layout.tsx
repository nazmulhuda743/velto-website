import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/locations" },
};

export default function LocationsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
