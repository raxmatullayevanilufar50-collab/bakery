-- Talab bashorati: o'tgan savdo tarixi (haftaning kuni bo'yicha) asosida
-- ertangi kun uchun har bir mahsulotdan qancha tayyorlash kerakligini
-- taklif qiladi. Raqamlar (o'rtacha, standart og'ish) shu faylda 100%
-- oddiy SQL bilan hisoblanadi — Edge Function keyingi bosqichda faqat
-- ±30% chegarada tuzatish va tabiiy tildagi izoh qo'shadi (hech qachon
-- o'z arifmetikasini o'ylab topmaydi).
--
-- Bu yerda hech qanday narx/summa ustuni yo'q — faqat dona/kg miqdori,
-- shuning uchun Manager uchun "moliyaviy ma'lumot yopiq" qoidasi
-- buzilmaydi (Manager ishlab chiqarishni rejalashtirish uchun buni
-- ko'rishi kerak, lekin savdo summasi/foydani ko'rmaydi).

create table demand_forecasts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  forecast_date date not null,
  suggested_quantity numeric(12, 2) not null,
  confidence_pct numeric(5, 2) not null,
  historical_avg numeric(12, 2),
  historical_stddev numeric(12, 2),
  explanation text,
  model_used text,
  generated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (company_id, product_id, forecast_date)
);

create index demand_forecasts_company_date_idx
  on demand_forecasts(company_id, forecast_date desc);

alter table demand_forecasts enable row level security;

create policy "demand_forecasts_select_owner_manager" on demand_forecasts
  for select
  using (company_id = get_my_company_id() and get_my_role() in ('owner', 'manager'));
-- INSERT/UPDATE: yo'q — faqat quyidagi upsert_demand_forecast() RPC orqali.

grant select, insert, update on demand_forecasts to authenticated;

-- Haftaning kuni bo'yicha o'rtacha va standart og'ish — 8 haftalik oyna
-- (sukut bo'yicha). Faqat miqdor qaytaradi (narx/summani EMAS) — Manager
-- bashorat uchun butun tarixni ko'radi, lekin daromad haqida hech narsa
-- bilmaydi.
create or replace function get_forecast_input(p_lookback_days int default 56)
returns table (
  product_id uuid,
  product_name text,
  unit text,
  weekday int,
  avg_quantity numeric,
  stddev_quantity numeric,
  sample_count int
)
language sql
security definer
stable
set search_path = public
as $$
  with daily as (
    select
      s.product_id,
      extract(dow from s.created_at)::int as weekday,
      sum(s.quantity) as qty
    from sales s
    where s.company_id = get_my_company_id()
      and s.created_at >= now() - (p_lookback_days || ' days')::interval
      and get_my_role() in ('owner', 'manager')
    group by s.product_id, date_trunc('day', s.created_at), extract(dow from s.created_at)
  )
  select
    p.id, p.name, p.unit, d.weekday,
    avg(d.qty)::numeric(12, 2),
    coalesce(stddev_samp(d.qty), 0)::numeric(12, 2),
    count(*)::int
  from daily d
  join products p on p.id = d.product_id
  group by p.id, p.name, p.unit, d.weekday
  order by p.name, d.weekday;
$$;

grant execute on function get_forecast_input(int) to authenticated;

-- Yaratilgan/yangilangan bashoratni saqlaydi. on conflict tufayli "qayta
-- yaratish" xavfsiz — dublikat qatordan xavotir yo'q.
create or replace function upsert_demand_forecast(
  p_product_id uuid, p_forecast_date date, p_suggested_quantity numeric,
  p_confidence_pct numeric, p_historical_avg numeric, p_historical_stddev numeric,
  p_explanation text, p_model_used text
)
returns demand_forecasts
language plpgsql
security definer
set search_path = public
as $$
declare v_row demand_forecasts;
begin
  if get_my_role() not in ('owner', 'manager') then
    raise exception 'Faqat egasi yoki menejer bashorat yarata oladi';
  end if;
  if not exists (select 1 from products where id = p_product_id and company_id = get_my_company_id()) then
    raise exception 'Mahsulot topilmadi';
  end if;

  insert into demand_forecasts (company_id, product_id, forecast_date, suggested_quantity,
    confidence_pct, historical_avg, historical_stddev, explanation, model_used, generated_by)
  values (get_my_company_id(), p_product_id, p_forecast_date, p_suggested_quantity,
    p_confidence_pct, p_historical_avg, p_historical_stddev, p_explanation, p_model_used, auth.uid())
  on conflict (company_id, product_id, forecast_date) do update
    set suggested_quantity = excluded.suggested_quantity, confidence_pct = excluded.confidence_pct,
        historical_avg = excluded.historical_avg, historical_stddev = excluded.historical_stddev,
        explanation = excluded.explanation, model_used = excluded.model_used,
        generated_by = excluded.generated_by, created_at = now()
  returning * into v_row;
  return v_row;
end;
$$;

grant execute on function upsert_demand_forecast
  (uuid, date, numeric, numeric, numeric, numeric, text, text) to authenticated;
