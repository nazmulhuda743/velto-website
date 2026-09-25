"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

const HINT = "velto_account=1";
const subscribe = () => () => {};
const signedInSnapshot = () => document.cookie.split("; ").includes(HINT);

/**
 * "Sign in" / "My Account". Reads a non-sensitive hint cookie so public pages stay static;
 * the account pages themselves always verify the session on the server.
 */
export function AccountLink({ className, onClick }: { className: string; onClick?: () => void }) {
  const signedIn = useSyncExternalStore(subscribe, signedInSnapshot, () => false);
  return (
    <Link href={signedIn ? "/account" : "/login"} className={className} onClick={onClick} data-account-link={signedIn ? "account" : "signin"}>
      {signedIn ? "My Account" : "Sign in"}
    </Link>
  );
}
