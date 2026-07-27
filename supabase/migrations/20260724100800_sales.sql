-- Kassa/Sotuvchi (Cashier) uchun kunlik savdo yozuvlari. Asl 6-bo'lim
-- sxemasida bu jadval yo'q edi — orders jadvali yetkazib berish
-- buyurtmalari uchun (haydovchi, manzil), Cashier esa do'kondagi
-- to'g'ridan-to'g'ri sotuvni qayd qiladi (3-bo'lim: "Sotuv qayd qilish,
-- chek chiqarish", "faqat o'z smenasi savdosini ko'radi").

create table sales (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  cashier_id uuid not null references profiles(id),
  product_id uuid not null references products(id),
  quantity numeric(12, 2) not null check (quantity > 0),
  unit_price numeric(12, 2) not null,
  total numeric(12, 2) not null,
  created_at timestamptz not null default now()
);

create index sales_company_id_created_at_idx on sales(company_id, created_at desc);
create index sales_cashier_id_idx on sales(cashier_id);

alter table sales enable row level security;

-- Owner — kompaniyaning barcha savdosini ko'radi (moliyaviy ma'lumot).
-- Cashier — faqat o'zi qayd qilgan savdolarni ko'radi (3-bo'lim talabi).
-- Manager umuman ko'rmaydi — moliyaviy hisobot Manager uchun yopiq (3-bo'lim).
create policy "sales_select_owner_or_own_cashier" on sales
  for select
  using (
    company_id = get_my_company_id()
    and (get_my_role() = 'owner' or (get_my_role() = 'cashier' and cashier_id = auth.uid()))
  );

create policy "sales_insert_own_cashier" on sales
  for insert
  with check (
    company_id = get_my_company_id()
    and get_my_role() = 'cashier'
    and cashier_id = auth.uid()
  );
-- UPDATE/DELETE: yo'q — sotuv yozuvi o'zgarmas (chek kabi).

grant select, insert on sales to authenticated;
