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
  /** packages.max_nights — 1 hides the nights stepper (single-day only). */
  maxNights?: number;
  onContinue?: (date: string, pax: number, nights: number) => void;
}

/** Date-only "YYYY-MM-DD" + n days (UTC — no timezone drift). */
function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
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

export default function BookingPicker({
  pkgSlug,
  tiers,
  maxNights = 1,
  onContinue,
}: BookingPickerProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-indexed
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [pax, setPax] = useState(1);
  const [nights, setNights] = useState(1);

  const stayNights = Math.max(1, Math.min(maxNights, nights));

  const { availabilityMap, loading } = useAvailability(pkgSlug, month, year);

  // Max pax from the highest tier, capped by the tightest night of the STAY
  // (both in PAX units — matches create_booking_transactional's
  // SUM(pax) + p_pax > capacity_per_day check). QA davaobook-0037.
  const tierMaxPax = useMemo(() => {
    if (tiers.length === 0) return 10; // fallback
    return Math.max(...tiers.map((t) => t.max_pax));
  }, [tiers]);

  // Min remaining across every night of the stay. Dates the calendar hasn't
  // fetched (stay crosses into the next month) are skipped — the server is
  // the trust boundary and re-checks all nights.
  const remaining = useMemo(() => {
    if (!selectedDate) return undefined;
    let min: number | undefined;
    for (let i = 0; i < stayNights; i++) {
      const r = availabilityMap[addDaysStr(selectedDate, i)]?.remaining;
      if (r !== undefined) min = min === undefined ? r : Math.min(min, r);
    }
    return min;
  }, [selectedDate, stayNights, availabilityMap]);

  // Any closed night (blocked date / package doesn't run that weekday)
  // makes the whole stay unbookable.
  const stayClosed = useMemo(() => {
    if (!selectedDate) return false;
    for (let i = 0; i < stayNights; i++) {
      if (availabilityMap[addDaysStr(selectedDate, i)]?.status === "closed") {
        return true;
      }
    }
    return false;
  }, [selectedDate, stayNights, availabilityMap]);

  const maxPax =
    selectedDate && remaining !== undefined
      ? Math.max(1, Math.min(tierMaxPax, remaining))
      : tierMaxPax;
  const effectivePax = Math.min(pax, maxPax);

  // Price calculation — flat per-night rate x nights
  const pricing = useMemo(
    () => calculateTierPrice(tiers, effectivePax, stayNights),
    [tiers, effectivePax, stayNights]
  );

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
        <PaxStepper value={effectivePax} min={1} max={maxPax} onChange={setPax} />
        {selectedDate && remaining !== undefined && remaining < tierMaxPax && (
          <p className="mt-2 text-center text-xs text-ink-muted">
            {remaining} guest{remaining === 1 ? "" : "s"} left on this date
          </p>
        )}
      </section>

      {/* Nights stepper — only when the package allows a multi-night stay */}
      {maxNights > 1 && (
        <section className="px-4 mt-6">
          <h3 className="font-heading font-semibold text-base mb-3 text-center">
            Number of nights
          </h3>
          <PaxStepper
            noun="nights"
            value={stayNights}
            min={1}
            max={maxNights}
            onChange={setNights}
          />
          {selectedDate && stayNights > 1 && (
            <p className="mt-2 text-center text-xs text-ink-muted">
              {formatDisplayDate(selectedDate)} →{" "}
              {formatDisplayDate(addDaysStr(selectedDate, stayNights))}
              {stayClosed && " — one or more nights unavailable"}
            </p>
          )}
        </section>
      )}

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
          stayClosed ? (
            /* A blocked night / non-running weekday makes the whole stay
               unbookable — stop here rather than let the server 409. */
            <div className="w-full bg-white border-t border-gray-200 px-4 py-3 text-center text-red-500 text-sm font-medium">
              One or more nights of this stay are unavailable — pick another
              date
            </div>
          ) : (
            /* Continue CTA when date selected + callback provided */
            <div className="w-full bg-white border-t border-gray-200 px-4 py-3">
              <div className="flex items-center justify-between max-w-3xl mx-auto mb-2">
                <div className="text-sm text-ink-muted">
                  <span className="font-medium text-ink">
                    ₱{pricing.total.toLocaleString("en-PH")}
                  </span>
                  <span className="ml-1">
                    for {effectivePax} guest{effectivePax === 1 ? "" : "s"}
                    {stayNights > 1 && `, ${stayNights} nights`}
                  </span>
                </div>
              </div>
              <button
                onClick={() => onContinue(selectedDate, effectivePax, stayNights)}
                className="w-full btn-primary"
              >
                Continue
              </button>
            </div>
          )
        ) : pricing ? (
          /* Live total when no continue callback or no date */
          <LiveTotal
            pricePerPax={pricing.pricePerPax}
            pax={effectivePax}
            total={pricing.total}
          />
        ) : effectivePax > 0 ? (
          /* No tier match warning */
          <div className="w-full bg-white border-t border-gray-200 px-4 py-3 text-center text-red-500 text-sm font-medium">
            No pricing tier for {effectivePax} guest
            {effectivePax === 1 ? "" : "s"}
          </div>
        ) : null}
      </div>
    </div>
  );
}

