import "server-only";

type Level = "info" | "warn" | "error";
type SafeValue = string | number | boolean | null | undefined;
type SafeContext = Record<string, SafeValue>;
type SanitizedContext = Record<string, string | number | boolean | null>;

const BLOCKED_KEY = /(password|token|secret|authorization|cookie|phone|address|email|name|payload|body|form)/i;

function sanitize(context: SafeContext): SanitizedContext {
  const out: SanitizedContext = {};
  for (const [key, value] of Object.entries(context)) {
    if (BLOCKED_KEY.test(key) || value === undefined) continue;
    if (typeof value === "string") out[key] = value.slice(0, 160);
    else if (typeof value === "number" || typeof value === "boolean" || value === null) out[key] = value;
  }
  return out;
}

/** Minimal structured server logging for launch-critical events. */
export function logServerEvent(event: string, level: Level = "info", context: SafeContext = {}) {
  const record = {
    event,
    level,
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || undefined,
    ...sanitize(context),
  };
  const line = JSON.stringify(record);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
