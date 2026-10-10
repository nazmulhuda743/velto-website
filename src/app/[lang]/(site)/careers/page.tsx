import { SectionIntro } from "@/components/home/SectionIntro";
import { BulletList } from "@/components/pages/BulletList";
import { PageHero } from "@/components/pages/PageHero";
import { JsonLd } from "@/components/seo/JsonLd";
import { WhatsAppButton } from "@/components/ui/Button";
import { TextLink } from "@/components/ui/TextLink";
import { dictionary } from "@/content/i18n";
import { pageText } from "@/content/i18n/pages";
import { SOCIAL_PROFILES } from "@/content/site";
import { applyHref, applyNumber, displayNumber, localizeJob, openJobs, SCHEMA_EMPLOYMENT } from "@/lib/careers";
import { fill } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { absoluteUrl, SITE_NAME } from "@/lib/seo/site";
import { getSiteContent } from "@/lib/site-content";

export const generateMetadata = () => pageMetadata("/careers");

const DAY = 86_400_000;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

function postedLabel(date: string, locale: "en" | "bn") {
  if (!date) return "";
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function CareersPage() {
  const locale = await getLocale();
  const d = dictionary(locale);
  const t = pageText(locale).careersPage;
  const { careers, settings } = await getSiteContent();
  const number = applyNumber(careers, settings.whatsappNumber);
  const jobs = openJobs(careers);
  const teamPage = careers.facebookUrl || SOCIAL_PROFILES.find((p) => p.id === "facebook")?.href || "";

  // Google's job listings read English JobPosting data; one entry per open role.
  const postings = jobs.map((job) => {
    const en = localizeJob(job, "en");
    const section = (title: string, items: string[]) => (items.length ? `<p>${title}</p><ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : "");
    const en_t = pageText("en").careersPage;
    return {
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: en.title,
      description: [
        en.summary ? `<p>${esc(en.summary)}</p>` : "",
        section(en_t.duties, en.duties),
        section(en_t.requirements, en.requirements),
        section(en_t.offer, en.offer),
      ].join("") || `<p>${esc(en.title)} at ${SITE_NAME}, Uttara, Dhaka.</p>`,
      ...(job.postedAt
        ? { datePosted: job.postedAt, validThrough: new Date(Date.parse(`${job.postedAt}T00:00:00Z`) + 60 * DAY).toISOString().slice(0, 10) }
        : {}),
      employmentType: SCHEMA_EMPLOYMENT[job.type],
      hiringOrganization: { "@type": "Organization", name: SITE_NAME, sameAs: absoluteUrl("/") },
      jobLocation: {
        "@type": "Place",
        address: {
          "@type": "PostalAddress",
          ...(en.location ? { streetAddress: en.location } : {}),
          addressLocality: "Uttara",
          addressRegion: "Dhaka",
          addressCountry: "BD",
        },
      },
      directApply: false,
      url: `${absoluteUrl("/careers")}#${job.id}`,
    };
  });

  return (
    <>
      <PageHero path="/careers" crumbs={[{ label: d.common.home, href: "/" }, { label: t.crumb }]} title={t.title} eyebrow={t.eyebrow} highlight={t.highlight}>
        <p>{t.intro}</p>
      </PageHero>

      {postings.length ? <JsonLd data={postings} /> : null}

      <section id="open-roles" aria-labelledby="roles-title" className="bg-warm py-(--space-section)">
        <div className="container-page">
          <SectionIntro id="roles-title" eyebrow={t.openEyebrow} title={t.openTitle}>
            <p>{t.openIntro}</p>
          </SectionIntro>

          {jobs.length === 0 ? (
            <div className="mt-(--space-intro-content) max-w-[640px] border-t border-line pt-8">
              <h3 className="t-h4 text-navy">{t.noneTitle}</h3>
              <p className="mt-3 text-body">{t.noneBody}</p>
              {teamPage ? (
                <div className="mt-5">
                  <TextLink href={teamPage} external placement="careers_empty">
                    {t.followTeam}
                  </TextLink>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-(--space-intro-content)">
              {jobs.map((raw) => {
                const job = localizeJob(raw, locale);
                const facts = [
                  { label: t.where, value: job.location },
                  { label: t.hours, value: job.schedule },
                  { label: t.salary, value: job.salary },
                ].filter((f) => f.value);
                const groups = [
                  { title: t.duties, items: job.duties },
                  { title: t.requirements, items: job.requirements },
                  { title: t.offer, items: job.offer },
                ].filter((g) => g.items.length);
                const message = fill(t.applyMessage, { role: job.title }, locale);
                return (
                  <article key={job.id} id={job.id} aria-labelledby={`${job.id}-title`} className="grid-page scroll-mt-28 gap-y-8 border-t border-line py-10 last:border-b md:py-12">
                    <div className="col-span-4 min-w-0 md:col-span-8 xl:col-span-5">
                      <p className="t-label uppercase text-action-hover">{t.types[job.type]}</p>
                      <h3 id={`${job.id}-title`} className="mt-2 t-h3 text-navy">
                        {job.title}
                      </h3>
                      {facts.length ? (
                        <dl className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-[auto_1fr]">
                          {facts.map((f) => (
                            <div key={f.label} className="contents">
                              <dt className="t-small font-semibold text-secondary">{f.label}</dt>
                              <dd className="t-small text-body">{f.value}</dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                      {job.summary ? <p className="mt-5 max-w-[52ch] text-body">{job.summary}</p> : null}
                      <div className="mt-7">
                        <WhatsAppButton href={applyHref(number, message)} placement="careers_apply">
                          {t.apply}
                        </WhatsAppButton>
                      </div>
                      <p className="mt-3 t-small text-secondary">
                        {fill(t.applyNote, { number: displayNumber(number) }, locale)}
                      </p>
                      {job.postedAt ? <p className="mt-4 t-caption text-muted">{fill(t.posted, { date: postedLabel(job.postedAt, locale) }, locale)}</p> : null}
                    </div>
                    {groups.length ? (
                      <div className="col-span-4 min-w-0 space-y-8 md:col-span-8 xl:col-span-6 xl:col-start-7">
                        {groups.map((g) => (
                          <div key={g.title}>
                            <h4 className="t-h4 text-navy">{g.title}</h4>
                            <BulletList items={g.items} className="mt-3" />
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="hiring-title" className="py-(--space-section)">
        <div className="container-page grid-page gap-y-10">
          <div className="col-span-4 md:col-span-8 xl:col-span-5">
            <SectionIntro id="hiring-title" eyebrow={t.processEyebrow} title={t.processTitle} />
            {teamPage && jobs.length ? (
              <div className="mt-6">
                <TextLink href={teamPage} external placement="careers_process">
                  {t.followTeam}
                </TextLink>
              </div>
            ) : null}
          </div>
          <ol className="col-span-4 md:col-span-8 xl:col-span-6 xl:col-start-7">
            {t.steps.map((step, i) => (
              <li key={step.title} className="grid grid-cols-[2.5rem_1fr] gap-x-4 border-t border-line py-5 last:border-b">
                <span aria-hidden="true" className="t-h4 tabular-nums text-blue">
                  {fill("{n}", { n: i + 1 }, locale)}
                </span>
                <div className="min-w-0">
                  <h3 className="t-h4 text-navy">{step.title}</h3>
                  <p className="mt-1.5 text-body">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
