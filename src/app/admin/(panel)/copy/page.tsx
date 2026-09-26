import Link from "next/link";
import { AdminHeader, Badge, one, type SearchParams } from "@/components/admin/ui";
import { COPY_AREAS, copyEntries, groupLabel, type CopyEntry } from "@/lib/admin/copy-catalog";
import { requireSection } from "@/lib/admin/session";
import { placeholders, type CopyNamespace } from "@/lib/i18n/copy-overrides";
import { getSiteContent } from "@/lib/site-content";
import { saveCopyAction } from "../../copy-actions";

function Row({ e, current, ns, lang, group, q, saved, error }: { e: CopyEntry; current: string | undefined; ns: string; lang: string; group: string; q: string; saved: boolean; error?: string }) {
  const edited = current !== undefined;
  const value = current ?? e.original;
  const long = value.length > 90 || value.includes("\n");
  const ph = placeholders(e.original);
  return (
    <li id={`t-${e.path}`} className="scroll-mt-24 border-b border-line px-4 py-4 last:border-0 md:px-5">
      <form action={saveCopyAction}>
        <input type="hidden" name="ns" value={ns} />
        <input type="hidden" name="lang" value={lang} />
        <input type="hidden" name="path" value={e.path} />
        <input type="hidden" name="group" value={group} />
        <input type="hidden" name="q" value={q} />
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <label htmlFor={`f-${e.path}`} className="t-small font-semibold text-navy">
            {e.label}
          </label>
          {edited ? <Badge tone="green">Edited</Badge> : null}
        </div>
        {long ? (
          <textarea id={`f-${e.path}`} name="text" defaultValue={value} lang={lang} rows={Math.min(8, Math.ceil(value.length / 90) + 1)} maxLength={4000} className="admin-input mt-1.5" />
        ) : (
          <input id={`f-${e.path}`} name="text" defaultValue={value} lang={lang} maxLength={4000} className="admin-input mt-1.5" />
        )}
        {edited ? (
          <p className="mt-1.5 t-caption text-secondary" lang={lang}>
            Original: {e.original}
          </p>
        ) : null}
        {ph.length ? <p className="mt-1 t-caption text-secondary">Keep {ph.join(" ")} as written: filled in automatically.</p> : null}
        {saved ? <p className="mt-1.5 t-small font-medium text-success">Saved. The website now shows this.</p> : null}
        {error ? (
          <p role="alert" className="mt-1.5 t-small font-medium text-error">
            {error}
          </p>
        ) : null}
        <div className="mt-2 flex gap-2">
          <button type="submit" name="op" value="save" className="admin-btn-secondary !min-h-9 !px-4">
            Save
          </button>
          {edited ? (
            <button type="submit" name="op" value="reset" className="admin-btn-danger !min-h-9 !px-4">
              Restore original
            </button>
          ) : null}
        </div>
      </form>
    </li>
  );
}

export default async function CopyPage({ searchParams }: { searchParams: SearchParams }) {
  await requireSection("copy");
  const params = await searchParams;
  const ns = (COPY_AREAS.find((a) => a.ns === one(params.ns))?.ns ?? "site") as CopyNamespace;
  const lang = one(params.lang) === "bn" ? "bn" : "en";
  const q = (one(params.q) ?? "").trim().slice(0, 60);
  const entries = copyEntries(ns, lang);
  const groups = [...new Set(entries.map((e) => e.group))];
  const group = q ? "" : groups.includes(one(params.group) ?? "") ? one(params.group)! : groups[0];
  const needle = q.toLowerCase();
  const { copy } = await getSiteContent();
  const overrides = copy[lang];
  const shown = q ? entries.filter((e) => `${e.label} ${e.original} ${overrides[`${ns}.${e.path}`] ?? ""}`.toLowerCase().includes(needle)) : entries.filter((e) => e.group === group);
  const editedIn = (g: string) => entries.filter((e) => e.group === g && overrides[`${ns}.${e.path}`] !== undefined).length;
  const area = COPY_AREAS.find((a) => a.ns === ns)!;
  const link = (extra: Record<string, string>) => `/admin/copy?${new URLSearchParams({ ns, lang, ...extra })}`;

  return (
    <>
      <AdminHeader
        title="Text & copy"
        intro="Change any words on the website, in English and Bangla. Edits show on the site right away; the original is kept, so “Restore original” always brings it back. Every change is recorded in Activity."
      />
      {one(params.error) && !one(params.at) ? (
        <p role="alert" className="mt-6 rounded-md border border-error/30 bg-error-soft px-4 py-3 t-small font-medium text-error">
          {one(params.error)}
        </p>
      ) : null}

      <nav aria-label="Areas" className="mt-6 flex flex-wrap gap-2">
        {COPY_AREAS.map((a) => (
          <Link
            key={a.ns}
            href={`/admin/copy?${new URLSearchParams({ ns: a.ns, lang })}`}
            aria-current={a.ns === ns ? "page" : undefined}
            className={`rounded-md border px-3.5 py-2 t-small font-semibold ${a.ns === ns ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-navy"}`}
          >
            {a.title}
          </Link>
        ))}
      </nav>
      <p className="mt-3 t-small text-secondary">{area.hint}</p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-md border border-line bg-white p-0.5" role="group" aria-label="Language">
          {(["en", "bn"] as const).map((l) => (
            <Link
              key={l}
              href={`/admin/copy?${new URLSearchParams({ ns, lang: l, ...(group ? { group } : {}), ...(q ? { q } : {}) })}`}
              aria-current={lang === l ? "true" : undefined}
              className={`rounded-[6px] px-3 py-1.5 t-small font-semibold ${lang === l ? "bg-navy text-white" : "text-navy hover:bg-soft"}`}
            >
              {l === "en" ? "English" : "বাংলা"}
            </Link>
          ))}
        </div>
        <form className="flex flex-1 gap-2">
          <input type="hidden" name="ns" value={ns} />
          <input type="hidden" name="lang" value={lang} />
          <input name="q" defaultValue={q} placeholder="Find text, e.g. “Book a Pickup”" aria-label="Find text" className="admin-input md:max-w-sm" />
          <button type="submit" className="admin-btn-secondary">
            Find
          </button>
        </form>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Sections" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0">
          {groups.map((g) => {
            const n = editedIn(g);
            return (
              <Link
                key={g}
                href={link({ group: g })}
                aria-current={g === group ? "page" : undefined}
                className={`flex shrink-0 items-center justify-between gap-2 whitespace-nowrap rounded-md px-3 py-1.5 t-small font-semibold ${g === group ? "bg-navy text-white" : "text-navy hover:bg-soft"}`}
              >
                {groupLabel(g)}
                {n ? <span className={`rounded-full px-1.5 text-[11px] leading-5 ${g === group ? "bg-white/20" : "bg-success-soft text-success"}`}>{n}</span> : null}
              </Link>
            );
          })}
        </nav>

        <section aria-label="Text">
          <p className="mb-2 t-small text-secondary">
            {q ? `${shown.length} match${shown.length === 1 ? "" : "es"} for “${q}”.` : `${shown.length} text${shown.length === 1 ? "" : "s"} in ${groupLabel(group)}.`}{" "}
            {q ? (
              <Link href={link({})} className="font-semibold text-navy underline underline-offset-4">
                Clear search
              </Link>
            ) : null}
          </p>
          <ul className="overflow-hidden rounded-lg border border-line bg-white">
            {shown.map((e) => (
              <Row
                key={e.path}
                e={e}
                current={overrides[`${ns}.${e.path}`]}
                ns={ns}
                lang={lang}
                group={group}
                q={q}
                saved={one(params.saved) === e.path}
                error={one(params.at) === e.path ? one(params.error) : undefined}
              />
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
