"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/components/layout/Analytics";
import { SelectField, TextAreaField, TextField, RequiredMark, phoneOk } from "@/components/forms/fields";
import { submissionAttribution } from "@/lib/attribution-client";
import type { B999Text } from "@/content/i18n/b999";
import { localDigits, type Locale } from "@/lib/i18n/config";
import { B999, b999WhatsApp } from "@/lib/campaigns/b999";
import { dayLabel } from "./day-label";
import { waHref } from "./wa";

type Field = "name" | "phone" | "sector" | "address" | "date";
type Done = { reference: string; pickupDate: string; address: string };

const KEY_STORE = "velto_b999_key";
const DONE_STORE = "velto_b999_done";
const START_STORE = "velto_b999_started";
/** The Meta/GA service for this page (lib/meta-pixel/events.ts maps it to blanket_cleaning). */
const SERVICE = "blanket-comforter-cleaning";

const read = (k: string) => {
  try {
    return sessionStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    sessionStorage.setItem(k, v);
  } catch {
    // Private mode: the in-memory key still prevents a double submit on this page.
  }
};
const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}-b999`);

function WhatsAppLink({ text, placement, children, className = "" }: { text: string; placement: string; children: React.ReactNode; className?: string }) {
  return (
    <a
      href={waHref(text)}
      target="_blank"
      rel="noopener noreferrer"
      data-analytics="whatsapp_click"
      data-placement={placement}
      data-service={SERVICE}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-whatsapp/40 bg-white px-5 font-semibold text-navy hover:border-whatsapp ${className}`}
    >
      {children}
    </a>
  );
}

/**
 * The locked B999 booking: five fields, no service, item, quantity, price or coupon. The server
 * fixes the package (src/app/api/b999). One idempotency key per browser session, so a reload or a
 * second tap can never create a second booking; the saved booking is shown again instead.
 */
export function B999Form({
  t,
  locale,
  initialDays,
  tomorrow,
  preview = false,
}: {
  t: B999Text;
  locale: Locale;
  initialDays: string[];
  tomorrow: string | null;
  /** Local design review only: no request is sent. */
  preview?: boolean;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sector, setSector] = useState("");
  const [address, setAddress] = useState("");
  const [date, setDate] = useState("");
  const [days, setDays] = useState(initialDays);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const sendingRef = useRef(false);
  const doneRef = useRef<HTMLDivElement>(null);
  const fill = (s: string) => s.replace("{package}", localDigits(B999.packagePrice, locale)).replace("{heavy}", localDigits(B999.heavyPrice, locale));

  // A booking already made in this session (reload): show it, never book again.
  useEffect(() => {
    const saved = read(DONE_STORE);
    if (!saved) return;
    try {
      const d = JSON.parse(saved) as Done;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring this session's saved booking once on load
      if (d?.reference) setDone(d);
    } catch {
      // ignore a damaged value
    }
  }, []);

  // InitiateCheckout: the first real interaction with the form, once per session.
  const started = () => {
    if (read(START_STORE)) return;
    write(START_STORE, "1");
    track("booking_start", { service: SERVICE, placement: "b999_form" });
  };

  const outside = sector === "outside";

  const validate = () => {
    const e: Partial<Record<Field, string>> = {};
    if (name.trim().length < 2) e.name = t.errors.name;
    if (!phoneOk(phone)) e.phone = t.errors.phone;
    if (!sector) e.sector = t.errors.sector;
    if (address.trim().length < 5) e.address = t.errors.address;
    if (!date || !days.includes(date)) e.date = t.errors.date;
    return e;
  };

  const refreshDays = async () => {
    try {
      const r = await fetch("/api/b999/days", { cache: "no-store" });
      const j = (await r.json()) as { days?: string[] };
      if (Array.isArray(j.days)) {
        setDays(j.days);
        if (!j.days.includes(date)) setDate("");
      }
    } catch {
      // keep the list we have
    }
  };

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (sendingRef.current || done || outside) return;
    started();
    setFailure(null);
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      document.getElementById(Object.keys(e)[0])?.focus();
      return;
    }
    sendingRef.current = true;
    setSending(true);
    try {
      let result: { ok: boolean; reference?: string; pickupDate?: string; error?: string; field?: Field };
      if (preview) {
        result = { ok: true, reference: "WEB-PREVIEW1", pickupDate: date };
      } else {
        let key = read(KEY_STORE);
        if (!key) {
          key = newKey();
          write(KEY_STORE, key);
        }
        const res = await fetch("/api/b999", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idempotencyKey: key, data: { name, phone, sector: Number(sector), address, pickupDate: date, attribution: submissionAttribution() } }),
        });
        result = await res.json().catch(() => ({ ok: false, error: "unavailable" }));
      }
      if (result.ok && result.reference) {
        const d: Done = { reference: result.reference, pickupDate: result.pickupDate ?? date, address: address.trim() };
        write(DONE_STORE, JSON.stringify(d));
        // Lead: once, only after the booking is saved.
        if (read(`velto_b999_lead_${d.reference}`) !== "1") {
          write(`velto_b999_lead_${d.reference}`, "1");
          track("booking_success", { service: SERVICE, placement: "b999" });
        }
        setDone(d);
        requestAnimationFrame(() => doneRef.current?.focus());
        return;
      }
      if (result.error === "day_full") {
        setErrors({ date: t.errors.day_full });
        await refreshDays();
        // A new key: the next try is a new booking request (the full one was never saved).
        write(KEY_STORE, newKey());
      } else if (result.error === "invalid" && result.field) {
        setErrors({ [result.field]: t.errors[result.field] });
        write(KEY_STORE, newKey());
      } else if (result.error === "outside_area") {
        setSector("outside");
      } else {
        setFailure(result.error === "rate_limited" ? t.errors.rate_limited : result.error === "closed" ? t.errors.closed : t.errors.unavailable);
      }
    } catch {
      setFailure(t.errors.unavailable);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  if (done) {
    return (
      <div ref={doneRef} tabIndex={-1} role="status" className="scroll-mt-28 border-t-2 border-success pt-6 focus:outline-none" data-b999-success>
        <h2 className="t-h3 text-navy">{t.successTitle}</h2>
        <p className="mt-2 text-body">{t.successBody}</p>
        <dl className="mt-5 divide-y divide-line border-y border-line">
          {[
            [t.successRef, done.reference],
            [t.summaryItems, `৳${localDigits(B999.packagePrice, locale)}`],
            [t.successAddress, done.address],
            [t.successDate, dayLabel(done.pickupDate, t, locale, tomorrow)],
            [t.summaryPay, t.details[1][1]],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-3">
              <dt className="text-secondary">{k}</dt>
              <dd className="font-semibold text-navy [overflow-wrap:anywhere]">{v}</dd>
            </div>
          ))}
        </dl>
        <WhatsAppLink text={b999WhatsApp.booked(done.reference)} placement="b999_success" className="mt-6 w-full sm:w-auto">
          {t.continueWhatsapp}
        </WhatsAppLink>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} onFocus={started} className="space-y-5" data-b999-form aria-labelledby="b999-form-title">
      <h2 id="b999-form-title" className="t-h3 text-navy">
        {t.formTitle}
      </h2>
      {failure ? (
        <div role="alert" className="rounded-md border border-line-strong bg-soft p-4">
          <p className="font-medium text-navy">{failure}</p>
          <WhatsAppLink text={b999WhatsApp.check} placement="b999_error" className="mt-3">
            {t.whatsappUs}
          </WhatsAppLink>
        </div>
      ) : null}
      <TextField id="name" label={t.name} required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} maxLength={100} />
      <TextField
        id="phone"
        label={t.phone}
        required
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        helper={t.phoneHint}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        error={errors.phone}
        maxLength={20}
      />
      <SelectField id="sector" label={t.sector} required value={sector} onChange={(e) => setSector(e.target.value)} error={errors.sector}>
        <option value="">{t.sectorPlaceholder}</option>
        {B999.sectors.map((n) => (
          <option key={n} value={String(n)}>
            {t.sectorOption.replace("{n}", localDigits(n, locale))}
          </option>
        ))}
        <option value="outside">{t.outside}</option>
      </SelectField>

      {outside ? (
        <div className="rounded-md border border-line-strong bg-soft p-5" data-b999-outside>
          <p className="font-semibold text-navy">{t.outsideTitle}</p>
          <p className="mt-1 text-body">{t.outsideBody}</p>
          <WhatsAppLink text={b999WhatsApp.outside} placement="b999_outside" className="mt-4 w-full sm:w-auto">
            {t.whatsappUs}
          </WhatsAppLink>
        </div>
      ) : (
        <>
          <TextAreaField id="address" label={t.address} required helper={t.addressHint} autoComplete="street-address" value={address} onChange={(e) => setAddress(e.target.value)} error={errors.address} maxLength={500} />
          <fieldset aria-describedby={errors.date ? "date-error" : "date-help"}>
            <legend className="block text-[15px] font-semibold text-navy">
              {t.date}
              <RequiredMark />
            </legend>
            <p id="date-help" className="mt-1 t-small text-secondary">
              {t.dateHint}
            </p>
            {days.length ? (
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" id="date" tabIndex={-1}>
                {days.map((d) => (
                  <label
                    key={d}
                    className={`flex min-h-12 cursor-pointer items-center justify-center rounded-md border px-3 text-center t-small font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue ${
                      date === d ? "border-action bg-[#e8f3fb] text-navy" : "border-line-strong bg-white text-navy hover:border-navy/50"
                    }`}
                  >
                    <input type="radio" name="pickupDate" value={d} checked={date === d} onChange={() => setDate(d)} className="sr-only" />
                    {dayLabel(d, t, locale, tomorrow)}
                  </label>
                ))}
              </div>
            ) : (
              <div className="mt-2 rounded-md border border-line-strong bg-soft p-4">
                <p className="text-body">{t.noDays}</p>
                <WhatsAppLink text={b999WhatsApp.check} placement="b999_no_days" className="mt-3">
                  {t.whatsappUs}
                </WhatsAppLink>
              </div>
            )}
            {errors.date ? (
              <p id="date-error" className="mt-2 flex items-start gap-2 t-small font-medium text-error">
                <span aria-hidden="true">!</span>
                {errors.date}
              </p>
            ) : null}
          </fieldset>
          <button
            type="submit"
            disabled={sending || !days.length}
            className="inline-flex min-h-[56px] w-full items-center justify-center rounded-md bg-action px-6 text-[17px] font-semibold text-white hover:bg-action-hover disabled:opacity-60"
            data-b999-submit
          >
            {sending ? t.sending : fill(t.submit)}
          </button>
          <p className="t-small text-secondary" data-b999-under-submit>
            {t.underSubmit}
          </p>
        </>
      )}
    </form>
  );
}
