-- Ovozli buyruq AI (parse-voice-command) orqali tahlil qilinganda,
-- shaffoflik uchun xom matn va tahlil natijasini audit_logs'ga yozadi.
-- SalesTab/ProductionLogTab (20260729090100 dagi ko'p-punktli tasdiqlash
-- oqimi) tasdiqlangan yozuvni saqlagandan keyin shu RPC'ni chaqiradi.
--
-- audit_logs'ning mavjud SELECT siyosati (audit_logs_select_owner,
-- 20260724100400) o'zgarmaydi — Owner har bir rolning har bir ovozli
-- buyrug'ini shu jurnalda ko'radi. To'g'ridan-to'g'ri INSERT siyosati
-- yo'q, shuning uchun bu SECURITY DEFINER funksiya audit_logs'ga
-- yoziladigan YAGONA teshik bo'lib qoladi (boshqa RPC'lar bilan bir xil
-- konvensiya).
create or replace function log_ai_voice_command(
  p_transcript text, p_parsed jsonb, p_model text, p_target_table text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Avtorizatsiyadan o''tilmagan';
  end if;

  insert into audit_logs (company_id, actor_id, action, target_table, metadata)
  values (get_my_company_id(), auth.uid(), 'ai_ovoz_buyrugi_tahlil_qilindi', p_target_table,
    jsonb_build_object('transcript', p_transcript, 'parsed', p_parsed, 'model', p_model));
end;
$$;

grant execute on function log_ai_voice_command(text, jsonb, text, text) to authenticated;
