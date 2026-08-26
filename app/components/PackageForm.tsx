"use client";

import { useState, useCallback } from "react";
import PhotoUpload from "./PhotoUpload";
import TierEditor from "./TierEditor";
import DaysOfWeekToggle from "./DaysOfWeekToggle";
import type { PackageTier } from "@/lib/types";

/* ── Types ── */

export interface PackageFormData {
  name: string;
  description: string;
  photo_url: string | null;
  tiers: PackageTier[];
  days_of_week: number[];
  capacity_per_day: number;
  downpayment_pct: number;
  cutoff_hours: number;
  dp_refundable: boolean;
}

interface PackageFormProps {
  /** Pre-filled data for edit mode */
  initial?: Partial<PackageFormData>;
  /** Called on submit with validated data */
  onSubmit: (data: PackageFormData) => Promise<void>;
  /** Button label */
  submitLabel?: string;
  /** Loading state */
  loading?: boolean;
}

/* ── Defaults ── */

const DEFAULT_DATA: PackageFormData = {
  name: "",
  description: "",
  photo_url: null,
  tiers: [{ min_pax: 1, max_pax: 10, price_per_pax: 0 }],
  days_of_week: [0, 1, 2, 3, 4, 5, 6],
  capacity_per_day: 20,
  downpayment_pct: 0,
  cutoff_hours: 24,
  dp_refundable: false,
};

/* ── Accordion Section ── */

function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="rounded-touch border border-gray-200 bg-white"
    >
      <summary className="px-4 py-3 cursor-pointer font-heading font-semibold text-sm
        flex items-center justify-between select-none
        hover:bg-gray-50 transition-colors">
        <span>{title}</span>
        <svg className="w-4 h-4 text-ink-muted transition-transform open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="px-4 pb-4 border-t border-gray-100 pt-3">
        {children}
      </div>
    </details>
  );
}

/* ── Component ── */

export default function PackageForm({
  initial,
  onSubmit,
  submitLabel = "Save package",
  loading = false,
}: PackageFormProps) {
  const [data, setData] = useState<PackageFormData>({
    ...DEFAULT_DATA,
    ...initial,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const update = useCallback(
    <K extends keyof PackageFormData>(key: K, value: PackageFormData[K]) => {
      setData((prev) => ({ ...prev, [key]: value }));
      // Clear error on edit
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    []
  );

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!data.name.trim()) errs.name = "Name is required";
    if (data.tiers.length === 0) errs.tiers = "Add at least one pricing tier";
    if (data.tiers.some((t) => t.price_per_pax <= 0))
      errs.tiers = "All tiers must have a price";
    if (data.days_of_week.length === 0) errs.days_of_week = "Select at least one day";
    if (data.capacity_per_day < 1) errs.capacity_per_day = "Capacity must be at least 1";
    if (data.downpayment_pct < 0 || data.downpayment_pct > 100)
      errs.downpayment_pct = "Must be 0-100";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await onSubmit(data);
    } finally {
      setSubmitting(false);
    }
  }

  const busy = submitting || loading;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Details — always open */}
      <Section title="Details" defaultOpen>
        <div className="space-y-3">
          {/* Name */}
          <div>
            <label htmlFor="pkg-name" className="block text-sm font-medium text-ink mb-1">
              Package Name <span className="text-red-500">*</span>
            </label>
            <input
              id="pkg-name"
              type="text"
              value={data.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. Island Hopping Tour"
              className={`w-full min-h-[48px] px-3 rounded-touch border-2 bg-white text-ink text-base
                transition-colors focus:outline-none
                ${errors.name ? "border-red-400" : "border-gray-200 focus:border-brand"}`}
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="pkg-desc" className="block text-sm font-medium text-ink mb-1">
              Description
            </label>
            <textarea
              id="pkg-desc"
              value={data.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Describe the tour experience..."
              rows={3}
              className="w-full px-3 py-2 rounded-touch border-2 border-gray-200 bg-white text-ink text-base
                focus:border-brand focus:outline-none transition-colors resize-none"
            />
          </div>
        </div>
      </Section>

      {/* Photos */}
      <Section title="Photo">
        <PhotoUpload
          value={data.photo_url}
          onChange={(url) => update("photo_url", url)}
        />
      </Section>

      {/* Pricing Tiers */}
      <Section title="Pricing Tiers" defaultOpen>
        <TierEditor
          tiers={data.tiers}
          onChange={(tiers) => update("tiers", tiers)}
        />
        {errors.tiers && <p className="mt-1 text-xs text-red-500">{errors.tiers}</p>}
      </Section>

      {/* Days of Week */}
      <Section title="Available Days" defaultOpen>
        <DaysOfWeekToggle
          value={data.days_of_week}
          onChange={(days) => update("days_of_week", days)}
        />
        {errors.days_of_week && (
          <p className="mt-1 text-xs text-red-500">{errors.days_of_week}</p>
        )}
      </Section>

      {/* Capacity */}
      <Section title="Capacity">
        <div>
          <label htmlFor="pkg-capacity" className="block text-sm font-medium text-ink mb-1">
            Max guests per day
          </label>
          <input
            id="pkg-capacity"
            type="number"
            min={1}
            value={data.capacity_per_day}
            onChange={(e) => update("capacity_per_day", parseInt(e.target.value) || 1)}
            className="w-full min-h-[48px] px-3 rounded-touch border-2 border-gray-200 bg-white text-ink text-base
              focus:border-brand focus:outline-none transition-colors"
          />
          {errors.capacity_per_day && (
            <p className="mt-1 text-xs text-red-500">{errors.capacity_per_day}</p>
          )}
        </div>
      </Section>

      {/* Downpayment */}
      <Section title="Downpayment">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="pkg-dp-pct" className="block text-sm font-medium text-ink mb-1">
                DP % (0–100)
              </label>
              <input
                id="pkg-dp-pct"
                type="number"
                min={0}
                max={100}
                value={data.downpayment_pct}
                onChange={(e) => update("downpayment_pct", parseInt(e.target.value) || 0)}
                className="w-full min-h-[48px] px-3 rounded-touch border-2 border-gray-200 bg-white text-ink text-base
                  focus:border-brand focus:outline-none transition-colors"
              />
              {errors.downpayment_pct && (
                <p className="mt-1 text-xs text-red-500">{errors.downpayment_pct}</p>
              )}
            </div>
            <div>
              <label htmlFor="pkg-cutoff" className="block text-sm font-medium text-ink mb-1">
                Cutoff (hours before)
              </label>
              <input
                id="pkg-cutoff"
                type="number"
                min={0}
                value={data.cutoff_hours}
                onChange={(e) => update("cutoff_hours", parseInt(e.target.value) || 0)}
                className="w-full min-h-[48px] px-3 rounded-touch border-2 border-gray-200 bg-white text-ink text-base
                  focus:border-brand focus:outline-none transition-colors"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={data.dp_refundable}
              onChange={(e) => update("dp_refundable", e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-brand accent-brand"
            />
            <span className="text-sm text-ink">Downpayment is refundable</span>
          </label>
        </div>
      </Section>

      {/* Submit */}
      <div className="pt-2 pb-4">
        <button
          type="submit"
          disabled={busy}
          className="w-full btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
