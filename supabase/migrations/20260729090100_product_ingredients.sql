-- Retsept (BOM): mahsulot tayyorlash uchun qancha xomashyo ketishi.
-- 3-bosqichdagi (ingredient narxi -> narx tavsiyasi) va 2-xususiyatdagi
-- (ovozli pishirish qaydi -> xomashyo real vaqtda kamayishi) ikkala
-- xususiyat ham shu jadvalga tayanadi.
create table product_ingredients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  quantity_per_unit numeric(12, 4) not null check (quantity_per_unit > 0),
  created_at timestamptz not null default now(),
  unique (product_id, inventory_item_id)
);

create index product_ingredients_product_id_idx on product_ingredients(product_id);

alter table product_ingredients enable row level security;

create policy "product_ingredients_select_own_company" on product_ingredients
  for select
  using (company_id = get_my_company_id());

create policy "product_ingredients_write_owner_manager" on product_ingredients
  for all
  using (company_id = get_my_company_id() and get_my_role() in ('owner', 'manager'))
  with check (company_id = get_my_company_id() and get_my_role() in ('owner', 'manager'));

grant select, insert, update, delete on product_ingredients to authenticated;
grant select, insert, update, delete on product_ingredients to service_role;

-- Pishirish qaydi (production_logs, "N dona pishirdim") kiritilganda
-- retsept bo'yicha xomashyo avtomatik kamayadi. Savdo emas, aynan
-- pishirish momentida kamayadi — xomashyo tayyor mahsulot pishirilganda
-- sarflanadi, keyin sotilganda emas.
--
-- SECURITY DEFINER: Baker'ning inventory_items'ga bevosita SELECT/UPDATE
-- huquqi yo'q va bu o'zgarmaydi (inventory_items_write_owner_manager,
-- 20260724100400) — bu trigger nazorat ostidagi YAGONA teshik: faqat
-- aniq bitta formula bo'yicha, faqat retseptda ko'rsatilgan miqdorda
-- kamaytiradi. Zaxira manfiy bo'lib qolishi mumkin (ataylab bloklanmagan)
-- — bu chalasi kiritilgan retsept yoki eskirgan hisobni ko'rsatuvchi
-- signal, mavjud low_stock_threshold/badge mexanizmi buni ko'rsatadi.
create or replace function apply_production_log_inventory_impact()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update inventory_items ii
  set quantity = ii.quantity - (pi.quantity_per_unit * new.quantity)
  from product_ingredients pi
  where pi.product_id = new.product_id
    and pi.inventory_item_id = ii.id;
  return new;
end;
$$;

create trigger trg_production_log_inventory_impact
  after insert on production_logs
  for each row execute function apply_production_log_inventory_impact();

-- Ko'p qurilmali sinxronizatsiya (4-bo'lim, 8-talab) — savdo va pishirish
-- qaydlari endi real vaqtda uzatiladi, xuddi production_tasks/orders/
-- inventory_items/shifts kabi (20260724100900_realtime.sql). Bu ovozli
-- kiritilgan yozuvning barcha ekranlarda (masalan Owner'ning Hisobotlar
-- yoki Ombor bo'limida) zudlik bilan ko'rinishini ta'minlaydi.
alter publication supabase_realtime add table sales;
alter publication supabase_realtime add table production_logs;
