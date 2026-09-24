import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * GET /api/track?email= — Public booking lookup by email.
 * Returns a minimal array (code/status/tour_date/package_name/pax/total_amount).
 * No phone, email, or other PII in the response.
 */
export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email")?.trim();

  if (!email) {
    return NextResponse.json(
      { error: "Email is required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("code, status, tour_date, pax, total_amount, packages(name)")
    .ilike("email", email);

  if (error) {
    return NextResponse.json(
      { error: "Failed to look up bookings" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    (data ?? []).map((b) => {
      const pkgRaw = b.packages as unknown;
      const pkg = Array.isArray(pkgRaw) ? pkgRaw[0] : pkgRaw;
      return {
        code: b.code,
        status: b.status,
        tour_date: b.tour_date,
        package_name: (pkg as { name?: string } | null)?.name ?? null,
        pax: b.pax,
        total_amount: b.total_amount,
      };
    })
  );
}