import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

/**
 * Default share image for every page without its own (1200×630). Uses the
 * supplied white logo artwork as-is; the logo is never recreated as text.
 */
export const alt = "Velto Premium Laundry: laundry and dry cleaning in Uttara, with pickup from your door.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const logo = await readFile(path.join(process.cwd(), "public/brand/velto-logo-white.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#002B4E",
          padding: "72px 80px",
          color: "#FFFFFF",
        }}
      >
        <img src={logoSrc} width={294} height={101} alt="" />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", flexWrap: "wrap", fontSize: 68, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, maxWidth: 980 }}>
            <span>Laundry and dry cleaning in Uttara, with&nbsp;</span>
            <span style={{ color: "#00A6E5" }}>pickup from your door.</span>
          </div>
          <div style={{ display: "flex", marginTop: 36, fontSize: 30, color: "rgba(255,255,255,0.8)" }}>
            Uttara Sectors 1–18 · Outlets in Sector 11 and Sector 18 · velto.com.bd
          </div>
        </div>
      </div>
    ),
    size,
  );
}
