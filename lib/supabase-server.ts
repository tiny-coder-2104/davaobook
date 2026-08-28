import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client with service_role key.
 * Bypasses RLS — use only in API routes and server actions.
 */
// Build-safe: don't throw at module import when SUPABASE_SERVICE_ROLE_KEY is
// absent (e.g. CI runs `next build` with only public vars and no service key).
// `createClient` throws on an empty/undefined key, so default to a non-empty
// placeholder. Production always sets the real key; any request that reaches an
// admin API without it would simply fail auth, which is the correct behavior.
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "missing-supabase-service-role-key";

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
