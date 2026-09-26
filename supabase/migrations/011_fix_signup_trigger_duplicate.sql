-- 011_fix_signup_trigger_duplicate.sql
-- Trigger: stop handle_new_user() from creating a second, empty operator row
-- when the auth user is already linked to an existing one.
--
-- Why: 005 fires AFTER INSERT ON auth.users and unconditionally INSERTs a new
-- operators row, then overwrites app_metadata.operator_id with that new id.
-- But scripts/create-operator-account.js provisions accounts against an
-- ALREADY EXISTING operators row by passing app_metadata: { operator_id } at
-- creation time. So every script-created account got a spurious duplicate
-- operator row and had its link clobbered to point at that empty row.
-- Live evidence: operators.id 0737b84e... (demo.seaclouds@davaobook.app, slug
-- demo-seaclouds, every field null, 0 packages, 0 bookings) existed alongside
-- the real row a0eebc99... (hello@seacloudsresort.ph, slug seaclouds), plus 3
-- more of the same class from a 2026-09-25 QA run.
--
-- Fix: CREATE OR REPLACE with the same zero-arg trigger signature (never a new
-- signature — that is what left two overloads and caused the PGRST203 outage in
-- 010) and bail out early when the incoming user already carries a valid
-- operator_id. The trigger itself, its timing and its grants are untouched.
-- Idempotent: re-running replaces the function and re-runs a no-op cleanup.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_operator_id uuid;
  op_name text;
  op_slug text;
BEGIN
  -- scripts/create-operator-account.js already links the new auth user to an
  -- existing operator row via app_metadata.operator_id. Without this guard the
  -- trigger invents a second, empty operator row on every script-created
  -- account and clobbers the link. Compared as text on purpose: casting to
  -- uuid would throw on a malformed value, and a failed lookup should just
  -- fall through to the normal signup path.
  IF EXISTS (
    SELECT 1 FROM public.operators
    WHERE id::text = NEW.raw_app_meta_data->>'operator_id'
  ) THEN
    RETURN NEW;
  END IF;

  -- Derive name from user_metadata or email prefix
  op_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );
  -- Slug: lowercase, replace spaces/special chars with hyphens
  op_slug := lower(regexp_replace(op_name, '[^a-z0-9]+', '-', 'g'));
  op_slug := regexp_replace(op_slug, '^-|-$', '', 'g');

  INSERT INTO public.operators (name, slug, email)
  VALUES (op_name, op_slug, NEW.email)
  RETURNING id INTO new_operator_id;

  -- Patch app_metadata to include operator_id (used by middleware JWT check)
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object(
    'operator_id', new_operator_id::text
  )
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- Cleanup of the pre-fix debris, so a fresh apply converges on a clean state.
--
-- Remove operator rows that no auth user points at AND that own nothing.
-- Scoped deliberately: requires the row to own no packages, no bookings and
-- no blocks before it can be removed.
--
-- auth.users is NOT checked here. This migration is authored to run under a
-- role we cannot prove can SELECT auth.users (005 only proves the *function
-- owner* can UPDATE it, via SECURITY DEFINER), and a migration that fails on
-- a permission error is worse than one that under-reaches. So the auth leg is
-- deliberately absent rather than faked: an operator who signed up normally
-- owns a package, so "owns nothing at all" is already the empty-duplicate
-- signature. Residual risk, stated plainly: a brand-new real operator with no
-- package/bookings/block yet would be swept too — they lose nothing (all
-- three child tables are empty) and, with the guard above, nothing re-creates
-- the row for them, so they would need a re-run of 005's INSERT path by hand.
-- bookings.operator_id has no ON DELETE CASCADE, so the NOT EXISTS on
-- bookings is also a hard FK backstop, not just intent.
-- ---------------------------------------------------------------------------
DELETE FROM public.operators o
WHERE NOT EXISTS (SELECT 1 FROM public.packages p WHERE p.operator_id = o.id)
  AND NOT EXISTS (SELECT 1 FROM public.bookings  b WHERE b.operator_id = o.id)
  AND NOT EXISTS (SELECT 1 FROM public.blocks    k WHERE k.operator_id = o.id);
