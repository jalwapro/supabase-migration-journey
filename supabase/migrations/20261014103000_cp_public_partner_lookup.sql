-- Safe read-only lookup for displaying a user's active CP partner on public surfaces.
begin;
create or replace function public.cp_public_partner(p_user_id uuid)
returns table(partner_id uuid, partner_username text, partner_avatar text)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_user_id is null then return; end if;
  return query
    select partner.id, partner.username, partner.avatar
    from public.cp_relations relation
    join public.profiles partner
      on partner.id = case
        when relation.user1_id = p_user_id then relation.user2_id
        else relation.user1_id
      end
    where relation.status='active'
      and p_user_id in (relation.user1_id, relation.user2_id)
    limit 1;
end $$;
revoke all on function public.cp_public_partner(uuid) from public, anon;
grant execute on function public.cp_public_partner(uuid) to authenticated;
commit;
