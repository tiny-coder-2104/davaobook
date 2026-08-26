-- ============================================================================
-- DavaoBook — Transactional booking creation function
-- Atomic capacity check + insert via SELECT FOR UPDATE
-- ============================================================================

CREATE OR REPLACE FUNCTION create_booking_transactional(
  p_package_id    uuid,
  p_tour_date     date,
  p_pax           int,
  p_guest_name    text,
  p_guest_mobile  text,
  p_guest_email   text,
  p_guest_pickup_area text,
  p_guest_notes   text
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_package    RECORD;
  v_capacity   int;
  v_booked     int;
  v_tier_price numeric;
  v_total      numeric;
  v_code       text;
  v_status     text;
  v_booking_id uuid;
BEGIN
  -- 1. Fetch active package
  SELECT id, operator_id, name, slug, tiers, days_of_week, capacity_per_day
  INTO v_package
  FROM packages
  WHERE id = p_package_id AND active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PACKAGE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- 2. Validate day of week
  IF NOT (EXTRACT(DOW FROM p_tour_date)::int = ANY(v_package.days_of_week)) THEN
    RAISE EXCEPTION 'PACKAGE_UNAVAILABLE_DAY' USING ERRCODE = 'P0003';
  END IF;

  -- 3. Validate not past date
  IF p_tour_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'TOUR_DATE_PAST' USING ERRCODE = 'P0004';
  END IF;

  -- 4. Check blocks (package-specific or all-packages block)
  IF EXISTS (
    SELECT 1 FROM blocks
    WHERE date = p_tour_date
      AND operator_id = v_package.operator_id
      AND (package_id = p_package_id OR package_id IS NULL)
  ) THEN
    RAISE EXCEPTION 'DATE_BLOCKED' USING ERRCODE = 'P0005';
  END IF;

  -- 5. Find matching pricing tier
  SELECT t.price_per_pax INTO v_tier_price
  FROM jsonb_to_recordset(v_package.tiers) AS t(
    min_pax int, max_pax int, price_per_pax numeric
  )
  WHERE p_pax >= t.min_pax AND p_pax <= t.max_pax
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_TIER_FOR_PAX' USING ERRCODE = 'P0006';
  END IF;

  v_total := v_tier_price * p_pax;

  -- 6. Transactional capacity check with row lock
  --    Lock the package row to serialize concurrent bookings
  SELECT capacity_per_day INTO v_capacity
  FROM packages
  WHERE id = p_package_id
  FOR UPDATE;

  --    Count active bookings for this package+tour_date
  SELECT count(*) INTO v_booked
  FROM bookings
  WHERE package_id = p_package_id
    AND tour_date = p_tour_date
    AND status IN ('PENDING_PAYMENT', 'PENDING_CONFIRMATION', 'CONFIRMED');

  --    Check capacity: existing bookings + requested pax must fit
  IF v_booked + p_pax > v_capacity THEN
    RAISE EXCEPTION 'CAPACITY_FULL' USING ERRCODE = 'P0007';
  END IF;

  -- 7. Generate booking code (uses existing generate_booking_code function)
  v_code := generate_booking_code(v_package.slug, p_tour_date, p_guest_name);

  -- 8. Insert booking
  INSERT INTO bookings (
    code, package_id, operator_id, tour_date, pax,
    tier_price, total_amount,
    guest_name, mobile, email, pickup_area, notes,
    status
  ) VALUES (
    v_code, p_package_id, v_package.operator_id, p_tour_date, p_pax,
    v_tier_price, v_total,
    p_guest_name, p_guest_mobile, p_guest_email, p_guest_pickup_area, p_guest_notes,
    'PENDING_PAYMENT'
  )
  RETURNING id, status INTO v_booking_id, v_status;

  -- 9. Return booking summary
  RETURN jsonb_build_object(
    'booking_id', v_booking_id,
    'code',        v_code,
    'status',      v_status,
    'total_amount', v_total,
    'tour_date',   p_tour_date
  );
END;
$$;
