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
-- Idempotent: re-running replaces the function.
--
-- REMOVED: a trailing `DELETE FROM public.operators ...` cleanup, and the
-- comment block justifying it. It was never applied to production, so nothing
-- drifts by removing it here. It is removed on the grounds that "owns no
-- packages/bookings/blocks" is NOT the orphan signature: a brand-new
-- legitimate operator owns nothing either. Against live operators it matched
-- 3 of 4 rows, two of which had real auth users pointed at them — it would
-- have destroyed live accounts. Fix 012 corrects the guard above; the one
-- genuine orphan (0737b84e) is removed by a targeted id-filtered delete, never
-- by a broad sweep.

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
