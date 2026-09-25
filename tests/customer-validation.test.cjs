/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");

const v = require("../.foundation-test-build/customer/validation.js");

test("normalises Bangladeshi mobile numbers and rejects everything else", () => {
  assert.equal(v.normaliseBdPhone("01712 345678"), "01712345678");
  assert.equal(v.normaliseBdPhone("+8801712-345678"), "01712345678");
  assert.equal(v.normaliseBdPhone("008801712345678"), "01712345678");
  assert.equal(v.normaliseBdPhone("8801912345678"), "01912345678");
  assert.equal(v.normaliseBdPhone("01212345678"), null, "operator prefix 012 is not a mobile network");
  assert.equal(v.normaliseBdPhone("0171234567"), null, "too short");
  assert.equal(v.normaliseBdPhone("+441712345678"), null);
  assert.equal(v.normaliseBdPhone(""), null);
});

test("passwords need length plus a letter and a number", () => {
  assert.equal(v.passwordProblem("short1"), `Use at least ${v.PASSWORD_MIN} characters.`);
  assert.match(v.passwordProblem("onlyletters"), /letter and one number/);
  assert.match(v.passwordProblem("12345678"), /letter and one number/);
  assert.equal(v.passwordProblem("laundry2026"), null);
  assert.match(v.passwordProblem(`a1${"x".repeat(80)}`), /or fewer/);
});

test("email, name and area validation", () => {
  assert.equal(v.validEmail("  Rahim@Example.COM "), "rahim@example.com");
  assert.equal(v.validEmail("not-an-email"), null);
  assert.equal(v.validName("  Rahim   Uddin "), "Rahim Uddin");
  assert.equal(v.validName("R"), null);
  assert.equal(v.validArea("11"), "11");
  assert.equal(v.validArea("outside"), "outside");
  assert.equal(v.validArea("19"), null);
  assert.equal(v.validArea(""), "");
});

test("post-login redirects stay inside the customer areas of this site", () => {
  assert.equal(v.safeNextPath("/account/orders"), "/account/orders");
  assert.equal(v.safeNextPath("/book?service=ironing"), "/book?service=ironing");
  assert.equal(v.safeNextPath("https://evil.example/account"), "/account");
  assert.equal(v.safeNextPath("//evil.example/account"), "/account");
  assert.equal(v.safeNextPath("/\\evil.example"), "/account");
  assert.equal(v.safeNextPath("/admin"), "/account", "admin is not a customer destination");
  assert.equal(v.safeNextPath("/accountsettings"), "/account");
  assert.equal(v.safeNextPath("javascript:alert(1)"), "/account");
  assert.equal(v.safeNextPath(undefined), "/account");
});

test("order references in URLs must be Velto order numbers", () => {
  assert.equal(v.validOrderNumber("vel-01940"), "VEL-01940");
  assert.equal(v.validOrderNumber("VELR-00185"), "VELR-00185");
  assert.equal(v.validOrderNumber("VEL-1940"), null);
  assert.equal(v.validOrderNumber("00000000-0000-0000-0000-000000000000"), null, "internal ids are never accepted");
  assert.equal(v.validOrderNumber("VEL-01940' or 1=1"), null);
});

test("greeting uses a real first name only", () => {
  assert.equal(v.greetingName("Nadia Rahman"), "Nadia");
  assert.equal(v.greetingName("Md. Nazmul Huda"), "Nazmul");
  assert.equal(v.greetingName("MD Karim"), "Karim");
  assert.equal(v.greetingName("Portal QA Alpha"), null, "placeholder / test names are never used");
  assert.equal(v.greetingName("Test"), null);
  assert.equal(v.greetingName("QA Staff"), null, "a placeholder first word is not skipped over");
  assert.equal(v.greetingName("01711000000"), null);
  assert.equal(v.greetingName("  "), null);
  assert.equal(v.greetingName(undefined), null);
  assert.equal(v.greetingName("নাদিয়া রহমান"), "নাদিয়া", "Bengali names (with vowel signs) are kept");
});
