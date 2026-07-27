-- Postgres'da jadval yaratilganda boshqa rollarga (authenticated) hech qanday
-- avtomatik ruxsat berilmaydi — RLS siyosati bo'lsa ham, avval oddiy GRANT
-- talab qilinadi (RLS "qaysi qatorlar", GRANT esa "qaysi amal" savoliga javob
-- beradi; ikkalasi ham o'tishi kerak). Bu yerda authenticated rolga barcha
-- jadvallarga keng GRANT beriladi — haqiqiy cheklov 20260724100400 dagi RLS
-- siyosatlari orqali amalga oshadi (masalan profiles'da INSERT siyosati
-- yo'q, shuning uchun GRANT INSERT bo'lsa ham to'g'ridan-to'g'ri INSERT RLS
-- tomonidan rad etiladi).
--
-- anon rolga (hali tizimga kirmagan foydalanuvchi) hech qanday jadval
-- ruxsati berilmaydi — ilova avtorizatsiyasiz hech qanday jadvalni
-- so'ramaydi, faqat Supabase Auth API orqali ishlaydi.

grant usage on schema public to authenticated;

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
  order_items
to authenticated;
