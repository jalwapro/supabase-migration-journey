-- 0263 — Support auto-reply bot
-- Adds bot sender type and keyword replies to the existing live support chat.

alter table public.support_messages
  drop constraint if exists support_messages_sender_kind_check;

alter table public.support_messages
  add constraint support_messages_sender_kind_check
  check (sender_kind in ('user','agent','bot'));

create or replace function public.support_auto_reply(_conversation_id uuid, _user_id uuid, _body text)
returns void language plpgsql security definer set search_path=public as $$
declare b text:=lower(trim(_body)); reply text; owner_id uuid;
begin
 if auth.uid() is null or auth.uid() <> _user_id then raise exception 'not authorized'; end if;
 select user_id into owner_id from public.support_conversations where id=_conversation_id;
 if owner_id <> _user_id then raise exception 'not authorized'; end if;
 if b ~ E'\\m(hi|hello|hey|salam|assalam|help|support)\\M' then
   reply := 'Assalam-o-Alaikum! 👋 JALWA Support Bot yahan hai. Recharge, coins, withdrawal, payment, gifts, voice room, login ya account ke bare mein pooch sakte hain. Agar aapka masla bot solve na kar sake to admin aapko live reply karega.';
 elsif b ~ E'\\m(recharge|recharge coins|coins|coin|topup|top up)\\M' then
   reply := 'Aap Recharge Coins page par ja kar apna package select karein aur WhatsApp ya manual method se payment verify karwayein.';
 elsif b ~ E'\\m(withdraw|withdrawal|cashout|cash out|payout)\\M' then
   reply := 'Aap withdrawal request section mein ja kar apni details enter karein, admin jald process kar dega.';
 elsif b ~ E'\\m(payment|easypaisa|jazzcash|qr|till|transaction|tid)\\M' then
   reply := 'Payment ke liye Recharge Coins page par package select karein, official Easypaisa/JazzCash app se payment karein, phir required transaction/TID aur proof submit karein. PIN kabhi JALWA ko share na karein.';
 elsif b ~ E'\\m(gift|gifts|gift video|gift animation)\\M' then
   reply := 'Voice Room mein Gift button se gift select karke send karein. Agar gift ya animation show na ho to room name, gift name aur screenshot bhej dein; zaroorat par admin live check karega.';
 elsif b ~ E'\\m(room|voice room|seat|mic|microphone|speaker|audio)\\M' then
   reply := 'Voice Room mein seat, microphone aur audio controls available hain. Agar seat request, mic, audio ya room connection ka issue ho to room ka naam aur problem detail bhej dein.';
 elsif b ~ E'\\m(login|google|sign in|signin|account|password)\\M' then
   reply := 'Login issue ke liye apna exact error message bhej dein. Google Login issue mein Google account selection aur app/device information bhi share karein.';
 elsif b ~ E'\\m(profile|username|avatar|dp|frame|theme)\\M' then
   reply := 'Profile, DP, frame aur theme settings profile/theme sections se manage ki ja sakti hain. Agar change save na ho to screenshot bhej dein.';
 elsif b ~ E'\\m(report|complaint|ban|blocked|block|fraud|scam)\\M' then
   reply := 'Report ya complaint ke liye user/room ka naam, relevant ID aur issue ki details bhej dein. Sensitive information ya payment PIN share na karein; admin case review karega.';
 elsif b ~ E'\\m(ticket|admin|agent|human|person|live support)\\M' then
   reply := 'Aapka message support admin ko live bhej diya gaya hai. Admin isi chat mein reply karega.';
 else return; end if;
 insert into public.support_messages(conversation_id,sender_id,sender_kind,body)
 values(_conversation_id,_user_id,'bot',reply);
end $$;

revoke all on function public.support_auto_reply(uuid, uuid, text) from public;
grant execute on function public.support_auto_reply(uuid, uuid, text) to authenticated;

create or replace function public._support_auto_reply_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sender_kind = 'user' then
    perform public.support_auto_reply(new.conversation_id, new.sender_id, new.body);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_support_auto_reply on public.support_messages;
create trigger trg_support_auto_reply
  after insert on public.support_messages
  for each row execute function public._support_auto_reply_trigger();

create or replace function public._support_after_msg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.support_conversations
     set last_message_at = new.created_at,
         last_message_preview = left(new.body, 140),
         status = 'open',
         unread_for_user = case
           when new.sender_kind in ('agent','bot') then unread_for_user + 1
           else 0
         end,
         unread_for_agent = case
           when new.sender_kind = 'user' then unread_for_agent + 1
           else unread_for_agent
         end
   where id = new.conversation_id;
  return new;
end;
$$;

notify pgrst, 'reload schema';
