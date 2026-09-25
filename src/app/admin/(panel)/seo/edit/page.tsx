import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageFileInput } from "@/components/admin/ImageFileInput";
import { SeoFields } from "@/components/admin/SeoFields";
import { AdminHeader, Notice, one, type SearchParams } from "@/components/admin/ui";
import { dictionary } from "@/content/i18n";
import { getSeoRoute } from "@/content/seo-routes";
import { getServicePage } from "@/content/services";
import { BANGLA_READY_PATHS, banglaEnabled } from "@/lib/i18n/config";
import { getSiteContent } from "@/lib/site-content";
import { SITE_URL } from "@/lib/site-url";
import { saveSeoAction } from "../../../actions";

export default async function SeoEditPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const path = one(params.path) ?? "";
  const route = getSeoRoute(path);
  if (!route) notFound();
  const entry = (await getSiteContent()).seo[path] ?? {};
  // The built-in Bangla text for this page, as page-metadata.ts uses it.
  const bangla = dictionary("bn").seo[path] ?? (path.startsWith("/services/") ? getServicePage(path.slice(10), "bn")?.meta : undefined);

  return (
    <>
      <Link href="/admin/seo" className="t-small font-semibold text-navy underline underline-offset-4">
        ← All pages
      </Link>
      <div className="mt-4">
        <AdminHeader
          title={route.label}
          intro={
            <>
              SEO for{" "}
              <a href={path} target="_blank" className="underline underline-offset-4">
                {path}
              </a>
              . Empty fields use the built-in text shown as the placeholder.
            </>
          }
        />
      </div>
      <Notice saved={one(params.saved)} error={one(params.error)} />

      <form action={saveSeoAction} className="admin-card mt-6 space-y-6 p-5 md:p-7">
        <input type="hidden" name="path" value={path} />
        <SeoFields
          path={path}
          siteUrl={SITE_URL}
          defaults={{ title: route.title, description: route.description }}
          initial={{ title: entry.title ?? "", description: entry.description ?? "" }}
        />
        <div className="border-t border-line pt-6">
          <h2 className="t-h4 text-navy">Bangla page</h2>
          <p className="mt-1 t-small text-secondary">
            {BANGLA_READY_PATHS.includes(path)
              ? "Title and description of the Bangla version of this page. Empty fields use the built-in Bangla text shown as the placeholder."
              : "This page isn't translated yet, so its Bangla version is hidden from Google. Empty fields use the English text."}
            {banglaEnabled() ? null : " The Bangla site isn't live yet; this text is used once it is."}
          </p>
          <div className="mt-5">
            <SeoFields
              lang="bn"
              path={path}
              siteUrl={SITE_URL}
              defaults={{
                title: bangla?.title ?? entry.title ?? route.title,
                description: bangla?.description ?? entry.description ?? route.description,
              }}
              initial={{ title: entry.titleBn ?? "", description: entry.descriptionBn ?? "" }}
            />
          </div>
        </div>
        <div>
          <p className="text-[15px] font-semibold text-navy">Share image</p>
          <p className="mt-0.5 t-small text-secondary">Shown when the page is shared on Facebook, WhatsApp and similar. 1200 × 630 works best.</p>
          {entry.ogImage ? (
            <div className="mt-3 flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={entry.ogImage} alt="" className="h-20 w-36 rounded-md border border-line object-cover" />
              <label className="flex items-center gap-2 t-small">
                <input type="checkbox" name="removeOgImage" /> Remove this image
              </label>
            </div>
          ) : null}
          <ImageFileInput name="ogImage" accept="image/jpeg,image/png,image/webp" className="mt-3 block t-small" />
        </div>
        <label className="flex items-start gap-3">
          <input type="checkbox" name="noindex" defaultChecked={entry.noindex} className="mt-1 size-4" />
          <span>
            <span className="block font-semibold text-navy">Hide this page from Google</span>
            <span className="block t-small text-secondary">Adds a noindex tag. Use only for pages you don&apos;t want in search results.</span>
          </span>
        </label>
        <div className="flex flex-wrap gap-3 border-t border-line pt-5">
          <button type="submit" className="admin-btn">
            Save SEO
          </button>
          <button type="submit" name="reset" value="1" className="admin-btn-danger">
            Reset to built-in
          </button>
        </div>
      </form>
    </>
  );
}
