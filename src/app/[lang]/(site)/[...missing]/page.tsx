import { notFound } from "next/navigation";

/** Any unknown public URL gets the site's own 404 (with header, footer and language). */
export default function Missing() {
  notFound();
}
