import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware: protects /admin/* routes.
 * 1. Verifies a valid Supabase session cookie
 * 2. Bounces to /auth/login (clearing cookies) if no session OR no operator_id claim
 * 3. Attaches x-user-id and x-operator-id headers for downstream server components / API routes
 *
 * Admin routes carry no operatorId in the URL path, so scoping is enforced via
 * the x-operator-id claim derived from the session JWT. Every /api/admin/* route
 * reads this header and filters its queries by operator_id.
 */
export const config = {
  matcher: ["/admin/:path*"],
};

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase env vars missing in middleware");
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  const accessToken = request.cookies.get("sb-access-token")?.value;
  const refreshToken = request.cookies.get("sb-refresh-token")?.value;

  if (!accessToken || !refreshToken) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // Create Supabase client to verify the session
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // No valid session → clear cookies and bounce to login.
  if (error || !user) {
    const response = NextResponse.redirect(new URL("/auth/login", request.url));
    response.cookies.delete("sb-access-token");
    response.cookies.delete("sb-refresh-token");
    return response;
  }

  // Derive operator_id robustly from the JWT claims.
  const operatorId: string | undefined =
    user.app_metadata?.operator_id || user.user_metadata?.operator_id;

  // CLOSE-THE-NO-OP: a logged-in user without an operator_id claim must not
  // reach any /admin/* route. Bounce them to login and clear cookies so they
  // re-authenticate (or an admin re-provisions the claim).
  if (!operatorId) {
    const response = NextResponse.redirect(new URL("/auth/login", request.url));
    response.cookies.delete("sb-access-token");
    response.cookies.delete("sb-refresh-token");
    return response;
  }

  // Attach user info to headers for server components and API routes.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", user.id);
  requestHeaders.set("x-operator-id", operatorId);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}
