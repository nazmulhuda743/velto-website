import { AdminHeader, Field, Notice, one, type SearchParams } from "@/components/admin/ui";
import { LOCATIONS } from "@/content/site";
import { getSiteContent } from "@/lib/site-content";
import { saveSettingsAction } from "../../actions";
import { requireSection } from "@/lib/admin/session";

export default async function SettingsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireSection("settings");
  const params = await searchParams;
  const { settings } = await getSiteContent();
  return (
    <>
      <AdminHeader title="Site settings" intro="Contact details, the announcement bar and the Google figures shown across the website." />
      <Notice saved={one(params.saved)} error={one(params.error)} />

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
