import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * GET /api/packages/[pkg]/availability?month=8&year=2026
 *
 * Returns availability per day for a package month view.
 * Each entry: { date: "2026-08-15", status: "available"|"few-left"|"full"|"closed", remaining: number }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { pkg: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get("month") ?? "", 10);
    const year = parseInt(searchParams.get("year") ?? "", 10);

    if (!month || !year || month < 1 || month > 12) {
      return NextResponse.json(
        { error: "Invalid month/year query params" },
        { status: 400 }
      );
    }

    // 1. Fetch package by slug
    const { data: pkg, error: pkgErr } = await supabaseAdmin
      .from("packages")
      .select("id, operator_id, days_of_week, capacity_per_day")
      .eq("slug", params.pkg)
      .eq("active", true)
      .single();

    if (pkgErr || !pkg) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    const daysOfWeek: number[] = pkg.days_of_week ?? [];
    const capacity: number = pkg.capacity_per_day;

    // 2. Fetch blocks for this package+month (include operator-level blocks with null package_id)
    const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const { data: blocks } = await supabaseAdmin
      .from("blocks")
      .select("date, package_id")
      .eq("operator_id", pkg.operator_id ?? "")
      .gte("date", monthStart)
      .lte("date", monthEnd);

    // Build a set of blocked dates (operator-wide or package-specific)
    const blockedDates = new Set<string>();
    if (blocks) {
      for (const b of blocks) {
        if (b.package_id === null || b.package_id === pkg.id) {
          blockedDates.add(b.date);
        }
      }
    }

    // 3. Fetch active booking counts for the month
    const { data: bookingRows } = await supabaseAdmin
      .from("bookings")
      .select("tour_date")
      .eq("package_id", pkg.id)
      .gte("tour_date", monthStart)
      .lte("tour_date", monthEnd)
      .in("status", ["PENDING_PAYMENT", "PENDING_CONFIRMATION", "CONFIRMED"]);

    // Count bookings per date
    const bookedCounts: Record<string, number> = {};
    if (bookingRows) {
      for (const row of bookingRows) {
        bookedCounts[row.tour_date] = (bookedCounts[row.tour_date] ?? 0) + 1;
      }
    }

    // 4. Build availability array for every day in month
    const availability: Array<{
      date: string;
      status: string;
      remaining: number;
    }> = [];

    for (let day = 1; day <= lastDay; day++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dayOfWeek = new Date(year, month - 1, day).getDay(); // 0=Sun

      if (!daysOfWeek.includes(dayOfWeek) || blockedDates.has(dateStr)) {
        availability.push({ date: dateStr, status: "closed", remaining: 0 });
        continue;
      }

      const booked = bookedCounts[dateStr] ?? 0;
      const remaining = Math.max(0, capacity - booked);

      let status: string;
      if (remaining === 0) {
        status = "full";
      } else if (remaining < 3) {
        status = "few-left";
      } else {
        status = "available";
      }

      availability.push({ date: dateStr, status, remaining });
    }

    return NextResponse.json({ availability });
  } catch (err) {
    console.error("GET /api/packages/[pkg]/availability error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
