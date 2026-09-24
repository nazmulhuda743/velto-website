import fs from "node:fs";
import path from "node:path";
import Image from "next/image";

/**
 * Velto logo — uses the supplied artwork only (spec §11). The logo is never
 * recreated, traced or replaced by a text wordmark. Until the asset is placed
 * in /public/brand, a clearly-marked empty slot is shown instead.
 */
const LOGO = "/brand/velto-logo.png";
const LOGO_WHITE = "/brand/velto-logo-white.png";

function assetExists(publicPath: string) {
  return fs.existsSync(path.join(process.cwd(), "public", publicPath));
}

type LogoProps = {
  /** Rendered height in px; width follows the artwork's ratio. */
  height?: number;
  /** On navy surfaces only the official reversed variant may be used. */
  inverse?: boolean;
  priority?: boolean;
};

// TODO_VERIFY: replace with the real artwork ratio once the file is supplied.
const ASSUMED_RATIO = 3.2;

export function Logo({ height = 32, inverse = false, priority = false }: LogoProps) {
  const src = inverse ? LOGO_WHITE : LOGO;
  const width = Math.round(height * ASSUMED_RATIO);

  if (assetExists(src)) {
    return (
      <Image
        src={src}
        alt="Velto Premium Laundry"
        width={width}
        height={height}
        priority={priority}
        style={{ height, width: "auto" }}
      />
    );
  }

  return (
    <span
      data-mock="logo"
      className={`inline-flex items-center justify-center rounded-sm border border-dashed px-2 text-[10px] font-semibold uppercase tracking-[0.08em] ${
        inverse ? "border-white/40 text-white/70" : "border-line-strong text-secondary"
      }`}
      style={{ height, width }}
    >
      <span className="sr-only">Velto Premium Laundry — </span>
      Logo asset
    </span>
  );
}
