"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import ManualBookingForm from "@/app/components/ManualBookingForm";

export default function NewBookingPage() {
  const router = useRouter();
  const [bookingCode, setBookingCode] = useState<string | null>(null);

  function handleSuccess(code: string) {
    setBookingCode(code);
  }

  if (bookingCode) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <div className="w-16 h-16 mx-auto rounded-full bg-status-confirmed/15 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-status-confirmed" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-heading font-bold text-xl mb-2">Booking Created</h2>
        <p className="text-ink-muted text-sm mb-4">
          Walk-in booking has been created and is ready for confirmation.
        </p>
        <div className="inline-block px-4 py-2 rounded-touch bg-gray-100 font-mono text-lg font-bold mb-6">
          {bookingCode}
        </div>
        <div className="flex gap-3 justify-center">
          <button
            type="button"
            onClick={() => {
              setBookingCode(null);
            }}
            className="min-h-[48px] px-4 rounded-touch border border-gray-200 text-sm font-medium
              hover:bg-gray-50 active:scale-[0.98] transition-all"
          >
            Add another
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/today")}
            className="min-h-[48px] px-4 rounded-touch bg-brand text-white text-sm font-semibold
              hover:bg-brand-hover active:scale-[0.98] transition-all"
          >
            Go to Today
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-brand font-medium flex items-center gap-1 hover:underline"
        >
          ← Back
        </button>
      </div>

      <h2 className="font-heading font-bold text-xl mb-1">New Walk-in Booking</h2>
      <p className="text-sm text-ink-muted mb-4">
        For phone, walk-in, or Messenger bookings. Payment is marked as paid on-site.
      </p>

      <ManualBookingForm onSuccess={handleSuccess} />
    </div>
  );
}
