#!/usr/bin/env node
/**
 * Downloads licensed photography listed in docs/brand/image-imports.json and
 * writes web-ready copies to public/images/home/<slot>.jpg (never hotlinked).
 *
 * Crops are applied in CSS per component (object-position), because the same
 * slot uses different aspect ratios per breakpoint. This script only resizes
 * to a sane master size and strips metadata; next/image serves AVIF/WebP.
 *
 * Usage: node scripts/import-images.mjs
 * (behind an HTTPS proxy: NODE_USE_ENV_PROXY=1 node scripts/import-images.mjs)
 * Prints the width/height to copy into src/content/mock.ts for each slot.
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const MANIFEST = "docs/brand/image-imports.json";
const OUT_DIR = "public/images/home";
const MAX_EDGE = 2400;

const entries = JSON.parse(await fs.readFile(MANIFEST, "utf8"));
await fs.mkdir(OUT_DIR, { recursive: true });

for (const entry of entries) {
  const { slot, download } = entry;
  const res = await fetch(download);
  if (!res.ok) {
    console.error(`✗ ${slot}: ${res.status} ${download}`);
    process.exitCode = 1;
    continue;
  }
  const input = Buffer.from(await res.arrayBuffer());
  const file = path.join(OUT_DIR, `${slot}.jpg`);
  const info = await sharp(input)
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(file);
  console.log(`✓ ${slot}: /${file.replace(/^public\//, "")} ${info.width}×${info.height}`);
}
