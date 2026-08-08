-- Ingredient narxi o'zgarganda, retsept (product_ingredients, 20260729090100)
-- orqali bog'langan har bir mahsulot uchun yangi tannarx va belgilangan
-- marjani saqlaydigan narx tavsiyasi hisoblanadi.
--
-- QATTIQ QOIDA: narx/tannarx/marja hech qachon AI'dan kelmaydi — bu faylda
-- hammasi oddiy SQL bilan (trigger ichida) hisoblanadi. AI keyingi
-- bosqichda faqat tayyor raqamlarga tabiiy tildagi izoh qo'shadi.
--
-- QATTIQ QOIDA: Manager roliga moliyaviy ma'lumot (narx, foyda)
-- ko'rsatilmaydi. inventory_items.unit_cost mavjud
-- inventory_items_write_owner_manager siyosati ostida qoladi (Manager
-- allaqachon shu jadvalning barcha qatorlarini, jumladan mahsulot
-- sotuv narxini ham — products_select_own_company hech qanday rolga
-- cheklanmagan — ko'radi, bu yangi emas). Lekin narxlash STRATEGIYASI
-- (tavsiya etilgan narx, marja%, tannarx tarixi) — bu aynan "foyda"
-- ma'lumoti, shuning uchun price_recommendations va
-- inventory_price_history FAQAT Owner uchun ochiladi.

alter table inventory_items add column unit_cost numeric(12, 2) not null default 0;

alter table products add column target_margin_pct numeric(5, 2) not null default 30
  check (target_margin_pct >= 0 and target_margin_pct < 100);

create table inventory_price_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  old_unit_cost numeric(12, 2) not null,
  new_unit_cost numeric(12, 2) not null,
  changed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index inventory_price_history_item_idx
  on inventory_price_history(inventory_item_id, created_at desc);

alter table inventory_price_history enable row level security;

create policy "inventory_price_history_select_owner" on inventory_price_history
  for select
  using (company_id = get_my_company_id() and get_my_role() = 'owner');
-- INSERT: yo'q — faqat quyidagi trigger orqali.

create table price_recommendations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  triggered_by_item_id uuid references inventory_items(id) on delete set null,
  old_price numeric(12, 2) not null,
  suggested_price numeric(12, 2) not null,
  old_cost numeric(12, 2) not null,
  new_cost numeric(12, 2) not null,
  target_margin_pct numeric(5, 2) not null,
  explanation text,
  model_used text,
  status text not null default 'kutilmoqda'
    check (status in ('kutilmoqda', 'qabul_qilindi', 'rad_etildi')),
  created_at timestamptz not null default now(),
  decided_by uuid references auth.users(id),
  decided_at timestamptz
);

create index price_recommendations_company_status_idx
  on price_recommendations(company_id, status, created_at desc);

alter table price_recommendations enable row level security;

create policy "price_recommendations_select_owner" on price_recommendations
  for select
  using (company_id = get_my_company_id() and get_my_role() = 'owner');
-- INSERT: yo'q — faqat trigger. UPDATE: yo'q — faqat quyidagi RPC'lar orqali.

grant select, insert, update on inventory_price_history to authenticated;
grant select, insert, update on price_recommendations to authenticated;

-- Xomashyo narxi o'zgarganda: tarixga yozadi + retseptida shu xomashyo bor
-- har bir mahsulot uchun yangi tannarx va tavsiya narxini hisoblaydi.
-- Formula: taklif etilgan narx = yangi tannarx x (1 + marja% / 100).
-- Bu SECURITY DEFINER — RLS'ni chetlab o'tadi, lekin faqat shu ikki
-- jadvalga, faqat shu qat'iy formula bilan yozadi.
create or replace function record_ingredient_price_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.unit_cost is distinct from old.unit_cost then
    insert into inventory_price_history
      (company_id, inventory_item_id, old_unit_cost, new_unit_cost, changed_by)
    values (new.company_id, new.id, old.unit_cost, new.unit_cost, auth.uid());

    insert into price_recommendations
      (company_id, product_id, triggered_by_item_id, old_price,
       old_cost, new_cost, suggested_price, target_margin_pct)
    select
      p.company_id, p.id, new.id, p.price,
      cost.old_cost, cost.new_cost,
      round(cost.new_cost * (1 + p.target_margin_pct / 100), 2),
      p.target_margin_pct
    from products p
    join product_ingredients pi on pi.product_id = p.id and pi.inventory_item_id = new.id
    cross join lateral (
      select
        sum(pi2.quantity_per_unit *
          case when ii.id = new.id then old.unit_cost else ii.unit_cost end) as old_cost,
        sum(pi2.quantity_per_unit *
          case when ii.id = new.id then new.unit_cost else ii.unit_cost end) as new_cost
      from product_ingredients pi2
      join inventory_items ii on ii.id = pi2.inventory_item_id
      where pi2.product_id = p.id
    ) cost
    where p.company_id = new.company_id;
  end if;
  return new;
end;
$$;

create trigger trg_ingredient_price_change
  after update of unit_cost on inventory_items
  for each row execute function record_ingredient_price_change();

-- Tavsiyani qabul qilish — narxni HAQIQATDA o'zgartiradigan yagona yo'l.
-- Faqat Owner (Manager emas — moliyaviy qaror faqat Owner qo'lida).
create or replace function apply_price_recommendation(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_rec price_recommendations;
begin
  if get_my_role() <> 'owner' then
    raise exception 'Faqat kompaniya egasi narxni tasdiqlashi mumkin';
  end if;

  select * into v_rec from price_recommendations
  where id = p_id and company_id = get_my_company_id() and status = 'kutilmoqda';

  if v_rec is null then
    raise exception 'Tavsiya topilmadi yoki allaqachon hal qilingan';
  end if;

  update products set price = v_rec.suggested_price where id = v_rec.product_id;

  update price_recommendations
  set status = 'qabul_qilindi', decided_by = auth.uid(), decided_at = now()
  where id = p_id;

  insert into audit_logs (company_id, actor_id, action, target_table, target_id, metadata)
  values (get_my_company_id(), auth.uid(), 'narx_tavsiyasi_qabul_qilindi', 'products',
    v_rec.product_id, jsonb_build_object('old_price', v_rec.old_price, 'new_price', v_rec.suggested_price));
end;
$$;

create or replace function reject_price_recommendation(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if get_my_role() <> 'owner' then
    raise exception 'Faqat kompaniya egasi tavsiyani rad eta oladi';
  end if;

  update price_recommendations
  set status = 'rad_etildi', decided_by = auth.uid(), decided_at = now()
  where id = p_id and company_id = get_my_company_id() and status = 'kutilmoqda';
end;
$$;

-- AI izohi shu RPC orqali yoziladi — Edge Function foydalanuvchining
-- o'z JWT'i bilan ishlaydi, service role talab qilinmaydi.
create or replace function set_recommendation_explanation(p_id uuid, p_explanation text, p_model text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update price_recommendations
  set explanation = p_explanation, model_used = p_model
  where id = p_id and company_id = get_my_company_id() and get_my_role() = 'owner';
end;
$$;

grant execute on function apply_price_recommendation(uuid) to authenticated;
grant execute on function reject_price_recommendation(uuid) to authenticated;
grant execute on function set_recommendation_explanation(uuid, text, text) to authenticated;
