import { NextResponse, type NextRequest } from "next/server";
import { CODE, optOut } from "@/lib/rhythm-server";
import { readBoundedJson } from "@/lib/security/json-request";

/** "Stop these reminders" on the one-tap page: that phone gets no more reminders, ever. */
export async function POST(request: NextRequest) {
  const body = await readBoundedJson(request);
  const code = body.ok && body.value && typeof (body.value as { code?: unknown }).code === "string" ? (body.value as { code: string }).code : "";
  const ok = CODE.test(code) && (await optOut(code).catch(() => false));
  return NextResponse.json({ ok }, { status: ok ? 200 : 400, headers: { "Cache-Control": "no-store" } });
}
