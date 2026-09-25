"use client";

import { useId, useMemo, useState } from "react";

type Page = { path: string; label: string; group: string };

const SOURCES = [
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "google", label: "Google" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "messenger", label: "Messenger" },
  { value: "flyer", label: "Flyer / QR print" },
];

const MEDIUMS = [
  { value: "paid_social", label: "paid_social — Facebook/Instagram ads" },
  { value: "social", label: "social — unpaid posts" },
  { value: "cpc", label: "cpc — Google ads" },
  { value: "share", label: "share — WhatsApp / shared link" },
  { value: "email", label: "email" },
  { value: "offline", label: "offline — print, flyers" },
];

const PRESETS = [
  { label: "Facebook ad", source: "facebook", medium: "paid_social" },
  { label: "Instagram ad", source: "instagram", medium: "paid_social" },
  { label: "Google ad", source: "google", medium: "cpc" },
  { label: "WhatsApp share", source: "whatsapp", medium: "share" },
];

/** lowercase, a–z 0–9 and underscores: consistent names group correctly in reports. */
export const campaignSlug = (v: string) =>
  v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);

export function CampaignLinkBuilder({ origin, pages }: { origin: string; pages: Page[] }) {
  const [page, setPage] = useState(pages.find((p) => p.path.includes("curtain"))?.path ?? pages[0]?.path ?? "/");
  const [source, setSource] = useState("facebook");
  const [medium, setMedium] = useState("paid_social");
  const [campaign, setCampaign] = useState("");
  const [content, setContent] = useState("");
  const [copied, setCopied] = useState(false);
  const id = useId();

  const url = useMemo(() => {
    const u = new URL(page, origin);
    const s = campaignSlug(source);
    const m = campaignSlug(medium);
    const c = campaignSlug(campaign);
    const ct = campaignSlug(content);
    if (s) u.searchParams.set("utm_source", s);
    if (m) u.searchParams.set("utm_medium", m);
    if (c) u.searchParams.set("utm_campaign", c);
    if (ct) u.searchParams.set("utm_content", ct);
    return u.toString();
  }, [origin, page, source, medium, campaign, content]);

  const ready = Boolean(campaignSlug(source) && campaignSlug(medium) && campaignSlug(campaign));
  const groups = [...new Set(pages.map((p) => p.group))];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.getElementById(`${id}-out`) as HTMLInputElement | null;
      input?.select();
      document.execCommand?.("copy");
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <div>
          <p className="t-caption font-semibold uppercase tracking-[0.04em] text-secondary">Quick start</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setSource(p.source);
                  setMedium(p.medium);
                }}
                aria-pressed={source === p.source && medium === p.medium}
                className="rounded-full border border-line px-3 py-1.5 t-small font-semibold text-navy hover:border-navy aria-pressed:border-navy aria-pressed:bg-navy aria-pressed:text-white"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="block text-[15px] font-semibold text-navy">Landing page</span>
          <span className="block t-small text-secondary">Send ads to the page that matches the ad&apos;s promise.</span>
          <select value={page} onChange={(e) => setPage(e.target.value)} className="admin-input mt-2">
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {pages
                  .filter((p) => p.group === g)
                  .map((p) => (
                    <option key={p.path} value={p.path}>
                      {p.label} ({p.path})
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="block text-[15px] font-semibold text-navy">Source</span>
            <input list={`${id}-sources`} value={source} onChange={(e) => setSource(e.target.value)} className="admin-input mt-2" />
            <datalist id={`${id}-sources`}>
              {SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className="block text-[15px] font-semibold text-navy">Medium</span>
            <select value={medium} onChange={(e) => setMedium(e.target.value)} className="admin-input mt-2">
              {MEDIUMS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="block text-[15px] font-semibold text-navy">Campaign</span>
          <span className="block t-small text-secondary">What and when, e.g. curtain_sep26. Spaces and capitals are converted.</span>
          <input value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="curtain_sep26" className="admin-input mt-2" required />
        </label>
        <label className="block">
          <span className="block text-[15px] font-semibold text-navy">Content (optional)</span>
          <span className="block t-small text-secondary">Which creative, e.g. video_01 or carousel_02.</span>
          <input value={content} onChange={(e) => setContent(e.target.value)} placeholder="video_01" className="admin-input mt-2" />
        </label>
      </div>

      <div className="rounded-lg border border-line bg-soft p-5">
        <p className="t-caption font-semibold uppercase tracking-[0.04em] text-secondary">Your tracked link</p>
        <label htmlFor={`${id}-out`} className="sr-only">
          Tracked campaign link
        </label>
        <textarea
          id={`${id}-out`}
          readOnly
          value={url}
          rows={4}
          className="mt-2 block w-full resize-none rounded-md border border-line bg-white p-3 font-mono text-[14px] leading-relaxed text-navy [overflow-wrap:anywhere]"
          onFocus={(e) => e.currentTarget.select()}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={copy} disabled={!ready} className="admin-btn">
            {copied ? "Copied" : "Copy link"}
          </button>
          <span role="status" className="t-small text-secondary">
            {ready ? (copied ? "Link copied to the clipboard." : "Paste it as the ad's website URL.") : "Add a campaign name to finish the link."}
          </span>
        </div>
        <dl className="mt-5 space-y-1.5 border-t border-line pt-4 t-small">
          {[
            ["utm_source", campaignSlug(source)],
            ["utm_medium", campaignSlug(medium)],
            ["utm_campaign", campaignSlug(campaign)],
            ["utm_content", campaignSlug(content)],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="font-mono text-secondary">{k}</dt>
              <dd className="font-mono font-semibold text-navy [overflow-wrap:anywhere]">{v || "—"}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 t-caption text-secondary">
          Use the same campaign name on every ad in a campaign and change only the content value per creative, so results group together here.
        </p>
      </div>
    </div>
  );
}
