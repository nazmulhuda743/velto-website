"use client";

import { useEffect } from "react";
import { markRequestsSeenAction } from "@/app/admin/actions";

/**
 * Marks Bookings & quotes as seen up to the newest request on the page, once per new request.
 * The server action sets the cookie and the dashboard re-renders, so the menu badge clears.
 */
export function MarkRequestsSeen({ newest }: { newest: number }) {
  useEffect(() => {
    if (newest > 0) void markRequestsSeenAction(newest);
  }, [newest]);
  return null;
}
