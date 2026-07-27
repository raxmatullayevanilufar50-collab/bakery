-- Yangilangan talab: Baker/Driver (agar savdo huquqi berilgan bo'lsa)
-- endi FAQAT o'zi kiritgan savdo yozuvlarini ko'ra oladi — avvalgi
-- "bu jadvalni umuman ko'rmaydi" qoidasi shu qismda yumshatildi.
-- Rolga bog'lamasdan yozamiz — kim yozgan bo'lsa (cashier_id = auth.uid())
-- o'sha ko'radi, shunda kelajakda boshqa rolga ham yozish huquqi
-- berilsa, ko'rish qoidasi qayta yozilmasdan ishlayveradi.
create policy "sales_select_own_recorder" on sales
  for select
  using (company_id = get_my_company_id() and cashier_id = auth.uid());
