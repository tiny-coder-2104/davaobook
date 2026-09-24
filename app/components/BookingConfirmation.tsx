"use client";

import type { GuestDetails } from "./GuestDetailsForm";

interface BookingConfirmationProps {
  packageName: string;
  tourDate: string;
  pax: number;
  pricePerPax: number;
  totalAmount: number;
  guestDetails: GuestDetails;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function BookingConfirmation({
  packageName,
  tourDate,
  pax,
  pricePerPax,
  totalAmount,
  guestDetails,
  onBack,
  onSubmit,
  submitting,
  error,
}: BookingConfirmationProps) {
  return (
    <div className="px-4 pt-4 pb-40 space-y-5">
      <h2 className="font-heading font-bold text-lg text-center">
        Review your booking
      </h2>

      {/* Tour summary card */}
      <div className="rounded-touch border border-gray-200 bg-white p-4 space-y-3">
        <Row label="Package" value={packageName} />
        <Row label="Date" value={formatDisplayDate(tourDate)} />
        <Row label="Guests" value={`${pax} guest${pax === 1 ? "" : "s"}`} />
        <Row label="Price" value={`₱${pricePerPax.toLocaleString("en-PH")} / night`} />
        <div className="border-t border-gray-100 pt-2">
          <Row label="Total" value={`₱${totalAmount.toLocaleString("en-PH")}`} bold />
        </div>
      </div>

      {/* Guest info card */}
      <div className="rounded-touch border border-gray-200 bg-white p-4 space-y-2">
        <h3 className="font-heading font-semibold text-sm text-ink-muted mb-2">
          Guest details
        </h3>
        <Row label="Name" value={guestDetails.name} />
        <Row label="Mobile" value={guestDetails.mobile} />
        {guestDetails.email && <Row label="Email" value={guestDetails.email} />}
        {guestDetails.pickup_area && (
          <Row label="Pickup" value={guestDetails.pickup_area} />
        )}
        {guestDetails.notes && <Row label="Notes" value={guestDetails.notes} />}
      </div>

      {/* Payment note — owner handles payment offline after confirming */}
      <div className="rounded-touch border border-gray-200 bg-white p-4">
        <p className="text-sm text-ink-muted">
          No payment needed now. The resort will confirm your booking and
          payment details.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-touch bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div
        className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-200 px-4 py-3"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 12px)" }}
      >
        <div className="flex gap-3 max-w-md mx-auto">
          <button
            type="button"
            onClick={onBack}
            disabled={submitting}
            className="min-h-[56px] px-4 rounded-touch border-2 border-gray-200 text-ink font-semibold
              hover:bg-gray-50 active:scale-[0.98] transition-all disabled:opacity-40"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            className="flex-1 btn-primary disabled:opacity-40"
          >
            {submitting ? "Submitting..." : "Submit booking"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Row helper ── */

function Row({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2 text-sm">
      <span className={`shrink-0 ${muted ? "text-ink-muted" : "text-ink"}`}>
        {label}
      </span>
      <span
        className={`text-right ${
          bold ? "font-heading font-bold text-ink" : "text-ink"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
