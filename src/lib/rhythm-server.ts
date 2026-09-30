import "server-only";

import { isSupabaseConfigured, supabaseRpc } from "./supabase-server";
import type { RhythmLang } from "./rhythm";

/**
 * Service-role calls for Velto Rhythm (docs/technical/sql/website_rhythm.sql). The phone numbers
 * and addresses these return stay on the server: the link page only ever gets first name and
 * usual service.
 */

export type Playbook = "regular_due" | "slipping";

export type Candidate = {
  customer_id: string;
  phone: string;
  first_name: string | null;
  usual_service: string | null;
  cadence_days: number | null;
  days_since: number;
  last_order: string;
  lifetime: number | null;
  holdout: boolean;
};

export type LinkView =
  | { ok: false; reason: "unknown" }
  | {
      ok: true;
      state: "open" | "booked" | "stopped" | "expired";
      firstName?: string;
      service?: string;
      cadenceDays?: number;
      daysSince?: number;
      lang: RhythmLang;
      bookingRef?: string;
    };

export type BookingData =
  | { ok: false }
  | { ok: true; name: string | null; phone: string; address: string | null; zone: string | null; service: string | null; lastOrder: string | null };

export type PlaybookStats = {
  contacted: number;
  failed: number;
  clicked: number;
  bookedByLink: number;
  orderedContacted: number;
  holdout: number;
  orderedHoldout: number;
};

export type RhythmStats = {
  segments: Record<string, number>;
  computedAt: string | null;
  optouts: number;
  playbooks: Partial<Record<Playbook, PlaybookStats>>;
};

export const CODE = /^[A-Za-z0-9_-]{8}$/;

export const rhythmReady = () => isSupabaseConfigured();

export const refreshRhythm = () => supabaseRpc<number>("website_rhythm_refresh", {});
export const rhythmCandidates = (playbook: Playbook, limit: number) =>
  supabaseRpc<Candidate[]>("website_rhythm_candidates", { p_playbook: playbook, p_limit: limit });
export const recordTouch = (customer: string, playbook: Playbook, channel: "sms" | "holdout", lang: RhythmLang) =>
  supabaseRpc<string | null>("website_rhythm_record", { p_customer: customer, p_playbook: playbook, p_channel: channel, p_lang: lang });
export const markTouch = (code: string, sent: boolean) => supabaseRpc<null>("website_rhythm_mark", { p_code: code, p_sent: sent });
export const staffTask = (customer: string) => supabaseRpc<string | null>("website_rhythm_staff_task", { p_customer: customer });
export const rhythmStats = (days = 30) => supabaseRpc<RhythmStats>("website_rhythm_stats", { p_days: days });
export const runKeyOk = (key: string) => supabaseRpc<boolean>("website_rhythm_check_key", { p_key: key });

export async function linkView(code: string): Promise<LinkView> {
  if (!CODE.test(code)) return { ok: false, reason: "unknown" };
  return supabaseRpc<LinkView>("website_rhythm_link", { p_code: code });
}
export async function bookingData(code: string): Promise<BookingData> {
  if (!CODE.test(code)) return { ok: false };
  return supabaseRpc<BookingData>("website_rhythm_booking_data", { p_code: code });
}
export const markBooked = (code: string, ref: string | null) => supabaseRpc<boolean | null>("website_rhythm_booked", { p_code: code, p_ref: ref });
export async function optOut(code: string): Promise<boolean> {
  if (!CODE.test(code)) return false;
  return Boolean(await supabaseRpc<boolean>("website_rhythm_optout", { p_code: code }));
}
