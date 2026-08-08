alter table products
  add column if not exists image_url text,
  add column if not exists category text not null default 'boshqa',
  add column if not exists sell_by_weight boolean not null default false,
  add column if not exists is_available boolean not null default true;

create table if not exists display_inventory (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade not null,
  product_id uuid references products(id) on delete cascade not null,
  quantity_available numeric(12,2) not null default 0,
  updated_at timestamptz not null default now(),
  unique(company_id, product_id)
);

create table if not exists pre_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade not null,
  customer_name text not null,
  customer_phone text,
  pickup_date date not null,
  pickup_time time,
  notes text,
  status text not null default 'kutilmoqda' check (status in ('kutilmoqda', 'tayyor', 'berildi', 'bekor')),
  total numeric(12,2) not null default 0,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists pre_order_items (
  id uuid primary key default gen_random_uuid(),
  pre_order_id uuid references pre_orders(id) on delete cascade not null,
  product_id uuid references products(id),
  custom_name text,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null,
  total numeric(12,2) not null
);

alter table display_inventory enable row level security;
alter table pre_orders enable row level security;
alter table pre_order_items enable row level security;
create policy "display inventory company access" on display_inventory for all using (company_id = get_my_company_id()) with check (company_id = get_my_company_id());
create policy "pre orders company access" on pre_orders for all using (company_id = get_my_company_id()) with check (company_id = get_my_company_id());
create policy "pre order items company access" on pre_order_items for all using (exists (select 1 from pre_orders where pre_orders.id = pre_order_items.pre_order_id and pre_orders.company_id = get_my_company_id())) with check (exists (select 1 from pre_orders where pre_orders.id = pre_order_items.pre_order_id and pre_orders.company_id = get_my_company_id()));
grant all on display_inventory, pre_orders, pre_order_items to authenticated;
