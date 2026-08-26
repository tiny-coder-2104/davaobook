import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * GET/POST /api/cron/keepalive — Prevent Supabase free-tier pause.
 *
 * Pings the database and returns 200 with timestamp.
 * Secured: requires CRON_SECRET in Authorization header.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Simple DB ping to keep Supabase alive
  const { error } = await supabaseAdmin.from("operators").select("id").limit(1);

  if (error) {
    console.error("Keepalive DB ping failed:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
  });
}

// POST = same behavior
export const POST = GET;
