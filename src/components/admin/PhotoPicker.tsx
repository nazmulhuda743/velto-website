"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/admin/upload-limits";

/**
 * The photo itself is the upload control: a clear "Replace photo" button on the image, an
 * instant preview of the chosen file, and a prominent Save. Oversized files are stopped in the
 * browser (the server would only answer with a bare 413). Must sit inside the slot's <form>.
 */
export function PhotoPicker({
  name,
  src,
  position,
  label,
}: {
  name: string;
  src: string | null;
  position?: string;
  /** What the slot is, for the button's accessible name. */
  label: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview]);

  const clear = () => {
    if (input.current) {
      input.current.value = "";
      input.current.setCustomValidity("");
    }
    setPreview(null);
    setFileName("");
    setError("");
  };

  const shown = preview ?? src;
  return (
    <div>
      <div className="relative aspect-[4/3] overflow-hidden bg-soft">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="" className="absolute inset-0 size-full object-cover" style={{ objectPosition: position }} />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center t-small text-secondary">No photo yet</span>
        )}
        {preview ? (
          <span className="absolute left-3 top-3 rounded-full bg-cyan px-2.5 py-0.5 t-caption font-bold text-navy">New photo, not saved yet</span>
        ) : null}
        <label
          htmlFor={id}
          className="absolute bottom-3 right-3 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md bg-white/95 px-3.5 text-[14px] font-semibold text-navy shadow-[0_4px_14px_rgba(0,43,78,0.25)] hover:bg-white focus-within:outline-2 focus-within:outline-blue"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
          </svg>
          {preview ? "Choose a different photo" : shown ? "Replace photo" : "Upload photo"}
          <input
            ref={input}
            id={id}
            type="file"
            name={name}
            accept="image/jpeg,image/png,image/webp,image/avif"
            aria-label={`New photo for ${label}`}
            aria-invalid={error ? true : undefined}
            className="sr-only"
            onChange={(e) => {
              const el = e.currentTarget;
              const file = el.files?.[0];
              if (!file) return clear();
              const message =
                file.size > MAX_UPLOAD_BYTES
                  ? `This photo is ${(file.size / 1024 / 1024).toFixed(1)} MB. Photos must be smaller than ${MAX_UPLOAD_LABEL}; resize it or choose another.`
                  : "";
              el.setCustomValidity(message);
              setError(message);
              setFileName(file.name);
              setPreview(message ? null : URL.createObjectURL(file));
            }}
          />
        </label>
      </div>

      {error ? (
        <p role="alert" className="mx-4 mt-3 t-small font-medium text-error">
          {error}
        </p>
      ) : null}
      {preview ? (
        <div className="mx-4 mt-3 rounded-md border border-blue/30 bg-[#e8f3fb] p-3">
          <p className="t-small text-navy [overflow-wrap:anywhere]">
            <span className="font-semibold">Ready:</span> {fileName}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="submit" className="admin-btn">
              Save new photo
            </button>
            <button type="button" onClick={clear} className="admin-btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
