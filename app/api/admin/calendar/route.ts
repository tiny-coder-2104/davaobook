import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * GET /api/admin/calendar?year=2026&month=8&package_id=...
 * Returns bookings + blocks for a given month + package.
 * Used by admin calendar view to show fill counts per day.
 */
export async function GET(request: NextRequest) {
  const operatorId = request.headers.get("x-operator-id");
  if (!operatorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const year = parseInt(sp.get("year") || String(new Date().getFullYear()), 10);
  const month = parseInt(sp.get("month") || String(new Date().getMonth() + 1), 10);
  const packageId = sp.get("package_id");

  // Build date range for the month
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

  // 1. Fetch packages for this operator (if no package_id specified, get all)
  let packageIds: string[] = [];
  let packages: { id: string; name: string; capacity_per_day: number }[] = [];

  if (packageId) {
    // Verify package belongs to operator
    const { data: pkg } = await supabaseAdmin
      .from("packages")
      .select("id, name, capacity_per_day")
      .eq("id", packageId)
      .eq("operator_id", operatorId)
      .single();

    if (!pkg) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }
    packages = [pkg];
    packageIds = [pkg.id];
  } else {
    const { data: pkgs } = await supabaseAdmin
      .from("packages")
      .select("id, name, capacity_per_day")
      .eq("operator_id", operatorId)
      .eq("active", true);

    packages = pkgs ?? [];
    packageIds = packages.map((p) => p.id);
  }

  if (packageIds.length === 0) {
    return NextResponse.json({ days: {}, packages: [] });
  }

  // 2. Fetch bookings in date range for active statuses
  const { data: bookings } = await supabaseAdmin
    .from("bookings")
    .select("id, package_id, tour_date, pax, status, guest_name, mobile, code")
    .in("package_id", packageIds)
    .gte("tour_date", startDate)
    .lt("tour_date", endDate)
    .in("status", [
      "PENDING_PAYMENT",
      "PENDING_CONFIRMATION",
      "CONFIRMED",
    ]);

  // 3. Fetch blocks in date range
  const { data: blocks } = await supabaseAdmin
    .from("blocks")
    .select("id, package_id, date, reason")
    .gte("date", startDate)
    .lt("date", endDate)
    .or(`package_id.is.null,package_id.in.(${packageIds.join(",")})`);

  // 4. Aggregate per day: { [date]: { bookings: [...], blocks: [...], capacity } }
  interface DayAgg {
    bookings: NonNullable<typeof bookings>;
    blocks: NonNullable<typeof blocks>;
    capacity: number;
  }

  const daysMap: Record<string, DayAgg> = {};

  // Initialize all days in the month
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const totalCapacity = packages.reduce((sum, p) => sum + p.capacity_per_day, 0);
    daysMap[dateStr] = { bookings: [], blocks: [], capacity: totalCapacity };
  }

  // Fill in bookings
  for (const b of bookings ?? []) {
    const day = daysMap[b.tour_date];
    if (day) day.bookings.push(b);
  }

  // Fill in blocks (NULL package_id = blocks all packages)
  for (const blk of blocks ?? []) {
    const day = daysMap[blk.date];
    if (day) day.blocks.push(blk);
  }

  return NextResponse.json({ days: daysMap, packages });
}
