"use client";

import { useState, useRef } from "react";
import { uploadScreenshot, type UploadResult } from "@/lib/upload";

/* ── Types ── */

export type PaymentMethod = "gcash" | "pay_on_site";

export interface PaymentData {
  method: PaymentMethod;
  gcash_ref: string;
  screenshot_url: string | null;
}

interface PaymentChoiceProps {
  /** Total amount to pay */
  totalAmount: number;
  /** Operator GCash QR image URL */
  gcashQrUrl: string | null;
  /** Operator GCash number for deep-link */
  gcashNumber: string | null;
  onSubmit: (data: PaymentData) => void;
  onBack: () => void;
}

/* ── Component ── */

export default function PaymentChoice({
  totalAmount,
  gcashQrUrl,
  gcashNumber,
  onSubmit,
  onBack,
}: PaymentChoiceProps) {
  const [method, setMethod] = useState<PaymentMethod>("gcash");
  const [gcashRef, setGcashRef] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleCopyAmount = async () => {
    try {
      await navigator.clipboard.writeText(totalAmount.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ponytail: clipboard API not available in all contexts; silent fail
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    setUploadProgress(0);

    try {
      const result: UploadResult = await uploadScreenshot(file, (pct) =>
        setUploadProgress(pct)
      );
      if (result.url) {
        setScreenshot(result.url);
      } else {
        setUploadError(result.error ?? "Upload failed");
      }
    } catch {
      setUploadError("Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = () => {
    if (method === "gcash" && !gcashRef.trim()) return;
    onSubmit({
      method,
      gcash_ref: gcashRef.trim(),
      screenshot_url: screenshot,
    });
  };

  const gcashReady = method !== "gcash" || gcashRef.trim().length > 0;

  return (
    <div className="px-4 pt-4 pb-40 space-y-5">
      <h2 className="font-heading font-bold text-lg text-center">
        How will you pay?
      </h2>

      {/* Option A: GCash */}
      <button
        type="button"
        onClick={() => setMethod("gcash")}
        className={`w-full text-left rounded-touch border-2 p-4 transition-all ${
          method === "gcash"
            ? "border-brand bg-brand/5 ring-1 ring-brand"
            : "border-gray-200 hover:border-gray-300"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
              method === "gcash" ? "border-brand" : "border-gray-300"
            }`}
          >
            {method === "gcash" && (
              <div className="w-2.5 h-2.5 rounded-full bg-brand" />
            )}
          </div>
          <div>
            <span className="font-heading font-semibold text-base">
              GCash now
            </span>
            <span className="text-xs text-ink-muted ml-2">(most common)</span>
          </div>
        </div>

        {method === "gcash" && (
          <div className="mt-4 space-y-4">
            {/* QR code */}
            {gcashQrUrl ? (
              <div className="flex justify-center">
                <img
                  src={gcashQrUrl}
                  alt="GCash QR code"
                  className="w-48 h-48 object-contain rounded-touch bg-white border border-gray-100"
                />
              </div>
            ) : (
              <div className="text-center text-sm text-ink-muted py-6">
                GCash QR not available
              </div>
            )}

            {/* Amount display + copy */}
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl font-heading font-bold text-brand">
                ₱{totalAmount.toLocaleString("en-PH")}
              </span>
              <button
                type="button"
                onClick={handleCopyAmount}
                className="min-h-[36px] min-w-[36px] px-2 rounded-touch bg-gray-100 text-xs font-medium
                  hover:bg-gray-200 active:scale-95 transition-all"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>

            {/* Deep-link */}
            {gcashNumber && (
              <div className="text-center">
                <a
                  href={`gcash://${gcashNumber}`}
                  className="text-sm text-brand underline"
                  onClick={(e) => {
                    // ponytail: gcash:// scheme may not open on all devices;
                    // that's fine, user can manually switch to GCash
                  }}
                >
                  Open GCash app
                </a>
              </div>
            )}

            {/* Ref# input */}
            <div>
              <label
                htmlFor="gcash_ref"
                className="block text-sm font-medium text-ink mb-1"
              >
                GCash Reference Number <span className="text-red-500">*</span>
              </label>
              <input
                id="gcash_ref"
                type="text"
                inputMode="numeric"
                value={gcashRef}
                onChange={(e) => setGcashRef(e.target.value)}
                placeholder="e.g. 1234567890123"
                className="w-full min-h-[48px] px-3 rounded-touch border-2 border-gray-200 bg-white text-ink text-base
                  focus:border-brand focus:outline-none transition-colors font-mono"
              />
            </div>

            {/* Screenshot upload */}
            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                Screenshot <span className="text-ink-muted">(optional)</span>
              </label>

              {screenshot ? (
                <div className="relative inline-block">
                  <img
                    src={screenshot}
                    alt="Uploaded screenshot"
                    className="w-24 h-24 object-cover rounded-touch border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={() => setScreenshot(null)}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white
                      flex items-center justify-center text-xs"
                    aria-label="Remove screenshot"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    aria-label="Upload screenshot"
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="min-h-[48px] px-4 rounded-touch border-2 border-dashed border-gray-300
                      text-sm text-ink-muted hover:border-brand hover:text-brand
                      active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {uploading
                      ? `Uploading... ${uploadProgress}%`
                      : "Choose screenshot"}
                  </button>
                  {uploadProgress > 0 && uploading && (
                    <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand rounded-full transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}
                  {uploadError && (
                    <p className="mt-1 text-xs text-red-500">{uploadError}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </button>

      {/* Option B: Pay on-site */}
      <button
        type="button"
        onClick={() => setMethod("pay_on_site")}
        className={`w-full text-left rounded-touch border-2 p-4 transition-all ${
          method === "pay_on_site"
            ? "border-brand bg-brand/5 ring-1 ring-brand"
            : "border-gray-200 hover:border-gray-300"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
              method === "pay_on_site" ? "border-brand" : "border-gray-300"
            }`}
          >
            {method === "pay_on_site" && (
              <div className="w-2.5 h-2.5 rounded-full bg-brand" />
            )}
          </div>
          <div>
            <span className="font-heading font-semibold text-base">
              Pay on-site
            </span>
            <p className="text-xs text-ink-muted mt-0.5">
              Pay when you arrive — no downpayment needed
            </p>
          </div>
        </div>
      </button>

      {/* Navigation */}
      <div
        className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-200 px-4 py-3"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 12px)" }}
      >
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
            type="button"
            onClick={handleSubmit}
            disabled={!gcashReady || uploading}
            className="flex-1 btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Review booking
          </button>
        </div>
      </div>
    </div>
  );
}
