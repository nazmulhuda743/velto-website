import "server-only";

/**
 * Outgoing SMS. One provider today (GreenWeb / bdbulksms.net); the shape keeps a second
 * provider (Muthofun, SSL Wireless) a small addition. Credentials come from env only.
 *
 *   VELTO_SMS_PROVIDER = greenweb | log   (log: development only, prints instead of sending)
 *   GREENWEB_SMS_TOKEN = token from the GreenWeb panel (https://gwb.li/token)
 */
export type SmsResult = { ok: true; provider: string; ms: number } | { ok: false; provider: string; code: string; ms: number };

type Provider = { name: string; send: (to: string, message: string) => Promise<{ ok: boolean; code: string }> };

const TIMEOUT_MS = 8000;

const greenweb: Provider = {
  name: "greenweb",
  async send(to, message) {
    const token = process.env.GREENWEB_SMS_TOKEN?.trim();
    if (!token) return { ok: false, code: "not_configured" };
    // The HTTPS endpoint of the same API (the documented http:// one would send the token in clear).
    const res = await fetch("https://api.bdbulksms.net/api.php?json", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token, to, message }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, code: `http_${res.status}` };
    const data: unknown = await res.json().catch(() => null);
    const first = Array.isArray(data) ? (data[0] as { status?: unknown } | undefined) : undefined;
    return first?.status === "SENT" ? { ok: true, code: "sent" } : { ok: false, code: "rejected" };
  },
};

const devLog: Provider = {
  name: "log",
  async send(to, message) {
    if (process.env.NODE_ENV === "production") return { ok: false, code: "not_configured" };
    console.info(`[sms:log] to ${to}: ${message}`);
    return { ok: true, code: "logged" };
  },
};

function provider(): Provider | null {
  const name = process.env.VELTO_SMS_PROVIDER?.trim();
  if (name === "greenweb") return greenweb;
  if (name === "log") return devLog;
  return null;
}

export const smsConfigured = () => provider() !== null;

/** `to` is a local Bangladeshi mobile (01XXXXXXXXX). Never logs the message body. */
export async function sendSms(to: string, message: string): Promise<SmsResult> {
  const p = provider();
  const started = Date.now();
  if (!p) return { ok: false, provider: "none", code: "not_configured", ms: 0 };
  try {
    const r = await p.send(`+88${to}`, message);
    const ms = Date.now() - started;
    return r.ok ? { ok: true, provider: p.name, ms } : { ok: false, provider: p.name, code: r.code, ms };
  } catch (error) {
    const ms = Date.now() - started;
    return { ok: false, provider: p.name, code: error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network", ms };
  }
}
