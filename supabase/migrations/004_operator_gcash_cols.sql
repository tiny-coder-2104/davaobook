-- ============================================================================
-- DavaoBook — GCash / SMS columns for operators
-- Adds: gcash_number (text), gcash_qr_url (text), sms_sender_id (text)
-- Idempotent: each ALTER guarded by an information_schema column check.
-- Re-appliable: safe to run repeatedly; all columns are nullable so existing
-- rows (e.g. the seeded demo operator) backfill NULL on first apply.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. gcash_number text (nullable)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'operators'
      AND column_name  = 'gcash_number'
  ) THEN
    ALTER TABLE operators
      ADD COLUMN gcash_number text;
  END IF;
END
$$;

-- ----------------------------------------------------------------------------
-- 2. gcash_qr_url text (nullable)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'operators'
      AND column_name  = 'gcash_qr_url'
  ) THEN
    ALTER TABLE operators
      ADD COLUMN gcash_qr_url text;
  END IF;
END
$$;

-- ----------------------------------------------------------------------------
-- 3. sms_sender_id text (nullable) — operator Semaphore SMS sender ID
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'operators'
      AND column_name  = 'sms_sender_id'
  ) THEN
    ALTER TABLE operators
      ADD COLUMN sms_sender_id text;
  END IF;
END
$$;
