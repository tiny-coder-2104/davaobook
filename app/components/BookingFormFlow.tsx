"use client";

import { useState, useCallback } from "react";
import BookingPicker from "./BookingPicker";
import GuestDetailsForm from "./GuestDetailsForm";
import BookingConfirmation from "./BookingConfirmation";
import SuccessScreen from "./SuccessScreen";
import ProgressBar from "./ProgressBar";
import type { GuestDetails } from "./GuestDetailsForm";
import type { PackageTier } from "@/lib/types";

/* ── Types ── */

interface BookingFormFlowProps {
  pkgId: string;
  pkgSlug: string;
  pkgName: string;
  tiers: PackageTier[];
}

type FlowStep = "picker" | "details" | "confirm" | "success";

const STEP_LABELS = ["Details", "Confirm"];

/* ── Component ── */

export default function BookingFormFlow({
  pkgId,
  pkgSlug,
  pkgName,
  tiers,
}: BookingFormFlowProps) {
  const [step, setStep] = useState<FlowStep>("picker");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [pax, setPax] = useState(1);
  const [guestDetails, setGuestDetails] = useState<GuestDetails | null>(null);

  // Pricing (re-derive from tier)
  const pricing = tiers.find((t) => pax >= t.min_pax && pax <= t.max_pax);
  const totalAmount = pricing ? pricing.price_per_pax : 0; // flat per-night rate
  const pricePerPax = pricing?.price_per_pax ?? 0;

  // Booking result
  const [bookingCode, setBookingCode] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handlePickerContinue = useCallback((date: string, paxCount: number) => {
    setSelectedDate(date);
    setPax(paxCount);
    setStep("details");
  }, []);

  const handleDetailsSubmit = useCallback((details: GuestDetails) => {
    setGuestDetails(details);
    setStep("confirm");
  }, []);

  const handleSubmitBooking = useCallback(async () => {
    if (!selectedDate || !guestDetails) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      // Create booking — lands in PENDING_CONFIRMATION; owner confirms
      // and handles payment offline.
      const createRes = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          package_id: pkgId,
          tour_date: selectedDate,
          pax,
          guest_name: guestDetails.name,
          guest_mobile: guestDetails.mobile,
          guest_email: guestDetails.email || null,
          guest_pickup_area: guestDetails.pickup_area,
          guest_notes: guestDetails.notes || null,
        }),
      });

      const createData = await createRes.json();

      if (!createRes.ok) {
        throw new Error(createData.error || "Failed to create booking");
      }

      setBookingCode(createData.code);
      setStep("success");
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }, [selectedDate, guestDetails, pkgId, pax]);

  // Progress bar index (0=details, 1=confirm)
  const progressIndex = step === "details" ? 0 : step === "confirm" ? 1 : -1;

  return (
    <>
      {/* Progress bar — visible during form steps */}
      {progressIndex >= 0 && (
        <ProgressBar
          currentStep={progressIndex}
          totalSteps={2}
          labels={STEP_LABELS}
        />
      )}

      {/* Step rendering */}
      {step === "picker" && (
        <BookingPicker
          pkgSlug={pkgSlug}
          tiers={tiers}
          onContinue={handlePickerContinue}
        />
      )}

      {step === "details" && (
        <GuestDetailsForm
          initial={guestDetails ?? undefined}
          onSubmit={handleDetailsSubmit}
          onBack={() => setStep("picker")}
        />
      )}

      {step === "confirm" && selectedDate && guestDetails && (
        <BookingConfirmation
          packageName={pkgName}
          tourDate={selectedDate}
          pax={pax}
          pricePerPax={pricePerPax}
          totalAmount={totalAmount}
          guestDetails={guestDetails}
          onBack={() => setStep("details")}
          onSubmit={handleSubmitBooking}
          submitting={submitting}
          error={submitError}
        />
      )}

      {step === "success" && bookingCode && selectedDate && (
        <SuccessScreen
          bookingCode={bookingCode}
          tourDate={selectedDate}
          packageName={pkgName}
          totalAmount={totalAmount}
        />
      )}
    </>
  );
}