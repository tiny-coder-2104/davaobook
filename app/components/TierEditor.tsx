"use client";

import type { PackageTier } from "@/lib/types";

/* ── Types ── */

interface TierEditorProps {
  tiers: PackageTier[];
  onChange: (tiers: PackageTier[]) => void;
}

/* ── Component ── */

export default function TierEditor({ tiers, onChange }: TierEditorProps) {
  function addTier() {
    const lastMax = tiers.length > 0 ? tiers[tiers.length - 1].max_pax : 0;
    onChange([
      ...tiers,
      { min_pax: lastMax + 1, max_pax: lastMax + 5, price_per_pax: 0 },
    ]);
  }

  function removeTier(index: number) {
    onChange(tiers.filter((_, i) => i !== index));
  }

  function updateTier(index: number, field: keyof PackageTier, value: number) {
    const next = tiers.map((t, i) =>
      i === index ? { ...t, [field]: value } : t
    );
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="grid grid-cols-[1fr_1fr_1.2fr_auto] gap-2 text-xs font-medium text-ink-muted px-1">
        <span>Min Pax</span>
        <span>Max Pax</span>
        <span>Price/Pax (₱)</span>
        <span className="w-8" />
      </div>

      {tiers.map((tier, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_1.2fr_auto] gap-2 items-center">
          <input
            type="number"
            min={1}
            value={tier.min_pax}
            onChange={(e) => updateTier(i, "min_pax", parseInt(e.target.value) || 1)}
            className="min-h-[48px] px-2 rounded-touch border border-gray-300 text-sm
              focus:outline-none focus:ring-1 focus:ring-brand text-center"
          />
          <input
            type="number"
            min={1}
            value={tier.max_pax}
            onChange={(e) => updateTier(i, "max_pax", parseInt(e.target.value) || 1)}
            className="min-h-[48px] px-2 rounded-touch border border-gray-300 text-sm
              focus:outline-none focus:ring-1 focus:ring-brand text-center"
          />
          <input
            type="number"
            min={0}
            value={tier.price_per_pax}
            onChange={(e) => updateTier(i, "price_per_pax", parseInt(e.target.value) || 0)}
            className="min-h-[48px] px-2 rounded-touch border border-gray-300 text-sm
              focus:outline-none focus:ring-1 focus:ring-brand text-center"
          />
          <button
            type="button"
            onClick={() => removeTier(i)}
            disabled={tiers.length <= 1}
            className="w-8 h-8 rounded-touch flex items-center justify-center text-red-400
              hover:bg-red-50 disabled:opacity-30 transition-colors"
            aria-label="Remove tier"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addTier}
        className="w-full min-h-[44px] rounded-touch border-2 border-dashed border-gray-300
          text-sm font-medium text-ink-muted hover:border-brand hover:text-brand
          active:scale-[0.98] transition-all"
      >
        + Add tier
      </button>
    </div>
  );
}
