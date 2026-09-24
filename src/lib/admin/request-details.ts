/** Pull "Label: value" lines out of a website task description. */
export function requestDetails(description: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of (description ?? "").split("\n")) {
    const m = line.match(/^([A-Za-z .\/]+):\s*(.+)$/);
    if (m) out[m[1].trim()] = m[2].trim();
  }
  return out;
}

export const requestDate = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Dhaka" });

/** Requests created within the last `ms` milliseconds. */
export const createdWithin = <T extends { created_at: string }>(rows: T[], ms: number) => {
  const now = Date.now();
  return rows.filter((r) => now - new Date(r.created_at).getTime() < ms);
};
