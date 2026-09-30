import "server-only";

import type { Loaded } from "./analytics-data";
import { isAdminPreview } from "./preview";
import { isSupabaseConfigured } from "../supabase-server";
import { refreshRhythm, rhythmCandidates, rhythmStats, type Candidate, type Playbook, type RhythmStats } from "../rhythm-server";

/** Admin → Reminders: today's queue per playbook and the last 30 days' results. */
export type RhythmOverview = {
  stats: RhythmStats;
  queue: Record<Playbook, { total: number; holdout: number; rows: Candidate[] }>;
};

const previewRow = (i: number, holdout = false): Candidate => ({
  customer_id: `00000000-0000-4000-8000-00000000000${i}`,
  phone: `0170000000${i}`,
  first_name: ["Preview", "Example", "Sample"][i % 3],
  usual_service: ["Ironing", "Wash + Iron", "Dry Cleaning"][i % 3],
  cadence_days: [8, 12, 21][i % 3],
  days_since: [9, 13, 44][i % 3],
  last_order: "2026-09-18",
  lifetime: 4200 - i * 300,
  holdout,
});

const PREVIEW: RhythmOverview = {
  stats: {
    segments: { new: 18, onetimer_warm: 91, onetimer_gone: 274, regular_due: 48, regular_on_track: 74, slipping: 39, occasional: 119, lapsed: 78 },
    computedAt: new Date().toISOString(),
    optouts: 0,
    playbooks: {},
  },
  queue: {
    regular_due: { total: 44, holdout: 4, rows: [previewRow(1), previewRow(2), previewRow(3, true)] },
    slipping: { total: 35, holdout: 3, rows: [previewRow(4), previewRow(5)] },
  },
};

export async function getRhythmOverview(): Promise<Loaded<RhythmOverview>> {
  if (isAdminPreview()) return { state: "ok", preview: true, data: PREVIEW };
  if (!isSupabaseConfigured()) return { state: "not_configured" };
  try {
    let stats = await rhythmStats(30);
    // Rebuilt by the daily runs; rebuild here too when it is missing or older than 12 hours.
    if (!stats.computedAt || Date.now() - Date.parse(stats.computedAt) > 12 * 3_600_000) {
      await refreshRhythm();
      stats = await rhythmStats(30);
    }
    const [due, slip] = await Promise.all([rhythmCandidates("regular_due", 200), rhythmCandidates("slipping", 200)]);
    const q = (list: Candidate[]) => ({ total: list.length, holdout: list.filter((c) => c.holdout).length, rows: list.slice(0, 8) });
    return { state: "ok", data: { stats, queue: { regular_due: q(due), slipping: q(slip) } } };
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    return { state: "error", message: /HTTP 404/.test(m) ? "Reminders aren't installed in this database yet (docs/technical/sql/website_rhythm.sql)." : "Reminders could not be read right now." };
  }
}
