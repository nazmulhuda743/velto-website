import { NotFoundView } from "@/components/pages/NotFoundView";
import { SiteChrome } from "@/components/layout/SiteChrome";

/** 404 for notFound() inside the public site (it isn't nested in (site), so it adds the chrome). */
export default function NotFound() {
  return (
    <SiteChrome notFound>
      <NotFoundView />
    </SiteChrome>
  );
}
