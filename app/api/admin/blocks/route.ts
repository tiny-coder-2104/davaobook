import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * POST /api/admin/blocks — Create a date block.
 * Body: { package_id?: string, date: string, reason?: string }
 * package_id = null means block ALL packages for that date.
 */
export async function POST(request: NextRequest) {
  const operatorId = request.headers.get("x-operator-id");
  if (!operatorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { package_id, date, reason } = body as {
    package_id?: string | null;
    date: string;
    reason?: string;
  };

  if (!date) {
    return NextResponse.json({ error: "date is required" }, { status: 400 });
  }

  // Verify package belongs to operator if specified
  if (package_id) {
    const { data: pkg } = await supabaseAdmin
      .from("packages")
      .select("id")
      .eq("id", package_id)
      .eq("operator_id", operatorId)
      .single();

    if (!pkg) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }
  }

  // Check for duplicate block
  let dupQuery = supabaseAdmin
    .from("blocks")
    .select("id")
    .eq("operator_id", operatorId)
    .eq("date", date);

  if (package_id) {
    dupQuery = dupQuery.eq("package_id", package_id);
  } else {
    dupQuery = dupQuery.is("package_id", null);
  }

  const { data: existing } = await dupQuery.maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: "Date is already blocked", block_id: existing.id },
      { status: 409 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("blocks")
    .insert({
      operator_id: operatorId,
      package_id: package_id ?? null,
      date,
      reason: reason ?? null,
    })
    .select("id, package_id, date, reason")
    .single();

  if (error) {
    console.error("Block insert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ block: data }, { status: 201 });
}
