import { validMetaPixelId } from "./events";

/** The configured Meta Pixel (dataset) ID, or null when missing or not numeric. Public by design. */
export function configuredMetaPixelId() {
  return validMetaPixelId(process.env.NEXT_PUBLIC_META_PIXEL_ID);
}
