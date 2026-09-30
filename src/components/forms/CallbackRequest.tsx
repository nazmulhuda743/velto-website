"use client";

import { useState } from "react";
import { track } from "@/components/layout/Analytics";
import type { FormText } from "@/content/i18n/forms/en";
import { format } from "@/lib/i18n/config";
import { bdPhone, callbackOutcome } from "@/lib/booking-recovery";
import { submitCallback, type CallbackFormData } from "./submit";
import { useNightDhaka } from "./useNight";

type Text = FormText["booking"];

/**
 * "Stuck? Get a call back instead": for a visitor who can't or won't finish the booking form.
 * Closed until tapped; nothing is sent until they press "Call me back" (their name and number,
 * plus what they already filled in, as the intro says). Velto calls or WhatsApps once.
 */
export function CallbackRequest({
  t,
  initialName,
  initialPhone,
  context,
  whatsappHref,
  nameError,
  phoneError,
}: {
  t: Text;
  initialName: string;
  initialPhone: string;
  /** What the form holds right now, in English for Velto (area, what, services, time). */
  context: () => Omit<CallbackFormData, "name" | "phone">;
  whatsappHref: string;
  nameError: string;
  phoneError: string;
}) {
  const [open, setOpen] = useState(false);
  const night = useNightDhaka();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [state, setState] = useState<{ kind: "idle" | "sending" | "blocked" } | { kind: "done"; message: string } | { kind: "error"; field?: "name" | "phone" }>({ kind: "idle" });

  if (state.kind === "done") {
    return (
      <p role="status" className="mt-4 rounded-md border border-success/40 bg-success/5 p-3 t-small font-semibold text-navy" data-callback="done">
        {state.message}
      </p>
    );
  }

  if (state.kind === "blocked") {
    return (
      <p role="alert" className="mt-4 rounded-md border border-line-strong bg-soft p-3 t-small font-semibold text-navy" data-callback="blocked">
        {t.callbackBlocked}{" "}
        <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4" data-analytics="whatsapp_click" data-placement="callback_blocked">
          WhatsApp
        </a>
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          // Pick up whatever they typed in the form since.
          setName((v) => v || initialName);
          setPhone((v) => v || initialPhone);
          setOpen(true);
          track("callback_open", { section: "booking-form" });
        }}
        className="mt-4 t-small font-semibold text-navy underline decoration-blue/50 underline-offset-4 hover:decoration-blue"
        data-callback="open"
      >
        {t.callbackOpen}
      </button>
    );
  }

  async function send() {
    const cleanName = name.trim();
    if (cleanName.length < 2) return setState({ kind: "error", field: "name" });
    if (!bdPhone(phone)) return setState({ kind: "error", field: "phone" });
    setState({ kind: "sending" });
    const result = await submitCallback({ name: cleanName, phone, ...context() });
    const outcome = callbackOutcome(result);
    if (outcome === "sent") {
      track("callback_request", { section: "booking-form" });
      setState({ kind: "done", message: format(night ? t.callbackDoneNight : t.callbackDone, { name: cleanName.split(/\s+/)[0] }) });
    } else {
      // Blocked: every request from this number today was already handled, so no call is coming.
      setState({ kind: outcome === "blocked" ? "blocked" : "error" });
    }
  }

  const input = "mt-1 block h-12 w-full rounded-md border border-line-strong bg-white px-3 text-base text-navy";
  const err = state.kind === "error" ? state.field : undefined;
  return (
    // Not a <form>: it sits inside the booking form, and Enter shouldn't submit the booking.
    <div role="group" aria-labelledby="callback-title" className="mt-4 rounded-md border border-line bg-soft/60 p-4" data-callback="panel">
      <p id="callback-title" className="font-semibold text-navy">
        {t.callbackTitle}
      </p>
      <p className="mt-1 t-small text-body">{t.callbackIntro}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block t-small font-semibold text-navy">
          {t.callbackName}
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={100} aria-invalid={err === "name" || undefined} className={input} />
          {err === "name" ? <span className="mt-1 block font-medium text-error">{nameError}</span> : null}
        </label>
        <label className="block t-small font-semibold text-navy">
          {t.callbackPhone}
          <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" maxLength={20} aria-invalid={err === "phone" || undefined} className={input} />
          {err === "phone" ? <span className="mt-1 block font-medium text-error">{phoneError}</span> : null}
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={send}
          disabled={state.kind === "sending"}
          className="inline-flex h-11 items-center justify-center rounded-md bg-navy px-5 font-semibold text-white hover:bg-navy/90 disabled:opacity-60"
        >
          {state.kind === "sending" ? t.callbackSending : t.callbackSubmit}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="t-small font-semibold text-secondary underline underline-offset-4 hover:text-navy">
          {t.callbackCancel}
        </button>
      </div>
      {state.kind === "error" && !err ? (
        <p role="alert" className="mt-3 t-small font-medium text-error">
          {t.callbackFailed}{" "}
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4" data-analytics="whatsapp_click" data-placement="callback_error">
            WhatsApp
          </a>
        </p>
      ) : null}
    </div>
  );
}
