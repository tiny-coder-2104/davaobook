import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { sendSMS, confirmationMessage, shouldSend } from "@/lib/sms";

/**
 * PATCH /api/admin/bookings/:id — Transition booking status.
 * Body: { action: "confirm" | "mark_paid" | "cancel" }
 * Logs to notify_log. Sends SMS on confirm.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const operatorId = request.headers.get("x-operator-id");
  if (!operatorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;
  const body = await request.json();
  const { action } = body as { action: string };

  // 1. Fetch booking with package info
  const { data: booking, error: fetchErr } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, status, code, guest_name, mobile, tour_date, package_id, packages!inner(name, operator_id)"
    )
    .eq("id", id)
    .single();

  if (fetchErr || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const pkgRaw = booking.packages as unknown;
  const pkg = Array.isArray(pkgRaw) ? pkgRaw[0] as { operator_id: string; name: string } : pkgRaw as { operator_id: string; name: string } | null;
  if (!pkg || pkg.operator_id !== operatorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const currentStatus = booking.status;

  // 2. Determine target status based on action
  let targetStatus: string;
  switch (action) {
    case "mark_paid":
      if (currentStatus !== "PENDING_PAYMENT") {
        return NextResponse.json(
          { error: `Cannot mark paid from ${currentStatus}` },
          { status: 400 }
        );
      }
      targetStatus = "PENDING_CONFIRMATION";
      break;
    case "confirm":
      if (currentStatus !== "PENDING_CONFIRMATION") {
        return NextResponse.json(
          { error: `Cannot confirm from ${currentStatus}` },
          { status: 400 }
        );
      }
      targetStatus = "CONFIRMED";
      break;
    case "cancel":
      if (!["PENDING_CONFIRMATION", "CONFIRMED"].includes(currentStatus)) {
        return NextResponse.json(
          { error: `Cannot cancel from ${currentStatus}` },
          { status: 400 }
        );
      }
      targetStatus = "CANCELLED";
      break;
    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  // 3. Update status (optimistic lock)
  const { error: updateErr } = await supabaseAdmin
    .from("bookings")
    .update({ status: targetStatus })
    .eq("id", id)
    .eq("status", currentStatus);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // 4. Log transition
  await supabaseAdmin.from("notify_log").insert({
    booking_id: id,
    channel: "admin_action",
    template: `${currentStatus} → ${targetStatus}`,
    meta: { action, operator_id: operatorId },
  });

  // 5. Send SMS on confirmation
  if (action === "confirm" && booking.mobile) {
    const voucherUrl = `${request.nextUrl.origin}/v/${booking.code}`;
    const message = confirmationMessage({
      guest_name: booking.guest_name,
      package_name: pkg.name,
      tour_date: booking.tour_date,
      code: booking.code,
      voucher_url: voucherUrl,
    });

    let smsSent = false;
    if (await shouldSend(operatorId, "payment_received")) {
      smsSent = await sendSMS(booking.mobile, message);
    }

    // Log SMS attempt
    await supabaseAdmin.from("notify_log").insert({
      booking_id: id,
      channel: "sms",
      template: "confirmation",
      meta: { sent: smsSent, phone: booking.mobile },
    });
  }

  return NextResponse.json({ ok: true, status: targetStatus });
}
