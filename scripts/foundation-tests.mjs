import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";

/**
 * Foundation unit tests: compiles the runtime-neutral modules in tests/foundation-modules.txt
 * (paths under src/lib) and runs tests/*.test.cjs against them. The build directory starts empty
 * every run, so a deleted or renamed module can't keep passing from a stale .js, and every module a
 * test requires must be listed, so none is tested only because another listed file imports it.
 */
const out = ".foundation-test-build";
const listFile = "tests/foundation-modules.txt";

const modules = readFileSync(listFile, "utf8")
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"));

const problems = [];
for (const file of modules) {
  if (!file.startsWith("src/lib/") || !file.endsWith(".ts")) problems.push(`${listFile}: ${file} is not a src/lib/*.ts module`);
  else if (!existsSync(file)) problems.push(`${listFile}: ${file} does not exist`);
}
const listed = new Set(modules.map((file) => file.slice("src/lib/".length, -".ts".length)));
const tests = readdirSync("tests").filter((name) => name.endsWith(".test.cjs"));
for (const name of tests) {
  const source = readFileSync(`tests/${name}`, "utf8");
  for (const [, required] of source.matchAll(/\.foundation-test-build\/([A-Za-z0-9/_.-]+)\.js/g)) {
    if (!listed.has(required)) problems.push(`tests/${name} requires ${required}.js: add src/lib/${required}.ts to ${listFile}`);
  }
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
try {
  execFileSync(
    "npx",
    [
      "tsc", "--ignoreConfig", "--outDir", out, "--rootDir", "src/lib", "--module", "node16", "--moduleResolution", "node16",
      "--target", "es2022", "--esModuleInterop", "--skipLibCheck", "--types", "node", ...modules,
    ],
    { stdio: "inherit" },
  );
  execFileSync("node", ["--test", ...tests.map((name) => `tests/${name}`)], { stdio: "inherit" });
} catch {
  process.exitCode = 1;
} finally {
  rmSync(out, { recursive: true, force: true });
}
