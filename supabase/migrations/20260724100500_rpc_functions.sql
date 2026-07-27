-- Barcha nozik amallar shu yerdagi SECURITY DEFINER funksiyalar orqali
-- bajariladi: har biri auth.uid() va rolni tekshiradi, so'ng kerakli
-- yozuvni yaratadi/yangilaydi va audit_logs'ga qayd qiladi.

-- ── Kompaniya yaratish (Owner ro'yxatdan o'tishi, 2.1-bo'lim) ──────────────
create or replace function create_company(
  p_name text,
  p_address text,
  p_business_type text,
  p_full_name text
)
returns companies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company companies;
begin
  if auth.uid() is null then
    raise exception 'Avtorizatsiyadan o''tilmagan';
  end if;

  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'Siz allaqachon bir kompaniyaga tegishlisiz';
  end if;

  insert into companies (name, address, business_type, owner_id)
  values (p_name, p_address, p_business_type, auth.uid())
  returning * into v_company;

  perform set_config('app.bypass_protect', 'true', true);
  insert into profiles (id, company_id, full_name, role, is_active)
  values (auth.uid(), v_company.id, p_full_name, 'owner', true);

  insert into audit_logs (company_id, actor_id, action, target_table, target_id)
  values (v_company.id, auth.uid(), 'kompaniya_yaratildi', 'companies', v_company.id);

  return v_company;
end;
$$;

grant execute on function create_company(text, text, text, text) to authenticated;

-- ── Taklifni qabul qilish (Xodim qo'shish oqimi, 2.2-bo'lim) ──────────────
-- Xodim telefon + OTP orqali avval Supabase Auth sessiyasini oladi
-- (frontendda supabase.auth.signInWithOtp/verifyOtp), so'ng shu funksiyani
-- chaqirib taklif kodini profiliga aylantiradi.
create or replace function redeem_invite(p_code text)
returns profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite invites;
  v_profile profiles;
  v_phone text;
begin
  if auth.uid() is null then
    raise exception 'Avtorizatsiyadan o''tilmagan';
  end if;

  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'Siz allaqachon bir kompaniyaga tegishlisiz';
  end if;

  select phone into v_phone from auth.users where id = auth.uid();

  select * into v_invite from invites
  where code = p_code and used_at is null and expires_at > now()
  for update;

  if v_invite is null then
    raise exception 'Taklif kodi noto''g''ri yoki muddati tugagan';
  end if;

  if v_phone is null or v_invite.phone <> v_phone then
    raise exception 'Telefon raqami taklif bilan mos kelmadi';
  end if;

  perform set_config('app.bypass_protect', 'true', true);
  insert into profiles (id, company_id, full_name, role, phone, is_active)
  values (auth.uid(), v_invite.company_id, v_invite.full_name, v_invite.role, v_invite.phone, true)
  returning * into v_profile;

  update invites set used_at = now(), used_by = auth.uid() where id = v_invite.id;

  insert into audit_logs (company_id, actor_id, action, target_table, target_id)
  values (v_invite.company_id, auth.uid(), 'xodim_qoshildi', 'profiles', v_profile.id);

  return v_profile;
end;
$$;

grant execute on function redeem_invite(text) to authenticated;

-- ── PIN o'rnatish / tekshirish (4-bo'lim) ──────────────────────────────────
create or replace function set_pin(p_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Avtorizatsiyadan o''tilmagan';
  end if;

  if p_pin !~ '^[0-9]{4,6}$' then
    raise exception 'PIN-kod 4 dan 6 tagacha raqamdan iborat bo''lishi kerak';
  end if;

  perform set_config('app.bypass_protect', 'true', true);
  update profiles
  set pin_hash = crypt(p_pin, gen_salt('bf'))
  where id = auth.uid();
end;
$$;

grant execute on function set_pin(text) to authenticated;

-- PIN har doim mavjud Supabase sessiyasini tekshiradi — o'zi token
-- yaratmaydi (2.2 va 4-bo'lim). 5 daqiqada 5 xato urinish — bloklash.
create or replace function verify_pin(p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile profiles;
  v_recent_failures int;
  v_ok boolean;
begin
  if auth.uid() is null then
    raise exception 'Avtorizatsiyadan o''tilmagan';
  end if;

  select * into v_profile from profiles where id = auth.uid();

  if v_profile is null or v_profile.is_active = false then
    raise exception 'Profil topilmadi yoki faol emas';
  end if;

  select count(*) into v_recent_failures
  from pin_attempts
  where profile_id = v_profile.id
    and success = false
    and attempted_at > now() - interval '5 minutes';

  if v_recent_failures >= 5 then
    raise exception 'Juda ko''p noto''g''ri urinish. 5 daqiqadan so''ng qayta urinib ko''ring';
  end if;

  v_ok := v_profile.pin_hash is not null and v_profile.pin_hash = crypt(p_pin, v_profile.pin_hash);

  insert into pin_attempts (profile_id, success) values (v_profile.id, v_ok);

  return v_ok;
end;
$$;

grant execute on function verify_pin(text) to authenticated;

-- ── Xodimlarni boshqarish (faqat Owner) ────────────────────────────────────
create or replace function update_employee_role(p_profile_id uuid, p_role user_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if get_my_role() <> 'owner' then
    raise exception 'Faqat kompaniya egasi rolni o''zgartira oladi';
  end if;

  if not exists (select 1 from profiles where id = p_profile_id and company_id = get_my_company_id()) then
    raise exception 'Xodim topilmadi';
  end if;

  perform set_config('app.bypass_protect', 'true', true);
  update profiles set role = p_role where id = p_profile_id;

  insert into audit_logs (company_id, actor_id, action, target_table, target_id, metadata)
  values (get_my_company_id(), auth.uid(), 'rol_ozgartirildi', 'profiles', p_profile_id,
    jsonb_build_object('new_role', p_role));
end;
$$;

grant execute on function update_employee_role(uuid, user_role) to authenticated;

create or replace function set_employee_active(p_profile_id uuid, p_is_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if get_my_role() <> 'owner' then
    raise exception 'Faqat kompaniya egasi xodim holatini o''zgartira oladi';
  end if;

  if not exists (select 1 from profiles where id = p_profile_id and company_id = get_my_company_id()) then
    raise exception 'Xodim topilmadi';
  end if;

  perform set_config('app.bypass_protect', 'true', true);
  update profiles set is_active = p_is_active where id = p_profile_id;

  insert into audit_logs (company_id, actor_id, action, target_table, target_id, metadata)
  values (get_my_company_id(), auth.uid(),
    case when p_is_active then 'xodim_faollashtirildi' else 'xodim_ochirildi' end,
    'profiles', p_profile_id, null);
end;
$$;

grant execute on function set_employee_active(uuid, boolean) to authenticated;

-- ── Qurilmalarni boshqarish (4-bo'lim, 5-talab) ────────────────────────────
create or replace function register_device(p_device_key text, p_device_label text)
returns devices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device devices;
begin
  if auth.uid() is null then
    raise exception 'Avtorizatsiyadan o''tilmagan';
  end if;

  insert into devices (profile_id, device_key, device_label, last_seen_at)
  values (auth.uid(), p_device_key, p_device_label, now())
  on conflict (device_key) do update
    set last_seen_at = now(), profile_id = excluded.profile_id, is_revoked = false
  returning * into v_device;

  return v_device;
end;
$$;

grant execute on function register_device(text, text) to authenticated;

-- Frontend har safar ilova ochilganda shu funksiyani chaqirib,
-- joriy qurilma bloklanmaganini tekshiradi; bloklangan bo'lsa
-- mijoz tomonda darhol chiqish (signOut) qilinadi.
create or replace function check_device(p_device_key text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select not coalesce(
    (select is_revoked from devices where device_key = p_device_key and profile_id = auth.uid()),
    false
  );
$$;

grant execute on function check_device(text) to authenticated;

create or replace function revoke_device(p_device_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if get_my_role() <> 'owner' then
    raise exception 'Faqat kompaniya egasi qurilmani bloklashi mumkin';
  end if;

  if not exists (
    select 1 from devices d
    join profiles p on p.id = d.profile_id
    where d.id = p_device_id and p.company_id = get_my_company_id()
  ) then
    raise exception 'Qurilma topilmadi';
  end if;

  update devices set is_revoked = true where id = p_device_id;

  insert into audit_logs (company_id, actor_id, action, target_table, target_id)
  values (get_my_company_id(), auth.uid(), 'qurilma_bloklandi', 'devices', p_device_id);
end;
$$;

grant execute on function revoke_device(uuid) to authenticated;

-- ── Ishlab chiqarish / buyurtma holatini yangilash ─────────────────────────
create or replace function update_task_status(p_task_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task production_tasks;
begin
  select * into v_task from production_tasks
  where id = p_task_id and company_id = get_my_company_id();

  if v_task is null then
    raise exception 'Vazifa topilmadi';
  end if;

  if get_my_role() not in ('owner', 'manager') and v_task.assigned_to <> auth.uid() then
    raise exception 'Bu vazifa sizga tayinlanmagan';
  end if;

  if p_status not in ('rejalashtirilgan', 'jarayonda', 'tayyor', 'bekor_qilingan') then
    raise exception 'Noto''g''ri holat qiymati';
  end if;

  update production_tasks set status = p_status where id = p_task_id;
end;
$$;

grant execute on function update_task_status(uuid, text) to authenticated;

create or replace function update_order_status(p_order_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders;
begin
  select * into v_order from orders
  where id = p_order_id and company_id = get_my_company_id();

  if v_order is null then
    raise exception 'Buyurtma topilmadi';
  end if;

  if get_my_role() not in ('owner', 'manager') and v_order.assigned_driver_id <> auth.uid() then
    raise exception 'Bu buyurtma sizga tayinlanmagan';
  end if;

  if p_status not in ('yangi', 'tayyorlanmoqda', 'yolda', 'yetkazildi', 'bekor_qilindi') then
    raise exception 'Noto''g''ri holat qiymati';
  end if;

  update orders set status = p_status where id = p_order_id;
end;
$$;

grant execute on function update_order_status(uuid, text) to authenticated;
