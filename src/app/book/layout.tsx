import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/book" },
  robots: { index: false, follow: true },
};

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return children;
}
