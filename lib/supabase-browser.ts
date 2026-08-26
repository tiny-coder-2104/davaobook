import { createClient } from "@supabase/supabase-js";

/**
 * Browser-side Supabase client (anon key only).
 * Used by client components for signInWithOtp.
 */
export function createBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
