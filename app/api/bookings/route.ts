import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * POST /api/bookings — Create a new booking with transactional capacity check.
 *
 * Calls the create_booking_transactional() PL/pgSQL function which:
 *  1. Validates package exists and is active
 *  2. Validates night count, day-of-week, past date, blocks (per night)
 *  3. Finds matching pricing tier
 *  4. Does SELECT FOR UPDATE capacity check per night (prevents overbooking)
 *  5. Inserts booking (one row per stay) and returns the code
 *
 * Body: ... existing fields ... + optional `nights` (integer >= 1, default 1).
 * A stay occupies nights tour_date .. end_date-1 where end_date = tour_date +
 * nights; total = tier_price (nightly) * nights.
 *
 * Returns: 201 on success, 400/404/409 on known errors.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      package_id,
      tour_date,
      pax,
      guest_name,
      guest_mobile,
      guest_email,
      guest_pickup_area,
      guest_notes,
    } = body;

    // Optional nights — default 1 keeps the legacy single-day path identical.
    const nights = body.nights ?? 1;

    // Validate required fields
    const missing: string[] = [];
    if (!package_id) missing.push("package_id");
    if (!tour_date) missing.push("tour_date");
    if (pax == null) missing.push("pax");
    if (!guest_name?.trim()) missing.push("guest_name");
    if (!guest_mobile) missing.push("guest_mobile");
    if (!guest_pickup_area) missing.push("guest_pickup_area");

    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    if (typeof pax !== "number" || pax < 1 || !Number.isInteger(pax)) {
      return NextResponse.json(
        { error: "pax must be a positive integer" },
        { status: 400 }
      );
    }

    // guest_name length cap (QA davaobook-0041)
    if (guest_name.trim().length > 100) {
      return NextResponse.json(
        { error: "guest_name must be 100 characters or fewer" },
        { status: 400 }
      );
    }

    if (typeof nights !== "number" || !Number.isInteger(nights) || nights < 1 || nights > 365) {
      return NextResponse.json(
        { error: "nights must be an integer between 1 and 365" },
        { status: 400 }
      );
    }

    // Multi-night: check the package cap before hitting the RPC (the SQL fn
    // re-checks — it's the trust boundary for this public path).
    if (nights > 1) {
      const { data: pkg, error: pkgErr } = await supabaseAdmin
        .from("packages")
        .select("id, max_nights")
        .eq("id", package_id)
        .eq("active", true)
        .maybeSingle();

      if (pkgErr) {
        console.error("Package lookup error:", pkgErr);
        return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
      }
      if (!pkg) {
        return NextResponse.json(
          { error: "Package not found or inactive" },
          { status: 404 }
        );
      }
      if (nights > pkg.max_nights) {
        return NextResponse.json(
          { error: `This package allows at most ${pkg.max_nights} night${pkg.max_nights === 1 ? "" : "s"} per booking` },
          { status: 400 }
        );
      }
    }

    // Call the transactional database function
    // (always pass p_nights explicitly: the 010 overload is ambiguous against
    // the dead 8-arg one, and a PostgREST default is a fragile tie-breaker)
    const { data, error } = await supabaseAdmin.rpc(
      "create_booking_transactional",
      {
        p_package_id: package_id,
        p_tour_date: tour_date,
        p_pax: pax,
        p_guest_name: guest_name.trim(),
        p_guest_mobile: guest_mobile,
        p_guest_email: guest_email || null,
        p_guest_pickup_area: guest_pickup_area,
        p_guest_notes: guest_notes || null,
        p_nights: nights,
      }
    );

    if (error) {
      const msg = error.message || "";

      if (msg.includes("PACKAGE_NOT_FOUND")) {
        return NextResponse.json(
          { error: "Package not found or inactive" },
          { status: 404 }
        );
      }
      if (msg.includes("CAPACITY_FULL")) {
        return NextResponse.json(
          {
            error:
              nights > 1
                ? "No capacity available for one or more nights of this stay"
                : "No capacity available for this date",
          },
          { status: 409 }
        );
      }
      if (msg.includes("DATE_BLOCKED")) {
        return NextResponse.json(
          {
            error:
              nights > 1
                ? "One or more nights of this stay are blocked by the operator"
                : "Date is blocked by the operator",
          },
          { status: 409 }
        );
      }
      if (msg.includes("TOUR_DATE_PAST")) {
        return NextResponse.json(
          { error: "Cannot book a date in the past" },
          { status: 400 }
        );
      }
      if (msg.includes("PACKAGE_UNAVAILABLE_DAY")) {
        return NextResponse.json(
          {
            error:
              nights > 1
                ? "Package is not available on one or more nights of this stay"
                : "Package is not available on this day of the week",
          },
          { status: 400 }
        );
      }
      if (msg.includes("MAX_NIGHTS_EXCEEDED")) {
        return NextResponse.json(
          { error: "Requested nights exceed this package's maximum" },
          { status: 400 }
        );
      }
      if (msg.includes("NO_TIER_FOR_PAX")) {
        return NextResponse.json(
          { error: "No pricing tier matches the pax count" },
          { status: 400 }
        );
      }

      console.error("Booking creation error:", error);
      return NextResponse.json(
        { error: "Failed to create booking" },
        { status: 500 }
      );
    }

    const booking = data as Record<string, unknown>;

    return NextResponse.json(
      {
        code: booking.code,
        status: booking.status,
        total_amount: booking.total_amount,
        tour_date: booking.tour_date,
        end_date: booking.end_date,
        nights: booking.nights,
        status_url: `/api/bookings/${booking.code}`,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/bookings error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
