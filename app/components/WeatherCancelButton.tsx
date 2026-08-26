"use client";

import { useState } from "react";
import ConfirmPreview from "./ConfirmPreview";

/**
 * Weather cancel button wrapper — fetches booking preview,
 * then opens ConfirmPreview sheet.
 * Standalone reusable component (DaySheet has its own inline version).
 */

interface PreviewBooking {
  code: string;
  guest_name: string;
  mobile: string;
  pax: number;
  status: string;
}

interface WeatherCancelButtonProps {
  date: string;
  packageId?: string | null;
  onWeatherCancelled: () => void;
}

export default function WeatherCancelButton({
  date,
  packageId,
  onWeatherCancelled,
}: WeatherCancelButtonProps) {
  const [previewBookings, setPreviewBookings] = useState<PreviewBooking[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [result, setResult] = useState<{
    cancelled: number;
    sms_sent: number;
  } | null>(null);

  async function fetchPreview() {
    setFetching(true);
    try {
      const params = new URLSearchParams({
        start: date,
        end: date,
        limit: "200",
      });
      const res = await fetch(`/api/admin/bookings?${params}`);
      const data = await res.json();
      const active = (data.bookings ?? []).filter(
        (b: PreviewBooking) =>
          ["PENDING_PAYMENT", "PENDING_CONFIRMATION", "CONFIRMED"].includes(
            b.status
          )
      );
      setPreviewBookings(active);
      setShowPreview(true);
    } catch {
      alert("Failed to load bookings preview");
    } finally {
      setFetching(false);
    }
  }

  async function handleConfirm() {
    setCancelling(true);
    try {
      const res = await fetch("/api/admin/weather-cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, package_id: packageId }),
      });
      const data = await res.json();
      setResult({ cancelled: data.cancelled, sms_sent: data.sms_sent });
      setShowPreview(false);
      onWeatherCancelled();
    } catch {
      alert("Weather cancellation failed");
    } finally {
      setCancelling(false);
    }
  }

  if (result) {
    return (
      <div className="rounded-touch bg-status-cancelled/10 border border-status-cancelled/20 p-3 text-sm">
        <p className="font-medium text-status-cancelled">
          ✅ Cancelled {result.cancelled} booking{result.cancelled !== 1 ? "s" : ""}
          {" · "}
          {result.sms_sent} SMS sent
        </p>
        <button
          onClick={() => setResult(null)}
          className="text-xs text-brand mt-1 hover:underline"
        >
          Dismiss
        </button>
      </div>
    );
  }

  if (showPreview) {
    return (
      <ConfirmPreview
        date={date}
        bookings={previewBookings}
        loading={cancelling}
        onConfirm={handleConfirm}
        onClose={() => setShowPreview(false)}
      />
    );
  }

  return (
    <button
      onClick={fetchPreview}
      disabled={fetching}
      className="min-h-[40px] px-4 rounded-touch bg-status-cancelled/10 text-status-cancelled text-sm font-medium
                 hover:bg-status-cancelled/20 transition-colors disabled:opacity-50"
    >
      {fetching ? "Loading…" : "⛈️ Weather cancel"}
    </button>
  );
}
