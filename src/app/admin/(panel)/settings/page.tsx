import { AdminHeader, Field, Notice, one, type SearchParams } from "@/components/admin/ui";
import { LOCATIONS } from "@/content/site";
import { getSiteContent } from "@/lib/site-content";
import { ImageFileInput } from "@/components/admin/ImageFileInput";
import { saveLogoAction, saveSettingsAction } from "../../actions";
import { requireSection } from "@/lib/admin/session";

export default async function SettingsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireSection("settings");
  const params = await searchParams;
  const { settings, brand } = await getSiteContent();
  return (
    <>
      <AdminHeader title="Site settings" intro="Logo, contact details, the announcement bar and the Google figures shown across the website. Menu, footer and page wording is edited on Text & copy." />
      <Notice saved={one(params.saved)} error={one(params.error)} />

      <section aria-labelledby="logo-title" className="admin-card mt-6 p-5 md:p-7">
        <h2 id="logo-title" className="t-h4 text-navy">
          Logo
        </h2>
        <p className="mt-1 t-small text-secondary">Used in the header, footer and dashboard. Upload a transparent PNG or WebP, wider than tall, under 4 MB.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {(
            [
              { which: "logo", title: "Logo (on white)", src: brand.logo ?? "/brand/velto-logo.png", custom: Boolean(brand.logo), bg: "bg-white" },
              { which: "white", title: "White logo (on navy)", src: brand.logoWhite ?? "/brand/velto-logo-white.png", custom: Boolean(brand.logoWhite), bg: "bg-navy" },
            ] as const
          ).map((l) => (
            <form key={l.which} action={saveLogoAction} className="rounded-md border border-line p-4">
              <input type="hidden" name="which" value={l.which} />
              <p className="t-small font-semibold text-navy">
                {l.title} {l.custom ? <span className="font-normal text-success">· your upload</span> : <span className="font-normal text-secondary">· official artwork</span>}
              </p>
              <div className={`mt-3 flex h-24 items-center justify-center rounded-md ${l.bg}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={l.src} alt="" className="h-12 w-auto" />
              </div>
              <ImageFileInput name="file" accept="image/png,image/webp" className="mt-3 block w-full t-small" aria-label={`New file for ${l.title}`} />
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="submit" className="admin-btn">
                  Upload logo
                </button>
                {l.custom ? (
                  <button type="submit" name="reset" value="1" formNoValidate className="admin-btn-danger">
                    Restore official logo
                  </button>
                ) : null}
              </div>
            </form>
          ))}
        </div>
      </section>

      <form action={saveSettingsAction} className="mt-6 space-y-6">
        <section className="admin-card p-5 md:p-7">
          <h2 className="t-h4 text-navy">WhatsApp</h2>
          <div className="mt-4 max-w-md">
            <Field label="WhatsApp number" hint="With country code, digits only. Every WhatsApp button uses this.">
              <input name="whatsappNumber" defaultValue={settings.whatsappNumber} inputMode="numeric" required className="admin-input" />
            </Field>
          </div>
        </section>

        <section className="admin-card p-5 md:p-7">
          <h2 className="t-h4 text-navy">Booking</h2>
          <p className="mt-1 t-small text-secondary">
            Orders of ৳499+ get free pickup &amp; delivery. Smaller orders show this charge in the booking summary.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Pickup & delivery charge under ৳499 (৳)" hint="Whole taka. Leave empty until it's decided: the summary then says Velto will confirm it.">
              <input
                name="pickupChargeTaka"
                type="number"
                inputMode="numeric"
                min={0}
                max={2000}
                step={1}
                defaultValue={settings.pickupChargeTaka ?? ""}
                className="admin-input"
              />
            </Field>
          </div>
        </section>

        <section className="admin-card p-5 md:p-7">
          <h2 className="t-h4 text-navy">Announcement bar</h2>
          <p className="mt-1 t-small text-secondary">A thin navy bar above the header on every page, e.g. Eid holiday hours or an offer.</p>
          <label className="mt-4 flex items-center gap-3">
            <input type="checkbox" name="announcementEnabled" defaultChecked={settings.announcement.enabled} className="size-4" />
            <span className="font-semibold text-navy">Show the announcement bar</span>
          </label>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Text" hint="Up to 160 characters.">
              <input name="announcementText" defaultValue={settings.announcement.text} maxLength={160} className="admin-input" />
            </Field>
            <Field label="Text in Bangla" hint="Optional. Shown on Bangla pages; if empty, they show the English text.">
              <input name="announcementTextBn" lang="bn" defaultValue={settings.announcement.textBn} maxLength={160} className="admin-input" />
            </Field>
            <Field label="Link" hint="Optional. A page like /pricing or a full https:// link. Bangla pages open the page's Bangla version.">
              <input name="announcementHref" defaultValue={settings.announcement.href} maxLength={300} className="admin-input" />
            </Field>
          </div>
        </section>

        <section className="admin-card p-5 md:p-7">
          <h2 className="t-h4 text-navy">Outlets</h2>
          <p className="mt-1 t-small text-secondary">
            Google rating and review count for each outlet, as shown on Google Maps. Keep them current; never combine the two.
          </p>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            {LOCATIONS.map((loc) => {
              const o = settings.outlets[loc.id];
              return (
                <fieldset key={loc.id} className="space-y-3 rounded-lg border border-line p-4">
                  <legend className="px-1 font-semibold text-navy">{loc.name}</legend>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Google rating">
                      <input name={`${loc.id}.rating`} defaultValue={o.rating} maxLength={4} className="admin-input" />
                    </Field>
                    <Field label="Review count">
                      <input name={`${loc.id}.reviewCount`} defaultValue={o.reviewCount} inputMode="numeric" className="admin-input" />
                    </Field>
                  </div>
                  <Field label="Opening hours">
                    <input name={`${loc.id}.hours`} defaultValue={o.hours} maxLength={80} className="admin-input" />
                  </Field>
                </fieldset>
              );
            })}
          </div>
        </section>

        <button type="submit" className="admin-btn">
          Save settings
        </button>
      </form>
    </>
  );
}
