-- RLS siyosatlarini qo'lda tekshirish uchun namuna so'rovlar.
-- Supabase Dashboard -> SQL Editor'da bajariladi. Bu fayl migration emas —
-- shunchaki 9-bo'lim talabiga ko'ra har bir siyosat uchun test namunasi.
--
-- Foydalanuvchi sessiyasini simulyatsiya qilish uchun Postgres'ning
-- `request.jwt.claims` sozlamasidan foydalanamiz — bu Supabase'ning
-- auth.uid() qanday ishlashini SQL Editor'da qo'lda taqlid qilish usuli.
-- Har bir blokni alohida bajaring (yangi so'rov oynasida), chunki
-- `set local` faqat joriy tranzaksiya doirasida ishlaydi.

-- ============================================================
-- 0. Tayyorgarlik: ikkita kompaniya va foydalanuvchilarni toping
-- ============================================================
select id, name, code, owner_id from companies order by created_at desc limit 5;
select id, company_id, full_name, role, is_active from profiles order by created_at desc limit 10;

-- ============================================================
-- 1. Kompaniyalar izolyatsiyasi: A kompaniyasi B kompaniyasini ko'rmasligi kerak
-- ============================================================
begin;
  select set_config('request.jwt.claims', json_build_object('sub', '<A_KOMPANIYA_OWNER_UUID>')::text, true);
  set local role authenticated;

  -- Faqat A kompaniyasi qatori qaytishi kerak:
  select id, name, code from companies;

  -- Faqat A kompaniyasidagi xodimlar qaytishi kerak:
  select id, full_name, role from profiles;
rollback;

-- ============================================================
-- 2. Ishdan bo'shatilgan xodim (is_active = false) — hamma narsaga kirish yo'qoladi
-- ============================================================
begin;
  -- Avval biror profilni faolsizlantiring (haqiqiy testda):
  -- perform set_employee_active('<PROFILE_UUID>', false);

  select set_config('request.jwt.claims', json_build_object('sub', '<FAOLSIZ_PROFILE_UUID>')::text, true);
  set local role authenticated;

  -- get_my_company_id() null qaytaradi -> 0 qator kelishi kerak:
  select * from products;
  select * from orders;
rollback;

-- ============================================================
-- 3. Rolga bog'liq ko'rinish: Baker faqat o'ziga tayinlangan vazifalarni ko'radi
-- ============================================================
begin;
  select set_config('request.jwt.claims', json_build_object('sub', '<BAKER_PROFILE_UUID>')::text, true);
  set local role authenticated;

  -- Faqat assigned_to = shu baker bo'lgan qatorlar qaytishi kerak:
  select id, quantity, status, assigned_to from production_tasks;

  -- 0 qator qaytishi kerak (baker inventarni ko'ra olmaydi):
  select * from inventory_items;
rollback;

-- ============================================================
-- 4. Column-level himoya: rolni to'g'ridan-to'g'ri UPDATE bilan o'zgartirib bo'lmaydi
-- ============================================================
begin;
  select set_config('request.jwt.claims', json_build_object('sub', '<XODIM_UUID>')::text, true);
  set local role authenticated;

  -- Xatolik berishi kerak: "Bu ustunlarni faqat tizim funksiyalari orqali o'zgartirish mumkin"
  update profiles set role = 'owner' where id = auth.uid();
rollback;

-- ============================================================
-- 5. Default-deny: profiles jadvaliga to'g'ridan-to'g'ri INSERT taqiqlangan
-- ============================================================
begin;
  select set_config('request.jwt.claims', json_build_object('sub', '<XODIM_UUID>')::text, true);
  set local role authenticated;

  -- Xatolik berishi kerak (RLS siyosatiga mos kelmaydi, chunki INSERT policy yo'q):
  insert into profiles (id, company_id, full_name, role)
  values (auth.uid(), '<BOSHQA_COMPANY_UUID>', 'Firibgar', 'owner');
rollback;

-- ============================================================
-- 6. PIN bloklash: 5 xato urinishdan keyin 6-chi urinish rad etilishi kerak
-- ============================================================
begin;
  select set_config('request.jwt.claims', json_build_object('sub', '<XODIM_UUID>')::text, true);
  set local role authenticated;

  select verify_pin('0000'); -- xato #1
  select verify_pin('0000'); -- xato #2
  select verify_pin('0000'); -- xato #3
  select verify_pin('0000'); -- xato #4
  select verify_pin('0000'); -- xato #5
  select verify_pin('0000'); -- bu yerda "Juda ko'p noto'g'ri urinish..." xatosi kutiladi
rollback;

-- ============================================================
-- 7. sales: Manager moliyaviy ma'lumotni ko'rmasligi kerak (3-bo'lim)
-- ============================================================
begin;
  select set_config('request.jwt.claims', json_build_object('sub', '<MANAGER_PROFILE_UUID>')::text, true);
  set local role authenticated;

  -- 0 qator qaytishi kerak — sales jadvalida Manager uchun policy yo'q:
  select * from sales;
rollback;

-- ============================================================
-- 8. sales: Cashier faqat o'zi yozgan savdoni ko'radi, boshqasinikini yo'q
-- ============================================================
begin;
  select set_config('request.jwt.claims', json_build_object('sub', '<CASHIER_A_UUID>')::text, true);
  set local role authenticated;

  -- Faqat cashier_id = shu foydalanuvchi bo'lgan qatorlar qaytishi kerak:
  select id, cashier_id, total from sales;

  -- Boshqa cashier nomidan yozishga urinish — 0 ta ta'sirlangan qator
  -- yoki RLS xatosi kutiladi:
  insert into sales (company_id, cashier_id, product_id, quantity, unit_price, total)
  values (get_my_company_id(), '<CASHIER_B_UUID>', '<PRODUCT_UUID>', 1, 1000, 1000);
rollback;

-- ============================================================
-- 9. Owner sales jadvalidagi barcha yozuvlarni ko'radi (moliyaviy hisobot)
-- ============================================================
begin;
  select set_config('request.jwt.claims', json_build_object('sub', '<OWNER_UUID>')::text, true);
  set local role authenticated;

  select count(*) from sales; -- kompaniyadagi barcha cashierlar yozuvlari
rollback;
