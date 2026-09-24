import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/regular-laundry" },
};

export default function RegularLaundryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
