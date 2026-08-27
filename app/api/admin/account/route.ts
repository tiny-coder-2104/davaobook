import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * /api/admin/account — shared operator account read/update endpoint.
 *
 * Auth is via the `x-operator-id` header attached by middleware.ts to every
 * /admin/* request. We use the service-role client (bypasses RLS) but still
 * scope every query by operator id so a caller can only touch their own row.
 *
 * This route is also consumed by the Notifications section (notification_prefs),
 * which is why that column is included in GET and allowed in PUT.
 */

export const runtime = "nodejs";

const SELECT =
  "id, name, slug, logo_url, phone, email, gcash_number, gcash_qr_url, sms_sender_id, brand_color, notification_prefs";

// Only these keys are accepted by PUT — anything else in the body is ignored.
const UPDATABLE = [
  "name",
  "phone",
  "email",
  "gcash_number",
  "gcash_qr_url",
  "sms_sender_id",
  "brand_color",
  "logo_url",
  "notification_prefs",
] as const;

type UpdatableField = (typeof UPDATABLE)[number];

export async function GET(request: NextRequest) {
  const operatorId = request.headers.get("x-operator-id");
  if (!operatorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("operators")
    .select(SELECT)
    .eq("id", operatorId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Operator not found" }, { status: 404 });
  }

  return NextResponse.json({ operator: data });
}

export async function PUT(request: NextRequest) {
  const operatorId = request.headers.get("x-operator-id");
  if (!operatorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Whitelist + loose type validation.
  const update: Record<string, unknown> = {};
  for (const field of UPDATABLE) {
    if (!(field in body)) continue;
    const value = body[field];

    if (field === "notification_prefs") {
      // Must be a JSON object (or null). Arrays / primitives are rejected.
      if (value === null || (typeof value === "object" && !Array.isArray(value))) {
        update[field] = value;
      }
      continue;
    }

    // Remaining fields are strings; null is allowed to clear them.
    if (value === null) {
      update[field] = null;
    } else if (typeof value === "string") {
      update[field] = value;
    }
    // Any non-string, non-null value for a text field is silently dropped.
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("operators")
    .update(update)
    .eq("id", operatorId)
    .select(SELECT)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ operator: data });
}
