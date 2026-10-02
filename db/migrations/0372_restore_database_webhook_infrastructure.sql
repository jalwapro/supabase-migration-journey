-- Restore Supabase Database Webhook infrastructure after pg_net was missing.
-- This is intentionally idempotent because managed projects may already contain
-- parts of the webhook system.

create extension if not exists pg_net with schema extensions;

create schema if not exists supabase_functions;
grant usage on schema supabase_functions to postgres, anon, authenticated, service_role, supabase_functions_admin;

create table if not exists supabase_functions.migrations (
  version text primary key,
  inserted_at timestamptz not null default now()
);

insert into supabase_functions.migrations(version)
values ('initial')
on conflict (version) do nothing;

create table if not exists supabase_functions.hooks (
  id bigserial primary key,
  hook_table_id integer not null,
  hook_name text not null,
  created_at timestamptz not null default now(),
  request_id bigint
);

create index if not exists supabase_functions_hooks_request_id_idx
  on supabase_functions.hooks(request_id);

create index if not exists supabase_functions_hooks_h_table_id_h_name_idx
  on supabase_functions.hooks(hook_table_id, hook_name);

create or replace function supabase_functions.http_request()
returns trigger
language plpgsql
security definer
set search_path = supabase_functions
as $function$
declare
  request_id bigint;
  payload jsonb;
  url text := TG_ARGV[0]::text;
  method text := TG_ARGV[1]::text;
  headers jsonb default '{}'::jsonb;
  params jsonb default '{}'::jsonb;
  timeout_ms integer default 1000;
begin
  if url is null or url = 'null' then
    raise exception 'url argument is missing';
  end if;

  if method is null or method = 'null' then
    raise exception 'method argument is missing';
  end if;

  if TG_ARGV[2] is null or TG_ARGV[2] = 'null' then
    headers := '{"Content-Type":"application/json"}'::jsonb;
  else
    headers := TG_ARGV[2]::jsonb;
  end if;

  if TG_ARGV[3] is null or TG_ARGV[3] = 'null' then
    params := '{}'::jsonb;
  else
    params := TG_ARGV[3]::jsonb;
  end if;

  if TG_ARGV[4] is null or TG_ARGV[4] = 'null' then
    timeout_ms := 1000;
  else
    timeout_ms := TG_ARGV[4]::integer;
  end if;

  case
    when method = 'GET' then
      select http_get into request_id
      from net.http_get(url, params, headers, timeout_ms);
    when method = 'POST' then
      payload := jsonb_build_object(
        'old_record', OLD,
        'record', NEW,
        'type', TG_OP,
        'table', TG_TABLE_NAME,
        'schema', TG_TABLE_SCHEMA
      );
      select http_post into request_id
      from net.http_post(url, payload, params, headers, timeout_ms);
    else
      raise exception 'method argument % is invalid', method;
  end case;

  insert into supabase_functions.hooks(hook_table_id, hook_name, request_id)
  values (TG_RELID, TG_NAME, request_id);

  return NEW;
end
$function$;

grant all on schema supabase_functions to supabase_functions_admin;
grant all on all tables in schema supabase_functions to supabase_functions_admin;
grant all on all sequences in schema supabase_functions to supabase_functions_admin;
grant all on all functions in schema supabase_functions to supabase_functions_admin;
grant execute on function supabase_functions.http_request() to postgres, anon, authenticated, service_role, supabase_functions_admin;

grant usage on schema net to supabase_functions_admin, postgres, anon, authenticated, service_role;
grant execute on function net.http_post(text, jsonb, jsonb, jsonb, integer)
  to supabase_functions_admin, postgres, anon, authenticated, service_role;
grant execute on function net.http_get(text, jsonb, jsonb, integer)
  to supabase_functions_admin, postgres, anon, authenticated, service_role;
