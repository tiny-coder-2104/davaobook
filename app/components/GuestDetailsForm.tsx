"use client";

import { useState } from "react";

/* ── Types ── */

export interface GuestDetails {
  name: string;
  mobile: string;
  email: string;
  pickup_area: string;
  notes: string;
}

interface GuestDetailsFormProps {
  initial?: Partial<GuestDetails>;
  onSubmit: (details: GuestDetails) => void;
  onBack: () => void;
}

/* ── Validation ── */

interface FieldError {
  [key: string]: string;
}

function validate(fields: GuestDetails): FieldError {
  const errors: FieldError = {};
  if (!fields.name.trim()) errors.name = "Full name is required";
  if (!fields.mobile.trim()) {
    errors.mobile = "Mobile number is required";
  } else if (!/^[0-9+\s()-]{7,15}$/.test(fields.mobile.trim())) {
    errors.mobile = "Enter a valid mobile number";
  }
  if (fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    errors.email = "Enter a valid email";
  }
  return errors;
}

/* ── Component ── */

const FIELDS: { key: keyof GuestDetails; label: string; type: string; inputMode?: string; required: boolean }[] = [
  { key: "name", label: "Full Name", type: "text", required: true },
  { key: "mobile", label: "Mobile Number", type: "tel", inputMode: "tel", required: true },
  { key: "email", label: "Email", type: "email", inputMode: "email", required: false },
  { key: "pickup_area", label: "Pickup Area", type: "text", required: false },
];

export default function GuestDetailsForm({
  initial,
  onSubmit,
  onBack,
}: GuestDetailsFormProps) {
  const [fields, setFields] = useState<GuestDetails>({
    name: initial?.name ?? "",
    mobile: initial?.mobile ?? "",
    email: initial?.email ?? "",
    pickup_area: initial?.pickup_area ?? "",
    notes: initial?.notes ?? "",
  });
  const [errors, setErrors] = useState<FieldError>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());

  const updateField = (key: keyof GuestDetails, value: string) => {
    const next = { ...fields, [key]: value };
    setFields(next);
    // Re-validate live if already touched
    if (touched.has(key)) {
      const errs = validate(next);
      setErrors((prev) => {
        const next2 = { ...prev };
        if (errs[key]) next2[key] = errs[key];
        else delete next2[key];
        return next2;
      });
    }
  };

  const handleBlur = (key: string) => {
    setTouched((prev) => new Set(prev).add(key));
    const errs = validate(fields);
    setErrors((prev) => {
      const next = { ...prev };
      if (errs[key]) next[key] = errs[key];
      else delete next[key];
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate(fields);
    setErrors(errs);
    setTouched(new Set(FIELDS.map((f) => f.key)));
    if (Object.keys(errs).length === 0) {
      onSubmit(fields);
    }
  };

  // Count completed required fields
  const completedCount = FIELDS.filter((f) => f.required && fields[f.key].trim()).length;
  const allRequiredFilled = FIELDS.filter((f) => f.required).every((f) => fields[f.key].trim());

  return (
    <form onSubmit={handleSubmit} className="px-4 pt-4 pb-40 space-y-4">
      {/* Field completion indicator */}
      <p className="text-xs text-ink-muted text-center">
        {completedCount}/{FIELDS.filter((f) => f.required).length} required fields filled
      </p>

      {FIELDS.map((field) => (
        <div key={field.key}>
          <label
            htmlFor={field.key}
            className="block text-sm font-medium text-ink mb-1"
          >
            {field.label}
            {field.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <input
            id={field.key}
            type={field.type}
            inputMode={field.inputMode as React.HTMLAttributes<HTMLInputElement>["inputMode"]}
            value={fields[field.key]}
            onChange={(e) => updateField(field.key, e.target.value)}
            onBlur={() => handleBlur(field.key)}
            placeholder={field.label}
            className={`w-full min-h-[48px] px-3 rounded-touch border-2 bg-white text-ink text-base
              transition-colors focus:outline-none
              ${
                errors[field.key] && touched.has(field.key)
                  ? "border-red-400 focus:border-red-500"
                  : touched.has(field.key) && fields[field.key].trim()
                    ? "border-status-confirmed/50 focus:border-status-confirmed"
                    : "border-gray-200 focus:border-brand"
              }`}
          />
          {/* Inline error */}
          {errors[field.key] && touched.has(field.key) && (
            <p className="mt-1 text-xs text-red-500" role="alert">
              {errors[field.key]}
            </p>
          )}
          {/* Green check for touched + filled required fields */}
          {field.required &&
            touched.has(field.key) &&
            fields[field.key].trim() &&
            !errors[field.key] && (
              <p className="mt-1 text-xs text-status-confirmed flex items-center gap-1">
                <svg
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12l5 5L19 7" />
                </svg>
                Looks good
              </p>
            )}
        </div>
      ))}

      {/* Notes textarea */}
      <div>
        <label
          htmlFor="notes"
          className="block text-sm font-medium text-ink mb-1"
        >
          Notes
        </label>
        <textarea
          id="notes"
          value={fields.notes}
          onChange={(e) => updateField("notes", e.target.value)}
          onBlur={() => handleBlur("notes")}
          placeholder="Any special requests..."
          rows={3}
          className="w-full px-3 py-2 rounded-touch border-2 border-gray-200 bg-white text-ink text-base
            focus:border-brand focus:outline-none transition-colors resize-none"
        />
      </div>

      {/* Navigation */}
      <div className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-200 px-4 py-3"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 12px)" }}>
        <div className="flex gap-3 max-w-md mx-auto">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[56px] px-4 rounded-touch border-2 border-gray-200 text-ink font-semibold
              hover:bg-gray-50 active:scale-[0.98] transition-all"
          >
            Back
          </button>
          <button
            type="submit"
            className="flex-1 btn-primary"
          >
            Continue
          </button>
        </div>
      </div>
    </form>
  );
}
