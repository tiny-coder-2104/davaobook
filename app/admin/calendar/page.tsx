"use client";

import { useState, useEffect, useCallback } from "react";
import CalendarMonth from "@/app/components/CalendarMonth";
import DaySheet from "@/app/components/DaySheet";
import type { BookingStatus } from "@/lib/transitions";

/**
 * Admin Calendar — month grid per package with fill count badges.
 * Tap day → day sheet with bookings list, block toggle, weather cancel.
 */

interface PackageOption {
  id: string;
  name: string;
  capacity_per_day: number;
}

interface CalendarBooking {
  id: string;
  code: string;
  guest_name: string;
  pax: number;
  status: BookingStatus;
  mobile: string;
}

interface BlockRow {
  id: string;
  package_id: string | null;
  date: string;
  reason: string | null;
}

interface DayCellData {
  bookingCount: number;
  capacity: number;
  isBlocked: boolean;
  hasBlockForPackage: boolean;
}

interface DayData {
  bookings: CalendarBooking[];
  blocks: BlockRow[];
  capacity: number;
}

export default function AdminCalendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [selectedPkg, setSelectedPkg] = useState<string>("__all__");
  const [daysMap, setDaysMap] = useState<Record<string, DayCellData>>({});
  const [loading, setLoading] = useState(true);

  // Day sheet state
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayBookings, setDayBookings] = useState<CalendarBooking[]>([]);
  const [dayBlocks, setDayBlocks] = useState<BlockRow[]>([]);
  const [dayCapacity, setDayCapacity] = useState(0);
  const [dayLoading, setDayLoading] = useState(false);

  const fetchCalendar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        year: String(year),
        month: String(month),
      });
      if (selectedPkg !== "__all__") {
        params.set("package_id", selectedPkg);
      }

      const res = await fetch(`/api/admin/calendar?${params}`);
      const data = await res.json();

      if (data.packages) {
        setPackages(data.packages);
      }

      // Build days map for CalendarMonth
      const days: Record<string, DayCellData> = {};
      for (const [dateStr, dayData] of Object.entries(
        data.days as Record<string, DayData>
      )) {
        const d = dayData as DayData;
        days[dateStr] = {
          bookingCount: d.bookings?.length ?? 0,
          capacity: d.capacity ?? 0,
          isBlocked: (d.blocks?.length ?? 0) > 0,
          hasBlockForPackage: (d.blocks?.length ?? 0) > 0,
        };
      }
      setDaysMap(days);
    } catch (err) {
      console.error("Calendar fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [year, month, selectedPkg]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  // Fetch full day details for the day sheet
  async function fetchDayData(dateStr: string) {
    setDayLoading(true);
    try {
      const params = new URLSearchParams({
        year: String(year),
        month: String(month),
      });
      if (selectedPkg !== "__all__") {
        params.set("package_id", selectedPkg);
      }
      const res = await fetch(`/api/admin/calendar?${params}`);
      const data = await res.json();
      const dayData = data.days?.[dateStr] as DayData | undefined;
      setDayBookings(dayData?.bookings ?? []);
      setDayBlocks(dayData?.blocks ?? []);
      setDayCapacity(dayData?.capacity ?? 0);
    } catch (err) {
      console.error("Day data fetch error:", err);
    } finally {
      setDayLoading(false);
    }
  }

  function handleDaySelect(dateStr: string) {
    setSelectedDate(dateStr);
    fetchDayData(dateStr);
  }

  async function handleBlock(date: string, packageId: string | null) {
    await fetch("/api/admin/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        package_id: packageId,
        date,
        reason: "Manual block",
      }),
    });
    fetchCalendar();
    fetchDayData(date);
  }

  async function handleUnblock(blockId: string) {
    await fetch(`/api/admin/blocks/${blockId}`, { method: "DELETE" });
    fetchCalendar();
    if (selectedDate) fetchDayData(selectedDate);
  }

  function handleDayChanged() {
    fetchCalendar();
    if (selectedDate) fetchDayData(selectedDate);
  }

  function prevMonth() {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  }

  function nextMonth() {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  }

  return (
    <div className="space-y-4">
      {/* Package selector — horizontal scroll tabs */}
      {packages.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            onClick={() => setSelectedPkg("__all__")}
            className={`shrink-0 px-4 py-2 rounded-touch text-sm font-medium transition-colors
              ${
                selectedPkg === "__all__"
                  ? "bg-brand text-white"
                  : "bg-gray-100 text-ink hover:bg-gray-200"
              }`}
          >
            All packages
          </button>
          {packages.map((pkg) => (
            <button
              key={pkg.id}
              onClick={() => setSelectedPkg(pkg.id)}
              className={`shrink-0 px-4 py-2 rounded-touch text-sm font-medium transition-colors
                ${
                  selectedPkg === pkg.id
                    ? "bg-brand text-white"
                    : "bg-gray-100 text-ink hover:bg-gray-200"
                }`}
            >
              {pkg.name}
            </button>
          ))}
        </div>
      )}

      {/* Calendar grid */}
      <CalendarMonth
        year={year}
        month={month}
        days={daysMap}
        selectedDate={selectedDate}
        onSelect={handleDaySelect}
        onPrevMonth={prevMonth}
        onNextMonth={nextMonth}
        loading={loading}
      />

      {/* Day sheet */}
      {selectedDate && (
        <DaySheet
          date={selectedDate}
          bookings={dayBookings}
          blocks={dayBlocks}
          capacity={dayCapacity}
          loading={dayLoading}
          onClose={() => setSelectedDate(null)}
          onBlock={handleBlock}
          onUnblock={handleUnblock}
          onChanged={handleDayChanged}
          onBookingTap={(b) => {
            window.open(`/admin/bookings?search=${b.code}`, "_blank");
          }}
        />
      )}
    </div>
  );
}
