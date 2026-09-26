import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import { getSiteContent } from "@/lib/site-content";

/**
 * Velto logo — renders the supplied official artwork only (spec §11,
 * docs/brand/ASSET-MANIFEST.md). Never recreated, traced or replaced by text.
 */
const LOGO = "/brand/velto-logo.png";
const LOGO_WHITE = "/brand/velto-logo-white.png";

/** Reads intrinsic size from the PNG header so the ratio always matches the artwork. */
function pngSize(publicPath: string): { width: number; height: number } | null {
  const file = path.join(process.cwd(), "public", publicPath);
  if (!fs.existsSync(file)) return null;
  const header = Buffer.alloc(24);
  const fd = fs.openSync(file, "r");
  fs.readSync(fd, header, 0, 24, 0);
  fs.closeSync(fd);
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

type LogoProps = {
  /** Rendered height in px; width follows the artwork's ratio. */
  height?: number;
  /** Tailwind classes for responsive heights, e.g. "h-8 lg:h-10". Overrides `height`. */
  className?: string;
  /** On navy surfaces only the official reversed variant may be used. */
  inverse?: boolean;
  priority?: boolean;
};

export async function Logo({ height = 32, className, inverse = false, priority = false }: LogoProps) {
  // A logo uploaded in Settings → Logo replaces the built-in artwork everywhere.
  const { brand } = await getSiteContent();
  const uploaded = inverse ? brand.logoWhite : brand.logo;
  if (uploaded) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote upload of unknown size; height is set by the layout
      <img
        src={uploaded}
        alt="Velto Premium Laundry"
        fetchPriority={priority ? "high" : undefined}
        className={className ? `w-auto ${className}` : "w-auto"}
        style={className ? undefined : { height }}
      />
    );
  }
  const src = inverse ? LOGO_WHITE : LOGO;
  const size = pngSize(src);

  if (size) {
    return (
      <Image
        src={src}
        alt="Velto Premium Laundry"
        width={size.width}
        height={size.height}
        priority={priority}
        sizes="240px"
        className={className ? `w-auto ${className}` : "w-auto"}
        style={className ? undefined : { height }}
      />
    );
  }

  // Asset not supplied (e.g. reversed variant): clearly-marked empty slot.
  return (
    <span
      data-mock="logo"
      className={`inline-flex items-center justify-center rounded-sm border border-dashed px-2 text-[10px] font-semibold uppercase tracking-[0.08em] ${
        inverse ? "border-white/40 text-white/70" : "border-line-strong text-secondary"
      }`}
      style={{ height, width: Math.round(height * 2.9) }}
    >
      <span className="sr-only">Velto Premium Laundry — </span>
      Logo asset
    </span>
  );
}
