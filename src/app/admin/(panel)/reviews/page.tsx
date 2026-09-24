import { AdminHeader, Badge, Field, Notice, one, type SearchParams } from "@/components/admin/ui";
import { SERVICE_PAGES } from "@/content/services";
import { getSiteContent, type ReviewEntry } from "@/lib/site-content";

/** Service pages that show a review (matched by reviewer name, as the service page does). */
const serviceLinks = (name: string | null) =>
  SERVICE_PAGES.filter((s) => s.blocks.some((b) => b.type === "review" && b.review.name === name)).map((s) => s.name);
import { saveReviewAction } from "../../actions";

function ReviewFields({ review }: { review?: ReviewEntry }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Customer name">
        <input name="name" defaultValue={review?.name ?? ""} required maxLength={80} className="admin-input" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Platform">
          <select name="platform" defaultValue={review?.platform ?? "Google"} className="admin-input">
            <option>Google</option>
            <option>Facebook</option>
          </select>
        </Field>
        <Field label="Rating">
          <select name="rating" defaultValue={String(review?.rating ?? 5)} className="admin-input">
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} stars
              </option>
            ))}
            <option value="recommends">Recommends</option>
          </select>
        </Field>
      </div>
      <div className="md:col-span-2">
        <Field label="Review text" hint="Paste it exactly as the customer wrote it. Blank lines keep paragraphs.">
          <textarea name="text" defaultValue={review?.text ?? ""} required rows={5} maxLength={4000} className="admin-input" />
        </Field>
      </div>
      <Field label="Outlet it was left on" hint="Used only to link to the right Google page. Not shown to visitors.">
        <select name="branch" defaultValue={review?.branch ?? ""} className="admin-input">
          <option value="">Not sure</option>
          <option value="sector-11">Sector 11</option>
          <option value="sector-18">Sector 18</option>
        </select>
      </Field>
      <Field label="Direct link to the review" hint="Optional. Starts with https://">
        <input name="sourceUrl" defaultValue={review?.sourceUrl ?? ""} maxLength={500} className="admin-input" placeholder="https://" />
      </Field>
      <label className="flex items-center gap-3 md:col-span-2">
        <input type="checkbox" name="showOnHome" defaultChecked={review ? review.showOnHome : true} className="size-4" />
        <span className="font-semibold text-navy">Show in the homepage review carousel</span>
      </label>
    </div>
  );
}

export default async function ReviewsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { reviews } = await getSiteContent();
  return (
    <>
      <AdminHeader
        title="Reviews"
        intro="Verified customer reviews for the homepage carousel and service pages. Never edit a customer's words; add only real reviews."
      />
      <Notice saved={one(params.saved)} error={one(params.error)} />

      <details className="admin-card mt-6">
        <summary className="cursor-pointer px-5 py-4 font-semibold text-navy">+ Add a review</summary>
        <form action={saveReviewAction} className="border-t border-line p-5">
          <input type="hidden" name="op" value="add" />
          <ReviewFields />
          <button type="submit" className="admin-btn mt-5">
            Add review
          </button>
        </form>
      </details>

      <ul className="mt-4 space-y-3">
        {reviews.map((review, i) => (
          <li key={review.id} className="admin-card">
            <details>
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-5 py-4">
                <span className="inline-flex size-7 items-center justify-center rounded-md bg-soft t-caption font-semibold tabular-nums text-secondary" aria-label={`Position ${i + 1}`}>
                  {i + 1}
                </span>
                <span className="font-semibold text-navy">{review.name}</span>
                <span className="t-small text-secondary">
                  {review.platform}
                  {typeof review.rating === "number" ? ` · ${review.rating}★` : review.rating === "recommends" ? " · Recommends" : ""}
                  {review.branch ? ` · ${review.branch === "sector-11" ? "Sector 11" : "Sector 18"}` : ""}
                </span>
                {review.showOnHome ? <Badge tone="blue">On homepage</Badge> : <Badge>Not on homepage</Badge>}
                {serviceLinks(review.name).map((s) => (
                  <Badge key={s} tone="green">
                    {s} page
                  </Badge>
                ))}
                {review.sourceUrl ? <Badge>Source linked</Badge> : <Badge tone="amber">No source link</Badge>}
                <span className="w-full truncate t-small text-secondary md:ml-auto md:w-auto md:max-w-[40ch]">{review.text}</span>
              </summary>
              <form action={saveReviewAction} className="border-t border-line p-5">
                <input type="hidden" name="id" value={review.id} />
                <ReviewFields review={review} />
                <div className="mt-5 flex flex-wrap gap-2">
                  <button type="submit" name="op" value="save" className="admin-btn">
                    Save
                  </button>
                  <button type="submit" name="op" value="up" disabled={i === 0} className="admin-btn-secondary" formNoValidate>
                    Move up
                  </button>
                  <button type="submit" name="op" value="down" disabled={i === reviews.length - 1} className="admin-btn-secondary" formNoValidate>
                    Move down
                  </button>
                  <button type="submit" name="op" value="delete" className="admin-btn-danger ml-auto" formNoValidate>
                    Delete
                  </button>
                </div>
              </form>
            </details>
          </li>
        ))}
      </ul>
    </>
  );
}
