import { NextResponse, type NextRequest } from "next/server";
import { FEEDBACK_ISSUES } from "@/lib/customer/extras";
import { INVOICE_CODE } from "@/lib/invoice";
import { invoicesReady, linkRequest, rateInvoice, type LinkResult } from "@/lib/invoice-server";
import { inviteKind, validRoutine, type NextService } from "@/lib/second-service";
import { readBoundedJson } from "@/lib/security/json-request";

/**
 * The delivered invoice page's three taps (docs/technical/SECOND-SERVICE.md): "How did it go?",
 * "Pick your day" and "Add to my next pickup". The browser sends only the code and the choice; the
 * order, customer and phone are found in the database from the code, and nothing personal comes back.
 * Each request becomes a feedback row or an Ops call task, deduplicated in the database.
 */
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const SERVICES: NextService[] = ["ironing", "dry-cleaning", "wash-and-iron"];

export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!INVOICE_CODE.test(code)) return json({ ok: false, error: "closed" }, 404);
  if (!invoicesReady()) return json({ ok: false, error: "unavailable" }, 503);
  const body = await readBoundedJson(request);
  if (!body.ok) return json({ ok: false, error: "invalid" }, body.status);
  const input = (body.value ?? {}) as Record<string, unknown>;

  let result: LinkResult;
  try {
    if (input.action === "rate") {
      const rating = Number(input.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) return json({ ok: false, error: "invalid" }, 400);
      const issues = Array.isArray(input.issues) ? input.issues.filter((i): i is string => typeof i === "string" && (FEEDBACK_ISSUES as readonly string[]).includes(i)) : [];
      const comment = typeof input.comment === "string" ? input.comment.trim().slice(0, 1000) || null : null;
      result = await rateInvoice(code, rating, issues, comment);
    } else if (input.action === "routine" || input.action === "addon") {
      const service = SERVICES.find((s) => s === input.service);
      if (!service || inviteKind(service) !== input.action) return json({ ok: false, error: "invalid" }, 400);
      const routine = input.action === "routine" ? validRoutine(input.weekday, input.window) : null;
      if (input.action === "routine" && !routine) return json({ ok: false, error: "invalid" }, 400);
      result = await linkRequest(code, input.action, service, routine?.weekday ?? null, routine?.window ?? null);
    } else {
      return json({ ok: false, error: "invalid" }, 400);
    }
  } catch {
    return json({ ok: false, error: "unavailable" }, 503);
  }
  return json(result, result.ok ? 200 : result.error === "closed" ? 410 : 400);
}
