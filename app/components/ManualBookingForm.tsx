"use client";

import { useState, useEffect, useMemo } from "react";
import { calculateTierPrice } from "@/lib/pricing";
import { type Package, type PackageTier } from "@/lib/types";

/* ── Types ── */

interface ManualBookingFormProps {
  onSuccess: (code: string) => void;
}

type Step = "package" | "details" | "done";

/* ── Component ── */

export default function ManualBookingForm({ onSuccess }: ManualBookingFormProps) {
  const [step, setStep] = useState<Step>("package");
  const [packages, setPackages] = useState<Package[]>([]);
  const [loadingPkgs, setLoadingPkgs] = useState(true);

  // Selection state
  const [selectedPkg, setSelectedPkg] = useState<Package | null>(null);
  const [tourDate, setTourDate] = useState("");
  const [pax, setPax] = useState(1);

  // Guest details
  const [guestName, setGuestName] = useState("");
  const [guestMobile, setGuestMobile] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPickup, setGuestPickup] = useState("");
  const [guestNotes, setGuestNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/packages");
        if (res.ok) {
          const data = await res.json();
          setPackages(data.packages.filter((p: Package) => p.active));
        }
      } finally {
        setLoadingPkgs(false);
      }
    }
    load();
  }, []);

  // Price calculation
  const pricing = useMemo(() => {
    if (!selectedPkg) return null;
    return calculateTierPrice(selectedPkg.tiers, pax);
  }, [selectedPkg, pax]);

  const totalAmount = pricing?.total ?? 0;
  const downpaymentAmount = selectedPkg
    ? Math.round(totalAmount * (selectedPkg.downpayment_pct / 100))
    : 0;

  // Available dates (from today, only matching days of week)
  const today = new Date().toISOString().split("T")[0];

  function isDateAvailable(dateStr: string): boolean {
    if (!selectedPkg) return false;
    const date = new Date(dateStr + "T00:00:00");
    const dow = date.getDay(); // 0=Sun..6=Sat
    return selectedPkg.days_of_week.includes(dow);
  }

  async function handleSubmit() {
    if (!selectedPkg || !tourDate || !guestName.trim() || !guestMobile.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/bookings/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          package_id: selectedPkg.id,
          tour_date: tourDate,
          pax,
          guest_name: guestName.trim(),
          guest_mobile: guestMobile.trim(),
          guest_email: guestEmail.trim() || null,
          guest_pickup_area: guestPickup.trim() || "Walk-in",
          guest_notes: guestNotes.trim() || null,
          payment_method: paymentMethod,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create booking");
      }

      onSuccess(data.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingPkgs) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-touch bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (packages.length === 0) {
    return (
      <div className="text-center py-12 text-ink-muted">
        <p className="text-lg mb-2">No active packages</p>
        <p className="text-sm">Create a package first before adding manual bookings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Step: Package + Date + Pax */}
      <div className="space-y-3">
        {/* Package select */}
        <div>
          <label className="block text-sm font-medium text-ink mb-1">
            Package <span className="text-red-500">*</span>
          </label>
          <select
            value={selectedPkg?.id ?? ""}
            onChange={(e) => {
              const pkg = packages.find((p) => p.id === e.target.value);
              setSelectedPkg(pkg ?? null);
              setTourDate("");
              setPax(1);
            }}
            className="w-full min-h-[48px] px-3 rounded-touch border-2 border-gray-200 bg-white text-ink text-base
              focus:border-brand focus:outline-none transition-colors"
          >
            <option value="">Select a package...</option>
            {packages.map((pkg) => (
              <option key={pkg.id} value={pkg.id}>
                {pkg.name}
              </option>
            ))}
          </select>
        </div>

        {/* Date + Pax row */}
        {selectedPkg && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                Tour Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                min={today}
                value={tourDate}
                onChange={(e) => setTourDate(e.target.value)}
                className={`w-full min-h-[48px] px-3 rounded-touch border-2 bg-white text-ink text-base
                  focus:outline-none transition-colors
                  ${tourDate && !isDateAvailable(tourDate) ? "border-red-400" : "border-gray-200 focus:border-brand"}`}
              />
              {tourDate && !isDateAvailable(tourDate) && (
                <p className="mt-1 text-xs text-red-500">
                  Not available on this day
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                Pax <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                max={selectedPkg.capacity_per_day}
                value={pax}
                onChange={(e) => setPax(parseInt(e.target.value) || 1)}
                className="w-full min-h-[48px] px-3 rounded-touch border-2 border-gray-200 bg-white text-ink text-base
                  focus:border-brand focus:outline-none transition-colors"
              />
            </div>
          </div>
        )}

        {/* Price summary */}
        {selectedPkg && pricing && tourDate && isDateAvailable(tourDate) && (
          <div className="p-3 rounded-touch bg-brand/5 border border-brand/20 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-ink-muted">
                {pax} pax × ₱{pricing.pricePerPax.toLocaleString("en-PH")}
              </span>
              <span className="font-semibold">
                ₱{totalAmount.toLocaleString("en-PH")}
              </span>
            </div>
            {downpaymentAmount > 0 && (
              <div className="flex justify-between text-xs text-ink-muted">
                <span>Downpayment ({selectedPkg.downpayment_pct}%)</span>
                <span>₱{downpaymentAmount.toLocaleString("en-PH")}</span>
              </div>
            )}
          </div>
        )}

        {selectedPkg && tourDate && !isDateAvailable(tourDate) && (
          <p className="text-xs text-red-500">
            This package is not available on {new Date(tourDate + "T00:00:00").toLocaleDateString("en-PH", { weekday: "long" })}
          </p>
        )}
      </div>

      {/* Guest details */}
      {selectedPkg && (
        <div className="space-y-3 pt-2 border-t border-gray-200">
          <h3 className="font-heading font-semibold text-sm">Guest Details</h3>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Juan Dela Cruz"
              className="w-full min-h-[48px] px-3 rounded-touch border-2 border-gray-200 bg-white text-ink text-base
                focus:border-brand focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">
              Mobile <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              inputMode="tel"
              value={guestMobile}
              onChange={(e) => setGuestMobile(e.target.value)}
              placeholder="09171234567"
              className="w-full min-h-[48px] px-3 rounded-touch border-2 border-gray-200 bg-white text-ink text-base
                focus:border-brand focus:outline-none transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                Email <span className="text-ink-muted">(optional)</span>
              </label>
              <input
                type="email"
                inputMode="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="juan@email.com"
                className="w-full min-h-[48px] px-3 rounded-touch border-2 border-gray-200 bg-white text-ink text-base
                  focus:border-brand focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                Pickup Area
              </label>
              <input
                type="text"
                value={guestPickup}
                onChange={(e) => setGuestPickup(e.target.value)}
                placeholder="e.g. Airport"
                className="w-full min-h-[48px] px-3 rounded-touch border-2 border-gray-200 bg-white text-ink text-base
                  focus:border-brand focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">
              Payment Method
            </label>
            <div className="flex gap-2">
              {[
                { value: "cash", label: "Cash" },
                { value: "gcash", label: "GCash" },
                { value: "bank_transfer", label: "Bank Transfer" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPaymentMethod(opt.value)}
                  className={`flex-1 min-h-[44px] rounded-touch text-sm font-medium transition-colors
                    ${
                      paymentMethod === opt.value
                        ? "bg-brand text-white"
                        : "bg-gray-100 text-ink-muted hover:bg-gray-200"
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">
              Notes <span className="text-ink-muted">(optional)</span>
            </label>
            <textarea
              value={guestNotes}
              onChange={(e) => setGuestNotes(e.target.value)}
              placeholder="Special requests..."
              rows={2}
              className="w-full px-3 py-2 rounded-touch border-2 border-gray-200 bg-white text-ink text-base
                focus:border-brand focus:outline-none transition-colors resize-none"
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 rounded-touch bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Submit */}
      <div className="pt-2 pb-4">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={
            submitting ||
            !selectedPkg ||
            !tourDate ||
            !isDateAvailable(tourDate) ||
            !guestName.trim() ||
            !guestMobile.trim()
          }
          className="w-full btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? "Creating booking..." : "Create manual booking"}
        </button>
      </div>
    </div>
  );
}
