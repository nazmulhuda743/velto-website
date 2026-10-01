import { cookies } from "next/headers";
import Link from "next/link";
import { NotificationRefresher } from "@/components/admin/NotificationRefresher";
import { DayStrip } from "@/components/admin/today/DayStrip";
import { clock, dateLine, dayWord, initials, place, whenText, windowText, type TodayLang } from "@/components/admin/today/format";
import { HelpCard } from "@/components/admin/today/HelpCard";
import { Icon } from "@/components/admin/today/icons";
import type { AssignItem, CallItem, DeliverItem, ListItem, SheetData } from "@/components/admin/today/items";
import { JobRow } from "@/components/admin/today/JobRow";
import { LangSwitch } from "@/components/admin/today/LangSwitch";
import { NextUpCard } from "@/components/admin/today/NextUpCard";
import { RouteList } from "@/components/admin/today/RouteList";
import { TodayTabs } from "@/components/admin/today/TodayTabs";
import { one, type SearchParams } from "@/components/admin/ui";
import { TODAY_HELP_COOKIE, TODAY_LANG_COOKIE, todayText, type TodayText } from "@/content/i18n/admin-today";
import { getRequests } from "@/lib/admin/analytics-data";
import { addDays, dhakaToday, SLOTS, suggestedSlot, type DispatchJob, type SlotId } from "@/lib/admin/dispatch-logic";
import { isAdminPreview } from "@/lib/admin/preview";
import { callTimer } from "@/lib/admin/request-flow";
import { analyseRequest } from "@/lib/admin/request-intel";
import { requireSection } from "@/lib/admin/session";
import { getRiders, getToday, isDay, TODAY_ERRORS, todayError, type TodayData, type TodayError } from "@/lib/admin/today";
import { callQueue, changedTime, dayStrip, nowWindow, riderChoices, tabFor, TODAY_LATE_MINUTES, windowOver, type Rider, type TodayTab } from "@/lib/admin/today-logic";
import { normaliseBdPhone } from "@/lib/customer/validation";

export const metadata = { title: "Today · Velto Command Center" };

/**
 * Today (/admin/today): one phone-first screen to call, assign, plan deliveries and follow the day's
 * route (spec docs/superpowers/specs/2026-10-01-today-scheduling-design.md §3, mockup v2). One list
 * at a time: the tab, the day and the job shown as "Next up" are in the URL
 * (?tab=call|assign|deliver|route&date=YYYY-MM-DD&job=<id>), all rendered here on the server. The
 * only client parts are the rider sheet, the language switch, the help card's close and the 60 s refresh.
 */

const TABS: readonly TodayTab[] = ["call", "assign", "deliver", "route"];
/** Done codes today-actions.ts sends back. */
const DONE = ["confirmed", "no_answer", "assigned", "picked", "delivered", "linked", "rider_saved", "day_off", "day_on"] as const;
type Done = (typeof DONE)[number];

/** The last list that loaded, per day, so "Can't reach Velto Ops" can still show it (this server process only). */
const lastGood = new Map<string, TodayData>();

/** The time of this request (the page renders on the server, per request). */
const requestTime = () => Date.now();
const minutesSince = (iso: string, now: number) => Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
const dhakaHour = (now: number) => new Date(now + 6 * 3_600_000).getUTCHours();
const slotIndex = (s: SlotId | null) => (s ? SLOTS.findIndex((x) => x.id === s) : 9);
const phoneKey = (p: string | null | undefined) => (p ? normaliseBdPhone(p) : null);
const labelOf = (j: DispatchJob) => `${j.kind === "delivery" ? `Delivery ${j.order_number ?? ""}` : "Pickup"} – ${j.customer_name ?? "customer"}`;

/** The next window that can still be booked: the one running now, else the next one (tomorrow morning after 8 pm). */
function nextWindow(today: string, now: number): { date: string; slot: SlotId } {
  const current = nowWindow(new Date(now));
  if (current) return { date: today, slot: current };
  return dhakaHour(now) < 9 ? { date: today, slot: "morning" } : { date: addDays(today, 1), slot: "morning" };
}

/** What the customer wrote in the booking notes, without the offer lines staff already see as a badge. */
function noteOf(details: Record<string, string> | undefined): string | null {
  if (!details) return null;
  const parts = (details.Notes ?? "")
    .split(/\.\s+(?=[A-Z])|\n/)
    .map((p) => p.trim().replace(/\.$/, ""))
    .filter((p) => p && !/website order|coupon|whichever/i.test(p))
    .map((p) => p.replace(/^(Items|Note):\s*/i, ""));
  const all = [details.Items, ...parts].filter(Boolean);
  return all.length ? all.join(" · ") : null;
}

function matches(q: string, fields: (string | null | undefined)[]) {
  const text = q.toLowerCase();
  const digits = q.replace(/\D/g, "");
  return fields.some((f) => {
    if (!f) return false;
    if (f.toLowerCase().includes(text)) return true;
    return digits.length >= 4 && f.replace(/\D/g, "").includes(digits);
  });
}

export default async function TodayPage({ searchParams }: { searchParams: SearchParams }) {
  await requireSection("dispatch");
  const params = await searchParams;
  const jar = await cookies();
  const lang: TodayLang = jar.get(TODAY_LANG_COOKIE)?.value === "bn" ? "bn" : "en";
  const t = todayText(lang);
  // Local preview only: `?at=13` pretends it is 1 pm in Dhaka (to check the "now" window at any hour).
  const at = isAdminPreview() ? Number(one(params.at)) : NaN;
  const nowMs = Number.isInteger(at) && at >= 0 && at <= 23 ? Date.parse(`${dhakaToday()}T${String(at).padStart(2, "0")}:10:00+06:00`) : requestTime();
  const today = dhakaToday(new Date(nowMs));
  const tomorrow = addDays(today, 1);
  const dateParam = one(params.date) ?? "";
  const date = isDay(dateParam) ? dateParam : today;
  const tabParam = one(params.tab) as TodayTab | undefined;
  const tab: TodayTab = tabParam && TABS.includes(tabParam) ? tabParam : "call";
  const q = (one(params.q) ?? "").trim().slice(0, 60);
  const jobParam = one(params.job) ?? "";
  const showHelp = !jar.get(TODAY_HELP_COOKIE);
  // Local preview only: see the "Ops is down", "not set up" and empty states without breaking anything.
  const preview = isAdminPreview() ? one(params.preview) : undefined;

  const loaded = preview === "not_setup" ? ({ state: "not_configured" } as const) : await getToday(date);
  let data: TodayData | null = null;
  let opsDown = false;
  if (loaded.state === "ok") {
    data = loaded.data;
    lastGood.delete(date);
    lastGood.set(date, data);
    // A few days at most: the oldest one goes first.
    if (lastGood.size > 7) lastGood.delete(lastGood.keys().next().value!);
    if (preview === "ops_down") {
      opsDown = true;
      data = { ...data, loadedAt: new Date(nowMs - 7 * 60_000).toISOString() };
    }
    if (preview === "empty") data = { ...data, jobs: [], callbacks: [], routines: [], candidates: {} };
  } else if (loaded.state === "error" && /reach/i.test(loaded.message)) {
    opsDown = true;
    data = lastGood.get(date) ?? null;
  }
  const notSetUp = !data && !opsDown;
  const setupDetail = loaded.state === "error" ? loaded.message : "";

  // Keep the day (and nothing else) when moving between tabs and jobs.
  const href = (next: { tab?: TodayTab; job?: string; date?: string; q?: string }) => {
    const p = new URLSearchParams();
    p.set("tab", next.tab ?? tab);
    const d = next.date ?? date;
    if (d !== today) p.set("date", d);
    if (next.job) p.set("job", next.job);
    if (next.q) p.set("q", next.q);
    return `/admin/today?${p}`;
  };

  /* ---------- the lists ---------- */
  const jobs = data?.jobs ?? [];
  const riders: Rider[] = data?.riders ?? [];
  const requests = data ? await getRequests(500) : null;
  const tasks = new Set(jobs.map((j) => j.task_id).filter(Boolean));
  const insights = new Map((requests?.state === "ok" ? requests.data : []).filter((r) => tasks.has(r.id)).map((r) => [r.id, analyseRequest(r, nowMs)]));
  const insightOf = (j: DispatchJob) => (j.task_id ? insights.get(j.task_id) : undefined);
  const callbackPhones = new Set((data?.callbacks ?? []).map((c) => phoneKey(c.phone)).filter(Boolean));
  const jobBadges = (j: DispatchJob) => ({
    first: Boolean(insightOf(j)?.firstOrder),
    callback: Boolean(j.phone && callbackPhones.has(phoneKey(j.phone))),
    weekly: j.source === "weekly",
    changed: changedTime(j),
  });
  const fallback = nextWindow(today, nowMs);

  const callItems: CallItem[] = [
    ...callQueue(jobs).map((j): CallItem => {
      const s = suggestedSlot(j.requested, j.created_at, today);
      const slot = s.slot ?? fallback.slot;
      // A window with no day: today while it is still open, else tomorrow.
      const asked = s.date ?? (SLOTS.find((x) => x.id === slot)!.end > dhakaHour(nowMs) ? today : tomorrow);
      // Never offer a window that is already over: the same window tomorrow.
      const day = windowOver(asked, slot, new Date(nowMs)) ? tomorrow : asked;
      const minutes = callTimer(j, nowMs)?.minutes ?? minutesSince(j.created_at, nowMs);
      return {
        tab: "call",
        source: "job",
        id: j.id,
        name: j.customer_name ?? j.phone ?? "",
        phone: j.phone,
        place: place(j.area, t),
        badges: jobBadges(j),
        note: noteOf(insightOf(j)?.details),
        label: labelOf(j),
        minutes,
        late: minutes >= TODAY_LATE_MINUTES,
        // In the page language when it reads as a window; a day that has passed is left out.
        asked: s.slot ? windowText(s.slot, s.date, today, t) : null,
        confirm: { date: day, slot },
        attempts: j.contact_attempts,
      };
    }),
    ...(data?.callbacks ?? []).map((c): CallItem => {
      const minutes = minutesSince(c.created_at, nowMs);
      const asked = suggestedSlot(c.preferred, c.created_at, today);
      return {
        tab: "call",
        source: "callback",
        id: c.id,
        name: c.name,
        phone: c.phone,
        place: place(c.area, t),
        badges: { callback: true },
        note: [c.what, c.services].filter(Boolean).join(" · ") || null,
        label: `Call-back – ${c.name}`,
        minutes,
        late: minutes >= TODAY_LATE_MINUTES,
        asked: asked.slot ? windowText(asked.slot, asked.date, today, t) : null,
        confirm: null,
        attempts: 0,
      };
    }),
    ...(data?.routines ?? []).map((r): CallItem => {
      const minutes = minutesSince(r.createdAt, nowMs);
      return {
        tab: "call",
        source: "routine",
        id: r.id,
        name: r.name,
        phone: r.phone,
        place: place(r.area, t),
        badges: { weekly: true },
        note: r.note,
        label: `Weekly pickup – ${r.name}`,
        minutes,
        late: minutes >= TODAY_LATE_MINUTES,
        asked: `${t.everyWeekday(t.weekdays[r.weekday])} · ${t.windows[r.window]}`,
        confirm: null,
        attempts: 0,
      };
    }),
  ].sort((a, b) => b.minutes - a.minutes);

  const assignItems: AssignItem[] = jobs
    .filter((j) => tabFor(j) === "assign")
    .sort((a, b) => (a.slot_date ?? "9999").localeCompare(b.slot_date ?? "9999") || slotIndex(a.slot) - slotIndex(b.slot) || a.created_at.localeCompare(b.created_at))
    .map((j) => ({
      tab: "assign",
      id: j.id,
      name: j.customer_name ?? j.phone ?? "",
      phone: j.phone,
      place: place(j.area, t),
      badges: jobBadges(j),
      note: noteOf(insightOf(j)?.details),
      label: labelOf(j),
      date: j.slot_date,
      slot: j.slot,
    }));

  const orders = data?.context.orders ?? {};
  const orderOf = (j: DispatchJob) => (j.order_number ? orders[j.order_number] : undefined);
  const deliverItems: DeliverItem[] = jobs
    .filter((j) => tabFor(j) === "deliver")
    .sort(
      (a, b) =>
        (orderOf(a)?.deliveryDate ?? "9999").localeCompare(orderOf(b)?.deliveryDate ?? "9999") ||
        (orderOf(a)?.updatedAt ?? a.created_at).localeCompare(orderOf(b)?.updatedAt ?? b.created_at),
    )
    .map((j) => {
      const since = orderOf(j)?.updatedAt;
      return {
        tab: "deliver",
        id: j.id,
        name: j.customer_name ?? j.phone ?? "",
        phone: j.phone,
        place: place(j.area, t),
        badges: { callback: Boolean(j.phone && callbackPhones.has(phoneKey(j.phone))) },
        note: null,
        label: labelOf(j),
        order: j.order_number,
        readySince: since ? whenText(since, today, t) : null,
      };
    });

  const routeJobs = jobs.filter((j) => j.stage === "scheduled" && j.slot_date === date);
  const which = jobs.filter((j) => data?.candidates[j.id]?.length).map((j) => ({ job: j, candidates: data!.candidates[j.id] }));
  const lateCount = callItems.filter((i) => i.late).length;
  const counts: Record<TodayTab, number> = { call: callItems.length, assign: assignItems.length, deliver: deliverItems.length, route: routeJobs.length + which.length };
  const list: ListItem[] = tab === "call" ? callItems : tab === "assign" ? assignItems : tab === "deliver" ? deliverItems : [];
  const next = list.find((i) => i.id === jobParam) ?? list[0];
  const rest = list.filter((i) => i !== next);

  /* ---------- the rider sheet for Next up ---------- */
  let sheet: SheetData | null = null;
  const errorCode = one(params.error);
  if (next && next.tab !== "call") {
    const plannable = (d: string | null | undefined) => (d && d >= today ? d : null);
    const askRider = one(params.rider);
    const askSlot = SLOTS.find((s) => s.id === one(params.slot))?.id;
    const askDate = plannable(isDay(one(params.adate) ?? "") ? one(params.adate) : null);
    const pending = errorCode === "full" && jobParam === next.id && askRider && askSlot ? { rider: askRider, slot: askSlot } : null;
    let sheetDate = (pending && askDate) || (next.tab === "assign" ? (plannable(next.date) ?? plannable(date) ?? today) : (plannable(date) ?? today));
    // Every window of the day is over (after 8 pm): plan for the next day.
    if (SLOTS.every((s) => windowOver(sheetDate, s.id, new Date(nowMs)))) sheetDate = addDays(sheetDate, 1);
    const closed = SLOTS.filter((s) => windowOver(sheetDate, s.id, new Date(nowMs))).map((s) => s.id);
    const open = SLOTS.map((s) => s.id).filter((s) => !closed.includes(s));
    // The agreed window is over (or there is none): the manager picks one that is still open.
    const agreed = next.tab === "assign" && next.slot && !closed.includes(next.slot) && sheetDate === next.date ? next.slot : null;
    const sheetRiders = sheetDate === date ? riders : await getRiders(sheetDate);
    const others = jobs.filter((j) => j.id !== next.id);
    const windowWord = (w: SlotId) => (lang === "en" ? t.windowName[w].toLowerCase() : t.windowName[w]);
    const offWord = sheetDate === today ? t.offToday : t.offDay;
    const choices = Object.fromEntries(
      SLOTS.map((s) => [
        s.id,
        riderChoices(sheetRiders, others, sheetDate, s.id).map((c) => ({
          id: c.id,
          name: c.name,
          initial: initials(c.name),
          off: c.off,
          full: c.full,
          best: c.best,
          pct: Math.min(100, Math.round((c.load / (c.stopsPerWindow || 1)) * 100)),
          stops: t.stopsOf(c.load, c.stopsPerWindow),
          tag: c.off ? offWord : c.full ? t.full : c.best ? t.mostFree : null,
          ask: c.full ? t.fullAsk(c.name, windowWord(s.id)) : null,
        })),
      ]),
    ) as SheetData["choices"];
    sheet = {
      date: sheetDate,
      slot: agreed,
      defaultSlot: agreed ?? (pending?.slot && open.includes(pending.slot) ? pending.slot : open.includes(fallback.slot) ? fallback.slot : (open[0] ?? "morning")),
      closed,
      choices,
      pending,
      text: {
        trigger: next.tab === "assign" ? t.chooseRider : t.planDelivery,
        title: t.assignTo(next.name),
        hint: [next.place, t.assignHint].filter(Boolean).join(" · "),
        fixed: agreed ? windowText(agreed, sheetDate, today, t) : null,
        windows: t.windowName,
        timeWindow: t.timeWindow,
        close: t.close,
        assignAnyway: t.assignAnyway,
        back: t.back,
        noRiders: t.noRiders,
      },
    };
  }

  /* ---------- messages ---------- */
  const doneCode = one(params.done) as Done | undefined;
  const toast = doneCode && DONE.includes(doneCode) ? t.done[doneCode] : null;
  const error = errorCode && errorCode in TODAY_ERRORS && !sheet?.pending ? todayError(errorCode as TodayError, lang) : null;

  /* ---------- search ---------- */
  const results = q
    ? {
        items: [...callItems, ...assignItems, ...deliverItems].filter((i) => matches(q, [i.name, i.phone, i.tab === "deliver" ? i.order : null])),
        stops: jobs.filter((j) => (j.stage === "scheduled" || data?.candidates[j.id]?.length) && matches(q, [j.customer_name, j.phone, j.order_number])),
      }
    : null;

  const strip = dayStrip(riders, jobs, date);
  const nowSlot = date === today ? nowWindow(new Date(nowMs)) : null;
  const past = date < today ? SLOTS.map((s) => s.id) : date === today ? SLOTS.filter((s) => s.end <= dhakaHour(nowMs)).map((s) => s.id) : [];
  const title = date === today ? t.title : dayWord(date, today, t);
  const moreOpen = Boolean(q) || date !== today;

  return (
    <div data-today lang={lang} className="-mx-4 -mt-6 bg-white md:mx-auto md:mt-0 md:max-w-[520px] md:overflow-clip md:rounded-[16px] md:border md:border-line">
      <NotificationRefresher intervalMs={60_000} />
      <header className="on-navy bg-navy px-[18px] pt-3.5 pb-[18px] text-white">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-white/70">{dateLine(date, t)}</p>
            <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.02em]">{title}</h1>
          </div>
          <LangSwitch lang={lang} label={t.language} />
        </div>
        {data ? <DayStrip strip={strip} now={nowSlot} past={past} t={t} /> : null}
      </header>

      {/* More: search and the day switcher, out of the main flow. */}
      <details open={moreOpen} className="group border-b border-line bg-soft">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-[18px] t-small font-semibold text-secondary hover:text-navy [&::-webkit-details-marker]:hidden">
          <Icon name="search" className="size-4" />
          {t.more}
          <span className="font-normal">
            · {t.search} · {t.day}
          </span>
          <Icon name="down" className="ml-auto size-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-3 px-[18px] pb-4">
          <form action="/admin/today" role="search" className="flex gap-2">
            <input type="hidden" name="tab" value={tab} />
            {date !== today ? <input type="hidden" name="date" value={date} /> : null}
            <label className="sr-only" htmlFor="today-q">
              {t.search}
            </label>
            <input id="today-q" name="q" type="search" defaultValue={q} placeholder={t.searchPlaceholder} maxLength={60} className="admin-input min-w-0 flex-1" />
            <button type="submit" className="admin-btn px-4" aria-label={t.search}>
              <Icon name="search" />
            </button>
          </form>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { d: today, text: t.title },
              { d: tomorrow, text: t.tomorrow },
            ].map((o) => (
              <Link
                key={o.d}
                href={href({ date: o.d })}
                aria-current={date === o.d ? "date" : undefined}
                className={`inline-flex min-h-11 items-center rounded-[10px] border px-4 t-small font-semibold ${date === o.d ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-navy"}`}
              >
                {o.text}
              </Link>
            ))}
            <form action="/admin/today" className="flex w-full gap-2 sm:w-auto sm:flex-1">
              <input type="hidden" name="tab" value={tab} />
              <label className="sr-only" htmlFor="today-date">
                {t.day}
              </label>
              <input id="today-date" name="date" type="date" defaultValue={date} min={today} max={addDays(today, 30)} className="admin-input min-w-0 flex-1" />
              <button type="submit" className="admin-btn-secondary px-3">
                {t.goToDay}
              </button>
            </form>
          </div>
        </div>
      </details>

      {opsDown ? (
        <div role="alert" className="flex items-start gap-2.5 border-b border-warning/25 bg-warning-soft px-[18px] py-3 text-warning">
          <Icon name="alert" className="mt-0.5 size-5" />
          <p className="min-w-0 flex-1 t-small font-semibold">{data?.loadedAt ? t.opsDown(clock(data.loadedAt, t)) : t.opsDownShort}</p>
          <Link href={href({ job: jobParam || undefined })} prefetch={false} className="-my-2 inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md px-2 t-small font-semibold underline underline-offset-4 hover:bg-white/60">
            <Icon name="refresh" className="size-4" />
            {t.retry}
          </Link>
        </div>
      ) : null}

      <div className="min-h-[50dvh] px-[18px] pt-4 pb-6">
        {showHelp && data ? <HelpCard title={t.howTitle} body={t.help} gotIt={t.gotIt} /> : null}
        {error ? (
          <p role="alert" className="mb-4 flex items-start gap-2.5 rounded-[10px] border border-warning/25 bg-warning-soft px-3 py-2.5 t-small font-semibold text-warning">
            <Icon name="alert" className="mt-0.5 size-[18px]" />
            {error}
          </p>
        ) : null}

        {notSetUp ? (
          <div className="rounded-[12px] border border-line bg-soft p-4">
            <p className="font-semibold text-navy">{t.notSetUp}</p>
            {setupDetail ? (
              <p lang="en" className="mt-1 t-small text-secondary">
                {setupDetail}
              </p>
            ) : null}
          </div>
        ) : !data ? null : results ? (
          <SearchResults q={q} results={results} href={href} today={today} t={t} />
        ) : tab === "route" ? (
          <RouteList jobs={jobs} riders={riders} date={date} today={today} view={date} which={which} t={t} />
        ) : !next ? (
          <div className="py-10 text-center text-secondary">
            <p className="flex items-center justify-center gap-1.5 text-[17px] font-semibold text-success">
              <Icon name="check" className="size-5" />
              {t.allDone}
            </p>
            <p className="mt-1">{t.allDoneSub}</p>
          </div>
        ) : (
          <>
            {tab === "call" && lateCount ? (
              <p className="mb-3.5 flex items-center gap-2.5 rounded-[10px] bg-error-soft px-3 py-2.5 text-[15px] font-semibold text-error">
                <Icon name="alert" className="size-5" />
                {t.lateNote(lateCount)}
              </p>
            ) : null}
            <section aria-labelledby="today-next">
              <h2 id="today-next" className="mb-2 text-[14px] font-semibold text-secondary">
                {t.nextUp}
              </h2>
              <NextUpCard key={next.id} item={next} t={t} lang={lang} today={today} view={date} sheet={sheet} />
            </section>
            {rest.length ? (
              <section aria-labelledby="today-then" className="mt-5">
                <h2 id="today-then" className="mb-1 text-[14px] font-semibold text-secondary">
                  {t.then}
                </h2>
                <ul className="border-t border-line">
                  {rest.map((i) => (
                    <JobRow key={i.id} item={i} href={href({ job: i.id })} today={today} t={t} />
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </div>

      <div className="sticky bottom-0 z-10 border-t border-line bg-white">
        {toast ? (
          <p role="status" data-today-toast className="pointer-events-none absolute bottom-full left-1/2 mb-3 w-max max-w-[calc(100%-32px)] -translate-x-1/2 rounded-[10px] bg-navy px-4 py-2.5 text-center t-small font-semibold text-white shadow-[0_8px_24px_color-mix(in_srgb,var(--velto-navy)_25%,transparent)]">
            {toast}
          </p>
        ) : null}
        {data ? <TodayTabs active={results ? null : tab} counts={counts} late={lateCount > 0} href={(id) => href({ tab: id })} t={t} /> : null}
      </div>
    </div>
  );
}

/** Search (name, phone, VEL-number) across every list; each result opens its card. */
function SearchResults({
  q,
  results,
  href,
  today,
  t,
}: {
  q: string;
  results: { items: ListItem[]; stops: DispatchJob[] };
  href: (next: { tab?: TodayTab; job?: string; date?: string }) => string;
  today: string;
  t: TodayText;
}) {
  const n = results.items.length + results.stops.length;
  return (
    <section aria-labelledby="today-results">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 id="today-results" className="min-w-0 text-[15px] font-semibold text-navy [overflow-wrap:anywhere]">
          {t.search}: “{q}” · <span className="font-normal text-secondary">{t.searchResults(n)}</span>
        </h2>
        <Link href={href({})} className="inline-flex min-h-11 shrink-0 items-center t-small font-semibold text-action underline underline-offset-4">
          {t.clearSearch}
        </Link>
      </div>
      {!n ? <p className="py-6 text-center text-secondary">{t.noResults}</p> : null}
      <ul className="border-t border-line">
        {results.items.map((i) => (
          <JobRow key={i.id} item={i} href={href({ tab: i.tab, job: i.id })} today={today} t={t} />
        ))}
        {results.stops.map((j) => (
          <li key={j.id} className="border-b border-line">
            <Link href={href({ tab: "route", date: j.slot_date && j.slot_date >= today ? j.slot_date : undefined })} className="grid min-h-[64px] grid-cols-[1fr_auto] items-center gap-x-3 rounded-[8px] px-0.5 py-3 hover:bg-soft/70">
              <span className="min-w-0">
                <span className="block truncate text-[16px] font-semibold text-navy">
                  {j.kind === "delivery" ? "↓" : "↑"} {j.customer_name ?? j.phone ?? ""}
                </span>
                <span className="block truncate text-[14px] text-secondary">
                  {[t.tabs.route, j.slot ? windowText(j.slot, j.slot_date, today, t) : j.stage === "picked" ? t.whichOrder : "", j.assignee_name, j.order_number].filter(Boolean).join(" · ")}
                </span>
              </span>
              <Icon name="chevron" className="size-5 text-secondary" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
