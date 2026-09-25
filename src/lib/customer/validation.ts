/**
 * Pure validation for customer accounts. Shared by server actions and tests; no imports,
 * so it compiles inside the foundation test build.
 */

export const TERMS_VERSION = 1;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72; // bcrypt ignores anything longer

export const UTTARA_SECTORS = Array.from({ length: 18 }, (_, i) => String(i + 1));
export const OUTSIDE_AREA = "outside";

/** Normalise a Bangladeshi mobile number to 01XXXXXXXXX, or null. */
export function normaliseBdPhone(raw: string): string | null {
  const digits = raw.replace(/[\s\-().]/g, "").replace(/^\+/, "");
  const local = /^8801\d{9}$/.test(digits) ? digits.slice(2) : /^008801\d{9}$/.test(digits) ? digits.slice(4) : digits;
  return /^01[3-9]\d{8}$/.test(local) ? local : null;
}

export function validEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null;
}

/** Returns an error message, or null when the password is acceptable. */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Use ${PASSWORD_MAX} characters or fewer.`;
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Include at least one letter and one number.";
  return null;
}

export function validName(raw: string): string | null {
  const name = raw.replace(/\s+/g, " ").trim();
  return name.length >= 2 && name.length <= 80 ? name : null;
}

export function validArea(raw: string): string | null {
  return raw === "" || raw === OUTSIDE_AREA || UTTARA_SECTORS.includes(raw) ? raw : null;
}

export const areaLabel = (area: string | null | undefined) =>
  !area ? null : area === OUTSIDE_AREA ? "Outside Uttara Sectors 1–18" : `Uttara Sector ${area}`;

/**
 * Where to send a customer after sign-in. Only same-site paths inside the areas that use
 * an account are allowed; anything else (other hosts, protocol-relative, admin) falls back.
 */
export function safeNextPath(raw: string | null | undefined, fallback = "/account"): string {
  if (!raw || raw.length > 300) return fallback;
  let path: string;
  try {
    const url = new URL(raw, "https://velto.invalid");
    if (url.origin !== "https://velto.invalid") return fallback;
    path = url.pathname + url.search;
  } catch {
    return fallback;
  }
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  // An optional /bn prefix keeps the reader in Bangla after signing in.
  return /^(?:\/bn)?\/(account(\/|$|\?)|book(\/|$|\?)|quote(\/|$|\?)|track(\/|$|\?)|reset-password(\/|$|\?))/.test(path) ? path : fallback;
}

/** Order references in account URLs: VEL-01940 / VELR-00185. */
export function validOrderNumber(raw: string): string | null {
  const value = decodeURIComponent(raw).trim().toUpperCase();
  return /^VELR?-\d{5}$/.test(value) ? value : null;
}

/** 01711000001 → "01711 000001" for display. */
export const displayBdPhone = (phone: string | null | undefined) =>
  phone && /^01\d{9}$/.test(phone) ? `${phone.slice(0, 5)} ${phone.slice(5)}` : (phone ?? "");

/** Words that are never someone's first name (placeholders, test data, roles). */
const NOT_A_NAME = new Set(["portal", "qa", "test", "tester", "velto", "customer", "user", "admin", "staff", "staging", "demo", "guest", "unknown", "na", "n/a", "none", "null", "mr", "mrs", "ms", "md", "dr"]);

/**
 * First name for a greeting, or null when it doesn't look like one (then greet without a
 * name). "Md." style prefixes are skipped: "Md. Nazmul Huda" → "Nazmul".
 */
export function greetingName(fullName: string | null | undefined): string | null {
  const words = (fullName ?? "").replace(/\s+/g, " ").trim().split(" ");
  const first = words.find((w) => !NOT_A_NAME.has(w.toLowerCase().replace(/\.$/, "")));
  if (!first || first !== words[0] && !/^(md|mr|mrs|ms|dr)\.?$/i.test(words[0])) return null;
  const name = first.replace(/[.,]+$/, "");
  return /^\p{L}[\p{L}\p{M}'-]{1,23}$/u.test(name) ? name : null;
}
