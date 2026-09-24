"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { track } from "@/components/layout/Analytics";
import { ButtonLink, WhatsAppButton } from "@/components/ui/Button";
import { WHATSAPP_URL } from "@/content/site";
import { AREA_OPTIONS, FieldShell, OUTSIDE_AREA, SelectField, TextAreaField, TextField, normalisePhone, phoneOk } from "./fields";
import { submitQuote, type QuoteFormData, type SubmitResult } from "./submit";

type QuoteService = QuoteFormData["service"];

const SERVICES: { value: QuoteService; label: string; detailsHelper: string; placeholder: string }[] = [
  {
    value: "curtain-cleaning",
    label: "Curtains",
    detailsHelper: "How many curtains or panels, and their approximate length and width.",
    placeholder: "For example: 4 panels, about 7 ft long",
  },
  {
    value: "carpet-cleaning",
    label: "Carpets",
    detailsHelper: "The approximate length and width, and the material if you know it.",
    placeholder: "For example: 6 ft × 9 ft, wool",
  },
  {
    value: "blanket-comforter-cleaning",
    label: "Blankets & comforters",
    detailsHelper: "The items, their type and size.",
    placeholder: "For example: 1 king-size comforter, 2 blankets",
  },
];

/** Matches the Ops contract limit of five photo references. */
const MAX_PHOTOS = 5;

type QuoteDraft = Omit<QuoteFormData, "service"> & { service: QuoteService | "" };

/**
 * Photos can't be uploaded online yet (no controlled upload flow), so every
 * WhatsApp hand-off carries what the customer already typed and asks for the photos there.
 */
function whatsappHref(d: QuoteDraft, reference?: string) {
  const label = SERVICES.find((s) => s.value === d.service)?.label;
  const lines = [
    reference ? `Hi Velto, I sent a quote request (reference ${reference}).` : "Hi Velto, I'd like a quote.",
    label ? `Service: ${label}` : "",
    d.area ? `Area: ${d.area}` : "",
    d.approximateDetails?.trim() ? `Details: ${d.approximateDetails.trim()}` : "",
    d.notes?.trim() ? `Notes: ${d.notes.trim()}` : "",
    d.name.trim() ? `Name: ${d.name.trim()}` : "",
    d.photos.length ? `I'll send ${d.photos.length === 1 ? "a photo" : `${d.photos.length} photos`} here.` : "",
  ].filter(Boolean);
  return `${WHATSAPP_URL}?text=${encodeURIComponent(lines.join("\n"))}`;
}

type Errors = Partial<Record<"name" | "phone" | "area" | "service" | "photos", string>>;
type Status = { state: "idle" } | { state: "submitting" } | { state: "done"; result: SubmitResult };

export function QuoteForm({ initialService, preview }: { initialService?: string; preview?: "success" | "error" }) {
  const [data, setData] = useState<QuoteDraft>({
    name: "",
    phone: "",
    area: "",
    service: SERVICES.some((s) => s.value === initialService) ? (initialService as QuoteService) : "",
    approximateDetails: "",
    notes: "",
    photos: [],
  });
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>(
    preview === "success"
      ? { state: "done", result: { ok: true, reference: "PREVIEW-0000" } }
      : preview === "error"
        ? { state: "done", result: { ok: false, code: "unavailable" } }
        : { state: "idle" },
  );
  const started = useRef(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const failedRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const done = status.state === "done" ? status.result : null;
  useEffect(() => {
    if (!done || preview) return;
    const el = done.ok ? successRef.current : failedRef.current;
    el?.scrollIntoView({ block: "center" });
    el?.focus({ preventScroll: true });
  }, [done, preview]);

  const markStarted = () => {
    if (!started.current) {
      started.current = true;
      track("quote_start", { section: "quote-form" });
    }
  };

  const set = (key: "name" | "phone" | "area" | "approximateDetails" | "notes" | "service") =>
    (e: { target: { value: string } }) => {
      if (!started.current) {
        started.current = true;
        track("quote_start", { section: "quote-form" });
      }
      setData((d) => ({ ...d, [key]: e.target.value }));
      if (key in errors) setErrors((x) => ({ ...x, [key]: undefined }));
    };

  const addPhotos = (e: ChangeEvent<HTMLInputElement>) => {
    markStarted();
    const picked = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
    const next = [...data.photos, ...picked];
    setErrors((x) => ({ ...x, photos: next.length > MAX_PHOTOS ? `You can add up to ${MAX_PHOTOS} photos.` : undefined }));
    setData((d) => ({ ...d, photos: next.slice(0, MAX_PHOTOS) }));
    e.target.value = "";
  };

  const removePhoto = (i: number) => setData((d) => ({ ...d, photos: d.photos.filter((_, j) => j !== i) }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const found: Errors = {};
    if (!data.name.trim()) found.name = "Enter your name.";
    if (!data.phone.trim()) found.phone = "Add a number we can call or WhatsApp.";
    else if (!phoneOk(data.phone)) found.phone = "Check the number. It should look like 01XXX XXXXXX.";
    if (!data.area) found.area = "Choose your area.";
    if (!data.service) found.service = "Choose what you need cleaned.";
    setErrors(found);
    if (Object.keys(found).length) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setStatus({ state: "submitting" });
    const result = await submitQuote({ ...data, phone: normalisePhone(data.phone), service: data.service as QuoteService });
    if (result.ok) track("quote_success", { service: data.service });
    setStatus({ state: "done", result });
  };

  if (done?.ok) {
    return (
      <div ref={successRef} tabIndex={-1} role="status" className="scroll-mt-28 border-t-2 border-success pt-6 focus:outline-none">
        <p className="t-label uppercase text-success">Quote request received</p>
        <h2 className="mt-3 t-h3 text-navy">Thanks. We&apos;ll call or WhatsApp you with a price.</h2>
        <p className="mt-3 max-w-[52ch] text-body">
          We work it out from Velto&apos;s current pricing and your details. Where size, material or condition
          needs checking, we confirm the final amount before pickup. Nothing is booked until you agree.
        </p>
        {done.reference ? (
          <p className="mt-3 text-body">
            Your reference is <strong className="font-semibold text-navy">{done.reference}</strong>.
          </p>
        ) : null}
        {data.photos.length ? (
          <div className="mt-6 rounded-md border border-line-strong bg-soft p-4">
            <p className="font-semibold text-navy">One more step: send your {data.photos.length === 1 ? "photo" : "photos"}</p>
            <p className="mt-1 t-small text-body">
              Photos can&apos;t be uploaded online yet. Send them on WhatsApp and we&apos;ll add them to your request.
            </p>
            <WhatsAppButton href={whatsappHref(data, done.reference)} placement="quote_success_photos" className="mt-3 w-full md:w-auto">
              Send Photos on WhatsApp
            </WhatsAppButton>
          </div>
        ) : null}
        <div className="mt-6">
          <ButtonLink href="/" variant="secondary">
            Back to the homepage
          </ButtonLink>
        </div>
      </div>
    );
  }

  const service = SERVICES.find((s) => s.value === data.service);
  const errorList = Object.entries(errors).filter(([k, v]) => v && k !== "photos");
  const failed = done && !done.ok ? done : null;
  const labels: Record<string, string> = { name: "Name", phone: "Phone", area: "Area", service: "Service" };

  return (
    <form noValidate onSubmit={onSubmit} aria-labelledby="page-title" className="space-y-6">
      {errorList.length ? (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="scroll-mt-28 rounded-md border border-error bg-error-soft p-4 focus:outline-2 focus:outline-error">
          <p className="font-semibold text-error">Please check {errorList.length === 1 ? "one field" : `${errorList.length} fields`}:</p>
          <ul className="mt-2 space-y-1 t-small">
            {errorList.map(([k, v]) => (
              <li key={k}>
                <a href={k === "service" ? "#service-curtain-cleaning" : `#${k}`} className="text-error underline underline-offset-2">
                  {labels[k]}: {v}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {failed ? (
        <div ref={failedRef} tabIndex={-1} role="alert" className="scroll-mt-28 rounded-md border border-line-strong bg-soft p-5 focus:outline-2 focus:outline-blue">
          <p className="t-h4 text-navy">
            {failed.code === "not_connected" ? "Online quotes aren't switched on yet." : "We couldn't send your request just now."}
          </p>
          <p className="mt-2 max-w-[52ch] text-body">
            {failed.code === "not_connected"
              ? "Nothing was sent. Send the same details on WhatsApp instead. They're already filled in, and you can add photos there."
              : "Nothing is lost. Try again, or send the same details and any photos on WhatsApp."}
          </p>
          <WhatsAppButton href={whatsappHref(data)} placement="quote_error" className="mt-4 w-full md:w-auto">
            Send on WhatsApp
          </WhatsAppButton>
        </div>
      ) : null}

      <fieldset>
        <legend className="text-[15px] font-semibold text-navy">What do you need cleaned?</legend>
        <div className="mt-2 grid gap-2 md:grid-cols-3" role="radiogroup" aria-describedby={errors.service ? "service-error" : undefined}>
          {SERVICES.map((s) => (
            <label
              key={s.value}
              className={`flex min-h-[54px] cursor-pointer items-center gap-3 rounded-md border px-4 text-navy transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue ${
                data.service === s.value ? "border-blue bg-[#f0f7fc] font-semibold" : "border-line-strong hover:border-navy/50"
              }`}
            >
              <input
                id={`service-${s.value}`}
                type="radio"
                name="service"
                value={s.value}
                checked={data.service === s.value}
                onChange={set("service")}
                className="size-4 accent-[#0078bc]"
              />
              {s.label}
            </label>
          ))}
        </div>
        {errors.service ? (
          <p id="service-error" className="mt-2 flex items-start gap-2 t-small font-medium text-error">
            <span aria-hidden="true">!</span>
            {errors.service}
          </p>
        ) : null}
      </fieldset>

      <div className="grid gap-6 md:grid-cols-2 md:gap-5">
        <TextField id="name" label="Name" autoComplete="name" value={data.name} onChange={set("name")} error={errors.name} required />
        <TextField
          id="phone"
          label="Phone or WhatsApp number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={data.phone}
          onChange={set("phone")}
          error={errors.phone}
          required
        />
      </div>

      <SelectField
        id="area"
        label="Area"
        value={data.area}
        onChange={set("area")}
        error={errors.area}
        required
        helper={
          data.area === OUTSIDE_AREA ? (
            <span className="text-navy">
              Pickup outside Uttara Sectors 1–18 isn&apos;t automatically available. We&apos;ll let you know what&apos;s possible.
            </span>
          ) : undefined
        }
      >
        <option value="" disabled>
          Choose your sector
        </option>
        {AREA_OPTIONS.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </SelectField>

      <TextAreaField
        id="approximateDetails"
        label="Approximate quantity or dimensions"
        helper={service?.detailsHelper ?? "Roughly how many, and their size."}
        placeholder={service?.placeholder}
        value={data.approximateDetails}
        onChange={set("approximateDetails")}
      />

      <FieldShell
        id="photos"
        label="Add photos, optional"
        helper={`Up to ${MAX_PHOTOS}. Helpful when size, material or condition matters. After you send the request, we'll ask you to share them on WhatsApp.`}
        error={errors.photos}
      >
        <input
          ref={fileRef}
          id="photos"
          type="file"
          accept="image/*"
          multiple
          onChange={addPhotos}
          className="sr-only"
          aria-describedby="photos-help"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={data.photos.length >= MAX_PHOTOS}
            className="inline-flex h-12 items-center rounded-md border border-dashed border-line-strong bg-white px-5 font-semibold text-navy hover:border-navy disabled:text-disabled-text"
          >
            {data.photos.length ? "Add more photos" : "Choose photos"}
          </button>
          <span className="t-small text-secondary">
            {data.photos.length}/{MAX_PHOTOS} added
          </span>
        </div>
        {data.photos.length ? (
          <ul className="mt-3 border-t border-line">
            {data.photos.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-4 border-b border-line py-2.5 t-small">
                <span className="truncate text-body">{f.name}</span>
                <button type="button" onClick={() => removePhoto(i)} className="shrink-0 font-semibold text-navy underline underline-offset-2">
                  Remove<span className="sr-only"> {f.name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </FieldShell>

      <TextAreaField
        id="notes"
        label="Condition or notes"
        optional
        placeholder="For example: pet stains on one corner, or lined curtains with hooks"
        value={data.notes}
        onChange={set("notes")}
      />

      <div className="flex flex-col gap-3 border-t border-line pt-6 md:flex-row md:items-center md:gap-5">
        <button
          type="submit"
          disabled={status.state === "submitting"}
          className="inline-flex h-[52px] shrink-0 items-center justify-center whitespace-nowrap rounded-md bg-action px-7 text-base font-semibold text-white hover:bg-action-hover disabled:bg-disabled-bg disabled:text-disabled-text lg:h-12"
        >
          {status.state === "submitting" ? "Sending…" : "Request a Quote"}
        </button>
        <p className="t-small text-secondary">Nothing to pay now. We confirm the price with you before pickup.</p>
      </div>
    </form>
  );
}
