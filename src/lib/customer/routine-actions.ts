"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { notifyNewRequest } from "@/lib/admin/dispatch";
import { loginRedirectPath } from "@/lib/i18n/server";
import { SITE_URL } from "@/lib/site-url";
import { parseRoutine, routineInput, routinePush } from "../routine";
import { getCustomerSession } from "./portal";
import { customerSupabase } from "./supabase";

export type RoutineState = { status: "idle" } | { status: "done" } | { status: "error"; code: "address" | "invalid" | "failed" };

const FN = { request: "portal_routine_request", pause: "portal_routine_pause", resume: "portal_routine_resume", stop: "portal_routine_stop" } as const;

/** Request / change, pause, resume or stop the customer's own routine pickup. */
export async function routineAction(_prev: RoutineState, form: FormData): Promise<RoutineState> {
  const intent = String(form.get("intent") ?? "");
  if (!(intent in FN)) return { status: "error", code: "invalid" };
  const args =
    intent === "request"
      ? routineInput(String(form.get("weekday") ?? ""), String(form.get("window") ?? ""), String(form.get("service") ?? ""), String(form.get("note") ?? "").slice(0, 400))
      : {};
  if (!args) return { status: "error", code: "invalid" };

  const supabase = await customerSupabase();
  if (!supabase) return { status: "error", code: "failed" };
  const { data, error } = await supabase.rpc(FN[intent as keyof typeof FN], args);
  if (error) {
    if (error.code === "PGRST301" || error.message?.includes("authentication required")) redirect(await loginRedirectPath("/account"));
    console.error("portal_routine_failed", intent, error.code);
    return { status: "error", code: "failed" };
  }
  const result = (data ?? {}) as { ok?: boolean; error?: string; routine?: unknown };
  if (!result.ok) return { status: "error", code: result.error === "address" ? "address" : result.error === "invalid" ? "invalid" : "failed" };

  if (intent === "request") {
    const routine = parseRoutine(result.routine);
    const session = await getCustomerSession();
    const name = session.kind === "customer" && session.account.state === "ready" ? session.account.fullName : "A customer";
    if (routine) after(() => notifyNewRequest(routinePush(routine, name, SITE_URL)));
  }
  revalidatePath("/account", "layout");
  return { status: "done" };
}
