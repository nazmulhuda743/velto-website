/* eslint-disable @typescript-eslint/no-require-imports */
// Local-only synthetic UI QA. Database integration has separate staging SQL tests.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");
const base = "http://localhost:3000";
const server = spawn("npm", ["run", "dev", "--", "--hostname", "0.0.0.0"], {
  cwd: process.cwd(),
  env: { ...process.env, VELTO_ADMIN_PREVIEW: "1" },
  stdio: "inherit",
});
async function appointment(page, name, time, rider = "rider-1") {
  await page
    .getByRole("button", { name: "+ New Appointment", exact: true })
    .click();
  const form = page.getByRole("dialog");
  await form.waitFor();
  await form.getByRole("button", { name: "New customer", exact: true }).click();
  await form.getByLabel("Customer name", { exact: true }).fill(name);
  await form.getByLabel("Mobile number", { exact: true }).fill("01900009985");
  await form.getByLabel("Sector / area", { exact: true }).fill("Sector 11");
  await form
    .getByLabel("Pickup address", { exact: true })
    .fill("QA fixture, House 4 Road 1");
  await form
    .getByLabel("Exact start · Dhaka", { exact: true })
    .selectOption(time);
  await form.getByLabel("Rider", { exact: true }).selectOption(rider);
  return form;
}
async function save(form, name = "Save appointment") {
  await form.getByRole("button", { name, exact: true }).click();
  await form.waitFor({ state: "hidden" });
}
(async () => {
  for (let i = 0; i < 60; i++) {
    try {
      await fetch("http://127.0.0.1:3000/admin/today", {
        signal: AbortSignal.timeout(1000),
      });
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  const browser = await chromium.launch({
    executablePath: process.env.BROWSER_PATH || undefined,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const p = await desktop.newPage(),
    q = await mobile.newPage(),
    errors = [];
  for (const page of [p, q])
    page.on("pageerror", (error) => errors.push(error.message));
  await Promise.all([
    p.goto(base + "/admin/today"),
    q.goto(base + "/admin/today"),
  ]);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: "/tmp/scheduler-desktop.png", fullPage: true });
  await q.screenshot({ path: "/tmp/scheduler-mobile.png", fullPage: true });
  await Promise.all([
    p.getByRole("button", { name: "Tomorrow", exact: true }).click(),
    q.getByRole("button", { name: "Tomorrow", exact: true }).click(),
  ]);
  await p.getByRole("heading", { name: "Tomorrow", exact: true }).waitFor();
  let form = await appointment(q, "Browser QA pickup", "14:00");
  await q.screenshot({ path: "/tmp/scheduler-editor-mobile.png" });
  await save(form);
  await p.waitForFunction(
    () => document.body.innerText.includes("Browser QA pickup"),
    {},
    { timeout: 15000 },
  );
  console.log("PASS independent session sees save through polling");
  const card = q
    .locator(".schedule-timeline .schedule-card")
    .filter({ hasText: "Browser QA pickup" });
  await card.getByRole("button", { name: "View / edit" }).click();
  form = q.getByRole("dialog");
  await form.waitFor();
  await form
    .getByLabel("Notes", { exact: true })
    .fill("Draft survives polling");
  await q.waitForTimeout(5500);
  assert.equal(
    await form.getByLabel("Notes", { exact: true }).inputValue(),
    "Draft survives polling",
  );
  await save(form, "Save changes");
  await card.getByRole("button", { name: "Start", exact: true }).click();
  await card.getByRole("button", { name: "Complete", exact: true }).click();
  await q.getByLabel("Show", { exact: true }).selectOption("completed");
  await card.waitFor();
  assert.ok((await card.innerText()).includes("Completed"));
  await q.getByLabel("Show", { exact: true }).selectOption("active");
  console.log("PASS new caller, edit, draft, start, complete, history");
  // Both browser contexts form competing appointments before either submits.
  const f1 = await appointment(p, "Browser QA race A", "16:30");
  const f2 = await appointment(q, "Browser QA race B", "16:30");
  await Promise.all([
    f1.getByRole("button", { name: "Save appointment", exact: true }).click(),
    f2.getByRole("button", { name: "Save appointment", exact: true }).click(),
  ]);
  await p.waitForTimeout(1500);
  const results = await Promise.all([f1.count(), f2.count()]);
  assert.equal(
    results.reduce((sum, n) => sum + n, 0),
    1,
  );
  const loser = results[0] ? f1 : f2;
  await loser.getByRole("alert").waitFor();
  assert.match(
    await loser.getByRole("alert").innerText(),
    /booked for overlapping work/,
  );
  await loser
    .getByRole("button", { name: "Close without saving", exact: true })
    .click();
  console.log("PASS two-context conflict preserves losing form");
  // Existing customer search and prefill.
  await q
    .getByRole("button", { name: "+ New Appointment", exact: true })
    .click();
  form = q.getByRole("dialog");
  await form.waitFor();
  await form.getByLabel("Find a customer", { exact: true }).fill("01711000001");
  await form
    .locator(".schedule-search-results button")
    .filter({ hasText: "Customer ·" })
    .first()
    .click();
  assert.equal(
    await form.getByLabel("Customer name", { exact: true }).inputValue(),
    "Rahim Ahmed",
  );
  await form
    .getByLabel("Exact start · Dhaka", { exact: true })
    .selectOption("11:00");
  await save(form);
  console.log("PASS existing customer search/prefill and unassigned save");
  for (const kind of ["Processing", "Delivery"]) {
    await q
      .getByRole("button", { name: "+ New Appointment", exact: true })
      .click();
    form = q.getByRole("dialog");
    await form.waitFor();
    await form.getByRole("button", { name: kind, exact: true }).click();
    await form.getByLabel("Find an order", { exact: true }).fill("VEL-01934");
    await form.locator(".schedule-search-results button").first().click();
    await form
      .getByLabel("Exact start · Dhaka", { exact: true })
      .selectOption("10:30");
    await form
      .getByLabel(kind === "Processing" ? "Worker / resource" : "Rider", {
        exact: true,
      })
      .selectOption(kind === "Processing" ? "worker-1" : "rider-2");
    if (kind === "Processing")
      await form.getByLabel("Duration", { exact: true }).selectOption("90");
    await save(form);
    const work = q
      .locator(".schedule-timeline .schedule-card")
      .filter({ has: q.locator(".schedule-kind", { hasText: kind }) });
    await work
      .first()
      .getByRole("button", { name: "Start", exact: true })
      .click();
    await work
      .first()
      .getByRole("button", { name: "Complete", exact: true })
      .click();
    await work.first().waitFor({ state: "hidden" });
    console.log("PASS " + kind + " order search, create, start, complete");
  }
  assert.equal(
    await q.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
  );
  await q.getByRole("button", { name: "বাংলা", exact: true }).click();
  await q
    .getByRole("button", { name: "+ নতুন অ্যাপয়েন্টমেন্ট", exact: true })
    .waitFor();
  await q
    .getByRole("button", { name: "+ নতুন অ্যাপয়েন্টমেন্ট", exact: true })
    .click();
  const bangla = q.getByRole("dialog");
  await bangla.waitFor();
  await bangla.getByLabel("গ্রাহকের নাম", { exact: true }).waitFor();
  assert.equal(
    await bangla.getByLabel("অনুরোধ এসেছে", { exact: true }).inputValue(),
    "phone",
  );
  await bangla
    .getByLabel("অনুরোধ এসেছে", { exact: true })
    .selectOption("manager");
  assert.equal(
    await bangla.getByLabel("অনুরোধ এসেছে", { exact: true }).inputValue(),
    "manager",
  );
  assert.equal(
    await q.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
  );
  await q.screenshot({ path: "/tmp/scheduler-bangla-mobile.png" });
  console.log("PASS existing Bangla preference and translated mobile form");
  assert.deepEqual(errors, []);
  console.log("PASS mobile overflow and uncaught JavaScript errors");
  await browser.close();
  server.kill();
  process.exit(0);
})().catch((error) => {
  console.error(error);
  server.kill();
  process.exit(1);
});
