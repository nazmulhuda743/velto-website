import { NextResponse, type NextRequest } from "next/server";
import { can } from "@/lib/admin/permissions";
import { isAdminPreview } from "@/lib/admin/preview";
import { getAdmin } from "@/lib/admin/session";
import { INVOICE_CODE } from "@/lib/invoice";
import { markInvoiceSent } from "@/lib/invoice-server";

/**
 * Admin → Invoices on WhatsApp: staff opened WhatsApp with an order's message. Records who and
 * when, so the list shows what was sent. Signed-in staff with the dispatch section only.
 */
export async function POST(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  const admin = await getAdmin();
  if (!admin || !can(admin.role, "dispatch")) return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  const code = (await request.text().catch(() => "")).trim();
  if (!INVOICE_CODE.test(code)) return NextResponse.json({ error: "bad_code" }, { status: 400, headers });
  if (isAdminPreview()) return NextResponse.json({ ok: true }, { headers });
  try {
    return NextResponse.json({ ok: await markInvoiceSent(code, admin.name) }, { headers });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers });
  }
}
