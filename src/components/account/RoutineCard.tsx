"use client";

import { useActionState, useState } from "react";
import Link from "@/components/i18n/Link";
import { WhatsAppButton } from "@/components/ui/Button";
import type { AccountText } from "@/content/i18n/account";
import { WHATSAPP_URL } from "@/content/site";
import { format } from "@/lib/i18n/config";
import { routineAction, type RoutineState } from "@/lib/customer/routine-actions";
import { ROUTINE_SERVICES, ROUTINE_WINDOWS, type Routine, type RoutineWindow } from "@/lib/routine";

type Text = AccountText["routine"];

/**
 * Routine pickup on the account: ask for "every Saturday, afternoon", then see it requested,
 * running (with the next pickup day), paused or declined, and change, pause, resume or stop it.
 * A manager confirms every request on WhatsApp before it runs (Velto Ops weekly pickups).
 */
export function RoutineCard({
  routine,
  hasAddress,
  t,
  days,
  windows,
  services,
  nextOnLabel,
  suggestedDay,
  suggestedService,
}: {
  routine: Routine | null;
  hasAddress: boolean;
  t: Text;
  /** Full weekday names, Sunday first, in the page language. */
  days: readonly string[];
  windows: Record<RoutineWindow, string>;
  services: Record<string, string>;
  /** The next pickup day, already worded for the page. */
  nextOnLabel: string | null;
  /** Weekday they usually order on, as the default. */
  suggestedDay: number | null;
  /** The service of their last order, when it is one a routine can carry. */
  suggestedService: string | null;
}) {
  const [state, action, pending] = useActionState<RoutineState, FormData>(routineAction, { status: "idle" });
  const [editing, setEditing] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const open = routine && routine.status !== "declined" && routine.status !== "stopped" ? routine : null;
  const showForm = !open || editing;
  const when = open ? { day: days[open.weekday], time: windows[open.window] } : null;

  const title = !open
    ? t.askTitle
    : open.status === "requested"
      ? open.change
        ? t.changeTitle
        : t.requestedTitle
      : open.status === "paused"
        ? t.pausedTitle
        : format(t.activeTitle, when!);
  const body = !open
    ? t.askBody
    : open.status === "requested"
      ? format(open.change ? t.changeBody : t.requestedBody, when!)
      : open.status === "paused"
        ? format(t.pausedBody, when!)
        : t.activeBody;

  const secondary = "inline-flex h-11 items-center justify-center rounded-md border border-line-strong bg-white px-4 text-[15px] font-semibold text-navy hover:border-navy disabled:opacity-50";
  const intent = (name: string, label: string, extra = "") => (
    <form action={action}>
      <input type="hidden" name="intent" value={name} />
      <button type="submit" disabled={pending} className={`${secondary} ${extra}`}>
        {label}
      </button>
    </form>
  );

  return (
    <section aria-labelledby="routine-title" className="rounded-lg border border-line bg-white p-5 md:p-6" data-routine={open?.status ?? "ask"}>
      <p className="t-label uppercase text-action">{t.eyebrow}</p>
      <h2 id="routine-title" className="mt-1.5 text-[20px] font-semibold tracking-[-0.01em] text-navy">
        {title}
      </h2>
      <p className="mt-1.5 max-w-[56ch] t-small text-body">{body}</p>
      {open?.status === "active" && nextOnLabel ? <p className="mt-1 t-small font-semibold text-navy">{format(t.nextOn, { date: nextOnLabel })}</p> : null}
      {!open && routine?.status === "declined" ? (
        <p className="mt-3 rounded-md bg-soft p-3 t-small text-body" data-routine-declined>
          <span className="font-semibold text-navy">{t.declinedTitle}.</span> {format(t.declinedBody, { reason: routine.reason ?? "" }).trim()}
        </p>
      ) : null}

      {!hasAddress && !open ? (
        <p className="mt-4 t-small text-body">
          {t.needAddress}{" "}
          <Link href="/account/profile" className="font-semibold text-navy underline decoration-blue/50 underline-offset-4">
            {t.addAddress}
          </Link>
        </p>
      ) : showForm ? (
        <form action={action} className="mt-4 grid gap-3 sm:grid-cols-[repeat(3,minmax(0,1fr))] sm:items-end" onSubmit={() => setEditing(false)}>
          <input type="hidden" name="intent" value="request" />
          <label className="block t-small font-semibold text-navy">
            {t.day}
            <select name="weekday" defaultValue={String(open?.weekday ?? suggestedDay ?? 6)} className="mt-1 block h-11 w-full rounded-md border border-line-strong bg-white px-3 text-navy">
              {days.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="block t-small font-semibold text-navy">
            {t.time}
            <select name="window" defaultValue={open?.window ?? "afternoon"} className="mt-1 block h-11 w-full rounded-md border border-line-strong bg-white px-3 text-navy">
              {ROUTINE_WINDOWS.map((w) => (
                <option key={w} value={w}>
                  {windows[w]}
                </option>
              ))}
            </select>
          </label>
          <label className="block t-small font-semibold text-navy">
            {t.service}
            <select name="service" defaultValue={open ? (open.service ?? "") : (suggestedService ?? "")} className="mt-1 block h-11 w-full rounded-md border border-line-strong bg-white px-3 text-navy">
              <option value="">{t.serviceAny}</option>
              {ROUTINE_SERVICES.map((s) => (
                <option key={s} value={s}>
                  {services[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="block t-small font-semibold text-navy sm:col-span-3">
            {t.note}
            <input name="note" maxLength={300} defaultValue={open?.note ?? ""} className="mt-1 block h-11 w-full rounded-md border border-line-strong bg-white px-3 font-normal text-navy" />
          </label>
          <div className="flex flex-wrap gap-3 sm:col-span-3">
            <button type="submit" disabled={pending} className="inline-flex h-11 items-center justify-center rounded-md bg-action px-5 font-semibold text-white hover:bg-action-hover disabled:opacity-50">
              {open ? t.requestChange : t.request}
            </button>
            {editing ? (
              <button type="button" onClick={() => setEditing(false)} className={secondary}>
                {t.cancel}
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={() => setEditing(true)} className={secondary}>
            {t.change}
          </button>
          {open.status === "active" ? intent("pause", t.pause) : null}
          {open.status === "paused" ? intent("resume", t.resume) : null}
          {open.status === "requested" && !open.change ? intent("pause", t.withdraw) : null}
          {open.status === "active" || open.status === "paused" ? (
            confirmStop ? (
              <div className="flex w-full flex-wrap items-center gap-3 rounded-md bg-soft p-3">
                <p className="t-small text-body">{t.stopConfirm}</p>
                {intent("stop", t.stop, "!border-error !text-error")}
                <button type="button" onClick={() => setConfirmStop(false)} className={secondary}>
                  {t.cancel}
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmStop(true)} className={`${secondary} !border-transparent !px-2 text-secondary underline underline-offset-4`}>
                {t.stop}
              </button>
            )
          ) : null}
          <WhatsAppButton href={`${WHATSAPP_URL}?text=${encodeURIComponent(format(t.whatsappText, when!))}`} placement="account_routine" className="!h-11 !px-4">
            WhatsApp
          </WhatsAppButton>
        </div>
      )}

      {state.status === "error" ? (
        <p role="alert" className="mt-3 t-small font-semibold text-error">
          {state.code === "address" ? t.needAddress : t.failed}
        </p>
      ) : null}
    </section>
  );
}
