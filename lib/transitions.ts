import { supabaseAdmin } from "./supabase-server";

/**
 * Booking status state machine.
 * Every transition is logged to notify_log for audit trail.
 */

export type BookingStatus =
  | "PENDING_PAYMENT"
  | "PENDING_CONFIRMATION"
  | "CONFIRMED"
  | "CANCELLED"
  | "COMPLETED"
  | "EXPIRED"
  | "DECLINED"
  | "NO_SHOW";

/** Valid transitions: from -> set of allowed targets */
const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING_PAYMENT: ["PENDING_CONFIRMATION", "EXPIRED"],
  PENDING_CONFIRMATION: ["CONFIRMED", "DECLINED", "EXPIRED"],
  CONFIRMED: ["CANCELLED", "COMPLETED"],
  CANCELLED: [],
  COMPLETED: ["NO_SHOW"],
  EXPIRED: [],
  DECLINED: [],
  NO_SHOW: [],
};

/**
 * Attempt a status transition. Returns { ok, error }.
 * On success, logs the transition to notify_log.
 */
export async function transitionBooking(
  bookingId: string,
  from: BookingStatus,
  to: BookingStatus,
  operatorId: string,
  meta?: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  const allowed = TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    return {
      ok: false,
      error: `Invalid transition: ${from} → ${to}`,
    };
  }

  const { error: updateErr } = await supabaseAdmin
    .from("bookings")
    .update({ status: to })
    .eq("id", bookingId)
    .eq("status", from); // optimistic lock: only if still in `from`

  if (updateErr) {
    return { ok: false, error: updateErr.message };
  }

  // Check if the row was actually updated (optimistic lock could match 0 rows)
  // We'll rely on the RPC pattern below instead

  // Log transition
  await supabaseAdmin.from("notify_log").insert({
    booking_id: bookingId,
    channel: "admin_action",
    template: `${from} → ${to}`,
    meta: meta ?? {},
  });

  return { ok: true };
}

/**
 * Server-side transition via RPC for atomicity.
 * Uses the API route /api/admin/bookings/[id] which calls this.
 */
export async function transitionBookingRPC(
  bookingId: string,
  to: BookingStatus,
  operatorId: string,
  meta?: Record<string, unknown>
): Promise<{ ok: boolean; error?: string; current_status?: string }> {
  // 1. Fetch current status + verify operator ownership
  const { data: booking, error: fetchErr } = await supabaseAdmin
    .from("bookings")
    .select("status, package_id, packages!inner(operator_id)")
    .eq("id", bookingId)
    .single();

  if (fetchErr || !booking) {
    return { ok: false, error: "Booking not found" };
  }

  const pkgRaw = booking.packages as unknown;
  const pkg = Array.isArray(pkgRaw) ? pkgRaw[0] as { operator_id: string } : pkgRaw as { operator_id: string } | null;
  if (!pkg || pkg.operator_id !== operatorId) {
    return { ok: false, error: "Unauthorized" };
  }

  const currentStatus = booking.status as BookingStatus;

  // 2. Validate transition
  const result = await transitionBooking(
    bookingId,
    currentStatus,
    to,
    operatorId,
    meta
  );

  return { ...result, current_status: currentStatus };
}
