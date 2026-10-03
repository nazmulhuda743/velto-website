import { AdminHeader, Badge, Field, Notice, one, type SearchParams } from "@/components/admin/ui";
import { ImageFileInput } from "@/components/admin/ImageFileInput";
import { requireSection } from "@/lib/admin/session";
import { FREQUENCY_INFO, POPUP_FREQUENCIES, barMessages, popupActive, popupProblem, popupSchedule } from "@/lib/promo";
import { getSiteContent } from "@/lib/site-content";
import { loadFirstOrderTemplateAction, savePromoBarAction, savePromoPopupAction } from "../../promo-actions";

const dayLabel = (d: string) => new Date(`${d}T00:00:00+06:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Dhaka" });

export default async function PromoPage({ searchParams }: { searchParams: SearchParams }) {
  await requireSection("promo");
  const params = await searchParams;
  const { settings, promo } = await getSiteContent();
  const bar = settings.announcement;
  const messages = barMessages(bar.text);
  const problem = popupProblem(promo);
  const live = popupActive(promo);
  const schedule = popupSchedule(promo);
  const saved = one(params.saved);
  const error = one(params.error);
  const tab = one(params.tab);

  return (
    <>
      <AdminHeader
        title="Promo & popup"
        intro="The moving bar above the header and the campaign popup visitors see on arrival. Both are live on the website the moment they are saved; the activity log records who changed what."
        actions={
          <a href="/?promo=preview" target="_blank" rel="noopener noreferrer" className="admin-btn-secondary">
            Preview on the website ↗
          </a>
        }
      />
      <Notice saved={saved} error={error} />

      {/* ---------- top bar ---------- */}
      <section id="bar" aria-labelledby="bar-title" className="admin-card mt-6 scroll-mt-6 p-5 md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="bar-title" className="t-h4 text-navy">
            Top bar
          </h2>
          <Badge tone={bar.enabled ? "green" : "neutral"}>{bar.enabled ? (bar.still ? "Live · still" : "Live · moving") : "Off"}</Badge>
        </div>
        <p className="mt-1 t-small text-secondary">
          A thin navy bar above the header on every page. The messages glide across continuously like a promo ticker and pause when a
          visitor hovers, focuses or taps pause; tick &ldquo;Keep it still&rdquo; for one centred line instead. Readers who ask their device for less motion see the still version.
        </p>

        {bar.enabled && messages.length ? (
          <div className="mt-4 overflow-hidden rounded-md bg-navy px-4 py-2.5 text-center text-[14px] font-medium text-white" aria-label="How the bar reads">
            {messages.map((m, i) => (
              <span key={i} className="inline-flex items-center">
                {i > 0 ? <span aria-hidden="true" className="mx-4 inline-block size-1.5 rounded-full bg-cyan" /> : null}
                {m}
              </span>
            ))}
          </div>
        ) : null}

        <form action={savePromoBarAction} className="mt-5 space-y-4">
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-3">
              <input type="checkbox" name="enabled" defaultChecked={bar.enabled} className="size-4" />
              <span className="font-semibold text-navy">Show the top bar</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" name="still" defaultChecked={bar.still} className="size-4" />
              <span className="font-semibold text-navy">Keep it still (no movement)</span>
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Message" hint="Several messages: separate them with | (each glides past in turn). Up to 400 characters.">
              <textarea name="text" defaultValue={bar.text} rows={2} maxLength={400} className="admin-input" placeholder="10% off your first 3 bookings on the website | Free pickup & delivery on ৳499+" />
            </Field>
            <Field label="Message in Bangla" hint="Optional. Shown on Bangla pages; if empty, they show the English text.">
              <textarea name="textBn" lang="bn" defaultValue={bar.textBn} rows={2} maxLength={400} className="admin-input" />
            </Field>
            <Field label="Link" hint="Optional. The whole bar opens it: a page like /signup or /book, or a full https:// link. With an offer line below and no link, the bar opens the booking page.">
              <input name="href" defaultValue={bar.href} maxLength={300} className="admin-input" placeholder="/signup" />
            </Field>
            <Field label="Offer line in the booking summary" hint="Optional. Repeats the offer in the order summary on Book a Pickup, so it is still there when the customer confirms. Up to 160 characters.">
              <input name="bookingNote" defaultValue={bar.bookingNote} maxLength={160} className="admin-input" placeholder="10% off your first website order. We apply it when we confirm." />
            </Field>
            <Field label="Offer line in Bangla" hint="Optional. Shown on Bangla pages; if empty, they show the English line.">
              <input name="bookingNoteBn" lang="bn" defaultValue={bar.bookingNoteBn} maxLength={160} className="admin-input" />
            </Field>
          </div>
          <button type="submit" className="admin-btn">
            Save top bar
          </button>
          {saved === "bar" && tab === "bar" ? <span className="ml-3 t-small font-medium text-success">Saved.</span> : null}
        </form>
      </section>

      {/* ---------- popup ---------- */}
      <section id="popup" aria-labelledby="popup-title" className="admin-card mt-6 scroll-mt-6 p-5 md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="popup-title" className="t-h4 text-navy">
            Campaign popup
          </h2>
          <div className="flex flex-wrap gap-2">
            {live ? <Badge tone="green">Live</Badge> : promo.enabled ? <Badge tone="amber">{schedule === "scheduled" ? `Starts ${dayLabel(promo.startsOn)}` : schedule === "ended" ? "Ended" : "On, incomplete"}</Badge> : <Badge>Off</Badge>}
            {live && promo.endsOn ? <Badge tone="blue">Ends {dayLabel(promo.endsOn)}</Badge> : null}
          </div>
        </div>
        <p className="mt-1 t-small text-secondary">
          Opens over the page a few seconds after a visitor arrives, like a poster: the picture and the button both open your link. It never
          shows on booking, sign-up, sign-in, account or tracking pages, and a visitor who closes it isn&apos;t shown it again for the
          period you choose. Editing the text or poster starts a new campaign, so everyone sees it once more.
        </p>
        <form action={loadFirstOrderTemplateAction} className="mt-4 flex flex-wrap items-center gap-3 rounded-md border border-line bg-soft px-4 py-3">
          <p className="min-w-0 flex-1 t-small text-body">
            <span className="font-semibold text-navy">Account offer template:</span> a voucher with a Velto photo, “10% off your first 3 website bookings”, ticks, small print and your Google rating, in English and Bangla. It replaces the popup below and stays off until you preview it and switch it on.
          </p>
          <button type="submit" className="admin-btn-secondary">
            Use the template
          </button>
        </form>
        {saved === "template" ? (
          <p role="status" className="mt-3 rounded-md border border-success/30 bg-success-soft px-4 py-3 t-small font-medium text-success">
            Template loaded. Open “Preview on the website” to check it, then tick “Show the popup” and save.
          </p>
        ) : null}
        {problem ? (
          <p className="mt-3 rounded-md border border-[#f0c987] bg-[#fff4e5] px-4 py-3 t-small font-medium text-[#8a5300]">To go live: {problem}</p>
        ) : null}

        <form action={savePromoPopupAction} className="mt-5 grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input type="checkbox" name="enabled" defaultChecked={promo.enabled} className="size-4" />
              <span className="font-semibold text-navy">Show the popup</span>
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Small tag" hint="Optional, above the headline, e.g. “Website launch offer”.">
                <input name="tag" defaultValue={promo.tag} maxLength={40} className="admin-input" />
              </Field>
              <Field label="Small tag in Bangla">
                <input name="tagBn" lang="bn" defaultValue={promo.tagBn} maxLength={40} className="admin-input" />
              </Field>
              <Field label="Headline" hint="Leave empty for a poster-only popup (the poster then needs alt text).">
                <input name="title" defaultValue={promo.title} maxLength={120} className="admin-input" placeholder="10% off your first 3 website bookings" />
              </Field>
              <Field label="Headline in Bangla">
                <input name="titleBn" lang="bn" defaultValue={promo.titleBn} maxLength={120} className="admin-input" />
              </Field>
              <Field label="Text" hint="One or two short sentences. Up to 400 characters.">
                <textarea name="body" defaultValue={promo.body} rows={3} maxLength={400} className="admin-input" placeholder="Sign up and book your first pickup on the website. The discount applies to your whole order." />
              </Field>
              <Field label="Text in Bangla">
                <textarea name="bodyBn" lang="bn" defaultValue={promo.bodyBn} rows={3} maxLength={400} className="admin-input" />
              </Field>
              <Field label="Button label" hint="Default: “Open the offer”.">
                <input name="cta" defaultValue={promo.cta} maxLength={40} className="admin-input" placeholder="Sign up & book" />
              </Field>
              <Field label="Button label in Bangla">
                <input name="ctaBn" lang="bn" defaultValue={promo.ctaBn} maxLength={40} className="admin-input" />
              </Field>
              <Field label="Big offer" hint="Optional, set large at the top, e.g. “10% OFF”. The first word is the big number.">
                <input name="offer" defaultValue={promo.offer} maxLength={24} className="admin-input" placeholder="10% OFF" />
              </Field>
              <Field label="Big offer in Bangla">
                <input name="offerBn" lang="bn" defaultValue={promo.offerBn} maxLength={24} className="admin-input" placeholder="১০% ছাড়" />
              </Field>
              <Field label="Ticks" hint="Up to three short reasons, separated by |. Only true facts.">
                <textarea name="points" defaultValue={promo.points} rows={2} maxLength={240} className="admin-input" placeholder="Free pickup & delivery on ৳499+ | Every item tagged and checked" />
              </Field>
              <Field label="Ticks in Bangla">
                <textarea name="pointsBn" lang="bn" defaultValue={promo.pointsBn} rows={2} maxLength={240} className="admin-input" />
              </Field>
              <Field label="Small print" hint="Who qualifies and how the discount is applied. Up to 200 characters.">
                <input name="fine" defaultValue={promo.fine} maxLength={200} className="admin-input" placeholder="For your first three bookings on the website, orders of ৳499 or more." />
              </Field>
              <Field label="Small print in Bangla">
                <input name="fineBn" lang="bn" defaultValue={promo.fineBn} maxLength={200} className="admin-input" />
              </Field>
              <label className="flex items-center gap-3 md:col-span-2">
                <input type="checkbox" name="proof" defaultChecked={promo.proof} className="size-4" />
                <span className="t-small font-semibold text-navy">Show the Google rating under the button (from Site settings)</span>
              </label>
              <Field label="Link" hint="Where the poster and the button go: a page like /signup or /book?source=promo_popup, or a full https:// link. Add ?source=… to see the campaign in Funnel.">
                <input name="href" defaultValue={promo.href} maxLength={300} required className="admin-input" placeholder="/signup?source=promo_popup" />
              </Field>
              <Field label="Show it" hint="How often one visitor sees it after closing it.">
                <select name="frequency" defaultValue={promo.frequency} className="admin-input">
                  {POPUP_FREQUENCIES.map((f) => (
                    <option key={f} value={f}>
                      {FREQUENCY_INFO[f]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Delay (seconds)" hint="How long after the page opens. 0 to 60.">
                <input name="delaySeconds" type="number" min={0} max={60} step={1} defaultValue={promo.delaySeconds} className="admin-input" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Starts on" hint="Dhaka date, optional.">
                  <input name="startsOn" type="date" defaultValue={promo.startsOn} className="admin-input" />
                </Field>
                <Field label="Ends on" hint="Last day, optional.">
                  <input name="endsOn" type="date" defaultValue={promo.endsOn} className="admin-input" />
                </Field>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-md border border-line p-4">
              <p className="t-small font-semibold text-navy">Poster</p>
              <p className="mt-0.5 t-caption text-secondary">Optional. Square or portrait works best (e.g. a social media post, 1080×1080 or 1080×1350). JPG, PNG or WebP, under 8 MB.</p>
              <div className="mt-3 flex min-h-32 items-center justify-center overflow-hidden rounded-md bg-soft">
                {promo.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={promo.image} alt={promo.imageAlt} className="max-h-72 w-full object-contain" />
                ) : (
                  <p className="p-6 text-center t-small text-secondary">No poster yet</p>
                )}
              </div>
              <label className="mt-3 block">
                <span className="t-small font-semibold text-navy">How the picture is used</span>
                <select name="imageStyle" defaultValue={promo.imageStyle} className="admin-input mt-1">
                  <option value="poster">Poster: shown whole, the whole picture opens the link</option>
                  <option value="photo">Photo: fills the side of the card, cropped to fit</option>
                </select>
              </label>
              <ImageFileInput name="image" accept="image/jpeg,image/png,image/webp,image/avif" className="mt-3 block w-full t-small" aria-label="New poster" />
              {promo.image ? (
                <label className="mt-2 flex items-center gap-2 t-small">
                  <input type="checkbox" name="removeImage" className="size-4" />
                  Remove the poster
                </label>
              ) : null}
            </div>
            <Field label="Poster alt text" hint="What the poster says, in words, for screen readers and if the image fails to load.">
              <input name="imageAlt" defaultValue={promo.imageAlt} maxLength={300} className="admin-input" />
            </Field>
            <Field label="Poster alt text in Bangla">
              <input name="imageAltBn" lang="bn" defaultValue={promo.imageAltBn} maxLength={300} className="admin-input" />
            </Field>
            <button type="submit" className="admin-btn w-full">
              Save popup
            </button>
            {saved === "popup" && tab === "popup" ? <p className="text-center t-small font-medium text-success">Saved.</p> : null}
            <p className="t-caption text-secondary">
              After saving, open <span className="font-semibold">Preview on the website</span> above: it shows the popup at once, even when it is switched off or
              you closed it before.
            </p>
          </div>
        </form>
      </section>
    </>
  );
}
