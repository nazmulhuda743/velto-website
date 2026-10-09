"use client";

import { AppErrorScreen } from "@/components/app/AppErrorScreen";

/** An app screen that failed to load: the app's error screen, inside the shell (tab bar stays). */
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <AppErrorScreen reset={reset} />;
}
