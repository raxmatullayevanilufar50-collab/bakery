-- Supabase loyihalarida pgcrypto odatda `extensions` sxemasiga o'rnatiladi,
-- `public`ka emas. set_pin/verify_pin funksiyalarida search_path faqat
-- public bo'lgani uchun crypt()/gen_salt() topilmay xato berardi
-- ("function gen_salt(unknown) does not exist"). Fix: search_path'ga
-- extensions sxemasini ham qo'shamiz.

create or replace function set_pin(p_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
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

create or replace function verify_pin(p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
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
