"use client";

import { useState } from "react";

/**
 * Weather cancellation confirm-preview sheet.
 * Shows affected booking count, estimated SMS cost, guest list preview.
 * MANDATORY per UX review — never cancel without this.
 */

interface PreviewBooking {
  code: string;
  guest_name: string;
  mobile: string;
  pax: number;
  status: string;
}

interface ConfirmPreviewProps {
  date: string;
  bookings: PreviewBooking[];
  loading: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

const SMS_COST_PER_MSG = 0.56; // ₱0.56 per SMS

export default function ConfirmPreview({
  date,
  bookings,
  loading,
  onConfirm,
  onClose,
}: ConfirmPreviewProps) {
  const [confirming, setConfirming] = useState(false);

  const smsCount = bookings.filter((b) => b.mobile).length;
  const estimatedCost = smsCount * SMS_COST_PER_MSG;
  const totalPax = bookings.reduce((sum, b) => sum + b.pax, 0);

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-PH", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  async function handleConfirm() {
    setConfirming(true);
    await onConfirm();
    setConfirming(false);
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-[60] bg-white rounded-t-2xl max-h-[85vh] overflow-y-auto shadow-lg">
        {/* Handle */}
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
              onClick={onClose}
              className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gray-50 rounded-touch p-3 text-center">
              <p className="text-2xl font-heading font-bold text-ink">
                {bookings.length}
              </p>
              <p className="text-[11px] text-ink-muted">Bookings</p>
            </div>
            <div className="bg-gray-50 rounded-touch p-3 text-center">
              <p className="text-2xl font-heading font-bold text-ink">
                {totalPax}
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

          {/* Guest list preview */}
          <div>
            <h3 className="text-sm font-medium text-ink-muted mb-2">
              Affected guests ({bookings.length})
            </h3>
            <div className="max-h-48 overflow-y-auto rounded-touch border border-gray-100 divide-y divide-gray-50">
              {bookings.map((b) => (
                <div key={b.code} className="flex items-center justify-between px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{b.guest_name}</p>
                    <p className="text-xs text-ink-muted">{b.mobile || "No phone"} · {b.pax} pax</p>
                  </div>
                  <span className="text-xs text-ink-muted font-mono shrink-0 ml-2">{b.code}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cost note */}
          <p className="text-xs text-ink-muted">
            Estimated SMS cost: {smsCount} messages × ₱{SMS_COST_PER_MSG} = ₱{estimatedCost.toFixed(2)}
          </p>

          {/* Confirm button */}
          <button
            onClick={handleConfirm}
            disabled={confirming || loading}
            className="w-full min-h-[56px] rounded-touch bg-status-cancelled text-white font-heading font-semibold
                       flex items-center justify-center gap-2 transition-colors
                       hover:bg-red-600 active:scale-[0.98] disabled:opacity-50"
          >
            {confirming ? (
              <>
                <span className="animate-spin">⏳</span>
                Cancelling & notifying…
              </>
            ) : (
              `Cancel ${bookings.length} booking${bookings.length !== 1 ? "s" : ""} & notify guests`
            )}
          </button>

          <button
            onClick={onClose}
            disabled={confirming}
            className="w-full min-h-[48px] rounded-touch bg-gray-100 text-ink text-sm font-medium
                       hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Never mind
          </button>
        </div>
      </div>
    </>
  );
}
