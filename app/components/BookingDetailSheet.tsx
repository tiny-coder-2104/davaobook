"use client";

import { useState } from "react";
import { type BookingRow, STATUS_STYLES, STATUS_LABELS } from "./BookingCard";
import { type BookingStatus } from "@/lib/transitions";

interface BookingDetailSheetProps {
  booking: BookingRow;
  onClose: () => void;
  onAction: (bookingId: string, action: string, meta?: Record<string, unknown>) => Promise<void>;
}

const ACTIONS: {
  key: string;
  label: string;
  target: BookingStatus;
  primary: boolean;
  confirm?: string;
}[] = [
  {
    key: "confirm",
    label: "Confirm",
    target: "CONFIRMED",
    primary: true,
    confirm: "Confirm this booking?",
  },
  {
    key: "mark_paid",
    label: "Mark Paid",
    target: "PENDING_CONFIRMATION",
    primary: false,
  },
  {
    key: "cancel",
    label: "Cancel",
    target: "CANCELLED",
    primary: false,
    confirm: "Cancel this booking? Guest will be notified.",
  },
];

export default function BookingDetailSheet({
  booking,
  onClose,
  onAction,
}: BookingDetailSheetProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const style = STATUS_STYLES[booking.status] ?? "bg-gray-100 text-gray-600";
  const label = STATUS_LABELS[booking.status] ?? booking.status;

  async function handleAction(action: (typeof ACTIONS)[number]) {
    if (action.confirm && !window.confirm(action.confirm)) return;
    setLoading(action.key);
    await onAction(booking.id, action.key, { target_status: action.target });
    setLoading(null);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

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
                {booking.guest_name}
              </h2>
              <span className={`status-badge text-xs mt-1 ${style}`}>
                {label}
              </span>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Guest info */}
          <div className="bg-gray-50 rounded-touch p-3 space-y-2 text-sm">
            <InfoRow label="Mobile" value={booking.mobile} />
            {booking.email && <InfoRow label="Email" value={booking.email} />}
            <InfoRow label="Pickup" value={booking.pickup_area} />
            {booking.notes && <InfoRow label="Notes" value={booking.notes} />}
            {booking.gcash_ref && (
              <InfoRow label="GCash Ref" value={booking.gcash_ref} />
            )}
            <InfoRow
              label="Package"
              value={booking.packages?.name ?? "—"}
            />
            <InfoRow label="Tour Date" value={booking.tour_date} />
            <InfoRow label="Pax" value={String(booking.pax)} />
            <InfoRow
              label="Total"
              value={`₱${booking.total_amount.toLocaleString("en-PH")}`}
            />
            <InfoRow label="Code" value={booking.code} />
          </div>

          {/* Screenshot */}
          {booking.screenshot_url && (
            <div>
              <p className="text-xs font-medium text-ink-muted mb-1">
                Payment Screenshot
              </p>
              <img
                src={booking.screenshot_url}
                alt="Payment screenshot"
                className="w-full max-h-60 object-contain rounded-touch bg-gray-50"
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-2 pt-2">
            {ACTIONS.map((action) => {
              // Only show relevant actions based on current status
              const visible = getVisibleActions(booking.status);
              if (!visible.includes(action.key)) return null;

              return (
                <button
                  key={action.key}
                  onClick={() => handleAction(action)}
                  disabled={loading !== null}
                  className={`w-full rounded-touch font-heading font-semibold transition-colors
                    disabled:opacity-50
                    ${
                      action.primary
                        ? "btn-primary"
                        : action.key === "cancel"
                          ? "min-h-[48px] bg-status-cancelled/10 text-status-cancelled hover:bg-status-cancelled/20"
                          : "min-h-[48px] bg-gray-100 text-ink hover:bg-gray-200"
                    }`}
                >
                  {loading === action.key ? "Processing…" : action.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-ink-muted shrink-0">{label}</span>
      <span className="text-ink font-medium text-right">{value}</span>
    </div>
  );
}

/** Which actions are visible for a given status */
function getVisibleActions(status: BookingStatus): string[] {
  switch (status) {
    case "PENDING_PAYMENT":
      return ["mark_paid"];
    case "PENDING_CONFIRMATION":
      return ["confirm", "cancel"];
    case "CONFIRMED":
      return ["cancel"];
    default:
      return [];
  }
}
