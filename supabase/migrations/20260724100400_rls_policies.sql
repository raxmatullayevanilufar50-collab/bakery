-- Har bir jadval uchun RLS yoqiladi. Yoqilgandan keyin siyosat yozilmagan
-- amal — hech kimga ruxsat berilmaydi (default-deny). Masalan, profiles,
-- companies va invites jadvallarida INSERT siyosati yo'q — bu qasddan:
-- yozuvlar faqat SECURITY DEFINER RPC funksiyalari (create_company,
-- redeem_invite) orqali, ular ichidagi aniq avtorizatsiya tekshiruvlaridan
-- so'ng yaratiladi.

alter table companies enable row level security;
alter table profiles enable row level security;
alter table invites enable row level security;
alter table pin_attempts enable row level security;
alter table audit_logs enable row level security;
alter table devices enable row level security;
alter table shifts enable row level security;
alter table products enable row level security;
alter table production_tasks enable row level security;
alter table inventory_items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

-- ── companies ────────────────────────────────────────────────────────────
create policy "companies_select_own" on companies
  for select
  using (id = get_my_company_id());

create policy "companies_update_owner" on companies
  for update
  using (id = get_my_company_id() and get_my_role() = 'owner')
  with check (id = get_my_company_id() and get_my_role() = 'owner');
-- INSERT: yo'q — faqat create_company() RPC orqali.
-- DELETE: yo'q — kompaniya o'chirilmaydi.

-- ── profiles ─────────────────────────────────────────────────────────────
create policy "profiles_select_company" on profiles
  for select
  using (company_id = get_my_company_id());

-- Har bir xodim o'z ismi/telefonini yangilay oladi; Owner esa kompaniyadagi
-- istalgan profilni. role/company_id/pin_hash/is_active ustunlari baribir
-- trg_protect_profile_columns trigger tomonidan himoyalangan (RPC talab qilinadi).
create policy "profiles_update_self_or_owner" on profiles
  for update
  using (
    id = auth.uid()
    or (company_id = get_my_company_id() and get_my_role() = 'owner')
  )
  with check (
    id = auth.uid()
    or (company_id = get_my_company_id() and get_my_role() = 'owner')
  );
-- INSERT: yo'q — faqat create_company() / redeem_invite() RPC orqali.
-- DELETE: yo'q — xodim o'chirilmaydi, is_active = false qilinadi.

-- ── invites ──────────────────────────────────────────────────────────────
create policy "invites_select_owner_manager" on invites
  for select
  using (company_id = get_my_company_id() and get_my_role() in ('owner', 'manager'));

create policy "invites_insert_owner_manager" on invites
  for insert
  with check (
    company_id = get_my_company_id()
    and get_my_role() in ('owner', 'manager')
    and created_by = auth.uid()
  );
-- UPDATE (used_at/used_by): yo'q — faqat redeem_invite() RPC orqali.
-- DELETE: yo'q.

-- ── pin_attempts ─────────────────────────────────────────────────────────
create policy "pin_attempts_select_self_or_owner" on pin_attempts
  for select
  using (
    profile_id = auth.uid()
    or (
      get_my_role() = 'owner'
      and profile_id in (select id from profiles where company_id = get_my_company_id())
    )
  );
-- INSERT/UPDATE/DELETE: yo'q — faqat verify_pin() RPC orqali yoziladi.

-- ── audit_logs ───────────────────────────────────────────────────────────
create policy "audit_logs_select_owner" on audit_logs
  for select
  using (company_id = get_my_company_id() and get_my_role() = 'owner');
-- INSERT/UPDATE/DELETE: yo'q — faqat RPC funksiyalari ichidan yoziladi
-- (ular SECURITY DEFINER bo'lgani uchun bu siyosatlarga bog'liq emas).

-- ── devices ──────────────────────────────────────────────────────────────
create policy "devices_select_self_or_owner" on devices
  for select
  using (
    profile_id = auth.uid()
    or (
      get_my_role() = 'owner'
      and profile_id in (select id from profiles where company_id = get_my_company_id())
    )
  );

create policy "devices_insert_self" on devices
  for insert
  with check (profile_id = auth.uid());

create policy "devices_update_self_or_owner" on devices
  for update
  using (
    profile_id = auth.uid()
    or (
      get_my_role() = 'owner'
      and profile_id in (select id from profiles where company_id = get_my_company_id())
    )
  );
-- DELETE: yo'q — is_revoked = true qilinadi, yozuv saqlanadi.

-- ── shifts ───────────────────────────────────────────────────────────────
create policy "shifts_select_own_company" on shifts
  for select
  using (
    company_id = get_my_company_id()
    and (get_my_role() in ('owner', 'manager') or profile_id = auth.uid())
  );

create policy "shifts_write_owner_manager" on shifts
  for all
  using (company_id = get_my_company_id() and get_my_role() in ('owner', 'manager'))
  with check (company_id = get_my_company_id() and get_my_role() in ('owner', 'manager'));

-- ── products ─────────────────────────────────────────────────────────────
create policy "products_select_own_company" on products
  for select
  using (company_id = get_my_company_id());

create policy "products_write_owner_manager" on products
  for all
  using (company_id = get_my_company_id() and get_my_role() in ('owner', 'manager'))
  with check (company_id = get_my_company_id() and get_my_role() in ('owner', 'manager'));

-- ── production_tasks ─────────────────────────────────────────────────────
create policy "production_tasks_select_own_company" on production_tasks
  for select
  using (
    company_id = get_my_company_id()
    and (get_my_role() in ('owner', 'manager') or assigned_to = auth.uid())
  );

-- To'liq yozish (yaratish, tayinlash, o'chirish) faqat Owner/Manager.
-- Baker faqat o'ziga tayinlangan vazifaning holatini update_task_status()
-- RPC orqali yangilaydi.
create policy "production_tasks_write_owner_manager" on production_tasks
  for all
  using (company_id = get_my_company_id() and get_my_role() in ('owner', 'manager'))
  with check (company_id = get_my_company_id() and get_my_role() in ('owner', 'manager'));

-- ── inventory_items ──────────────────────────────────────────────────────
create policy "inventory_items_select_owner_manager" on inventory_items
  for select
  using (company_id = get_my_company_id() and get_my_role() in ('owner', 'manager'));

create policy "inventory_items_write_owner_manager" on inventory_items
  for all
  using (company_id = get_my_company_id() and get_my_role() in ('owner', 'manager'))
  with check (company_id = get_my_company_id() and get_my_role() in ('owner', 'manager'));

-- ── orders ───────────────────────────────────────────────────────────────
create policy "orders_select_own_company" on orders
  for select
  using (
    company_id = get_my_company_id()
    and (get_my_role() in ('owner', 'manager') or assigned_driver_id = auth.uid())
  );

-- To'liq yozish faqat Owner/Manager. Driver holatni faqat
-- update_order_status() RPC orqali o'zgartiradi.
create policy "orders_write_owner_manager" on orders
  for all
  using (company_id = get_my_company_id() and get_my_role() in ('owner', 'manager'))
  with check (company_id = get_my_company_id() and get_my_role() in ('owner', 'manager'));

-- ── order_items ──────────────────────────────────────────────────────────
create policy "order_items_select_via_order" on order_items
  for select
  using (
    order_id in (
      select id from orders
      where company_id = get_my_company_id()
        and (get_my_role() in ('owner', 'manager') or assigned_driver_id = auth.uid())
    )
  );

create policy "order_items_write_owner_manager" on order_items
  for all
  using (
    order_id in (
      select id from orders
      where company_id = get_my_company_id() and get_my_role() in ('owner', 'manager')
    )
  )
  with check (
    order_id in (
      select id from orders
      where company_id = get_my_company_id() and get_my_role() in ('owner', 'manager')
    )
  );
