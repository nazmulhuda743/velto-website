import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";

/**
 * Unit tests for the Command Center's runtime-neutral modules (consent,
 * collect validation, classification, dashboard aggregation, request
 * intelligence). Compiled the same way as the foundation tests.
 */
const out = ".command-center-test-build";
rmSync(out, { recursive: true, force: true });
execFileSync(
  "npx",
  [
    "tsc", "--ignoreConfig", "--outDir", out, "--rootDir", "src", "--module", "node16", "--moduleResolution", "node16",
    "--target", "es2022", "--esModuleInterop", "--skipLibCheck", "--types", "node",
    "src/lib/consent.ts",
    "src/lib/i18n/config.ts",
    "src/lib/analytics/collect-validation.ts",
    "src/lib/admin/insights.ts",
    "src/lib/admin/request-intel.ts",
    "src/lib/admin/revenue.ts",
    "src/lib/attribution.ts",
    "src/lib/admin/permissions.ts",
    "src/lib/admin/image-pages.ts",
    "src/lib/admin/price-diff.ts",
    "src/content/mock.ts",
  ],
  { stdio: "inherit" },
);
try {
  execFileSync("node", ["--test", "tests/command-center/*.test.cjs"], { stdio: "inherit" });
} finally {
  rmSync(out, { recursive: true, force: true });
}
