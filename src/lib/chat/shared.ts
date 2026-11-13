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

export type ReplyLink = Extract<ReplyPart, { kind: "link" }>;
export type ReplyBlock =
  | { kind: "p"; parts: ReplyPart[] }
  | { kind: "ul"; items: ReplyPart[][] }
  | { kind: "price"; item: string; rows: { label: string; value: string }[] };

/**
 * A reply as blocks (paragraphs, lists, price cards) and actions: links at the end of a line
 * become buttons under the message instead of underlined words.
 */
export function parseReply(text: string): { blocks: ReplyBlock[]; actions: ReplyLink[] } {
  const blocks: ReplyBlock[] = [];
  const actions: ReplyLink[] = [];
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("[[price]]")) {
      const [item, ...rows] = line.slice(9).split("|");
      blocks.push({
        kind: "price",
        item: item.trim(),
        rows: rows.map((r) => {
          const [label, value = ""] = r.split("=");
          return { label: label.trim(), value: value.trim() };
        }),
      });
      continue;
    }
    const bullet = /^([-•*]|\d+[.)])\s+(.*)$/.exec(line);
    const parts = parseLine(bullet ? bullet[2] : line.replace(/^#+\s*/, ""));
    // Trailing links (with only spaces or punctuation between them) become actions.
    const trailing: ReplyLink[] = [];
    while (parts.length) {
      const last = parts[parts.length - 1];
      if (last.kind === "link") trailing.unshift(parts.pop() as ReplyLink);
      else if (!last.bold && /^[\s.,:;·|।-]*$/.test(last.text) && parts.length > 1 && parts[parts.length - 2].kind === "link") parts.pop();
      else break;
    }
    actions.push(...trailing);
    const last = parts[parts.length - 1];
    if (last?.kind === "text") last.text = last.text.replace(/[\s:]+$/, "");
    if (!parts.length || (parts.length === 1 && parts[0].kind === "text" && !parts[0].text)) continue;
    if (bullet) {
      const prev = blocks[blocks.length - 1];
      if (prev?.kind === "ul") prev.items.push(parts);
      else blocks.push({ kind: "ul", items: [parts] });
    } else {
      blocks.push({ kind: "p", parts });
    }
  }
  return { blocks, actions };
}
