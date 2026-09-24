"use client";

import { useState, useRef, useCallback } from "react";

/* ── Types ── */

interface PhotoUploadProps {
  /** Current photo URL (edit mode) */
  value: string | null;
  /** Called when a new photo URL is set (or null to clear) */
  onChange: (url: string | null) => void;
}

/* ── Component ── */

export default function PhotoUpload({ value, onChange }: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploading(true);
      setError(null);

      try {
        // Read as data URL, POST to the server-side upload route (service-role
        // key, operator-scoped — same auth as every other /api/admin route).
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Failed to read file"));
          reader.readAsDataURL(file);
        });

        const res = await fetch("/api/admin/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, base64 }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);

        onChange(data.url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [onChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith("image/")) {
        // Trigger the same upload flow
        const input = fileRef.current;
        if (input) {
          const dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    },
    []
  );

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative inline-block">
          <img
            src={value}
            alt="Package photo"
            className="w-32 h-32 object-cover rounded-touch border border-gray-200"
          />
          <button
            type="button"
            onClick={() => {
              onChange(null);
              if (fileRef.current) fileRef.current.value = "";
            }}
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white
              flex items-center justify-center text-xs"
            aria-label="Remove photo"
          >
            ×
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className="w-full min-h-[120px] rounded-touch border-2 border-dashed border-gray-300
            flex flex-col items-center justify-center gap-2 cursor-pointer
            hover:border-brand hover:bg-brand/5 transition-colors"
        >
          {uploading ? (
            <div className="text-sm text-ink-muted">Uploading…</div>
          ) : (
            <>
              <svg className="w-8 h-8 text-ink-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm text-ink-muted">Tap or drag photo here</span>
            </>
          )}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
        aria-label="Upload package photo"
      />

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
