-- 013_fix_operator_slug_case.sql
-- Trigger: stop the operator slug from DELETING every capital letter in the name.
--
-- The bug: the slug was derived as
--   lower(regexp_replace(op_name, '[^a-z0-9]+', '-', 'g'))
-- The character class [^a-z0-9] is case-SENSITIVE and lower() ran AFTER the
-- substitution, so at substitution time any capital letter matched the negated
-- class and was replaced with a hyphen — silently dropped, never lowercased.
--
-- Reproduced live with a signup-trigger fire test:
--   name 'T2 SelfSign u4cm25' -> slug '2-elf-ign-u4cm25'   (T, S, S eaten, and
--     the lost 'S' of 'Sign' left a stray leading hyphen on the next segment)
-- Already in production: operator 'Samal Demo Operator' -> slug 'amal-emo-perator'
-- (S, D and O all deleted). Before this fix, after this fix:
--   'Samal Demo Operator'  ->  'samal-demo-operator'
--   'T2 SelfSign u4cm25'   ->  't2-selfsign-u4cm25'
--
-- lower() MUST run before the character class is applied. Swapping the two
-- calls back reopens this bug; the ordering is the whole fix, not a style
-- preference. Capital letters must be lowercased first so they are no longer
-- capital, not turned into hyphens.
--
-- Already-mangled slugs are deliberately NOT repaired. 'amal-emo-perator' is
-- wrong and its correct form is 'amal-demo-operator', but operator slugs appear
-- in public URLs (/<operatorSlug>), and rewriting a slug breaks any link
-- already pointing at it. Cosmetic damage is cheaper than broken public links.
-- Leave every existing row alone — a future migration may add a redirect map,
-- but this one must not touch data.
--
-- Same zero-arg signature as 005/011/012 (never change it — a changed signature
-- is what left two overloads and caused the PGRST203 outage in 010). Trigger,
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
  -- lower() must be applied to op_name BEFORE the character class, or every
  -- capital letter matches [^a-z0-9] and is deleted instead of lowercased.
  op_slug := regexp_replace(lower(op_name), '[^a-z0-9]+', '-', 'g');
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
