"use client";

import type { DayAvailability } from "@/hooks/useAvailability";

interface CalendarGridProps {
  year: number;
  month: number; // 1-indexed
  availabilityMap: Record<string, DayAvailability>;
  selectedDate: string | null;
  onSelect: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  loading: boolean;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const STATUS_CLASSES: Record<string, string> = {
  available: "bg-green-100 text-green-800 hover:bg-green-200 cursor-pointer",
  "few-left": "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 cursor-pointer",
  full: "bg-red-100 text-red-400 cursor-not-allowed",
  closed: "bg-gray-100 text-gray-400 cursor-not-allowed",
};

export default function CalendarGrid({
  year,
  month,
  availabilityMap,
  selectedDate,
  onSelect,
  onPrevMonth,
  onNextMonth,
  loading,
}: CalendarGridProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();

  // Build cells array: empty slots for offset + day cells
  const cells: Array<{ day: number; dateStr: string } | null> = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, dateStr });
  }

  return (
    <div className="w-full">
      {/* Month header + nav */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={onPrevMonth}
          className="min-w-[48px] min-h-[48px] flex items-center justify-center rounded-touch text-xl font-bold text-ink-muted hover:bg-gray-100 active:scale-95 transition-transform"
          aria-label="Previous month"
        >
          ‹
        </button>
        <h2 className="font-heading font-semibold text-lg">
          {MONTH_NAMES[month - 1]} {year}
        </h2>
        <button
          onClick={onNextMonth}
          className="min-w-[48px] min-h-[48px] flex items-center justify-center rounded-touch text-xl font-bold text-ink-muted hover:bg-gray-100 active:scale-95 transition-transform"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="text-center text-xs font-medium text-ink-muted py-1"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Day grid — 44px cells per spec */}
      {loading && cells.length === 0 ? (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <div
              key={i}
              className="h-11 rounded-lg bg-gray-50 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, i) => {
            if (!cell) {
              return <div key={`empty-${i}`} className="h-11" />;
            }

            const { day, dateStr } = cell;
            const cellDate = new Date(year, month - 1, day);
            cellDate.setHours(0, 0, 0, 0);
            const isPast = cellDate < today;

            const avail = availabilityMap[dateStr];
            let status = avail?.status ?? "closed";
            if (isPast) status = "closed";

            const isSelected = selectedDate === dateStr;
            const isSelectable = !isPast && status !== "full" && status !== "closed";

            const baseClasses =
              "h-11 rounded-lg flex flex-col items-center justify-center text-sm font-medium transition-all border-2";
            const statusClasses = STATUS_CLASSES[status] ?? STATUS_CLASSES.closed;
            const selectedClasses = isSelected
              ? " border-brand ring-2 ring-brand/30"
              : " border-transparent";

            return (
              <button
                key={dateStr}
                onClick={() => isSelectable && onSelect(dateStr)}
                disabled={!isSelectable}
                className={`${baseClasses} ${statusClasses}${selectedClasses}`}
                aria-label={`${MONTH_NAMES[month - 1]} ${day}, ${status.replace("-", " ")}`}
              >
                <span className="leading-none">{day}</span>
                {avail && !isPast && (
                  <span className="text-[10px] leading-none mt-0.5 opacity-70">
                    {status === "full"
                      ? "Full"
                      : status === "closed"
                      ? "—"
                      : `${avail.remaining} left`}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3 text-xs text-ink-muted">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-green-100 border border-green-200" />
          Available
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-200" />
          Few left
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-100 border border-red-200" />
          Full
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-gray-100 border border-gray-200" />
          Closed
        </span>
      </div>
    </div>
  );
}
