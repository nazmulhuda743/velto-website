import Link from "next/link";
import { getSiteContent } from "@/lib/site-content";

/** Optional site-wide notice, switched on and edited from the admin dashboard. */
export async function AnnouncementBar() {
  const { announcement } = (await getSiteContent()).settings;
  if (!announcement.enabled || !announcement.text) return null;
  const external = /^https?:\/\//.test(announcement.href);
  const text = <span className="font-medium">{announcement.text}</span>;
  return (
    <div className="bg-navy text-white">
      <div className="container-page flex min-h-10 items-center justify-center py-2 text-center t-small">
        {announcement.href ? (
          external ? (
            <a href={announcement.href} target="_blank" rel="noopener noreferrer" className="underline decoration-cyan underline-offset-4">
              {text}
            </a>
          ) : (
            <Link href={announcement.href} className="underline decoration-cyan underline-offset-4">
              {text}
            </Link>
          )
        ) : (
          text
        )}
      </div>
    </div>
  );
}
