"use client";

import { useState, useMemo } from "react";
import CalendarGrid from "@/app/components/CalendarGrid";
import PaxStepper from "@/app/components/PaxStepper";
import LiveTotal from "@/app/components/LiveTotal";
import { useAvailability } from "@/hooks/useAvailability";
import { calculateTierPrice } from "@/lib/pricing";
import type { PackageTier } from "@/lib/types";

interface BookingPickerProps {
  pkgSlug: string;
  tiers: PackageTier[];
  onContinue?: (date: string, pax: number) => void;
}

export default function BookingPicker({
  pkgSlug,
  tiers,
  onContinue,
}: BookingPickerProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-indexed
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [pax, setPax] = useState(1);

  const { availabilityMap, loading } = useAvailability(pkgSlug, month, year);

  // Max pax from the highest tier
  const maxPax = useMemo(() => {
    if (tiers.length === 0) return 10; // fallback
    return Math.max(...tiers.map((t) => t.max_pax));
  }, [tiers]);

  // Price calculation
  const pricing = useMemo(() => calculateTierPrice(tiers, pax), [tiers, pax]);

  const prevMonth = () => {
    setSelectedDate(null);
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const nextMonth = () => {
    setSelectedDate(null);
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  return (
    <div className="pb-40">
      {/* Calendar */}
      <section className="px-4 pt-4">
        <CalendarGrid
          year={year}
          month={month}
          availabilityMap={availabilityMap}
          selectedDate={selectedDate}
          onSelect={setSelectedDate}
          onPrevMonth={prevMonth}
          onNextMonth={nextMonth}
          loading={loading}
        />
      </section>

      {/* Pax stepper */}
      <section className="px-4 mt-6">
        <h3 className="font-heading font-semibold text-base mb-3 text-center">
          Number of guests
        </h3>
        <PaxStepper value={pax} min={1} max={maxPax} onChange={setPax} />
      </section>

      {/* Selected date display */}
      {selectedDate && (
        <div className="px-4 mt-4 text-center">
          <span className="inline-block rounded-full bg-brand/10 text-brand text-sm font-medium px-3 py-1">
            {formatDisplayDate(selectedDate)}
          </span>
        </div>
      )}

      {/* Sticky bottom bar */}
      <div
        className="fixed bottom-0 inset-x-0 z-50"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {pricing && selectedDate && onContinue ? (
          /* Continue CTA when date selected + callback provided */
          <div className="w-full bg-white border-t border-gray-200 px-4 py-3">
            <div className="flex items-center justify-between max-w-3xl mx-auto mb-2">
              <div className="text-sm text-ink-muted">
                <span className="font-medium text-ink">
                  ₱{pricing.total.toLocaleString("en-PH")}
                </span>
                <span className="ml-1">for {pax} pax</span>
              </div>
            </div>
            <button
              onClick={() => onContinue(selectedDate, pax)}
              className="w-full btn-primary"
            >
              Continue
            </button>
          </div>
        ) : pricing ? (
          /* Live total when no continue callback or no date */
          <LiveTotal
            pricePerPax={pricing.pricePerPax}
            pax={pax}
            total={pricing.total}
          />
        ) : pax > 0 ? (
          /* No tier match warning */
          <div className="w-full bg-white border-t border-gray-200 px-4 py-3 text-center text-red-500 text-sm font-medium">
            No pricing tier for {pax} pax
          </div>
        ) : null}
      </div>
    </div>
  );
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
