-- Ko'p qurilmali sinxronizatsiya (4-bo'lim, 8-talab): bitta xodim ikkita
-- qurilmadan kirsa ham, o'zgarishlar zudlik bilan ko'rinadi. Supabase
-- Realtime shu jadvallarning o'zgarishlarini efirga uzatadi; frontend
-- tarafda RLS baribir amal qiladi — foydalanuvchi faqat o'ziga ruxsat
-- etilgan qatorlar haqidagi hodisalarni oladi.

alter publication supabase_realtime add table production_tasks;
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table inventory_items;
alter publication supabase_realtime add table shifts;
