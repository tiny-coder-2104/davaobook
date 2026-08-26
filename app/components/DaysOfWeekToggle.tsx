"use client";

/* ── Types ── */

interface DaysOfWeekToggleProps {
  value: number[];
  onChange: (days: number[]) => void;
}

/* ── Constants ── */

const DAYS: { index: number; label: string; short: string }[] = [
  { index: 0, label: "Sunday", short: "Sun" },
  { index: 1, label: "Monday", short: "Mon" },
  { index: 2, label: "Tuesday", short: "Tue" },
  { index: 3, label: "Wednesday", short: "Wed" },
  { index: 4, label: "Thursday", short: "Thu" },
  { index: 5, label: "Friday", short: "Fri" },
  { index: 6, label: "Saturday", short: "Sat" },
];

/* ── Component ── */

export default function DaysOfWeekToggle({ value, onChange }: DaysOfWeekToggleProps) {
  function toggle(day: number) {
    if (value.includes(day)) {
      onChange(value.filter((d) => d !== day));
    } else {
      onChange([...value, day].sort());
    }
  }

  function selectAll() {
    onChange([0, 1, 2, 3, 4, 5, 6]);
  }

  function selectWeekdays() {
    onChange([1, 2, 3, 4, 5]);
  }

  const allSelected = value.length === 7;
  const weekdaysOnly = value.length === 5 && [1, 2, 3, 4, 5].every((d) => value.includes(d));

  return (
    <div className="space-y-2">
      {/* Quick select */}
      <div className="flex gap-2 mb-1">
        <button
          type="button"
          onClick={selectAll}
          className={`text-xs px-2 py-1 rounded-touch transition-colors ${
            allSelected
              ? "bg-brand text-white"
              : "bg-gray-100 text-ink-muted hover:bg-gray-200"
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={selectWeekdays}
          className={`text-xs px-2 py-1 rounded-touch transition-colors ${
            weekdaysOnly
              ? "bg-brand text-white"
              : "bg-gray-100 text-ink-muted hover:bg-gray-200"
          }`}
        >
          Weekdays
        </button>
      </div>

      {/* Day buttons */}
      <div className="grid grid-cols-7 gap-1">
        {DAYS.map((day) => {
          const selected = value.includes(day.index);
          return (
            <button
              key={day.index}
              type="button"
              onClick={() => toggle(day.index)}
              className={`min-h-[40px] rounded-touch text-xs font-medium transition-all
                ${
                  selected
                    ? "bg-brand text-white shadow-sm"
                    : "bg-gray-100 text-ink-muted hover:bg-gray-200"
                }`}
              aria-pressed={selected}
              aria-label={day.label}
            >
              {/* Show short label on mobile, full on larger */}
              <span className="sm:hidden">{day.short}</span>
              <span className="hidden sm:inline">{day.short}</span>
            </button>
          );
        })}
      </div>

      {value.length === 0 && (
        <p className="text-xs text-red-500">Select at least one day</p>
      )}
    </div>
  );
}
