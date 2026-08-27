/**
 * Semaphore SMS integration for DavaoBook.
 * Uses Semaphore REST API v4.
 */

import { supabaseAdmin } from "@/lib/supabase-server";

const SEMAPHORE_URL = "https://api.semaphore.co/api/v4/messages";

/**
 * Default notification preferences, used both as the column default and as the
 * fallback when an operator's stored prefs are missing/null. If a channel key
 * is absent from stored prefs we also default to TRUE (send) to preserve
 * existing behavior.
 */
export const DEFAULT_PREFS = {
  new_booking: true,
  payment_received: true,
  weather_cancel: true,
  reminders: true,
  email_digest: false,
} as const;

export type NotificationChannel = keyof typeof DEFAULT_PREFS;

/**
 * Returns whether an SMS for `channel` should be sent to the given operator,
 * based on `operators.notification_prefs`. Anything missing (no operator, no
 * prefs, or a missing key) defaults to TRUE so we never silently drop messages
 * on schema/edge cases.
 */
export async function shouldSend(
  operatorId: string,
  channel: NotificationChannel
): Promise<boolean> {
  if (!operatorId) return true;

  const { data, error } = await supabaseAdmin
    .from("operators")
    .select("notification_prefs")
    .eq("id", operatorId)
    .maybeSingle();

  if (error || !data) return true;

  const prefs = data.notification_prefs as
    | Partial<Record<NotificationChannel, boolean>>
    | null;

  if (!prefs) return true;

  const value = prefs[channel];
  return value === undefined ? true : value;
}

export async function sendSMS(
  phone: string,
  message: string
): Promise<boolean> {
  const apiKey = process.env.SEMAPHORE_API_KEY;
  if (!apiKey) {
    console.error("SEMAPHORE_API_KEY not set");
    return false;
  }

  try {
    const res = await fetch(SEMAPHORE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify({
        number: phone,
        message,
        sendername: process.env.SEMAPHORE_SENDER_NAME || "DavaoBook",
      }),
    });
    return res.ok;
  } catch (err) {
    console.error("SMS send failed:", err);
    return false;
  }
}

/** Confirmation SMS template */
export function confirmationMessage(params: {
  guest_name: string;
  package_name: string;
  tour_date: string;
  code: string;
  voucher_url: string;
}): string {
  return (
    `Hi ${params.guest_name}! Your ${params.package_name} booking on ${params.tour_date} is confirmed. ` +
    `Booking code: ${params.code}\n` +
    `Show this SMS at check-in.\n` +
    `View voucher: ${params.voucher_url}`
  );
}

/** Wrong-ref request SMS template */
export function wrongRefMessage(params: {
  guest_name: string;
  ref: string;
}): string {
  return (
    `Hi ${params.guest_name}, we couldn't verify your GCash payment reference ${params.ref}. ` +
    `Please reply with the correct 13-digit reference number.`
  );
}

/** Weather cancellation SMS template */
export function weatherCancelMessage(params: {
  guest_name: string;
  package_name: string;
  tour_date: string;
  code: string;
  rebook_url: string;
}): string {
  return (
    `Hi ${params.guest_name}, your ${params.package_name} booking on ${params.tour_date} has been cancelled due to weather. ` +
    `We apologize for the inconvenience.\n` +
    `Rebook here: ${params.rebook_url}\n` +
    `Booking code: ${params.code}`
  );
}

/** Expiry apology SMS template */
export function expiryMessage(params: {
  guest_name: string;
  code: string;
  book_url: string;
}): string {
  return (
    `Hi ${params.guest_name}, your booking ${params.code} has expired. ` +
    `Your slot is now available for others.\n` +
    `Book again at ${params.book_url}`
  );
}

/** T-24h reminder SMS template */
export function reminderMessage(params: {
  guest_name: string;
  package_name: string;
  meeting_point: string;
  voucher_url: string;
}): string {
  return (
    `Hi ${params.guest_name}, reminder: your ${params.package_name} tour is tomorrow. ` +
    `See you at ${params.meeting_point}!\n` +
    `View voucher: ${params.voucher_url}`
  );
}
