"use client";

interface ProgressBarProps {
  /** Current step index (0-based) */
  currentStep: number;
  /** Total number of steps */
  totalSteps: number;
  /** Labels for each step */
  labels: string[];
}

/**
 * 1-2-3 progress indicator with green checkmarks for completed steps.
 * Uses SVG stroke-draw animation for checkmarks.
 */
export default function ProgressBar({
  currentStep,
  totalSteps,
  labels,
}: ProgressBarProps) {
  return (
    <nav className="px-4 py-3" aria-label="Booking progress">
      <ol className="flex items-center justify-between max-w-md mx-auto">
        {labels.map((label, i) => {
          const isCompleted = i < currentStep;
          const isCurrent = i === currentStep;

          return (
            <li key={label} className="flex flex-1 items-center">
              {/* Connector line */}
              {i > 0 && (
                <div
                  className={`h-0.5 flex-1 transition-colors duration-300 ${
                    isCompleted ? "bg-status-confirmed" : "bg-gray-200"
                  }`}
                />
              )}

              <div className="flex flex-col items-center gap-1">
                {/* Step circle */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                    isCompleted
                      ? "bg-status-confirmed text-white"
                      : isCurrent
                        ? "bg-brand text-white ring-4 ring-brand/20"
                        : "bg-gray-100 text-ink-muted"
                  }`}
                >
                  {isCompleted ? (
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path
                        d="M5 12l5 5L19 7"
                        className="check-path"
                        style={{
                          strokeDasharray: 24,
                          strokeDashoffset: 0,
                          animation:
                            "stroke-draw 0.3s ease-out forwards",
                        }}
                      />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>

                {/* Label — hide on very small screens */}
                <span
                  className={`text-[11px] font-medium hidden sm:block ${
                    isCurrent ? "text-brand" : isCompleted ? "text-status-confirmed" : "text-ink-muted"
                  }`}
                >
                  {label}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
