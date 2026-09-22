-- Prevent the same payment transaction reference from being submitted twice.
-- Applied to production before this migration was committed.
create unique index if not exists ux_recharge_requests_txn_reference_normalized
on public.recharge_requests (lower(trim(coalesce(txn_reference, txn_id))))
where coalesce(txn_reference, txn_id) is not null
  and length(trim(coalesce(txn_reference, txn_id))) > 0;
