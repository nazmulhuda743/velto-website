"use client";

import { useState } from "react";
import { PickupWindows, type PickedWindow } from "@/components/forms/PickupWindows";
import type { FormText } from "@/content/i18n/forms/en";

/**
 * Sector and pickup window for a staff booking: the same picker and the same live capacity as
 * the website, so staff can't promise a window the website wouldn't sell. The choice travels to
 * the server action as hidden fields.
 */
export function StaffPickupFields({ t, c }: { t: FormText["booking"]; c: FormText["common"] }) {
  const [sector, setSector] = useState("");
  const [pickup, setPickup] = useState<PickedWindow | null>(null);
  return (
    <div className="min-w-0 space-y-4">
      <label className="block">
        <span className="block t-small font-semibold text-navy">Sector</span>
        <select
          name="sector"
          required
          value={sector}
          onChange={(e) => {
            setSector(e.target.value);
            setPickup(null);
          }}
          className="admin-input mt-1 max-w-xs"
        >
          <option value="" disabled>
            Choose the sector
          </option>
          {Array.from({ length: 18 }, (_, i) => (
            <option key={i + 1} value={String(i + 1)}>
              Uttara Sector {i + 1}
            </option>
          ))}
        </select>
      </label>
      <PickupWindows
        endpoint="/admin/capacity/availability"
        sector={sector}
        outside={false}
        value={pickup}
        onChange={setPickup}
        refresh={0}
        t={t}
        c={c}
        locale="en"
      />
      <input type="hidden" name="date" value={pickup?.date ?? ""} />
      <input type="hidden" name="window" value={pickup?.window ?? ""} />
      <input type="hidden" name="windowLabel" value={pickup ? `${pickup.starts}-${pickup.ends}` : ""} />
    </div>
  );
}
