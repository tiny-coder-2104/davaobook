"use client";

import { useState, useRef, useCallback } from "react";
import { createBrowserClient } from "@/lib/supabase-browser";

/* ── Types ── */

interface PhotoUploadProps {
  /** Current photo URL (edit mode) */
  value: string | null;
  /** Called when a new photo URL is set (or null to clear) */
  onChange: (url: string | null) => void;
  /** Storage bucket name */
  bucket?: string;
}

/* ── Client-side thumbnail resize ── */

function createThumbnail(file: File, maxSize = 200): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
        "image/jpeg",
        0.8
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

/* ── Component ── */

export default function PhotoUpload({
  value,
  onChange,
  bucket = "screenshots",
}: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploading(true);
      setError(null);
      setProgress(0);

      try {
        const supabase = createBrowserClient();
        const ext = file.name.split(".").pop() || "jpg";
        const path = `packages/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

        // Upload original
        const { error: uploadErr } = await supabase.storage
          .from(bucket)
          .upload(path, file, { upsert: false });

        if (uploadErr) throw new Error(uploadErr.message);

        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
        if (!urlData?.publicUrl) throw new Error("Failed to get public URL");

        // Also upload thumbnail (client-side resize)
        const thumb = await createThumbnail(file, 200);
        const thumbPath = `packages/thumb_${path}`;
        await supabase.storage.from(bucket).upload(thumbPath, thumb, { upsert: false });

        setProgress(100);
        onChange(urlData.publicUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [bucket, onChange]
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
            <>
              <div className="text-sm text-ink-muted">Uploading... {progress}%</div>
              <div className="w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </>
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
