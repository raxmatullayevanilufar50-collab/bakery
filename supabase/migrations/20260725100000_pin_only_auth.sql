-- Eskiz/SMS integratsiyasi hozircha to'xtatildi. Xodimlar uchun asosiy
-- kirish usuli endi "Kompaniya kodi + PIN" — telefon raqami faqat
-- ixtiyoriy ma'lumot (kelajakda SMS uchun saqlanadi, autentifikatsiya
-- uchun ishlatilmaydi).
--
-- Arxitektura: Owner/Manager "create-employee" Edge Function orqali
-- xodim uchun auth.users yozuvini DARHOL yaratadi (Admin API, service_role
-- kaliti bilan, faqat serverda) va bir martalik "sozlash kodi"ni beradi.
-- Xodim shu kodni "pin-auth" Edge Function orqali ishlatib o'z PIN'ini
-- o'rnatadi; keyingi safar kompaniya kodi + ism tanlash + PIN orqali
-- kiradi. Ikkala holatda ham Edge Function haqiqiy Supabase sessiyasini
-- (Admin generateLink + verifyOtp orqali) yaratadi — PIN hech qachon
-- yagona xavfsizlik qatlami bo'lib qolmaydi, RLS baribir haqiqiy
-- auth.uid()'ga tayanadi.

alter table invites alter column phone drop not null;
alter table invites add column profile_id uuid references profiles(id) on delete cascade;

-- Xodim ro'yxatdan o'tish uchun kompaniya kodi bo'yicha faol (PIN
-- o'rnatilgan) xodimlar ro'yxatini ko'rsatadi — "kim ekaningizni tanlang"
-- ekrani uchun. Faqat ism/rol qaytaradi, boshqa hech narsa oshkor
-- qilinmaydi.
create or replace function list_company_employees_for_login(p_company_code text)
returns table (id uuid, full_name text, role user_role)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.full_name, p.role
  from profiles p
  join companies c on c.id = p.company_id
  where c.code = p_company_code and p.is_active = true and p.pin_hash is not null
  order by p.full_name
$$;

grant execute on function list_company_employees_for_login(text) to anon, authenticated;

-- Quyidagi ikkala funksiya ham FAQAT service_role uchun — ya'ni faqat
-- bizning Edge Function'larimiz chaqira oladi (SUPABASE_SERVICE_ROLE_KEY
-- orqali). anon/authenticated orqali to'g'ridan-to'g'ri chaqirib
-- bo'lmaydi, aks holda PIN'ni "brute force" qilish imkoni tug'ilardi.

create or replace function admin_complete_pin_setup(p_company_code text, p_invite_code text, p_pin text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_company companies;
  v_invite invites;
  v_profile profiles;
begin
  if p_pin !~ '^[0-9]{4,6}$' then
    raise exception 'PIN-kod 4 dan 6 tagacha raqamdan iborat bo''lishi kerak';
  end if;

  select * into v_company from companies where code = p_company_code;
  if v_company is null then
    raise exception 'Kompaniya kodi topilmadi';
  end if;

  select * into v_invite from invites
  where code = p_invite_code and company_id = v_company.id and used_at is null and expires_at > now()
  for update;
  if v_invite is null then
    raise exception 'Taklif kodi noto''g''ri yoki muddati tugagan';
  end if;
  if v_invite.profile_id is null then
    raise exception 'Bu taklif kodi profil bilan bog''lanmagan';
  end if;

  select * into v_profile from profiles where id = v_invite.profile_id and company_id = v_company.id;
  if v_profile is null then
    raise exception 'Xodim profili topilmadi';
  end if;
  if not v_profile.is_active then
    raise exception 'Profil faol emas';
  end if;
  if v_profile.pin_hash is not null then
    raise exception 'PIN allaqachon o''rnatilgan';
  end if;

  perform set_config('app.bypass_protect', 'true', true);
  update profiles set pin_hash = crypt(p_pin, gen_salt('bf')) where id = v_profile.id;

  update invites set used_at = now(), used_by = v_profile.id where id = v_invite.id;

  insert into audit_logs (company_id, actor_id, action, target_table, target_id)
  values (v_company.id, v_profile.id, 'pin_ornatildi', 'profiles', v_profile.id);

  return v_profile.id;
end;
$$;

revoke all on function admin_complete_pin_setup(text, text, text) from public;
grant execute on function admin_complete_pin_setup(text, text, text) to service_role;

create or replace function admin_verify_pin_for_login(p_company_code text, p_profile_id uuid, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_company companies;
  v_profile profiles;
  v_recent_failures int;
  v_ok boolean;
begin
  select * into v_company from companies where code = p_company_code;
  if v_company is null then
    raise exception 'Kompaniya kodi topilmadi';
  end if;

  select * into v_profile from profiles where id = p_profile_id and company_id = v_company.id;
  if v_profile is null or not v_profile.is_active then
    raise exception 'Profil topilmadi yoki faol emas';
  end if;
  if v_profile.pin_hash is null then
    raise exception 'PIN hali o''rnatilmagan';
  end if;

  select count(*) into v_recent_failures
  from pin_attempts
  where profile_id = v_profile.id
    and success = false
    and attempted_at > now() - interval '5 minutes';

  if v_recent_failures >= 5 then
    raise exception 'Juda ko''p noto''g''ri urinish. 5 daqiqadan so''ng qayta urinib ko''ring';
  end if;

  v_ok := v_profile.pin_hash = crypt(p_pin, v_profile.pin_hash);

  insert into pin_attempts (profile_id, success) values (v_profile.id, v_ok);

  return v_ok;
end;
$$;

revoke all on function admin_verify_pin_for_login(text, uuid, text) from public;
grant execute on function admin_verify_pin_for_login(text, uuid, text) to service_role;
