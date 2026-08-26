import { createBrowserClient } from "./supabase-browser";

export interface UploadResult {
  url: string | null;
  error: string | null;
}

/**
 * Upload a screenshot directly from the browser to Supabase Storage.
 * Uses a signed upload URL to avoid going through the serverless body.
 *
 * @param file - The image file to upload
 * @param onProgress - Callback with upload percentage (0-100)
 * @returns The public URL of the uploaded file, or an error
 */
export async function uploadScreenshot(
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadResult> {
  const supabase = createBrowserClient();

  // Generate a unique path: screenshots/{timestamp}-{random}.{ext}
  const ext = file.name.split(".").pop() || "jpg";
  const path = `screenshots/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  // Upload with progress tracking via XMLHttpRequest
  // ponytail: Supabase JS client doesn't expose upload progress;
  // raw XHR to the storage REST endpoint gives us progress events.
  const { data: sessionData } = await supabase.auth.getSession();
  // For public anon uploads, we don't need a session — use the anon key directly.
  // But the bucket needs to allow anon inserts. If RLS requires auth,
  // fall back to supabase.storage.upload which doesn't expose progress.

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // Construct the public URL
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const publicUrl = `${supabaseUrl}/storage/v1/object/public/screenshots/${path}`;
        resolve({ url: publicUrl, error: null });
      } else {
        // Fall back to the JS client method (no progress)
        supabase.storage
          .from("screenshots")
          .upload(path, file, { upsert: false })
          .then(({ data, error }) => {
            if (error) {
              resolve({ url: null, error: error.message });
            } else {
              const { data: urlData } = supabase.storage
                .from("screenshots")
                .getPublicUrl(data.path);
              resolve({ url: urlData.publicUrl, error: null });
            }
          });
      }
    });

    xhr.addEventListener("error", () => {
      // Fall back to the JS client method
      supabase.storage
        .from("screenshots")
        .upload(path, file, { upsert: false })
        .then(({ data, error }) => {
          if (error) {
            resolve({ url: null, error: error.message });
          } else {
            const { data: urlData } = supabase.storage
              .from("screenshots")
              .getPublicUrl(data.path);
            resolve({ url: urlData.publicUrl, error: null });
          }
        });
    });

    // Build the direct upload URL
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const uploadUrl = `${supabaseUrl}/storage/v1/object/screenshots/${path}`;

    xhr.open("POST", uploadUrl);
    xhr.setRequestHeader("Authorization", `Bearer ${anonKey}`);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.send(file);
  });
}
