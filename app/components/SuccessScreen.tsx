"use client";

import { useEffect, useState } from "react";

interface SuccessScreenProps {
  bookingCode: string;
  tourDate: string;
  packageName: string;
  totalAmount: number;
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

/**
 * "Slot held until" = 24 hours from now (matches the expiry cron).
 */
function getSlotDeadline(): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return d.toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SuccessScreen({
  bookingCode,
  tourDate,
  packageName,
  totalAmount,
}: SuccessScreenProps) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fade-in animation on mount
  useEffect(() => {
    // Trigger vibrate
    try {
      navigator.vibrate?.(15);
    } catch {
      // ponytail: vibrate not available on all platforms
    }
    // Small delay for CSS transition
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bookingCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // silent fail
    }
  };

  const handleShare = async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({
        title: `Booking ${bookingCode}`,
        text: `My ${packageName} booking is confirmed! Code: ${bookingCode}. Tour date: ${formatDisplayDate(tourDate)}. Total: ₱${totalAmount.toLocaleString("en-PH")}`,
      });
    } catch {
      // ponytail: user cancelled share or API unavailable
    }
  };

  return (
    <div
      className={`px-4 pt-8 pb-12 text-center transition-opacity duration-500 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Success icon */}
      <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-status-confirmed/15 flex items-center justify-center">
        <svg
          className="w-8 h-8 text-status-confirmed"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12l5 5L19 7" />
        </svg>
      </div>

      <h1 className="font-heading font-bold text-xl text-ink mb-2">
        Booking submitted!
      </h1>

      <p className="text-sm text-ink-muted mb-6">
        We&apos;ll confirm your booking shortly
      </p>

      {/* Big booking code */}
      <div className="mb-6">
        <p className="text-xs text-ink-muted uppercase tracking-wider mb-1">
          Your booking code
        </p>
        <p className="font-mono font-bold text-3xl text-brand tracking-wide select-all">
          {bookingCode}
        </p>
      </div>

      {/* Copy + Share buttons */}
      <div className="flex gap-3 justify-center mb-6">
        <button
          type="button"
          onClick={handleCopy}
          className="min-h-[48px] px-5 rounded-touch border-2 border-gray-200 bg-white text-sm font-semibold
            hover:bg-gray-50 active:scale-95 transition-all"
        >
          {copied ? "Copied!" : "Copy code"}
        </button>
        {typeof navigator !== "undefined" && "share" in navigator && (
          <button
            type="button"
            onClick={handleShare}
            className="min-h-[48px] px-5 rounded-touch bg-brand text-white text-sm font-semibold
              hover:bg-brand-hover active:scale-95 transition-all"
          >
            Share
          </button>
        )}
      </div>

      {/* Urgency line */}
      <div className="rounded-touch bg-amber-50 border border-amber-200 px-4 py-3 mb-6 inline-block">
        <p className="text-sm text-amber-700">
          Slot held until <strong>{getSlotDeadline()}</strong> — please complete
          payment before then
        </p>
      </div>

      {/* Booking summary */}
      <div className="rounded-touch border border-gray-200 bg-white p-4 text-left space-y-2 mb-6 max-w-sm mx-auto">
        <div className="flex justify-between text-sm">
          <span className="text-ink-muted">Package</span>
          <span className="font-medium text-ink">{packageName}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-ink-muted">Date</span>
          <span className="font-medium text-ink">
            {formatDisplayDate(tourDate)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-ink-muted">Total</span>
          <span className="font-heading font-bold text-brand">
            ₱{totalAmount.toLocaleString("en-PH")}
          </span>
        </div>
      </div>

      {/* View voucher link */}
      <a
        href={`/b/${bookingCode}`}
        className="inline-block text-sm text-brand font-medium underline underline-offset-2
          hover:text-brand-hover transition-colors"
      >
        View booking status →
      </a>
    </div>
  );
}
