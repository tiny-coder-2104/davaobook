"use client";

import { useState, useEffect } from "react";
import StatCard from "@/app/components/StatCard";

interface Insights {
  total_revenue: number;
  booking_counts: Record<string, number>;
  revenue_by_month: Record<string, number>;
  popular_packages: { name: string; count: number }[];
  occupancy_rate: number;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING_CONFIRMATION: "Needs confirm",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
  DECLINED: "Declined",
  EXPIRED: "Expired",
  COMPLETED: "Completed",
};

const STATUS_DOTS: Record<string, string> = {
  PENDING_CONFIRMATION: "bg-status-pending",
  CONFIRMED: "bg-status-confirmed",
  CANCELLED: "bg-status-cancelled",
  DECLINED: "bg-status-cancelled",
  EXPIRED: "bg-status-expired",
  COMPLETED: "bg-status-confirmed",
};

export default function AdminInsights() {
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/insights");
        if (res.ok) setData(await res.json());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-touch" />
          ))}
        </div>
        <div className="h-48 bg-gray-100 rounded-touch" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-ink-muted">
        <p className="text-lg">Failed to load insights</p>
        <p className="text-sm mt-1">Try refreshing the page</p>
      </div>
    );
  }

  const totalBookings = Object.values(data.booking_counts).reduce(
    (a, b) => a + b,
    0
  );
  const pending =
    (data.booking_counts.PENDING_CONFIRMATION ?? 0) +
    (data.booking_counts.PENDING_PAYMENT ?? 0);
  const maxRevenue = Math.max(...Object.values(data.revenue_by_month), 1);

  return (
    <div className="space-y-4">
      {/* Stat cards — all-time unless the sub says otherwise */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total revenue"
          value={`₱${data.total_revenue.toLocaleString()}`}
          sub="Confirmed bookings, all time"
        />
        <StatCard
          label="Total bookings"
          value={String(totalBookings)}
          sub="All time"
        />
        <StatCard
          label="Pending"
          value={String(pending)}
          sub="Awaiting your confirmation"
        />
        <StatCard
          label="Occupancy"
          value={`${data.occupancy_rate}%`}
          sub="Avg. how full booked stays are"
        />
      </div>

      {/* Revenue by month — plain div bars, no chart lib */}
      <div className="bg-surface rounded-touch border border-gray-200 p-5">
        <h3 className="font-heading font-semibold text-ink">
          Revenue by month
        </h3>
        <p className="text-xs text-ink-muted mt-0.5">
          Last 6 months · confirmed bookings only
        </p>
        <div className="mt-4 space-y-3">
          {Object.entries(data.revenue_by_month).map(([month, amount]) => (
            <div key={month}>
              <div className="flex justify-between text-sm">
                <span className="text-ink">{month}</span>
                <span className="text-ink-muted">
                  ₱{amount.toLocaleString()}
                </span>
              </div>
              <div className="mt-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand rounded-full transition-all"
                  style={{ width: `${(amount / maxRevenue) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Popular packages */}
        <div className="bg-surface rounded-touch border border-gray-200 p-5">
          <h3 className="font-heading font-semibold text-ink">
            Popular packages
          </h3>
          {data.popular_packages.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">No bookings yet</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.popular_packages.map((p) => (
                <li
                  key={p.name}
                  className="flex justify-between text-sm gap-3"
                >
                  <span className="text-ink truncate">{p.name}</span>
                  <span className="text-ink-muted shrink-0">
                    {p.count} booking{p.count !== 1 ? "s" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Bookings by status */}
        <div className="bg-surface rounded-touch border border-gray-200 p-5">
          <h3 className="font-heading font-semibold text-ink">
            Bookings by status
          </h3>
          <ul className="mt-3 space-y-2">
            {Object.entries(data.booking_counts).map(([status, count]) => (
              <li key={status} className="flex items-center gap-2 text-sm">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    STATUS_DOTS[status] ?? "bg-gray-300"
                  }`}
                />
                <span className="text-ink">
                  {STATUS_LABELS[status] ?? status}
                </span>
                <span className="ml-auto text-ink-muted">{count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}