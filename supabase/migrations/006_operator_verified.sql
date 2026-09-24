-- 006: operator verified badge
ALTER TABLE operators ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;