"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/admin/upload-limits";

/**
 * Logo picker for Settings → Logo: "Choose file" opens the picker, the chosen logo is previewed,
 * and only then can it be uploaded. (A bare file input next to a big "Upload logo" button read
 * as one button, so the form was sent without a file.)
 */
export function LogoFileField({ label, bg }: { label: string; bg: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<{ name: string; url: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => () => {
    if (picked) URL.revokeObjectURL(picked.url);
  }, [picked]);

  return (
    <div className="mt-3">
      <input
        ref={input}
        type="file"
        name="file"
        accept="image/png,image/webp"
        required
        className="sr-only"
        aria-label={`New file for ${label}`}
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          const message = !file
            ? ""
            : !["image/png", "image/webp"].includes(file.type)
              ? "Use a PNG or WebP file (a transparent PNG works best)."
              : file.size > MAX_UPLOAD_BYTES
                ? `This file is ${(file.size / 1024 / 1024).toFixed(1)} MB. Logos must be smaller than ${MAX_UPLOAD_LABEL}.`
                : "";
          e.currentTarget.setCustomValidity(message);
          setError(message);
          setPicked(file && !message ? { name: file.name, url: URL.createObjectURL(file) } : null);
        }}
      />
      {picked ? (
        <div className="rounded-md border border-dashed border-action p-3">
          <p className="t-caption font-semibold text-secondary">New logo (not saved yet)</p>
          <div className={`mt-2 flex h-20 items-center justify-center rounded-md ${bg}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={picked.url} alt="" className="h-10 w-auto" />
          </div>
          <p className="mt-2 truncate t-small text-body">{picked.name}</p>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 t-small font-medium text-error">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="admin-btn-secondary" onClick={() => input.current?.click()}>
          {picked ? "Choose another file" : "Choose logo file"}
        </button>
        <button type="submit" className="admin-btn" disabled={!picked}>
          Upload logo
        </button>
      </div>
    </div>
  );
}
