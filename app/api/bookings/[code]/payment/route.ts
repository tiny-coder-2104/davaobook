import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * POST /api/bookings/:code/payment — Submit payment details and transition
 * booking from PENDING_PAYMENT → PENDING_CONFIRMATION.
 *
 * For GCash: sets gcash_ref + optional screenshot_url
 * For pay-on-site: just transitions status
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  const { code } = params;

  if (!code) {
    return NextResponse.json(
      { error: "Booking code is required" },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const { method, gcash_ref, screenshot_url } = body;

    if (!method || !["gcash", "pay_on_site"].includes(method)) {
      return NextResponse.json(
        { error: "Invalid payment method" },
        { status: 400 }
      );
    }

    // Fetch current booking
    const { data: booking, error: fetchErr } = await supabaseAdmin
      .from("bookings")
      .select("id, status")
      .eq("code", code.toUpperCase())
      .single();

    if (fetchErr || !booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    if (booking.status !== "PENDING_PAYMENT") {
      return NextResponse.json(
        { error: `Booking is already ${booking.status}` },
        { status: 409 }
      );
    }

    // Update booking: set payment details + transition status
    const updateData: Record<string, unknown> = {
      status: "PENDING_CONFIRMATION",
    };

    if (method === "gcash") {
      if (!gcash_ref) {
        return NextResponse.json(
          { error: "GCash reference number is required" },
          { status: 400 }
        );
      }
      updateData.gcash_ref = gcash_ref;
      if (screenshot_url) {
        updateData.screenshot_url = screenshot_url;
      }
    }

    const { error: updateErr } = await supabaseAdmin
      .from("bookings")
      .update(updateData)
      .eq("id", booking.id)
      .eq("status", "PENDING_PAYMENT"); // optimistic lock

    if (updateErr) {
      console.error("Payment update error:", updateErr);
      return NextResponse.json(
        { error: "Failed to update booking" },
        { status: 500 }
      );
    }

    // Log the transition
    await supabaseAdmin.from("notify_log").insert({
      booking_id: booking.id,
      channel: "guest_action",
      template: `PENDING_PAYMENT → PENDING_CONFIRMATION (${method})`,
      meta: { method, gcash_ref: gcash_ref ?? null },
    });

    return NextResponse.json({ ok: true, status: "PENDING_CONFIRMATION" });
  } catch (err) {
    console.error("POST /api/bookings/:code/payment error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
