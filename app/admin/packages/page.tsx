"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { type Package } from "@/lib/types";

/* ── Package card skeleton ── */

function PackageSkeleton() {
  return (
    <div className="rounded-touch border border-gray-100 bg-white p-4 animate-pulse">
      <div className="flex gap-3">
        <div className="w-[72px] h-[72px] rounded-lg bg-gray-200 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-2/3" />
          <div className="h-3 bg-gray-100 rounded w-1/3" />
          <div className="h-5 bg-gray-100 rounded-full w-16" />
        </div>
      </div>
    </div>
  );
}

/* ── Day abbreviations ── */

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDays(days: number[]): string {
  if (days.length === 7) return "Every day";
  if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d)))
    return "Weekdays";
  if (
    days.length === 2 &&
    days.includes(0) &&
    days.includes(6)
  )
    return "Weekends";
  return days.map((d) => DAY_SHORT[d]).join(", ");
}

function priceRange(tiers: Package["tiers"]): string {
  if (!tiers || tiers.length === 0) return "No pricing";
  const prices = tiers.map((t) => t.price_per_pax);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) return `₱${min.toLocaleString("en-PH")}/pax`;
  return `₱${min.toLocaleString("en-PH")}–${max.toLocaleString("en-PH")}/pax`;
}

/* ── Main component ── */

export default function AdminPackages() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/packages");
      if (res.ok) {
        const data = await res.json();
        setPackages(data.packages);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  async function handleDeactivate(id: string) {
    if (!window.confirm("Deactivate this package? It will no longer appear for guests.")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/packages/${id}`, { method: "DELETE" });
      if (res.ok) {
        setPackages((prev) =>
          prev.map((p) => (p.id === id ? { ...p, active: false } : p))
        );
      }
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header + Add button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading font-bold text-xl">Packages</h2>
          <p className="text-sm text-ink-muted mt-0.5">
            {packages.length} package{packages.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/admin/packages/new"
          className="min-h-[56px] px-5 rounded-touch bg-brand text-white font-heading font-semibold
            flex items-center gap-2 hover:bg-brand-hover active:scale-[0.98] transition-all text-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add package
        </Link>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <PackageSkeleton key={i} />
          ))}
        </div>
      ) : packages.length === 0 ? (
        <div className="text-center py-16 text-ink-muted">
          <p className="text-lg mb-2">No packages yet</p>
          <p className="text-sm mb-4">Create your first package to start accepting bookings.</p>
          <Link href="/admin/packages/new" className="btn-primary inline-flex">
            Create package
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className={`rounded-touch border bg-white p-3 sm:p-4 transition-colors
                ${pkg.active ? "border-gray-100 hover:border-gray-200" : "border-gray-200 opacity-60"}`}
            >
              <div className="flex gap-3 items-start">
                {/* Photo */}
                {pkg.photo_url ? (
                  <img
                    src={pkg.photo_url}
                    alt={pkg.name}
                    loading="lazy"
                    className="w-[72px] h-[72px] object-cover rounded-lg bg-gray-100 shrink-0"
                  />
                ) : (
                  <div className="w-[72px] h-[72px] rounded-lg bg-gray-50 flex items-center justify-center text-2xl shrink-0">
                    🏝️
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-heading font-semibold text-base truncate">
                      {pkg.name}
                    </h3>
                    <span
                      className={`status-badge text-xs shrink-0 ${
                        pkg.active
                          ? "bg-status-confirmed/15 text-status-confirmed"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {pkg.active ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <p className="text-sm text-brand font-medium mt-0.5">
                    {priceRange(pkg.tiers)}
                  </p>

                  <div className="flex items-center gap-3 mt-1 text-xs text-ink-muted">
                    <span>{formatDays(pkg.days_of_week)}</span>
                    <span>·</span>
                    <span>{pkg.capacity_per_day} pax/day</span>
                    {pkg.downpayment_pct > 0 && (
                      <>
                        <span>·</span>
                        <span>{pkg.downpayment_pct}% DP</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                <Link
                  href={`/admin/packages/edit/${pkg.id}`}
                  className="flex-1 min-h-[44px] rounded-touch border border-gray-200 text-sm font-medium
                    flex items-center justify-center gap-1.5 hover:bg-gray-50 active:scale-[0.98] transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </Link>
                {pkg.active && (
                  <button
                    type="button"
                    onClick={() => handleDeactivate(pkg.id)}
                    disabled={deleting === pkg.id}
                    className="min-h-[44px] px-4 rounded-touch border border-red-200 text-sm font-medium
                      text-status-cancelled hover:bg-red-50 active:scale-[0.98] transition-all
                      disabled:opacity-50"
                  >
                    {deleting === pkg.id ? "..." : "Deactivate"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
