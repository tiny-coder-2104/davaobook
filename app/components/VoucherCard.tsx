"use client";

import { useEffect, useState, useCallback } from "react";
import QRCode from "./QRCode";
import { cacheVoucher } from "@/lib/voucher-cache";

/* ── Status color bands (spec §4.2 item 4) ── */

const STATUS_BAND: Record<string, string> = {
  PENDING_PAYMENT: "bg-yellow-400",
  PENDING_CONFIRMATION: "bg-orange-400",
  CONFIRMED: "bg-green-500",
  CANCELLED: "bg-red-500",
  COMPLETED: "bg-blue-500",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Pending Payment",
  PENDING_CONFIRMATION: "Awaiting Confirmation",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
  EXPIRED: "Expired",
  DECLINED: "Declined",
  NO_SHOW: "No Show",
};

/* ── Types ── */

export interface VoucherData {
  code: string;
  status: string;
  tour_date: string;
  pax: number;
  guest_name: string;
  mobile: string;
  pickup_area: string;
  notes: string | null;
  package_name: string;
  total_amount: number;
  operator_name: string;
  operator_phone: string;
  operator_email: string;
  operator_logo_url: string | null;
}

interface VoucherCardProps {
  data: VoucherData;
  /** If true, data came from network. If false, it's a cached/offline version. */
  isOnline: boolean;
}

/* ── Helpers ── */

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/* ── Component ── */

export default function VoucherCard({ data, isOnline }: VoucherCardProps) {
  const [copied, setCopied] = useState(false);

  // Cache on mount for offline access
  useEffect(() => {
    cacheVoucher(data);
  }, [data]);

  const voucherUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/v/${data.code}`
      : `/v/${data.code}`;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(voucherUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // silent
    }
  }, [voucherUrl]);

  const handleShare = useCallback(async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({
        title: `Voucher — ${data.package_name}`,
        text: `${data.guest_name}, your ${data.package_name} booking is ${STATUS_LABEL[data.status] ?? data.status}. Code: ${data.code}. Tour: ${formatDisplayDate(data.tour_date)}.`,
        url: voucherUrl,
      });
    } catch {
      // user cancelled or API unavailable
    }
  }, [data, voucherUrl]);

  const bandColor = STATUS_BAND[data.status] ?? "bg-gray-400";

  return (
    <div className="max-w-md mx-auto">
      {/* Offline banner */}
      {!isOnline && (
        <div className="mb-3 rounded-touch bg-amber-50 border border-amber-200 px-4 py-2 text-center">
          <p className="text-xs text-amber-700">
            Showing saved copy — some details may be outdated
          </p>
        </div>
      )}

      {/* Boarding pass card */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
        {/* ── Top: status color band ── */}
        <div className={`${bandColor} px-4 py-2 flex items-center justify-between`}>
          <span className="text-white text-xs font-semibold uppercase tracking-wide">
            {STATUS_LABEL[data.status] ?? data.status}
          </span>
          <span className="text-white/80 text-xs font-mono">{data.code}</span>
        </div>

        {/* ── Header: operator + package ── */}
        <div className="px-4 pt-4 pb-3 flex items-center gap-3">
          {data.operator_logo_url ? (
            <img
              src={data.operator_logo_url}
              alt={data.operator_name}
              className="w-10 h-10 rounded-full object-cover bg-gray-100 shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center text-brand font-heading font-bold text-sm shrink-0">
              {data.operator_name.charAt(0)}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="font-heading font-bold text-lg text-ink truncate">
              {data.package_name}
            </h1>
            <p className="text-xs text-ink-muted truncate">
              {data.operator_name}
            </p>
          </div>
        </div>

        {/* ── Perforated edge ── */}
        <div className="relative h-px mx-4">
          <div className="absolute inset-0 border-t-2 border-dashed border-gray-300" />
          {/* Notch cutouts */}
          <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-6 h-6 bg-gray-50 rounded-full" />
          <div className="absolute -right-6 top-1/2 -translate-y-1/2 w-6 h-6 bg-gray-50 rounded-full" />
        </div>

        {/* ── Middle: booking details ── */}
        <div className="px-4 py-3 space-y-2">
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-ink-muted uppercase tracking-wide">
              Guest
            </span>
            <span className="text-sm font-medium text-ink">
              {data.guest_name}
            </span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-ink-muted uppercase tracking-wide">
              Tour Date
            </span>
            <span className="text-sm font-medium text-ink">
              {formatDisplayDate(data.tour_date)}
            </span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-ink-muted uppercase tracking-wide">
              Guests
            </span>
            <span className="text-sm font-medium text-ink">
              {data.pax} {data.pax === 1 ? "pax" : "pax"}
            </span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-ink-muted uppercase tracking-wide">
              Total
            </span>
            <span className="text-sm font-heading font-bold text-brand">
              ₱{data.total_amount.toLocaleString("en-PH")}
            </span>
          </div>
        </div>

        {/* ── Perforated edge ── */}
        <div className="relative h-px mx-4">
          <div className="absolute inset-0 border-t-2 border-dashed border-gray-300" />
          <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-6 h-6 bg-gray-50 rounded-full" />
          <div className="absolute -right-6 top-1/2 -translate-y-1/2 w-6 h-6 bg-gray-50 rounded-full" />
        </div>

        {/* ── Bottom: pickup details ── */}
        <div className="px-4 py-3 space-y-2">
          <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
            Pickup Details
          </h2>
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-ink-muted">Meeting Point</span>
            <span className="text-sm font-medium text-ink text-right max-w-[60%]">
              {data.pickup_area}
            </span>
          </div>
          {data.notes && (
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-ink-muted">Notes</span>
              <span className="text-sm font-medium text-ink text-right max-w-[60%]">
                {data.notes}
              </span>
            </div>
          )}
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-ink-muted">Mobile</span>
            <span className="text-sm font-medium text-ink">{data.mobile}</span>
          </div>
        </div>

        {/* ── Operator contact ── */}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
          <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-2">
            Operator Contact
          </h2>
          <div className="space-y-1">
            <a
              href={`tel:${data.operator_phone}`}
              className="flex items-center gap-2 text-sm text-brand hover:underline"
            >
              <svg
                className="w-4 h-4 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
              {data.operator_phone}
            </a>
            <a
              href={`mailto:${data.operator_email}`}
              className="flex items-center gap-2 text-sm text-brand hover:underline"
            >
              <svg
                className="w-4 h-4 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              {data.operator_email}
            </a>
          </div>
        </div>

        {/* ── QR Code section ── */}
        <div className="px-4 py-5 flex flex-col items-center gap-3 border-t border-gray-100">
          <QRCode value={voucherUrl} size={256} />
          <p className="text-xs text-ink-muted text-center">
            Scan to open this voucher
          </p>
        </div>

        {/* ── Actions: Share + Copy ── */}
        <div className="px-4 pb-4 space-y-2">
          {typeof navigator !== "undefined" && "share" in navigator && (
            <button
              type="button"
              onClick={handleShare}
              className="w-full btn-primary"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
              Send to your group
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className="w-full min-h-[48px] rounded-touch border-2 border-gray-200 bg-white text-sm font-semibold
              hover:bg-gray-50 active:scale-[0.98] transition-all flex items-center justify-center"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            {copied ? "Link copied!" : "Copy voucher link"}
          </button>

          {/* Screenshot nudge */}
          <p className="text-center text-xs text-ink-muted">
            Take a screenshot to save this voucher
          </p>
        </div>
      </div>
    </div>
  );
}
