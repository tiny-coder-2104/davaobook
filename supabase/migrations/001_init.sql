-- ============================================================================
-- DavaoBook — Initial Migration
-- Tables: operators, packages, blocks, bookings, notify_log
-- Includes: RLS policies, indexes, booking code generation, seed data
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. OPERATORS
-- ============================================================================
CREATE TABLE operators (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       text NOT NULL,
  slug       text NOT NULL UNIQUE,
  logo_url   text,
  phone      text,
  email      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2. PACKAGES
-- ============================================================================
CREATE TABLE packages (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  operator_id      uuid NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  name             text NOT NULL,
  slug             text NOT NULL,
  description      text,
  photo_url        text,
  tiers            jsonb NOT NULL DEFAULT '[]'::jsonb,
  days_of_week     int[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  capacity_per_day int NOT NULL DEFAULT 20,
  downpayment_pct  numeric NOT NULL DEFAULT 0,
  cutoff_hours     int NOT NULL DEFAULT 24,
  dp_refundable    boolean NOT NULL DEFAULT false,
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_package_slug_per_operator UNIQUE (operator_id, slug)
);

-- ============================================================================
-- 3. BLOCKS (date closures / custom capacity overrides)
-- ============================================================================
CREATE TABLE blocks (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  package_id  uuid REFERENCES packages(id) ON DELETE CASCADE,  -- NULL = all packages
  operator_id uuid NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  date        date NOT NULL,
  reason      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 4. BOOKINGS
-- ============================================================================
CREATE TABLE bookings (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code             text NOT NULL UNIQUE,
  package_id       uuid NOT NULL REFERENCES packages(id),
  operator_id      uuid NOT NULL REFERENCES operators(id),
  tour_date        date NOT NULL,
  pax              int NOT NULL CHECK (pax > 0),
  tier_price       numeric NOT NULL,
  total_amount     numeric NOT NULL,
  guest_name       text NOT NULL,
  mobile           text NOT NULL,
  email            text,
  pickup_area      text,
  notes            text,
  status           text NOT NULL DEFAULT 'PENDING_PAYMENT',
  payment_method   text,
  gcash_ref        text,
  screenshot_url   text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 5. NOTIFY LOG
-- ============================================================================
CREATE TABLE notify_log (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  channel    text NOT NULL DEFAULT 'sms',
  template   text,
  meta       jsonb,
  sent_at    timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 6. INDEXES
-- ============================================================================

-- Capacity check: find active bookings for a package on a date
CREATE INDEX idx_bookings_capacity
  ON bookings (package_id, tour_date, status);

-- Admin queries: operator's bookings sorted by creation time
CREATE INDEX idx_bookings_operator_created
  ON bookings (operator_id, created_at DESC);

-- Public package listing per operator
CREATE INDEX idx_packages_operator
  ON packages (operator_id, active);

-- Block lookups by date
CREATE INDEX idx_blocks_date
  ON blocks (date);

-- ============================================================================
-- 7. BOOKING CODE GENERATION FUNCTION
-- Format: {PKG-SLUG}-{MMDD}-{GUEST-NAME-FIRST-4}
-- Example: SAMAL-0826-JUAN
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

-- ============================================================================
-- 8. UPDATED_AT TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 9. ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE notify_log ENABLE ROW LEVEL SECURITY;

-- --- Public read policies (anon + authenticated) ---

-- Anyone can read operators
CREATE POLICY "Public read operators"
  ON operators FOR SELECT
  USING (true);

-- Anyone can read active packages
CREATE POLICY "Public read active packages"
  ON packages FOR SELECT
  USING (active = true);

-- Anyone can read blocks
CREATE POLICY "Public read blocks"
  ON blocks FOR SELECT
  USING (true);

-- --- Anon insert: bookings only (guest booking flow) ---

CREATE POLICY "Anon insert bookings"
  ON bookings FOR INSERT
  WITH CHECK (true);

-- --- Authenticated (operator) policies ---
-- Operators see only their own bookings

CREATE POLICY "Operator read own bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING (
    operator_id::text = auth.jwt() ->> 'operator_id'
  );

CREATE POLICY "Operator update own bookings"
  ON bookings FOR UPDATE
  TO authenticated
  USING (
    operator_id::text = auth.jwt() ->> 'operator_id'
  )
  WITH CHECK (
    operator_id::text = auth.jwt() ->> 'operator_id'
  );

-- Operators manage own packages
CREATE POLICY "Operator read own packages"
  ON packages FOR SELECT
  TO authenticated
  USING (
    operator_id::text = auth.jwt() ->> 'operator_id'
  );

CREATE POLICY "Operator insert own packages"
  ON packages FOR INSERT
  TO authenticated
  WITH CHECK (
    operator_id::text = auth.jwt() ->> 'operator_id'
  );

CREATE POLICY "Operator update own packages"
  ON packages FOR UPDATE
  TO authenticated
  USING (
    operator_id::text = auth.jwt() ->> 'operator_id'
  )
  WITH CHECK (
    operator_id::text = auth.jwt() ->> 'operator_id'
  );

CREATE POLICY "Operator delete own packages"
  ON packages FOR DELETE
  TO authenticated
  USING (
    operator_id::text = auth.jwt() ->> 'operator_id'
  );

-- Operators manage own blocks
CREATE POLICY "Operator read own blocks"
  ON blocks FOR SELECT
  TO authenticated
  USING (
    operator_id::text = auth.jwt() ->> 'operator_id'
  );

CREATE POLICY "Operator insert own blocks"
  ON blocks FOR INSERT
  TO authenticated
  WITH CHECK (
    operator_id::text = auth.jwt() ->> 'operator_id'
  );

CREATE POLICY "Operator delete own blocks"
  ON blocks FOR DELETE
  TO authenticated
  USING (
    operator_id::text = auth.jwt() ->> 'operator_id'
  );

-- Operators read their own notify logs
CREATE POLICY "Operator read own notify_log"
  ON notify_log FOR SELECT
  TO authenticated
  USING (
    booking_id IN (
      SELECT id FROM bookings
      WHERE operator_id::text = auth.jwt() ->> 'operator_id'
    )
  );

-- ============================================================================
-- 10. SEED DATA
-- ============================================================================

-- Demo operator
INSERT INTO operators (id, name, slug, phone, email) VALUES
  (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Samal Island Tours',
    'samal-island-tours',
    '+639171234567',
    'hello@samalislandtours.ph'
  );

-- Demo packages
INSERT INTO packages (operator_id, name, slug, description, tiers, days_of_week, capacity_per_day, downpayment_pct, cutoff_hours, dp_refundable) VALUES
  (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Island Hopping',
    'island-hopping',
    'Full day island hopping tour around Samal Island with snorkeling, lunch, and beach stops.',
    '[{"min_pax": 1, "max_pax": 4, "price_per_pax": 1500}, {"min_pax": 5, "max_pax": 10, "price_per_pax": 1200}]'::jsonb,
    '{0,1,2,3,4,5,6}',
    20,
    50,
    24,
    false
  ),
  (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Sunset Cruise',
    'sunset-cruise',
    'Evening sunset cruise with drinks, music, and stunning views of Davao Gulf.',
    '[{"min_pax": 1, "max_pax": 6, "price_per_pax": 2000}, {"min_pax": 7, "max_pax": 12, "price_per_pax": 1700}]'::jsonb,
    '{3,4,5,6}',
    12,
    30,
    24,
    false
  ),
  (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Mangrove Tour',
    'mangrove-tour',
    'Guided mangrove eco-tour with kayaking and wildlife spotting.',
    '[{"min_pax": 1, "max_pax": 8, "price_per_pax": 800}]'::jsonb,
    '{0,1,2,3,4,5,6}',
    15,
    20,
    24,
    false
  );
