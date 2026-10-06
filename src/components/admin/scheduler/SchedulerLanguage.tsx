"use client";
import { createContext, useContext } from "react";
import { schedulerCopy } from "@/lib/admin/scheduler-copy";
const Language = createContext<"en" | "bn">("en");
export function SchedulerLanguage({
  lang,
  children,
}: {
  lang: "en" | "bn";
  children: React.ReactNode;
}) {
  return <Language.Provider value={lang}>{children}</Language.Provider>;
}
export function useSchedulerText() {
  const lang = useContext(Language);
  return (value: string) => schedulerCopy(lang, value);
}
