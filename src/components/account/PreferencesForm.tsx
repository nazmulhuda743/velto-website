"use client";

import { useActionState, useState } from "react";
import { savePreferencesAction, type PreferencesState } from "@/lib/customer/actions";
import type { Preferences } from "@/lib/customer/extras";
import type { AccountText } from "@/content/i18n/account";
import { SubmitButton } from "./SubmitButton";

type Text = AccountText["prefs"];

const IDLE: PreferencesState = { status: "idle" };

const field = "mt-2 block h-12 w-full rounded-md border border-line-strong bg-white px-4 text-base text-navy focus:border-action focus:outline-none focus:ring-2 focus:ring-action/30";

function Choice({ name, label, options, value }: { name: string; label: string; options: Record<string, string>; value?: string }) {
  return (
    <label className="block">
      <span className="block text-[15px] font-semibold text-navy">{label}</span>
      <select name={name} defaultValue={value ?? ""} className={`${field} appearance-none`}>
        {Object.entries(options).map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Garment care and saved addresses (Profile). Added to the note of every website booking. */
export function PreferencesForm({ initial, t, areas }: { initial: Preferences; t: Text; areas: { value: string; label: string }[] }) {
  const [state, action] = useActionState(savePreferencesAction, IDLE);
  const c = initial.care;
  // Empty address slots stay folded (the inputs are still submitted); one tap opens the next.
  const filled = initial.addresses.filter((a) => a?.address || a?.label).length;
  const [shown, setShown] = useState(Math.max(1, filled));
  return (
    <form action={action} className="space-y-8" data-preferences-form>
      <div className="grid gap-4 sm:grid-cols-3">
        <Choice name="shirts" label={t.shirts} options={t.shirtsOptions} value={c.shirts} />
        <Choice name="starch" label={t.starch} options={t.starchOptions} value={c.starch} />
        <Choice name="fragrance" label={t.fragrance} options={t.fragranceOptions} value={c.fragrance} />
      </div>
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" name="separate" defaultChecked={c.separate} className="size-5 accent-[#0078bc]" />
        <span className="font-medium text-navy">{t.separate}</span>
      </label>
      <label className="block">
        <span className="block text-[15px] font-semibold text-navy">{t.note}</span>
        <textarea
          name="note"
          rows={2}
          maxLength={300}
          defaultValue={c.note ?? ""}
          placeholder={t.notePlaceholder}
          className="mt-2 block w-full rounded-md border border-line-strong bg-white px-4 py-3 text-base text-navy placeholder:text-muted focus:border-action focus:outline-none focus:ring-2 focus:ring-action/30"
        />
      </label>

      <fieldset>
        <legend className="t-h4 text-navy">{t.addressesTitle}</legend>
        <p className="mt-1 t-small text-secondary">{t.addressesIntro}</p>
        <div className="mt-4 space-y-4">
          {[0, 1, 2].map((i) => {
            const a = initial.addresses[i];
            return (
              <div key={i} hidden={i >= shown} className="grid gap-3 rounded-md border border-line p-4 sm:grid-cols-[140px_1fr_180px]" data-address-slot={i}>
                <label className="block">
                  <span className="block t-small font-semibold text-navy">{t.label}</span>
                  <input name={`label${i}`} defaultValue={a?.label ?? ""} maxLength={30} placeholder={t.labelPlaceholders[i]} className={field} />
                </label>
                <label className="block">
                  <span className="block t-small font-semibold text-navy">{t.address}</span>
                  <input name={`address${i}`} defaultValue={a?.address ?? ""} maxLength={300} autoComplete="address-line1" className={field} />
                </label>
                <label className="block">
                  <span className="block t-small font-semibold text-navy">{t.area}</span>
                  <select name={`area${i}`} defaultValue={a?.area ?? ""} className={`${field} appearance-none`}>
                    <option value="">{t.areaNone}</option>
                    {areas.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            );
          })}
          {shown < 3 ? (
            <button type="button" onClick={() => setShown((n) => Math.min(3, n + 1))} className="inline-flex min-h-11 items-center rounded-sm t-small font-semibold text-navy underline decoration-blue/50 underline-offset-4 hover:decoration-blue">
              {t.addAddress}
            </button>
          ) : null}
        </div>
      </fieldset>

      {state.status === "error" ? (
        <p role="alert" className="t-small font-medium text-error">
          {state.message}
        </p>
      ) : state.status === "saved" ? (
        <p role="status" className="t-small font-medium text-success">
          {t.saved}
        </p>
      ) : null}
      <SubmitButton pending={t.saving} className="sm:!w-auto">
        {t.save}
      </SubmitButton>
    </form>
  );
}
