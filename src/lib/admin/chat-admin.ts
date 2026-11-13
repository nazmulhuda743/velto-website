import "server-only";

import { isSupabaseConfigured, supabaseRpc } from "../supabase-server";
import type { Loaded } from "./analytics-data";
import type { ChatLogRow } from "./chat-insights";
import { isAdminPreview } from "./preview";

/** The website chat's log for Admin → Chat questions (docs/technical/sql/website_chat.sql). */

const NOT_INSTALLED = "The chat log isn't installed in this database yet (docs/technical/sql/website_chat.sql).";
const safeMessage = (error: unknown) => {
  const m = error instanceof Error ? error.message : "";
  if (/HTTP 404/.test(m)) return NOT_INSTALLED;
  if (/timeout|abort/i.test(m)) return "The database did not answer in time.";
  return "This could not be read right now.";
};

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

function preview(): ChatLogRow[] {
  const a = "00000000-0000-4000-8000-00000000000a";
  const b = "00000000-0000-4000-8000-00000000000b";
  const c = "00000000-0000-4000-8000-00000000000c";
  return [
    { conversation: a, lang: "bn", page: "/", question: "shirt er dam koto?", answer: "[[price]]Shirt|ওয়াশ ও আয়রন=৳80|আয়রন=৳20|ড্রাই ক্লিনিং=৳100\n৳৪৯৯ বা তার বেশি অর্ডারে পিকআপ ও ডেলিভারি ফ্রি। [পিকআপ বুক করুন](/book)", outcome: "answered", at: ago(42) },
    { conversation: a, lang: "bn", page: "/", question: "koto din lage?", answer: "সাধারণত প্রায় ৪৮ ঘণ্টা। ওয়াশ ও আয়রন এবং ড্রাই ক্লিনিংয়ে প্রায় ৭২ ঘণ্টা।", outcome: "answered", at: ago(41) },
    { conversation: b, lang: "en", page: "/services/dry-cleaning", question: "Do you clean wedding lehenga with stone work?", answer: "Sorry, I didn't get that. Try asking about a price, pickup or delivery, or message our team. [Message Velto](/go/whatsapp)", outcome: "failed", at: ago(180) },
    { conversation: b, lang: "en", page: "/services/dry-cleaning", question: "Is delivery free?", answer: "Pickup and delivery are free on orders of ৳499 or more.", outcome: "answered", at: ago(178) },
    { conversation: c, lang: "en", page: "/pricing", question: "can you iron school uniform same day", answer: "Express is sometimes possible, depending on the item and our workload. [Ask on WhatsApp](/go/whatsapp)", outcome: "answered", at: ago(60 * 26) },
  ].sort((x, y) => Date.parse(y.at) - Date.parse(x.at)) as ChatLogRow[];
}

export async function getChatLog(days: number, limit = 1500): Promise<Loaded<ChatLogRow[]>> {
  if (isAdminPreview()) return { state: "ok", data: preview(), preview: true };
  if (!isSupabaseConfigured()) return { state: "not_configured" };
  try {
    return { state: "ok", data: await supabaseRpc<ChatLogRow[]>("website_chat_admin_list", { p_days: days, p_limit: limit }) };
  } catch (error) {
    return { state: "error", message: safeMessage(error) };
  }
}
