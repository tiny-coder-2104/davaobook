import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * POST /api/bookings — Create a new booking with transactional capacity check.
 *
 * Calls the create_booking_transactional() PL/pgSQL function which:
 *  1. Validates package exists and is active
 *  2. Validates day-of-week, past date, blocks
 *  3. Finds matching pricing tier
 *  4. Does SELECT FOR UPDATE capacity check (prevents overbooking)
 *  5. Inserts booking and returns the code
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

    // Validate required fields
    const missing: string[] = [];
    if (!package_id) missing.push("package_id");
    if (!tour_date) missing.push("tour_date");
    if (pax == null) missing.push("pax");
    if (!guest_name) missing.push("guest_name");
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

    // Call the transactional database function
    const { data, error } = await supabaseAdmin.rpc(
      "create_booking_transactional",
      {
        p_package_id: package_id,
        p_tour_date: tour_date,
        p_pax: pax,
        p_guest_name: guest_name,
        p_guest_mobile: guest_mobile,
        p_guest_email: guest_email || null,
        p_guest_pickup_area: guest_pickup_area,
        p_guest_notes: guest_notes || null,
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
          { error: "No capacity available for this date" },
          { status: 409 }
        );
      }
      if (msg.includes("DATE_BLOCKED")) {
        return NextResponse.json(
          { error: "Date is blocked by the operator" },
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
          { error: "Package is not available on this day of the week" },
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
