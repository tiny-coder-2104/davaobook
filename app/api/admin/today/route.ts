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

  // Confirmed today — computed from the already-fetched list.
  const confirmedToday = (data ?? []).filter(
    (b) => b.status === "CONFIRMED"
  ).length;

  // Upcoming next 7 days (tomorrow → +7), excluding terminal statuses.
  // Manila has no DST, so fixed 24h offsets are safe.
  const fmt = (dt: Date) =>
    dt.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const tomorrow = fmt(new Date(Date.now() + 86400000));
  const weekEnd = fmt(new Date(Date.now() + 7 * 86400000));

  const { count: upcoming7d, error: upcomingErr } = await supabaseAdmin
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("packages.operator_id", operatorId)
    .gte("tour_date", tomorrow)
    .lte("tour_date", weekEnd)
    .not("status", "in", '("CANCELLED","DECLINED","EXPIRED")');

  if (upcomingErr) {
    console.error("Upcoming query error:", upcomingErr);
    return NextResponse.json({ error: upcomingErr.message }, { status: 500 });
  }

  // Revenue this month — confirmed bookings with tour_date in the current month.
  const monthStart = today.slice(0, 7) + "-01";
  const { data: monthBookings, error: monthErr } = await supabaseAdmin
    .from("bookings")
    .select("total_amount")
    .eq("packages.operator_id", operatorId)
    .eq("status", "CONFIRMED")
    .gte("tour_date", monthStart)
    .lte("tour_date", today);

  if (monthErr) {
    console.error("Month revenue query error:", monthErr);
    return NextResponse.json({ error: monthErr.message }, { status: 500 });
  }

  const revenueThisMonth = (monthBookings ?? []).reduce(
    (sum, b) => sum + Number(b.total_amount || 0),
    0
  );

  return NextResponse.json({
    bookings: data ?? [],
    pending_count: pendingCount,
    confirmed_today: confirmedToday,
    upcoming_7d: upcoming7d ?? 0,
    revenue_this_month: revenueThisMonth,
    date: today,
  });
}
