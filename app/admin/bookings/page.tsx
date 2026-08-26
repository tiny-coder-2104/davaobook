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
  { key: "PENDING_PAYMENT", label: "Pending Payment" },
  { key: "PENDING_CONFIRMATION", label: "Needs Confirm" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "CANCELLED", label: "Cancelled" },
  { key: "EXPIRED", label: "Expired" },
];

interface BookingsResponse {
  bookings: BookingRow[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export default function AdminBookings() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<BookingRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter !== "all") params.set("status", filter);
    if (search) params.set("search", search);
    if (dateStart) params.set("start", dateStart);
    if (dateEnd) params.set("end", dateEnd);
    params.set("page", String(page));
    params.set("limit", "20");

    try {
      const res = await fetch(`/api/admin/bookings?${params}`);
      if (res.ok) {
        const data: BookingsResponse = await res.json();
        setBookings(data.bookings);
        setTotal(data.total);
        setTotalPages(data.pages);
      }
    } finally {
      setLoading(false);
    }
  }, [filter, search, page, dateStart, dateEnd]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selectedIds.size === bookings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(bookings.map((b) => b.id)));
    }
  }

  async function bulkAction(action: string) {
    if (selectedIds.size === 0) return;
    const msg =
      action === "confirm"
        ? `Confirm ${selectedIds.size} bookings?`
        : `Cancel ${selectedIds.size} bookings?`;
    if (!window.confirm(msg)) return;

    setBulkLoading(true);
    const ids = Array.from(selectedIds);
    await Promise.all(
      ids.map((id) =>
        fetch(`/api/admin/bookings/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        })
      )
    );
    setSelectedIds(new Set());
    setBulkLoading(false);
    fetchBookings();
  }

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

  function exportCSV() {
    if (bookings.length === 0) return;
    const headers = [
      "Code",
      "Guest",
      "Mobile",
      "Email",
      "Package",
      "Tour Date",
      "Pax",
      "Total",
      "Status",
      "GCash Ref",
      "Created",
    ];
    const rows = bookings.map((b) => [
      b.code,
      b.guest_name,
      b.mobile,
      b.email ?? "",
      b.packages?.name ?? "",
      b.tour_date,
      String(b.pax),
      String(b.total_amount),
      b.status,
      b.gcash_ref ?? "",
      b.created_at,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bookings-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search name or code…"
          className="flex-1 rounded-touch border border-gray-300 px-3 py-2.5 text-sm
                     focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <button
          onClick={exportCSV}
          disabled={bookings.length === 0}
          className="px-4 py-2.5 rounded-touch text-sm font-medium bg-white border border-gray-200
                     hover:bg-gray-50 disabled:opacity-40 shrink-0"
        >
          📥 Export CSV
        </button>
      </div>

      {/* Date range */}
      <div className="flex gap-2 items-center text-sm">
        <label className="text-ink-muted">From</label>
        <input
          type="date"
          value={dateStart}
          onChange={(e) => {
            setDateStart(e.target.value);
            setPage(1);
          }}
          className="rounded-touch border border-gray-300 px-2 py-1.5 text-sm"
        />
        <label className="text-ink-muted">To</label>
        <input
          type="date"
          value={dateEnd}
          onChange={(e) => {
            setDateEnd(e.target.value);
            setPage(1);
          }}
          className="rounded-touch border border-gray-300 px-2 py-1.5 text-sm"
        />
      </div>

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
          </button>
        ))}
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-touch bg-brand/5 border border-brand/20">
          <span className="text-sm font-medium text-brand">
            {selectedIds.size} selected
          </span>
          <button
            onClick={selectAll}
            className="text-sm text-ink-muted hover:text-ink underline"
          >
            {selectedIds.size === bookings.length ? "Deselect all" : "Select all"}
          </button>
          <div className="flex-1" />
          <button
            onClick={() => bulkAction("confirm")}
            disabled={bulkLoading}
            className="px-3 py-1.5 rounded-touch text-sm font-medium bg-status-confirmed text-white
                       hover:bg-status-confirmed/90 disabled:opacity-50"
          >
            Bulk Confirm
          </button>
          <button
            onClick={() => bulkAction("cancel")}
            disabled={bulkLoading}
            className="px-3 py-1.5 rounded-touch text-sm font-medium bg-status-cancelled text-white
                       hover:bg-status-cancelled/90 disabled:opacity-50"
          >
            Bulk Cancel
          </button>
        </div>
      )}

      {/* Total count */}
      <p className="text-sm text-ink-muted">{total} booking{total !== 1 ? "s" : ""} found</p>

      {/* Booking list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-12 text-ink-muted">
          <p className="text-lg">No bookings found</p>
          <p className="text-sm mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {bookings.map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                onClick={setSelected}
                showCheckbox
                selected={selectedIds.has(b.id)}
                onToggleSelect={toggleSelect}
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
