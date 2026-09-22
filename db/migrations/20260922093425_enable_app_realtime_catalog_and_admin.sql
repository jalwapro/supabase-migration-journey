-- Enable Realtime for app catalog, admin and low-frequency shared tables.
-- High-frequency room streams remain on their dedicated room channels.
do $$
declare
  t text;
  tables text[] := array[
    'profiles','user_roles','coin_packages','recharge_requests','banners','payment_accounts',
    'gifts','gift_categories','gallery_images','gallery_unlocks','themes','user_themes','vip_tiers',
    'withdrawal_requests','dp_frames','user_frames','room_backgrounds','ads','cms_pages','support_tickets',
    'user_reports','admin_logs','theme_categories','partners','categories','friendships','games','game_rounds',
    'families','family_members','vip_level_config','vip_rewards_claimed','vip_level_events','custom_themes',
    'spin_prizes','daily_spins','pk_invites','pk_matches','recharge_orders','seat_requests','pk_champions',
    'room_bans','profile_views','support_conversations','support_messages','spotlight_animations',
    'spotlight_triggers','room_top_frames','entrance_effects','user_entrance_effects','entrance_purchases',
    'profile_cards','user_profile_cards','profile_card_purchases','room_gift_goals','gift_goal_settings',
    'mini_games','mini_game_sessions','mini_game_stats','mini_game_flags','ludo_matches','ludo_match_events',
    'support_room_config','support_hosts','support_room_sessions','support_room_seats','support_room_queue',
    'support_room_logs','asset_favorites','gift_render_presets','slots_config','slots_jackpot','slots_free_spins',
    'slots_spins','casino_games','casino_bets','room_games','app_customization_pages','app_customization_sections',
    'app_customization_components','app_customization_themes','app_customization_assets',
    'app_customization_navigation','app_customization_layouts','app_customization_versions',
    'app_customization_drafts','app_customization_published','app_customization_change_log',
    'payment_gateway_configs','payment_gateway_transactions','admin_payment_2fa','app_studio_documents',
    'app_studio_design_tokens','platform_events','platform_event_participants','room_slides',
    'host_popularity_stats','card_recharge_orders'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is not null
       and not exists (
         select 1 from pg_publication_tables
         where pubname='supabase_realtime' and schemaname='public' and tablename=t
       ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;