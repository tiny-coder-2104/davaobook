"use client";

import { useState, useEffect, useCallback } from "react";
import BookingCard, {
  type BookingRow,
} from "@/app/components/BookingCard";
import BookingDetailSheet from "@/app/components/BookingDetailSheet";
import SkeletonCard from "@/app/components/SkeletonCard";
import { type BookingStatus } from "@/lib/transitions";

type Filter = "all" | BookingStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "PENDING_CONFIRMATION", label: "Needs Confirm" },
  { key: "PENDING_PAYMENT", label: "Pending Payment" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "CANCELLED", label: "Cancelled" },
];

interface TodayResponse {
  bookings: BookingRow[];
  pending_count: number;
  date: string;
}

export default function AdminToday() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<BookingRow | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 20;

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    const url =
      filter === "all"
        ? "/api/admin/today"
        : `/api/admin/today?status=${filter}`;

    try {
      const res = await fetch(url);
      if (res.ok) {
        const data: TodayResponse = await res.json();
        setBookings(data.bookings);
        setPendingCount(data.pending_count);
      }
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Sort: pending confirmations first
  const sorted = [...bookings].sort((a, b) => {
    if (
      a.status === "PENDING_CONFIRMATION" &&
      b.status !== "PENDING_CONFIRMATION"
    )
      return -1;
    if (
      b.status === "PENDING_CONFIRMATION" &&
      a.status !== "PENDING_CONFIRMATION"
    )
      return 1;
    return 0;
  });

  const totalPages = Math.ceil(sorted.length / perPage);
  const paged = sorted.slice((page - 1) * perPage, page * perPage);

  async function handleAction(
    bookingId: string,
    action: string,
    meta?: Record<string, unknown>
  ) {
    const res = await fetch(`/api/admin/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });

    if (res.ok) {
      setSelected(null);
      fetchBookings();
    }
  }

  return (
    <div className="space-y-4">
      {/* Pending badge */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-touch bg-amber-50 border border-amber-200">
          <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">
            {pendingCount}
          </span>
          <span className="text-sm font-medium text-amber-700">
            {pendingCount} booking{pendingCount !== 1 ? "s" : ""} need
            confirmation
          </span>
        </div>
      )}

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => {
              setFilter(f.key);
              setPage(1);
            }}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors
              ${
                filter === f.key
                  ? "bg-brand text-white"
                  : "bg-white border border-gray-200 text-ink-muted hover:border-gray-300"
              }`}
          >
            {f.label}
            {f.key === "PENDING_CONFIRMATION" && pendingCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-xs">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Booking list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : paged.length === 0 ? (
        <div className="text-center py-12 text-ink-muted">
          <p className="text-lg">No bookings for today</p>
          <p className="text-sm mt-1">New bookings will appear here</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {paged.map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                onClick={setSelected}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-ink-muted">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 rounded-touch text-sm bg-white border border-gray-200
                             disabled:opacity-40 hover:bg-gray-50"
                >
                  ← Prev
                </button>
                <button
                  onClick={() =>
                    setPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 rounded-touch text-sm bg-white border border-gray-200
                             disabled:opacity-40 hover:bg-gray-50"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail sheet */}
      {selected && (
        <BookingDetailSheet
          booking={selected}
          onClose={() => setSelected(null)}
          onAction={handleAction}
        />
      )}
    </div>
  );
}
