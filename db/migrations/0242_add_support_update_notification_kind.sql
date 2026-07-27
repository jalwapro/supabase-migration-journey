-- Add missing 'support_update' value to notification_kind enum.
-- Referenced by close_support_conversation. Discovered via tests/e2e/flows.test.sql.

ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'support_update';
