/**
 * Admin → Chat questions: the website chat's log turned into what the owner wants to know.
 * Which topics customers ask about, which questions the chat didn't understand (the answers
 * to add next), and each conversation in order. Pure (tests/command-center/chat.test.cjs).
 */
import { planAnswer, replyLang } from "../chat/answers";

export type ChatLogRow = {
  conversation: string;
  lang: "en" | "bn";
  page: string | null;
  question: string;
  answer: string;
  outcome: "answered" | "failed" | "limited";
  at: string;
};

/** Topic names for the owner, by the answer the chat chose. */
export const TOPIC_LABEL: Record<string, string> = {
  price: "Prices",
  turnaround: "How long it takes",
  express: "Express",
  area: "Pickup area",
  delivery: "Delivery charge",
  offer: "Offers and discounts",
  book: "How to book",
  track: "Order status",
  outlets: "Outlets and hours",
  stains: "Stains",
  household: "Curtains, carpets, bedding",
  which: "Which service",
  services: "Services",
  regular: "Regular pickup",
  process: "How it works",
  payment: "Payment",
  problem: "Problems and changes",
  contact: "Contact",
  reviews: "Reviews",
  human: "Asked for a person",
  thanks: "Thanks",
  hello: "Greeting",
  none: "Not understood",
};

/** The topic of one logged question: what the chat's own matching makes of it today. */
export function topicOf(row: Pick<ChatLogRow, "question" | "lang" | "outcome">): string {
  if (row.outcome === "failed") return "none";
  const plan = planAnswer(row.question, replyLang(row.question, row.lang));
  if (plan.kind === "price" || plan.kind === "ask-item") return "price";
  if (plan.kind === "answer") return plan.id;
  return "none";
}

/** An answer as the owner reads it: links become their labels, price cards a short line. */
export function plainAnswer(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      if (line.startsWith("[[price]]")) {
        const [item, ...rows] = line.slice(9).split("|");
        return `${item}: ${rows.map((r) => r.replace("=", " ")).join(", ")}`;
      }
      return line.replace(/\[([^\]]+)\]\([^)]+\)/g, "[$1]");
    })
    .join("\n")
    .trim();
}

export type ChatTurnView = { question: string; answer: string; outcome: ChatLogRow["outcome"]; topic: string; at: string };
export type ChatConversation = { id: string; lang: "en" | "bn"; page: string | null; startedAt: string; lastAt: string; turns: ChatTurnView[]; notUnderstood: number };

export type ChatSummary = {
  questions: number;
  conversations: number;
  /** Share of questions the chat answered (0–100), or null with no questions. */
  answeredPct: number | null;
  notUnderstood: number;
  limited: number;
  topics: { id: string; label: string; count: number }[];
  /** Newest conversation first; turns oldest first, as they happened. */
  list: ChatConversation[];
};

export function summarize(rows: ChatLogRow[]): ChatSummary {
  const byConv = new Map<string, ChatConversation>();
  const counts = new Map<string, number>();
  let failed = 0;
  let limited = 0;
  // Rows arrive newest first; walk oldest first so turns read in order.
  for (const r of [...rows].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
    if (r.outcome === "limited") {
      limited += 1;
      continue;
    }
    const topic = topicOf(r);
    if (r.outcome === "failed") failed += 1;
    counts.set(topic, (counts.get(topic) ?? 0) + 1);
    let c = byConv.get(r.conversation);
    if (!c) {
      c = { id: r.conversation, lang: r.lang, page: r.page, startedAt: r.at, lastAt: r.at, turns: [], notUnderstood: 0 };
      byConv.set(r.conversation, c);
    }
    c.turns.push({ question: r.question, answer: plainAnswer(r.answer), outcome: r.outcome, topic, at: r.at });
    c.lastAt = r.at;
    if (r.outcome === "failed") c.notUnderstood += 1;
  }
  const questions = rows.length - limited;
  return {
    questions,
    conversations: byConv.size,
    answeredPct: questions ? Math.round(((questions - failed) / questions) * 100) : null,
    notUnderstood: failed,
    limited,
    topics: [...counts.entries()]
      .map(([id, count]) => ({ id, label: TOPIC_LABEL[id] ?? id, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    list: [...byConv.values()].sort((a, b) => Date.parse(b.lastAt) - Date.parse(a.lastAt)),
  };
}
