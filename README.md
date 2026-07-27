# Bakery

Nonvoyxona/pekarniya korxonalari uchun multi-tenant boshqaruv tizimi.
React 18 + Vite + Tailwind CSS + Supabase (Postgres, Auth, RLS, Realtime).

## Holat: 1-bosqich (asos)

Hozircha tugallangan:
- To'liq DB sxemasi va har bir jadval uchun RLS siyosatlari (`supabase/migrations/`)
- Auth oqimi: kompaniya yaratish (Owner), xodim qo'shilishi (telefon+OTP+taklif kodi), PIN o'rnatish/kirish
- Har bir rol uchun bo'sh boshqaruv paneli (routing ishlaydi, funksiyalar keyingi bosqichda qo'shiladi)

Keyingi bosqichlar: ish jadvali, ishlab chiqarish, ombor, buyurtmalar, hisobotlar, Telegram integratsiyasi.

## Supabase loyihasini sozlash

1. [supabase.com](https://supabase.com) da hisob oching va **New project** tugmasini bosing.
2. Loyiha nomi, parol (database password) va hudud (region) tanlang — yaqin hudud (masalan Frankfurt) tanlang, tezroq ishlaydi.
3. Loyiha tayyor bo'lgach, **Project Settings → API** bo'limidan `Project URL` va `anon public` kalitini nusxalang.
4. Repozitoriy ildizida `.env` fayl yarating (`.env.example` dan nusxa oling) va shu ikkita qiymatni kiriting:
   ```
   VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbG....
   ```

## Migratsiyalarni ishga tushirish

`supabase/migrations/` papkasidagi fayllarni **Supabase Dashboard → SQL Editor**da, fayl nomidagi tartib bo'yicha (raqamlar bo'yicha, eng kichigidan boshlab) birma-bir bajaring:

1. `20260724100000_extensions_and_types.sql`
2. `20260724100100_code_generators.sql`
3. `20260724100200_tables.sql`
4. `20260724100300_helper_functions.sql`
5. `20260724100400_rls_policies.sql`
6. `20260724100500_rpc_functions.sql`
7. `20260724100600_grants.sql`
8. `20260724100700_fix_pgcrypto_search_path.sql`
9. `20260724100800_sales.sql`
10. `20260724100900_realtime.sql`
11. `20260724101000_task_quantity_rpc.sql`
12. `20260724101100_restrict_profiles_visibility.sql`
13. `20260724101200_preferred_language.sql`
14. `20260724101300_production_logs_and_sales_customer.sql`
15. `20260724101400_voice_feature_rls.sql`
16. `20260724101500_sales_own_recorder_visibility.sql`
17. `20260725100000_pin_only_auth.sql`
18. `20260725100100_service_role_grants.sql`
19. `20260727100000_cascade_fk_fixes.sql`

Har birini SQL Editor'ga joylab **Run** tugmasini bosing, xatosiz o'tganidan keyin keyingisiga o'ting.

(Agar keyinchalik Supabase CLI o'rnatsangiz, `supabase db push` shu papkani avtomatik tartib bilan bajaradi.)

## Xodimlar kirishi: Kompaniya kodi + PIN

SMS/Eskiz integratsiyasi **hozircha to'xtatilgan** (murakkab va vaqt talab qildi).
Xodimlar uchun asosiy kirish usuli — **Kompaniya kodi + PIN**, telefon raqami esa
faqat ixtiyoriy ma'lumot (kelajakda SMS qayta yoqilsa ishlatiladi).

**Arxitektura:** PIN hech qachon yagona xavfsizlik qatlami bo'lib qolmaydi (4-bo'lim
talabi) — u ikkita Edge Function orqali HAQIQIY Supabase sessiyasini yaratadi:

- `create-employee` — Owner/Manager xodimni yaratganda chaqiriladi (o'z sessiyasi
  bilan). `SUPABASE_SERVICE_ROLE_KEY` (Supabase avtomatik beradigan standart
  secret) yordamida darhol `auth.users` yozuvini yaratadi va bir martalik
  "sozlash kodi" qaytaradi.
- `pin-auth` — xodim tomonidan chaqiriladi (sessiyasiz — bu uning o'zi kirish
  nuqtasi). Ikki amal: `setup` (sozlash kodi + yangi PIN) va `login` (mavjud PIN).
  Ikkalasi ham serverda tekshirilgach, Admin API orqali haqiqiy sessiya
  yaratib qaytaradi.

Bu ikkala funksiya allaqachon loyihaga deploy qilingan. Faqat migratsiyani
ishga tushirish kifoya (yuqoridagi 17-qadam: `20260725100000_pin_only_auth.sql`).

Agar kelajakda o'zgartirish kerak bo'lsa, qayta deploy qilish uchun:
```
npx supabase functions deploy create-employee --project-ref qnbfkwmitsuixgprimzg
npx supabase functions deploy pin-auth --project-ref qnbfkwmitsuixgprimzg --no-verify-jwt
```

`supabase/functions/send-sms-hook/` va Eskiz sozlamalari (secrets, hook) hozircha
tegilmagan holda qoldirilgan — kelajakda SMS'ga qaytishni xohlasangiz, ular hali ham
mavjud, faqat hozircha login oqimida ishlatilmaydi.

**Authentication → Providers → Email**da "Confirm email" o'chirilgan bo'lsa, Owner ro'yxatdan o'tgandan keyin darhol tizimga kiradi (test uchun qulay). Yoqilgan bo'lsa, email tasdiqlangandan keyin `/kirish` orqali kirish kerak bo'ladi.

**Authentication → Providers → Email**da "Confirm email" o'chirilgan bo'lsa, Owner ro'yxatdan o'tgandan keyin darhol tizimga kiradi (test uchun qulay). Yoqilgan bo'lsa, email tasdiqlangandan keyin `/kirish` orqali kirish kerak bo'ladi.

## Loyihani ishga tushirish

```
npm install
npm run dev
```

## RLS'ni tekshirish

`supabase/tests/rls_manual_tests.sql` faylida har bir muhim siyosat uchun qo'lda bajariladigan test so'rovlari bor (SQL Editor'da, ikkita haqiqiy foydalanuvchi UUID'sini joylashtirib bajariladi).
