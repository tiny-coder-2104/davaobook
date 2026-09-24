"use client";

interface LiveTotalProps {
  pricePerPax: number;
  pax: number;
  total: number;
}

export default function LiveTotal({ pricePerPax, pax, total }: LiveTotalProps) {
  return (
    <div className="w-full bg-white border-t border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between max-w-3xl mx-auto">
        <div className="text-sm text-ink-muted">
          <span className="font-medium text-ink">
            ₱{pricePerPax.toLocaleString("en-PH")}
          </span>
          <span> / night</span>
        </div>

        {/* ponytail: transition-all + scale for the pop animation; no external lib needed */}
        <div
          key={total}
          className="font-heading font-bold text-xl text-brand
                     animate-[pop_0.2s_ease-out]"
          style={{
            animationName: "pop",
            animationDuration: "0.2s",
            animationTimingFunction: "ease-out",
          }}
        >
          ₱{total.toLocaleString("en-PH")}
        </div>
      </div>
    </div>
  );
}
