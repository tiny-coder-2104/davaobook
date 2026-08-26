"use client";

import { type BookingStatus } from "@/lib/transitions";

/* ── Types ── */

export interface BookingRow {
  id: string;
  code: string;
  tour_date: string;
  pax: number;
  total_amount: number;
  status: BookingStatus;
  guest_name: string;
  mobile: string;
  email: string | null;
  pickup_area: string;
  notes: string | null;
  gcash_ref: string | null;
  screenshot_url: string | null;
  created_at: string;
  packages: { name: string; slug: string } | null;
}

/* ── Status helpers ── */

const STATUS_STYLES: Record<BookingStatus, string> = {
  PENDING_PAYMENT:
    "bg-status-pending/15 text-status-pending",
  PENDING_CONFIRMATION:
    "bg-amber-100 text-amber-700",
  CONFIRMED:
    "bg-status-confirmed/15 text-status-confirmed",
  CANCELLED:
    "bg-status-cancelled/15 text-status-cancelled",
  COMPLETED:
    "bg-emerald-100 text-emerald-700",
  EXPIRED:
    "bg-status-expired/15 text-status-expired",
  DECLINED:
    "bg-red-100 text-red-500",
  NO_SHOW:
    "bg-gray-100 text-gray-500",
};

const STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING_PAYMENT: "Pending Payment",
  PENDING_CONFIRMATION: "Needs Confirm",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
  EXPIRED: "Expired",
  DECLINED: "Declined",
  NO_SHOW: "No Show",
};

/* ── Card component ── */

interface BookingCardProps {
  booking: BookingRow;
  onClick: (booking: BookingRow) => void;
  selected?: boolean;
  showCheckbox?: boolean;
  onToggleSelect?: (id: string) => void;
}

export default function BookingCard({
  booking,
  onClick,
  selected = false,
  showCheckbox = false,
  onToggleSelect,
}: BookingCardProps) {
  const style =
    STATUS_STYLES[booking.status] ?? "bg-gray-100 text-gray-600";
  const label =
    STATUS_LABELS[booking.status] ?? booking.status;

  return (
    <button
      type="button"
      onClick={() => onClick(booking)}
      className={`w-full text-left rounded-touch border p-3 sm:p-4 transition-colors
        ${selected ? "border-brand ring-1 ring-brand" : "border-gray-100 hover:border-gray-200"}
        bg-white`}
    >
      <div className="flex gap-3 items-start">
        {/* Optional checkbox for bulk actions */}
        {showCheckbox && (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect?.(booking.id)}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 w-5 h-5 rounded border-gray-300 text-brand accent-brand shrink-0"
          />
        )}

        {/* Thumbnail */}
        {booking.screenshot_url ? (
          <img
            src={booking.screenshot_url}
            alt="Screenshot"
            loading="lazy"
            className="w-[60px] h-[60px] object-cover rounded-lg bg-gray-100 shrink-0"
          />
        ) : (
          <div className="w-[60px] h-[60px] rounded-lg bg-gray-50 flex items-center justify-center text-ink-muted text-xs shrink-0">
            📷
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-heading font-semibold text-base truncate">
              {booking.guest_name}
            </h3>
            <span className={`status-badge text-xs shrink-0 ${style}`}>
              {label}
            </span>
          </div>

          <p className="text-ink-muted text-sm mt-0.5 truncate">
            {booking.packages?.name ?? "Package"} · {booking.pax} pax
          </p>

          <div className="flex items-center justify-between mt-1.5 text-xs text-ink-muted">
            <span>
              {new Date(booking.created_at).toLocaleTimeString("en-PH", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span className="font-mono text-[11px]">{booking.code}</span>
          </div>

          {booking.gcash_ref && (
            <p className="text-xs text-ink-muted mt-1 truncate">
              Ref: {booking.gcash_ref}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

/* ── Exported helpers for use in detail sheet ── */
export { STATUS_STYLES, STATUS_LABELS };
