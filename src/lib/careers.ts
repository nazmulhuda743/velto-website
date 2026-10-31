/**
 * Careers: open roles posted from the admin dashboard (admin → Careers & jobs), stored in
 * website_content ("careers") and shown on /careers. Pure (no server imports), so the
 * parsing and the apply link are unit-tested.
 */

export const JOB_TYPES = ["full-time", "part-time", "contract"] as const;
export type JobType = (typeof JOB_TYPES)[number];

export type JobPost = {
  id: string;
  /** Closed roles stay in the admin list but are not shown on the website. */
  open: boolean;
  title: string;
  titleBn: string;
  type: JobType;
  location: string;
  locationBn: string;
  /** Working days and hours, e.g. "6 days a week, 10 AM to 8 PM". */
  schedule: string;
  scheduleBn: string;
  /** Optional, e.g. "৳18,000 to ৳22,000 a month". Empty means it is not shown. */
  salary: string;
  salaryBn: string;
  summary: string;
  summaryBn: string;
  duties: string[];
  dutiesBn: string[];
  requirements: string[];
  requirementsBn: string[];
  offer: string[];
  offerBn: string[];
  /** YYYY-MM-DD, set when the role is first posted. */
  postedAt: string;
};

export type CareersContent = {
  /** Digits with country code for applications. Empty: the site's WhatsApp number is used. */
  whatsappNumber: string;
  /** The team page on Facebook (Life at Velto). Empty: no link is shown. */
  facebookUrl: string;
  jobs: JobPost[];
};

export const DEFAULT_CAREERS: CareersContent = { whatsappNumber: "", facebookUrl: "", jobs: [] };

export const MAX_JOBS = 30;
export const MAX_LIST_ITEMS = 12;

const rec = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const list = (v: unknown) =>
  Array.isArray(v) ? v.map((item) => str(item, 240)).filter(Boolean).slice(0, MAX_LIST_ITEMS) : [];

/** One item per line, blank lines dropped: how the admin form sends lists. */
export const linesToList = (text: string) =>
  text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s•\-*]+/, "").trim().slice(0, 240))
    .filter(Boolean)
    .slice(0, MAX_LIST_ITEMS);

/** Bangladeshi numbers typed as 01XXXXXXXXX become 8801XXXXXXXXX; anything else must already be digits with a country code. */
export function normaliseWhatsApp(input: string): string | null {
  const digits = input.replace(/[\s()+-]/g, "");
  if (!digits) return "";
  if (/^01\d{9}$/.test(digits)) return `88${digits}`;
  return /^\d{8,15}$/.test(digits) ? digits : null;
}

export const isHttpsUrl = (v: string) => /^https:\/\/[^\s"'<>]+$/.test(v) && v.length <= 300;

function parseJob(v: unknown, i: number): JobPost | null {
  const j = rec(v);
  const title = str(j.title, 100);
  if (!title) return null;
  const posted = str(j.postedAt, 10);
  return {
    id: str(j.id, 40) || `job-${i + 1}`,
    open: j.open !== false,
    title,
    titleBn: str(j.titleBn, 100),
    type: JOB_TYPES.includes(j.type as JobType) ? (j.type as JobType) : "full-time",
    location: str(j.location, 120),
    locationBn: str(j.locationBn, 120),
    schedule: str(j.schedule, 160),
    scheduleBn: str(j.scheduleBn, 160),
    salary: str(j.salary, 80),
    salaryBn: str(j.salaryBn, 80),
    summary: str(j.summary, 600),
    summaryBn: str(j.summaryBn, 600),
    duties: list(j.duties),
    dutiesBn: list(j.dutiesBn),
    requirements: list(j.requirements),
    requirementsBn: list(j.requirementsBn),
    offer: list(j.offer),
    offerBn: list(j.offerBn),
    postedAt: /^\d{4}-\d{2}-\d{2}$/.test(posted) ? posted : "",
  };
}

export function parseCareers(v: unknown): CareersContent {
  const c = rec(v);
  const number = normaliseWhatsApp(str(c.whatsappNumber, 20));
  const facebook = str(c.facebookUrl, 300);
  const jobs = Array.isArray(c.jobs) ? c.jobs.slice(0, MAX_JOBS).map(parseJob).filter((j): j is JobPost => j !== null) : [];
  return { whatsappNumber: number ?? "", facebookUrl: isHttpsUrl(facebook) ? facebook : "", jobs };
}

export const openJobs = (careers: CareersContent) => careers.jobs.filter((j) => j.open);

type Locale = "en" | "bn";

/** The job in the page language: Bangla fields where filled in, English otherwise. */
export function localizeJob(job: JobPost, locale: Locale) {
  const pick = (en: string, bn: string) => (locale === "bn" && bn ? bn : en);
  const pickList = (en: string[], bn: string[]) => (locale === "bn" && bn.length ? bn : en);
  return {
    id: job.id,
    title: pick(job.title, job.titleBn),
    type: job.type,
    location: pick(job.location, job.locationBn),
    schedule: pick(job.schedule, job.scheduleBn),
    salary: pick(job.salary, job.salaryBn),
    summary: pick(job.summary, job.summaryBn),
    duties: pickList(job.duties, job.dutiesBn),
    requirements: pickList(job.requirements, job.requirementsBn),
    offer: pickList(job.offer, job.offerBn),
    postedAt: job.postedAt,
  };
}

/** The number applications go to: the careers number, else the site's WhatsApp. */
export const applyNumber = (careers: CareersContent, siteNumber: string) => careers.whatsappNumber || siteNumber;

/** wa.me link with the applicant's first message ready to send. */
export function applyHref(number: string, message: string) {
  const url = new URL(`https://wa.me/${number}`);
  url.searchParams.set("text", message.slice(0, 500));
  return url.toString();
}

/** "8801605162788" → "+880 1605-162788", the way Bangladeshi numbers are usually written. */
export function displayNumber(number: string) {
  const m = /^880(1\d{3})(\d{6})$/.exec(number);
  return m ? `+880 ${m[1]}-${m[2]}` : `+${number}`;
}

/** schema.org employmentType for Google's job listings. */
export const SCHEMA_EMPLOYMENT: Record<JobType, string> = {
  "full-time": "FULL_TIME",
  "part-time": "PART_TIME",
  contract: "CONTRACTOR",
};
