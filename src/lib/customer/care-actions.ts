"use server";

import { revalidateCustomer } from "./revalidate";
import { redirect } from "next/navigation";
import { localHref } from "@/lib/i18n/server";
import { customerSupabase } from "./supabase";
import { validOrderNumber } from "./validation";
import { customerRoutes, parseBase } from "@/lib/app-routes";

/**
 * The customer's care decision on their own order. The database checks the order is theirs and
 * still waiting; Velto Ops sees the result straight away (orders.advisory_status).
 */
export async function careDecisionAction(form: FormData) {
  const number = validOrderNumber(String(form.get("order") ?? ""));
  const decision = String(form.get("decision") ?? "");
  const r = customerRoutes(parseBase(form.get("base")));
  if (!number) redirect(await localHref(r.orders));
  const back = async (care: string) => redirect(`${await localHref(r.order(number))}?care=${care}#care`);
  if (decision !== "approved" && decision !== "declined") return back("failed");
  const supabase = await customerSupabase();
  if (!supabase) return back("failed");
  const { error } = await supabase.rpc("portal_care_decide", { p_order_number: number, p_decision: decision });
  if (error) {
    console.error("portal_care_decide_failed", error.code);
    return back("failed");
  }
  revalidateCustomer();
  return back(decision);
}
