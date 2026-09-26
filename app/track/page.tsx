"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface TrackedBooking {
  code: string;
  status: string;
  tour_date: string;
  /** Multi-night stay length. null on pre-010 legacy rows. */
  nights: number | null;
  package_name: string | null;
  pax: number;
  total_amount: number;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING_CONFIRMATION: "Awaiting confirmation",
  CONFIRMED: "Confirmed",
  EXPIRED: "Expired",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
  PENDING_PAYMENT: "Pending",
  COMPLETED: "Completed",
  NO_SHOW: "No Show",
};

// Booking code shape: {PKG-SLUG}-{MMDD}-{GUEST-NAME}[-N], e.g. STAND-0826-JUAN.
// Source of truth: supabase/migrations/002_create_booking_fn.sql (creates/
// calls generate_booking_code) + 014_fix_booking_code_generator.sql (current
// definition of the code format; replaced 003's body).
//   slug  = first 5 alphanumerics of package slug (non-alnum stripped first)
//           → [A-Z0-9]{1,5}
//   name  = first 4 alphanumeric chars, or the literal GUEST fallback (5 chars)
//           and may be EMPTY for legacy blank/non-Latin names (FAMIL-0926-)
//   -N    = collision suffix appended when the base code already exists
//           (FAMIL-1010-W-1 → 4 segments)
const BOOKING_CODE_RE = /^[A-Z0-9]{1,5}-\d{4}-[A-Z0-9]{0,5}(-\d+)?$/i;

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function TrackPage() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [bookings, setBookings] = useState<TrackedBooking[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleTrack() {
    const value = input.trim();
    if (!value) return;

    // Booking-code-shaped input → direct status page. Hyphenated emails like
    // mary-jane@example.com never match the code shape, so they still fall
    // through to the email lookup below.
    if (BOOKING_CODE_RE.test(value)) {
      router.push(`/b/${value.toUpperCase()}`);
      return;
    }

    // Neither a code nor an email — don't waste a lookup on garbage input.
    if (!value.includes("@")) {
      setBookings(null);
      setError(
        "That doesn't look like a booking code or an email. Codes look like STAND-0826-JUAN or STAND-1014-GUEST."
      );
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/track?email=${encodeURIComponent(value)}`);
      if (!res.ok) throw new Error("Something went wrong. Please try again.");
      setBookings(await res.json());
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="px-4 py-8 min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto">
        <h1 className="font-heading font-bold text-2xl text-ink mb-1">
          Track my booking
        </h1>
        <p className="text-sm text-ink-muted mb-6">
          Enter your booking code or the email you booked with.
        </p>

        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleTrack()}
            placeholder="e.g. STAND-0826-JUAN or you@email.com"
            className="flex-1 min-h-touch rounded-touch border border-gray-200 bg-white px-4 text-sm text-ink placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand/40"
          />
          <button
            type="button"
            onClick={handleTrack}
            disabled={loading || !input.trim()}
            className="min-h-touch px-5 rounded-touch bg-brand text-white text-sm font-semibold hover:bg-brand-hover transition-colors disabled:opacity-50"
          >
            {loading ? "..." : "Track"}
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-500 mb-4">{error}</p>
        )}

        {bookings !== null && !loading && (
          bookings.length === 0 ? (
            <div className="rounded-touch border border-gray-200 bg-white p-6 text-center">
              <p className="text-sm text-ink-muted">
                No bookings found for that email. Double-check the email you
                used, or try your booking code instead.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {bookings.map((b) => (
                <li key={b.code}>
                  <Link
                    href={`/b/${b.code}`}
                    className="block rounded-touch border border-gray-200 bg-white p-4 hover:border-brand/40 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs text-ink-muted">
                        {b.code}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                        {STATUS_LABELS[b.status] ?? b.status}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-ink">
                      {b.package_name ?? "Room"}
                    </p>
                    <p className="text-xs text-ink-muted mt-0.5">
                      {formatDisplayDate(b.tour_date)}
                      {/* Only multi-night — "1 night" is noise on a one-day stay. */}
                      {b.nights && b.nights > 1 ? ` · ${b.nights} nights` : ""} ·{" "}
                      {b.pax} guest{b.pax === 1 ? "" : "s"} · ₱
                      {b.total_amount.toLocaleString("en-PH")}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )
        )}

        <Link
          href="/"
          className="mt-8 inline-block text-sm text-brand font-medium underline underline-offset-2 hover:text-brand-hover transition-colors"
        >
          ← Back to resort
        </Link>
      </div>
    </main>
  );
}