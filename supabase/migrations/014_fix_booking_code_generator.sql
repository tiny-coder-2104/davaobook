-- 014_fix_booking_code_generator.sql
-- Fix: booking code 'TEST--0930-GUEST' (double dash) and name segments eaten
-- by a case-sensitive character class.
--
-- BUG 1 — the slug segment kept its non-alphanumerics. The old code took
-- LEFT(slug, 5) first, so a hyphen burned one of the five slots and the code
-- builder then added its own separator (measured live):
--   'test-room' -> 'TEST-'  -> 'TEST--0930-GUEST'   (double dash)
--   'a-b-c'     -> 'A-B-C'  -> 'A-B-C-1009-J'       (four segments)
--   '----'      -> '----'   -> '-----1009-J'        (leading dash)
-- The track page's /^[A-Z0-9]{1,5}-\d{4}-.../ regex rejects every one of
-- those codes, so the booking cannot be looked up at all. Strip
-- non-alphanumerics FIRST, then take 5 — that order preserves every
-- already-correct code: standard-room -> STAND, family-cabin -> FAMIL,
-- mountain-view-suite -> MOUNT are unchanged.
--
-- BUG 2 — the name segment stripped BEFORE uppercasing. [^A-Z0-9] is
-- case-SENSITIVE, so against the raw name it matches every lowercase letter
-- and eats it (measured live):
--   'test tests' -> ''    -> GUEST fallback (should have been 'TEST')
--   'maria'      -> ''    -> GUEST fallback (should have been 'MARI')
--   'Test Tests' -> 'T'   (lowercase letters eaten)
--   'TEST TESTS' -> 'TEST' (only works when already uppercase)
-- UPPER() MUST run before the case-sensitive class — that ordering is the
-- whole fix, not a style preference. Same bug class as 013's operator-slug
-- fix: lower()/UPPER() first, character class second.
--
-- The slug's empty fallback 'ROOM' mirrors the name's existing 'GUEST'
-- fallback from 003: never emit an empty segment, because an empty segment is
-- exactly what made a code malformed in the first place.
--
-- Same 3-argument signature as 001/003 (text, date, text) — never change it;
-- a changed signature is what caused the PGRST203 outage (see 013 header).
-- Base-code build and collision loop are byte-identical to 003. Function
-- replacement only: no data-modifying statement in this file, so it is
-- idempotent and safe to re-run. Existing malformed rows are left alone —
-- repairing them is a separate change.

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
  -- Slug: strip non-alphanumerics FIRST, then take 5. Taking 5 first lets a
  -- dash consume a slot ('test-room' -> 'test-') and emits 'TEST--0930-GUEST',
  -- which the track page's /^[A-Z0-9]{1,5}-\d{4}-.../ regex rejects as a
  -- malformed code. Stripping first preserves every existing code:
  -- standard-room -> STAND, family-cabin -> FAMIL, mountain-view-suite -> MOUNT.
  v_slug := UPPER(LEFT(REGEXP_REPLACE(COALESCE(p_package_slug, ''), '[^A-Za-z0-9]', '', 'g'), 5));
  IF v_slug IS NULL OR v_slug = '' THEN
    v_slug := 'ROOM';
  END IF;

  -- Date: MMDD
  v_date := TO_CHAR(p_tour_date, 'MMDD');

  -- Name: first 4 chars of guest name. UPPER() must wrap the string BEFORE
  -- the character class, not after: [^A-Z0-9] is case-sensitive, so applying
  -- it to the raw name eats every lowercase letter — 'test tests' -> '' ->
  -- GUEST fallback, 'Test Tests' -> 'T'. Uppercasing first makes all letters
  -- survive: 'test tests' -> 'TEST'.
  v_name := REGEXP_REPLACE(UPPER(LEFT(p_guest_name, 4)), '[^A-Z0-9]', '', 'g');

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
