import { NextResponse, type NextRequest } from "next/server";
import { PLAYBOOK_ID, renderMessage, rhythmLink, smsHourOk, SMS_PLAYBOOKS, templateFor } from "@/lib/rhythm";
import { markTouch, recordTouch, refreshRhythm, rhythmCandidates, rhythmReady, runKeyOk, staffTask, type Candidate } from "@/lib/rhythm-server";
import { getSiteContent } from "@/lib/site-content";
import { SITE_URL } from "@/lib/site-url";
import { sendSms, smsConfigured } from "@/lib/sms/send";
import { reminderMessage } from "@/lib/push/messages";
import { sendAndRecord, type PushTarget } from "@/lib/push/server";
import { supabaseRpc } from "@/lib/supabase-server";

/**
 * The daily Velto Rhythm run, called by pg_cron (docs/technical/sql/website_rhythm_schedule.sql)
 * with the key stored in the database:
 *   evening  refresh, then each switched-on reminder playbook in turn (regular, due now; first-timer;
 *            season), one reminder per customer: a free notification when they allowed it,
 *            otherwise (or if it fails) an SMS
 *   morning  refresh, then Ops call tasks for slipping regulars (same)
 * Who qualifies (caps, open orders, opt-outs, hold-out) is decided in the database.
 */
export const maxDuration = 60;

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function inBatches<T>(list: T[], size: number, fn: (item: T) => Promise<void>) {
  for (let i = 0; i < list.length; i += size) await Promise.all(list.slice(i, i + size).map(fn));
}

export async function POST(request: NextRequest) {
  const key = request.headers.get("x-rhythm-key") ?? "";
  if (!rhythmReady() || key.length < 32 || !(await runKeyOk(key).catch(() => false))) return json({ ok: false }, 401);

  const body = (await request.json().catch(() => ({}))) as { mode?: unknown };
  const mode = body.mode === "morning" ? "morning" : body.mode === "evening" ? "evening" : null;
  if (!mode) return json({ ok: false, error: "mode" }, 400);

  const { rhythm } = await getSiteContent();
  const refreshed = await refreshRhythm();
  const summary = { ok: true, mode, refreshed, sent: 0, pushed: 0, failed: 0, holdout: 0, tasks: 0, skipped: "" as string };

  if (mode === "evening") {
    if (!SMS_PLAYBOOKS.some((k) => rhythm[k].enabled)) return json({ ...summary, skipped: "off" });
    if (!smsHourOk()) return json({ ...summary, skipped: "quiet_hours" });
    const sms = smsConfigured();
    // In order; the database's one-a-week rule keeps a customer to one reminder across playbooks.
    for (const key of SMS_PLAYBOOKS) {
      const p = rhythm[key];
      if (!p.enabled) continue;
      const playbook = PLAYBOOK_ID[key];
      const list = await rhythmCandidates(playbook, p.maxPerRun);
      await inBatches(list, 5, async (c: Candidate) => {
        if (c.holdout) {
          await recordTouch(c.customer_id, playbook, "holdout", p.lang);
          summary.holdout++;
          return;
        }
        // Allowed notifications on a phone: a free push first.
        const targets = await supabaseRpc<PushTarget[]>("website_push_targets_for_customer", { p_customer: c.customer_id }).catch(() => []);
        if (targets.length) {
          const pushCode = await recordTouch(c.customer_id, playbook, "push", p.lang);
          if (pushCode) {
            const results = await Promise.all(
              targets.slice(0, 5).map((t) =>
                sendAndRecord(t, reminderMessage({ firstName: c.first_name, service: c.usual_service, code: pushCode, playbook }, t.lang === "en" ? "en" : "bn")),
              ),
            );
            await markTouch(pushCode, results.some(Boolean));
            if (results.some(Boolean)) {
              summary.pushed++;
              return;
            }
          }
        }
        if (!sms) return;
        const code = await recordTouch(c.customer_id, playbook, "sms", p.lang);
        if (!code) return;
        const text = renderMessage(templateFor(key, p, c.usual_service, p.lang), { firstName: c.first_name, service: c.usual_service, link: rhythmLink(SITE_URL, code, p.lang) }, p.lang);
        const r = await sendSms(c.phone, text);
        await markTouch(code, r.ok);
        if (r.ok) summary.sent++;
        else summary.failed++;
      });
    }
    return json(summary);
  }

  const s = rhythm.slipping;
  if (!s.enabled) return json({ ...summary, skipped: "off" });
  const list = await rhythmCandidates("slipping", s.maxPerDay);
  for (const c of list) {
    if (c.holdout) {
      await recordTouch(c.customer_id, "slipping", "holdout", "bn");
      summary.holdout++;
    } else if (await staffTask(c.customer_id)) {
      summary.tasks++;
    }
  }
  return json(summary);
}
