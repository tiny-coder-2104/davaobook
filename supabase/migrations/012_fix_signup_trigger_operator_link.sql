-- 012_fix_signup_trigger_operator_link.sql
-- Trigger: fix the guard added in 011 so it actually fires.
--
-- Why 011 did not work: the guard tested
--   WHERE id::text = NEW.raw_app_meta_data->>'operator_id'
-- but at AFTER INSERT ON auth.users, GoTrue has not written app_metadata yet,
-- so that expression is NULL on every row and the guard can never match. A
-- live fire test created a user exactly as scripts/create-operator-account.js
-- does and operators still went +2 instead of +1. A probe user created with
-- user_metadata.name = "PROBE-NAME-u5dx17" produced a trigger row named
-- exactly that, which proves raw_user_meta_data IS populated at trigger time
-- while raw_app_meta_data is not.
--
-- DO NOT "fix" this back to raw_app_meta_data-first. It reads a field that is
-- still NULL at this point in the flow, and the guard silently never fires
-- again — which is the exact failure this migration exists to correct. The
-- app_metadata clobbering looked absent in 011 only because GoTrue's own later
-- write overwrote the trigger's UPDATE. That was write-ordering luck, not a fix.
--
-- The link is also now written to user_metadata by
-- scripts/create-operator-account.js, so the guard has something to see.
-- app_metadata stays as the server-authoritative copy the middleware reads.
--
-- Same zero-arg signature as 005/011 (never change it — a changed signature is
-- what left two overloads and caused the PGRST203 outage in 010). Trigger,
-- timing, SECURITY DEFINER, owner and grants are untouched. Function
-- replacement only: no data-modifying statement in this file.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_operator_id uuid;
  op_name text;
  op_slug text;
BEGIN
  -- The operator link must be read from raw_user_meta_data, NOT
  -- raw_app_meta_data: at AFTER INSERT on auth.users, GoTrue has not yet
  -- written app_metadata, so raw_app_meta_data->>'operator_id' is NULL and a
  -- guard reading it can never match. raw_user_meta_data IS populated by then.
  -- Fall back to raw_app_meta_data anyway for callers that do manage to set it.
  IF EXISTS (
    SELECT 1 FROM public.operators
    WHERE id::text = COALESCE(
      NEW.raw_user_meta_data->>'operator_id',
      NEW.raw_app_meta_data->>'operator_id'
    )
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
