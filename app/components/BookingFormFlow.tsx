"use client";

import { useState, useCallback } from "react";
import BookingPicker from "./BookingPicker";
import GuestDetailsForm from "./GuestDetailsForm";
import PaymentChoice from "./PaymentChoice";
import BookingConfirmation from "./BookingConfirmation";
import SuccessScreen from "./SuccessScreen";
import ProgressBar from "./ProgressBar";
import type { GuestDetails } from "./GuestDetailsForm";
import type { PaymentData } from "./PaymentChoice";
import type { PackageTier } from "@/lib/types";

/* ── Types ── */

interface BookingFormFlowProps {
  pkgId: string;
  pkgSlug: string;
  pkgName: string;
  tiers: PackageTier[];
  downpaymentPct: number;
  operatorGcashQrUrl: string | null;
  operatorGcashNumber: string | null;
}

type FlowStep = "picker" | "details" | "payment" | "confirm" | "success";

const STEP_LABELS = ["Details", "Payment", "Confirm"];

/* ── Component ── */

export default function BookingFormFlow({
  pkgId,
  pkgSlug,
  pkgName,
  tiers,
  downpaymentPct,
  operatorGcashQrUrl,
  operatorGcashNumber,
}: BookingFormFlowProps) {
  const [step, setStep] = useState<FlowStep>("picker");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [pax, setPax] = useState(1);
  const [guestDetails, setGuestDetails] = useState<GuestDetails | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);

  // Pricing (re-derive from tier)
  const pricing = tiers.find((t) => pax >= t.min_pax && pax <= t.max_pax);
  const totalAmount = pricing ? pricing.price_per_pax * pax : 0;
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
    setStep("payment");
  }, []);

  const handlePaymentSubmit = useCallback((data: PaymentData) => {
    setPaymentData(data);
    setStep("confirm");
  }, []);

  const handleSubmitBooking = useCallback(async () => {
    if (!selectedDate || !guestDetails || !paymentData) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      // 1. Create booking
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

      const code: string = createData.code;

      // 2. Submit payment details (transitions to PENDING_CONFIRMATION)
      const paymentRes = await fetch(`/api/bookings/${code}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: paymentData.method,
          gcash_ref: paymentData.gcash_ref || null,
          screenshot_url: paymentData.screenshot_url || null,
        }),
      });

      if (!paymentRes.ok) {
        const paymentErr = await paymentRes.json();
        // ponytail: booking was created but payment transition failed;
        // still show the code so the guest can return later
        console.error("Payment submission error:", paymentErr);
      }

      setBookingCode(code);
      setStep("success");
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }, [selectedDate, guestDetails, paymentData, pkgId, pax]);

  // Progress bar index (0=details, 1=payment, 2=confirm)
  const progressIndex =
    step === "details" ? 0 : step === "payment" ? 1 : step === "confirm" ? 2 : -1;

  return (
    <>
      {/* Progress bar — visible during form steps */}
      {progressIndex >= 0 && (
        <ProgressBar
          currentStep={progressIndex}
          totalSteps={3}
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

      {step === "payment" && (
        <PaymentChoice
          totalAmount={totalAmount}
          gcashQrUrl={operatorGcashQrUrl}
          gcashNumber={operatorGcashNumber}
          onSubmit={handlePaymentSubmit}
          onBack={() => setStep("details")}
        />
      )}

      {step === "confirm" && selectedDate && guestDetails && paymentData && (
        <BookingConfirmation
          packageName={pkgName}
          tourDate={selectedDate}
          pax={pax}
          pricePerPax={pricePerPax}
          totalAmount={totalAmount}
          downpaymentPct={downpaymentPct}
          guestDetails={guestDetails}
          paymentData={paymentData}
          onBack={() => setStep("payment")}
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
