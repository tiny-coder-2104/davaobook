import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    fontFamily: {
      heading: ["var(--font-manrope)", "sans-serif"],
      body: ["var(--font-inter)", "sans-serif"],
    },
    extend: {
      // Type scale via clamp off 360px viewport
      fontSize: {
        xs: "clamp(0.75rem, 0.65rem + 0.5vw, 0.875rem)",       // 12→14
        sm: "clamp(0.8125rem, 0.7rem + 0.55vw, 1rem)",          // 13→16
        base: "clamp(0.875rem, 0.75rem + 0.625vw, 1.125rem)",   // 14→18
        lg: "clamp(1rem, 0.85rem + 0.75vw, 1.25rem)",           // 16→20
        xl: "clamp(1.25rem, 1.05rem + 1vw, 1.5rem)",            // 20→24
        "2xl": "clamp(1.5rem, 1.2rem + 1.5vw, 1.875rem)",       // 24→30
      },
      colors: {
        surface: "#ffffff",
        ink: "#111827",
        "ink-muted": "#6b7280",
        brand: {
          DEFAULT: "#2563eb",
          hover: "#1d4ed8",
        },
        status: {
          pending: "#f59e0b",
          confirmed: "#22c55e",
          cancelled: "#ef4444",
          expired: "#9ca3af",
        },
      },
      spacing: {
        // 8px grid: these are multiples, base Tailwind already has 1=4px
        // Custom increments for the grid
        "48": "3rem",   // 48px touch target
        "56": "3.5rem", // 56px CTA
      },
      borderRadius: {
        touch: "0.5rem", // 8px for touch-friendly elements
      },
      minHeight: {
        touch: "48px",
        cta: "56px",
      },
      minWidth: {
        touch: "48px",
      },
    },
  },
  plugins: [],
};

export default config;
