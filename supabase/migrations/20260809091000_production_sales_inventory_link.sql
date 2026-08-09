-- Ombor ↔ ishlab chiqarish ↔ savdo zanjirini yopish.
--
-- Ilgari zanjirning faqat bitta bo'g'ini bog'langan edi:
--
--   [pishirish] --(trigger)--> xomashyo kamayadi        ✅ bor edi
--   [pishirish] -------------> tayyor mahsulot ko'payadi ❌ YO'Q edi
--   [savdo]     -------------> tayyor mahsulot kamayadi  ⚠️ faqat brauzerda
--
-- Ya'ni nonvoy 100 ta non pishirsa, vitrinaga u avtomatik tushmasdi —
-- kimdir "Vitrina" ekranidan qo'lda +100 bosishi kerak edi. Savdo esa
-- vitrinani faqat Kassa ekrani orqali kamaytirardi: ovozli savdo
-- (SalesTab) umuman kamaytirmasdi va ikkita kassir bir vaqtda sotsa
-- hisob adashardi (brauzerdagi eski nusxa ustiga yozilardi).
--
-- Endi uchala harakat ham serverda, bitta tranzaksiya ichida bajariladi.

-- ── 1. Pishirish: xomashyo kamayadi + tayyor mahsulot ko'payadi ───────────
create or replace function apply_production_log_inventory_impact()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Xomashyo (un, yog'...) retsept bo'yicha kamayadi. Retsept kiritilmagan
  -- mahsulot uchun bu UPDATE hech qanday qatorga tegmaydi — xomashyo
  -- kuzatuvi shunchaki ishlamaydi. Retseptlar Ombor → Retseptlar
  -- bo'limida kiritiladi.
  update inventory_items ii
  set quantity = ii.quantity - (pi.quantity_per_unit * new.quantity)
  from product_ingredients pi
  where pi.product_id = new.product_id
    and pi.inventory_item_id = ii.id;

  -- Tayyor mahsulot vitrinaga tushadi. Qator bo'lmasa — yaratiladi.
  insert into display_inventory (company_id, product_id, quantity_available, updated_at)
  values (new.company_id, new.product_id, new.quantity, now())
  on conflict (company_id, product_id) do update
    set quantity_available = display_inventory.quantity_available + excluded.quantity_available,
        updated_at = now();

  return new;
end;
$$;

-- ── 2. Savdo: tayyor mahsulot kamayadi ───────────────────────────────────
-- SECURITY DEFINER: kassir sotganda vitrina hisobi RLS'dan qat'i nazar,
-- har doim va atomik yangilanishi kerak. Bu trigger nazorat ostidagi
-- yagona yo'l — faqat sotilgan miqdorni, faqat o'sha mahsulot uchun
-- kamaytiradi.
--
-- Manfiy qiymat ataylab bloklanmagan: agar -5 chiqsa, bu "sotildi, lekin
-- pishirish qayd qilinmagan yoki vitrina sanog'i eskirgan" degan signal.
-- Nolga qirqib tashlash bu farqni yashirar edi. Kassa ekranida manfiy
-- ham 0 kabi "Tugadi" ko'rinadi, ya'ni ortiqcha sotishga yo'l qo'ymaydi.
-- Xuddi shu falsafa xomashyo uchun 20260729090100 da qabul qilingan.
create or replace function apply_sale_display_inventory_impact()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into display_inventory (company_id, product_id, quantity_available, updated_at)
  values (new.company_id, new.product_id, -new.quantity, now())
  on conflict (company_id, product_id) do update
    set quantity_available = display_inventory.quantity_available + excluded.quantity_available,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_sale_display_inventory_impact on sales;
create trigger trg_sale_display_inventory_impact
  after insert on sales
  for each row execute function apply_sale_display_inventory_impact();

-- Vitrina o'zgarishlari boshqa qurilmalarda ham darhol ko'rinsin
-- (Kassa ekrani allaqachon shu jadvalga obuna bo'ladi).
do $$
begin
  alter publication supabase_realtime add table display_inventory;
exception
  when duplicate_object then null;
end;
$$;
