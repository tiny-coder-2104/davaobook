-- ============================================================================
-- DavaoBook — 008: guest-visible cancellation reason (QA davaobook-0038)
--
-- POST /api/admin/weather-cancel sets status CANCELLED, which was
-- indistinguishable from a plain operator cancel on the guest status page
-- (app/b/[code]/page.tsx showed only "Cancelled"; the typhoon reason existed
-- only in the outbound SMS).
--
-- Minimal fix, no status-enum change:
--   * new nullable column cancelled_reason
--   * weather-cancel writes cancelled_reason = 'WEATHER' in the same UPDATE
--     as status (app/api/admin/weather-cancel/route.ts)
--   * plain operator cancel (app/api/admin/bookings/[id]/route.ts action=cancel)
--     leaves it NULL — guest page keeps today's presentation for those
--
-- No backfill: the only CANCELLED row in prod is ISLAN-0914-J (plain cancel).
-- ============================================================================

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_reason text;
