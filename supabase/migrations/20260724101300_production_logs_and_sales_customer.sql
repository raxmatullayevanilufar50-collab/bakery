-- Ovozli savdo kiritishda mijoz nomi (ixtiyoriy) endi qayd qilinadi.
alter table sales add column customer_name text;

-- Kunlik ishlab chiqarish qaydi: ishchi o'zi necha dona nima pishirganini
-- erkin qayd qiladi (ovoz/matn orqali). production_tasks'dan farqli —
-- bu Manager/Owner tomonidan OLDINDAN tayinlangan vazifa emas, balki
-- ishchining o'z holatini bir necha marta (ustiga yozilmasdan) qayd etishi.
create table production_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  profile_id uuid not null references profiles(id),
  product_id uuid not null references products(id),
  quantity numeric(12, 2) not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create index production_logs_company_id_created_at_idx on production_logs(company_id, created_at desc);
create index production_logs_profile_id_idx on production_logs(profile_id);

alter table production_logs enable row level security;

grant select, insert on production_logs to authenticated;
