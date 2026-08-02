-- 0299_audit_indexes.sql
-- Production audit: cover the three foreign keys that had no supporting index.
-- Without these, deleting/updating a referenced gift or admin row forces a
-- sequential scan on the child table, which degrades badly at scale.

CREATE INDEX IF NOT EXISTS idx_room_gift_goals_reward_gift_id
  ON public.room_gift_goals (reward_gift_id)
  WHERE reward_gift_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gift_goal_settings_default_reward_gift_id
  ON public.gift_goal_settings (default_reward_gift_id)
  WHERE default_reward_gift_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_factory_reset_logs_admin_id
  ON public.factory_reset_logs (admin_id);
