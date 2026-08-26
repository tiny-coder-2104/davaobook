import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * POST /api/admin/bookings/manual — Create a manual (walk-in) booking.
 *
 * Creates the booking via create_booking_transactional (capacity-checked),
 * then transitions directly to PENDING_CONFIRMATION (paid on-site/cash).
 *
 * Body: { package_id, tour_date, pax, guest_name, guest_mobile,
 *         guest_email?, guest_pickup_area?, guest_notes?, payment_method? }
 */
export async function POST(request: NextRequest) {
  const operatorId = request.headers.get("x-operator-id");
  if (!operatorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
      payment_method = "cash",
    } = body;

    // Validate required fields
    const missing: string[] = [];
    if (!package_id) missing.push("package_id");
    if (!tour_date) missing.push("tour_date");
    if (pax == null) missing.push("pax");
    if (!guest_name?.trim()) missing.push("guest_name");
    if (!guest_mobile?.trim()) missing.push("guest_mobile");

    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    // 1. Verify package belongs to this operator
    const { data: pkg } = await supabaseAdmin
      .from("packages")
      .select("id, operator_id")
      .eq("id", package_id)
      .eq("operator_id", operatorId)
      .eq("active", true)
      .maybeSingle();

    if (!pkg) {
      return NextResponse.json(
        { error: "Package not found or inactive" },
        { status: 404 }
      );
    }

    // 2. Create booking via transactional function (handles capacity check)
    const { data, error } = await supabaseAdmin.rpc(
      "create_booking_transactional",
      {
        p_package_id: package_id,
        p_tour_date: tour_date,
        p_pax: pax,
        p_guest_name: guest_name.trim(),
        p_guest_mobile: guest_mobile.trim(),
        p_guest_email: guest_email || null,
        p_guest_pickup_area: guest_pickup_area || "Walk-in",
        p_guest_notes: guest_notes || null,
      }
    );

    if (error) {
      const msg = error.message || "";
      if (msg.includes("CAPACITY_FULL")) {
        return NextResponse.json(
          { error: "No capacity available for this date" },
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
      console.error("Manual booking creation error:", error);
      return NextResponse.json(
        { error: "Failed to create booking" },
        { status: 500 }
      );
    }

    const booking = data as Record<string, unknown>;
    const bookingId = booking.booking_id as string;

    // 3. Transition directly to PENDING_CONFIRMATION (manual = paid on-site)
    const { error: updateErr } = await supabaseAdmin
      .from("bookings")
      .update({
        status: "PENDING_CONFIRMATION",
        payment_method,
      })
      .eq("id", bookingId)
      .eq("status", "PENDING_PAYMENT");

    if (updateErr) {
      console.error("Status transition error:", updateErr);
      // Booking was created but transition failed — still return the code
    }

    // 4. Log the manual creation
    await supabaseAdmin.from("notify_log").insert({
      booking_id: bookingId,
      channel: "admin_action",
      template: `PENDING_PAYMENT → PENDING_CONFIRMATION (manual: ${payment_method})`,
      meta: { operator_id: operatorId, payment_method },
    });

    return NextResponse.json(
      {
        code: booking.code,
        status: "PENDING_CONFIRMATION",
        total_amount: booking.total_amount,
        tour_date: booking.tour_date,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
