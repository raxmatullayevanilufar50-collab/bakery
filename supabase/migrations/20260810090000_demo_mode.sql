-- Ochiq demo rejimi (portfolio uchun).
--
-- Demo — alohida loyiha emas, ayni shu bazadagi alohida KOMPANIYA.
-- Izolyatsiya allaqachon mavjud RLS orqali ta'minlanadi: har bir so'rov
-- get_my_company_id() bilan cheklangan, ya'ni demo hisob boshqa
-- kompaniyaning birorta qatorini ko'ra olmaydi.
--
-- Demo hisobning paroli frontend bundle'ida ochiq turadi — bu ataylab
-- shunday, chunki maqsad kodsiz kirish. Shuning uchun himoya sir
-- saqlashga emas, BAZA darajasidagi yozish taqiqiga tayanadi: demo
-- kompaniyaga tegishli foydalanuvchi hech qanday jadvalga yoza olmaydi,
-- hatto brauzer konsolidan to'g'ridan-to'g'ri so'rov yuborsa ham.

alter table companies add column if not exists is_demo boolean not null default false;

-- Joriy foydalanuvchi demo kompaniyaga tegishlimi.
create or replace function is_demo_session()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select c.is_demo from companies c where c.id = get_my_company_id()), false)
$$;

grant execute on function is_demo_session() to authenticated;

create or replace function block_demo_writes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_demo_session() then
    raise exception 'Demo rejimida ma''lumotni o''zgartirib bo''lmaydi';
  end if;
  return null;
end;
$$;

-- Statement-level trigger: qator boshiga emas, so'rov boshiga bir marta
-- ishlaydi, shuning uchun oddiy ishlashga sezilarli yuk qo'shmaydi.
--
-- devices va audit_logs ataylab ro'yxatda YO'Q: birinchisi demo uchun
-- mijoz tomonda umuman chaqirilmaydi, ikkinchisi esa faqat SECURITY
-- DEFINER funksiyalar ichidan yoziladi va audit izini yo'qotmaslik
-- kerak.
do $$
declare
  t text;
  tables text[] := array[
    'companies', 'profiles', 'invites', 'products', 'production_tasks',
    'production_logs', 'inventory_items', 'product_ingredients',
    'inventory_price_history', 'price_recommendations', 'demand_forecasts',
    'orders', 'order_items', 'shifts', 'sales', 'display_inventory',
    'pre_orders', 'pre_order_items', 'daily_reports'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists trg_block_demo_writes on public.%I', t);
      execute format(
        'create trigger trg_block_demo_writes
           before insert or update or delete on public.%I
           for each statement execute function block_demo_writes()', t);
    end if;
  end loop;
end;
$$;
