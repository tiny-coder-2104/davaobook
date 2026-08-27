import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { sendSMS, shouldSend } from "@/lib/sms";

/**
 * POST /api/admin/weather-cancel — Cancel all bookings for a date and blast SMS.
 * Body: { date: string, package_id?: string }
 *
 * Flow:
 * 1. Fetch all active bookings for that date (+ optional package)
 * 2. Cancel each (update status)
 * 3. Send cancellation SMS + rebook link to each
 * 4. Log every SMS to notify_log (idempotent: check before send)
 */
export async function POST(request: NextRequest) {
  const operatorId = request.headers.get("x-operator-id");
  if (!operatorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { date, package_id } = body as { date: string; package_id?: string };

  if (!date) {
    return NextResponse.json({ error: "date is required" }, { status: 400 });
  }

  // 1. Fetch active bookings for this date
  let query = supabaseAdmin
    .from("bookings")
    .select(
      "id, code, guest_name, mobile, tour_date, pax, status, package_id, packages!inner(name, operator_id, slug)"
    )
    .eq("tour_date", date)
    .in("status", ["PENDING_PAYMENT", "PENDING_CONFIRMATION", "CONFIRMED"])
    .eq("packages.operator_id", operatorId);

  if (package_id) {
    query = query.eq("package_id", package_id);
  }

  const { data: bookings, error: fetchErr } = await query;

  if (fetchErr) {
    console.error("Weather cancel fetch error:", fetchErr);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!bookings || bookings.length === 0) {
    return NextResponse.json({
      ok: true,
      cancelled: 0,
      sms_sent: 0,
      message: "No active bookings found for this date",
    });
  }

  let cancelledCount = 0;
  let smsSentCount = 0;
  const errors: string[] = [];

  // Use origin for rebook links
  const origin = request.nextUrl.origin;

  for (const booking of bookings) {
    // 2. Update status to CANCELLED (optimistic lock)
    const { error: updateErr } = await supabaseAdmin
      .from("bookings")
      .update({ status: "CANCELLED" })
      .eq("id", booking.id)
      .eq("status", booking.status);

    if (updateErr) {
      errors.push(`Failed to cancel ${booking.code}: ${updateErr.message}`);
      continue;
    }

    cancelledCount++;

    // 3. Log the admin action
    await supabaseAdmin.from("notify_log").insert({
      booking_id: booking.id,
      channel: "admin_action",
      template: "weather_cancel",
      meta: {
        date,
        package_id: booking.package_id,
        previous_status: booking.status,
        operator_id: operatorId,
      },
    });

    // 4. Send SMS if mobile provided
    if (booking.mobile) {
      // Idempotency check: has this booking already received a weather_cancel SMS?
      const { data: existingLog } = await supabaseAdmin
        .from("notify_log")
        .select("id")
        .eq("booking_id", booking.id)
        .eq("channel", "sms")
        .eq("template", "weather_cancel")
        .maybeSingle();

      if (existingLog) {
        // Already sent, skip
        continue;
      }

      const pkgRaw = booking.packages as unknown;
      const pkg = Array.isArray(pkgRaw)
        ? pkgRaw[0] as { name: string; slug: string }
        : pkgRaw as { name: string; slug: string } | null;
      const pkgName = pkg?.name ?? "your tour";
      const rebookUrl = `${origin}/p/${pkg?.slug ?? ""}`;

      const message =
        `Hi ${booking.guest_name}, your ${pkgName} booking on ${booking.tour_date} has been cancelled due to weather. ` +
        `We apologize for the inconvenience.\n` +
        `Rebook here: ${rebookUrl}\n` +
        `Booking code: ${booking.code}`;

      const sent = (await shouldSend(operatorId, "weather_cancel"))
        ? await sendSMS(booking.mobile, message)
        : false;

      await supabaseAdmin.from("notify_log").insert({
        booking_id: booking.id,
        channel: "sms",
        template: "weather_cancel",
        meta: { sent, phone: booking.mobile },
      });

      if (sent) smsSentCount++;
    }
  }

  return NextResponse.json({
    ok: true,
    cancelled: cancelledCount,
    sms_sent: smsSentCount,
    total_bookings: bookings.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
