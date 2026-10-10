"use server";

import { redirect } from "next/navigation";
import { logActivity } from "@/lib/admin/activity";
import { saveContent } from "@/lib/admin/content-store";
import { requireSection } from "@/lib/admin/session";
import { logServerEvent } from "@/lib/analytics/store";
import { isHttpsUrl, JOB_TYPES, linesToList, MAX_JOBS, normaliseWhatsApp, type JobPost, type JobType } from "@/lib/careers";
import { getSiteContent } from "@/lib/site-content";

const PAGE = "/admin/careers";
const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);
const back = (params: Record<string, string>): never => redirect(`${PAGE}?${new URLSearchParams(params)}`);
const failure = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong.").slice(0, 160);
const today = () => new Date(Date.now() + 6 * 3600_000).toISOString().slice(0, 10); // Dhaka date

function jobFromForm(form: FormData, id: string, postedAt: string): JobPost | string {
  const title = text(form, "title", 100);
  if (!title) return "Give the role a title, for example Ironing Specialist.";
  const type = text(form, "type", 20) as JobType;
  return {
    id,
    open: form.get("open") === "on",
    title,
    titleBn: text(form, "titleBn", 100),
    type: JOB_TYPES.includes(type) ? type : "full-time",
    location: text(form, "location", 120),
    locationBn: text(form, "locationBn", 120),
    schedule: text(form, "schedule", 160),
    scheduleBn: text(form, "scheduleBn", 160),
    salary: text(form, "salary", 80),
    salaryBn: text(form, "salaryBn", 80),
    summary: text(form, "summary", 600),
    summaryBn: text(form, "summaryBn", 600),
    duties: linesToList(text(form, "duties", 4000)),
    dutiesBn: linesToList(text(form, "dutiesBn", 4000)),
    requirements: linesToList(text(form, "requirements", 4000)),
    requirementsBn: linesToList(text(form, "requirementsBn", 4000)),
    offer: linesToList(text(form, "offer", 4000)),
    offerBn: linesToList(text(form, "offerBn", 4000)),
    postedAt,
  };
}

/** Add, edit, open/close, reorder or delete a role. */
export async function saveJobAction(form: FormData) {
  const admin = await requireSection("careers");
  const careers = (await getSiteContent()).careers;
  const jobs = [...careers.jobs];
  const op = text(form, "op", 10) || "save";
  const id = text(form, "id", 40);
  const index = jobs.findIndex((j) => j.id === id);
  const title = index >= 0 ? jobs[index].title : text(form, "title", 100);

  if (op === "add") {
    if (jobs.length >= MAX_JOBS) back({ error: `Up to ${MAX_JOBS} roles can be listed. Delete an old closed role first.` });
    const job = jobFromForm(form, `job-${Date.now().toString(36)}`, today());
    if (typeof job === "string") back({ error: job });
    jobs.unshift(job as JobPost);
  } else if (index === -1) {
    back({ error: "That role was not found. It may have been deleted in another tab." });
  } else if (op === "delete") {
    jobs.splice(index, 1);
  } else if (op === "toggle") {
    jobs[index] = { ...jobs[index], open: !jobs[index].open };
  } else if (op === "up" || op === "down") {
    const to = op === "up" ? index - 1 : index + 1;
    if (to >= 0 && to < jobs.length) [jobs[index], jobs[to]] = [jobs[to], jobs[index]];
  } else {
    const job = jobFromForm(form, id, jobs[index].postedAt || today());
    if (typeof job === "string") back({ error: job });
    jobs[index] = job as JobPost;
  }

  try {
    await saveContent("careers", { ...careers, jobs }, admin.name);
  } catch (e) {
    await logServerEvent("content_save_error", PAGE);
    back({ error: failure(e) });
  }
  const after = jobs.find((j) => j.id === id) ?? (op === "add" ? jobs[0] : undefined);
  const verb =
    op === "toggle"
      ? after?.open
        ? "Reopened"
        : "Closed"
      : ({ add: "Posted", delete: "Deleted", up: "Moved up", down: "Moved down" } as Record<string, string>)[op] ?? "Edited";
  await logActivity(admin, { section: "careers", action: `job_${op}`, target: after?.id ?? id, summary: `${verb} the ${title || "job"} role` });
  back({ saved: "1" });
}

/** Where applications go, and the team page link. */
export async function saveCareersSettingsAction(form: FormData) {
  const admin = await requireSection("careers");
  const careers = (await getSiteContent()).careers;
  const number = normaliseWhatsApp(text(form, "whatsappNumber", 20));
  if (number === null) back({ error: "Write the WhatsApp number as 01XXXXXXXXX or with the country code, e.g. 8801XXXXXXXXX." });
  const facebookUrl = text(form, "facebookUrl", 300);
  if (facebookUrl && !isHttpsUrl(facebookUrl)) back({ error: "The Facebook link must start with https://" });
  try {
    await saveContent("careers", { ...careers, whatsappNumber: number ?? "", facebookUrl }, admin.name);
  } catch (e) {
    await logServerEvent("content_save_error", PAGE);
    back({ error: failure(e) });
  }
  await logActivity(admin, { section: "careers", action: "careers_settings", summary: "Updated the careers contact settings" });
  back({ saved: "1" });
}
