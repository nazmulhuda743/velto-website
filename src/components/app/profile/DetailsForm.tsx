"use client";

import { useRef, useState } from "react";
import { saveProfileAction } from "@/lib/customer/actions";
import { announceSaved } from "./SavedFlag";

type Text = { fullNameLabel: string; phoneLabel: string; addressLabel: string; areaLabel: string; areaNotSet: string; locked: string | null; saveFailed: string };

/**
 * Profile › Your details: name, number (locked once verified) and pickup address. Each change saves
 * when the field is left; there is no save button.
 */
export function DetailsForm({ initial, areas, t }: { initial: { fullName: string; phone: string; address: string; area: string }; areas: { value: string; label: string }[]; t: Text }) {
  const form = useRef<HTMLFormElement>(null);
  const last = useRef(JSON.stringify(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);

  async function save() {
    if (!form.current) return;
    const data = new FormData(form.current);
    const now = JSON.stringify({ fullName: data.get("fullName"), phone: data.get("phone"), address: data.get("address"), area: data.get("area") });
    if (now === last.current) return;
    const r = await saveProfileAction({ status: "idle" }, data);
    if (r.status === "saved") {
      last.current = now;
      setErrors({});
      setFailed(false);
      announceSaved();
    } else if (r.status === "invalid") setErrors(r.errors as Record<string, string>);
    else setFailed(true);
  }

  const field = "mt-1.5 h-13 w-full rounded-xl border-[1.5px] border-line-strong bg-app-card px-4 a-row focus:border-action focus:outline-none";
  const err = (k: string) =>
    errors[k] ? (
      <span role="alert" className="mt-1 block a-cap text-app-red">
        {errors[k]}
      </span>
    ) : null;
  return (
    <form ref={form} onSubmit={(e) => (e.preventDefault(), void save())} className="space-y-4" data-app-details>
      <label className="block">
        <span className="a-sec font-semibold text-navy">{t.fullNameLabel}</span>
        <input name="fullName" defaultValue={initial.fullName} onBlur={save} autoComplete="name" maxLength={120} className={field} />
        {err("fullName")}
      </label>
      <label className="block">
        <span className="a-sec font-semibold text-navy">{t.phoneLabel}</span>
        <input name="phone" defaultValue={initial.phone} onBlur={save} readOnly={Boolean(t.locked)} inputMode="tel" autoComplete="tel" className={`${field} read-only:border-line read-only:bg-app-off read-only:text-secondary`} />
        {t.locked ? <span className="mt-1 block a-cap text-muted">{t.locked}</span> : null}
        {err("phone")}
      </label>
      <label className="block">
        <span className="a-sec font-semibold text-navy">{t.addressLabel}</span>
        <input name="address" defaultValue={initial.address} onBlur={save} autoComplete="street-address" maxLength={300} className={field} />
        {err("address")}
      </label>
      <label className="block">
        <span className="a-sec font-semibold text-navy">{t.areaLabel}</span>
        <select name="area" defaultValue={initial.area} onChange={save} className={field}>
          <option value="">{t.areaNotSet}</option>
          {areas.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
        {err("area")}
      </label>
      {failed ? (
        <p role="alert" className="a-sec text-app-red">
          {t.saveFailed}
        </p>
      ) : null}
    </form>
  );
}
