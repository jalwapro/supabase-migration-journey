## Room upgrade — 8 changes

### 1. Chat: single feed (no tabs)
- Header title row se `All / Chat` tabs hata do (dono jagah — main chat & bottom sheet)
- Ek hi feed jisme sab kuch aaye: welcome/join, chat, gift, system
- Emoji reactions abhi bhi feed se filtered rahengi (screen pe animate hoti hain)

### 2. Auto-scroll on new message
- `useEffect` + `messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })` jab bhi `messages.length` change ho
- Chat list ko `flex-col` (top-down) rakhna — naya message niche
- Entry banner already screen ke top-left overlay hai, wo top pe hi rahega

### 3. Host title ke aage ❤ hata do → Follow button
- Line 788 ka `💖` remove
- Uski jagah chhota `+` follow chip: not-following → gradient `+` icon (click = follow), following → **black heart** icon
- Alag "+ FOLLOW" button (right side, line 824) bhi hata do — ek hi jagah rahega

### 4. Black heart → daily 100-coin love (premium)
- Follow ke baad: black heart button
- Click → 100 coins deduct, host ki popularity +1, host ko notification, heart **red blink 3s** phir back to black-with-timer
- Same din dobara click block; **24hr baad** automatically dobara available (black heart re-enabled)
- Tooltip: "Daily love · 100 coins"

### 5. Family = Premium (badge)
- Existing "👑 FAMILY" button ko "👑 PREMIUM" label + gold gradient border stronger
- Family members ko room me name ke aage 👑 badge

### 6. Emoji bar: hide empty seats
- Current bar sab 8 seats dikhata hai
- Only seated members (`seats.filter(s => s.user_id)`) ki DP chip render karo

### 7. GiftSheet: only seated DPs (already done) — verify
- `receivers` prop already sirf seated users pass hota hai. Confirm and ensure "All" chip visible jab >1 seated ho ✅ (already implemented)

### 8. Gift to All + selected
- Already `sendToAll` toggle hai. UI polish: "All" chip pehli position pe, active state gold ring — already OK

---

### DB migration (`db/migrations/0036_daily_host_love.sql`)
```sql
create table if not exists public.host_love_hearts (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users(id) on delete cascade,
  to_host  uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index on public.host_love_hearts(from_user, to_host, created_at desc);

grant select, insert on public.host_love_hearts to authenticated;
grant all on public.host_love_hearts to service_role;
alter table public.host_love_hearts enable row level security;
create policy "love read own or host"
  on public.host_love_hearts for select to authenticated
  using (from_user = auth.uid() or to_host = auth.uid());
create policy "love insert self"
  on public.host_love_hearts for insert to authenticated
  with check (from_user = auth.uid());

create or replace function public.send_host_love(_host uuid)
returns table(next_available_at timestamptz)
language plpgsql security definer set search_path=public
as $$
declare
  me uuid := auth.uid();
  last timestamptz;
  cost int := 100;
begin
  if me is null then raise exception 'auth required'; end if;
  if me = _host then raise exception 'cannot love self'; end if;

  select max(created_at) into last
    from host_love_hearts
    where from_user = me and to_host = _host;
  if last is not null and last > now() - interval '24 hours' then
    raise exception 'already loved today';
  end if;

  update profiles set coins = coins - cost
    where id = me and coins >= cost;
  if not found then raise exception 'insufficient coins'; end if;

  update profiles set diamonds = diamonds + 1, popularity = coalesce(popularity,0) + 1
    where id = _host;

  insert into host_love_hearts(from_user, to_host) values (me, _host);
  return query select (now() + interval '24 hours');
end;
$$;
grant execute on function public.send_host_love(uuid) to authenticated;
```

### Files touched
- `db/migrations/0036_daily_host_love.sql` (new)
- `src/routes/room.$roomId.tsx` — chat tabs remove, auto-scroll, heart-follow button, emoji bar filter, header polish
- Confirm no changes needed in `GiftSheet.tsx` (already DP-only + All)

Shuru karun?
