"use client";

import { useRef, useState } from "react";
import { Segmented } from "@/components/app/controls";
import { buttonClass } from "@/components/app/ui";
import { savePreferencesAction } from "@/lib/customer/actions";
import type { Care, SavedAddress } from "@/lib/customer/extras";
import { announceSaved } from "./SavedFlag";

/**
 * Preferences are saved as one record (care + addresses). Each screen changes only its part and
 * sends the rest exactly as stored, so starch, fragrance or a care note saved on the website stay.
 */
function prefsForm(care: Care, addresses: SavedAddress[]) {
  const f = new FormData();
  if (care.shirts) f.set("shirts", care.shirts);
  if (care.starch) f.set("starch", care.starch);
  if (care.fragrance) f.set("fragrance", care.fragrance);
  if (care.separate) f.set("separate", "on");
  if (care.note) f.set("note", care.note);
  addresses.slice(0, 3).forEach((a, i) => {
    f.set(`label${i}`, a.label);
    f.set(`address${i}`, a.address);
    f.set(`area${i}`, a.area);
  });
  return f;
}

/** Profile › How you like it done: shirts only (No preference, On hangers, Folded). */
export function ShirtsForm({ care, addresses, t }: { care: Care; addresses: SavedAddress[]; t: { prefShirts: string; noPref: string; hanger: string; folded: string; failed: string } }) {
  const [value, setValue] = useState<string>(care.shirts ?? "none");
  const [failed, setFailed] = useState(false);
  async function pick(v: string) {
    setValue(v);
    const next: Care = { ...care, shirts: v === "hanger" || v === "folded" ? v : undefined };
    const r = await savePreferencesAction({ status: "idle" }, prefsForm(next, addresses));
    setFailed(r.status !== "saved");
    if (r.status === "saved") announceSaved();
  }
  return (
    <div data-app-prefs>
      <Segmented legend={t.prefShirts} name="shirts" value={value} onChange={pick} options={[{ value: "none", label: t.noPref }, { value: "hanger", label: t.hanger }, { value: "folded", label: t.folded }]} />
      {failed ? (
        <p role="alert" className="mt-2 a-sec text-app-red">
          {t.failed}
        </p>
      ) : null}
    </div>
  );
}

type AddrText = { addAddress: string; addressName: string; addressLabel: string; areaLabel: string; areaNotSet: string; removeAddress: string; failed: string };

/** Profile › Addresses: up to three saved pickup addresses. No empty form until "Add an address". */
export function AddressesForm({ care, addresses: initial, areas, t }: { care: Care; addresses: SavedAddress[]; areas: { value: string; label: string }[]; t: AddrText }) {
  const [list, setList] = useState<SavedAddress[]>(initial);
  const [failed, setFailed] = useState(false);
  const saved = useRef(JSON.stringify(initial));

  async function save(next: SavedAddress[]) {
    const keep = next.filter((a) => a.address.trim());
    const now = JSON.stringify(keep);
    if (now === saved.current) return;
    const r = await savePreferencesAction({ status: "idle" }, prefsForm(care, keep));
    setFailed(r.status !== "saved");
    if (r.status === "saved") {
      saved.current = now;
      announceSaved();
    }
  }
  const set = (i: number, patch: Partial<SavedAddress>) => setList((l) => l.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  const field = "mt-1.5 h-13 w-full rounded-xl border-[1.5px] border-line-strong bg-app-card px-4 a-row focus:border-action focus:outline-none";

  return (
    <div className="space-y-4" data-app-addresses>
      {list.map((a, i) => (
        <fieldset key={i} className="space-y-3 rounded-2xl border border-line bg-app-card p-4">
          <legend className="sr-only">{a.label || t.addressLabel}</legend>
          <label className="block">
            <span className="a-sec font-semibold text-navy">{t.addressName}</span>
            <input value={a.label} onChange={(e) => set(i, { label: e.target.value })} onBlur={() => save(list)} maxLength={30} className={field} />
          </label>
          <label className="block">
            <span className="a-sec font-semibold text-navy">{t.addressLabel}</span>
            <input value={a.address} onChange={(e) => set(i, { address: e.target.value })} onBlur={() => save(list)} maxLength={300} className={field} />
          </label>
          <label className="block">
            <span className="a-sec font-semibold text-navy">{t.areaLabel}</span>
            <select
              value={a.area}
              onChange={(e) => {
                const next = list.map((x, j) => (j === i ? { ...x, area: e.target.value } : x));
                setList(next);
                void save(next);
              }}
              className={field}
            >
              <option value="">{t.areaNotSet}</option>
              {areas.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={buttonClass("text", "!px-0 text-app-red")}
            onClick={() => {
              const next = list.filter((_, j) => j !== i);
              setList(next);
              void save(next);
            }}
          >
            {t.removeAddress}
          </button>
        </fieldset>
      ))}
      {list.length < 3 ? (
        <button type="button" className={buttonClass("secondary")} onClick={() => setList((l) => [...l, { label: "", address: "", area: "" }])}>
          {t.addAddress}
        </button>
      ) : null}
      {failed ? (
        <p role="alert" className="a-sec text-app-red">
          {t.failed}
        </p>
      ) : null}
    </div>
  );
}
