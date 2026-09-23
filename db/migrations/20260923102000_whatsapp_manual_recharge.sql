-- WhatsApp manual recharge configuration is stored in the existing payments app_kv JSON.
-- Seed explicit defaults without changing existing payment credentials.
update public.app_kv
set value = coalesce(value, '{}'::jsonb) || jsonb_build_object(
  'whatsappRechargeEnabled', coalesce((value->>'whatsappRechargeEnabled')::boolean, true),
  'whatsappRechargeNumber', coalesce(value->>'whatsappRechargeNumber', '')
)
where key = 'payments';
