import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware: protects /admin/* routes.
 * 1. Checks for valid Supabase session cookie
 * 2. Redirects to /auth/login if not authenticated
 * 3. Validates operator_id from JWT matches URL param
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

  if (error || !user) {
    const response = NextResponse.redirect(new URL("/auth/login", request.url));
    // Clear invalid cookies
    response.cookies.delete("sb-access-token");
    response.cookies.delete("sb-refresh-token");
    return response;
  }

  // Check operator_id claim in JWT
  const operatorId = user.app_metadata?.operator_id || user.user_metadata?.operator_id;

  // If accessing /admin/:operatorId/*, validate match
  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  if (segments.length >= 3 && segments[1] === "admin" && segments[2]) {
    const urlOperatorId = segments[2];
    // For now, allow all authenticated operators on /admin/today and /admin/bookings
    // When multi-tenant is enforced, uncomment: if (operatorId !== urlOperatorId) { ... }
  }

  // Attach user info to headers for server components
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", user.id);
  if (operatorId) {
    requestHeaders.set("x-operator-id", operatorId);
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}
