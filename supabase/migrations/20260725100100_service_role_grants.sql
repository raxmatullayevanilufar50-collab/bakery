-- Edge Function'larimiz (create-employee, pin-auth) SUPABASE_SERVICE_ROLE_KEY
-- bilan ishlaydi — bu Postgres darajasida "service_role" nomli alohida
-- rol. RLS'ni chetlab o'tsa ham (BYPASSRLS), oddiy jadval darajasidagi
-- GRANT'lardan mustasno emas — xuddi "authenticated" uchun avval
-- (20260724100600_grants.sql'da) unutilgani kabi, bu safar "service_role"
-- uchun ham unutilgan edi. Natijada "permission denied for table profiles"
-- xatosi chiqdi.

grant usage on schema public to service_role;

grant select, insert, update, delete on
  companies,
  profiles,
  invites,
  pin_attempts,
  audit_logs,
  devices,
  shifts,
  products,
  production_tasks,
  inventory_items,
  orders,
  order_items,
  sales,
  production_logs
to service_role;
