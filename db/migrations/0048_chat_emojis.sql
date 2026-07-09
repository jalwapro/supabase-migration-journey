-- Animated chat emojis: catalog + realtime send events.
-- Used from DM threads and live rooms. Each send is an event row that both
-- the sender and the receiver (or all room viewers) render as a full-screen
-- animation via realtime postgres_changes.

-- 1) Catalog
create table if not exists public.chat_emojis (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  emoji       text not null,
  name        text not null,
  category    text not null default 'popular',
  clip_path   text not null,               -- /animations/emojis/<slug>.svg
  sort_order  int  not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

grant select on public.chat_emojis to anon, authenticated;
grant all    on public.chat_emojis to service_role;

alter table public.chat_emojis enable row level security;
drop policy if exists "chat_emojis read" on public.chat_emojis;
create policy "chat_emojis read" on public.chat_emojis
  for select using (is_active = true);

-- 2) Events (send instances)
create table if not exists public.chat_emoji_sends (
  id            uuid primary key default gen_random_uuid(),
  sender_id     uuid not null references auth.users(id) on delete cascade,
  recipient_id  uuid          references auth.users(id) on delete cascade, -- null for room broadcasts
  room_id       uuid          references public.rooms(id) on delete cascade,
  emoji_slug    text not null references public.chat_emojis(slug) on update cascade,
  emoji_char    text not null,
  emoji_name    text not null,
  clip_path     text not null,
  created_at    timestamptz not null default now(),
  check (recipient_id is not null or room_id is not null)
);

create index if not exists chat_emoji_sends_recipient_idx on public.chat_emoji_sends(recipient_id, created_at desc);
create index if not exists chat_emoji_sends_sender_idx    on public.chat_emoji_sends(sender_id,    created_at desc);
create index if not exists chat_emoji_sends_room_idx      on public.chat_emoji_sends(room_id,      created_at desc);

grant select, insert on public.chat_emoji_sends to authenticated;
grant all            on public.chat_emoji_sends to service_role;

alter table public.chat_emoji_sends enable row level security;

drop policy if exists "emoji_sends insert own" on public.chat_emoji_sends;
create policy "emoji_sends insert own" on public.chat_emoji_sends
  for insert to authenticated
  with check (sender_id = auth.uid());

drop policy if exists "emoji_sends read own or room" on public.chat_emoji_sends;
create policy "emoji_sends read own or room" on public.chat_emoji_sends
  for select to authenticated
  using (
    sender_id = auth.uid()
    or recipient_id = auth.uid()
    or room_id is not null   -- rooms are public streams; viewers may render
  );

-- 3) Realtime publication
do $$
begin
  begin
    execute 'alter publication supabase_realtime add table public.chat_emoji_sends';
  exception when duplicate_object then null;
  end;
end$$;

-- 4) Seed 50 emojis (matches src/lib/chat-emojis.catalog.json)
insert into public.chat_emojis (slug, emoji, name, category, clip_path, sort_order) values
  ('hammer','🔨','Hammer','action',  '/animations/emojis/hammer.svg',       1),
  ('heart','❤️','Heart','love',      '/animations/emojis/heart.svg',        2),
  ('slap','🖐️','Slap','action',       '/animations/emojis/slap.svg',         3),
  ('kiss','💋','Kiss','love',         '/animations/emojis/kiss.svg',         4),
  ('rose','🌹','Rose','love',         '/animations/emojis/rose.svg',         5),
  ('laugh','😂','Laugh','funny',      '/animations/emojis/laugh.svg',        6),
  ('cry','😭','Cry','funny',          '/animations/emojis/cry.svg',          7),
  ('angry','😡','Angry','funny',      '/animations/emojis/angry.svg',        8),
  ('love-eyes','😍','Love Eyes','love','/animations/emojis/love-eyes.svg',   9),
  ('wink','😉','Wink','funny',        '/animations/emojis/wink.svg',        10),
  ('cool','😎','Cool','funny',        '/animations/emojis/cool.svg',        11),
  ('crown','👑','Crown','magic',      '/animations/emojis/crown.svg',       12),
  ('fire','🔥','Fire','action',       '/animations/emojis/fire.svg',        13),
  ('star','⭐','Star','magic',        '/animations/emojis/star.svg',        14),
  ('clap','👏','Clap','action',       '/animations/emojis/clap.svg',        15),
  ('thumbs-up','👍','Thumbs Up','action','/animations/emojis/thumbs-up.svg',16),
  ('thumbs-down','👎','Thumbs Down','funny','/animations/emojis/thumbs-down.svg',17),
  ('muscle','💪','Muscle','action',   '/animations/emojis/muscle.svg',      18),
  ('pray','🙏','Pray','cute',         '/animations/emojis/pray.svg',        19),
  ('wave','👋','Wave','cute',         '/animations/emojis/wave.svg',        20),
  ('peace','✌️','Peace','cute',        '/animations/emojis/peace.svg',       21),
  ('ok','👌','OK','cute',             '/animations/emojis/ok.svg',          22),
  ('rocket','🚀','Rocket','action',   '/animations/emojis/rocket.svg',      23),
  ('boom','💥','Boom','action',       '/animations/emojis/boom.svg',        24),
  ('princess','👸','Princess','magic','/animations/emojis/princess.svg',    25),
  ('diamond','💎','Diamond','magic',  '/animations/emojis/diamond.svg',     26),
  ('money','💰','Money','party',      '/animations/emojis/money.svg',       27),
  ('gift','🎁','Gift','party',        '/animations/emojis/gift.svg',        28),
  ('cake','🎂','Cake','party',        '/animations/emojis/cake.svg',        29),
  ('balloon','🎈','Balloon','party',  '/animations/emojis/balloon.svg',     30),
  ('party','🥳','Party','party',      '/animations/emojis/party.svg',       31),
  ('confetti','🎉','Confetti','party','/animations/emojis/confetti.svg',    32),
  ('music','🎵','Music','magic',      '/animations/emojis/music.svg',       33),
  ('mic','🎤','Mic','magic',          '/animations/emojis/mic.svg',         34),
  ('ghost','👻','Ghost','funny',      '/animations/emojis/ghost.svg',       35),
  ('skull','💀','Skull','funny',      '/animations/emojis/skull.svg',       36),
  ('devil','😈','Devil','funny',      '/animations/emojis/devil.svg',       37),
  ('angel','😇','Angel','cute',       '/animations/emojis/angel.svg',       38),
  ('sleepy','😴','Sleepy','cute',     '/animations/emojis/sleepy.svg',      39),
  ('thinking','🤔','Thinking','funny','/animations/emojis/thinking.svg',    40),
  ('shock','😱','Shock','funny',      '/animations/emojis/shock.svg',       41),
  ('sick','🤢','Sick','funny',        '/animations/emojis/sick.svg',        42),
  ('mask','😷','Mask','cute',         '/animations/emojis/mask.svg',        43),
  ('sun','🌞','Sun','magic',          '/animations/emojis/sun.svg',         44),
  ('moon','🌙','Moon','magic',        '/animations/emojis/moon.svg',        45),
  ('rainbow','🌈','Rainbow','magic',  '/animations/emojis/rainbow.svg',     46),
  ('cloud','☁️','Cloud','cute',        '/animations/emojis/cloud.svg',       47),
  ('flower','🌸','Flower','love',     '/animations/emojis/flower.svg',      48),
  ('clover','🍀','Clover','magic',    '/animations/emojis/clover.svg',      49),
  ('cat','😺','Cat','cute','/animations/emojis/cat.svg', 50)
on conflict (slug) do update
  set emoji=excluded.emoji,
      name=excluded.name,
      category=excluded.category,
      clip_path=excluded.clip_path,
      sort_order=excluded.sort_order,
      is_active=true;

notify pgrst, 'reload schema';
