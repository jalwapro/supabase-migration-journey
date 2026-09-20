-- Allow gifts to be hard-deleted while preserving gift history and nullable gift references.
-- Historical gift_sends/events remain intact; their gift_id becomes NULL.

alter table public.gift_events drop constraint if exists gift_events_gift_id_fkey;
alter table public.gift_events add constraint gift_events_gift_id_fkey
  foreign key (gift_id) references public.gifts(id) on delete set null;

alter table public.gift_goal_settings drop constraint if exists gift_goal_settings_default_reward_gift_id_fkey;
alter table public.gift_goal_settings add constraint gift_goal_settings_default_reward_gift_id_fkey
  foreign key (default_reward_gift_id) references public.gifts(id) on delete set null;

alter table public.gift_playback_events drop constraint if exists gift_playback_events_gift_id_fkey;
alter table public.gift_playback_events add constraint gift_playback_events_gift_id_fkey
  foreign key (gift_id) references public.gifts(id) on delete set null;

alter table public.gift_sends drop constraint if exists gift_sends_gift_id_fkey;
alter table public.gift_sends add constraint gift_sends_gift_id_fkey
  foreign key (gift_id) references public.gifts(id) on delete set null;

alter table public.live_rooms drop constraint if exists live_rooms_milestone_gift_id_fkey;
alter table public.live_rooms add constraint live_rooms_milestone_gift_id_fkey
  foreign key (milestone_gift_id) references public.gifts(id) on delete set null;

alter table public.room_gift_goals drop constraint if exists room_gift_goals_reward_gift_id_fkey;
alter table public.room_gift_goals add constraint room_gift_goals_reward_gift_id_fkey
  foreign key (reward_gift_id) references public.gifts(id) on delete set null;
