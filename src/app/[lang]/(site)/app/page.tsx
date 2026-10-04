import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/customer/portal";
import { localHref, loginRedirectPath } from "@/lib/i18n/server";

/**
 * velto.com.bd/app: the link to share (WhatsApp messages) for installing Velto. It opens the
 * customer's account with the "Install Velto" popup open; signed out, sign-in comes first and
 * returns there. No page of its own.
 */
export default async function AppLink() {
  const session = await getCustomerSession();
  const target = "/account?install=1";
  redirect(session.kind === "customer" ? await localHref(target) : await loginRedirectPath(target));
}
