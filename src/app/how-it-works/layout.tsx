import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/how-it-works" },
};

export default function HowItWorksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
