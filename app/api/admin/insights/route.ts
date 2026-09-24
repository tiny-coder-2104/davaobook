import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * GET /api/admin/insights — Aggregate stats for the operator.
 * Fetches ALL bookings (small volume) with package name + capacity via inner
 * join, then computes revenue / status counts / monthly revenue / popularity /
 * occupancy in JS. No pagination — the operator's booking volume is small.
 */
export async function GET(request: NextRequest) {
  const operatorId = request.headers.get("x-operator-id");
  if (!operatorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: bookings, error } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, pax, total_amount, status, tour_date, created_at, packages!inner(name, capacity_per_day, operator_id)"
    )
    .eq("packages.operator_id", operatorId);

  if (error) {
    console.error("Insights query error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const all = bookings ?? [];

  // Total revenue: confirmed bookings only.
  const total_revenue = all
    .filter((b) => b.status === "CONFIRMED")
    .reduce((sum, b) => sum + Number(b.total_amount || 0), 0);

  // Counts by status.
  const booking_counts: Record<string, number> = {};
  for (const b of all) {
    booking_counts[b.status] = (booking_counts[b.status] ?? 0) + 1;
  }

  // Revenue by month — last 6 months (Asia/Manila), keyed YYYY-MM by tour date.
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Manila",
  }); // YYYY-MM-DD
  const [y, m] = today.split("-").map(Number);
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const revenue_by_month: Record<string, number> = Object.fromEntries(
    months.map((k) => [k, 0])
  );
  for (const b of all) {
    if (b.status !== "CONFIRMED") continue;
    const key = (b.tour_date as string).slice(0, 7);
    if (key in revenue_by_month) {
      revenue_by_month[key] += Number(b.total_amount || 0);
    }
  }

  // Popular packages — top 5 by booking count.
  const pkgCounts = new Map<string, number>();
  for (const b of all) {
    const name = b.packages?.name;
    if (!name) continue;
    pkgCounts.set(name, (pkgCounts.get(name) ?? 0) + 1);
  }
  const popular_packages = [...pkgCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Occupancy: avg pax / capacity across bookings with a package.
  // ponytail: cancelled/declined/expired don't occupy capacity; if the
  // operator wants all-status occupancy, drop the filter.
  const active = all.filter(
    (b) =>
      b.packages?.capacity_per_day &&
      !["CANCELLED", "DECLINED", "EXPIRED"].includes(b.status)
  );
  const occupancy_rate =
    active.length === 0
      ? 0
      : Math.round(
          (active.reduce(
            (sum, b) => sum + b.pax / (b.packages?.capacity_per_day ?? 1),
            0
          ) /
            active.length) *
            100
        );

  return NextResponse.json({
    total_revenue,
    booking_counts,
    revenue_by_month,
    popular_packages,
    occupancy_rate,
  });
}