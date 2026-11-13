import Link from "next/link";
import { AdminHeader, Badge, DataNotice, one, type SearchParams } from "@/components/admin/ui";
import { getChatLog } from "@/lib/admin/chat-admin";
import { summarize, TOPIC_LABEL, type ChatConversation } from "@/lib/admin/chat-insights";
import { requireSection } from "@/lib/admin/session";

export const metadata = { title: "Chat questions · Velto Command Center" };

const RANGES = [
  { days: 1, label: "Today" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });

function Conversation({ c }: { c: ChatConversation }) {
  return (
    <li className="admin-card p-4 md:p-5" data-chat-conversation>
      <div className="flex flex-wrap items-center gap-2 t-small text-secondary">
        <span className="font-semibold text-navy">{when(c.startedAt)}</span>
        <Badge tone="blue">{c.lang === "bn" ? "Bangla" : "English"}</Badge>
        {c.page ? <span>on {c.page}</span> : null}
        <span>
          · {c.turns.length} {c.turns.length === 1 ? "question" : "questions"}
        </span>
        {c.notUnderstood ? <Badge tone="amber">{c.notUnderstood} not understood</Badge> : null}
      </div>
      <ol className="mt-3 space-y-3">
        {c.turns.map((t, i) => (
          <li key={i} className="grid gap-1.5">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="t-caption font-semibold uppercase tracking-[0.04em] text-secondary">Customer</span>
              <span className="font-semibold text-navy">{t.question}</span>
            </p>
            <div className={`rounded-md px-3 py-2 t-small ${t.outcome === "failed" ? "border border-warning/40 bg-warning-soft text-navy" : "bg-soft text-body"}`}>
              <p className="mb-0.5 flex flex-wrap items-center gap-2 t-caption font-semibold uppercase tracking-[0.04em] text-secondary">
                Chat answered
                <span className="normal-case tracking-normal">· {TOPIC_LABEL[t.topic] ?? t.topic}</span>
              </p>
              <p className="whitespace-pre-line">{t.answer}</p>
            </div>
          </li>
        ))}
      </ol>
    </li>
  );
}

export default async function ChatQuestionsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireSection("feedback");
  const params = await searchParams;
  const days = RANGES.find((r) => String(r.days) === one(params.days))?.days ?? 7;
  const view = one(params.view) === "missed" ? "missed" : "all";
  const loaded = await getChatLog(days);
  const s = summarize(loaded.state === "ok" ? loaded.data : []);
  const shown = view === "missed" ? s.list.filter((c) => c.notUnderstood > 0) : s.list;
  const maxTopic = Math.max(1, ...s.topics.map((t) => t.count));
  const href = (d: number, v: string) => `/admin/chat?days=${d}${v === "missed" ? "&view=missed" : ""}`;

  return (
    <>
      <AdminHeader
        title="Chat questions"
        intro="What customers ask in the website chat, and what it answered. Questions it didn't understand show in amber: those are the answers worth adding next. Kept for 90 days; no names or phone numbers unless a customer typed one."
      />
      {loaded.state !== "ok" ? <DataNotice state={loaded.state} message={loaded.state === "error" ? loaded.message : undefined} /> : loaded.preview ? <DataNotice state="preview" /> : null}

      <nav aria-label="Period" className="mt-6 flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <Link
            key={r.days}
            href={href(r.days, view)}
            aria-current={days === r.days ? "page" : undefined}
            className={`rounded-full px-4 py-2 t-small font-semibold ${days === r.days ? "bg-navy text-white" : "bg-soft text-navy hover:bg-line"}`}
          >
            {r.label}
          </Link>
        ))}
      </nav>

      <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Questions", value: String(s.questions) },
          { label: "Conversations", value: String(s.conversations) },
          { label: "Answered", value: s.answeredPct === null ? "–" : `${s.answeredPct}%` },
          { label: "Not understood", value: String(s.notUnderstood) },
        ].map((f) => (
          <div key={f.label} className="admin-card p-4">
            <dt className="t-caption uppercase tracking-[0.04em] text-secondary">{f.label}</dt>
            <dd className="mt-1 text-[24px] font-semibold text-navy tabular-nums">{f.value}</dd>
          </div>
        ))}
      </dl>

      {s.topics.length ? (
        <section aria-labelledby="topics" className="mt-6 admin-card p-4 md:p-5">
          <h2 id="topics" className="t-h4 text-navy">
            What customers ask about
          </h2>
          <ul className="mt-3 space-y-2">
            {s.topics.map((t) => (
              <li key={t.id} className="grid grid-cols-[minmax(0,12rem)_1fr_auto] items-center gap-3 t-small">
                <span className={`truncate ${t.id === "none" ? "font-semibold text-warning" : "text-navy"}`}>{t.label}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-soft" aria-hidden="true">
                  <span className={`block h-full rounded-full ${t.id === "none" ? "bg-warning" : "bg-action"}`} style={{ width: `${Math.max(4, (t.count / maxTopic) * 100)}%` }} />
                </span>
                <span className="font-semibold text-navy tabular-nums">{t.count}</span>
              </li>
            ))}
          </ul>
          {s.limited ? <p className="mt-3 t-small text-secondary">{s.limited} messages were held back for sending too fast (not counted above).</p> : null}
        </section>
      ) : null}

      <nav aria-label="Show" className="mt-6 flex flex-wrap gap-2">
        {[
          { key: "all", label: `All conversations (${s.conversations})` },
          { key: "missed", label: `With a question not understood (${s.list.filter((c) => c.notUnderstood > 0).length})` },
        ].map((t) => (
          <Link
            key={t.key}
            href={href(days, t.key)}
            aria-current={view === t.key ? "page" : undefined}
            className={`rounded-full px-4 py-2 t-small font-semibold ${view === t.key ? "bg-navy text-white" : "bg-soft text-navy hover:bg-line"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {shown.length ? (
        <ul className="mt-4 space-y-3">
          {shown.map((c) => (
            <Conversation key={c.id} c={c} />
          ))}
        </ul>
      ) : (
        <p className="mt-4 admin-card p-6 text-secondary">
          {view === "missed" ? "Every question in this period was understood." : "No chat questions in this period yet. They appear here as customers use the chat on the website."}
        </p>
      )}
    </>
  );
}
