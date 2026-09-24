import { AdminHeader, Badge, Notice, one, type SearchParams } from "@/components/admin/ui";
import { IMAGE_SLOTS } from "@/content/mock";
import { getSiteContent } from "@/lib/site-content";
import { saveImageAction } from "../../actions";

/** Where each slot appears, so the owner knows what they're replacing. */
const LABELS: Record<string, string> = {
  hero: "Homepage hero",
  dryCleaning: "Dry Cleaning (homepage + service page)",
  washAndIron: "Wash & Iron (homepage + service page)",
  ironing: "Ironing (homepage + service page)",
  household: "Curtains (homepage + Curtain page)",
  householdSection: "Carpets / household section",
  delicate: "Delicate garments",
  blankets: "Blankets & Comforters",
  curtainsMeasured: "Curtain page: measuring",
  carpetMeasured: "Carpet page: measuring",
  regular: "Regular laundry",
  final: "Final booking section",
  "locations.sector-11": "Sector 11 outlet",
  "locations.sector-18": "Sector 18 outlet",
};
const STAGES = ["Collected", "Checked in", "Tagged", "Checked before cleaning", "Cleaned & finished", "Checked before packing", "Packed", "Returned"];
const label = (id: string) =>
  LABELS[id] ?? (id.startsWith("process.") ? `Process step ${Number(id.split(".")[1]) + 1}: ${STAGES[Number(id.split(".")[1])]}` : id);

const POSITIONS = ["center", "top", "bottom", "left", "right", "center 30%", "center 70%"];

export default async function ImagesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { images } = await getSiteContent();
  const errorSlot = one(params.slot);
  return (
    <>
      <AdminHeader
        title="Images"
        intro="Replace any photo on the website. Uploads are JPG, PNG, WebP or AVIF up to 8 MB; the site resizes them for every screen. Describe what the photo shows in the alt text."
      />
      <Notice saved={one(params.saved) ? true : undefined} error={errorSlot ? undefined : one(params.error)} />
      <ul className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {IMAGE_SLOTS.map(({ id, slot }) => {
          const override = images[id];
          const src = override?.src ?? slot.src;
          return (
            <li key={id} id={`slot-${id}`} className="admin-card overflow-hidden">
              <div className="relative aspect-[4/3] bg-soft">
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt=""
                    className="absolute inset-0 size-full object-cover"
                    style={{ objectPosition: override?.position ?? slot.position }}
                  />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center t-small text-secondary">No photo yet</span>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold text-navy">{label(id)}</h2>
                  {override ? <Badge tone="green">Your photo</Badge> : slot.src ? <Badge>Stock</Badge> : <Badge tone="amber">Missing</Badge>}
                </div>
                {one(params.saved) === id ? <p className="mt-2 t-small font-medium text-success">Saved.</p> : null}
                {errorSlot === id ? <p className="mt-2 t-small font-medium text-error">{one(params.error)}</p> : null}
                <form action={saveImageAction} className="mt-3 space-y-3">
                  <input type="hidden" name="id" value={id} />
                  <input type="file" name="image" accept="image/jpeg,image/png,image/webp,image/avif" className="block w-full t-small" aria-label={`New photo for ${label(id)}`} />
                  <input
                    name="alt"
                    defaultValue={override?.alt ?? slot.alt}
                    maxLength={300}
                    className="admin-input"
                    aria-label="Alt text"
                    placeholder="What the photo shows"
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
                    <button type="submit" className="admin-btn">
                      Save
                    </button>
                    {override ? (
                      <button type="submit" name="reset" value="1" className="admin-btn-danger">
                        Reset
                      </button>
                    ) : null}
                  </div>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
