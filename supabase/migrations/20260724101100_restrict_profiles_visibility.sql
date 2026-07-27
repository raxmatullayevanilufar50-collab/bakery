-- 3-bo'lim (Rollar va ko'rinish matritsasi) qat'iy talab qiladi: har bir
-- rol faqat o'ziga tegishli narsani ko'rishi kerak. Asl "profiles_select_company"
-- siyosati kompaniyadagi HAR QANDAY xodimga butun xodimlar ro'yxatini
-- (ism, rol, telefon) ko'rishga ruxsat berardi — bu Baker/Driver/Cashier
-- uchun ortiqcha edi (ular faqat o'z profilini bilishi kerak). Owner va
-- Manager esa xodimlarni tayinlash/boshqarish uchun to'liq ro'yxatga
-- muhtoj — shuning uchun ular uchun ruxsat saqlanadi.

drop policy "profiles_select_company" on profiles;

create policy "profiles_select_self_or_owner_manager" on profiles
  for select
  using (
    id = auth.uid()
    or (company_id = get_my_company_id() and get_my_role() in ('owner', 'manager'))
  );
