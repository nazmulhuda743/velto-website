import { notFound } from "next/navigation";

/** Unknown /admin URLs get the admin 404 (admin is its own root layout). */
export default function MissingAdminPage() {
  notFound();
}
