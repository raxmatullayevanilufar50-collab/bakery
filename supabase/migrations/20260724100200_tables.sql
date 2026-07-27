-- Asosiy jadvallar (texnik topshiriq 6-bo'lim)

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique default generate_company_code(),
  address text,
  business_type text,
  owner_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  full_name text not null,
  role user_role not null,
  phone text,
  pin_hash text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index profiles_company_id_idx on profiles(company_id);

-- Xodimni kompaniyaga taklif qilish uchun bir martalik kod.
-- Haqiqiy auth hisobi (telefon + OTP) xodim shu kodni kiritganda yaratiladi,
-- so'ng redeem_invite() funksiyasi profiles yozuvini yaratadi.
create table invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null unique default generate_invite_code(),
  phone text not null,
  full_name text not null,
  role user_role not null,
  created_by uuid not null references auth.users(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_at timestamptz,
  used_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index invites_company_id_idx on invites(company_id);

-- PIN kiritish urinishlari — 5 daqiqada 5 marta xato bo'lsa bloklash uchun.
create table pin_attempts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  attempted_at timestamptz not null default now(),
  success boolean not null
);

create index pin_attempts_profile_id_attempted_at_idx
  on pin_attempts(profile_id, attempted_at desc);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  actor_id uuid references auth.users(id),
  action text not null,
  target_table text,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_company_id_created_at_idx on audit_logs(company_id, created_at desc);

-- Umumiy qurilmada PIN bilan tez kirish uchun ro'yxatga olingan qurilmalar.
-- device_key — brauzer localStorage'ida saqlanadigan tasodifiy identifikator.
create table devices (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  device_key text not null unique,
  device_label text,
  last_seen_at timestamptz not null default now(),
  is_revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create index devices_profile_id_idx on devices(profile_id);

create table shifts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz,
  status text not null default 'rejalashtirilgan'
    check (status in ('rejalashtirilgan', 'faol', 'tugallangan', 'bekor_qilingan')),
  created_at timestamptz not null default now()
);

create index shifts_company_id_idx on shifts(company_id);
create index shifts_profile_id_idx on shifts(profile_id);

create table products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  unit text not null default 'dona',
  price numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index products_company_id_idx on products(company_id);

create table production_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  product_id uuid not null references products(id),
  assigned_to uuid references profiles(id),
  quantity numeric(12, 2) not null,
  status text not null default 'rejalashtirilgan'
    check (status in ('rejalashtirilgan', 'jarayonda', 'tayyor', 'bekor_qilingan')),
  created_at timestamptz not null default now()
);

create index production_tasks_company_id_idx on production_tasks(company_id);
create index production_tasks_assigned_to_idx on production_tasks(assigned_to);

create table inventory_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  quantity numeric(12, 2) not null default 0,
  unit text not null default 'kg',
  low_stock_threshold numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index inventory_items_company_id_idx on inventory_items(company_id);

create table orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  customer_name text not null,
  customer_phone text,
  address text,
  status text not null default 'yangi'
    check (status in ('yangi', 'tayyorlanmoqda', 'yolda', 'yetkazildi', 'bekor_qilindi')),
  assigned_driver_id uuid references profiles(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index orders_company_id_idx on orders(company_id);
create index orders_assigned_driver_id_idx on orders(assigned_driver_id);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity numeric(12, 2) not null
);

create index order_items_order_id_idx on order_items(order_id);
