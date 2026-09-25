"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { track } from "@/components/layout/Analytics";
import { ButtonLink, WhatsAppButton } from "@/components/ui/Button";
import { WHATSAPP_URL } from "@/content/site";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { FormText } from "@/content/i18n/forms/en";
import { fill, format, type Locale } from "@/lib/i18n/config";
import { AREA_OPTIONS, FieldShell, OUTSIDE_AREA, SelectField, TextAreaField, TextField, normalisePhone, phoneOk } from "./fields";
import { submitQuote, type QuoteFormData, type SubmitResult } from "./submit";

type QuoteService = QuoteFormData["service"];
type Text = FormText["quote"];
type Common = FormText["common"];

/** Quote services, in display order. The values go to Ops as they are. */
const SERVICE_VALUES: QuoteService[] = ["curtain-cleaning", "carpet-cleaning", "blanket-comforter-cleaning"];

/**
 * An area option as the customer reads it. The option's value (sent to Ops) stays the
 * English label from AREA_OPTIONS; in English the two are the same text.
 */
const areaText = (area: string, t: Text, locale: Locale) => {
  if (area === OUTSIDE_AREA) return t.areaOutside;
  const n = /^Uttara Sector (\d+)$/.exec(area)?.[1];
  return n ? fill(t.areaSector, { n }, locale) : area;
};

/** Matches the Ops contract limit of five photo references. */
const MAX_PHOTOS = 5;

type QuoteDraft = Omit<QuoteFormData, "service"> & { service: QuoteService | "" };

/**
 * Photos can't be uploaded online yet (no controlled upload flow), so every
 * WhatsApp hand-off carries what the customer already typed and asks for the photos there.
 */
function whatsappHref(d: QuoteDraft, t: Text, locale: Locale, reference?: string) {
  const w = t.whatsapp;
  const label = d.service ? t.services[d.service]?.label : undefined;
  const lines = [
    reference ? format(w.greetingRef, { ref: reference }) : w.greeting,
    label ? format(w.service, { v: label }) : "",
    d.area ? format(w.area, { v: areaText(d.area, t, locale) }) : "",
    d.approximateDetails?.trim() ? format(w.details, { v: d.approximateDetails.trim() }) : "",
    d.notes?.trim() ? format(w.notes, { v: d.notes.trim() }) : "",
    d.name.trim() ? format(w.name, { v: d.name.trim() }) : "",
    d.photos.length ? (d.photos.length === 1 ? w.photoOne : fill(w.photoMany, { n: d.photos.length }, locale)) : "",
  ].filter(Boolean);
  return `${WHATSAPP_URL}?text=${encodeURIComponent(lines.join("\n"))}`;
}

type Errors = Partial<Record<"name" | "phone" | "area" | "service" | "photos", string>>;
type Status = { state: "idle" } | { state: "submitting" } | { state: "done"; result: SubmitResult };

export function QuoteForm({
  t,
  common: c,
  initialService,
  preview,
}: {
  /** Form text in the page language (formText(locale).quote), passed by the page. */
  t: Text;
  common: Common;
  initialService?: string;
  preview?: "success" | "error";
}) {
  const locale = useLocale();
  const [data, setData] = useState<QuoteDraft>({
    name: "",
    phone: "",
    area: "",
    service: SERVICE_VALUES.some((v) => v === initialService) ? (initialService as QuoteService) : "",
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
    setErrors((x) => ({ ...x, photos: next.length > MAX_PHOTOS ? fill(t.errors.photosMax, { max: MAX_PHOTOS }, locale) : undefined }));
    setData((d) => ({ ...d, photos: next.slice(0, MAX_PHOTOS) }));
    e.target.value = "";
  };

  const removePhoto = (i: number) => setData((d) => ({ ...d, photos: d.photos.filter((_, j) => j !== i) }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const found: Errors = {};
    if (!data.name.trim()) found.name = t.errors.name;
    if (!data.phone.trim()) found.phone = c.phoneMissing;
    else if (!phoneOk(data.phone)) found.phone = c.phoneInvalid;
    if (!data.area) found.area = t.errors.area;
    if (!data.service) found.service = t.errors.service;
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
        <p className="t-label uppercase text-success">{t.successLabel}</p>
        <h2 className="mt-3 t-h3 text-navy">{t.successTitle}</h2>
        <p className="mt-3 max-w-[52ch] text-body">{t.successBody}</p>
        {done.reference ? (
          <p className="mt-3 text-body">
            {t.referenceBefore}
            <strong className="font-semibold text-navy">{done.reference}</strong>
            {t.referenceAfter}
          </p>
        ) : null}
        {data.photos.length ? (
          <div className="mt-6 rounded-md border border-line-strong bg-soft p-4">
            <p className="font-semibold text-navy">{data.photos.length === 1 ? t.photosTitleOne : t.photosTitleMany}</p>
            <p className="mt-1 t-small text-body">{t.photosBody}</p>
            <WhatsAppButton href={whatsappHref(data, t, locale, done.reference)} placement="quote_success_photos" className="mt-3 w-full md:w-auto">
              {t.sendPhotos}
            </WhatsAppButton>
          </div>
        ) : null}
        <div className="mt-6">
          <ButtonLink href="/" variant="secondary">
            {c.backHome}
          </ButtonLink>
        </div>
      </div>
    );
  }

  const service = data.service ? t.services[data.service] : undefined;
  const errorList = Object.entries(errors).filter(([k, v]) => v && k !== "photos");
  const failed = done && !done.ok ? done : null;
  const labels = t.labels;

  return (
    <form noValidate onSubmit={onSubmit} aria-labelledby="page-title" className="space-y-6">
      {errorList.length ? (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="scroll-mt-28 rounded-md border border-error bg-error-soft p-4 focus:outline-2 focus:outline-error">
          <p className="font-semibold text-error">
            {errorList.length === 1 ? t.summaryOne : fill(t.summaryMany, { n: errorList.length }, locale)}
          </p>
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
          <p className="t-h4 text-navy">{failed.code === "not_connected" ? t.failedNotConnectedTitle : t.failedTitle}</p>
          <p className="mt-2 max-w-[52ch] text-body">
            {failed.code === "not_connected" ? t.failedNotConnectedBody : t.failedBody}
          </p>
          <WhatsAppButton href={whatsappHref(data, t, locale)} placement="quote_error" className="mt-4 w-full md:w-auto">
            {c.sendOnWhatsApp}
          </WhatsAppButton>
        </div>
      ) : null}

      <fieldset>
        <legend className="text-[15px] font-semibold text-navy">{t.legend}</legend>
        <div className="mt-2 grid gap-2 md:grid-cols-3" role="radiogroup" aria-describedby={errors.service ? "service-error" : undefined}>
          {SERVICE_VALUES.map((value) => (
            <label
              key={value}
              className={`flex min-h-[54px] cursor-pointer items-center gap-3 rounded-md border px-4 text-navy transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue ${
                data.service === value ? "border-blue bg-[#f0f7fc] font-semibold" : "border-line-strong hover:border-navy/50"
              }`}
            >
              <input
                id={`service-${value}`}
                type="radio"
                name="service"
                value={value}
                checked={data.service === value}
                onChange={set("service")}
                className="size-4 accent-[#0078bc]"
              />
              {t.services[value].label}
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
        <TextField id="name" label={t.nameLabel} autoComplete="name" value={data.name} onChange={set("name")} error={errors.name} required />
        <TextField
          id="phone"
          label={t.phoneLabel}
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
        label={t.areaLabel}
        value={data.area}
        onChange={set("area")}
        error={errors.area}
        required
        helper={
          data.area === OUTSIDE_AREA ? (
            <span className="text-navy">{t.areaOutsideNote}</span>
          ) : undefined
        }
      >
        <option value="" disabled>
          {t.areaPlaceholder}
        </option>
        {AREA_OPTIONS.map((a) => (
          <option key={a} value={a}>
            {areaText(a, t, locale)}
          </option>
        ))}
      </SelectField>

      <TextAreaField
        id="approximateDetails"
        label={t.detailsLabel}
        helper={service?.detailsHelper ?? t.detailsHelperDefault}
        placeholder={service?.placeholder}
        value={data.approximateDetails}
        onChange={set("approximateDetails")}
      />

      <FieldShell
        id="photos"
        label={t.photosLabel}
        helper={fill(t.photosHelper, { max: MAX_PHOTOS }, locale)}
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
            {data.photos.length ? t.addMorePhotos : t.choosePhotos}
          </button>
          <span className="t-small text-secondary">{fill(t.photosCount, { n: data.photos.length, max: MAX_PHOTOS }, locale)}</span>
        </div>
        {data.photos.length ? (
          <ul className="mt-3 border-t border-line">
            {data.photos.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-4 border-b border-line py-2.5 t-small">
                <span className="truncate text-body">{f.name}</span>
                <button type="button" onClick={() => removePhoto(i)} className="shrink-0 font-semibold text-navy underline underline-offset-2">
                  {t.remove}
                  <span className="sr-only"> {f.name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </FieldShell>

      <TextAreaField
        id="notes"
        label={t.notesLabel}
        optional
        optionalText={c.optional}
        placeholder={t.notesPlaceholder}
        value={data.notes}
        onChange={set("notes")}
      />

      <div className="flex flex-col gap-3 border-t border-line pt-6 md:flex-row md:items-center md:gap-5">
        <button
          type="submit"
          disabled={status.state === "submitting"}
          className="inline-flex h-[52px] shrink-0 items-center justify-center whitespace-nowrap rounded-md bg-action px-7 text-base font-semibold text-white hover:bg-action-hover disabled:bg-disabled-bg disabled:text-disabled-text lg:h-12"
        >
          {status.state === "submitting" ? c.sending : t.submit}
        </button>
        <p className="t-small text-secondary">{t.reassure}</p>
      </div>
    </form>
  );
}
