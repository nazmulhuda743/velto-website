"use client";

import { useActionState, useState } from "react";
import { cancelPickupAction, changePickupAction, type PickupState } from "@/lib/customer/actions";
import type { AccountText } from "@/content/i18n/account";
import { SubmitButton } from "./SubmitButton";

type Text = AccountText["pickups"];
const IDLE: PickupState = { status: "idle" };

const field = "mt-1.5 block h-12 w-full rounded-md border border-line-strong bg-white px-4 text-base text-navy focus:border-action focus:outline-none focus:ring-2 focus:ring-action/30";

/**
 * Change the day/part of the day, or cancel, for one open pickup. Both go straight to the
 * dispatch board and the Ops task (portal_pickup_change / portal_pickup_cancel), which also
 * enforce ownership, the cutoff and the change limit.
 */
export function PickupControls({
  id,
  t,
  days,
  slots,
  defaultSlot,
}: {
  id: string;
  t: Text;
  days: { value: string; label: string }[];
  slots: { value: string; label: string }[];
  defaultSlot: string;
}) {
  const [mode, setMode] = useState<"idle" | "change" | "cancel">("idle");
  const [changeState, change] = useActionState(changePickupAction, IDLE);
  const [cancelState, cancel] = useActionState(cancelPickupAction, IDLE);

  if (cancelState.status === "cancelled") {
    return (
      <p role="status" className="mt-3 t-small font-semibold text-success">
        {t.cancelled}
      </p>
    );
  }

  const error = mode === "change" && changeState.status === "error" ? changeState.message : mode === "cancel" && cancelState.status === "error" ? cancelState.message : null;

  return (
    <div className="mt-4">
      {changeState.status === "changed" && mode !== "change" ? (
        <p role="status" className="mb-3 t-small font-semibold text-success">
          {t.changed}
        </p>
      ) : null}

      {mode === "idle" ? (
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => setMode("change")} className="inline-flex h-11 items-center rounded-md border border-line-strong bg-white px-5 font-semibold text-navy hover:border-navy">
            {t.change}
          </button>
          <button type="button" onClick={() => setMode("cancel")} className="inline-flex h-11 items-center rounded-md px-3 font-semibold text-error underline decoration-error/40 underline-offset-4 hover:decoration-error">
            {t.cancel}
          </button>
        </div>
      ) : null}

      {mode === "change" ? (
        <form
          action={change}
          className="rounded-md border border-line bg-soft p-4"
          data-pickup-change
        >
          <input type="hidden" name="id" value={id} />
          <fieldset>
            <legend className="font-semibold text-navy">{t.newTime}</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block t-small font-semibold text-navy">
                {t.day}
                <select name="date" defaultValue={days[1]?.value ?? days[0]?.value} className={`${field} appearance-none`}>
                  {days.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block t-small font-semibold text-navy">
                {t.slot}
                <select name="slot" defaultValue={defaultSlot} className={`${field} appearance-none`}>
                  {slots.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>
          {error ? (
            <p role="alert" className="mt-3 t-small font-medium text-error">
              {error}
            </p>
          ) : null}
          {changeState.status === "changed" ? (
            <p role="status" className="mt-3 t-small font-semibold text-success">
              {t.changed}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <SubmitButton pending={t.saving} className="sm:!w-auto">
              {t.saveChange}
            </SubmitButton>
            <button type="button" onClick={() => setMode("idle")} className="inline-flex h-11 items-center px-3 font-semibold text-secondary hover:text-navy">
              {t.keep}
            </button>
          </div>
        </form>
      ) : null}

      {mode === "cancel" ? (
        <form action={cancel} className="rounded-md border border-error/30 bg-error-soft p-4" data-pickup-cancel>
          <input type="hidden" name="id" value={id} />
          <p className="font-semibold text-navy">{t.cancelQuestion}</p>
          <label className="mt-3 block t-small font-semibold text-navy">
            {t.reason}
            <input name="reason" maxLength={200} placeholder={t.reasonPlaceholder} className={field} />
          </label>
          {error ? (
            <p role="alert" className="mt-3 t-small font-medium text-error">
              {error}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <SubmitButton pending={t.cancelling} className="sm:!w-auto !bg-error hover:!bg-error/90">
              {t.confirmCancel}
            </SubmitButton>
            <button type="button" onClick={() => setMode("idle")} className="inline-flex h-11 items-center px-3 font-semibold text-secondary hover:text-navy">
              {t.keep}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
