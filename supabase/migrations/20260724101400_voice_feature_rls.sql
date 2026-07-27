-- Ovozli savdo kiritish endi Owner va Baker uchun ham ochiq (Cashier'ning
-- mavjud imkoniyati saqlanadi). Yozuvni kim yaratsa ham cashier_id har doim
-- auth.uid() bo'lishi shart — frontend "kim sotdi" maydonini so'ramaydi,
-- doim joriy foydalanuvchini yozadi.
drop policy "sales_insert_own_cashier" on sales;

create policy "sales_insert_self" on sales
  for insert
  with check (
    company_id = get_my_company_id()
    and cashier_id = auth.uid()
    and get_my_role() in ('owner', 'baker', 'cashier')
  );

-- Manager "Hisobotlar"da FAQAT o'z smenasi vaqtida yozilgan savdolarni
-- ko'radi — ya'ni yaratilgan payti (created_at) Manager'ning shifts
-- jadvalidagi o'z smenasi oralig'iga (start_time..end_time) to'g'ri
-- keladigan yozuvlar. Owner cheklovsiz ko'radi (mavjud siyosat).
create policy "sales_select_manager_own_shift" on sales
  for select
  using (
    company_id = get_my_company_id()
    and get_my_role() = 'manager'
    and exists (
      select 1 from shifts s
      where s.profile_id = auth.uid()
        and sales.created_at >= s.start_time
        and sales.created_at <= coalesce(s.end_time, now())
    )
  );

-- production_logs: faqat Baker o'zi (o'ziga tayinlab emas, o'zi kiritadi).
create policy "production_logs_insert_self_baker" on production_logs
  for insert
  with check (
    company_id = get_my_company_id()
    and profile_id = auth.uid()
    and get_my_role() = 'baker'
  );

create policy "production_logs_select_owner" on production_logs
  for select
  using (company_id = get_my_company_id() and get_my_role() = 'owner');

-- Manager: shifts jadvalidagi o'z smenasi vaqtiga to'g'ri keladigan yozuvlar
-- (sales bilan bir xil mantiq).
create policy "production_logs_select_manager_own_shift" on production_logs
  for select
  using (
    company_id = get_my_company_id()
    and get_my_role() = 'manager'
    and exists (
      select 1 from shifts s
      where s.profile_id = auth.uid()
        and production_logs.created_at >= s.start_time
        and production_logs.created_at <= coalesce(s.end_time, now())
    )
  );

-- Baker: faqat o'zi kiritgan yozuvlarni ko'radi ("Ishlab chiqarish qaydi"
-- sahifasida bugungi yozuvlar ro'yxati uchun).
create policy "production_logs_select_own_baker" on production_logs
  for select
  using (company_id = get_my_company_id() and profile_id = auth.uid());
