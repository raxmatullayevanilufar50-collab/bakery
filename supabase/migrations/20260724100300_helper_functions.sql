-- RLS siyosatlari uchun yordamchi funksiyalar.
-- SECURITY DEFINER + stable: rekursiv RLS tekshiruvlarisiz tez ishlaydi.
-- Ikkalasi ham profiles.is_active = false bo'lsa null qaytaradi —
-- shu orqali ishdan bo'shatilgan xodim uchun barcha company_id-ga
-- bog'liq siyosatlar avtomatik rad etiladi (4-bo'lim, 6-talab).

create or replace function get_my_company_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select company_id from profiles where id = auth.uid() and is_active = true
$$;

create or replace function get_my_role()
returns user_role
language sql
security definer
stable
set search_path = public
as $$
  select role from profiles where id = auth.uid() and is_active = true
$$;

-- profiles.role / company_id / pin_hash / is_active ustunlari faqat
-- tizim funksiyalari (SECURITY DEFINER RPC) orqali o'zgartirilishi kerak
-- (4-bo'lim, 7-talab: column-level himoya). Oddiy UPDATE so'rovlari bilan
-- bu ustunlarni o'zgartirishga urinish xatolik beradi; RPC funksiyalari
-- ichida set_config('app.bypass_protect', 'true', true) chaqirilib,
-- shu triggerdan o'tkaziladi.
create or replace function protect_profile_columns()
returns trigger
language plpgsql
as $$
begin
  if current_setting('app.bypass_protect', true) = 'true' then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.company_id is distinct from old.company_id
     or new.pin_hash is distinct from old.pin_hash
     or new.is_active is distinct from old.is_active then
    raise exception 'Bu ustunlarni faqat tizim funksiyalari orqali o''zgartirish mumkin';
  end if;

  return new;
end;
$$;

create trigger trg_protect_profile_columns
  before update on profiles
  for each row execute function protect_profile_columns();

-- companies.code / owner_id / id hech qachon o'zgarmasligi kerak.
create or replace function protect_company_columns()
returns trigger
language plpgsql
as $$
begin
  if new.code is distinct from old.code
     or new.owner_id is distinct from old.owner_id then
    raise exception 'Bu ustunlarni o''zgartirish mumkin emas';
  end if;

  return new;
end;
$$;

create trigger trg_protect_company_columns
  before update on companies
  for each row execute function protect_company_columns();
