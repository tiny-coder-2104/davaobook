-- 005_auto_operator_on_signup.sql
-- Trigger: auto-create an operator row + link operator_id into app_metadata
-- when a new auth user signs up via magic link.
--
-- Flow:
--   1. New auth.users row inserted
--   2. Trigger creates operator row (name from metadata or email prefix)
--   3. Trigger patches app_metadata.operator_id on the user
--   4. On next sign-in, JWT includes operator_id → middleware allows /admin/*

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_operator_id uuid;
  op_name text;
  op_slug text;
BEGIN
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

-- Only fires on INSERT (new signup), not on every sign-in
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant usage (trigger runs as SECURITY DEFINER, but belt-and-suspenders)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT INSERT ON public.operators TO authenticated;
