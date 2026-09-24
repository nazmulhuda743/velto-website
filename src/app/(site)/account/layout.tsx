import type { ReactNode } from "react";
import { AccountSubnav } from "@/components/account/AccountSubnav";
import { requirePortalIdentity } from "@/lib/supabase/portal-server";

export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  await requirePortalIdentity("/account");
  return <><AccountSubnav />{children}</>;
}
