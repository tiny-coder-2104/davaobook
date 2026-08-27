-- ============================================================================
-- DavaoBook — Account Hub columns for operators
-- Adds: notification_prefs (jsonb), brand_color (text)
-- Idempotent: each ALTER guarded by an information_schema column check.
-- Re-appliable: safe to run repeatedly; ALTER with DEFAULT backfills existing
-- rows (e.g. the seeded demo operator) on first apply.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. notification_prefs jsonb NOT NULL DEFAULT {...}
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'operators'
      AND column_name  = 'notification_prefs'
  ) THEN
    ALTER TABLE operators
      ADD COLUMN notification_prefs jsonb NOT NULL
      DEFAULT '{"new_booking":true,"payment_received":true,"weather_cancel":true,"reminders":true,"email_digest":false}'::jsonb;
  END IF;
END
$$;

-- ----------------------------------------------------------------------------
-- 2. brand_color text (nullable)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'operators'
      AND column_name  = 'brand_color'
  ) THEN
    ALTER TABLE operators
      ADD COLUMN brand_color text;
  END IF;
END
$$;
