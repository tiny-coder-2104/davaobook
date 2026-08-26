"use client";

interface PaxStepperProps {
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
}

export default function PaxStepper({
  value,
  min = 1,
  max,
  onChange,
}: PaxStepperProps) {
  const decrement = () => {
    if (value > min) onChange(value - 1);
  };

  const increment = () => {
    if (value < max) onChange(value + 1);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow empty during typing
    if (raw === "") {
      onChange(min);
      return;
    }
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed >= min && parsed <= max) {
      onChange(parsed);
    }
  };

  return (
    <div className="flex items-center justify-center gap-4">
      <button
        onClick={decrement}
        disabled={value <= min}
        className="min-w-[48px] min-h-[48px] rounded-touch bg-gray-100 text-2xl font-bold flex items-center justify-center
                   hover:bg-gray-200 active:scale-95 transition-all
                   disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Decrease pax"
      >
        −
      </button>

      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={handleInputChange}
        className="w-20 min-h-[48px] text-center text-2xl font-heading font-bold
                   border-2 border-gray-200 rounded-touch bg-white
                   focus:border-brand focus:outline-none
                   [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        aria-label="Number of guests"
      />

      <button
        onClick={increment}
        disabled={value >= max}
        className="min-w-[48px] min-h-[48px] rounded-touch bg-gray-100 text-2xl font-bold flex items-center justify-center
                   hover:bg-gray-200 active:scale-95 transition-all
                   disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Increase pax"
      >
        +
      </button>

      <span className="text-sm text-ink-muted ml-1">
        / {max} max
      </span>
    </div>
  );
}
