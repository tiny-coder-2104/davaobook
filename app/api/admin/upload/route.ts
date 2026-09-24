import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * POST /api/admin/upload — Upload a package photo to the public
 * `package-images` bucket. Body: { filename, base64 } where base64 is a
 * `data:image/…;base64,…` URL (no multipart — no deps).
 *
 * Auth: x-operator-id header set by middleware from the verified session
 * (same pattern as every other /api/admin route). Uploads run with the
 * service-role key server-side.
 */

const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/** Cheap magic-byte sniff on the decoded binary — real content check, not just the data-URL prefix. */
function sniffImage(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true; // JPEG
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  )
    return true; // PNG
  if (
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38
  )
    return true; // GIF
  if (
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  )
    return true; // WEBP
  return false;
}

export async function POST(request: NextRequest) {
  const operatorId = request.headers.get("x-operator-id");
  if (!operatorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { filename?: string; base64?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { filename, base64 } = body;
  if (typeof base64 !== "string" || !base64.startsWith("data:image/")) {
    return NextResponse.json(
      { error: "base64 must be a data:image/… URL" },
      { status: 400 }
    );
  }

  // Content type from the data-URL prefix.
  const mime = base64.slice(5, base64.indexOf(";"));
  if (!ALLOWED.has(mime)) {
    return NextResponse.json(
      { error: `Unsupported image type: ${mime}` },
      { status: 400 }
    );
  }

  const buf = Buffer.from(base64.slice(base64.indexOf(",") + 1), "base64");
  if (buf.length === 0 || buf.length > MAX_BYTES) {
    return NextResponse.json(
      { error: "Image must be 2MB or smaller" },
      { status: 400 }
    );
  }
  if (!sniffImage(buf)) {
    return NextResponse.json(
      { error: "File is not a valid image" },
      { status: 400 }
    );
  }

  // Sanitize: strip any path, keep alphanumeric + dash, timestamp prefix.
  const raw = (filename ?? "photo").split(/[\\/]/).pop() ?? "photo";
  const clean = raw.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40) || "photo";
  const ext = mime === "image/jpeg" ? "jpg" : mime.split("/")[1];
  const path = `packages/${Date.now()}-${clean}.${ext}`;

  const { error } = await supabaseAdmin.storage
    .from("package-images")
    .upload(path, buf, { contentType: mime, upsert: false });

  if (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data } = supabaseAdmin.storage
    .from("package-images")
    .getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}