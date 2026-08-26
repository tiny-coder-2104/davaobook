"use client";

import { useEffect, useState } from "react";
import QRCodeLib from "qrcode";

interface QRCodeProps {
  /** The URL to encode in the QR code */
  value: string;
  /** Render size in px (default 256) */
  size?: number;
  className?: string;
}

/**
 * Renders a QR code as an <img> from a data URL.
 * Uses the `qrcode` npm package for generation.
 */
export default function QRCode({
  value,
  size = 256,
  className = "",
}: QRCodeProps) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCodeLib.toDataURL(value, {
      width: size,
      margin: 2,
      color: { dark: "#111827", light: "#ffffff" },
      errorCorrectionLevel: "M",
    }).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!src) {
    // Placeholder while generating
    return (
      <div
        className={`bg-gray-100 animate-pulse rounded-lg ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <img
      src={src}
      alt="QR code"
      width={size}
      height={size}
      className={`rounded-lg ${className}`}
    />
  );
}
