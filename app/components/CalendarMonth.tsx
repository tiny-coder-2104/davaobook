"use client";

/**
 * Admin calendar month grid — shows per-day fill count badges.
 * 44px cells, color-coded: green (available), yellow (few-left), red (full), gray (blocked).
 * Tap opens day sheet.
 */

export interface DayCellData {
  bookingCount: number;
  capacity: number;
  isBlocked: boolean;
  hasBlockForPackage: boolean;
}

interface CalendarMonthProps {
  year: number;
  month: number; // 1-indexed
  days: Record<string, DayCellData>;
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

function getDayColor(day: DayCellData): string {
  if (day.isBlocked) {
    return "bg-gray-100 text-gray-400";
  }
  if (day.bookingCount >= day.capacity) {
    return "bg-red-100 text-red-600";
  }
  if (day.bookingCount >= day.capacity * 0.8) {
    return "bg-yellow-100 text-yellow-700";
  }
  return "bg-green-50 text-green-700";
}

export default function CalendarMonth({
  year,
  month,
  days,
  selectedDate,
  onSelect,
  onPrevMonth,
  onNextMonth,
  loading,
}: CalendarMonthProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

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

      {/* Day grid */}
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
            const isToday = cellDate.getTime() === today.getTime();

            const dayData = days[dateStr];
            const isBlocked = dayData?.isBlocked ?? false;
            const count = dayData?.bookingCount ?? 0;
            const capacity = dayData?.capacity ?? 0;

            const isSelected = selectedDate === dateStr;

            // Color classes
            let colorClasses = "bg-gray-50 text-gray-300"; // default (no data / past)
            if (!isPast && dayData) {
              if (isBlocked) {
                colorClasses = "bg-gray-100 text-gray-400";
              } else if (count >= capacity) {
                colorClasses = "bg-red-100 text-red-600";
              } else if (capacity > 0 && count >= capacity * 0.8) {
                colorClasses = "bg-yellow-100 text-yellow-700";
              } else {
                colorClasses = "bg-green-50 text-green-700";
              }
            }

            return (
              <button
                key={dateStr}
                onClick={() => !isPast && onSelect(dateStr)}
                disabled={isPast}
                className={`
                  h-11 rounded-lg flex flex-col items-center justify-center text-sm font-medium
                  transition-all border-2 cursor-pointer
                  ${colorClasses}
                  ${isSelected ? "border-brand ring-2 ring-brand/30" : "border-transparent"}
                  ${isToday ? "ring-1 ring-brand/20" : ""}
                  ${isPast ? "opacity-40 cursor-not-allowed" : ""}
                `}
                aria-label={`${MONTH_NAMES[month - 1]} ${day}, ${count} bookings, ${capacity} capacity`}
              >
                <span className="leading-none">{day}</span>
                {!isPast && dayData && (
                  <span className="text-[10px] leading-none mt-0.5 opacity-80">
                    {isBlocked
                      ? "🚫"
                      : `${count}/${capacity}`}
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
          <span className="w-3 h-3 rounded bg-green-50 border border-green-200" />
          Available
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-200" />
          Filling up
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-100 border border-red-200" />
          Full
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-gray-100 border border-gray-200" />
          Blocked
        </span>
      </div>
    </div>
  );
}
