import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * GET /api/admin/today — Fetch today's bookings for the operator.
 * Expects x-operator-id header set by middleware.
 * Returns bookings for today's date, reverse-chronological.
 * Supports ?status= filter.
 */
export async function GET(request: NextRequest) {
  const operatorId = request.headers.get("x-operator-id");
  if (!operatorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const statusFilter = request.nextUrl.searchParams.get("status");

  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Manila",
  }); // YYYY-MM-DD

  let query = supabaseAdmin
    .from("bookings")
    .select(
      "id, code, tour_date, pax, total_amount, status, guest_name, mobile, email, pickup_area, notes, gcash_ref, screenshot_url, created_at, packages!inner(name, slug, operator_id)"
    )
    .eq("packages.operator_id", operatorId)
    .eq("tour_date", today)
    .order("created_at", { ascending: false });

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Today query error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Count pending confirmations
  const pendingCount = (data ?? []).filter(
    (b) => b.status === "PENDING_CONFIRMATION"
  ).length;

  return NextResponse.json({
    bookings: data ?? [],
    pending_count: pendingCount,
    date: today,
  });
}
