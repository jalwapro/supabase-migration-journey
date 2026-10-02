-- Push webhook authentication configuration.
-- The private secret row and webhook trigger are installed directly in production.
-- This migration records the same durable schema/config for future database restores.

create schema if not exists private;

create table if not exists private.push_webhook_config (
  id boolean primary key default true check (id),
  secret_hash text not null,
  updated_at timestamptz not null default now()
);

alter table private.push_webhook_config enable row level security;
revoke all on private.push_webhook_config from anon, authenticated;

-- Do not store the plaintext webhook secret in source control.
