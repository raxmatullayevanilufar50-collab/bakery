-- Kompaniya kodi va taklif kodi generatorlari.
-- Bular jadvallardan oldin yaratiladi, chunki `invites.code` ustuni
-- default qiymat sifatida generate_invite_code() dan foydalanadi.
-- plpgsql funksiyalari yaratilish vaqtida jadval mavjudligini
-- tekshirmaydi (faqat chaqirilganda), shuning uchun bu tartib xavfsiz.

create or replace function generate_company_code()
returns text
language plpgsql
as $$
declare
  new_code text;
  already_exists boolean;
begin
  loop
    new_code := 'NT-' || lpad(floor(random() * 10000)::int::text, 4, '0');
    select exists(select 1 from companies where code = new_code) into already_exists;
    exit when not already_exists;
  end loop;
  return new_code;
end;
$$;

create or replace function generate_invite_code()
returns text
language plpgsql
as $$
declare
  new_code text;
  already_exists boolean;
begin
  loop
    new_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    select exists(select 1 from invites where code = new_code) into already_exists;
    exit when not already_exists;
  end loop;
  return new_code;
end;
$$;
