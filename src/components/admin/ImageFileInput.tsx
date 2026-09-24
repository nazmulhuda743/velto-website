"use client";

import { useState } from "react";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/admin/upload-limits";

/** File picker that blocks oversized photos in the browser; the server would only answer with a bare 413. */
export function ImageFileInput(props: { name: string; accept: string; className?: string; "aria-label"?: string }) {
  const [error, setError] = useState("");
  return (
    <>
      <input
        type="file"
        {...props}
        aria-invalid={error ? true : undefined}
        onChange={(e) => {
          const input = e.currentTarget;
          const file = input.files?.[0];
          const message =
            file && file.size > MAX_UPLOAD_BYTES
              ? `This photo is ${(file.size / 1024 / 1024).toFixed(1)} MB. Photos must be smaller than ${MAX_UPLOAD_LABEL}; resize it or choose another.`
              : "";
          input.setCustomValidity(message);
          setError(message);
          if (message) input.reportValidity();
        }}
      />
      {error ? (
        <p role="alert" className="t-small font-medium text-error">
          {error}
        </p>
      ) : null}
    </>
  );
}
