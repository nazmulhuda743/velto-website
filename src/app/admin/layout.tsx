import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Velto website dashboard",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-soft text-body">{children}</div>;
}
