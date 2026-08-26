import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * GET /api/admin/bookings — List bookings with filters.
 * Supports: ?status=, ?search=, ?start=, ?end=, ?page=, ?limit=
 */
export async function GET(request: NextRequest) {
  const operatorId = request.headers.get("x-operator-id");
  if (!operatorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const status = sp.get("status");
  const search = sp.get("search");
  const start = sp.get("start");
  const end = sp.get("end");
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") || "20", 10)));
  const offset = (page - 1) * limit;

  let query = supabaseAdmin
    .from("bookings")
    .select(
      "id, code, tour_date, pax, total_amount, status, guest_name, mobile, email, pickup_area, notes, gcash_ref, screenshot_url, created_at, packages!inner(name, slug, operator_id)",
      { count: "exact" }
    )
    .eq("packages.operator_id", operatorId)
    .order("tour_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (search) {
    query = query.or(
      `guest_name.ilike.%${search}%,code.ilike.%${search}%`
    );
  }
  if (start) query = query.gte("tour_date", start);
  if (end) query = query.lte("tour_date", end);

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error("Bookings query error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    bookings: data ?? [],
    total: count ?? 0,
    page,
    limit,
    pages: Math.ceil((count ?? 0) / limit),
  });
}
