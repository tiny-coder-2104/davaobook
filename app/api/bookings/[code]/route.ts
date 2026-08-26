import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * GET /api/bookings/:code — Public booking status lookup.
 * No auth required — the booking code is the secret.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { code: string } }
) {
  const { code } = params;

  if (!code) {
    return NextResponse.json(
      { error: "Booking code is required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select(
      "code, status, tour_date, pax, total_amount, guest_name, packages(name, slug)"
    )
    .eq("code", code.toUpperCase())
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Booking not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    code: data.code,
    status: data.status,
    tour_date: data.tour_date,
    package_name: Array.isArray(data.packages) ? data.packages[0]?.name : (data.packages as { name?: string })?.name ?? null,
    pax: data.pax,
    total_amount: data.total_amount,
  });
}
