import { SiteChrome } from "@/components/layout/SiteChrome";

/** Public website chrome. The admin panel has its own layout. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <SiteChrome>{children}</SiteChrome>;
}
