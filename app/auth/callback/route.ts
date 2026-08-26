import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /auth/callback — Handles Supabase magic link redirect.
 * Exchanges the `code` query param for a session,
 * stores tokens in httpOnly cookies, redirects to /admin/today.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=no_code`);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    return NextResponse.redirect(
      `${origin}/auth/login?error=${encodeURIComponent(error?.message || "session_failed")}`
    );
  }

  // Build response with cookies
  const response = NextResponse.redirect(`${origin}/admin/today`);

  // Set auth cookies — httpOnly, secure, sameSite lax
  const cookieOptions = [
    `sb-access-token=${data.session.access_token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${data.session.expires_in}`,
    `sb-refresh-token=${data.session.refresh_token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`,
  ].join(", ");

  response.headers.append("Set-Cookie", cookieOptions);

  return response;
}
