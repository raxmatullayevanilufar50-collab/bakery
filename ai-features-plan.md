# AI-native kengaytmalar — Non Tizimi

Texnik taklif: mavjud Supabase sxemasi (companies → profiles → sales/production_logs/inventory_items,
5 rol, SECURITY DEFINER RPC + deny-by-default RLS konvensiyasi) asosida uchta AI-native xususiyat.

**Qattiq qoidalar (barcha bosqichlarda amal qiladi):**

- AI hech qachon narx/pul hisob-kitobini o'zi qilmaydi — faqat SQL/Postgres orqali hisoblangan
  raqamlarga izoh/tavsiya qo'shadi. Har bir formulaning o'zi trigger/RPC ichida, oddiy SQL bilan
  yoziladi; AI faqat tabiiy tildagi izoh yoki cheklangan (server tomonda qisqichga solingan)
  tuzatish beradi.
- Manager roliga moliyaviy ma'lumot (narx, tannarx, foyda, summalar) ko'rsatilmaydi — faqat
  miqdor/operatsion ma'lumot. Mavjud qoida (`sales_select_manager_own_shift`,
  "moliyaviy hisobot Manager uchun yopiq") barcha yangi jadval va RPC'larda saqlanadi.
- Yozish har doim inson tasdig'i bilan — AI hech qachon `products.price`ga yoki boshqa jadvalga
  to'g'ridan-to'g'ri yozmaydi, faqat tavsiya qatori yaratadi, Owner/Manager RPC orqali tasdiqlaydi.

## Bog'liqlik xaritasi

Uchala xususiyat bir-biridan mustaqil emas — birgalikda yopiq tsikl hosil qiladi:

```
1-xususiyat: Bashorat
   → Owner/Manager vazifa yaratadi
   → 2-xususiyat: Baker ovoz bilan qayd etadi ("pishirdim")
   → trigger: xomashyo kamayadi
   → 3-xususiyat: xomashyo narxi o'zgarsa, narx tavsiyasi
   → Owner narxni tasdiqlaydi
   → Cashier savdo qayd etadi
   ↻ savdo tarixi ertangi kun bashoratiga qayta uzatiladi
```

`product_ingredients` (retsept/BOM) jadvali 2-xususiyatda bir marta yaratiladi va 3-xususiyatda
qayta ishlatiladi — shuning uchun amalga oshirish tartibi rejadagi 1-2-3 emas, balki quyidagi
"Amalga oshirish tartibi" bo'limidagi 0—5-bosqichlar bo'yicha boradi.

---

## 1-xususiyat — Talab bashorati

Kunlik/haftalik savdo tarixi asosida ertangi kun uchun har bir mahsulotdan qancha tayyorlash
kerakligini taklif qiladi, ishonch foizi bilan. **Raqamlar Postgres'da statistik hisoblanadi**
(ishonchli, tekshiriladigan); AI faqat ±30% chegarada tuzatish va tabiiy tildagi izoh qo'shadi.

### 1) Sxema o'zgarishi

Bitta yangi jadval (natijalarni saqlash) + bitta faqat-o'qish RPC (statistikani hisoblash).
Mavjud jadvallar o'zgarmaydi.

```sql
-- 20260729090000_demand_forecasting.sql

create table demand_forecasts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  forecast_date date not null,
  suggested_quantity numeric(12,2) not null,
  confidence_pct numeric(5,2) not null,
  historical_avg numeric(12,2),
  historical_stddev numeric(12,2),
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

-- Haftaning kuni bo'yicha o'rtacha va standart og'ish — 8 haftalik oyna.
-- Faqat miqdor qaytaradi (narx/summani EMAS) — Manager'ning moliyaviy
-- ma'lumotdan cheklanganligi (sales RLS, 20260724101400) shu bilan
-- buzilmaydi: bu yerda daromad emas, faqat ishlab chiqarish rejasi uchun
-- zarur bo'lgan dona/kg miqdori chiqadi.
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
    avg(d.qty)::numeric(12,2),
    coalesce(stddev_samp(d.qty), 0)::numeric(12,2),
    count(*)::int
  from daily d
  join products p on p.id = d.product_id
  group by p.id, p.name, p.unit, d.weekday
  order by p.name, d.weekday;
$$;

grant execute on function get_forecast_input(int) to authenticated;

create or replace function upsert_demand_forecast(
  p_product_id uuid, p_forecast_date date, p_suggested_quantity numeric,
  p_confidence_pct numeric, p_historical_avg numeric, p_historical_stddev numeric,
  p_explanation text, p_model_used text
)
returns demand_forecasts
language plpgsql security definer set search_path = public
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
```

### 2) RLS xavfsizligi

- ✓ Mavjud jadvallarga (`sales`, `products`) hech qanday policy o'zgarmaydi — `get_forecast_input()`
  SECURITY DEFINER bo'lgani uchun ularni o'qiydi, lekin o'z ichida rol tekshiruvi bor.
- ✓ `demand_forecasts`ga to'g'ridan-to'g'ri INSERT/UPDATE policy yo'q — `audit_logs`/`invites` bilan
  bir xil "faqat RPC orqali" konvensiyasi saqlanadi.
- ✓ **Moliyaviy ma'lumot Manager'ga ko'rsatilmaydi**: `get_forecast_input()` faqat `sum(quantity)`
  qaytaradi, `unit_price`/`total` ustunlariga umuman tegmaydi.
- ! **Ongli qaror (tasdiqlash kerak):** Manager hozir `sales`ni faqat o'z smenasi vaqtida ko'radi.
  Bashorat uchun bu funksiya Manager'ga butun tarix bo'yicha, lekin faqat dona/kg miqdorini
  (narxsiz) ko'rishga ruxsat beradi — chunki ishlab chiqarish rejalashtirish Manager vazifasi.
  Agar bu ham haddan tashqari keng ko'rinsa, `get_my_role() in ('owner','manager')` qatorini
  `= 'owner'`ga torishtirib, faqat Owner'ga qoldirish mumkin.

### 3) AI API

Raqamlar Postgres'da hisoblanadi; Claude faqat **±30% chegarada** tuzatish va tabiiy tildagi izoh
beradi — modelning noto'g'ri arifmetikasi natijaga ta'sir qila olmaydi.

| | |
|---|---|
| Model | `claude-sonnet-5` |
| Joylashuv | Edge Function: `forecast-demand` |
| Chaqiruv usuli | Tool-use (majburiy JSON) |
| Kerakli secret | `ANTHROPIC_API_KEY` |

```ts
// supabase/functions/forecast-demand/index.ts (qisqartirilgan)
// Foydalanuvchi JWT'i bilan chaqiriladi — service role SHART EMAS.
const supabase = createClient(URL, ANON_KEY, {
  global: { headers: { Authorization: req.headers.get('Authorization')! } },
})
const { data: rows } = await supabase.rpc('get_forecast_input', { p_lookback_days: 56 })
const tomorrow = /* Asia/Tashkent bo'yicha ertangi sana + hafta kuni */

for (const group of groupByProduct(rows, tomorrow.weekday)) {
  const baseline = group.avg_quantity
  const lo = Math.round(baseline * 0.7)
  const hi = Math.round(baseline * 1.3)
  // Namuna kam (<4) bo'lsa — isrofdan saqlanish uchun o'rtachadan
  // yuqoriga chiqarishga ruxsat berilmaydi.
  const hardCap = group.sample_count < 4 ? baseline : hi

  const claudeRes = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 300,
    tools: [{
      name: 'submit_forecast',
      input_schema: {
        type: 'object',
        required: ['adjusted_quantity', 'explanation_uz'],
        properties: {
          adjusted_quantity: { type: 'number', minimum: lo, maximum: hardCap },
          explanation_uz: { type: 'string', maxLength: 220 },
        },
      },
    }],
    tool_choice: { type: 'tool', name: 'submit_forecast' },
    messages: [{ role: 'user', content:
      `Mahsulot: ${group.product_name}. Haftaning shu kunidagi oxirgi ` +
      `${group.sample_count} hafta o'rtachasi: ${baseline} ${group.unit}, ` +
      `stddev: ${group.stddev_quantity}. Isrofni kamaytirishga ustuvorlik ` +
      `berib, ertangi kun uchun tavsiya va qisqa (1 gap) sababni yoz.` }],
  })

  // Server tomonda YANA BIR BOR qisqichga solinadi — modelga ishonch
  // 100% emas, bu ikkinchi himoya qatlami.
  const qty = clamp(toolResult.adjusted_quantity, lo, hardCap)
  const confidence = clamp(100 - (group.stddev_quantity / (baseline || 1)) * 100, 60, 95)

  await supabase.rpc('upsert_demand_forecast', {
    p_product_id: group.product_id, p_forecast_date: tomorrow.date,
    p_suggested_quantity: qty, p_confidence_pct: confidence,
    p_historical_avg: baseline, p_historical_stddev: group.stddev_quantity,
    p_explanation: toolResult.explanation_uz, p_model_used: 'claude-sonnet-5',
  })
}
```

### 4) Frontend oqimi

Yangi `ForecastTab.jsx` — Owner va Manager nav'ida "🔮 Bashorat" bo'limi (yangi "AI yordamchi"
nav guruhi ostida).

1. Sahifa ochilganda `demand_forecasts`dan `forecast_date = ertaga` bo'yicha mavjud natijalar
   yuklanadi.
2. Agar hali yaratilmagan bo'lsa — "Ertangi kun uchun bashorat yaratish" tugmasi
   `supabase.functions.invoke('forecast-demand')` ni chaqiradi (yuklanish holati bilan).
3. Har bir mahsulot uchun karta: nomi, tavsiya etilgan miqdor, `±X%` ishonch belgisi, qisqa
   AI izohi.
4. Kartadagi "Vazifa yaratish" tugmasi mavjud `production_tasks` jadvaliga bitta qator qo'shadi
   (quantity = tavsiya) — Owner/Manager buni Baker'ga tayinlaydi, xuddi hozirgi Ishlab chiqarish
   bo'limidagi kabi.
5. "Qayta yaratish" tugmasi `upsert_demand_forecast`dagi `on conflict` tufayli xavfsiz — eski
   natijani almashtiradi, dublikat qatordan xavotir yo'q.

---

## 2-xususiyat — Ovozli buyruqni tushunish (NLU)

Mavjud `voiceParse.js` — bitta gapdan bitta mahsulot/miqdor ajratadigan qoidaviy (regex)
tahlilchi — tezkor ishlaydi, lekin "3 ta somsa, 2 ta non sotildi" kabi ko'p punktli gaplarni
tushunmaydi. Uni **o'chirmasdan**, tarmoq yo'qligida ishlaydigan zaxira sifatida qoldirib, ustiga
AI-asosli ko'p-punktli tahlil qatlami qo'shiladi.

### 1) Sxema o'zgarishi

Bitta yangi jadval — `product_ingredients` (retsept/BOM). Bu jadval shu bilan birga 3-xususiyat
uchun ham poydevor bo'ladi. Xomashyoning real vaqtda kamayishi **pishirish qaydiga**
(`production_logs`, "pishirdim") bog'lanadi — savdoga emas, chunki xomashyo tayyor mahsulot
pishirilganda sarflanadi, sotilganda emas.

```sql
-- 20260729090100_voice_nlu_and_inventory.sql

-- Retsept: 1 dona mahsulot uchun qancha xomashyo ketishi.
create table product_ingredients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  quantity_per_unit numeric(12,4) not null check (quantity_per_unit > 0),
  created_at timestamptz not null default now(),
  unique (product_id, inventory_item_id)
);

create index product_ingredients_product_id_idx on product_ingredients(product_id);

alter table product_ingredients enable row level security;

create policy "product_ingredients_select_own_company" on product_ingredients
  for select using (company_id = get_my_company_id());

create policy "product_ingredients_write_owner_manager" on product_ingredients
  for all
  using (company_id = get_my_company_id() and get_my_role() in ('owner', 'manager'))
  with check (company_id = get_my_company_id() and get_my_role() in ('owner', 'manager'));

grant select, insert, update, delete on product_ingredients to authenticated;

-- Pishirish qaydi kiritilganda retsept bo'yicha xomashyo avtomatik kamayadi.
-- SECURITY DEFINER: Baker'ning inventory_items'ga bevosita yozish huquqi
-- yo'q va bu o'zgarmaydi — trigger nazorat ostidagi YAGONA teshik.
create or replace function apply_production_log_inventory_impact()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  update inventory_items ii
  set quantity = ii.quantity - (pi.quantity_per_unit * new.quantity)
  from product_ingredients pi
  where pi.product_id = new.product_id and pi.inventory_item_id = ii.id;
  return new;
end;
$$;

create trigger trg_production_log_inventory_impact
  after insert on production_logs
  for each row execute function apply_production_log_inventory_impact();

-- Ko'p qurilmali sinxronizatsiya (4-bo'lim, 8-talab) — endi savdo va
-- pishirish qaydlari ham real vaqtda uzatiladi, xuddi production_tasks/
-- orders/inventory_items/shifts kabi (20260724100900_realtime.sql).
alter publication supabase_realtime add table sales;
alter publication supabase_realtime add table production_logs;

-- AI tahlilining shaffofligi uchun — Owner mavjud audit_logs orqali
-- har bir ovozli buyruqning xom matni va tahlil natijasini ko'ra oladi.
create or replace function log_ai_voice_command(
  p_transcript text, p_parsed jsonb, p_model text, p_target_table text
)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Avtorizatsiyadan o''tilmagan'; end if;
  insert into audit_logs (company_id, actor_id, action, target_table, metadata)
  values (get_my_company_id(), auth.uid(), 'ai_ovoz_buyrugi_tahlil_qilindi', p_target_table,
    jsonb_build_object('transcript', p_transcript, 'parsed', p_parsed, 'model', p_model));
end;
$$;

grant execute on function log_ai_voice_command(text, jsonb, text, text) to authenticated;
```

### 2) RLS xavfsizligi

- ✓ `sales_insert_self` va `production_logs_insert_self_baker` policy'lari o'zgarmaydi — AI faqat
  qaysi qatorlar yozilishini *tavsiya* qiladi, yozishning o'zi hamon foydalanuvchining o'z
  sessiyasi orqali, mavjud cheklovlar bilan bo'ladi (masalan `production_logs` hamon faqat
  Baker uchun).
- ✓ Trigger SECURITY DEFINER bo'lsa-da, faqat aniq bitta formula bo'yicha
  `inventory_items.quantity`ni o'zgartiradi — Baker/Cashier'ga bu jadvalga bevosita SELECT/UPDATE
  hamon berilmagan.
- ✓ `log_ai_voice_command` faqat INSERT qiladi (`audit_logs`ning mavjud "faqat owner ko'radi"
  SELECT policy'si o'zgarmaydi) — har bir rol faqat o'z harakati haqida yozadi.
- ! Manfiy zaxira (masalan retsept noto'g'ri kiritilsa) qasddan bloklanmaydi — `quantity` manfiy
  bo'lib qolishi mumkin. Bu ataylab: mavjud `low_stock_threshold`/badge mexanizmi buni allaqachon
  ko'rsatadi, va sukut bo'yicha bloklash "ovoz orqali tez qayd etish" tezligiga zid bo'lardi.

### 3) AI API

Mahalliy parser tez ishlaydigan yagona-punkt holatlar uchun birinchi bo'lib sinaladi (offline ham
ishlaydi). Vergul/"va" bor gaplarda yoki mos kelmaganda — AI chaqiriladi.

| | |
|---|---|
| Model | `claude-haiku-4-5` |
| Sabab | Qisqa matn, past kechikish kerak |
| Joylashuv | Edge Function: `parse-voice-command` |
| Kerakli secret | `ANTHROPIC_API_KEY` (feature 1 bilan bir xil) |
| Cheklov | Faqat berilgan `product_id`'lardan — hech narsa o'ylab topilmaydi |

```ts
// supabase/functions/parse-voice-command/index.ts (qisqartirilgan)
// body: { transcript, mode: 'sale' | 'production' }
// Foydalanuvchi JWT'i bilan — RLS orqali faqat o'z kompaniyasi mahsulotlari.
const { data: products } = await supabase.from('products').select('id, name, unit')

const allowedIds = products.map(p => p.id)
const result = await anthropic.messages.create({
  model: 'claude-haiku-4-5',
  max_tokens: 400,
  tools: [{
    name: 'extract_items',
    input_schema: {
      type: 'object',
      required: ['items'],
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            required: ['product_id', 'quantity'],
            properties: {
              product_id: { type: 'string', enum: allowedIds },
              quantity: { type: 'number', exclusiveMinimum: 0 },
            },
          },
        },
      },
    },
  }],
  tool_choice: { type: 'tool', name: 'extract_items' },
  messages: [{ role: 'user', content:
    `Mahsulotlar ro'yxati: ${products.map(p => `${p.id}=${p.name}`).join(', ')}.\n` +
    `Nutq: "${transcript}"\nHar bir aytilgan mahsulot va miqdorni ajrat. ` +
    `Faqat ro'yxatdagi product_id'lardan foydalan, ro'yxatda yo'q narsani o'ylab topma.` }],
})

// Server tomonda ikkinchi tekshiruv: har bir product_id ro'yxatda ekanini
// tasdiqlaymiz — modelga to'liq ishonmaymiz.
const items = toolResult.items.filter(i => allowedIds.includes(i.product_id))
return json({ items })
```

### 4) Frontend oqimi

`SalesTab.jsx` va `ProductionLogTab.jsx`dagi bitta-punktli `draft` obyekti `draftItems`
massiviga kengaytiriladi — tasdiqlash ekrani hamon MAJBURIY (mavjud "hech qachon
to'g'ridan-to'g'ri yozilmaydi" tamoyili saqlanadi).

1. `VoiceRecorder`dan transcript keladi → avval mavjud `parseSaleUtterance()` sinaladi.
2. Agar matnda vergul/"va" bo'lsa YOKI mahalliy parser hech narsa topmasa →
   `supabase.functions.invoke('parse-voice-command', { body: { transcript, mode } })`.
3. Natija `draftItems` ro'yxati sifatida ko'rsatiladi — har biri tahrirlanadigan qator
   (mahsulot select + miqdor + o'chirish), "yana qator qo'shish" tugmasi bilan.
4. "Tasdiqlash" — bitta `supabase.from('sales').insert([...])` (massiv = bir nechta qator, bitta
   so'rov), so'ng `log_ai_voice_command` RPC chaqiriladi.
5. Insert paytida trigger avtomatik ishlaydi (production_logs uchun) — Owner ekranidagi Inventar
   bo'limi `postgres_changes` obunasi orqali **refresh tugmasisiz** yangi qoldiqni ko'rsatadi.

---

## 3-xususiyat — AI-asosli narxlash tavsiyalari

Ingredient narxi (`inventory_items.unit_cost`) o'zgarganda, shu ingredient ishlatiladigan har bir
mahsulot uchun yangi tannarx **qoidaviy (deterministik) hisoblanadi** va belgilangan marja
saqlanadigan narx tavsiya qilinadi. AI faqat sabab-natija izohini yozadi — narxni hech qachon o'zi
yozmaydi, Owner/Manager har doim qo'lda tasdiqlaydi.

### 1) Sxema o'zgarishi

`product_ingredients` (2-xususiyatda yaratilgan) qayta ishlatiladi. Bu yerda ingredient tannarxi,
narx tarixi va tavsiyalar jadvali qo'shiladi.

```sql
-- 20260729090200_ingredient_cost_pricing.sql

alter table inventory_items add column unit_cost numeric(12,2) not null default 0;
alter table products add column target_margin_pct numeric(5,2) not null default 30
  check (target_margin_pct >= 0 and target_margin_pct < 100);

create table inventory_price_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  old_unit_cost numeric(12,2) not null,
  new_unit_cost numeric(12,2) not null,
  changed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index inventory_price_history_item_idx
  on inventory_price_history(inventory_item_id, created_at desc);
alter table inventory_price_history enable row level security;
create policy "inventory_price_history_select_owner_manager" on inventory_price_history
  for select using (company_id = get_my_company_id() and get_my_role() in ('owner', 'manager'));

create table price_recommendations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  triggered_by_item_id uuid references inventory_items(id) on delete set null,
  old_price numeric(12,2) not null,
  suggested_price numeric(12,2) not null,
  old_cost numeric(12,2) not null,
  new_cost numeric(12,2) not null,
  target_margin_pct numeric(5,2) not null,
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
create policy "price_recommendations_select_owner_manager" on price_recommendations
  for select using (company_id = get_my_company_id() and get_my_role() in ('owner', 'manager'));
-- INSERT: yo'q — faqat trigger. UPDATE: yo'q — faqat quyidagi RPC'lar.

grant select, insert, update, delete on
  inventory_price_history, price_recommendations to authenticated;

-- Xomashyo narxi o'zgarganda: tarixga yozadi + retseptida shu xomashyo
-- bor har bir mahsulot uchun yangi tannarx va tavsiya narxini hisoblaydi.
-- Formula: taklif etilgan narx = yangi tannarx x (1 + marja% / 100).
create or replace function record_ingredient_price_change()
returns trigger language plpgsql security definer set search_path = public
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

create or replace function apply_price_recommendation(p_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_rec price_recommendations;
begin
  if get_my_role() not in ('owner', 'manager') then
    raise exception 'Faqat egasi yoki menejer narxni tasdiqlashi mumkin';
  end if;
  select * into v_rec from price_recommendations
  where id = p_id and company_id = get_my_company_id() and status = 'kutilmoqda';
  if v_rec is null then raise exception 'Tavsiya topilmadi yoki allaqachon hal qilingan'; end if;

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
returns void language plpgsql security definer set search_path = public
as $$
begin
  if get_my_role() not in ('owner', 'manager') then
    raise exception 'Faqat egasi yoki menejer rad eta oladi';
  end if;
  update price_recommendations
  set status = 'rad_etildi', decided_by = auth.uid(), decided_at = now()
  where id = p_id and company_id = get_my_company_id() and status = 'kutilmoqda';
end;
$$;

-- AI izohi shu RPC orqali yoziladi — Edge Function service role talab
-- qilmaydi, chaqiruvchi foydalanuvchining o'z JWT'i bilan ishlaydi.
create or replace function set_recommendation_explanation(p_id uuid, p_explanation text, p_model text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update price_recommendations set explanation = p_explanation, model_used = p_model
  where id = p_id and company_id = get_my_company_id() and get_my_role() in ('owner', 'manager');
end;
$$;

grant execute on function apply_price_recommendation(uuid) to authenticated;
grant execute on function reject_price_recommendation(uuid) to authenticated;
grant execute on function set_recommendation_explanation(uuid, text, text) to authenticated;
```

### 2) RLS xavfsizligi

- ✓ `unit_cost` — `inventory_items`ning yangi ustuni, mavjud `inventory_items_write_owner_manager`
  policy'si ostida — qo'shimcha policy shart emas, Baker/Cashier/Driver hamon bu jadvalni umuman
  ko'rmaydi.
- ✓ `products.price`ni faqat `apply_price_recommendation()` o'zgartiradi (RPC ichida rol
  tekshiruvi bilan, formula 100% SQL) — mavjud `products_write_owner_manager` policy
  to'g'ridan-to'g'ri UPDATE'ga hamon ruxsat beradi, RPC shunchaki qo'shimcha audit +
  tavsiya-holatini yopish qatlamini beradi.
- ✓ `price_recommendations`ga to'g'ridan-to'g'ri UPDATE policy yo'q — status faqat RPC orqali
  `'kutilmoqda'` dan chiqadi, shuning uchun bitta tavsiya ikki marta qabul qilinolmaydi.
- ✓ **Amalga oshirilgan holat (2025-07-29, bosqich 2):** `price_recommendations_select_owner` va
  `inventory_price_history_select_owner` — ikkalasi ham **faqat Owner** (`get_my_role() = 'owner'`),
  Manager umuman ko'rmaydi. `apply_price_recommendation()`, `reject_price_recommendation()` va
  `set_recommendation_explanation()` RPC'larida ham rol tekshiruvi `get_my_role() <> 'owner'` —
  Manager bu funksiyalarni chaqira olmaydi. Bu sizning aniq tasdiqlagan qoidangizga
  ("Manager moliyaviy ma'lumot ko'rmasligi kerak") to'liq mos.
- **Ongli qaror — `inventory_items.unit_cost`:** bu ustun mavjud
  `inventory_items_write_owner_manager` policy'si ostida qoldirildi, ya'ni **Manager ham ko'radi/
  yozadi**. Sabab: (1) `products.price` (sotuv narxi) allaqachon RLS'da rolga cheklanmagan —
  har qanday xodim ko'radi, demak "narx" tushunchasi bu tizimda avvaldan yopiq emas; (2) Manager
  allaqachon butun `inventory_items` jadvalini (miqdor, chegara) to'liq boshqaradi — xomashyo
  tannarxi tovar yetkazib berish/xarid operatsiyasi, sof daromad emas. Foyda/marja oshkor
  bo'ladigan joy — bu `price_recommendations` (tavsiya etilgan narx + marja% birga ko'rinadi) —
  va u yuqorida Owner-only qilingan. Agar xohlasangiz, `unit_cost`ni ham Manager'dan yashirish
  mumkin, lekin bu Postgres RLS qator-darajasida emas, balki ustun-darajasida niqoblovchi VIEW
  qurishni talab qiladi (RLS o'zi ustun emas, qator cheklaydi) — xohlasangiz alohida so'rov
  sifatida qo'shib beraman.

### 3) AI API

Narx va tannarx **hech qachon** AI'dan kelmaydi — ular yuqoridagi trigger'da toza SQL bilan
hisoblangan. Claude faqat shu tayyor raqamlarni o'qib, qisqa o'zbek tilida sabab-natija izohini
yozadi.

| | |
|---|---|
| Model | `claude-haiku-4-5` |
| Chaqiruv | Oddiy matn (tool-use shart emas) |
| Joylashuv | Edge Function: `explain-price-recommendation` |
| Kerakli secret | `ANTHROPIC_API_KEY` (feature 1/2 bilan bir xil) |
| Ishga tushishi | Frontend, cost yangilangandan keyin |

```ts
// supabase/functions/explain-price-recommendation/index.ts (qisqartirilgan)
// body: { recommendationIds: string[] } — foydalanuvchi JWT'i bilan.
const { data: recs } = await supabase
  .from('price_recommendations')
  .select('id, old_cost, new_cost, old_price, suggested_price, target_margin_pct, products(name)')
  .in('id', recommendationIds)

for (const r of recs) {
  const costDelta = (((r.new_cost - r.old_cost) / r.old_cost) * 100).toFixed(1)
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 200,
    messages: [{ role: 'user', content:
      `"${r.products.name}" tannarxi ${r.old_cost} so'mdan ${r.new_cost} so'mga ` +
      `o'zgardi (${costDelta}%). Belgilangan marja: ${r.target_margin_pct}%. ` +
      `Eski narx ${r.old_price}, tavsiya etilgan yangi narx ${r.suggested_price}. ` +
      `Do'kon egasiga 1-2 gapda, o'zbek tilida, nima uchun bu narxni tavsiya ` +
      `qilayotganingizni tushuntiring.` }],
  })
  await supabase.rpc('set_recommendation_explanation', {
    p_id: r.id, p_explanation: msg.content[0].text, p_model: 'claude-haiku-4-5',
  })
}
```

> **Eslatma:** to'liq avtomatlashtirish uchun buni Database Webhook (Dashboard → Database →
> Webhooks) orqali `price_recommendations`ga INSERT bo'lganda ham chaqirish mumkin — lekin bu
> holda webhook service-role kalitini talab qiladi. Kalitni migratsiya faylida (versiyalangan,
> repo'ga tushadigan SQL'da) qattiq yozib qo'yish xavfsizlik xatosi bo'lardi, shuning uchun bu
> yo'l faqat Dashboard orqali sozlanadigan webhook sifatida, YOKI yuqoridagi — foydalanuvchi
> JWT'i bilan ishlaydigan — sodda variant sifatida tavsiya etiladi.

### 4) Frontend oqimi

Ikki joy o'zgaradi: `InventoryTab.jsx`ga narx maydoni qo'shiladi, va yangi `PricingTab.jsx`
("💡 Narx tavsiyalari") **faqat Owner** nav'iga qo'shiladi (Manager'da bu bo'lim yo'q — moliyaviy
qoidaga mos).

1. Owner Inventar bo'limida ingredient qatoriga "Narx" maydonini kiritadi/yangilaydi →
   `supabase.from('inventory_items').update({ unit_cost })`.
2. Trigger serverda darhol ishlaydi — mos mahsulotlar uchun `price_recommendations` qatorlari
   `'kutilmoqda'` holatida paydo bo'ladi.
3. Frontend yangi yaratilgan tavsiya ID'larini o'qiydi va `explain-price-recommendation`ni
   chaqiradi — kartalar "AI izoh yozmoqda…" skeleton bilan, keyin matn to'ldiriladi.
4. "Narx tavsiyalari" bo'limi nav'da kutayotgan sonlar bilan belgi (badge) ko'rsatadi — mavjud
   Inventar bo'limidagi `useLowStockCount` naqshiga o'xshab.
5. Har bir karta: mahsulot, eski → yangi narx, tannarx tafsiloti, AI izohi, [Qabul qilish] /
   [Rad etish] — mos ravishda `apply_price_recommendation`/`reject_price_recommendation`
   RPC'sini chaqiradi.

---

## Amalga oshirish tartibi

| Bosqich | Ish | Izoh |
|---|---|---|
| **0** | Retseptlarni kiritish UI'i | Owner har bir mahsulot uchun qaysi xomashyodan qancha ketishini bir marta kiritadi — oddiy CRUD, ProductionTab/InventoryTab ichida. |
| **1** | 2-xususiyat sxemasi | `product_ingredients`, inventar trigger'i, realtime kengaytmasi. Mahalliy parser ishlab turgani uchun foydalanuvchi darhol uzilish sezmaydi. |
| **2** | 3-xususiyat sxemasi | `unit_cost`, narx tarixi, tavsiyalar jadvali va trigger — 1-bosqichdagi retsept jadvaliga tayanadi. Manager-ko'rinmaslik qoidasi shu bosqichda RLS'ga yoziladi. |
| **3** | 1-xususiyat sxemasi | Mustaqil — faqat `sales` tarixiga tayanadi, istalgan payt qo'shilishi mumkin. |
| **4** | Edge Function'lar | `forecast-demand`, `parse-voice-command`, `explain-price-recommendation` — `ANTHROPIC_API_KEY`ni `supabase secrets set` bilan qo'shib, mavjud `pin-auth`/`create-employee` funksiyalari yonida joylashtiriladi. |
| **5** | Frontend | `ForecastTab`, `PricingTab` (yangi "AI yordamchi" nav guruhi), `SalesTab`/`ProductionLogTab`ning ko'p-punktli tasdiqlash ekraniga kengayishi. |

**Har bir bosqichdan keyin to'xtayman va tekshirish uchun xabar beraman.**

## Kerakli AI API va secret'lar

- **AI provayder:** Anthropic Claude API (Messages API, Supabase Edge Functions — Deno — ichidan
  chaqiriladi, `npm:@anthropic-ai/sdk` yoki to'g'ridan-to'g'ri `fetch`).
- **Modellar:** `claude-sonnet-5` (1-xususiyat — bashorat tuzatish/izoh, biroz og'irroq fikrlash
  kerak), `claude-haiku-4-5` (2 va 3-xususiyat — qisqa matn, tez javob kerak).
- **Kerakli secret:** bitta — `ANTHROPIC_API_KEY`. Barcha uchta Edge Function shuni ishlatadi.
  O'rnatish: `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...` (loyihada mavjud
  `SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_ANON_KEY` bilan bir xil mexanizm, `pin-auth`
  funksiyasida ko'rilgani kabi).
- **Service role kaliti kerakmi?** Yo'q — uchala Edge Function ham chaqiruvchi foydalanuvchining
  o'z JWT'i bilan ishlaydi (`Authorization` header forward qilinadi), RLS + RPC'dagi rol
  tekshiruvi orqali xavfsizlik ta'minlanadi. Bu `pin-auth`/`create-employee`dan farqli — ular
  sessiyasiz ishlagani uchun service role talab qiladi, bu uchtasi esa doim tizimga kirgan
  foydalanuvchi tomonidan chaqiriladi.
