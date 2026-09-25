import type { Metadata } from "next";
import { fontVariables } from "../fonts";
import "../globals.css";

export const metadata: Metadata = {
  title: "Velto website dashboard",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Root layout for the admin dashboard (English only; the public site's is app/[lang]). */
export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body>
        <div className="min-h-dvh bg-soft text-body">{children}</div>
      </body>
    </html>
  );
}
