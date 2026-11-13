import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { after, NextResponse, type NextRequest } from "next/server";
import { chatSystemPrompt, chatTurnNote } from "@/lib/chat/prompt";
import { CHAT_LIMITS, cleanHistory, type ChatTurn } from "@/lib/chat/shared";
import { LOOKUP_PRICES, lookupPrices, parsePriceInput } from "@/lib/chat/tools";
import { readBoundedJson } from "@/lib/security/json-request";
import { isSupabaseConfigured, supabaseRpc } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-opus-5-5";
const NO_STORE = { "Cache-Control": "no-store" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

const chatConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);

const hash = (s: string) => createHash("sha256").update(s).digest("hex");

type Limit = { ok?: unknown; allowed?: unknown; retry_after_seconds?: unknown };

/** Per visitor and per day. If the limiter can't be reached, the chat stays open (the API key has its own spend limit). */
async function allowed(ip: string): Promise<{ allowed: boolean; retryAfter: number }> {
  if (!isSupabaseConfigured()) return { allowed: true, retryAfter: 0 };
  try {
    const day = new Date(Date.now() + 6 * 3_600_000).toISOString().slice(0, 10);
    const [a, b] = await Promise.all([
      supabaseRpc<Limit>("website_chat_rate_limit", { p_bucket: "ip", p_rate_key: hash(`chat-ip:${ip}`) }),
      supabaseRpc<Limit>("website_chat_rate_limit", { p_bucket: "day", p_rate_key: hash(`chat-day:${day}`) }),
    ]);
    const blocked = [a, b].filter((r) => r.ok === true && r.allowed === false);
    if (!blocked.length) return { allowed: true, retryAfter: 0 };
    return { allowed: false, retryAfter: Math.max(...blocked.map((r) => (typeof r.retry_after_seconds === "number" ? r.retry_after_seconds : 60))) };
  } catch {
    return { allowed: true, retryAfter: 0 };
  }
}

function log(conversation: string, lang: string, page: string, question: string, answer: string, outcome: "answered" | "failed" | "limited") {
  if (!isSupabaseConfigured() || !UUID.test(conversation)) return;
  after(async () => {
    try {
      await supabaseRpc("website_chat_log_add", {
        p_conversation: conversation,
        p_lang: lang,
        p_page: page,
        p_question: question,
        p_answer: answer,
        p_outcome: outcome,
      });
    } catch {
      // The log is for improving answers; a failed write never affects the customer.
    }
  });
}

const toMessages = (turns: ChatTurn[]): Anthropic.Beta.BetaMessageParam[] => turns.map((t) => ({ role: t.role, content: t.text }));

/**
 * The website chat. Takes the conversation so far (the browser keeps it) and streams the reply as
 * plain text. One tool: the live price list. Status 503 means the chat isn't set up (no API key),
 * 429 the visitor is sending too fast; the widget answers both with WhatsApp.
 */
export async function POST(request: NextRequest) {
  const body = await readBoundedJson(request, 24 * 1024);
  if (!body.ok) return NextResponse.json({ error: "invalid_request" }, { status: body.status, headers: NO_STORE });
  const input = (body.value && typeof body.value === "object" ? body.value : {}) as Record<string, unknown>;
  const lang = input.lang === "bn" ? "bn" : "en";
  const conversation = typeof input.conversation === "string" ? input.conversation : "";
  const page = typeof input.page === "string" ? input.page.slice(0, 200) : "";
  const turns = cleanHistory(input.messages);
  if (!turns || turns[turns.length - 1].role !== "user") {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers: NO_STORE });
  }
  const question = turns[turns.length - 1].text;

  if (!chatConfigured()) return NextResponse.json({ error: "unavailable" }, { status: 503, headers: NO_STORE });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limit = await allowed(ip);
  if (!limit.allowed) {
    log(conversation, lang, page, question, "", "limited");
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { ...NO_STORE, "Retry-After": String(limit.retryAfter) } });
  }

  const system = chatSystemPrompt();
  const encoder = new TextEncoder();
  let answer = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (text: string) => {
        answer += text;
        controller.enqueue(encoder.encode(text));
      };
      const messages: Anthropic.Beta.BetaMessageParam[] = toMessages(turns);
      let outcome: "answered" | "failed" = "answered";
      try {
        for (let round = 0; round < CHAT_LIMITS.toolRounds + 1; round++) {
          const s = anthropic().beta.messages.stream(
            {
              model: MODEL,
              max_tokens: 4000,
              betas: ["server-side-fallback-2026-07-01"],
              fallbacks: "default",
              output_config: { effort: "low" },
              system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
              tools: round < CHAT_LIMITS.toolRounds ? [{ ...LOOKUP_PRICES, eager_input_streaming: true }] : [],
              cache_control: { type: "ephemeral" },
              messages: [...messages, { role: "system", content: chatTurnNote(new Date(), lang) }],
            },
            { signal: request.signal, timeout: 45_000 },
          );
          // A paragraph break between a sentence before a lookup and the answer after it.
          let first = true;
          s.on("text", (delta) => {
            if (first && answer && !answer.endsWith("\n")) write("\n\n");
            first = false;
            write(delta);
          });
          const message = await s.finalMessage();
          if (message.stop_reason === "refusal") {
            if (!answer) outcome = "failed";
            break;
          }
          const uses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
          if (message.stop_reason !== "tool_use" || !uses.length) break;
          messages.push({ role: "assistant", content: message.content as Anthropic.Beta.BetaContentBlockParam[] });
          const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
          for (const use of uses) {
            const names = use.name === LOOKUP_PRICES.name ? parsePriceInput(use.input) : null;
            if (!names) {
              results.push({ type: "tool_result", tool_use_id: use.id, content: "INVALID_INPUT: pass items as a list of item names.", is_error: true });
              continue;
            }
            const r = await lookupPrices(names);
            results.push({ type: "tool_result", tool_use_id: use.id, content: r.text, is_error: r.isError });
          }
          messages.push({ role: "user", content: results });
        }
      } catch (error) {
        if (!request.signal.aborted) console.error("chat_failed", error instanceof Anthropic.APIError ? `${error.status} ${error.name}` : "stream");
        outcome = "failed";
      }
      if (!answer.trim()) {
        outcome = "failed";
        write(lang === "bn" ? "দুঃখিত, এই মুহূর্তে উত্তর দিতে পারছি না। [WhatsApp-এ জিজ্ঞেস করুন](/go/whatsapp), টিম উত্তর দেবে।" : "Sorry, I can't answer that right now. [Ask us on WhatsApp](/go/whatsapp) and the team will help.");
      }
      log(conversation, lang, page, question, answer, outcome);
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { ...NO_STORE, "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" },
  });
}
