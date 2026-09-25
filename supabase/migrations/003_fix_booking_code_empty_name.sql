-- ============================================================================
-- DavaoBook — Hardened booking code generation
-- Bug: guest names that are blank or contain no A-Z0-9 characters (e.g.
-- whitespace-only, CJK/emoji names) produced codes with an EMPTY name
-- segment: "FAMIL-0926-". Those codes are hard to communicate and were
-- rejected by the track page's code regex.
-- Fix: fall back to 'GUEST' when the name segment strips to empty.
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_booking_code(
  p_package_slug text,
  p_tour_date date,
  p_guest_name text
) RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_slug text;
  v_date text;
  v_name text;
  v_code text;
  v_counter int := 0;
BEGIN
  -- Slug: first 5 chars of package slug, uppercase
  v_slug := UPPER(LEFT(p_package_slug, 5));

  -- Date: MMDD
  v_date := TO_CHAR(p_tour_date, 'MMDD');

  -- Name: first 4 chars of guest name, uppercase, alphanum only
  v_name := UPPER(REGEXP_REPLACE(LEFT(p_guest_name, 4), '[^A-Z0-9]', '', 'g'));

  -- Fallback: never emit an empty name segment
  IF v_name IS NULL OR v_name = '' THEN
    v_name := 'GUEST';
  END IF;

  -- Build base code
  v_code := v_slug || '-' || v_date || '-' || v_name;

  -- Collision check: append -N suffix if needed
  WHILE EXISTS (SELECT 1 FROM bookings WHERE code = v_code) LOOP
    v_counter := v_counter + 1;
    v_code := v_slug || '-' || v_date || '-' || v_name || '-' || v_counter;
  END LOOP;

  RETURN v_code;
END;
$$;
