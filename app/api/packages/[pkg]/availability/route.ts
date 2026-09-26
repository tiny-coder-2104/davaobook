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

    // 3. Fetch active bookings that OCCUPY any night of this month — a stay
    //    covers nights tour_date .. end_date-1, not just its check-in date.
    //    Summed as PAX, not row count, so "remaining" matches the SQL check
    //    (SUM(pax) + p_pax > capacity). Row counts made the picker disagree
    //    with the server after 007.
    const { data: bookingRows } = await supabaseAdmin
      .from("bookings")
      .select("tour_date, end_date, pax")
      .eq("package_id", pkg.id)
      .lte("tour_date", monthEnd)
      .gt("end_date", monthStart)
      .in("status", ["PENDING_PAYMENT", "PENDING_CONFIRMATION", "CONFIRMED"]);

    // Count booked PAX per date — spread the pax across every night of the stay
    const bookedPax: Record<string, number> = {};
    if (bookingRows) {
      for (const row of bookingRows) {
        // Date-only arithmetic in UTC: "YYYY-MM-DD" keys, no timezone drift.
        const from = new Date(`${row.tour_date}T00:00:00Z`);
        const to = new Date(`${row.end_date}T00:00:00Z`);
        for (let d = from; d < to; d = new Date(d.getTime() + 86400000)) {
          const key = d.toISOString().slice(0, 10);
          if (key < monthStart || key > monthEnd) continue;
          bookedPax[key] = (bookedPax[key] ?? 0) + (row.pax ?? 0);
        }
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

      const booked = bookedPax[dateStr] ?? 0;
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
