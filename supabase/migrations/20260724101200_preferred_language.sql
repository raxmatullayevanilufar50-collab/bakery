-- i18n: har bir xodim o'ziga qulay tilni tanlashi va u saqlanib qolishi
-- uchun. RLS jihatidan bu ustun nozik emas — profiles_select_self_or_owner_manager
-- va profiles_update_self_or_owner siyosatlari, hamda trg_protect_profile_columns
-- trigger allaqachon uni qamrab oladi (trigger faqat role/company_id/pin_hash/
-- is_active'ni himoya qiladi), shuning uchun xodim buni to'g'ridan-to'g'ri
-- oddiy UPDATE bilan o'zgartira oladi — alohida RPC shart emas.

alter table profiles
  add column preferred_language text not null default 'uz'
  check (preferred_language in ('uz', 'ru', 'en'));
