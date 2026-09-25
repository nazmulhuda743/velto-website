"use client";

import { useState } from "react";

/** Title/description inputs with live length guidance and a Google-style preview. */
export function SeoFields({
  path,
  siteUrl,
  defaults,
  initial,
  lang = "en",
}: {
  path: string;
  siteUrl: string;
  defaults: { title: string; description: string };
  initial: { title: string; description: string };
  /** "bn" edits the Bangla page's text: fields titleBn/descriptionBn, preview at /bn. */
  lang?: "en" | "bn";
}) {
  const bn = lang === "bn";
  const shownPath = bn ? (path === "/" ? "/bn" : `/bn${path}`) : path;
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const shownTitle = title || defaults.title;
  const shownDescription = description || defaults.description;
  const count = (n: number, ideal: [number, number]) => (
    <span className={n > ideal[1] ? "text-error" : n >= ideal[0] ? "text-success" : "text-secondary"}>
      {n} characters · aim for {ideal[0]}–{ideal[1]}
    </span>
  );
  return (
    <div className="space-y-5">
      <label className="block">
        <span className="block text-[15px] font-semibold text-navy">{bn ? "Title in Bangla" : "Title"}</span>
        <input
          name={bn ? "titleBn" : "title"}
          lang={bn ? "bn" : undefined}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={defaults.title}
          maxLength={120}
          className="admin-input mt-2"
        />
        <span className="mt-1 block t-caption">{count(shownTitle.length, [30, 60])}</span>
      </label>
      <label className="block">
        <span className="block text-[15px] font-semibold text-navy">{bn ? "Description in Bangla" : "Description"}</span>
        <textarea
          name={bn ? "descriptionBn" : "description"}
          lang={bn ? "bn" : undefined}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={defaults.description}
          maxLength={320}
          rows={3}
          className="admin-input mt-2"
        />
        <span className="mt-1 block t-caption">{count(shownDescription.length, [70, 160])}</span>
      </label>
      <div>
        <p className="text-[15px] font-semibold text-navy">{bn ? "Google preview (Bangla page)" : "Google preview"}</p>
        <div className="mt-2 rounded-lg border border-line bg-white p-4 font-[arial,sans-serif]">
          <p className="truncate text-[13px] text-[#202124]">
            {siteUrl.replace(/^https?:\/\//, "")}
            {shownPath === "/" ? "" : ` › ${shownPath.split("/").filter(Boolean).join(" › ")}`}
          </p>
          <p className="mt-1 truncate text-[20px] leading-snug text-[#1a0dab]">{shownTitle}</p>
          <p className="mt-1 line-clamp-2 text-[14px] leading-normal text-[#4d5156]">{shownDescription}</p>
        </div>
      </div>
    </div>
  );
}
