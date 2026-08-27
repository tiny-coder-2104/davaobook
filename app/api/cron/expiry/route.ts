import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { sendSMS, expiryMessage, reminderMessage, shouldSend } from "@/lib/sms";

/**
 * GET/POST /api/cron/expiry — Hourly expiry sweep.
 *
 * Rules (spec §5):
 *  1. PENDING_PAYMENT > 24h → EXPIRED + apology SMS + slot freed
 *  2. PENDING_CONFIRMATION > 48h → auto-decline (silent)
 *  3. CONFIRMED where tour_date = tomorrow → reminder SMS
 *
 * Idempotent: checks notify_log before sending SMS.
 * Secured: requires CRON_SECRET in Authorization header.
 */

function checkAuth(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET env var not set");
    return false;
  }
  return auth === `Bearer ${secret}`;
}

async function expireStalePayments(origin: string): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: bookings, error } = await supabaseAdmin
    .from("bookings")
    .select(      "id, code, guest_name, mobile, packages!inner(name, slug, operator_id)")
    .eq("status", "PENDING_PAYMENT")
    .lt("created_at", cutoff);

  if (error || !bookings || bookings.length === 0) return 0;

  let count = 0;

  for (const b of bookings) {
    // Transition to EXPIRED (optimistic lock on status)
    const { error: updErr } = await supabaseAdmin
      .from("bookings")
      .update({ status: "EXPIRED" })
      .eq("id", b.id)
      .eq("status", "PENDING_PAYMENT");

    if (updErr) continue; // already transitioned by concurrent run

    // Log the transition
    await supabaseAdmin.from("notify_log").insert({
      booking_id: b.id,
      channel: "cron",
      template: "PENDING_PAYMENT → EXPIRED",
    });

    // Send apology SMS (idempotent: check notify_log first)
    if (b.mobile) {
      const { data: existing } = await supabaseAdmin
        .from("notify_log")
        .select("id")
        .eq("booking_id", b.id)
        .eq("channel", "sms")
        .eq("template", "expiry_apology")
        .maybeSingle();

      if (!existing) {
        const pkg = Array.isArray(b.packages)
          ? b.packages[0]
          : b.packages;

        const sent = await sendSMS(
          b.mobile,
          expiryMessage({
            guest_name: b.guest_name,
            code: b.code,
            book_url: origin,
          })
        );

        await supabaseAdmin.from("notify_log").insert({
          booking_id: b.id,
          channel: "sms",
          template: "expiry_apology",
          meta: { sent, phone: b.mobile },
        });
      }
    }

    count++;
  }

  return count;
}

async function declineStaleConfirmations(): Promise<number> {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data: bookings, error } = await supabaseAdmin
    .from("bookings")
    .select("id")
    .eq("status", "PENDING_CONFIRMATION")
    .lt("created_at", cutoff);

  if (error || !bookings || bookings.length === 0) return 0;

  let count = 0;

  for (const b of bookings) {
    const { error: updErr } = await supabaseAdmin
      .from("bookings")
      .update({ status: "DECLINED" })
      .eq("id", b.id)
      .eq("status", "PENDING_CONFIRMATION");

    if (updErr) continue;

    await supabaseAdmin.from("notify_log").insert({
      booking_id: b.id,
      channel: "cron",
      template: "PENDING_CONFIRMATION → DECLINED",
    });

    count++;
  }

  return count;
}

async function sendTourReminders(): Promise<number> {
  // tour_date = today + 1 day (bookings are date-only, stored UTC)
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0]; // YYYY-MM-DD

  const { data: bookings, error } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, code, guest_name, mobile, pickup_area, packages!inner(name, operator_id)"
    )
    .eq("status", "CONFIRMED")
    .eq("tour_date", tomorrowStr);

  if (error || !bookings || bookings.length === 0) return 0;

  let count = 0;

  for (const b of bookings) {
    if (!b.mobile) continue;

    // Idempotent: check notify_log
    const { data: existing } = await supabaseAdmin
      .from("notify_log")
      .select("id")
      .eq("booking_id", b.id)
      .eq("channel", "sms")
      .eq("template", "tour_reminder")
      .maybeSingle();

    if (existing) continue;

    const pkg = Array.isArray(b.packages) ? b.packages[0] : b.packages;
    const meetingPoint = b.pickup_area || "the meeting point";

    const operatorId = pkg?.operator_id;
    const sent = (await shouldSend(operatorId ?? "", "reminders"))
      ? await sendSMS(
          b.mobile,
          reminderMessage({
            guest_name: b.guest_name,
            package_name: pkg?.name ?? "your tour",
            meeting_point: meetingPoint,
            voucher_url: `/v/${b.code}`,
          })
        )
      : false;

    await supabaseAdmin.from("notify_log").insert({
      booking_id: b.id,
      channel: "sms",
      template: "tour_reminder",
      meta: { sent, phone: b.mobile, tour_date: tomorrowStr },
    });

    if (sent) count++;
  }

  return count;
}

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const origin = request.nextUrl.origin;

    const [expired, declined, reminders] = await Promise.all([
      expireStalePayments(origin),
      declineStaleConfirmations(),
      sendTourReminders(),
    ]);

    return NextResponse.json({
      ok: true,
      expired,
      declined,
      reminders,
    });
  } catch (err) {
    console.error("Expiry sweep error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST = same behavior (cron services may use either method)
export const POST = GET;
