"use server";

import { customerSupabase } from "./supabase";

/**
 * Called by the installed app (never the browser) once a customer is signed in there: records on
 * their account that they have the app, so the website stops offering it on every phone they use.
 * True once recorded; false when signed out or the database isn't ready, and the app tries again later.
 */
export async function markAppInstalledAction(): Promise<boolean> {
  const supabase = await customerSupabase();
  if (!supabase) return false;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return false;
  const { data, error } = await supabase.rpc("portal_app_mark_installed");
  return !error && data === true;
}
