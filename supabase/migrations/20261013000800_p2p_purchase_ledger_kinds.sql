-- Add explicit ledger event types for purchases paid from P2P wallets.
alter type public.p2p_ledger_kind add value if not exists 'coin_spend';
alter type public.p2p_ledger_kind add value if not exists 'diamond_spend';
