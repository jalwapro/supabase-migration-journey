-- Add a dedicated wallet transaction type for seller-delivered coins.
-- Kept in its own migration so the new enum value is committed before use.
ALTER TYPE public.wallet_tx_kind ADD VALUE IF NOT EXISTS 'seller_transfer';
