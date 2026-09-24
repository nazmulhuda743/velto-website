import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split("\n")
  .map((value) => value.trim())
  .filter(Boolean);

const forbiddenEnvFiles = tracked.filter((file) =>
  /(^|\/)\.env(?:\.|$)/.test(file) && !file.endsWith(".env.example") && file !== ".env.example",
);
assert.deepEqual(forbiddenEnvFiles, [], `Committed environment files are not allowed: ${forbiddenEnvFiles.join(", ")}`);

const textExtensions = /\.(?:ts|tsx|js|jsx|mjs|cjs|json|md|yml|yaml|txt|css)$/i;
const files = tracked.filter((file) => textExtensions.test(file) || file === ".env.example");

const publicSecretNames = /NEXT_PUBLIC_(?:[^\n=]*(?:SUPABASE|SECRET|SERVICE_ROLE|ACCESS_TOKEN|PRIVATE_KEY|DATABASE_URL))/i;
const probableSupabaseSecret = /sb_secret_[A-Za-z0-9_-]{24,}/g;
const probableJwt = /eyJ[A-Za-z0-9_-]{80,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g;

const findings = [];
for (const file of files) {
  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  if (publicSecretNames.test(content)) findings.push(`${file}: public environment variable name looks secret-bearing`);

  for (const match of content.matchAll(probableSupabaseSecret)) {
    if (match[0] !== "sb_secret_replace_me") findings.push(`${file}: probable Supabase secret committed`);
  }

  if (probableJwt.test(content)) findings.push(`${file}: probable long JWT credential committed`);
}

assert.deepEqual(findings, [], `Potential secret exposure detected:\n${findings.join("\n")}`);
console.log(`Static security audit passed across ${files.length} tracked text files.`);
