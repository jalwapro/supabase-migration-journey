-- Ledger participants can see the transaction and entries affecting their own wallet/inventory.
drop policy if exists "coin economy transactions read own or admin" on public.coin_economy_transactions;
create policy "coin economy transactions read own or admin" on public.coin_economy_transactions
for select to authenticated using (
  actor_id = auth.uid()
  or public.is_admin(auth.uid())
  or metadata #>> '{result,recipient_id}' = auth.uid()::text
  or metadata #>> '{result,buyer_id}' = auth.uid()::text
  or metadata->>'agent_id' = auth.uid()::text
);
drop policy if exists "coin economy entries read via own transaction" on public.coin_economy_entries;
create policy "coin economy entries read via own transaction" on public.coin_economy_entries
for select to authenticated using (
  account_id = auth.uid()
  or exists (select 1 from public.coin_economy_transactions t where t.id = transaction_id and t.actor_id = auth.uid())
  or public.is_admin(auth.uid())
);
