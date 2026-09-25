import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-server";

// Status pages must reflect the CURRENT row on every request. Without this,
// the supabaseAdmin fetch defaults to force-cache and the guest sees the
// status as of their FIRST load forever (QA 0043: weather-cancel invisible,
// deleted codes kept serving 200).
export const dynamic = "force-dynamic";

interface PageProps {
  params: { code: string };
}

/* ── Status helpers ── */

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

const STATUS_STYLES: Record<string, string> = {
  PENDING_CONFIRMATION: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-status-confirmed/15 text-status-confirmed",
  EXPIRED: "bg-status-expired/15 text-status-expired",
  DECLINED: "bg-red-100 text-red-500",
  CANCELLED: "bg-status-cancelled/15 text-status-cancelled",
  PENDING_PAYMENT: "bg-status-pending/15 text-status-pending",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  NO_SHOW: "bg-gray-100 text-gray-500",
};

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/* ── Page ── */

export default async function BookingStatusPage({ params }: PageProps) {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("code, status, tour_date, pax, total_amount, cancelled_reason, packages(name)")
    .eq("code", params.code.toUpperCase())
    .single();

  if (error || !data) notFound();

  const pkgRaw = data.packages as unknown;
  const pkg = Array.isArray(pkgRaw) ? pkgRaw[0] : pkgRaw;
  const packageName = (pkg as { name?: string } | null)?.name ?? "Room";

  const status = data.status as string;
  const label = STATUS_LABELS[status] ?? status;
  const style = STATUS_STYLES[status] ?? "bg-gray-100 text-gray-500";
  const weatherCancelled =
    status === "CANCELLED" && data.cancelled_reason === "WEATHER";

  return (
    <main className="px-4 py-8 min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto">
        <div className="rounded-touch border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h1 className="font-heading font-bold text-xl text-ink">
              Booking status
            </h1>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${style}`}
            >
              {label}
            </span>
          </div>

          {/* Weather-cancel reason (only when cancelled_reason = WEATHER;
              plain operator cancels keep the original presentation) */}
          {weatherCancelled && (
            <div className="mb-4 rounded-touch border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm text-sky-800">
              Cancelled due to bad weather — contact the resort about
              rebooking or refunds.
            </div>
          )}

          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-ink-muted">Room</span>
              <span className="font-medium text-ink text-right">
                {packageName}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-ink-muted">Stay date</span>
              <span className="font-medium text-ink text-right">
                {formatDisplayDate(data.tour_date)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-ink-muted">Guests</span>
              <span className="font-medium text-ink">
                {data.pax} guest{data.pax === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-ink-muted">Total</span>
              <span className="font-heading font-bold text-brand">
                ₱{data.total_amount.toLocaleString("en-PH")}
              </span>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 text-center">
            <p className="text-xs text-ink-muted mb-1">Booking code</p>
            <p className="font-mono font-bold text-lg text-ink tracking-wide select-all">
              {data.code}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}