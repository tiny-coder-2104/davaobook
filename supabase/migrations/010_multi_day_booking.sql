-- ============================================================================
-- DavaoBook — 010: Multi-day (consecutive-night) booking support
-- Adds end_date column to bookings, max_nights on packages,
-- replaces create_booking_transactional with nights-aware version,
-- backfills existing rows so legacy single-day bookings = 1 night.
-- ============================================================================

-- 1. Add end_date and max_nights to bookings table (nullable first, then backfill)
ALTER TABLE bookings ADD COLUMN end_date date;
ALTER TABLE bookings ADD COLUMN nights int;

-- 2. Backfill: every existing booking = 1 night, end_date = tour_date + 1 day
UPDATE bookings SET end_date = tour_date + INTERVAL '1 day', nights = 1 WHERE end_date IS NULL;

-- 3. Add max_nights to packages (default 7; owner can set to 1 to force single-day only)
ALTER TABLE packages ADD COLUMN max_nights int NOT NULL DEFAULT 7;

-- 4. Update existing seed packages with max_nights (explicit, for clarity)
UPDATE packages SET max_nights = 7 WHERE max_nights IS NULL;

-- 5. Replace create_booking_transactional with nights-aware version
--    — accepts optional p_nights (default 1) and computes end_date = tour_date + p_nights
--    — validates every night in [tour_date, end_date) for DOW, blocks, capacity
--    — total_amount = tier_price * p_nights
--    — returns end_date, nights in the jsonb result

CREATE OR REPLACE FUNCTION create_booking_transactional(
  p_package_id    uuid,
  p_tour_date     date,
  p_pax           int,
  p_guest_name    text,
  p_guest_mobile  text,
  p_guest_email   text,
  p_guest_pickup_area text,
  p_guest_notes   text,
  p_nights        int DEFAULT 1
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_package    RECORD;
  v_capacity   int;
  v_booked     numeric;
  v_tier_price numeric;
  v_total      numeric;
  v_code       text;
  v_status     text;
  v_booking_id uuid;
  v_night      date;
  v_series     date;
  v_counter    int := 0;
BEGIN
  -- 1. Fetch active package
  SELECT id, operator_id, name, slug, tiers, days_of_week, capacity_per_day, max_nights
  INTO v_package
  FROM packages
  WHERE id = p_package_id AND active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PACKAGE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- 2. Validate p_nights range
  IF p_nights < 1 OR p_nights > v_package.max_nights THEN
    RAISE EXCEPTION 'MAX_NIGHTS_EXCEEDED' USING ERRCODE = 'P0008';
  END IF;

  -- 3. Validate day of week for EVERY night in the stay
  --    Use a simple loop: check each night's DOW against package days_of_week
  FOR v_night IN SELECT * FROM generate_series(p_tour_date, p_tour_date + p_nights - 1, '1 day') LOOP
    IF NOT (EXTRACT(DOW FROM v_night)::int = ANY(v_package.days_of_week)) THEN
      RAISE EXCEPTION 'PACKAGE_UNAVAILABLE_DAY' USING ERRCODE = 'P0003';
    END IF;
  END LOOP;

  -- 4. Validate not past date (check-in night must be >= today)
  IF p_tour_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'TOUR_DATE_PAST' USING ERRCODE = 'P0004';
  END IF;

  -- 5. Check blocks for EVERY night in the stay
  IF EXISTS (
    SELECT 1 FROM generate_series(p_tour_date, p_tour_date + p_nights - 1, '1 day') AS g(night)
    WHERE EXISTS (
      SELECT 1 FROM blocks
      WHERE date = g.night
        AND operator_id = v_package.operator_id
        AND (package_id = p_package_id OR package_id IS NULL)
    )
  ) THEN
    RAISE EXCEPTION 'DATE_BLOCKED' USING ERRCODE = 'P0005';
  END IF;

  -- 6. Find matching pricing tier
  SELECT t.price_per_pax INTO v_tier_price
  FROM jsonb_to_recordset(v_package.tiers) AS t(
    min_pax int, max_pax int, price_per_pax numeric
  )
  WHERE p_pax >= t.min_pax AND p_pax <= t.max_pax
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_TIER_FOR_PAX' USING ERRCODE = 'P0006';
  END IF;

  -- Flat per-night rate: tier price covers the tier's guest capacity per night
  v_total := v_tier_price * p_nights;

  -- 7. Transactional capacity check with row lock
  --    Lock the package row to serialize concurrent bookings
  SELECT capacity_per_day INTO v_capacity
  FROM packages
  WHERE id = p_package_id
  FOR UPDATE;

  --    Sum PAX of active bookings for EACH night in the range.
  --    A booking covers night d if tour_date <= d AND d < end_date (or tour_date+1 if NULL).
  --    We check the overlap: for each night, existing bookings that cover it.
  --    Since we can't easily SUM across a generate_series in a single SELECT,
  --    we loop through each night and accumulate booked pax; if any night exceeds capacity, raise.
  FOR v_night IN SELECT * FROM generate_series(p_tour_date, p_tour_date + p_nights - 1, '1 day') LOOP
    SELECT COALESCE(SUM(pax), 0) INTO v_booked
    FROM bookings
    WHERE package_id = p_package_id
      AND status IN ('PENDING_PAYMENT', 'PENDING_CONFIRMATION', 'CONFIRMED')
      AND tour_date <= v_night
      AND (end_date IS NULL OR v_night < end_date);

    IF v_booked + p_pax > v_capacity THEN
      RAISE EXCEPTION 'CAPACITY_FULL' USING ERRCODE = 'P0007';
    END IF;
  END LOOP;

  -- 8. Generate booking code — uses the same code (single night format);
  --    the code is based on check-in date only, which is fine for display.
  v_code := generate_booking_code(v_package.slug, p_tour_date, p_guest_name);

  -- 9. Insert booking with end_date and nights
  INSERT INTO bookings (
    code, package_id, operator_id, tour_date, pax,
    tier_price, total_amount,
    guest_name, mobile, email, pickup_area, notes,
    status, end_date, nights
  ) VALUES (
    v_code, p_package_id, v_package.operator_id, p_tour_date, p_pax,
    v_tier_price, v_total,
    p_guest_name, p_guest_mobile, p_guest_email, p_guest_pickup_area, p_guest_notes,
    'PENDING_CONFIRMATION',
    p_tour_date + INTERVAL '1 day' * p_nights,   -- end_date = check-in + nights days
    p_nights
  )
  RETURNING id, status INTO v_booking_id, v_status;

  -- 10. Return booking summary
  RETURN jsonb_build_object(
    'booking_id', v_booking_id,
    'code',        v_code,
    'status',      v_status,
    'total_amount', v_total,
    'tour_date',   p_tour_date,
    'end_date',    p_tour_date + INTERVAL '1 day' * p_nights,
    'nights',      p_nights
  );
END;
$$;

-- 6. Update the updated_at trigger (already exists; no change needed since we added columns after trigger creation)

-- 7. Index hint: support range queries for end_date
CREATE INDEX IF NOT EXISTS idx_bookings_end_date
  ON bookings (operator_id, end_date);

COMMENT ON COLUMN bookings.end_date IS 'Exclusive checkout date; stay occupies nights tour_date .. end_date-1';
COMMENT ON COLUMN bookings.nights IS 'Number of consecutive nights booked (1 = single night)';
COMMENT ON COLUMN packages.max_nights IS 'Maximum consecutive nights allowed per booking; default 7. Set to 1 to force single-day bookings only.';