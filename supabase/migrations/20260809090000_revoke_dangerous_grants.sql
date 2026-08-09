-- Xavfli avtomatik grantlarni olib tashlash.
--
-- Muammo: Supabase har bir yangi loyihada `alter default privileges in
-- schema public grant all on tables to anon, authenticated, service_role`
-- o'rnatib qo'yadi. Shu sababli migratsiyalarda yaratilgan HAR BIR jadval
-- avtomatik ravishda anon va authenticated rollariga quyidagilarni beradi:
--
--   TRUNCATE   — jadvalni butunlay bo'shatish. RLS'ni CHETLAB O'TADI:
--                siyosatlar tekshirilmaydi, boshqa kompaniyalar
--                ma'lumoti ham o'chadi.
--   REFERENCES — bu jadvalga tashqi kalit yaratish.
--   TRIGGER    — jadvalga trigger osish (mavjud funksiyani ulash orqali).
--   MAINTAIN   — VACUUM/ANALYZE/REINDEX/CLUSTER (PostgreSQL 17+).
--
-- 20260724100600_grants.sql da "anon rolga hech qanday jadval ruxsati
-- berilmaydi" deb yozilgan, lekin amalda anon shu 4 ta ruxsatga ega edi —
-- default privileges GRANT'dan mustaqil ishlaydi.
--
-- Hozircha ilova orqali ulardan foydalanib bo'lmaydi (PostgREST faqat
-- SELECT/INSERT/UPDATE/DELETE va RPC'ni ochadi), shuning uchun bu
-- zudlik bilan ekspluatatsiya qilinadigan teshik emas. Lekin mijozga
-- sotiladigan mahsulotda "himoya faqat PostgREST nima ochmasligiga
-- bog'liq" degan holat qolmasligi kerak — baza darajasida yopamiz.
--
-- DML (SELECT/INSERT/UPDATE/DELETE) tegilmaydi — haqiqiy cheklov
-- 20260724100400 dagi RLS siyosatlari orqali ishlaydi va o'zgarmaydi.

revoke truncate, references, trigger on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- MAINTAIN faqat PostgreSQL 17+ da mavjud. Eskiroq versiyaga tiklansa
-- migratsiya butunlay yiqilmasligi uchun alohida, xatosiz bajariladi.
do $$
begin
  execute 'revoke maintain on all tables in schema public from anon';
  execute 'revoke maintain on all tables in schema public from authenticated';
exception
  when syntax_error or feature_not_supported or undefined_object then
    raise notice 'MAINTAIN ruxsati bu PostgreSQL versiyasida mavjud emas — o''tkazib yuborildi';
end;
$$;

-- Bundan keyin yaratiladigan jadvallar ham shu ruxsatlarni OLMASLIGI kerak.
-- `alter default privileges` faqat uni bajarayotgan rol yaratgan obyektlarga
-- ta'sir qiladi; migratsiyalar `postgres` roli ostida ishlaydi, shuning
-- uchun aynan shu yozuv tuzatiladi.
alter default privileges in schema public revoke truncate, references, trigger on tables from anon;
alter default privileges in schema public revoke truncate, references, trigger on tables from authenticated;

do $$
begin
  execute 'alter default privileges in schema public revoke maintain on tables from anon';
  execute 'alter default privileges in schema public revoke maintain on tables from authenticated';
exception
  when syntax_error or feature_not_supported or undefined_object then
    null;
end;
$$;

-- service_role tegilmaydi: u server tomonidagi ishonchli rol (Edge
-- Functions uni maxfiy kalit bilan ishlatadi) va allaqachon RLS'ni
-- ataylab chetlab o'tadi. Undan TRUNCATE olib tashlash hech narsa
-- qo'shmaydi — kalit sizib chiqsa, DELETE baribir ochiq.
