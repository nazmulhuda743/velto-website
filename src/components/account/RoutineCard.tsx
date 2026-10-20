"use client";

import { useActionState, useState } from "react";
import Link from "@/components/i18n/Link";
import { WhatsAppButton } from "@/components/ui/Button";
import { track } from "@/components/layout/Analytics";
import type { AccountText } from "@/content/i18n/account";
import { WHATSAPP_URL } from "@/content/site";
import { format } from "@/lib/i18n/config";
import { routineAction, type RoutineState } from "@/lib/customer/routine-actions";
import { ROUTINE_SERVICES, ROUTINE_WINDOWS, type Routine, type RoutineWindow } from "@/lib/routine";
import { customerRoutes, type AppBase } from "@/lib/app-routes";

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
  base = "/account",
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
  base?: AppBase;
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

  // In the installed app (base "/app") it wears the app's shapes: 12 px corners, 1.5 px borders, 52 px rows.
  const app = base === "/app";
  const secondary = app
    ? "inline-flex min-h-12 items-center justify-center rounded-xl border-[1.5px] border-line-strong bg-app-card px-4 a-body font-semibold text-navy disabled:opacity-50"
    : "inline-flex h-11 items-center justify-center rounded-md border border-line-strong bg-white px-4 text-[15px] font-semibold text-navy hover:border-navy disabled:opacity-50";
  const field = app
    ? "mt-1.5 block h-13 w-full rounded-xl border-[1.5px] border-line-strong bg-app-card px-4 a-row font-normal text-navy"
    : "mt-1 block h-11 w-full rounded-md border border-line-strong bg-white px-3 text-navy";
  const primary = app
    ? "inline-flex min-h-13 w-full items-center justify-center rounded-xl bg-action px-5 a-row font-semibold text-white active:bg-action-active disabled:opacity-50"
    : "inline-flex h-11 items-center justify-center rounded-md bg-action px-5 font-semibold text-white hover:bg-action-hover disabled:opacity-50";
  const label = app ? "block a-sec font-semibold text-navy" : "block t-small font-semibold text-navy";
  // routine_change: request, change, pause, resume, withdraw or stop (the app report counts adoption).
  const placement = app ? "app_profile_weekly" : "account_routine";
  const changed = (detail: string) => track("routine_change", { placement, detail });
  const intent = (name: string, text: string, extra = "") => (
    <form action={action} onSubmit={() => changed(name === "pause" && open?.status === "requested" ? "withdraw" : name)}>
      <input type="hidden" name="intent" value={name} />
      <button type="submit" disabled={pending} className={`${secondary} ${extra}`}>
        {text}
      </button>
    </form>
  );

  return (
    <section
      aria-labelledby="routine-title"
      className={app ? "rounded-2xl border border-line bg-app-card p-4" : "rounded-lg border border-line bg-white p-5 md:p-6"}
      data-routine={open?.status ?? "ask"}
    >
      <p className={app ? "a-eyebrow text-action" : "t-label uppercase text-action"}>{t.eyebrow}</p>
      <h2 id="routine-title" className={app ? "mt-1.5 a-card text-navy" : "mt-1.5 text-[20px] font-semibold tracking-[-0.01em] text-navy"}>
        {title}
      </h2>
      <p className={app ? "mt-1.5 a-body text-body" : "mt-1.5 max-w-[56ch] t-small text-body"}>{body}</p>
      {open?.status === "active" && nextOnLabel ? <p className="mt-1 t-small font-semibold text-navy">{format(t.nextOn, { date: nextOnLabel })}</p> : null}
      {!open && routine?.status === "declined" ? (
        <p className="mt-3 rounded-md bg-soft p-3 t-small text-body" data-routine-declined>
          <span className="font-semibold text-navy">{t.declinedTitle}.</span> {format(t.declinedBody, { reason: routine.reason ?? "" }).trim()}
        </p>
      ) : null}

      {!hasAddress && !open ? (
        <p className="mt-4 t-small text-body">
          {t.needAddress}{" "}
          <Link href={customerRoutes(base).profile} className="font-semibold text-navy underline decoration-blue/50 underline-offset-4">
            {t.addAddress}
          </Link>
        </p>
      ) : showForm ? (
        <form
          action={action}
          className={app ? "mt-4 grid gap-3" : "mt-4 grid gap-3 sm:grid-cols-[repeat(3,minmax(0,1fr))] sm:items-end"}
          onSubmit={() => {
            changed(open ? "change" : "request");
            setEditing(false);
          }}
        >
          <input type="hidden" name="intent" value="request" />
          <label className={label}>
            {t.day}
            <select name="weekday" defaultValue={String(open?.weekday ?? suggestedDay ?? 6)} className={field}>
              {days.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            {t.time}
            <select name="window" defaultValue={open?.window ?? "afternoon"} className={field}>
              {ROUTINE_WINDOWS.map((w) => (
                <option key={w} value={w}>
                  {windows[w]}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            {t.service}
            <select name="service" defaultValue={open ? (open.service ?? "") : (suggestedService ?? "")} className={field}>
              <option value="">{t.serviceAny}</option>
              {ROUTINE_SERVICES.map((s) => (
                <option key={s} value={s}>
                  {services[s]}
                </option>
              ))}
            </select>
          </label>
          <label className={`${label} sm:col-span-3`}>
            {t.note}
            <input name="note" maxLength={300} defaultValue={open?.note ?? ""} className={field} />
          </label>
          <div className="flex flex-wrap gap-3 sm:col-span-3">
            <button type="submit" disabled={pending} className={primary}>
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
