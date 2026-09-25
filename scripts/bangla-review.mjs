import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

/**
 * Writes docs/content/BANGLA-REVIEW.md: every Bangla UI string next to its English
 * source, grouped by section, for the owner's copy review. Run: npm run i18n:review
 */
const out = ".i18n-review-build";
rmSync(out, { recursive: true, force: true });
execFileSync(
  "npx",
  ["tsc", "--ignoreConfig", "--outDir", out, "--rootDir", "src", "--module", "node16", "--moduleResolution", "node16",
    "--target", "es2022", "--skipLibCheck", "src/content/i18n/en.ts", "src/content/i18n/bn.ts"],
  { stdio: "inherit" },
);
const require = createRequire(import.meta.url);
const { en } = require(`../${out}/content/i18n/en.js`);
const { bn } = require(`../${out}/content/i18n/bn.js`);
rmSync(out, { recursive: true, force: true });

const rows = [];
const walk = (a, b, path) => {
  if (typeof b === "string") return rows.push([path, typeof a === "string" ? a : "", b]);
  if (Array.isArray(b)) return b.forEach((v, i) => walk(a?.[i], v, `${path}[${i}]`));
  if (b && typeof b === "object") for (const k of Object.keys(b)) walk(a?.[k], b[k], path ? `${path}.${k}` : k);
};
walk(en, bn, "");

const cell = (s) => s.replace(/\|/g, "\\|").replace(/⁠/g, "").replace(/\n/g, " ");
let md = `# Bangla website copy — for review

Status: **DRAFT, awaiting owner review.** Generated from \`src/content/i18n/bn.ts\` by \`npm run i18n:review\`; edit the Bangla there, not here.

- Standard Bangla (প্রমিত বাংলা), polite form (আপনি).
- Kept as they are: the brand (Velto, Velto Premium Laundry), WhatsApp / Google / Facebook, phone numbers, order numbers, street addresses and item names from the Ops price list (they must match Ops).
- Numbers, prices, dates and sectors use Bangla digits (৳৪৯৯, সেক্টর ১১).
- Customer reviews are never translated (the customer's own words).
- An empty English cell means the English text comes from elsewhere (for example image alt text in \`content/mock.ts\` or search titles in \`content/seo-routes.ts\`).

| Key | English | বাংলা |
| --- | --- | --- |
`;
let section = "";
for (const [key, eng, ban] of rows) {
  const top = key.split(/[.[]/)[0];
  if (top !== section) {
    section = top;
    md += `| **${top}** | | |\n`;
  }
  md += `| \`${key}\` | ${cell(eng)} | ${cell(ban)} |\n`;
}
mkdirSync("docs/content", { recursive: true });
writeFileSync("docs/content/BANGLA-REVIEW.md", md);
console.log(`Wrote docs/content/BANGLA-REVIEW.md (${rows.length} strings).`);
