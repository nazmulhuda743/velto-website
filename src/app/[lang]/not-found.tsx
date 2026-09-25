import { NotFoundView } from "@/components/pages/NotFoundView";
import SiteLayout from "./(site)/layout";

/** 404 for notFound() inside the public site (it isn't nested in (site), so it adds the chrome). */
export default function NotFound() {
  return (
    <SiteLayout>
      <NotFoundView />
    </SiteLayout>
  );
}
