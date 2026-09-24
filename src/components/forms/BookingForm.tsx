"use client";

import { useRef, useState, type FormEvent } from "react";
import { track } from "@/components/layout/Analytics";
import { ButtonLink, WhatsAppButton } from "@/components/ui/Button";
import { WHATSAPP_URL } from "@/content/site";
import { AREA_OPTIONS, OUTSIDE_AREA, SelectField, TextAreaField, TextField } from "./fields";
import { submitBooking, type BookingFormData, type SubmitResult } from "./submit";

/** Booking service options, matching the Ops contract service slugs. */
export const BOOKING_SERVICES = [
  { value: "dry-cleaning", label: "Dry Cleaning" },
  { value: "wash-and-iron", label: "Wash & Iron" },
  { value: "ironing", label: "Ironing" },
  { value: "curtain-cleaning", label: "Curtain Cleaning" },
  { value: "carpet-cleaning", label: "Carpet Cleaning" },
  { value: "blanket-comforter-cleaning", label: "Blankets & Comforters" },
];

type Errors = Partial<Record<keyof BookingFormData, string>>;
type Status = { state: "idle" } | { state: "submitting" } | { state: "done"; result: SubmitResult };

const PHONE = /^\+?[\d\s-]{10,16}$/;

function validate(d: BookingFormData): Errors {
  const e: Errors = {};
  if (!d.name.trim()) e.name = "Enter your name.";
  if (!d.phone.trim()) e.phone = "Enter a phone or WhatsApp number.";
  else if (!PHONE.test(d.phone.trim())) e.phone = "Enter a valid phone number, for example 01XXXXXXXXX.";
  if (!d.area) e.area = "Choose your area.";
  if (!d.address.trim()) e.address = "Enter the pickup address.";
  return e;
}

const LABELS: Record<string, string> = { name: "Name", phone: "Phone", area: "Area", address: "Address" };

export function BookingForm({
  initialService,
  regular = false,
  preview,
}: {
  initialService?: string;
  /** Came from "Set Up Regular Pickup": prefill the note (no separate contract field). */
  regular?: boolean;
  /** Development-only state preview (?preview=success|error). */
  preview?: "success" | "error";
}) {
  const [data, setData] = useState<BookingFormData>({
    name: "",
    phone: "",
    area: "",
    address: "",
    preferredPickup: "",
    service: BOOKING_SERVICES.some((s) => s.value === initialService) ? initialService : "",
    notes: regular ? "I'd like to set up a regular pickup." : "",
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

  const set = (key: keyof BookingFormData) => (e: { target: { value: string } }) => {
    if (!started.current) {
      started.current = true;
      track("booking_start", { section: "booking-form" });
    }
    setData((d) => ({ ...d, [key]: e.target.value }));
    if (errors[key]) setErrors((x) => ({ ...x, [key]: undefined }));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validate(data);
    setErrors(found);
    if (Object.keys(found).length) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setStatus({ state: "submitting" });
    const result = await submitBooking(data);
    if (result.ok) track("booking_success", { service: data.service || undefined });
    setStatus({ state: "done", result });
  };

  if (status.state === "done" && status.result.ok) {
    return (
      <div role="status" className="border-t-2 border-success pt-6">
        <p className="t-label uppercase text-success">Booking received</p>
        <h2 className="mt-3 t-h3 text-navy">Thanks. Your pickup request is in.</h2>
        <p className="mt-3 max-w-[48ch] text-body">
          The Velto team will contact you to confirm the pickup. Your reference is{" "}
          <strong className="font-semibold text-navy">{status.result.reference}</strong>.
        </p>
        <div className="mt-6">
          <ButtonLink href="/" variant="secondary">
            Back to the homepage
          </ButtonLink>
        </div>
      </div>
    );
  }

  const errorList = Object.entries(errors).filter(([, v]) => v);
  const failed = status.state === "done" && !status.result.ok ? status.result : null;

  return (
    <form noValidate onSubmit={onSubmit} aria-labelledby="page-title" className="space-y-6">
      {errorList.length ? (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="scroll-mt-28 rounded-md border border-error bg-error-soft p-4 focus:outline-2 focus:outline-error">
          <p className="font-semibold text-error">Please check {errorList.length === 1 ? "one field" : `${errorList.length} fields`}:</p>
          <ul className="mt-2 space-y-1 t-small">
            {errorList.map(([k, v]) => (
              <li key={k}>
                <a href={`#${k}`} className="text-error underline underline-offset-2">
                  {LABELS[k]}: {v}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {failed ? (
        <div role="alert" className="rounded-md border border-line-strong bg-soft p-5">
          <p className="t-h4 text-navy">
            {failed.code === "not_connected" ? "Online booking isn't connected yet." : "Your booking couldn't be sent right now."}
          </p>
          <p className="mt-2 max-w-[52ch] text-body">
            {failed.code === "not_connected"
              ? "Your details have not been sent. Message Velto on WhatsApp to book your pickup now."
              : "Please try again, or message Velto on WhatsApp and we will book it for you."}
          </p>
          <WhatsAppButton href={WHATSAPP_URL} placement="booking_error" className="mt-4" />
        </div>
      ) : null}

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
              Pickup outside Uttara Sectors 1–18 isn&apos;t automatically available. Ask us on WhatsApp before booking.
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

      <TextField
        id="address"
        label="Pickup address"
        helper="House, road and sector."
        autoComplete="street-address"
        value={data.address}
        onChange={set("address")}
        error={errors.address}
        required
      />

      <div className="grid gap-6 md:grid-cols-2 md:gap-5">
        <SelectField id="service" label="What do you need cleaned?" optional value={data.service} onChange={set("service")}>
          <option value="">Not sure, or a mix</option>
          {BOOKING_SERVICES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </SelectField>
        <TextField
          id="preferredPickup"
          label="Preferred pickup time"
          optional
          placeholder="For example: tomorrow after 5 PM"
          value={data.preferredPickup}
          onChange={set("preferredPickup")}
        />
      </div>

      <TextAreaField
        id="notes"
        label="Notes"
        optional
        helper="Anything we should know, such as a garment that needs a closer look."
        value={data.notes}
        onChange={set("notes")}
      />

      <div className="flex flex-col gap-3 border-t border-line pt-6 md:flex-row md:items-center md:gap-5">
        <button
          type="submit"
          disabled={status.state === "submitting"}
          className="inline-flex h-[52px] shrink-0 items-center justify-center whitespace-nowrap rounded-md bg-action px-7 text-base font-semibold text-white hover:bg-action-hover disabled:bg-disabled-bg disabled:text-disabled-text lg:h-12"
        >
          {status.state === "submitting" ? "Sending…" : "Book a Pickup"}
        </button>
        <p className="t-small text-secondary">Orders of ৳499+ qualify for free pickup and delivery.</p>
      </div>
    </form>
  );
}
