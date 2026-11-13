/**
 * The website chat's shared rules (browser and server): message limits, the history check, and
 * the safe reading of a reply's links. Pure (tests/command-center/chat.test.cjs).
 */

export type ChatTurn = { role: "user" | "assistant"; text: string };

export const CHAT_LIMITS = {
  /** Characters in one customer message. */
  messageChars: 600,
  /** Turns of history sent with each question (older ones are dropped). */
  historyTurns: 16,
  /** Price lookups the chat may make before it must answer. */
  toolRounds: 2,
} as const;

/** The conversation from the browser, checked: alternating roles, ending with the customer, bounded. */
export function cleanHistory(value: unknown): ChatTurn[] | null {
  if (!Array.isArray(value) || !value.length) return null;
  const turns: ChatTurn[] = [];
  for (const raw of value.slice(-CHAT_LIMITS.historyTurns)) {
    if (!raw || typeof raw !== "object") return null;
    const { role, text } = raw as { role?: unknown; text?: unknown };
    if ((role !== "user" && role !== "assistant") || typeof text !== "string") return null;
    const t = text.trim().slice(0, role === "user" ? CHAT_LIMITS.messageChars : 4000);
    if (!t) continue;
    const prev = turns[turns.length - 1];
    if (prev && prev.role === role) prev.text = `${prev.text}\n\n${t}`;
    else turns.push({ role, text: t });
  }
  while (turns.length && turns[0].role !== "user") turns.shift();
  return turns.length && turns[turns.length - 1].role === "user" ? turns : null;
}

/** Website paths a reply may link to. Anything else is shown as plain text. */
const INTERNAL = /^\/(book|pricing|track|quote|regular-laundry|how-it-works|locations|services(\/[a-z-]+)?|go\/whatsapp|go\/call)(\?[\w=&%-]*)?(#[\w-]+)?$/;
const MAPS = /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=[\d.,-]+$/;

export type ReplyPart =
  | { kind: "text"; text: string; bold?: boolean }
  | { kind: "link"; text: string; href: string; external: boolean };

/** One line of a reply, split into text, **bold** and allowed [links](/path). */
export function parseLine(line: string): ReplyPart[] {
  const parts: ReplyPart[] = [];
  const re = /\[([^\]\n]{1,80})\]\(([^)\s]{1,300})\)|\*\*([^*\n]{1,200})\*\*/g;
  let last = 0;
  for (let m = re.exec(line); m; m = re.exec(line)) {
    if (m.index > last) parts.push({ kind: "text", text: line.slice(last, m.index) });
    if (m[3] !== undefined) parts.push({ kind: "text", text: m[3], bold: true });
    else if (INTERNAL.test(m[2])) parts.push({ kind: "link", text: m[1], href: m[2], external: m[2].startsWith("/go/") });
    else if (MAPS.test(m[2])) parts.push({ kind: "link", text: m[1], href: m[2], external: true });
    else parts.push({ kind: "text", text: m[1] });
    last = re.lastIndex;
  }
  if (last < line.length) parts.push({ kind: "text", text: line.slice(last) });
  return parts;
}

/** A reply as blocks: paragraphs and bullet lists ("- " or "• " lines). */
export function parseReply(text: string): ({ kind: "p"; parts: ReplyPart[] } | { kind: "ul"; items: ReplyPart[][] })[] {
  const blocks: ({ kind: "p"; parts: ReplyPart[] } | { kind: "ul"; items: ReplyPart[][] })[] = [];
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = /^([-•*]|\d+[.)])\s+(.*)$/.exec(line);
    if (bullet) {
      const prev = blocks[blocks.length - 1];
      const item = parseLine(bullet[2]);
      if (prev?.kind === "ul") prev.items.push(item);
      else blocks.push({ kind: "ul", items: [item] });
    } else {
      blocks.push({ kind: "p", parts: parseLine(line.replace(/^#+\s*/, "")) });
    }
  }
  return blocks;
}
