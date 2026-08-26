"use client";

import { useState } from "react";
import { type BookingStatus } from "@/lib/transitions";

/**
 * Day sheet — slide-up panel for a selected date.
 * Shows bookings list, block/unblock, weather cancel with confirm-preview.
 */

interface BookingRow {
  id: string;
  code: string;
  guest_name: string;
  pax: number;
  status: BookingStatus;
  mobile: string;
}

interface BlockRow {
  id: string;
  package_id: string | null;
  date: string;
  reason: string | null;
}

interface DaySheetProps {
  date: string;
  bookings: BookingRow[];
  blocks: BlockRow[];
  capacity: number;
  onClose: () => void;
  onBlock: (date: string, packageId: string | null) => Promise<void>;
  onUnblock: (blockId: string) => Promise<void>;
  onChanged: () => void; // fire after block/unblock/weather-cancel to refetch data
  onBookingTap: (booking: BookingRow) => void;
  loading?: boolean;
}

const STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING_PAYMENT: "Pending",
  PENDING_CONFIRMATION: "Needs Confirm",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
  EXPIRED: "Expired",
  DECLINED: "Declined",
  NO_SHOW: "No Show",
};

const STATUS_COLORS: Record<BookingStatus, string> = {
  PENDING_PAYMENT: "bg-status-pending/15 text-status-pending",
  PENDING_CONFIRMATION: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-status-confirmed/15 text-status-confirmed",
  CANCELLED: "bg-status-cancelled/15 text-status-cancelled",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  EXPIRED: "bg-status-expired/15 text-status-expired",
  DECLINED: "bg-red-100 text-red-500",
  NO_SHOW: "bg-gray-100 text-gray-500",
};

const SMS_COST_PER_MSG = 0.56; // ₱0.56 per SMS

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-PH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function DaySheet({
  date,
  bookings,
  blocks,
  capacity,
  onClose,
  onBlock,
  onUnblock,
  onChanged,
  onBookingTap,
  loading = false,
}: DaySheetProps) {
  const [blocking, setBlocking] = useState(false);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  // Weather cancel flow
  const [showWeatherConfirm, setShowWeatherConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const isBlocked = blocks.length > 0;
  const totalPax = bookings.reduce((sum, b) => sum + b.pax, 0);
  const activeBookings = bookings.filter((b) =>
    ["PENDING_PAYMENT", "PENDING_CONFIRMATION", "CONFIRMED"].includes(b.status)
  );
  const hasActiveBookings = activeBookings.length > 0;

  // Cost estimate for weather cancel
  const smsCount = activeBookings.filter((b) => b.mobile).length;
  const estimatedCost = smsCount * SMS_COST_PER_MSG;

  async function handleBlock() {
    setBlocking(true);
    await onBlock(date, null);
    setBlocking(false);
  }

  async function handleUnblock(blockId: string) {
    setUnblocking(blockId);
    await onUnblock(blockId);
    setUnblocking(null);
  }

  async function handleWeatherConfirm() {
    setCancelling(true);
    try {
      const res = await fetch("/api/admin/weather-cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Weather cancellation failed");
        return;
      }
      setShowWeatherConfirm(false);
      onChanged();
      // Show brief result
      alert(
        `✅ Cancelled ${data.cancelled} booking(s), ${data.sms_sent} SMS sent.`
      );
    } catch {
      alert("Weather cancellation failed. Please try again.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl max-h-[85vh] overflow-y-auto shadow-lg">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        <div className="px-4 pb-6 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading text-lg font-bold">
                {formatDate(date)}
              </h2>
              <p className="text-sm text-ink-muted">
                {bookings.length} booking{bookings.length !== 1 ? "s" : ""} · {totalPax} pax
                {capacity > 0 ? ` · ${capacity} capacity` : ""}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Block status + actions */}
          <div className="flex flex-wrap gap-2">
            {isBlocked ? (
              <div className="flex items-center gap-2 w-full">
                <span className="status-badge bg-gray-100 text-gray-600 text-xs">
                  🚫 Blocked
                </span>
                {blocks.map((blk) => (
                  <button
                    key={blk.id}
                    onClick={() => handleUnblock(blk.id)}
                    disabled={unblocking === blk.id}
                    className="text-xs text-brand hover:underline disabled:opacity-50 min-h-0 py-1"
                  >
                    {unblocking === blk.id ? "Removing…" : "Unblock"}
                  </button>
                ))}
              </div>
            ) : (
              <button
                onClick={handleBlock}
                disabled={blocking}
                className="min-h-[40px] px-4 rounded-touch bg-gray-100 text-ink text-sm font-medium
                           hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                {blocking ? "Blocking…" : "Block this date"}
              </button>
            )}

            {hasActiveBookings && !isBlocked && (
              <button
                onClick={() => setShowWeatherConfirm(true)}
                className="min-h-[40px] px-4 rounded-touch bg-status-cancelled/10 text-status-cancelled text-sm font-medium
                           hover:bg-status-cancelled/20 transition-colors"
              >
                ⛈️ Weather cancel
              </button>
            )}
          </div>

          {/* Bookings list */}
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 rounded-touch bg-gray-50 animate-pulse" />
              ))}
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-8 text-ink-muted text-sm">
              No bookings for this date.
            </div>
          ) : (
            <div className="space-y-2">
              {bookings.map((booking) => (
                <button
                  key={booking.id}
                  onClick={() => onBookingTap(booking)}
                  className="w-full text-left rounded-touch border border-gray-100 bg-white p-3
                             hover:border-gray-200 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-heading font-semibold text-sm truncate">
                          {booking.guest_name}
                        </h3>
                        <span
                          className={`status-badge text-[10px] shrink-0 ${
                            STATUS_COLORS[booking.status] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {STATUS_LABELS[booking.status] ?? booking.status}
                        </span>
                      </div>
                      <p className="text-xs text-ink-muted mt-0.5">
                        {booking.pax} pax · {booking.code}
                      </p>
                    </div>
                    <span className="text-ink-muted text-xs shrink-0">›</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Weather cancel confirm-preview overlay */}
      {showWeatherConfirm && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-[60]"
            onClick={() => !cancelling && setShowWeatherConfirm(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-[70] bg-white rounded-t-2xl max-h-[85vh] overflow-y-auto shadow-lg">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>
            <div className="px-4 pb-6 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-heading text-lg font-bold text-status-cancelled">
                    ⛈️ Weather Cancellation
                  </h2>
                  <p className="text-sm text-ink-muted">{formatDate(date)}</p>
                </div>
                <button
                  onClick={() => setShowWeatherConfirm(false)}
                  disabled={cancelling}
                  className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100 disabled:opacity-50"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-50 rounded-touch p-3 text-center">
                  <p className="text-2xl font-heading font-bold text-ink">
                    {activeBookings.length}
                  </p>
                  <p className="text-[11px] text-ink-muted">Bookings</p>
                </div>
                <div className="bg-gray-50 rounded-touch p-3 text-center">
                  <p className="text-2xl font-heading font-bold text-ink">
                    {activeBookings.reduce((s, b) => s + b.pax, 0)}
                  </p>
                  <p className="text-[11px] text-ink-muted">Total pax</p>
                </div>
                <div className="bg-gray-50 rounded-touch p-3 text-center">
                  <p className="text-2xl font-heading font-bold text-brand">
                    ₱{estimatedCost.toFixed(2)}
                  </p>
                  <p className="text-[11px] text-ink-muted">SMS cost</p>
                </div>
              </div>

              {/* Guest list */}
              <div>
                <h3 className="text-sm font-medium text-ink-muted mb-2">
                  Affected guests ({activeBookings.length})
                </h3>
                <div className="max-h-48 overflow-y-auto rounded-touch border border-gray-100 divide-y divide-gray-50">
                  {activeBookings.map((b) => (
                    <div key={b.code} className="flex items-center justify-between px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{b.guest_name}</p>
                        <p className="text-xs text-ink-muted">
                          {b.mobile || "No phone"} · {b.pax} pax
                        </p>
                      </div>
                      <span className="text-xs text-ink-muted font-mono shrink-0 ml-2">
                        {b.code}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-ink-muted">
                {smsCount} SMS × ₱{SMS_COST_PER_MSG} = ₱{estimatedCost.toFixed(2)}
              </p>

              {/* Actions */}
              <button
                onClick={handleWeatherConfirm}
                disabled={cancelling}
                className="w-full min-h-[56px] rounded-touch bg-status-cancelled text-white font-heading font-semibold
                           flex items-center justify-center gap-2 transition-colors
                           hover:bg-red-600 active:scale-[0.98] disabled:opacity-50"
              >
                {cancelling ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Cancelling & notifying…
                  </>
                ) : (
                  `Cancel ${activeBookings.length} booking${activeBookings.length !== 1 ? "s" : ""} & notify guests`
                )}
              </button>

              <button
                onClick={() => setShowWeatherConfirm(false)}
                disabled={cancelling}
                className="w-full min-h-[48px] rounded-touch bg-gray-100 text-ink text-sm font-medium
                           hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Never mind
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
