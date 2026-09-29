import "server-only";

import { cache } from "react";
import { parseRoutine, type Routine } from "../routine";
import { customerSupabase } from "./supabase";

/** The signed-in customer's routine pickup (open, or declined in the last 30 days); null otherwise. */
export const getRoutine = cache(async (): Promise<Routine | null | "error"> => {
  const supabase = await customerSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("portal_routine_get");
  if (error) {
    console.error("portal_routine_get_failed", error.code);
    return "error";
  }
  return parseRoutine(data);
});
