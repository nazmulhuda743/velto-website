/**
 * Customer accounts run on the Velto Ops Supabase project with its publishable key, from
 * the server only. They stay off until the portal SQL has been applied to that project
 * and VELTO_CUSTOMER_ACCOUNTS_ENABLED is "true".
 */
export function customerAuthConfig() {
  const url = process.env.VELTO_SUPABASE_URL?.trim();
  const key = process.env.VELTO_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (process.env.VELTO_CUSTOMER_ACCOUNTS_ENABLED !== "true" || !url || !key) return null;
  return { url: url.replace(/\/+$/, ""), key };
}

export const customerAccountsEnabled = () => customerAuthConfig() !== null;

/** Non-sensitive hint that lets the static header show "My Account" without a server call. */
export const ACCOUNT_HINT_COOKIE = "velto_account";

/** Set only after a password-recovery link is verified; gates the reset form (15 minutes). */
export const RECOVERY_COOKIE = "velto_recovery";
