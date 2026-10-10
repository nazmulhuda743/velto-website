/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const { parseCareers, linesToList, normaliseWhatsApp, localizeJob, openJobs, applyHref, displayNumber, applyNumber } = require("../.foundation-test-build/careers.js");

test("careers: bad or missing data falls back to no roles, never throws", () => {
  assert.deepEqual(parseCareers(undefined), { whatsappNumber: "", facebookUrl: "", jobs: [] });
  assert.deepEqual(parseCareers({ jobs: "nope", whatsappNumber: "abc", facebookUrl: "http://x" }), { whatsappNumber: "", facebookUrl: "", jobs: [] });
  const c = parseCareers({ jobs: [{ title: "" }, { title: "Rider", type: "weird", postedAt: "10/10/2026", duties: ["a", 3, ""] }] });
  assert.equal(c.jobs.length, 1, "a role without a title is dropped");
  assert.equal(c.jobs[0].type, "full-time");
  assert.equal(c.jobs[0].postedAt, "");
  assert.deepEqual(c.jobs[0].duties, ["a"]);
  assert.equal(c.jobs[0].open, true, "roles are open unless closed");
});

test("careers: only open roles are shown", () => {
  const c = parseCareers({ jobs: [{ title: "A" }, { title: "B", open: false }] });
  assert.deepEqual(openJobs(c).map((j) => j.title), ["A"]);
});

test("careers: lists are one item per line, bullets stripped", () => {
  assert.deepEqual(linesToList("• Iron shirts\n\n- Fold and pack\n  * Report stains  \n"), ["Iron shirts", "Fold and pack", "Report stains"]);
});

test("careers: Bangladeshi numbers get the country code; junk is rejected", () => {
  assert.equal(normaliseWhatsApp("01605-162788"), "8801605162788");
  assert.equal(normaliseWhatsApp("+880 1605 162788"), "8801605162788");
  assert.equal(normaliseWhatsApp(""), "");
  assert.equal(normaliseWhatsApp("call me"), null);
  assert.equal(displayNumber("8801605162788"), "+880 1605-162788");
  assert.equal(applyNumber({ whatsappNumber: "", facebookUrl: "", jobs: [] }, "8801000000000"), "8801000000000");
});

test("careers: Bangla fields are used on Bangla pages, English where Bangla is empty", () => {
  const [job] = parseCareers({ jobs: [{ title: "Rider", titleBn: "রাইডার", summary: "Deliver", duties: ["Ride"], dutiesBn: [] }] }).jobs;
  const bn = localizeJob(job, "bn");
  assert.equal(bn.title, "রাইডার");
  assert.equal(bn.summary, "Deliver");
  assert.deepEqual(bn.duties, ["Ride"]);
  assert.equal(localizeJob(job, "en").title, "Rider");
});

test("careers: the apply link opens WhatsApp with the message ready", () => {
  const href = applyHref("8801605162788", "Hello Velto,\nName:");
  const url = new URL(href);
  assert.equal(url.origin + url.pathname, "https://wa.me/8801605162788");
  assert.equal(url.searchParams.get("text"), "Hello Velto,\nName:");
});
