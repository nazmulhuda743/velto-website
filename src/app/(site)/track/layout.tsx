import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/track" },
  robots: { index: false, follow: true },
};

export default function TrackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
