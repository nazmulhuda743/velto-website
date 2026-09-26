import { PhotoPicker } from "@/components/admin/PhotoPicker";
import { AdminHeader, Badge, Notice, one, type SearchParams } from "@/components/admin/ui";
import { dictionary } from "@/content/i18n";
import { IMAGE_SLOTS } from "@/content/mock";
import { dayLabel } from "@/lib/admin/page-helpers";
import { pagesForSlot, SITE_PAGES, slotName, UNUSED_SLOTS } from "@/lib/admin/image-pages";
import { getSiteContent } from "@/lib/site-content";
import { saveImageAction } from "../../actions";
import { requireSection } from "@/lib/admin/session";

const POSITIONS = ["center", "top", "bottom", "left", "right", "center 30%", "center 70%"];

export default async function ImagesPage({ searchParams }: { searchParams: SearchParams }) {
  await requireSection("images");
  const params = await searchParams;
  const { images } = await getSiteContent();
  const errorSlot = one(params.slot);
  const pageKey = one(params.page) ?? "home";
  const page = SITE_PAGES.find((p) => p.key === pageKey);
  const ids = page ? page.slots : pageKey === "unused" ? UNUSED_SLOTS : IMAGE_SLOTS.map((s) => s.id);
  const slots = ids.flatMap((id) => IMAGE_SLOTS.filter((s) => s.id === id));
  const tabs = [
    ...SITE_PAGES.map((p) => ({ key: p.key, title: p.title, count: p.slots.length })),
    { key: "unused", title: "Not on a page yet", count: UNUSED_SLOTS.length },
    { key: "all", title: "Every photo", count: IMAGE_SLOTS.length },
  ];
  return (
    <>
      <AdminHeader
        title="Images"
        intro="Choose a page, then replace any photo on it. Uploads are JPG, PNG, WebP or AVIF up to 4 MB; the site resizes them for every screen. A photo shared by several pages changes on all of them (listed under “Also on”)."
      />
      <Notice saved={one(params.saved) ? true : undefined} error={errorSlot ? undefined : one(params.error)} />
      <nav aria-label="Pages" className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-2 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0">
        {tabs.map((t) => (
          <a
            key={t.key}
            href={`/admin/images?page=${t.key}`}
            aria-current={pageKey === t.key ? "page" : undefined}
            className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md border px-3 py-1.5 t-small font-semibold ${pageKey === t.key ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-navy"}`}
          >
            {t.title}
            <span className={`rounded-full px-1.5 text-[11px] leading-5 tabular-nums ${pageKey === t.key ? "bg-white/20" : "bg-soft"}`}>{t.count}</span>
          </a>
        ))}
      </nav>
      {page ? (
        <p className="mt-4 t-small text-secondary">
          {slots.length} photo{slots.length === 1 ? "" : "s"} on {page.title}.{" "}
          <a href={page.path} target="_blank" rel="noopener noreferrer" className="font-semibold text-navy underline underline-offset-4">
            View the page ↗
          </a>
        </p>
      ) : null}
      <ul className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {slots.map(({ id, slot }) => {
          const override = images[id];
          const src = override?.src ?? slot.src ?? null;
          return (
            <li key={id} id={`slot-${id}`} className="admin-card overflow-hidden">
              <form action={saveImageAction}>
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="page" value={pageKey} />
                <PhotoPicker name="image" src={src} position={override?.position ?? slot.position} label={slotName(id)} />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-semibold text-navy">{slotName(id)}</h2>
                    {override ? (
                      <Badge tone="green">Your upload</Badge>
                    ) : slot.src && slot.source?.platform === "Supplied by Velto" ? (
                      <Badge tone="blue">Velto photo</Badge>
                    ) : slot.src ? (
                      <Badge>Stock</Badge>
                    ) : (
                      <Badge tone="amber">Missing</Badge>
                    )}
                  </div>
                  {(() => {
                    const others = pagesForSlot(id).filter((p) => p.key !== pageKey);
                    return others.length ? (
                      <p className="mt-1 t-caption text-secondary">
                        Also on: {others.map((p) => p.title).join(", ")}
                      </p>
                    ) : !pagesForSlot(id).length ? (
                      <p className="mt-1 t-caption text-secondary">Not shown on any page yet</p>
                    ) : null;
                  })()}
                  {one(params.saved) === id ? <p className="mt-2 t-small font-medium text-success">Saved. The website now shows this.</p> : null}
                  {errorSlot === id ? <p className="mt-2 t-small font-medium text-error">{one(params.error)}</p> : null}
                  <details className="mt-3 border-t border-line pt-3">
                    <summary className="cursor-pointer t-small font-semibold text-blue">Alt text, focus point & details</summary>
                  <dl className="mt-3 grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-1 t-small">
                    <dt className="text-secondary">Source</dt>
                    <dd className="text-navy">
                      {override ? "Your upload" : slot.source ? [slot.source.platform, slot.source.photographer].filter(Boolean).join(" · ") : "None yet"}
                    </dd>
                    <dt className="text-secondary">Alt text</dt>
                    <dd className={(override?.alt ?? slot.alt) ? "line-clamp-2 text-navy" : "font-semibold text-error"}>{override?.alt ?? slot.alt ?? "Missing"}</dd>
                    <dt className="text-secondary">Bangla alt</dt>
                    {/* Same rule as the website (ResponsiveImage): Bangla alt, else built-in Bangla for the built-in description. */}
                    {(() => {
                      const bn = override?.altBn ?? (!override?.alt || override.alt === slot.alt ? dictionary("bn").imageAlts[id] : undefined);
                      return bn ? (
                        <dd className="line-clamp-2 text-navy" lang="bn">
                          {bn}
                        </dd>
                      ) : (
                        <dd className="text-secondary">Uses the English alt text</dd>
                      );
                    })()}
                    <dt className="text-secondary">Focus point</dt>
                    <dd className="text-navy">{override?.position ?? slot.position ?? "center (default)"}</dd>
                    <dt className="text-secondary">Last changed</dt>
                    <dd className="text-navy">{override?.updatedAt ? dayLabel(override.updatedAt) : override ? "Before change tracking" : "Never (built-in)"}</dd>
                    <dt className="text-secondary">Fallback</dt>
                    <dd className="text-navy">
                      {override
                        ? slot.src
                          ? "Reset returns to the original photo"
                          : "Reset returns to the placeholder"
                        : slot.src
                          ? slot.source?.platform === "Supplied by Velto"
                            ? "Showing Velto's own photo"
                            : "Showing licensed stock"
                          : "Showing a placeholder"}
                    </dd>
                  </dl>
                    <div className="mt-3 space-y-3">
                      <input
                        name="alt"
                        defaultValue={override?.alt ?? slot.alt}
                        maxLength={300}
                        className="admin-input"
                        aria-label="Alt text"
                        placeholder="What the photo shows"
                      />
                      <input
                        name="altBn"
                        lang="bn"
                        defaultValue={override?.altBn ?? ""}
                        maxLength={300}
                        className="admin-input"
                        aria-label="Alt text in Bangla"
                        placeholder="Alt text in Bangla (optional)"
                      />
                      <select name="position" defaultValue={override?.position ?? ""} className="admin-input" aria-label="Focus point">
                        <option value="">Focus: default</option>
                        {POSITIONS.map((p) => (
                          <option key={p} value={p}>
                            Focus: {p}
                          </option>
                        ))}
                      </select>
                      <div className="flex flex-wrap gap-2">
                        <button type="submit" className="admin-btn-secondary">
                          Save details
                        </button>
                        {override ? (
                          <button type="submit" name="reset" value="1" className="admin-btn-danger">
                            Restore original photo
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </details>
                </div>
              </form>
            </li>
          );
        })}
      </ul>
    </>
  );
}
