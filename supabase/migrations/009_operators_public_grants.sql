-- ============================================================================
-- DavaoBook — 009: column-level grants for anon/authenticated (QA 0039 + 0040)
--
-- 001_init.sql ships "Public read operators" / "Public read blocks" RLS
-- policies with USING (true). RLS only gates ROWS, not COLUMNS, so anyone
-- holding the anon key could read every tenant's operators row —
-- email, phone, gcash_number, gcash_qr_url, sms_sender_id, notification_prefs.
--
-- Fix: keep the row-level policies (public pages still need every operator /
-- every date block), but drop SELECT down to a PUBLIC column set.
-- service_role is untouched (all server routes, the SECURITY DEFINER booking
-- function and the embedded operators(...) join in app/v/[code] use it).
--
-- NOTE (PostgreSQL semantics): with partial column grants a wildcard fails —
--   SELECT * FROM operators  →  ERROR: permission denied for column <private>
-- (Supabase docs: "Restricted roles cannot use the wildcard operator (*) on
-- the affected table"). The two public pages that used select("*") were
-- switched to explicit column lists in the same change:
--   app/[operatorSlug]/page.tsx, app/p/[pkg]/page.tsx
-- Every other anon query lists its columns already and selects only from the
-- granted set below.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. OPERATORS — public columns only for anon + authenticated
-- ----------------------------------------------------------------------------
-- PUBLIC  : id, name, slug, logo_url, brand_color, verified, created_at
--           (branding / trust badges / landing-page order by created_at)
-- PRIVATE : phone, email, gcash_number, gcash_qr_url, sms_sender_id,
--           notification_prefs  (contact / payment / SMS / auth-adjacent)
-- Account settings read+write their own row SERVER-SIDE via service_role
-- (app/api/admin/account/route.ts), so no client needs the private columns.
-- ----------------------------------------------------------------------------
REVOKE SELECT ON public.operators FROM anon, authenticated;

GRANT SELECT (id, name, slug, logo_url, brand_color, verified, created_at)
  ON public.operators TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. BLOCKS — no client-side reader at all (QA 0040)
-- ----------------------------------------------------------------------------
-- Grep result: every .from("blocks") call is inside a service-role API route
--   app/api/admin/blocks/route.ts, app/api/admin/blocks/[id]/route.ts,
--   app/api/admin/calendar/route.ts,
--   app/api/packages/[pkg]/availability/route.ts   ← public date picker path
-- and the SECURITY DEFINER-style booking path reads blocks inside
-- create_booking_transactional() (invoked as service_role via PostgREST rpc).
-- The public book page date picker goes through /api/packages/[pkg]/availability,
-- never blocks directly. So anon/authenticated need ZERO column access.
-- ----------------------------------------------------------------------------
REVOKE SELECT ON public.blocks FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Reload PostgREST schema cache (column-grant aware)
-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
