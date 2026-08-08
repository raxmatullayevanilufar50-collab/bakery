-- Kunlik yopish hisoboti (Z-hisobot).
--
-- Kassir smena oxirida "Kunni yopish" tugmasini bosadi — o'sha kunning
-- jami savdosi, tranzaksiyalar soni va mahsulot turlari bo'yicha taqsimoti
-- hisoblanadi va saqlanadi. Owner keyinchalik o'tgan kunlarni ko'radi.

-- ── Tranzaksiya tushunchasi ──────────────────────────────────────────────
-- sales jadvalida savatdagi HAR BIR mahsulot alohida qator sifatida
-- yoziladi. Ya'ni 3 xil mahsulotli bitta chek = 3 ta qator. "Tranzaksiyalar
-- soni" esa chek sonini bildirishi kerak, qator sonini emas. Shuning uchun
-- bitta savatning barcha qatorlariga umumiy receipt_id beriladi (mijoz
-- tomonidan generatsiya qilinadi).
--
-- Eski qatorlarda (va SalesTab orqali qo'lda/ovoz bilan kiritilgan
-- yozuvlarda) receipt_id null bo'ladi — bunday qatorlarning har biri
-- alohida tranzaksiya deb sanaladi (coalesce(receipt_id, id)), bu eski
-- xatti-harakat bilan bir xil.
alter table sales add column if not exists receipt_id uuid;
create index if not exists sales_receipt_id_idx on sales(receipt_id) where receipt_id is not null;

create table if not exists daily_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  report_date date not null,
  total_sales numeric(14, 2) not null default 0,
  transaction_count integer not null default 0,
  item_count numeric(14, 2) not null default 0,
  -- [{ "product_name": "Non", "quantity": 120, "total": 600000 }, ...]
  product_breakdown jsonb not null default '[]'::jsonb,
  closed_by uuid references profiles(id),
  closed_at timestamptz not null default now(),
  unique (company_id, report_date)
);

create index if not exists daily_reports_company_date_idx
  on daily_reports(company_id, report_date desc);

alter table daily_reports enable row level security;

-- Moliyaviy ma'lumot — sales bilan bir xil qoida (20260724100800):
-- Owner va Cashier ko'radi, Manager ko'rmaydi.
create policy "daily_reports_select_owner_cashier" on daily_reports
  for select
  using (company_id = get_my_company_id() and get_my_role() in ('owner', 'cashier'));

-- INSERT/UPDATE/DELETE siyosati yo'q — qatorlar faqat close_day() RPC
-- orqali yoziladi. Aks holda kassir hisobot raqamlarini qo'lda
-- o'zgartira olardi.

grant select on daily_reports to authenticated;

-- ── Kunni yopish ─────────────────────────────────────────────────────────
-- SECURITY DEFINER sababi: Cashier'ning sales'ga RLS ruxsati faqat O'ZI
-- qayd qilgan savdolar bilan cheklangan (sales_select_owner_or_own_cashier).
-- Z-hisobot esa kunning BUTUN kompaniya bo'yicha yakuni bo'lishi kerak —
-- ikkinchi kassir savdosi ham kirsin. Funksiya faqat agregat raqamlarni
-- qaytaradi, xom savdo qatorlarini emas.
--
-- Kun chegarasi Toshkent vaqti bo'yicha olinadi: server UTC'da ishlaydi,
-- kechqurun 22:00 da (UTC 17:00) yopilgan smena to'g'ri kunga tushishi
-- kerak. O'zbekistonda yozgi vaqt yo'q, shuning uchun ofset barqaror.
create or replace function close_day(p_date date default null)
returns daily_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid := get_my_company_id();
  v_role user_role := get_my_role();
  v_date date := coalesce(p_date, (now() at time zone 'Asia/Tashkent')::date);
  v_start timestamptz := (v_date::timestamp at time zone 'Asia/Tashkent');
  v_end timestamptz := ((v_date + 1)::timestamp at time zone 'Asia/Tashkent');
  v_total numeric(14, 2);
  v_transactions integer;
  v_items numeric(14, 2);
  v_breakdown jsonb;
  v_result daily_reports;
begin
  -- Xato matnlari o'zbekcha — src/lib/errors.js ularni i18n kalitlariga
  -- moslashtiradi (loyihadagi barcha RPC'lar shu qoidaga amal qiladi).
  if v_company is null then
    raise exception 'Avtorizatsiyadan o''tilmagan';
  end if;
  if v_role not in ('owner', 'cashier') then
    raise exception 'Faqat kassir yoki kompaniya egasi kunni yopa oladi';
  end if;
  -- Kelajakdagi kunni yopib bo'lmaydi (noto'g'ri qurilma soati himoyasi).
  if v_date > (now() at time zone 'Asia/Tashkent')::date then
    raise exception 'Kelajakdagi kunni yopib bo''lmaydi';
  end if;

  select
    coalesce(sum(s.total), 0),
    count(distinct coalesce(s.receipt_id, s.id)),
    coalesce(sum(s.quantity), 0)
  into v_total, v_transactions, v_items
  from sales s
  where s.company_id = v_company
    and s.created_at >= v_start
    and s.created_at < v_end;

  select coalesce(jsonb_agg(to_jsonb(b) order by b.total desc), '[]'::jsonb)
  into v_breakdown
  from (
    select
      p.name as product_name,
      p.unit as unit,
      sum(s.quantity) as quantity,
      sum(s.total) as total
    from sales s
    join products p on p.id = s.product_id
    where s.company_id = v_company
      and s.created_at >= v_start
      and s.created_at < v_end
    group by p.name, p.unit
  ) b;

  -- Qayta yopish mumkin: kun yopilgandan keyin yana savdo bo'lsa, tugma
  -- qayta bosilganda raqamlar yangilanadi (closed_at ham yangilanadi).
  insert into daily_reports (
    company_id, report_date, total_sales, transaction_count,
    item_count, product_breakdown, closed_by, closed_at
  )
  values (
    v_company, v_date, v_total, v_transactions,
    v_items, v_breakdown, auth.uid(), now()
  )
  on conflict (company_id, report_date) do update set
    total_sales = excluded.total_sales,
    transaction_count = excluded.transaction_count,
    item_count = excluded.item_count,
    product_breakdown = excluded.product_breakdown,
    closed_by = excluded.closed_by,
    closed_at = excluded.closed_at
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function close_day(date) from public;
grant execute on function close_day(date) to authenticated;
