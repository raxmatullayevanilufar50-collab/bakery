-- Baker o'ziga tayinlangan vazifaning haqiqiy miqdorini (ovoz orqali
-- kiritilgan qiymatni) yangilashi uchun — update_task_status bilan bir xil
-- avtorizatsiya mantig'i (5-bo'lim, 7-band: "Ovozli kiritish").
create or replace function update_task_quantity(p_task_id uuid, p_quantity numeric)
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

  if p_quantity <= 0 then
    raise exception 'Miqdor musbat bo''lishi kerak';
  end if;

  update production_tasks set quantity = p_quantity where id = p_task_id;
end;
$$;

grant execute on function update_task_quantity(uuid, numeric) to authenticated;
