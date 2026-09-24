"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function AccountNavLink({ onNavigate, className = "" }: { onNavigate?: () => void; className?: string }) {
  const [authenticated, setAuthenticated] = useState(false);
  useEffect(() => {
    let live = true;
    fetch("/api/account/session", { cache: "no-store", credentials: "same-origin" })
      .then((response) => response.ok ? response.json() : null)
      .then((body) => { if (live) setAuthenticated(body?.authenticated === true); })
      .catch(() => undefined);
    return () => { live = false; };
  }, []);
  return <Link href={authenticated ? "/account" : "/login"} onClick={onNavigate} className={className}>{authenticated ? "My Account" : "Sign in"}</Link>;
}
