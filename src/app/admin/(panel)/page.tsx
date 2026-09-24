import Link from "next/link";
import { AdminHeader, Badge } from "@/components/admin/ui";
import { IMAGE_SLOTS } from "@/content/mock";
import { SEO_ROUTES } from "@/content/seo-routes";
import { getWebsiteRequests, type WebsiteRequest } from "@/lib/admin/data";
import { createdWithin, requestDate, requestDetails } from "@/lib/admin/request-details";
import { getSiteContent } from "@/lib/site-content";

const DAY = 24 * 60 * 60 * 1000;

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="admin-card p-5">
      <p className="t-small text-secondary">{label}</p>
      <p className="mt-1 text-[32px] font-semibold leading-none tracking-[-0.02em] text-navy">{value}</p>
      {sub ? <p className="mt-2 t-caption text-secondary">{sub}</p> : null}
    </div>
  );
}

export default async function AdminOverview() {
  const content = await getSiteContent();
  let requests: WebsiteRequest[] = [];
  let requestsError = false;
  try {
    requests = await getWebsiteRequests(300);
  } catch {
    requestsError = true;
  }
  const since = (ms: number) => createdWithin(requests, ms);
  const bookings = requests.filter((r) => r.source === "website_booking");
  const open = requests.filter((r) => r.status !== "done");
  const replaced = IMAGE_SLOTS.filter((s) => content.images[s.id]).length;
  const seoCustom = SEO_ROUTES.filter((r) => content.seo[r.path]).length;

  return (
    <>
      <AdminHeader title="Overview" intro="Website requests from Velto Ops, and what's currently set on the website." />

      <h2 className="mt-8 t-label uppercase text-secondary">Requests from the website</h2>
      {requestsError ? (
        <p className="mt-3 t-small text-error">Couldn&apos;t load requests from Velto Ops right now.</p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Last 24 hours" value={since(DAY).length} sub="bookings + quotes" />
          <Stat label="Last 7 days" value={since(7 * DAY).length} sub={`${since(7 * DAY).filter((r) => r.source === "website_booking").length} bookings`} />
          <Stat label="Open in Ops" value={open.length} sub="not marked done" />
          <Stat label="All-time bookings" value={bookings.length} sub={`${requests.length - bookings.length} quotes`} />
        </div>
      )}

      <h2 className="mt-10 t-label uppercase text-secondary">Website content</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Link href="/admin/seo" className="block hover:opacity-80">
          <Stat label="SEO" value={`${seoCustom}/${SEO_ROUTES.length}`} sub="pages with custom SEO" />
        </Link>
        <Link href="/admin/images" className="block hover:opacity-80">
          <Stat label="Images" value={`${replaced}/${IMAGE_SLOTS.length}`} sub="replaced with your photos" />
        </Link>
        <Link href="/admin/reviews" className="block hover:opacity-80">
          <Stat label="Reviews" value={content.reviews.length} sub={`${content.reviews.filter((r) => r.showOnHome).length} on the homepage`} />
        </Link>
        <Link href="/admin/settings" className="block hover:opacity-80">
          <Stat
            label="Announcement bar"
            value={content.settings.announcement.enabled ? "On" : "Off"}
            sub={`WhatsApp +${content.settings.whatsappNumber}`}
          />
        </Link>
      </div>

      <div className="mt-10 flex items-center justify-between">
        <h2 className="t-label uppercase text-secondary">Latest requests</h2>
        <Link href="/admin/requests" className="t-small font-semibold text-navy underline underline-offset-4">
          See all
        </Link>
      </div>
      <div className="admin-card mt-3 overflow-hidden">
        {requests.length === 0 ? (
          <p className="p-5 t-small text-secondary">No website bookings or quotes yet.</p>
        ) : (
          <ul>
            {requests.slice(0, 8).map((r) => {
              const d = requestDetails(r.description);
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-5 py-3 last:border-0">
                  <Badge tone={r.source === "website_booking" ? "blue" : "amber"}>{r.source === "website_booking" ? "Booking" : "Quote"}</Badge>
                  <span className="font-semibold text-navy">{d.Name ?? r.title}</span>
                  <span className="t-small text-secondary">{d.Service ?? "—"}</span>
                  <span className="t-small text-secondary">{d.Area}</span>
                  <span className="ml-auto t-small text-secondary">{requestDate(r.created_at)}</span>
                  <Badge tone={r.status === "done" ? "green" : "neutral"}>{r.status}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
